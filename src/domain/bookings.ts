import type { BookingStatus, PaymentState, Ugx } from "./types";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

export interface BookingDateRange {
  readonly checkIn: string;
  readonly checkOut: string;
}

export interface BookingTotalInput {
  readonly nights: number;
  readonly nightlyRate: number;
  readonly adjustment: number;
}

export interface Customer {
  readonly id: string;
  readonly businessId: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly notes: string | null;
  readonly archived: boolean;
}

export interface Booking {
  readonly id: string;
  readonly businessId: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly customerEmail: string | null;
  readonly referrerId: string | null;
  readonly referrerName: string | null;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly checkInTime: string;
  readonly checkOutTime: string;
  readonly nights: number;
  readonly occupancyMode: "whole_unit" | "one_room";
  readonly pricingMode: "nightly" | "fixed";
  readonly fixedAmount: Ugx | null;
  readonly nightlyRate: Ugx;
  readonly adjustment: Ugx;
  readonly total: Ugx;
  readonly status: BookingStatus;
  readonly paymentState: PaymentState;
  readonly received: Ugx;
  readonly refunded: Ugx;
  readonly netReceived: Ugx;
  readonly due: Ugx;
  readonly balance: Ugx;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class BookingRuleError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Readonly<Record<string, readonly string[]>> = {},
  ) {
    super(message);
    this.name = "BookingRuleError";
  }
}

function parseCalendarDate(value: string, field: "checkIn" | "checkOut"): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BookingRuleError("Booking dates must use YYYY-MM-DD.", {
      [field]: ["Enter a valid calendar date."],
    });
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BookingRuleError("A booking date is invalid.", {
      [field]: ["Enter a valid calendar date."],
    });
  }
  return parsed.valueOf();
}

export function calculateNights({ checkIn, checkOut }: BookingDateRange): number {
  const start = parseCalendarDate(checkIn, "checkIn");
  const end = parseCalendarDate(checkOut, "checkOut");
  const nights = (end - start) / DAY_IN_MILLISECONDS;
  if (!Number.isSafeInteger(nights) || nights <= 0) {
    throw new BookingRuleError("Check-out must be after check-in.", {
      checkOut: ["Choose a check-out date after check-in."],
    });
  }
  return nights;
}

export function overlaps(left: BookingDateRange, right: BookingDateRange): boolean {
  calculateNights(left);
  calculateNights(right);
  return left.checkIn < right.checkOut && right.checkIn < left.checkOut;
}

export function calculateBookingTotal({
  nights,
  nightlyRate,
  adjustment,
}: BookingTotalInput): Ugx {
  if (!Number.isSafeInteger(nights) || nights <= 0) {
    throw new BookingRuleError("Booking nights must be a positive whole number.", {
      nights: ["Enter at least one night."],
    });
  }
  if (!Number.isSafeInteger(nightlyRate) || nightlyRate < 0) {
    throw new BookingRuleError("Nightly rate must be a whole non-negative UGX amount.", {
      nightlyRate: ["Enter a whole UGX amount of zero or more."],
    });
  }
  if (!Number.isSafeInteger(adjustment)) {
    throw new BookingRuleError("Adjustment must be a whole UGX amount.", {
      adjustment: ["Enter a whole UGX amount."],
    });
  }

  const stayValue = nights * nightlyRate;
  const total = stayValue + adjustment;
  if (!Number.isSafeInteger(stayValue) || !Number.isSafeInteger(total)) {
    throw new BookingRuleError("Booking total is outside the supported UGX range.", {
      total: ["Reduce the booking amounts."],
    });
  }
  if (total < 0) {
    throw new BookingRuleError("Booking total cannot be negative.", {
      adjustment: ["The adjustment cannot reduce the total below zero."],
    });
  }
  return total as Ugx;
}

export function occupiesUnit(status: BookingStatus): boolean {
  return status !== "draft" && status !== "cancelled";
}

const LEGAL_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["checkedIn", "cancelled"],
  checkedIn: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!LEGAL_TRANSITIONS[from].includes(to)) {
    throw new BookingRuleError(`A ${from} booking cannot move to ${to}.`, {
      status: ["Choose the next available booking status."],
    });
  }
}
