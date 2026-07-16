import { Calculator, HandCoins, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { RoleKey } from "../../domain/types";
import type { MonthlyCompensationReport } from "../../main/db/repositories/compensation-repository";
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

function formatUgx(value: number): string {
  return `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-UG", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00.000Z`));
}

export function StaffScreen() {
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<"staff" | "referrals">("staff");
  const [report, setReport] = useState<MonthlyCompensationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.stayBooks.invoke(IPC_CHANNELS.COMPENSATION_MONTHLY, { month });
      if (!result.ok) setError(result.message);
      else setReport(result.data);
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
                <table className="statement-table">
                  <thead><tr><th>Role</th><th>NCBR base</th><th>Rate</th><th>Earned</th><th>Adjustment</th><th>Paid</th><th>Due</th></tr></thead>
                  <tbody>{report.staff.map((line) => (
                    <tr key={line.role}>
                      <td><strong>{ROLE_LABELS[line.role]}</strong></td>
                      <td className="money-cell">{formatUgx(line.base)}</td>
                      <td>{line.rate}%</td>
                      <td className="money-cell">{formatUgx(line.earned)}</td>
                      <td className="money-cell">{formatUgx(line.adjustment)}</td>
                      <td className="money-cell">{formatUgx(line.paid)}</td>
                      <td className="money-cell"><strong>{formatUgx(line.due)}</strong></td>
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
    </section>
  );
}
