import { CalendarCheck2 } from "lucide-react";
import { useState } from "react";

import { AppShell, type AppScreen } from "./components/AppShell";

const screenContent: Record<AppScreen, { title: string; description: string }> = {
  today: {
    title: "Today",
    description: "Arrivals, departures, balances, and work requiring attention.",
  },
  bookings: {
    title: "Bookings",
    description: "Guest stays, unit availability, and booking details.",
  },
  payments: {
    title: "Payments",
    description: "Collections, refunds, payment methods, and customer balances.",
  },
  expenses: {
    title: "Expenses",
    description: "Operating costs, purchases, suppliers, and recurring expenses.",
  },
  staff: {
    title: "Staff",
    description: "Role rates, earnings, payment status, and calculation details.",
  },
  "financial-position": {
    title: "Financial Position",
    description: "Cash, receivables, inventory, obligations, assets, and equity.",
  },
  reports: {
    title: "Reports",
    description: "Statements, cash flow, break-even, trends, and ratios.",
  },
  settings: {
    title: "Settings",
    description: "Business details, units, rates, categories, backups, and security.",
  },
};

export function App() {
  const [activeScreen, setActiveScreen] = useState<AppScreen>("today");
  const content = screenContent[activeScreen];

  return (
    <AppShell activeScreen={activeScreen} onScreenChange={setActiveScreen}>
      <header className="page-header">
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </header>

      <section className="empty-state" aria-labelledby="empty-state-title">
        <CalendarCheck2 aria-hidden="true" size={28} strokeWidth={1.8} />
        <h2 id="empty-state-title">No activity recorded</h2>
        <p>
          Bookings, payments, expenses, and alerts will appear here as records
          are added.
        </p>
      </section>
    </AppShell>
  );
}
