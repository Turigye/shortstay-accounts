import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  backupEncryptedDatabase,
  restoreEncryptedDatabase,
  validateEncryptedBackup,
} from "../../src/main/backup";
import { openEncryptedDatabase } from "../../src/main/db/connection";
import { createBusinessRepository } from "../../src/main/db/repositories/business-repository";
import { createFinanceRepository } from "../../src/main/db/repositories/finance-repository";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("encrypted backup", () => {
  it("backs up, validates, and restores the same report totals", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "staybooks-backup-"));
    directories.push(directory);
    const source = path.join(directory, "business.db");
    const backup = path.join(directory, "eden.staybooks");
    const restored = path.join(directory, "restored.db");
    const key = "correct local password";
    const database = openEncryptedDatabase(source, key);
    const business = createBusinessRepository(database).create({
      name: "Eden Grove",
      password: key,
      unitNames: ["Unit 1", "Unit 2"],
    });
    createFinanceRepository(database, business.businessId).recordBalance({
      month: "2026-07",
      category: "cash_on_hand",
      amount: 500000,
    });
    const before = createFinanceRepository(database, business.businessId).getMonthlyReport("2026-07");

    await backupEncryptedDatabase(database, backup, key);
    expect(() => validateEncryptedBackup(backup, "wrong password")).toThrow();
    database.close();
    restoreEncryptedDatabase(backup, restored, key);

    const opened = openEncryptedDatabase(restored, key);
    const restoredBusiness = createBusinessRepository(opened).getSettings()!;
    const after = createFinanceRepository(opened, restoredBusiness.businessId).getMonthlyReport("2026-07");
    expect(after.incomeStatement).toEqual(before.incomeStatement);
    expect(after.balanceSheet.totalAssets).toBe(before.balanceSheet.totalAssets);
    opened.close();
  });

  it("never overwrites without explicit confirmation", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "staybooks-restore-"));
    directories.push(directory);
    expect(() =>
      restoreEncryptedDatabase(
        path.join(directory, "missing"),
        path.join(directory, "target"),
        "password",
        { confirmOverwrite: false },
      ),
    ).toThrow("not found");
  });
});
