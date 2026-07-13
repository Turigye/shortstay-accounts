import { describe, expect, it } from "vitest";

import {
  BookingRuleError,
  assertBookingTransition,
  calculateBookingTotal,
  calculateNights,
  occupiesUnit,
  overlaps,
} from "../../src/domain/bookings";
import { ugx } from "../../src/domain/money";

describe("booking dates", () => {
  it("treats checkout as exclusive so adjacent stays do not overlap", () => {
    expect(
      overlaps(
        { checkIn: "2026-07-10", checkOut: "2026-07-12" },
        { checkIn: "2026-07-12", checkOut: "2026-07-14" },
      ),
    ).toBe(false);
    expect(
      overlaps(
        { checkIn: "2026-07-10", checkOut: "2026-07-13" },
        { checkIn: "2026-07-12", checkOut: "2026-07-14" },
      ),
    ).toBe(true);
  });

  it("calculates calendar nights across month boundaries", () => {
    expect(calculateNights({ checkIn: "2026-07-30", checkOut: "2026-08-03" })).toBe(4);
  });

  it.each([
    { checkIn: "2026-02-30", checkOut: "2026-03-02" },
    { checkIn: "2026-07-14", checkOut: "2026-07-14" },
    { checkIn: "2026-07-15", checkOut: "2026-07-14" },
  ])("rejects invalid stay dates: $checkIn to $checkOut", (range) => {
    expect(() => calculateNights(range)).toThrow(BookingRuleError);
  });
});

describe("booking totals", () => {
  it("returns an exact whole-UGX total", () => {
    expect(
      calculateBookingTotal({
        nights: 3,
        nightlyRate: ugx(180_000),
        adjustment: ugx(-20_000),
      }),
    ).toBe(520_000);
  });

  it.each([
    { nights: 2, nightlyRate: 100_000.5, adjustment: 0 },
    { nights: 2, nightlyRate: -1, adjustment: 0 },
    { nights: 2, nightlyRate: 100_000, adjustment: -200_001 },
    { nights: Number.MAX_SAFE_INTEGER, nightlyRate: 2, adjustment: 0 },
  ])("rejects unsafe or negative money: %#", (input) => {
    expect(() => calculateBookingTotal(input)).toThrow(BookingRuleError);
  });
});

describe("booking states", () => {
  it("makes draft and cancelled bookings non-blocking", () => {
    expect(occupiesUnit("draft")).toBe(false);
    expect(occupiesUnit("cancelled")).toBe(false);
    expect(occupiesUnit("confirmed")).toBe(true);
    expect(occupiesUnit("checkedIn")).toBe(true);
    expect(occupiesUnit("completed")).toBe(true);
  });

  it.each([
    ["draft", "confirmed"],
    ["draft", "cancelled"],
    ["confirmed", "checkedIn"],
    ["confirmed", "cancelled"],
    ["checkedIn", "completed"],
    ["checkedIn", "cancelled"],
  ] as const)("allows %s to transition to %s", (from, to) => {
    expect(() => assertBookingTransition(from, to)).not.toThrow();
  });

  it.each([
    ["draft", "completed"],
    ["confirmed", "completed"],
    ["checkedIn", "confirmed"],
    ["completed", "cancelled"],
    ["cancelled", "draft"],
  ] as const)("rejects %s to %s", (from, to) => {
    expect(() => assertBookingTransition(from, to)).toThrow(BookingRuleError);
  });
});
