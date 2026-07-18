import { CalendarClock, CheckCircle2, Plus } from "lucide-react";

import { EXPENSE_CATEGORIES } from "../../domain/categories";
import type { RecurringExpenseTemplate } from "../../main/db/repositories/expense-repository";

const labels = new Map(EXPENSE_CATEGORIES.map(({ id, label }) => [id, label]));
const formatUgx = (value: number | null) => value === null ? "Amount not set" : `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;

export function RecurringExpenseReview({ templates, onAdd, onRecord }: { readonly templates: readonly RecurringExpenseTemplate[]; readonly onAdd: () => void; readonly onRecord: (template: RecurringExpenseTemplate) => void }) {
  return <section className="recurring-review" aria-labelledby="recurring-title">
    <header><div><span className="section-eyebrow">Due this month</span><h2 id="recurring-title">Recurring bills</h2><p>Record each bill when it arrives. The amount can be corrected before saving.</p></div><div className="recurring-actions"><span className="due-count">{templates.length} awaiting confirmation</span><button className="secondary-button compact-button" onClick={onAdd} type="button"><Plus size={16}/>New schedule</button></div></header>
    {templates.length ? <ul>{templates.map(template => <li key={template.id}><CalendarClock aria-hidden="true" size={20}/><div className="recurring-bill-name"><strong>{labels.get(template.categoryId) ?? template.categoryId}</strong><span>{template.cadence} schedule · due {template.nextReviewMonth}</span></div><div className="recurring-bill-amount"><span>Expected</span><b>{formatUgx(template.expectedAmount)}</b></div><button className="primary-button compact-button" onClick={() => onRecord(template)} type="button"><CheckCircle2 size={16}/>Record bill</button></li>)}</ul> : <div className="recurring-empty"><CheckCircle2 size={20}/><div><strong>All recurring bills are recorded</strong><span>Nothing else needs confirmation for this month.</span></div></div>}
  </section>;
}
