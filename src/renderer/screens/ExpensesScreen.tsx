import { Plus, ReceiptText, RotateCw, Truck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { EXPENSE_CATEGORIES } from "../../domain/categories";
import type { BusinessUnit } from "../../domain/types";
import type { ExpenseRecord, RecurringExpenseTemplate, Supplier } from "../../main/db/repositories/expense-repository";
import type { PaymentAccount } from "../../main/db/repositories/payment-repository";
import { IPC_CHANNELS, type IpcFailure, type IpcPayload } from "../../shared/ipc";
import { ExpenseEditor } from "../components/ExpenseEditor";
import { RecurringExpenseReview } from "../components/RecurringExpenseReview";

const labels = new Map(EXPENSE_CATEGORIES.map(({ id, label }) => [id, label]));
const formatUgx = (value: number) => `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
const currentMonth = () => new Date().toISOString().slice(0, 7);
const firstError = (failure: IpcFailure) => Object.values(failure.fieldErrors)[0]?.[0] ?? failure.message;
type Panel = "expense" | "supplier" | "payment" | "recurring" | null;

export function ExpensesScreen({ units }: { readonly units: BusinessUnit[] }) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpenseTemplate[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [status, setStatus] = useState("all");
  const [scope, setScope] = useState("all");
  const [category, setCategory] = useState("all");
  const [unit, setUnit] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<ExpenseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [expenseResult, supplierResult, accountResult, recurringResult] = await Promise.all([
        window.stayBooks.invoke(IPC_CHANNELS.EXPENSES_LIST, {}),
        window.stayBooks.invoke(IPC_CHANNELS.SUPPLIERS_LIST, {}),
        window.stayBooks.invoke(IPC_CHANNELS.ACCOUNTS_LIST, {}),
        window.stayBooks.invoke(IPC_CHANNELS.RECURRING_EXPENSES_LIST, { month }),
      ]);
      for (const result of [expenseResult, supplierResult, accountResult, recurringResult]) {
        if (!result.ok) throw new Error(result.message);
      }
      if (expenseResult.ok) setExpenses(expenseResult.data);
      if (supplierResult.ok) setSuppliers(supplierResult.data);
      if (accountResult.ok) setAccounts(accountResult.data);
      if (recurringResult.ok) setRecurring(recurringResult.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Expense records could not be loaded.");
    } finally { setLoading(false); }
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => expenses.filter((expense) =>
    expense.date.startsWith(month) &&
    (status === "all" || expense.paymentStatus === status) &&
    (scope === "all" || expense.scope === scope) &&
    (category === "all" || expense.categoryId === category) &&
    (unit === "all" || expense.unitId === unit) &&
    (supplier === "all" || expense.supplierId === supplier)
  ), [expenses, month, status, scope, category, unit, supplier]);

  async function saveExpense(value: IpcPayload<typeof IPC_CHANNELS.EXPENSE_CREATE>) {
    const result = await window.stayBooks.invoke(IPC_CHANNELS.EXPENSE_CREATE, value);
    if (!result.ok) { setError(firstError(result)); throw new Error(result.message); }
    setExpenses((current) => [result.data, ...current]); setPanel(null);
  }
  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const result = await window.stayBooks.invoke(IPC_CHANNELS.SUPPLIER_CREATE, { name: String(form.get("name")), phone: String(form.get("phone") || "") || null });
    if (!result.ok) return setError(firstError(result));
    setSuppliers((current) => [...current, result.data]); setPanel(null);
  }
  async function paySupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; const form = new FormData(event.currentTarget);
    const result = await window.stayBooks.invoke(IPC_CHANNELS.SUPPLIER_PAYMENT, { expenseId: selected.id, amount: Number(form.get("amount")), paidAt: String(form.get("paidAt")), accountId: String(form.get("accountId")), method: "cash", reference: String(form.get("reference") || "") || null });
    if (!result.ok) return setError(firstError(result));
    setExpenses((current) => current.map((expense) => expense.id === result.data.id ? result.data : expense)); setPanel(null); setSelected(null);
  }
  async function saveRecurring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const templateScope = String(form.get("scope")) as "unit" | "shared";
    const result = await window.stayBooks.invoke(IPC_CHANNELS.RECURRING_EXPENSE_CREATE, { categoryId: String(form.get("categoryId")), scope: templateScope, unitId: templateScope === "unit" ? String(form.get("unitId")) : null, expectedAmount: Number(form.get("expectedAmount")), cadence: String(form.get("cadence")) as "monthly" | "quarterly" | "annually", nextReviewMonth: String(form.get("nextReviewMonth")), notes: String(form.get("notes") || "") || null });
    if (!result.ok) return setError(firstError(result));
    setRecurring((current) => [...current, result.data]); setPanel(null);
  }

  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0);
  const payable = filtered.reduce((sum, expense) => sum + expense.due, 0);
  return <section className="expenses-screen">
    <header className="payments-header"><div><h1>Expenses</h1><p>Property costs, supplier credit, and recurring bill review.</p></div><div><button className="secondary-button compact-button" onClick={() => setPanel("supplier")} type="button"><Truck size={16}/>Supplier</button><button className="primary-button compact-button" onClick={() => setPanel("expense")} type="button"><Plus size={16}/>New expense</button></div></header>
    <div className="expense-filters">
      <label>Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)}/></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option></select></label>
      <label>Scope<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">All scopes</option><option value="unit">Unit</option><option value="shared">Shared</option></select></label>
      <label>Unit<select value={unit} onChange={(event) => setUnit(event.target.value)}><option value="all">All units</option>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{EXPENSE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Supplier<select value={supplier} onChange={(event) => setSupplier(event.target.value)}><option value="all">All suppliers</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button className="icon-button" aria-label="Refresh expenses" onClick={() => void load()} type="button"><RotateCw size={16}/></button>
    </div>
    {error ? <p className="form-alert">{error}</p> : null}
    <div className="expense-summary"><div><span>Recorded</span><strong>{formatUgx(total)}</strong></div><div><span>Supplier payable</span><strong>{formatUgx(payable)}</strong></div><div><span>Entries</span><strong>{filtered.length}</strong></div></div>
    <div className="expense-layout"><div className="statement-panel"><div className="table-scroll">{loading ? <div className="statement-loading">Loading expenses</div> : filtered.length ? <table className="statement-table expense-table"><thead><tr><th>Date</th><th>Category</th><th>Scope</th><th>Supplier</th><th>Status</th><th>Amount</th><th>Due</th><th/></tr></thead><tbody>{filtered.map((expense) => <tr key={expense.id}><td>{expense.date}</td><td><strong>{labels.get(expense.categoryId)}</strong></td><td>{expense.scope === "shared" ? "Shared" : units.find((item) => item.id === expense.unitId)?.name ?? "Unit"}</td><td>{expense.supplierName ?? "-"}</td><td><span className={`expense-status ${expense.paymentStatus}`}>{expense.paymentStatus}</span></td><td className="money-cell">{formatUgx(expense.amount)}</td><td className="money-cell">{formatUgx(expense.due)}</td><td>{expense.due > 0 ? <button className="text-button" onClick={() => { setSelected(expense); setPanel("payment"); }} type="button">Pay</button> : null}</td></tr>)}</tbody></table> : <div className="inline-empty"><ReceiptText size={22}/><strong>No expenses for this view</strong></div>}</div></div><RecurringExpenseReview templates={recurring} onAdd={() => setPanel("recurring")}/></div>
    {panel ? <aside className="expense-side-panel"><header><h2>{panel === "expense" ? "New expense" : panel === "supplier" ? "New supplier" : panel === "recurring" ? "Recurring template" : "Supplier payment"}</h2><button className="icon-button" aria-label="Close panel" onClick={() => setPanel(null)} type="button"><X size={17}/></button></header>
      {panel === "expense" ? <ExpenseEditor units={units} accounts={accounts} suppliers={suppliers} onSave={saveExpense} onCancel={() => setPanel(null)}/> : panel === "supplier" ? <form className="expense-editor" onSubmit={saveSupplier}><label className="field-group"><span>Name</span><input name="name" required/></label><label className="field-group"><span>Phone</span><input name="phone"/></label><button className="primary-button">Add supplier</button></form> : panel === "recurring" ? <form className="expense-editor" onSubmit={saveRecurring}><label className="field-group"><span>Category</span><select name="categoryId">{EXPENSE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="field-group"><span>Scope</span><select name="scope"><option value="shared">Shared</option><option value="unit">Property unit</option></select></label><label className="field-group"><span>Unit when applicable</span><select name="unitId"><option value="">Choose unit</option>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-group"><span>Expected amount</span><input name="expectedAmount" type="number" min="0" required/></label><label className="field-group"><span>Cadence</span><select name="cadence"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option></select></label><label className="field-group"><span>Next review</span><input name="nextReviewMonth" type="month" defaultValue={month} required/></label><label className="field-group"><span>Notes</span><textarea name="notes"/></label><button className="primary-button">Save template</button></form> : <form className="expense-editor" onSubmit={paySupplier}><p>Remaining: <strong>{formatUgx(selected?.due ?? 0)}</strong></p><label className="field-group"><span>Amount</span><input name="amount" type="number" max={selected?.due} min="1" required/></label><label className="field-group"><span>Payment date</span><input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required/></label><label className="field-group"><span>Account</span><select name="accountId" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="field-group"><span>Reference</span><input name="reference"/></label><button className="primary-button">Record payment</button></form>}
    </aside> : null}
  </section>;
}
