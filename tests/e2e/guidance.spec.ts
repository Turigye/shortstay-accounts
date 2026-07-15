import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test, _electron, type ElectronApplication, type Page } from "@playwright/test";

const PASSWORD = "correct local password";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 640 },
];
const CHAPTERS = [
  ["orientation", "Orientation"],
  ["bookings", "Booking Lifecycle"],
  ["money", "Money In and Money Out"],
  ["staff", "Staff and Referrals"],
  ["month-end", "Financial Position and Month End"],
  ["reports", "Reports and Tax"],
  ["administration", "Administration and Safety"],
] as const;

async function setWindowViewport(app: ElectronApplication, page: Page, width: number, height: number) {
  const viewport = await app.evaluate(({ BrowserWindow }, size) => {
    const window = BrowserWindow.getAllWindows()[0];
    window?.setSize(size.width, size.height);
    return window ? { contentSize: window.getContentSize(), size: window.getSize() } : null;
  }, { width, height });
  expect(viewport).not.toBeNull();
  expect(viewport!.size[0]).toBe(width);
  expect(viewport!.size[1]).toBeLessThanOrEqual(height);
  expect(viewport!.size[1]).toBeGreaterThanOrEqual(640);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function createBusiness(page: Page) {
  await page.getByLabel("Business name").fill("Guidance E2E");
  await page.getByLabel("Local password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("checkbox", { name: /approved defaults/i }).check();
  await page.getByRole("button", { name: "Create business" }).click();
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
}

async function openHelp(page: Page) {
  await page.getByRole("button", { name: "Help" }).click();
  await expect(page.getByRole("heading", { name: "Help Center", level: 1 })).toBeVisible();
}

async function expectTourGeometry(page: Page) {
  await expect(page.getByRole("dialog", { name: "Orientation" })).toBeVisible();
  await expect.poll(() => page.locator(".tour-panel").boundingBox()).not.toBeNull();

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const { bottom, height, left, right, top, width } = element.getBoundingClientRect();
      return { bottom, height, left, right, top, width };
    };
    const panel = rect(".tour-panel");
    const spotlight = rect(".tour-spotlight-focus");
    const root = document.documentElement;
    const overlaps = panel && spotlight
      ? panel.left < spotlight.right && panel.right > spotlight.left && panel.top < spotlight.bottom && panel.bottom > spotlight.top
      : null;

    return {
      panel,
      spotlight,
      overlaps,
      viewport: { height: window.innerHeight, width: window.innerWidth },
      horizontalOverflow: Math.max(root.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
    };
  });

  expect(geometry.horizontalOverflow).toBe(false);
  expect(geometry.overlaps).toBe(false);
  for (const rectangle of [geometry.panel, geometry.spotlight]) {
    expect(rectangle).not.toBeNull();
    expect(rectangle!.left).toBeGreaterThanOrEqual(0);
    expect(rectangle!.top).toBeGreaterThanOrEqual(0);
    expect(rectangle!.right).toBeLessThanOrEqual(geometry.viewport.width);
    expect(rectangle!.bottom).toBeLessThanOrEqual(geometry.viewport.height);
    expect(rectangle!.width).toBeGreaterThan(0);
    expect(rectangle!.height).toBeGreaterThan(0);
  }
}

test("keeps beginner guidance keyboard-accessible, responsive, and data-only", async () => {
  test.setTimeout(90_000);
  const profile = mkdtempSync(path.join(tmpdir(), "staybooks-guidance-e2e-"));
  let app: ElectronApplication | undefined;

  try {
    app = await _electron.launch({ args: [".", `--user-data-dir=${profile}`], cwd: process.cwd() });
    const page = await app.firstWindow();
    await setWindowViewport(app, page, VIEWPORTS[0].width, VIEWPORTS[0].height);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await createBusiness(page);

    const database = path.join(profile, "business.db");
    expect(existsSync(database)).toBe(true);
    expect(readFileSync(database).subarray(0, 16).toString()).not.toBe("SQLite format 3\0");
    const initialDatabaseMtime = statSync(database).mtimeMs;

    const welcome = page.getByRole("dialog", { name: "Welcome to Short-Stay Accounts" });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole("button", { name: "Start" })).toBeVisible();
    await expect(welcome.getByRole("button", { name: "Explore independently" })).toBeVisible();
    await expect(welcome.getByRole("button", { name: "Open guide" })).toBeVisible();
    await welcome.getByRole("button", { name: "Start" }).click();

    const orientationTour = page.getByRole("dialog", { name: "Orientation" });
    await expect(orientationTour).toBeVisible();
    while (await orientationTour.getByRole("button", { name: "Next" }).count()) {
      await orientationTour.getByRole("button", { name: "Next" }).click();
    }
    await orientationTour.getByRole("button", { name: "Finish" }).click();
    await expect(orientationTour).toHaveCount(0);

    await openHelp(page);
    const search = page.getByLabel("Search guide");
    await search.fill("rental tax");
    const results = page.getByRole("region", { name: "Search results" });
    await expect(results).toContainText("Reports and Tax");
    await expect(results).toContainText("Rental-tax estimate");
    await search.fill("");

    for (const [id, title] of CHAPTERS) {
      await page.getByRole("button", { name: `Start tour: ${id}` }).click();
      const tour = page.getByRole("dialog", { name: title });
      await expect(tour).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(tour).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Help" })).toBeFocused();
      if (id !== CHAPTERS.at(-1)![0]) await openHelp(page);
    }

    for (const { width, height } of VIEWPORTS) {
      await setWindowViewport(app, page, width, height);
      await openHelp(page);
      const helpSearch = page.getByLabel("Search guide");
      const orientationButton = page.getByRole("button", { name: "Start tour: orientation" });
      await expect(helpSearch).toBeVisible();
      await expect(orientationButton).toBeVisible();
      const helpLayout = await page.evaluate(() => {
        const searchRect = document.querySelector<HTMLInputElement>("[aria-label='Search guide']")?.getBoundingClientRect();
        const startTourRect = document.querySelector<HTMLButtonElement>("[aria-label='Start tour: orientation']")?.getBoundingClientRect();
        const root = document.documentElement;
        const withinViewport = (rect: DOMRect | undefined) => Boolean(
          rect && rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight,
        );
        return {
          horizontalOverflow: Math.max(root.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
          searchWithinViewport: withinViewport(searchRect),
          startTourWithinViewport: withinViewport(startTourRect),
        };
      });
      expect(helpLayout.horizontalOverflow).toBe(false);
      expect(helpLayout.searchWithinViewport).toBe(true);
      expect(helpLayout.startTourWithinViewport).toBe(true);

      await orientationButton.click();
      for (let step = 0; step < 4; step += 1) {
        await expectTourGeometry(page);
        if (step < 3) await page.getByRole("dialog", { name: "Orientation" }).getByRole("button", { name: "Next" }).click();
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Orientation" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Help" })).toBeFocused();
    }

    expect(statSync(database).mtimeMs).toBe(initialDatabaseMtime);
  } finally {
    try {
      await app?.close();
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  }
});
