import { CalendarClock, Plus } from "lucide-react";

import { EXPENSE_CATEGORIES } from "../../domain/categories";
import type { RecurringExpenseTemplate } from "../../main/db/repositories/expense-repository";

const labels = new Map(EXPENSE_CATEGORIES.map(({ id, label }) => [id, label]));
const formatUgx = (value: number | null) => value === null ? "Amount not set" : `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;

export function RecurringExpenseReview({ templates, onAdd }: { readonly templates: readonly RecurringExpenseTemplate[]; readonly onAdd: () => void }) {
  return <section className="recurring-review" aria-labelledby="recurring-title">
    <header><div><span className="section-eyebrow">Scheduled costs</span><h2 id="recurring-title">Recurring bills</h2><p>Set up Netflix, Yaka, service fees, and other repeating costs. Confirm the actual amount when each bill is due.</p></div><div className="recurring-actions"><span className="due-count">{templates.length} due</span><button className="primary-button compact-button" onClick={onAdd} type="button"><Plus size={16}/>Add recurring bill</button></div></header>
    {templates.length ? <ul>{templates.map(template => <li key={template.id}><CalendarClock aria-hidden="true" size={19}/><div><strong>{labels.get(template.categoryId) ?? template.categoryId}</strong><span>{template.cadence} · next confirmation {template.nextReviewMonth}</span></div><b>{formatUgx(template.expectedAmount)}</b></li>)}</ul> : <p className="inline-message">No recurring bills need confirmation this month.</p>}
  </section>;
}
