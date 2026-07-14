import { CalendarCheck2, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, type AppScreen } from "./components/AppShell";
import { SettingsScreen } from "./screens/SettingsScreen";
import { BookingsScreen } from "./screens/BookingsScreen";
import { PaymentsScreen } from "./screens/PaymentsScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { StaffScreen } from "./screens/StaffScreen";
import { ExpensesScreen } from "./screens/ExpensesScreen";
import { UnlockScreen } from "./screens/UnlockScreen";
import { useAppStore } from "./store/app-store";

const screenContent: Record<Exclude<AppScreen, "settings">, { title: string; description: string }> = {
  today: { title: "Today", description: "Arrivals, departures, balances, and work requiring attention." },
  bookings: { title: "Bookings", description: "Guest stays, unit availability, and booking details." },
  payments: { title: "Payments", description: "Collections, refunds, payment methods, and customer balances." },
  expenses: { title: "Expenses", description: "Operating costs, purchases, suppliers, and recurring expenses." },
  staff: { title: "Staff", description: "Role rates, earnings, payment status, and calculation details." },
  "financial-position": { title: "Financial Position", description: "Cash, receivables, inventory, obligations, assets, and equity." },
  reports: { title: "Reports", description: "Statements, cash flow, break-even, trends, and ratios." },
};

export function App() {
  const [activeScreen, setActiveScreen] = useState<AppScreen>("today");
  const { phase, business, error, busy, hydrate, createBusiness, unlock, lock, manageUnits, setRate } = useAppStore();

  useEffect(() => { void hydrate(); }, [hydrate]);

  if (phase === "booting") {
    return <main className="boot-screen" aria-label="Opening local business"><LoaderCircle aria-hidden="true" size={24} /></main>;
  }
  if (phase === "setup") {
    return <SetupScreen busy={busy} error={error} onCreate={createBusiness} />;
  }
  if (phase === "locked") {
    return <UnlockScreen busy={busy} error={error} onUnlock={unlock} />;
  }
  if (!business) return null;

  const content = activeScreen === "settings" ? null : screenContent[activeScreen];
  return (
    <AppShell
      activeScreen={activeScreen}
      businessName={business.name}
      onLock={() => void lock()}
      onScreenChange={setActiveScreen}
    >
      {activeScreen === "bookings" ? (
        <BookingsScreen units={business.units} />
      ) : activeScreen === "payments" ? (
        <PaymentsScreen />
      ) : activeScreen === "staff" ? (
        <StaffScreen />
      ) : activeScreen === "expenses" ? (
        <ExpensesScreen units={business.units} />
      ) : activeScreen === "settings" ? (
        <SettingsScreen
          business={business}
          busy={busy}
          error={error}
          onLock={lock}
          onManageUnits={manageUnits}
          onSetRate={setRate}
        />
      ) : (
        <>
          <header className="page-header"><h1>{content?.title}</h1><p>{content?.description}</p></header>
          <section className="empty-state" aria-labelledby="empty-state-title">
            <CalendarCheck2 aria-hidden="true" size={28} strokeWidth={1.8} />
            <h2 id="empty-state-title">No activity recorded</h2>
            <p>Records for this area will appear here as daily work is added.</p>
          </section>
        </>
      )}
    </AppShell>
  );
}
