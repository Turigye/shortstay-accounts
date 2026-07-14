import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it } from "vitest";

import { ugx } from "../../src/domain/money";
import { createBusinessRepository } from "../../src/main/db/repositories/business-repository";
import {
  calculateAnnualProvision,
  calculateTaxProvision,
  createFinanceRepository,
} from "../../src/main/db/repositories/finance-repository";
import { migrateDatabase } from "../../src/main/db/migrations";

const databases: Database.Database[] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });

function fixture() {
  const database = new Database(":memory:");
  databases.push(database);
  database.pragma("foreign_keys = ON");
  migrateDatabase(database);
  const business = createBusinessRepository(database, { now: () => new Date("2026-07-14T09:00:00Z") })
    .create({ name: "Eden Grove", password: "correct local password", unitNames: ["Unit 1", "Unit 2"] });
  return { database, business, finance: createFinanceRepository(database, business.businessId) };
}

describe("financial position and month close", () => {
  it("uses the approved manual provision", () => {
    expect(calculateTaxProvision(2, ugx(600_000))).toBe(1_200_000);
    expect(calculateAnnualProvision(2, ugx(600_000))).toBe(14_400_000);
  });

  it("records balances, assets, loans, and inventory", () => {
    const { business, finance } = fixture();
    finance.recordBalance({ month: "2026-07", category: "cash_on_hand", amount: 1_000_000 });
    finance.recordBalance({ month: "2026-07", category: "owner_capital", amount: 1_000_000 });
    finance.recordInventory({ month: "2026-07", unitId: business.unitIds[0], value: 120_000 });
    finance.createAsset({ category: "furniture", description: "Guest room bed", purchaseDate: "2026-07-02", purchaseAmount: 800_000, unitId: business.unitIds[0] });
    finance.createLoan({ lender: "Owner family", kind: "interest_free", classification: "non_current", principal: 2_000_000, outstandingBalance: 1_500_000, startDate: "2026-06-01" });

    expect(finance.getPosition("2026-07")).toMatchObject({
      cashAndCurrentAccounts: 1_000_000,
      inventory: 120_000,
      fixedAssets: 800_000,
      loans: 1_500_000,
      ownerEquity: 1_000_000,
    });
  });

  it("blocks an unbalanced close, locks a closed month, and audits reopening", () => {
    const { database, finance } = fixture();
    finance.recordBalance({ month: "2026-07", category: "cash_on_hand", amount: 1_000_000 });
    expect(() => finance.closeMonth("2026-07")).toThrow("not balanced");
    finance.recordBalance({ month: "2026-07", category: "owner_capital", amount: 1_000_000 });
    expect(finance.closeMonth("2026-07").status).toBe("closed");
    expect(() => finance.recordBalance({ month: "2026-07", category: "cash_on_hand", amount: 900_000 })).toThrow("closed");
    expect(() => database.prepare(`
      INSERT INTO expenses (business_id, category_id, scope, amount, expense_date, purchase_type, payment_status)
      VALUES (?, 'electricity', 'shared', 80000, '2026-07-20', 'cash', 'paid')
    `).run(database.prepare("SELECT id FROM businesses LIMIT 1").pluck().get())).toThrow("accounting month is closed");
    expect(() => finance.reopenMonth("2026-07", " ")).toThrow("reason");
    expect(finance.reopenMonth("2026-07", "Bank correction received").status).toBe("reopened");
    expect(database.prepare("SELECT action, reason FROM audit_events WHERE entity_type='period_close'").all()).toEqual([
      expect.objectContaining({ action: "close" }),
      expect.objectContaining({ action: "reopen", reason: "Bank correction received" }),
    ]);
  });
});
