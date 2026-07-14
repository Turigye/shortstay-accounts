import { describe, expect, it } from "vitest";

import {
  DEFAULT_STAFF_RATES,
  calculateCompensation,
  calculateReferral,
  percentageOf,
} from "../../src/domain/compensation";
import { ugx } from "../../src/domain/money";

describe("activity-based staff compensation", () => {
  it("uses the approved six role percentages", () => {
    expect(calculateCompensation(ugx(1_000_000), DEFAULT_STAFF_RATES)).toEqual([
      { role: "operations", base: 1_000_000, rate: 5, amount: 50_000 },
      { role: "salesMarketing", base: 1_000_000, rate: 5, amount: 50_000 },
      { role: "finance", base: 1_000_000, rate: 10, amount: 100_000 },
      { role: "itLegal", base: 1_000_000, rate: 2, amount: 20_000 },
      { role: "security", base: 1_000_000, rate: 5, amount: 50_000 },
      { role: "ceo", base: 1_000_000, rate: 10, amount: 100_000 },
    ]);
  });

  it("returns zero earnings for a zero-business month", () => {
    expect(calculateCompensation(ugx(0), DEFAULT_STAFF_RATES).map(({ amount }) => amount)).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    expect(calculateReferral(ugx(0), 10)).toBe(0);
  });

  it("places any aggregate rounding residual on the final role", () => {
    const earnings = calculateCompensation(ugx(2), DEFAULT_STAFF_RATES);
    expect(earnings.map(({ amount }) => amount)).toEqual([0, 0, 0, 0, 0, 1]);
    expect(earnings.reduce((sum, earning) => sum + earning.amount, 0)).toBe(
      percentageOf(ugx(2), 37),
    );
  });

  it("calculates the default referral percentage from eligible collections", () => {
    expect(calculateReferral(ugx(625_000), 10)).toBe(62_500);
  });

  it("honors warned-but-allowed combined staff rates above 100%", () => {
    const earnings = calculateCompensation(ugx(100), {
      ...DEFAULT_STAFF_RATES,
      operations: 100,
      finance: 100,
    });
    expect(earnings.reduce((sum, earning) => sum + earning.amount, 0)).toBe(222);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 100.01])(
    "rejects an invalid percentage: %s",
    (rate) => {
      expect(() => percentageOf(ugx(100_000), rate)).toThrow("between 0 and 100");
    },
  );
});
