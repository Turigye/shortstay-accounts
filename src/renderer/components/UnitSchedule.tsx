import { Plus } from "lucide-react";
import type { CSSProperties } from "react";

import type { Booking } from "../../domain/bookings";
import type { BusinessUnit } from "../../domain/types";

interface UnitScheduleProps {
  units: readonly BusinessUnit[];
  bookings: readonly Booking[];
  startDate: string;
  days?: number;
  onSelectBooking: (booking: Booking) => void;
  onCreateBooking: (unitId: string, date: string) => void;
}

const DAY_IN_MILLISECONDS = 86_400_000;

function dateValue(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).valueOf();
}

function addDays(date: string, days: number): string {
  return new Date(dateValue(date) + days * DAY_IN_MILLISECONDS).toISOString().slice(0, 10);
}

function dayDifference(from: string, to: string): number {
  return Math.round((dateValue(to) - dateValue(from)) / DAY_IN_MILLISECONDS);
}

function formatDay(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00.000Z`),
  );
}

function formatWeekday(date: string): string {
  return new Intl.DateTimeFormat("en-UG", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00.000Z`),
  );
}

export function UnitSchedule({
  units,
  bookings,
  startDate,
  days = 14,
  onSelectBooking,
  onCreateBooking,
}: UnitScheduleProps) {
  const visibleDays = Array.from({ length: days }, (_, index) => addDays(startDate, index));
  const visibleEnd = addDays(startDate, days);
  const gridStyle = { "--schedule-days": days } as CSSProperties;

  return (
    <div className="unit-schedule-wrap">
      <div className="unit-schedule" role="grid" aria-label="Unit booking schedule" style={gridStyle}>
        <div className="schedule-header schedule-grid-row" role="row">
          <div className="schedule-unit-heading" role="columnheader">Unit</div>
          {visibleDays.map((date) => (
            <div className="schedule-day-heading" key={date} role="columnheader">
              <span>{formatWeekday(date)}</span>
              <strong>{formatDay(date)}</strong>
            </div>
          ))}
        </div>

        {units.filter(({ status }) => status === "active").map((unit) => {
          const unitBookings = bookings.filter(
            (booking) =>
              booking.unitId === unit.id &&
              booking.status !== "draft" &&
              booking.status !== "cancelled" &&
              booking.checkIn < visibleEnd &&
              startDate < booking.checkOut,
          );
          return (
            <div className="schedule-grid-row schedule-unit-row" key={unit.id} role="row">
              <div className="schedule-unit-name" role="rowheader">
                <strong>{unit.name}</strong>
                <span>{unitBookings.length} {unitBookings.length === 1 ? "stay" : "stays"}</span>
              </div>
              {visibleDays.map((date, index) => {
                const occupied = unitBookings.some(
                  (booking) => booking.checkIn <= date && date < booking.checkOut,
                );
                return (
                  <button
                    aria-label={`New booking for ${unit.name} on ${formatDay(date)}`}
                    className="schedule-empty-cell"
                    disabled={occupied}
                    key={date}
                    onClick={() => onCreateBooking(unit.id, date)}
                    style={{ gridColumn: index + 2 }}
                    type="button"
                  >
                    {!occupied ? <Plus aria-hidden="true" size={14} /> : null}
                  </button>
                );
              })}
              {unitBookings.map((booking) => {
                const startOffset = Math.max(0, dayDifference(startDate, booking.checkIn));
                const endOffset = Math.min(days, dayDifference(startDate, booking.checkOut));
                const span = Math.max(1, endOffset - startOffset);
                return (
                  <button
                    aria-label={`${booking.customerName}, ${unit.name}, ${formatDay(booking.checkIn)} to ${formatDay(booking.checkOut)}`}
                    className="schedule-booking"
                    data-status={booking.status}
                    key={booking.id}
                    onClick={() => onSelectBooking(booking)}
                    style={{ gridColumn: `${startOffset + 2} / span ${span}` }}
                    type="button"
                  >
                    <strong>{booking.customerName}</strong>
                    <span>{formatDay(booking.checkIn)}–{formatDay(booking.checkOut)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
