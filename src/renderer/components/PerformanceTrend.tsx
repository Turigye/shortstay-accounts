import type { TodayOverview } from "../../main/db/repositories/dashboard-repository";

const compactMoney = (value: number) =>
  new Intl.NumberFormat("en-UG", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export function PerformanceTrend({ data }: { data: TodayOverview["performance"] }) {
  const maximum = Math.max(1, ...data.flatMap(({ collected, expenses }) => [collected, expenses]));

  return (
    <section className="today-panel performance-trend">
      <header>
        <div><h2>Six-month performance</h2><span>Collections, expenses, and occupancy</span></div>
        <div className="chart-legend"><span data-series="collected">Collected</span><span data-series="expenses">Expenses</span></div>
      </header>
      <div className="performance-chart" role="img" aria-label="Collections, expenses, and occupancy for the last six months">
        {data.map((item) => (
          <div className="performance-month" key={item.month}>
            <div className="performance-bars">
              <span data-series="collected" style={{ height: `${Math.max(2, item.collected / maximum * 100)}%` }} title={`Collected UGX ${item.collected.toLocaleString("en-UG")}`} />
              <span data-series="expenses" style={{ height: `${Math.max(2, item.expenses / maximum * 100)}%` }} title={`Expenses UGX ${item.expenses.toLocaleString("en-UG")}`} />
            </div>
            <strong>{item.occupancyPercent}%</strong>
            <span>{new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString("en-UG", { month: "short", timeZone: "UTC" })}</span>
            <small>{compactMoney(item.collected)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
