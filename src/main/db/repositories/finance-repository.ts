import type Database from "better-sqlite3-multiple-ciphers";

import { ugx } from "../../../domain/money";
import type { Ugx } from "../../../domain/types";
import { buildFinancialReport, type FinancialReport } from "../../../domain/accounting";
import { createAuditRepository } from "./audit-repository";

export type BalanceCategory =
  | "cash_on_hand" | "current_bank" | "mobile_money" | "long_term_deposit"
  | "customer_receivable" | "other_receivable" | "supplier_payable"
  | "staff_payable" | "referral_payable" | "tax_payable" | "pension_payable"
  | "owner_capital" | "owner_drawings";
export type AssetCategory = "furniture" | "machinery" | "equipment" | "vehicles" | "land" | "buildings";
export type LoanKind = "bank" | "non_bank" | "interest_free";
export type PeriodStatus = "open" | "closed" | "reopened";

export interface FinancialPosition {
  month: string;
  cashAndCurrentAccounts: Ugx;
  longTermDeposits: Ugx;
  receivables: Ugx;
  inventory: Ugx;
  fixedAssets: Ugx;
  payables: Ugx;
  loans: Ugx;
  ownerEquity: Ugx;
  totalAssets: Ugx;
  totalLiabilitiesAndEquity: Ugx;
  difference: number;
  balanced: boolean;
}

export interface AssetRecord {
  id: string; category: AssetCategory; description: string; purchaseDate: string;
  purchaseAmount: Ugx; unitId: string | null; supplierId: string | null;
  paymentMethod: string | null; usefulLifeMonths: number | null; status: "active" | "disposed";
}
export interface LoanRecord {
  id: string; lender: string; kind: LoanKind; classification: "current" | "non_current";
  principal: Ugx; outstandingBalance: Ugx; interestRateBasisPoints: number;
  startDate: string; dueDate: string | null; notes: string | null;
}
export interface PeriodClose { month: string; status: PeriodStatus; reason: string | null }

const monthPattern = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const assetCategories = new Set<AssetCategory>(["furniture", "machinery", "equipment", "vehicles", "land", "buildings"]);
const loanKinds = new Set<LoanKind>(["bank", "non_bank", "interest_free"]);
const assetBalanceCategories = new Set<BalanceCategory>(["cash_on_hand", "current_bank", "mobile_money", "long_term_deposit", "customer_receivable", "other_receivable"]);
const payableCategories = new Set<BalanceCategory>(["supplier_payable", "staff_payable", "referral_payable", "tax_payable", "pension_payable"]);
const balanceCategories = new Set<BalanceCategory>([...assetBalanceCategories, ...payableCategories, "owner_capital", "owner_drawings"]);

function wholeUgx(value: number): Ugx {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Use a whole non-negative UGX amount.");
  return ugx(value);
}
function calendarDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function requireMonth(month: string): void {
  if (!monthPattern.test(month)) throw new Error("Month must use YYYY-MM.");
}

export function calculateTaxProvision(activeUnitCount: number, perUnitAmount: Ugx): Ugx {
  if (!Number.isSafeInteger(activeUnitCount) || activeUnitCount < 0) throw new Error("Active unit count must be a whole non-negative number.");
  return wholeUgx(activeUnitCount * perUnitAmount);
}
export function calculateAnnualProvision(activeUnitCount: number, perUnitAmount: Ugx): Ugx {
  return wholeUgx(calculateTaxProvision(activeUnitCount, perUnitAmount) * 12);
}

export function createFinanceRepository(database: Database.Database, businessId: string) {
  const audit = createAuditRepository(database);
  function status(month: string): PeriodClose {
    requireMonth(month);
    const row = database.prepare<[string, string], { month: string; status: PeriodStatus; reason: string | null }>(
      "SELECT month,status,reason FROM period_closes WHERE business_id=? AND month=?",
    ).get(businessId, month);
    return row ?? { month, status: "open", reason: null };
  }
  function assertOpen(month: string): void {
    if (status(month).status === "closed") throw new Error(`${month} is closed. Reopen it before making changes.`);
  }
  function requireOwned(table: "units" | "suppliers" | "accounts", id?: string | null): void {
    if (!id) return;
    if (!database.prepare(`SELECT 1 FROM ${table} WHERE id=? AND business_id=? AND archived_at IS NULL`).get(id, businessId)) {
      throw new Error(`Choose an active ${table.slice(0, -1)}.`);
    }
  }
  function assets(): AssetRecord[] {
    return database.prepare<[string], any>("SELECT * FROM assets WHERE business_id=? AND archived_at IS NULL ORDER BY purchase_date DESC,id").all(businessId).map((row) => ({
      id: row.id, category: row.category, description: row.description, purchaseDate: row.purchase_date,
      purchaseAmount: ugx(row.purchase_amount), unitId: row.unit_id, supplierId: row.supplier_id,
      paymentMethod: row.payment_method, usefulLifeMonths: row.useful_life_months, status: row.status,
    }));
  }
  function loans(): LoanRecord[] {
    return database.prepare<[string], any>("SELECT * FROM loans WHERE business_id=? AND archived_at IS NULL ORDER BY start_date DESC,id").all(businessId).map((row) => ({
      id: row.id, lender: row.lender, kind: row.kind, classification: row.classification,
      principal: ugx(row.principal), outstandingBalance: ugx(row.outstanding_balance),
      interestRateBasisPoints: row.interest_rate_basis_points, startDate: row.start_date,
      dueDate: row.due_date, notes: row.notes,
    }));
  }
  function position(month: string): FinancialPosition {
    requireMonth(month);
    const balances = database.prepare<[string, string], { category: BalanceCategory; amount: number }>(
      "SELECT category,amount FROM balance_snapshots WHERE business_id=? AND month=?",
    ).all(businessId, month);
    const sum = (set: Set<BalanceCategory>) => balances.filter(({ category }) => set.has(category)).reduce((total, row) => total + row.amount, 0);
    const categoryTotal = (category: BalanceCategory) => balances.filter((row) => row.category === category).reduce((total, row) => total + row.amount, 0);
    const cash = categoryTotal("cash_on_hand") + categoryTotal("current_bank") + categoryTotal("mobile_money");
    const deposits = categoryTotal("long_term_deposit");
    const receivables = categoryTotal("customer_receivable") + categoryTotal("other_receivable");
    const inventory = database.prepare<[string, string], { total: number }>("SELECT COALESCE(SUM(value),0) total FROM inventory_snapshots WHERE business_id=? AND month=?").get(businessId, month)?.total ?? 0;
    const fixedAssets = assets().filter(({ purchaseDate }) => purchaseDate.slice(0, 7) <= month).reduce((total, item) => total + item.purchaseAmount, 0);
    const payables = sum(payableCategories);
    const loanTotal = loans().filter(({ startDate }) => startDate.slice(0, 7) <= month).reduce((total, loan) => total + loan.outstandingBalance, 0);
    const equity = categoryTotal("owner_capital") - categoryTotal("owner_drawings");
    const totalAssets = sum(assetBalanceCategories) + inventory + fixedAssets;
    const totalLiabilitiesAndEquity = payables + loanTotal + equity;
    return { month, cashAndCurrentAccounts: ugx(cash), longTermDeposits: ugx(deposits), receivables: ugx(receivables), inventory: ugx(inventory), fixedAssets: ugx(fixedAssets), payables: ugx(payables), loans: ugx(loanTotal), ownerEquity: ugx(equity), totalAssets: ugx(totalAssets), totalLiabilitiesAndEquity: ugx(totalLiabilitiesAndEquity), difference: totalAssets-totalLiabilitiesAndEquity, balanced: totalAssets===totalLiabilitiesAndEquity };
  }
  function monthlyReport(month:string):FinancialReport {
    requireMonth(month);
    const allocation=database.prepare<[string,string],{earned:number;collected:number}>(`SELECT COALESCE(SUM(bm.earned_revenue),0) earned,COALESCE(SUM(bm.payable_base),0) collected FROM booking_months bm JOIN bookings b ON b.id=bm.booking_id WHERE b.business_id=? AND bm.month=? AND b.status='completed' AND b.archived_at IS NULL`).get(businessId,month)??{earned:0,collected:0};
    const expenseRows=database.prepare<[string,string],{category_id:string;purchase_type:"cash"|"credit";total:number}>(`SELECT category_id,purchase_type,SUM(amount) total FROM expenses WHERE business_id=? AND substr(expense_date,1,7)=? AND archived_at IS NULL GROUP BY category_id,purchase_type`).all(businessId,month);
    const purchaseRows=expenseRows.filter(({category_id})=>category_id==="cashPurchases"||category_id==="creditPurchases");
    const financialExpenses=expenseRows.filter(({category_id})=>category_id==="interestPaid").reduce((total,row)=>total+row.total,0);
    const operatingExpenses=Object.fromEntries(expenseRows.filter(({category_id})=>!["cashPurchases","creditPurchases","interestPaid","salariesAndStaffAllocations"].includes(category_id)).map((row)=>[`${row.category_id}:${row.purchase_type}`,row.total]));
    const staff=database.prepare<[string,string],{total:number}>("SELECT COALESCE(SUM(earned_amount+adjustment),0) total FROM staff_earnings WHERE business_id=? AND month=?").get(businessId,month)?.total??0;
    const referrals=database.prepare<[string,string],{total:number}>("SELECT COALESCE(SUM(earned_amount+adjustment),0) total FROM referral_earnings WHERE business_id=? AND month=?").get(businessId,month)?.total??0;
    if(staff)operatingExpenses.staff_allocations=staff;if(referrals)operatingExpenses.referral_commissions=referrals;
    const balances=database.prepare<[string,string],{category:BalanceCategory;amount:number}>("SELECT category,amount FROM balance_snapshots WHERE business_id=? AND month=?").all(businessId,month);const balance=(...categories:BalanceCategory[])=>balances.filter((row)=>categories.includes(row.category)).reduce((total,row)=>total+row.amount,0);
    const inventory=database.prepare<[string,string],{total:number}>("SELECT COALESCE(SUM(value),0) total FROM inventory_snapshots WHERE business_id=? AND month=?").get(businessId,month)?.total??0;
    const fixedAssets=assets().filter(({purchaseDate})=>purchaseDate.slice(0,7)<=month).reduce((total,item)=>total+item.purchaseAmount,0);
    const currentLoans=loans().filter((loan)=>loan.classification==="current"&&loan.startDate.slice(0,7)<=month).reduce((total,loan)=>total+loan.outstandingBalance,0),nonCurrentLoans=loans().filter((loan)=>loan.classification==="non_current"&&loan.startDate.slice(0,7)<=month).reduce((total,loan)=>total+loan.outstandingBalance,0);
    const taxRate=database.prepare<[string,string],{amount:number}>(`SELECT amount_per_unit amount FROM tax_provision_rates WHERE business_id=? AND effective_from<=? AND archived_at IS NULL ORDER BY effective_from DESC LIMIT 1`).get(businessId,`${month}-01`)?.amount??database.prepare<[string],{amount:number}>("SELECT tax_provision_per_unit amount FROM businesses WHERE id=?").get(businessId)?.amount??600000;
    const activeUnits=database.prepare<[string],{count:number}>("SELECT COUNT(*) count FROM units WHERE business_id=? AND status='active' AND archived_at IS NULL").get(businessId)?.count??0;
    const cashMovements=database.prepare<[string,string],{receipts:number;refunds:number}>(`SELECT COALESCE(SUM(CASE WHEN direction='receipt' THEN amount ELSE 0 END),0) receipts,COALESCE(SUM(CASE WHEN direction='refund' THEN amount ELSE 0 END),0) refunds FROM payments WHERE business_id=? AND substr(paid_at,1,7)=?`).get(businessId,month)??{receipts:0,refunds:0};
    const cashExpense=expenseRows.filter(({purchase_type})=>purchase_type==="cash").reduce((total,row)=>total+row.total,0);const supplierPaid=database.prepare<[string,string],{total:number}>("SELECT COALESCE(SUM(amount),0) total FROM supplier_payments WHERE business_id=? AND substr(paid_at,1,7)=?").get(businessId,month)?.total??0;
    const cashSales=Math.min(allocation.earned,allocation.collected),creditSales=Math.max(0,allocation.earned-cashSales),cashPurchases=purchaseRows.filter(({purchase_type})=>purchase_type==="cash").reduce((t,r)=>t+r.total,0),creditPurchases=purchaseRows.filter(({purchase_type})=>purchase_type==="credit").reduce((t,r)=>t+r.total,0);
    const cash=balance("cash_on_hand","current_bank","mobile_money"),cashPayments=cashMovements.refunds+cashExpense+supplierPaid;
    return buildFinancialReport({cashSales,creditSales,cashPurchases,creditPurchases,operatingExpenses,financialExpenses,taxExpense:activeUnits*taxRate,cash,longTermDeposits:balance("long_term_deposit"),receivables:balance("customer_receivable","other_receivable"),inventory,fixedAssets,currentLiabilities:balance("supplier_payable","staff_payable","referral_payable","tax_payable","pension_payable")+currentLoans,nonCurrentLiabilities:nonCurrentLoans,ownerEquity:balance("owner_capital"),drawings:balance("owner_drawings"),openingCash:cash-(cashMovements.receipts-cashPayments),cashReceipts:cashMovements.receipts,cashPayments,fixedCosts:Object.values(operatingExpenses).reduce((t,v)=>t+v,0)+financialExpenses,variableCosts:cashPurchases+creditPurchases});
  }

  return Object.freeze({
    recordBalance(input: { month: string; category: BalanceCategory; amount: number; accountId?: string | null; unitId?: string | null; notes?: string | null }) {
      requireMonth(input.month); assertOpen(input.month);if(!balanceCategories.has(input.category))throw new Error("Choose a valid balance type.");requireOwned("units", input.unitId);requireOwned("accounts",input.accountId); const amount = wholeUgx(input.amount);
      const row = database.prepare<[string,string,string,string|null,string|null],{id:string}>("SELECT id FROM balance_snapshots WHERE business_id=? AND month=? AND category=? AND account_id IS ? AND unit_id IS ?").get(businessId,input.month,input.category,input.accountId??null,input.unitId??null);
      if (row) database.prepare("UPDATE balance_snapshots SET amount=?,notes=? WHERE id=?").run(amount,input.notes?.trim()||null,row.id);
      else database.prepare("INSERT INTO balance_snapshots (business_id,month,category,account_id,unit_id,amount,notes) VALUES (?,?,?,?,?,?,?)").run(businessId,input.month,input.category,input.accountId??null,input.unitId??null,amount,input.notes?.trim()||null);
      return position(input.month);
    },
    recordInventory(input:{month:string;unitId?:string|null;value:number;notes?:string|null}) { requireMonth(input.month); assertOpen(input.month); requireOwned("units",input.unitId); const value=wholeUgx(input.value); const row=database.prepare<[string,string,string|null],{id:string}>("SELECT id FROM inventory_snapshots WHERE business_id=? AND month=? AND unit_id IS ?").get(businessId,input.month,input.unitId??null); if(row)database.prepare("UPDATE inventory_snapshots SET value=?,notes=? WHERE id=?").run(value,input.notes?.trim()||null,row.id);else database.prepare("INSERT INTO inventory_snapshots (business_id,month,unit_id,value,notes) VALUES (?,?,?,?,?)").run(businessId,input.month,input.unitId??null,value,input.notes?.trim()||null); return position(input.month); },
    createAsset(input:{category:AssetCategory;description:string;purchaseDate:string;purchaseAmount:number;unitId?:string|null;supplierId?:string|null;paymentMethod?:string|null;usefulLifeMonths?:number|null}):AssetRecord { if(!assetCategories.has(input.category))throw new Error("Choose a valid asset category.");if(!input.description.trim())throw new Error("Asset description is required.");if(!calendarDate(input.purchaseDate))throw new Error("Choose a valid purchase date.");assertOpen(input.purchaseDate.slice(0,7));requireOwned("units",input.unitId);requireOwned("suppliers",input.supplierId);const amount=wholeUgx(input.purchaseAmount);if(input.usefulLifeMonths!=null&&(!Number.isSafeInteger(input.usefulLifeMonths)||input.usefulLifeMonths<1))throw new Error("Useful life must be whole months.");const row=database.prepare<any,{id:string}>("INSERT INTO assets (business_id,unit_id,supplier_id,category,description,purchase_date,purchase_amount,payment_method,useful_life_months) VALUES (@businessId,@unitId,@supplierId,@category,@description,@purchaseDate,@amount,@paymentMethod,@usefulLifeMonths) RETURNING id").get({businessId,unitId:input.unitId??null,supplierId:input.supplierId??null,category:input.category,description:input.description.trim(),purchaseDate:input.purchaseDate,amount,paymentMethod:input.paymentMethod?.trim()||null,usefulLifeMonths:input.usefulLifeMonths??null})!;return assets().find(({id})=>id===row.id)!; },
    listAssets: assets,
    createLoan(input:{lender:string;kind:LoanKind;classification:"current"|"non_current";principal:number;outstandingBalance:number;interestRateBasisPoints?:number;startDate:string;dueDate?:string|null;notes?:string|null}):LoanRecord { if(!input.lender.trim())throw new Error("Lender is required.");if(!loanKinds.has(input.kind))throw new Error("Choose a valid loan type.");if(!calendarDate(input.startDate)||input.dueDate&&!calendarDate(input.dueDate))throw new Error("Choose valid loan dates.");assertOpen(input.startDate.slice(0,7));const principal=wholeUgx(input.principal),outstanding=wholeUgx(input.outstandingBalance),rate=input.interestRateBasisPoints??0;if(!Number.isSafeInteger(rate)||rate<0)throw new Error("Use a valid interest rate.");const row=database.prepare<any,{id:string}>("INSERT INTO loans (business_id,lender,kind,classification,principal,outstanding_balance,interest_rate_basis_points,start_date,due_date,notes) VALUES (@businessId,@lender,@kind,@classification,@principal,@outstanding,@rate,@startDate,@dueDate,@notes) RETURNING id").get({businessId,lender:input.lender.trim(),kind:input.kind,classification:input.classification,principal,outstanding,rate,startDate:input.startDate,dueDate:input.dueDate??null,notes:input.notes?.trim()||null})!;return loans().find(({id})=>id===row.id)!; },
    listLoans: loans,
    getPosition: position,
    getMonthlyReport:monthlyReport,
    getPeriodStatus: status,
    closeMonth(month:string):PeriodClose { assertOpen(month);const report=position(month);if(!report.balanced)throw new Error(`The month is not balanced by UGX ${Math.abs(report.difference)}.`);database.prepare("INSERT INTO period_closes (business_id,month,status,closed_at) VALUES (?,?,'closed',strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(business_id,month) DO UPDATE SET status='closed',reason=NULL,closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),reopened_at=NULL").run(businessId,month);audit.append({entityType:"period_close",entityId:`${businessId}:${month}`,action:"close",after:{status:"closed"}});return status(month); },
    reopenMonth(month:string,reason:string):PeriodClose { requireMonth(month);const current=status(month);if(current.status!=="closed")throw new Error("Only a closed month can be reopened.");const clean=reason.trim();if(!clean)throw new Error("A reopening reason is required.");database.prepare("UPDATE period_closes SET status='reopened',reason=?,reopened_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE business_id=? AND month=?").run(clean,businessId,month);audit.append({entityType:"period_close",entityId:`${businessId}:${month}`,action:"reopen",reason:clean,before:current,after:{status:"reopened"}});return status(month); },
  });
}
