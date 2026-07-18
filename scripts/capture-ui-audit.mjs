import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { _electron } from "playwright";

const PASSWORD = "audit-local-password";
const PACKAGED = process.argv.includes("--packaged");
const OUTPUT = path.join(process.cwd(), "test-results", "ui-audit");
const SIZES = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1024x640", width: 1024, height: 640 },
];
const SCREENS = [
  ["Today", "today"],
  ["Bookings", "bookings"],
  ["Payments", "payments"],
  ["Expenses", "expenses"],
  ["Staff", "staff"],
  ["Financial Position", "financial-position"],
  ["Reports", "reports"],
  ["Settings", "settings"],
];

function packagedExecutable() {
  const root = path.join(
    process.cwd(),
    "out",
    `Short-Stay Accounts-${process.platform}-${process.arch}`,
  );
  if (process.platform === "darwin") {
    return path.join(root, "Short-Stay Accounts.app", "Contents", "MacOS", "Short-Stay Accounts");
  }
  if (process.platform === "win32") return path.join(root, "Short-Stay Accounts.exe");
  return path.join(root, "short-stay-accounts");
}

async function invoke(page, channel, payload) {
  const result = await page.evaluate(
    ({ channel: ipcChannel, payload: ipcPayload }) =>
      window.stayBooks.invoke(ipcChannel, ipcPayload),
    { channel, payload },
  );
  if (!result.ok) throw new Error(`${channel}: ${result.message}`);
  return result.data;
}

async function resize(application, size) {
  await application.evaluate(({ BrowserWindow }, dimensions) => {
    BrowserWindow.getAllWindows()[0].setContentSize(dimensions.width, dimensions.height);
  }, size);
}

async function capture(page, directory, name) {
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(directory, `${name}.png`) });
}

async function assertLayout(page, screen, size) {
  const issues = await page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const findings = [];
    if (document.documentElement.scrollWidth > viewport.width + 1) {
      const overflowSource = [...document.querySelectorAll("*")]
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.right > viewport.width + 1)
        .sort((left, right) => right.rect.right - left.rect.right)[0];
      let ancestor = overflowSource?.element.parentElement;
      let intentionallyScrollable = false;
      while (ancestor) {
        const style = getComputedStyle(ancestor);
        if (/(auto|scroll)/.test(style.overflowX) && ancestor.scrollWidth > ancestor.clientWidth) {
          intentionallyScrollable = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (!intentionallyScrollable) {
        findings.push(`document width ${document.documentElement.scrollWidth}`);
      }
    }
    const selectors = "button,input,select,textarea,[role='dialog'],[role='tab']";
    for (const element of document.querySelectorAll(selectors)) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0) continue;
      if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) {
        findings.push(`${element.tagName.toLowerCase()} "${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 35)}" clips its content`);
      }
      let ancestor = element.parentElement;
      let horizontallyScrollable = false;
      while (ancestor) {
        const ancestorStyle = getComputedStyle(ancestor);
        if (/(auto|scroll)/.test(ancestorStyle.overflowX) && ancestor.scrollWidth > ancestor.clientWidth) {
          horizontallyScrollable = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (!horizontallyScrollable && (rect.left < -1 || rect.right > viewport.width + 1)) {
        findings.push(`${element.tagName.toLowerCase()} "${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 35)}" at ${Math.round(rect.left)}..${Math.round(rect.right)}`);
      }
    }
    return findings;
  });
  if (issues.length) {
    throw new Error(`${screen} at ${size.name}: ${issues.join("; ")}`);
  }
}

async function createBusiness(page) {
  await page.getByLabel("Business name").fill("Eden Grove Audit");
  await page.getByLabel("Local password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("checkbox", { name: /approved defaults/i }).check();
  await page.getByRole("button", { name: "Create business" }).click();
  await page.getByRole("heading", { name: "Today", level: 1 }).waitFor();
  const welcome = page.getByRole("dialog", { name: "Welcome to Short-Stay Accounts" });
  if (await welcome.isVisible().catch(() => false)) {
    await welcome.getByRole("button", { name: "Explore independently" }).click();
  }
}

async function seed(page) {
  const status = await invoke(page, "business:status", {});
  const account = await invoke(page, "accounts:create", { name: "Visa and cash", type: "card" });
  const customer = await invoke(page, "customers:create", {
    name: "Amina Kato",
    phone: "0700 000 000",
    email: null,
    notes: null,
  });
  const booking = await invoke(page, "bookings:create", {
    unitId: status.business.units[0].id,
    customerId: customer.id,
    checkIn: "2026-07-18",
    checkOut: "2026-07-21",
    checkInTime: "14:00",
    checkOutTime: "10:00",
    nightlyRate: 120000,
    adjustment: 0,
    occupancyMode: "whole_unit",
    status: "confirmed",
    referred: false,
    referrerId: null,
    referrerName: null,
    notes: "Audit record",
  });
  const payment = await invoke(page, "payments:receipt", {
    bookingId: booking.id,
    amount: 180000,
    paidAt: "2026-07-18T08:00:00.000Z",
    method: "card",
    accountId: account.id,
    reference: "AUDIT-001",
    note: null,
    confirmOverpayment: false,
  });
  await invoke(page, "users:create-editor", {
    name: "Front Desk",
    username: "desk",
    password: "editor-password",
  });
  return { payment };
}

async function navigate(page, label) {
  await page.getByLabel("Main navigation").getByRole("button", { name: label, exact: true }).click();
  const heading = label === "Staff" ? "Staff and referrals" : label;
  await page.getByRole("heading", { name: heading, level: 1 }).waitFor();
}

rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(OUTPUT, { recursive: true });

for (const size of SIZES) {
  const profile = mkdtempSync(path.join(tmpdir(), "staybooks-ui-audit-"));
  const directory = path.join(OUTPUT, size.name);
  mkdirSync(directory, { recursive: true });
  let application;
  try {
    application = await _electron.launch({
      ...(PACKAGED ? { executablePath: packagedExecutable() } : { cwd: process.cwd() }),
      args: [...(PACKAGED ? [] : ["."]), `--user-data-dir=${profile}`],
      env: { ...process.env, SHORT_STAY_GUIDE_CAPTURE_DATE: "2026-07-18" },
    });
    const page = await application.firstWindow();
    await resize(application, size);
    await capture(page, directory, "00-setup");
    await assertLayout(page, "Setup", size);
    await createBusiness(page);
    const fixture = await seed(page);

    for (const [label, file] of SCREENS) {
      await navigate(page, label);
      await assertLayout(page, label, size);
      await capture(page, directory, file);
    }

    await page.getByRole("tab", { name: "Accounts" }).click();
    await page.getByRole("heading", { name: "Payment accounts", level: 2 }).waitFor();
    await assertLayout(page, "Payment account settings", size);
    await capture(page, directory, "settings-accounts");

    await page.getByRole("tab", { name: "Users" }).click();
    await page.getByRole("heading", { name: "Users", level: 2 }).waitFor();
    await assertLayout(page, "Users", size);
    await capture(page, directory, "settings-users");

    await navigate(page, "Bookings");
    await page.getByRole("button", { name: "New booking", exact: true }).click();
    await page.getByRole("heading", { name: "New booking", level: 2 }).waitFor();
    await assertLayout(page, "Booking editor", size);
    await capture(page, directory, "booking-editor");
    await page.getByRole("button", { name: "Close booking editor" }).click();

    await navigate(page, "Payments");
    await page.getByRole("button", { name: "Record payment", exact: true }).click();
    await page.getByRole("heading", { name: "Record receipt", level: 2 }).waitFor();
    await assertLayout(page, "Payment editor", size);
    await capture(page, directory, "payment-editor");
    await page.getByRole("button", { name: "Close payment editor" }).click();

    await navigate(page, "Expenses");
    await page.getByRole("button", { name: "Add recurring bill" }).click();
    await page.getByRole("heading", { name: "New recurring bill", level: 2 }).waitFor();
    await assertLayout(page, "Recurring bill editor", size);
    await capture(page, directory, "recurring-bill-editor");
    await page.getByRole("button", { name: "Close panel" }).click();

    await navigate(page, "Payments");
    await page.getByRole("button", { name: /Print receipt AUDIT-001/ }).first().click();
    await page.getByRole("dialog", { name: "Payment receipt" }).waitFor();
    await assertLayout(page, "Receipt", size);
    await capture(page, directory, "payment-receipt");
    await page.getByRole("button", { name: "Close receipt" }).click();

    await page.getByRole("button", { name: "Lock" }).click();
    await page.getByRole("heading", { name: "Sign in", level: 1 }).waitFor();
    await assertLayout(page, "Profile login", size);
    await capture(page, directory, "profile-login");
  } finally {
    await application?.close();
    rmSync(profile, { recursive: true, force: true });
  }
}

if (!existsSync(path.join(OUTPUT, "1024x640", "payment-receipt.png"))) {
  throw new Error("UI audit outputs were not created.");
}
process.stdout.write(`Captured ${SIZES.length * 14} UI audit screenshots in ${OUTPUT}\n`);
