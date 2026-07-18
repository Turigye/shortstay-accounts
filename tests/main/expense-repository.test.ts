import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it } from "vitest";

import { createBusinessRepository } from "../../src/main/db/repositories/business-repository";
import { createExpenseRepository } from "../../src/main/db/repositories/expense-repository";
import { createPaymentRepository } from "../../src/main/db/repositories/payment-repository";
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
  const account = createPaymentRepository(database, business.businessId)
    .createAccount({ name: "Cash", type: "cash" });
  const repository = createExpenseRepository(database, business.businessId);
  return { database, business, account, repository };
}

describe("property expenses and supplier payables", () => {
  it("tracks unit, shared, credit, and partial supplier activity", () => {
    const { business, account, repository } = fixture();
    const supplier = repository.createSupplier({ name: "Kampala Repairs", phone: "+256700000000" });
    repository.createExpense({
      date: "2026-07-14", amount: 80_000, categoryId: "electricity",
      scope: "unit", unitId: business.unitIds[0], purchaseType: "cash", accountId: account.id,
    });
    repository.createExpense({
      date: "2026-07-14", amount: 45_000, categoryId: "netflix",
      scope: "shared", purchaseType: "cash", accountId: account.id,
    });
    const maintenance = repository.createExpense({
      date: "2026-07-15", amount: 500_000, categoryId: "maintenance",
      scope: "unit", unitId: business.unitIds[0], purchaseType: "credit",
      supplierId: supplier.id, dueDate: "2026-08-15",
    });
    repository.recordSupplierPayment({
      expenseId: maintenance.id, amount: 200_000, paidAt: "2026-07-20",
      accountId: account.id, method: "cash", reference: "PART-1",
    });

    expect(repository.getCategoryTotals({ month: "2026-07" })).toMatchObject({
      electricity: 80_000, netflix: 45_000, maintenance: 500_000,
    });
    expect(repository.getExpense(maintenance.id)).toMatchObject({
      paymentStatus: "partial", paidAmount: 200_000, due: 300_000,
    });
    expect(repository.getSupplierBalance(supplier.id)).toBe(300_000);
  });

  it("advances recurring templates only after the bill is recorded", () => {
    const { repository } = fixture();
    const template = repository.createRecurringTemplate({
      categoryId: "netflix", scope: "shared", expectedAmount: 45_000,
      cadence: "monthly", nextReviewMonth: "2026-08", notes: "Confirm plan price",
    });
    expect(repository.listExpenses()).toEqual([]);
    expect(repository.listRecurringForReview("2026-08")).toEqual([
      expect.objectContaining({ id: template.id, categoryId: "netflix", expectedAmount: 45_000 }),
    ]);
    expect(repository.advanceRecurringTemplate(template.id)).toMatchObject({
      id: template.id,
      nextReviewMonth: "2026-09",
    });
    expect(repository.listRecurringForReview("2026-08")).toEqual([]);
  });

  it("rejects impossible dates and cross-business supplier payments", () => {
    const { database, business, account, repository } = fixture();
    expect(() => repository.createExpense({
      date: "2026-02-30", amount: 80_000, categoryId: "electricity",
      scope: "unit", unitId: business.unitIds[0], purchaseType: "cash", accountId: account.id,
    })).toThrow("valid expense date");

    const supplier = repository.createSupplier({ name: "Kampala Repairs" });
    const expense = repository.createExpense({
      date: "2026-07-15", amount: 500_000, categoryId: "maintenance",
      scope: "unit", unitId: business.unitIds[0], purchaseType: "credit", supplierId: supplier.id,
    });
    expect(() => repository.recordSupplierPayment({
      expenseId: expense.id, amount: 100_000, paidAt: "2026-02-30",
      accountId: account.id, method: "cash",
    })).toThrow("valid payment date");

    const otherBusiness = database.prepare<[], { id: string }>(
      "INSERT INTO businesses (name) VALUES ('Other Business') RETURNING id",
    ).get();
    const otherAccount = database.prepare<[string], { id: string }>(
      "INSERT INTO accounts (business_id, name, type) VALUES (?, 'Other Cash', 'cash') RETURNING id",
    ).get(otherBusiness!.id)!;
    expect(() => database.prepare(`
      INSERT INTO supplier_payments
        (business_id, supplier_id, expense_id, account_id, amount, paid_at, method)
      VALUES (?, ?, ?, ?, 100000, '2026-07-20', 'cash')
    `).run(business.businessId, supplier.id, expense.id, otherAccount.id)).toThrow("invalid supplier payment");
  });
});
