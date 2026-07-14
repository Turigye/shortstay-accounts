import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { _electron } from "playwright";

const profile = mkdtempSync(path.join(tmpdir(), "short-stay-create-probe-"));
const databasePath = path.join(profile, "business.db");
let application;

try {
  application = await _electron.launch({
    args: [".", `--user-data-dir=${profile}`],
    cwd: process.cwd(),
  });
  const window = await application.firstWindow();
  await window.getByLabel("Business name").fill("Creation Probe");
  await window.getByLabel("Local password").fill("correct local password");
  await window.getByLabel("Confirm password").fill("correct local password");
  await window.getByRole("checkbox", { name: /approved defaults/i }).check();
  await window.getByRole("button", { name: "Create business" }).click();
  await window.getByRole("heading", { name: "Today", level: 1 }).waitFor({ timeout: 10_000 });

  if (!existsSync(databasePath)) throw new Error("Electron did not create business.db");
  if (readFileSync(databasePath).subarray(0, 16).toString() === "SQLite format 3\0") {
    throw new Error("Electron created an unencrypted business database");
  }
  process.stdout.write("Electron business creation passed.\n");
} finally {
  await application?.close();
  rmSync(profile, { recursive: true, force: true });
}
