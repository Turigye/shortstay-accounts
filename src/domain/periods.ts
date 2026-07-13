import type { MonthKey, MonthNightAllocation } from "./types";

export type { MonthKey, MonthNightAllocation } from "./types";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;

function parseIsoDate(value: string): number {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error("Dates must use a valid YYYY-MM-DD calendar date");
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error("Dates must use a valid YYYY-MM-DD calendar date");
  }

  return timestamp;
}

export function splitStayByMonth(checkIn: string, checkOut: string): MonthNightAllocation[] {
  const checkInTime = parseIsoDate(checkIn);
  const checkOutTime = parseIsoDate(checkOut);

  if (checkOutTime <= checkInTime) {
    throw new Error("Checkout must be after check-in");
  }

  const allocations: MonthNightAllocation[] = [];

  for (let night = checkInTime; night < checkOutTime; night += MILLISECONDS_PER_DAY) {
    const month = new Date(night).toISOString().slice(0, 7) as MonthKey;
    const current = allocations.at(-1);

    if (current?.month === month) {
      current.nights += 1;
    } else {
      allocations.push({ month, nights: 1 });
    }
  }

  return allocations;
}
