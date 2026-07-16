import { ChevronDown } from "lucide-react";

import type { CompensationTrace } from "../../main/db/repositories/compensation-repository";

function formatUgx(value: number): string {
  return `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
}

export function CalculationTrace({ traces }: { readonly traces: readonly CompensationTrace[] }) {
  return (
    <details className="calculation-trace" data-tour="calculation-trace">
      <summary>
        <span>
          <ChevronDown aria-hidden="true" size={16} />
          Calculation trace
        </span>
        <small>{traces.length} eligible {traces.length === 1 ? "booking" : "bookings"}</small>
      </summary>
      {traces.length === 0 ? (
        <p className="trace-empty">No completed, collected stays contributed to this month.</p>
      ) : (
        <div className="table-scroll">
          <table className="statement-table trace-table">
            <thead>
              <tr><th>Booking</th><th>Unit</th><th>Stay</th><th>Earned revenue</th><th>Eligible collected</th></tr>
            </thead>
            <tbody>
              {traces.map((trace) => (
                <tr key={trace.bookingId}>
                  <td><strong>{trace.customerName}</strong><small>{trace.bookingId.slice(0, 8)}</small></td>
                  <td>{trace.unitName}</td>
                  <td>{trace.checkIn} to {trace.checkOut}</td>
                  <td className="money-cell">{formatUgx(trace.earnedRevenue)}</td>
                  <td className="money-cell"><strong>{formatUgx(trace.eligibleBase)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
