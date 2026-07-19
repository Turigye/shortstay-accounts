import { Calculator, HandCoins, Info, LoaderCircle, RotateCcw, WalletCards, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import type { PaymentMethod } from "../../domain/payments";
import type { RoleKey } from "../../domain/types";
import type { StaffStatementLine, MonthlyCompensationReport } from "../../main/db/repositories/compensation-repository";
import type { PaymentAccount } from "../../main/db/repositories/payment-repository";
import { IPC_CHANNELS } from "../../shared/ipc";
import { CalculationTrace } from "../components/CalculationTrace";

const ROLE_LABELS: Readonly<Record<RoleKey, string>> = {
  operations: "Operations Manager",
  salesMarketing: "Sales and Marketing",
  finance: "Finance",
  itLegal: "IT and Legal",
  security: "Security",
  ceo: "CEO",
};

type StaffPanel = "payment" | "return" | "attendance" | "restore" | null;

function formatUgx(value: number): string {
  return `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-UG", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00.000Z`));
}

function methodForAccount(account: PaymentAccount | undefined): PaymentMethod {
  if (account?.type === "mobileMoney") return "mobileMoney";
  if (account?.type === "bank") return "bankTransfer";
  if (account?.type === "card") return "card";
  return "cash";
}

export function StaffScreen() {
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<"staff" | "referrals">("staff");
  const [report, setReport] = useState<MonthlyCompensationReport | null>(null);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [selected, setSelected] = useState<StaffStatementLine | null>(null);
  const [panel, setPanel] = useState<StaffPanel>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statement, accountResult] = await Promise.all([
        window.stayBooks.invoke(IPC_CHANNELS.COMPENSATION_MONTHLY, { month }),
        window.stayBooks.invoke(IPC_CHANNELS.ACCOUNTS_LIST, {}),
      ]);
      if (!statement.ok) setError(statement.message);
      else setReport(statement.data);
      if (accountResult.ok) setAccounts(accountResult.data);
    } catch {
      setError("The compensation statement could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const rows = tab === "staff" ? report?.staff ?? [] : report?.referrals ?? [];
    return rows.reduce(
      (sum, row) => ({
        earned: sum.earned + row.earned + row.adjustment,
        paid: sum.paid + row.paid,
        due: sum.due + row.due,
      }),
      { earned: 0, paid: 0, due: 0 },
    );
  }, [report, tab]);

  function openPanel(line: StaffStatementLine, nextPanel: Exclude<StaffPanel, null>): void {
    setSelected(line);
    setPanel(nextPanel);
    setError(null);
  }

  function closePanel(): void {
    setSelected(null);
    setPanel(null);
  }

  async function saveSettlement(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected || (panel !== "payment" && panel !== "return")) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    const result = await window.stayBooks.invoke(IPC_CHANNELS.COMPENSATION_STAFF_SETTLEMENT, {
      month,
      role: selected.role,
      direction: panel,
      amount: Number(form.get("amount")),
      paidAt: String(form.get("paidAt")),
      accountId: String(form.get("accountId")),
      method: String(form.get("method")) as PaymentMethod,
      reference: String(form.get("reference") ?? "").trim() || null,
      notes: String(form.get("notes") ?? "").trim() || null,
    });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    setReport(result.data);
    closePanel();
  }

  async function saveAttendance(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected || (panel !== "attendance" && panel !== "restore")) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    const result = await window.stayBooks.invoke(IPC_CHANNELS.COMPENSATION_STAFF_WORKED, {
      month,
      role: selected.role,
      worked: panel === "restore",
      reason: String(form.get("reason")),
    });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    setReport(result.data);
    closePanel();
  }

  const selectedAccount = accounts[0];
  const panelTitle = selected && panel
    ? panel === "payment" ? `Pay ${ROLE_LABELS[selected.role]}`
      : panel === "return" ? `Return funds · ${ROLE_LABELS[selected.role]}`
        : panel === "restore" ? `Restore ${ROLE_LABELS[selected.role]}`
          : `${ROLE_LABELS[selected.role]} did not work`
    : "";

  return (
    <section className="staff-screen">
      <header className="page-header staff-header">
        <div><h1>Staff and referrals</h1><p>Activity-based earnings from completed stays and eligible collections.</p></div>
        <label className="month-control"><span>Statement month</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      </header>

      <div className="statement-toolbar">
        <div className="segmented-control" aria-label="Compensation statement">
          <button aria-pressed={tab === "staff"} onClick={() => setTab("staff")} type="button"><Calculator aria-hidden="true" size={16} />Staff</button>
          <button aria-pressed={tab === "referrals"} data-tour="referral-earnings" onClick={() => setTab("referrals")} type="button"><HandCoins aria-hidden="true" size={16} />Referrals</button>
        </div>
        <strong>{monthLabel(month)}</strong>
      </div>

      {tab === "staff" ? <div className="staff-payment-note"><Info size={17} /><span><strong>Pay staff here.</strong> Staff earnings are already included in expenses, so do not record them again under Expenses.</span></div> : null}
      {error ? <div className="form-alert" role="alert">{error}</div> : null}
      {loading ? <div className="statement-loading"><LoaderCircle aria-hidden="true" size={22} />Loading statement</div> : report ? (
        <>
          <div className="statement-summary" aria-label="Statement totals" data-tour="staff-base">
            <div><span>Net collected booking revenue</span><strong>{formatUgx(report.ncbr)}</strong></div>
            <div><span>{tab === "staff" ? "Staff earned" : "Referral earned"}</span><strong>{formatUgx(totals.earned)}</strong></div>
            <div><span>Paid</span><strong>{formatUgx(totals.paid)}</strong></div>
            <div data-emphasis="true"><span>Due</span><strong>{formatUgx(totals.due)}</strong></div>
          </div>

          <div className="statement-panel" data-tour="staff-rates">
            <div className="table-scroll">
              {tab === "staff" ? (
                <table className="statement-table staff-statement-table">
                  <thead><tr><th>Role</th><th>NCBR base</th><th>Rate</th><th>Earned</th><th>Paid</th><th>Due</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                  <tbody>{report.staff.map((line) => (
                    <tr key={line.role} data-worked={line.worked}>
                      <td><strong>{ROLE_LABELS[line.role]}</strong>{!line.worked ? <small>Not worked · {line.statusReason}</small> : null}</td>
                      <td className="money-cell">{formatUgx(line.base)}</td>
                      <td>{line.rate}%</td>
                      <td className="money-cell">{formatUgx(line.earned + line.adjustment)}</td>
                      <td className="money-cell">{formatUgx(line.paid)}</td>
                      <td className="money-cell"><strong>{formatUgx(line.due)}</strong></td>
                      <td><div className="staff-row-actions">
                        {line.due > 0 ? <button aria-label={`Pay ${ROLE_LABELS[line.role]}`} className="text-button" onClick={() => openPanel(line, "payment")} type="button">Pay</button> : null}
                        {line.paid > 0 ? <button aria-label={`Return ${ROLE_LABELS[line.role]} funds`} className="text-button" onClick={() => openPanel(line, "return")} type="button">Return</button> : null}
                        <button aria-label={line.worked ? `Mark ${ROLE_LABELS[line.role]} not worked` : `Restore ${ROLE_LABELS[line.role]} as worked`} className="icon-button" onClick={() => openPanel(line, line.worked ? "attendance" : "restore")} title={line.worked ? "Not worked" : "Restore"} type="button"><RotateCcw size={15} /></button>
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : report.referrals.length > 0 ? (
                <table className="statement-table">
                  <thead><tr><th>Referrer / booking</th><th>Eligible base</th><th>Rate</th><th>Earned</th><th>Adjustment</th><th>Paid</th><th>Due</th></tr></thead>
                  <tbody>{report.referrals.map((line) => (
                    <tr key={`${line.bookingId}-${line.referrerName}`}>
                      <td><strong>{line.referrerName}</strong><small>{line.customerName} · {line.bookingId.slice(0, 8)}</small></td>
                      <td className="money-cell">{formatUgx(line.base)}</td>
                      <td>{line.rate}%</td>
                      <td className="money-cell">{formatUgx(line.earned)}</td>
                      <td className="money-cell">{formatUgx(line.adjustment)}</td>
                      <td className="money-cell">{formatUgx(line.paid)}</td>
                      <td className="money-cell"><strong>{formatUgx(line.due)}</strong></td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div className="inline-empty"><HandCoins aria-hidden="true" size={22} /><strong>No referral earnings</strong><span>Eligible referred bookings for this month will appear here.</span></div>}
            </div>
          </div>
          <CalculationTrace traces={report.traces} />
        </>
      ) : null}

      {selected && panel ? <aside className="expense-side-panel staff-side-panel">
        <header><div><span className="section-eyebrow">Staff payroll</span><h2>{panelTitle}</h2></div><button className="icon-button" aria-label="Close panel" onClick={closePanel} type="button"><X size={17} /></button></header>
        {panel === "payment" || panel === "return" ? <form className="expense-editor" onSubmit={(event) => void saveSettlement(event)}>
          <div className="payroll-amount-summary"><WalletCards size={20} /><span>{panel === "payment" ? "Amount due" : "Amount paid"}</span><strong>{formatUgx(panel === "payment" ? selected.due : selected.paid)}</strong></div>
          <label className="field-group"><span>Amount</span><input defaultValue={panel === "payment" ? selected.due : selected.paid} max={panel === "payment" ? selected.due : selected.paid} min="1" name="amount" required type="number" /></label>
          <div className="form-grid-two">
            <label className="field-group"><span>Date</span><input defaultValue={today()} name="paidAt" required type="date" /></label>
            <label className="field-group"><span>Account</span><select defaultValue={selectedAccount?.id} name="accountId" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          </div>
          <label className="field-group"><span>Method</span><select defaultValue={methodForAccount(selectedAccount)} name="method"><option value="cash">Cash</option><option value="mobileMoney">Mobile money</option><option value="bankTransfer">Bank transfer</option><option value="card">Card</option></select></label>
          <label className="field-group"><span>Reference</span><input name="reference" /></label>
          <label className="field-group"><span>Notes</span><textarea name="notes" /></label>
          <button className="primary-button" disabled={saving || accounts.length === 0}>{saving ? "Saving…" : panel === "payment" ? "Save payment" : "Save returned funds"}</button>
          {accounts.length === 0 ? <small className="field-help">Create a payment account in Settings before recording payroll.</small> : null}
        </form> : <form className="expense-editor" onSubmit={(event) => void saveAttendance(event)}>
          <p className="panel-guidance">{panel === "attendance" ? "This removes the unpaid allocation for this role and month. Any payment must be returned first." : "This restores the role’s calculated allocation for this month."}</p>
          <label className="field-group"><span>Reason</span><textarea aria-label="Reason" defaultValue={panel === "restore" ? "Attendance corrected." : ""} name="reason" required /></label>
          <button className="primary-button" disabled={saving}>{saving ? "Saving…" : panel === "attendance" ? "Confirm not worked" : "Restore allocation"}</button>
        </form>}
      </aside> : null}
    </section>
  );
}
