import type Database from "better-sqlite3-multiple-ciphers";

import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from "../../../domain/categories";
import { ugx } from "../../../domain/money";
import type { Ugx } from "../../../domain/types";

export type ExpenseScope = "unit" | "shared";
export type PurchaseType = "cash" | "credit";
export type ExpensePaymentStatus = "paid" | "partial" | "unpaid";

export interface Supplier { id: string; name: string; phone: string | null; email: string | null; balance: Ugx }
export interface ExpenseRecord {
  id: string; date: string; amount: Ugx; categoryId: ExpenseCategoryId; scope: ExpenseScope;
  unitId: string | null; supplierId: string | null; supplierName: string | null;
  accountId: string | null; purchaseType: PurchaseType; paymentStatus: ExpensePaymentStatus;
  dueDate: string | null; reference: string | null; notes: string | null; paidAmount: Ugx; due: Ugx;
}
export interface RecurringExpenseTemplate {
  id: string; categoryId: ExpenseCategoryId; scope: ExpenseScope; unitId: string | null;
  supplierId: string | null; expectedAmount: Ugx | null; cadence: "monthly" | "quarterly" | "annually";
  nextReviewMonth: string; notes: string | null;
}

const categories = new Set<string>(EXPENSE_CATEGORIES.map(({ id }) => id));
const datePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const monthPattern = /^\d{4}-(?:0[1-9]|1[0-2])$/;
function isCalendarDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}
function money(value: number, positive = false): Ugx {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) throw new Error("Use whole UGX amounts.");
  return ugx(value);
}
function text(value?: string | null): string | null { return value?.trim() || null; }
function category(value: string): ExpenseCategoryId {
  if (!categories.has(value)) throw new Error("Choose a valid expense category.");
  return value as ExpenseCategoryId;
}

export function createExpenseRepository(database: Database.Database, businessId: string) {
  function requireBusinessEntity(table: "units" | "suppliers" | "accounts", id: string): void {
    const row = database.prepare(`SELECT id FROM ${table} WHERE id = ? AND business_id = ? AND archived_at IS NULL`).get(id, businessId);
    if (!row) throw new Error(`Choose an active ${table.slice(0, -1)}.`);
  }
  function getExpense(id: string): ExpenseRecord {
    const row = database.prepare<[string, string], any>(`
      SELECT e.*, s.name supplier_name, COALESCE(SUM(sp.amount), 0) paid_amount
      FROM expenses e LEFT JOIN suppliers s ON s.id=e.supplier_id
      LEFT JOIN supplier_payments sp ON sp.expense_id=e.id
      WHERE e.id=? AND e.business_id=? AND e.archived_at IS NULL GROUP BY e.id
    `).get(id, businessId);
    if (!row) throw new Error("Expense not found.");
    const paid = row.purchase_type === "cash" ? row.amount : row.paid_amount;
    const due = Math.max(0, row.amount - paid);
    return { id: row.id, date: row.expense_date, amount: ugx(row.amount), categoryId: row.category_id,
      scope: row.scope, unitId: row.unit_id, supplierId: row.supplier_id, supplierName: row.supplier_name,
      accountId: row.account_id, purchaseType: row.purchase_type,
      paymentStatus: due === 0 ? "paid" : paid > 0 ? "partial" : "unpaid", dueDate: row.due_date,
      reference: row.reference, notes: row.notes, paidAmount: ugx(paid), due: ugx(due) };
  }
  function getSupplierBalance(supplierId: string): Ugx {
    requireBusinessEntity("suppliers", supplierId);
    const row = database.prepare<[string, string], { balance: number }>(`
      SELECT COALESCE(SUM(e.amount-COALESCE((SELECT SUM(amount) FROM supplier_payments sp WHERE sp.expense_id=e.id),0)),0) balance
      FROM expenses e WHERE e.business_id=? AND e.supplier_id=? AND e.purchase_type='credit' AND e.archived_at IS NULL
    `).get(businessId, supplierId);
    return ugx(row?.balance ?? 0);
  }
  return Object.freeze({
    createSupplier(input: { name: string; phone?: string | null; email?: string | null; notes?: string | null }): Supplier {
      const name = input.name.trim(); if (!name) throw new Error("Supplier name is required.");
      const row = database.prepare<[string,string,string|null,string|null,string|null], any>(`
        INSERT INTO suppliers (business_id,name,phone,email,notes) VALUES (?,?,?,?,?) RETURNING id,name,phone,email
      `).get(businessId,name,text(input.phone),text(input.email),text(input.notes));
      return { ...row, balance: ugx(0) };
    },
    listSuppliers(): Supplier[] {
      return database.prepare<[string], {id:string;name:string;phone:string|null;email:string|null}>("SELECT id,name,phone,email FROM suppliers WHERE business_id=? AND archived_at IS NULL ORDER BY lower(name)").all(businessId)
        .map((row) => ({ ...row, balance: getSupplierBalance(row.id) }));
    },
    createExpense(input: { date: string; amount: number; categoryId: string; scope: ExpenseScope; unitId?: string | null; supplierId?: string | null; accountId?: string | null; purchaseType: PurchaseType; dueDate?: string | null; reference?: string | null; notes?: string | null }): ExpenseRecord {
      if (!isCalendarDate(input.date)) throw new Error("Choose a valid expense date.");
      if (input.dueDate && !isCalendarDate(input.dueDate)) throw new Error("Choose a valid due date.");
      const amount = money(input.amount, true); const categoryId = category(input.categoryId);
      if (input.scope === "unit") { if (!input.unitId) throw new Error("Choose a unit."); requireBusinessEntity("units", input.unitId); }
      if (input.scope === "shared" && input.unitId) throw new Error("Shared expenses cannot use one unit.");
      if (input.purchaseType === "cash") { if (!input.accountId) throw new Error("Choose a payment account."); requireBusinessEntity("accounts", input.accountId); }
      if (input.purchaseType === "credit") { if (!input.supplierId) throw new Error("Choose a supplier for credit."); requireBusinessEntity("suppliers", input.supplierId); }
      const row = database.prepare<any, {id:string}>(`
        INSERT INTO expenses (business_id,unit_id,supplier_id,account_id,category_id,scope,amount,expense_date,purchase_type,payment_status,due_date,reference,notes)
        VALUES (@businessId,@unitId,@supplierId,@accountId,@categoryId,@scope,@amount,@date,@purchaseType,@status,@dueDate,@reference,@notes) RETURNING id
      `).get({businessId,unitId:input.scope==="unit"?input.unitId:null,supplierId:input.supplierId??null,accountId:input.accountId??null,categoryId,scope:input.scope,amount,date:input.date,purchaseType:input.purchaseType,status:input.purchaseType==="cash"?"paid":"unpaid",dueDate:text(input.dueDate),reference:text(input.reference),notes:text(input.notes)});
      return getExpense(row!.id);
    },
    recordSupplierPayment(input: { expenseId: string; amount: number; paidAt: string; accountId: string; method: "cash"|"mobileMoney"|"bankTransfer"|"card"; reference?: string|null; notes?: string|null }) {
      const expense=getExpense(input.expenseId); if (!expense.supplierId || expense.purchaseType!=="credit") throw new Error("Choose a supplier credit expense.");
      if (!isCalendarDate(input.paidAt)) throw new Error("Choose a valid payment date.");
      const amount=money(input.amount,true); if(amount>expense.due) throw new Error("Payment exceeds the supplier balance."); requireBusinessEntity("accounts",input.accountId);
      const methods={cash:"cash",mobileMoney:"mobile_money",bankTransfer:"bank_transfer",card:"card"} as const;
      database.prepare(`INSERT INTO supplier_payments (business_id,supplier_id,expense_id,account_id,amount,paid_at,method,reference,notes) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(businessId,expense.supplierId,expense.id,input.accountId,amount,input.paidAt,methods[input.method],text(input.reference),text(input.notes));
      database.prepare("UPDATE expenses SET payment_status=? WHERE id=?").run(amount===expense.due?"paid":"partial",expense.id);
      return getExpense(expense.id);
    },
    getExpense,
    listExpenses(): ExpenseRecord[] { return database.prepare<[string],{id:string}>("SELECT id FROM expenses WHERE business_id=? AND archived_at IS NULL ORDER BY expense_date DESC,id").all(businessId).map(({id})=>getExpense(id)); },
    getCategoryTotals(filter:{month:string}): Record<string,number> { if(!monthPattern.test(filter.month)) throw new Error("Month must use YYYY-MM."); return Object.fromEntries(database.prepare<[string,string],{category_id:string;total:number}>("SELECT category_id,SUM(amount) total FROM expenses WHERE business_id=? AND substr(expense_date,1,7)=? AND archived_at IS NULL GROUP BY category_id").all(businessId,filter.month).map(r=>[r.category_id,r.total])); },
    getSupplierBalance,
    createRecurringTemplate(input:{categoryId:string;scope:ExpenseScope;unitId?:string|null;supplierId?:string|null;expectedAmount?:number|null;cadence:"monthly"|"quarterly"|"annually";nextReviewMonth:string;notes?:string|null}): RecurringExpenseTemplate {
      const categoryId=category(input.categoryId); if(!monthPattern.test(input.nextReviewMonth)) throw new Error("Review month must use YYYY-MM."); if(input.scope==="unit"){if(!input.unitId)throw new Error("Choose a unit.");requireBusinessEntity("units",input.unitId);}
      const row=database.prepare<any,any>(`INSERT INTO recurring_expenses (business_id,unit_id,supplier_id,category_id,scope,expected_amount,cadence,next_review_month,notes) VALUES (@businessId,@unitId,@supplierId,@categoryId,@scope,@expectedAmount,@cadence,@nextReviewMonth,@notes) RETURNING id,category_id,scope,unit_id,supplier_id,expected_amount,cadence,next_review_month,notes`).get({businessId,unitId:input.scope==="unit"?input.unitId:null,supplierId:input.supplierId??null,categoryId,scope:input.scope,expectedAmount:input.expectedAmount==null?null:money(input.expectedAmount),cadence:input.cadence,nextReviewMonth:input.nextReviewMonth,notes:text(input.notes)});
      return {id:row.id,categoryId:row.category_id,scope:row.scope,unitId:row.unit_id,supplierId:row.supplier_id,expectedAmount:row.expected_amount==null?null:ugx(row.expected_amount),cadence:row.cadence,nextReviewMonth:row.next_review_month,notes:row.notes};
    },
    listRecurringForReview(month:string): RecurringExpenseTemplate[] { if(!monthPattern.test(month))throw new Error("Month must use YYYY-MM."); return database.prepare<[string,string],any>("SELECT * FROM recurring_expenses WHERE business_id=? AND next_review_month<=? AND archived_at IS NULL ORDER BY next_review_month,id").all(businessId,month).map(row=>({id:row.id,categoryId:row.category_id,scope:row.scope,unitId:row.unit_id,supplierId:row.supplier_id,expectedAmount:row.expected_amount==null?null:ugx(row.expected_amount),cadence:row.cadence,nextReviewMonth:row.next_review_month,notes:row.notes})); }
  });
}
