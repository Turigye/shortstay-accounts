import { CalendarClock } from "lucide-react";

import { EXPENSE_CATEGORIES } from "../../domain/categories";
import type { RecurringExpenseTemplate } from "../../main/db/repositories/expense-repository";

const labels = new Map(EXPENSE_CATEGORIES.map(({ id, label }) => [id, label]));
const formatUgx = (value: number | null) => value === null ? "Amount not set" : `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;

export function RecurringExpenseReview({ templates, onAdd }: { readonly templates: readonly RecurringExpenseTemplate[]; readonly onAdd: () => void }) {
  return <section className="recurring-review" aria-labelledby="recurring-title">
    <header><div><h2 id="recurring-title">Recurring review</h2><p>Templates remain pending until you confirm the actual bill.</p></div><div className="recurring-actions"><span>{templates.length} due</span><button className="text-button" onClick={onAdd} type="button">New template</button></div></header>
    {templates.length ? <ul>{templates.map(template => <li key={template.id}><CalendarClock aria-hidden="true" size={17}/><div><strong>{labels.get(template.categoryId) ?? template.categoryId}</strong><span>{template.cadence} · review {template.nextReviewMonth}</span></div><b>{formatUgx(template.expectedAmount)}</b></li>)}</ul> : <p className="inline-message">No recurring expenses need review this month.</p>}
  </section>;
}
