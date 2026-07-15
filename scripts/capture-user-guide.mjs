import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { _electron } from "playwright";

const FFMPEG = "/opt/homebrew/bin/ffmpeg";
const VIEWPORT = { width: 1440, height: 900 };
const GUIDE_PASSWORD = "guide-local-key-2026";
const OUTPUT_DIRECTORY = path.join(process.cwd(), "docs", "user-guide", "media");
const SCREENSHOTS = [
  "01-today.webp",
  "02-bookings.webp",
  "03-payments.webp",
  "04-expenses.webp",
  "05-staff.webp",
  "06-financial-position.webp",
  "07-reports.webp",
  "08-settings.webp",
  "09-help-center.webp",
];
const DEMONSTRATIONS = [
  "demo-booking",
  "demo-partial-payment",
  "demo-correction",
  "demo-month-close",
  "demo-backup",
];
const NAVIGATION = {
  Today: { target: "navigation-today", heading: "Today" },
  Bookings: { target: "navigation-bookings", heading: "Bookings" },
  Payments: { target: "navigation-payments", heading: "Payments" },
  Expenses: { target: "navigation-expenses", heading: "Expenses" },
  Staff: { target: "navigation-staff", heading: "Staff and referrals" },
  "Financial Position": { target: "navigation-financial-position", heading: "Financial Position" },
  Reports: { target: "navigation-reports", heading: "Reports" },
  Settings: { target: "navigation-settings", heading: "Settings" },
};

let application;
let profile;
let framesDirectory;

function requireFfmpeg() {
  if (!existsSync(FFMPEG)) {
    throw new Error(`ffmpeg is required at ${FFMPEG}; install it before running guide:capture.`);
  }
}

function localDate(daysFromToday = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function localDateTime(daysFromToday = 0) {
  return `${localDate(daysFromToday)}T10:00`;
}

function ensureOutputDirectory() {
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  for (const name of [...SCREENSHOTS, ...DEMONSTRATIONS.flatMap((name) => [`${name}.webm`, `${name}.webp`])]) {
    rmSync(path.join(OUTPUT_DIRECTORY, name), { force: true });
  }
}

async function setContentViewport(page) {
  await application.evaluate(({ BrowserWindow }, size) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.setContentSize(size.width, size.height);
  }, VIEWPORT);
  await page.waitForTimeout(150);
}

async function invoke(page, channel, payload) {
  const result = await page.evaluate(
    async ({ channel: ipcChannel, payload: ipcPayload }) => window.stayBooks.invoke(ipcChannel, ipcPayload),
    { channel, payload },
  );
  if (!result.ok) throw new Error(`${channel} failed: ${result.message}`);
  return result.data;
}

async function dismissWelcome(page) {
  const dialog = page.getByRole("dialog", { name: "Welcome to Short-Stay Accounts" });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: "Explore independently" }).click();
  }
}

async function createBusiness(page) {
  await page.getByLabel("Business name").fill("Eden Grove Learning Property");
  await page.getByLabel("Local password").fill(GUIDE_PASSWORD);
  await page.getByLabel("Confirm password").fill(GUIDE_PASSWORD);
  await page.getByRole("checkbox", { name: /approved defaults/i }).check();
  await page.getByRole("button", { name: "Create business" }).click();
  await page.getByRole("heading", { name: "Today", level: 1 }).waitFor();
  await dismissWelcome(page);
}

async function seedFictionalRecords(page) {
  const status = await invoke(page, "business:status", {});
  const [firstUnit, secondUnit] = status.business.units;
  const cashAccount = await invoke(page, "accounts:create", { name: "Eden Grove Cash Desk", type: "cash" });
  await invoke(page, "accounts:create", { name: "Eden Grove Mobile Wallet", type: "mobileMoney" });
  const advanceGuest = await invoke(page, "customers:create", {
    name: "Eden Grove Sample Guest A",
    phone: "+256 700 000 101",
    email: "sample-a@eden-grove.example",
    notes: "Fictional guide record.",
  });
  const returningGuest = await invoke(page, "customers:create", {
    name: "Eden Grove Sample Guest B",
    phone: "+256 700 000 102",
    email: "sample-b@eden-grove.example",
    notes: "Fictional guide record.",
  });
  const occupiedBooking = await invoke(page, "bookings:create", {
    unitId: secondUnit.id,
    customerId: advanceGuest.id,
    checkIn: localDate(-1),
    checkOut: localDate(2),
    checkInTime: "14:00",
    checkOutTime: "10:00",
    nightlyRate: 85000,
    adjustment: 0,
    status: "confirmed",
    referred: false,
    referrerId: null,
    referrerName: null,
    notes: "Fictional occupied sample stay.",
  });
  await invoke(page, "bookings:transition", { id: occupiedBooking.id, status: "checkedIn" });
  const reportingBooking = await invoke(page, "bookings:create", {
    unitId: firstUnit.id,
    customerId: returningGuest.id,
    checkIn: localDate(5),
    checkOut: localDate(7),
    checkInTime: "14:00",
    checkOutTime: "10:00",
    nightlyRate: 95000,
    adjustment: 0,
    status: "confirmed",
    referred: false,
    referrerId: null,
    referrerName: null,
    notes: "Fictional future sample stay.",
  });
  await invoke(page, "payments:receipt", {
    bookingId: reportingBooking.id,
    amount: 50000,
    paidAt: `${localDate()}T08:00:00.000Z`,
    method: "cash",
    accountId: cashAccount.id,
    reference: "EG-SEED-01",
    note: "Fictional guide deposit.",
    confirmOverpayment: false,
  });
  await invoke(page, "expenses:create", {
    date: localDate(),
    amount: 45000,
    categoryId: "housekeeping",
    scope: "shared",
    unitId: null,
    supplierId: null,
    accountId: cashAccount.id,
    purchaseType: "cash",
    dueDate: null,
    reference: "EG-EXP-01",
    notes: "Fictional cleaning supplies.",
  });
  await invoke(page, "finance:balance-save", {
    month: localDate().slice(0, 7),
    category: "current_bank",
    amount: 500000,
    accountId: null,
    unitId: null,
    notes: "Fictional guide balance.",
  });
  await invoke(page, "finance:balance-save", {
    month: localDate().slice(0, 7),
    category: "owner_capital",
    amount: 500000,
    accountId: null,
    unitId: null,
    notes: "Fictional guide capital.",
  });
  return { cashAccount, firstUnit, returningGuest };
}

async function addCallouts(page, targets) {
  await page.evaluate((items) => {
    document.getElementById("guide-capture-callouts")?.remove();
    const layer = document.createElement("div");
    layer.id = "guide-capture-callouts";
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, { inset: "0", pointerEvents: "none", position: "fixed", zIndex: "2147483647" });
    for (const [index, selector] of items.entries()) {
      const target = document.querySelector(selector);
      if (!target) continue;
      const rect = target.getBoundingClientRect();
      const badge = document.createElement("span");
      badge.textContent = String(index + 1);
      Object.assign(badge.style, {
        alignItems: "center", background: "#0f766e", border: "3px solid #ffffff", borderRadius: "999px",
        boxShadow: "0 2px 8px rgba(15, 23, 42, .25)", color: "#ffffff", display: "flex", font: "700 14px Arial, sans-serif",
        height: "28px", justifyContent: "center", left: `${Math.max(8, rect.right - 10)}px`, position: "fixed",
        top: `${Math.max(8, rect.top - 10)}px`, width: "28px",
      });
      layer.append(badge);
    }
    document.body.append(layer);
  }, targets);
}

async function removeCallouts(page) {
  await page.evaluate(() => document.getElementById("guide-capture-callouts")?.remove());
}

async function captureWebp(page, destination, quality) {
  const source = `${destination}.png`;
  await page.waitForTimeout(120);
  await page.screenshot({ path: source, type: "png" });
  const png = readFileSync(source).toString("base64");
  const webp = await page.evaluate(async ({ base64, compression }) => {
    const image = new Image();
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = `data:image/png;base64,${base64}`;
    await loaded;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", compression));
    if (!blob) throw new Error("Chromium could not encode the renderer capture as WebP.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, { base64: png, compression: quality / 100 });
  rmSync(source, { force: true });
  writeFileSync(destination, Buffer.from(webp, "base64"));
}

async function screenshot(page, fileName, callouts = []) {
  if (callouts.length) await addCallouts(page, callouts);
  await captureWebp(page, path.join(OUTPUT_DIRECTORY, fileName), 82);
  await removeCallouts(page);
}

async function recordFrame(page, flow, frame, callouts = []) {
  const flowDirectory = path.join(framesDirectory, flow);
  mkdirSync(flowDirectory, { recursive: true });
  if (callouts.length) await addCallouts(page, callouts);
  await captureWebp(page, path.join(flowDirectory, `frame-${String(frame).padStart(2, "0")}.webp`), 80);
  await removeCallouts(page);
}

function encodeDemo(flow) {
  const flowDirectory = path.join(framesDirectory, flow);
  const webm = path.join(OUTPUT_DIRECTORY, `${flow}.webm`);
  const result = spawnSync(FFMPEG, [
    "-y", "-framerate", "0.75", "-i", path.join(flowDirectory, "frame-%02d.webp"),
    "-r", "12", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-an", webm,
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`ffmpeg could not encode ${flow}: ${result.stderr || result.stdout}`);
  }
  const finalFrame = path.join(flowDirectory, readdirSync(flowDirectory).sort().at(-1));
  copyFileSync(finalFrame, path.join(OUTPUT_DIRECTORY, `${flow}.webp`));
}

async function navigate(page, screen) {
  const destination = NAVIGATION[screen];
  if (!destination) throw new Error(`No sidebar navigation target is defined for ${screen}.`);
  await page.locator(`[data-tour='${destination.target}']`).click();
  await page.locator(`[data-tour='${destination.target}'][data-active='true']`).waitFor();
  await page.getByRole("heading", { name: destination.heading, exact: true, level: 1 }).waitFor();
  await page.locator(".main-content").hover({ position: { x: 24, y: 24 } });
}

async function captureBookingDemo(page, fixture) {
  await navigate(page, "Bookings");
  await recordFrame(page, "demo-booking", 1, ["[data-tour='booking-action']"]);
  await page.getByRole("button", { name: "New booking", exact: true }).click();
  await page.getByRole("complementary", { name: "New booking" }).waitFor();
  await page.locator("#booking-unit").selectOption(fixture.firstUnit.id);
  await page.locator("#booking-customer").selectOption(fixture.returningGuest.id);
  await page.locator("#booking-check-in").fill(localDate(9));
  await page.locator("#booking-check-out").fill(localDate(11));
  await page.locator("#booking-nightly-rate").fill("110000");
  await recordFrame(page, "demo-booking", 2, ["#booking-unit", "#booking-customer", "[aria-label='Booking total']"]);
  await page.getByRole("button", { name: "Save booking" }).click();
  await page.getByRole("complementary", { name: "New booking" }).waitFor({ state: "detached" });
  await page.getByRole("tab", { name: "List" }).click();
  await page.getByText("Eden Grove Sample Guest B").last().waitFor();
  await recordFrame(page, "demo-booking", 3, ["[aria-label='Booking views']"]);
  await screenshot(page, "02-bookings.webp", ["[data-tour='booking-action']", "[aria-label='Booking filters']"]);
  encodeDemo("demo-booking");
  const bookings = await invoke(page, "bookings:list", {});
  const booking = bookings.find((item) => item.checkIn === localDate(9) && item.checkOut === localDate(11));
  if (!booking) throw new Error("The visible booking flow did not create its fictional booking.");
  return booking.id;
}

async function selectPaymentBooking(page, bookingId) {
  const selector = page.locator("#payments-booking");
  await selector.selectOption(bookingId);
}

async function capturePartialPaymentDemo(page, bookingId) {
  await navigate(page, "Payments");
  await selectPaymentBooking(page, bookingId);
  await recordFrame(page, "demo-partial-payment", 1, ["[data-tour='payment-balance']", "[data-tour='payment-action']"]);
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByRole("complementary", { name: "Record receipt" }).waitFor();
  await page.locator("#payment-amount").fill("120000");
  await page.locator("#payment-reference").fill("EG-PARTIAL-01");
  await recordFrame(page, "demo-partial-payment", 2, ["#payment-amount", "#payment-account"]);
  await page.getByRole("button", { name: "Record receipt" }).last().click();
  await page.getByRole("complementary", { name: "Record receipt" }).waitFor({ state: "detached" });
  await page.getByText("EG-PARTIAL-01").waitFor();
  await recordFrame(page, "demo-partial-payment", 3, ["[aria-label='Booking balance']"]);
  await screenshot(page, "03-payments.webp", ["[data-tour='payment-history']", "[data-tour='payment-action']"]);
  encodeDemo("demo-partial-payment");
}

async function captureCorrectionDemo(page) {
  const correctionButton = page.getByRole("button", { name: /Correct receipt EG-PARTIAL-01/ });
  await correctionButton.click();
  await page.getByRole("complementary", { name: "Record correction" }).waitFor();
  await recordFrame(page, "demo-correction", 1, ["#payment-correction-direction", "#payment-amount"]);
  await page.locator("#payment-amount").fill("20000");
  await page.locator("#payment-reference").fill("EG-CORRECTION-01");
  await page.locator("#payment-reason").fill("Fictional guide correction.");
  await recordFrame(page, "demo-correction", 2, ["#payment-reason", "#payment-reference"]);
  await page.getByRole("button", { name: "Record correction" }).last().click();
  await page.getByRole("complementary", { name: "Record correction" }).waitFor({ state: "detached" });
  await page.getByText("EG-CORRECTION-01").waitFor();
  await recordFrame(page, "demo-correction", 3, ["[aria-label='Booking balance']"]);
  encodeDemo("demo-correction");
}

async function captureMonthCloseDemo(page) {
  await navigate(page, "Financial Position");
  await page.getByRole("button", { name: "Month-end" }).click();
  await page.getByRole("heading", { name: "Month-end review", level: 2 }).waitFor();
  await recordFrame(page, "demo-month-close", 1, [".month-end"]);
  const closeButton = page.getByRole("button", { name: /^Close / });
  if (await closeButton.isDisabled()) throw new Error("The fictional month was not balanced for close.");
  await closeButton.click();
  await page.getByText("closed", { exact: true }).waitFor();
  await recordFrame(page, "demo-month-close", 2, [".month-end"]);
  await screenshot(page, "06-financial-position.webp", ["[aria-label='Financial position views']", ".month-end"]);
  encodeDemo("demo-month-close");
}

async function captureBackupDemo(page) {
  await navigate(page, "Settings");
  await page.getByRole("tab", { name: "Backup" }).click();
  await page.getByRole("heading", { name: "Backup and export", level: 2 }).waitFor();
  await recordFrame(page, "demo-backup", 1, [".file-actions"]);
  const backupPath = path.join(profile, "eden-grove-guide-backup.staybooks");
  await application.evaluate(({ dialog }, destination) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination });
  }, backupPath);
  await page.getByLabel("Local password").fill(GUIDE_PASSWORD);
  await page.getByRole("button", { name: "Create backup" }).click();
  await page.getByText("Encrypted backup created.").waitFor();
  if (!existsSync(backupPath) || statSync(backupPath).size === 0) {
    throw new Error("The real encrypted backup command did not create a backup file.");
  }
  await recordFrame(page, "demo-backup", 2, [".file-actions"]);
  await screenshot(page, "08-settings.webp", ["[aria-label='Settings sections']", ".file-actions"]);
  encodeDemo("demo-backup");
}

async function captureRemainingScreens(page) {
  await navigate(page, "Today");
  await page.getByText("Eden Grove Sample Guest A").waitFor();
  await screenshot(page, "01-today.webp", [".today-actions", ".today-workspace"]);

  await navigate(page, "Expenses");
  await page.locator(".expense-table").getByText("Housekeeping", { exact: true }).waitFor();
  await screenshot(page, "04-expenses.webp", ["[data-tour='expense-action']", ".expense-summary"]);

  await navigate(page, "Staff");
  await screenshot(page, "05-staff.webp", ["[aria-label='Compensation statement']", "[aria-label='Statement totals']"]);

  await navigate(page, "Reports");
  await page.getByText("Income summary").waitFor();
  await screenshot(page, "07-reports.webp", ["[data-tour='report-period']", "[data-tour='report-tabs']"]);

  await page.getByRole("button", { name: "Help" }).click();
  await page.getByRole("heading", { name: "Help Center", level: 1 }).waitFor();
  await screenshot(page, "09-help-center.webp", ["[aria-label='Search guide']"]);
}

function verifyOutputs() {
  const expected = [
    ...SCREENSHOTS,
    ...DEMONSTRATIONS.flatMap((name) => [`${name}.webm`, `${name}.webp`]),
  ];
  for (const name of expected) {
    const output = path.join(OUTPUT_DIRECTORY, name);
    if (!existsSync(output) || statSync(output).size === 0) {
      throw new Error(`Missing or empty capture output: ${output}`);
    }
  }
}

try {
  requireFfmpeg();
  ensureOutputDirectory();
  profile = mkdtempSync(path.join(tmpdir(), "eden-grove-guide-profile-"));
  framesDirectory = mkdtempSync(path.join(tmpdir(), "eden-grove-guide-frames-"));
  process.stdout.write("Launching the guide capture app...\n");
  application = await _electron.launch({
    args: [".", `--user-data-dir=${profile}`],
    cwd: process.cwd(),
  });
  const page = await application.firstWindow();
  process.stdout.write("Preparing the encrypted Eden Grove profile...\n");
  await setContentViewport(page);
  await createBusiness(page);
  const fixture = await seedFictionalRecords(page);
  process.stdout.write("Capturing booking and payment demonstrations...\n");
  const paymentBookingId = await captureBookingDemo(page, fixture);
  await capturePartialPaymentDemo(page, paymentBookingId);
  await captureCorrectionDemo(page);
  process.stdout.write("Capturing month close, backup, and screen references...\n");
  await captureMonthCloseDemo(page);
  await captureBackupDemo(page);
  await captureRemainingScreens(page);
  verifyOutputs();
  const database = path.join(profile, "business.db");
  if (!existsSync(database) || readFileSync(database).subarray(0, 16).toString() === "SQLite format 3\0") {
    throw new Error("The capture profile did not use an encrypted business database.");
  }
  process.stdout.write(`Captured ${SCREENSHOTS.length} screenshots and ${DEMONSTRATIONS.length} demonstrations.\n`);
} finally {
  await application?.close();
  if (profile) rmSync(profile, { recursive: true, force: true });
  if (framesDirectory) rmSync(framesDirectory, { recursive: true, force: true });
}
