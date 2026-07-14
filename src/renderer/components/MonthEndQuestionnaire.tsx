import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";

import type { PeriodStatus } from "../../main/db/repositories/finance-repository";

const sections = [
  "Exceptions and close",
  "Bookings and collections",
  "Expenses and recurring bills",
  "Cash, bank, and mobile money",
  "Customer and supplier balances",
  "Guest-supply inventory",
  "Loans, assets, capital, and drawings",
  "Staff and referral calculations",
  "Tax provision and payments",
];

export function MonthEndQuestionnaire({ month, status, balanced, onClose, onReopen }: {
  readonly month: string;
  readonly status: PeriodStatus;
  readonly balanced: boolean;
  readonly onClose: () => void;
  readonly onReopen: (reason: string) => void;
}) {
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-UG", { month: "long", year: "numeric", timeZone: "UTC" });
  return <section className="month-end" aria-labelledby="month-end-title">
    <header><div><h2 id="month-end-title">Month-end review</h2><p>Confirm unresolved items before locking {label}.</p></div><span className={`period-status ${status}`}>{status}</span></header>
    {!balanced && status !== "closed" ? <div className="month-exception"><AlertTriangle size={17}/><span>The accounting position must balance before close.</span></div> : null}
    <ol>{sections.map((section, index) => <li key={section}>{index === 0 && !balanced ? <AlertTriangle size={17}/> : index === 0 && balanced ? <CheckCircle2 size={17}/> : <Circle size={15}/>}<span>{section}</span></li>)}</ol>
    {status === "closed" ? <form onSubmit={(event) => { event.preventDefault(); onReopen(String(new FormData(event.currentTarget).get("reason"))); }}><label className="field-group"><span>Reason for reopening</span><input name="reason" required/></label><button className="secondary-button" type="submit">Reopen {label}</button></form> : <button className="primary-button" disabled={!balanced} onClick={onClose} type="button">Close {label}</button>}
  </section>;
}
