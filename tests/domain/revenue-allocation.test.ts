import { describe, expect, it } from "vitest";

import {
  allocateEligibleCollection,
  calculateNetCollectedBookingRevenue,
} from "../../src/domain/revenue-allocation";
import { ugx } from "../../src/domain/money";

describe("occupied-month revenue allocation", () => {
  it("attributes earnings to occupied months and unlocks them on collection", () => {
    expect(
      allocateEligibleCollection({
        checkIn: "2026-07-30",
        checkOut: "2026-08-03",
        accommodationTotal: ugx(800_000),
        eligibleCollected: ugx(400_000),
        completed: true,
      }),
    ).toEqual([
      { month: "2026-07", earnedRevenue: 400_000, payableBase: 200_000 },
      { month: "2026-08", earnedRevenue: 400_000, payableBase: 200_000 },
    ]);
  });

  it("keeps residual UGX in the final occupied month", () => {
    expect(
      allocateEligibleCollection({
        checkIn: "2026-07-31",
        checkOut: "2026-08-02",
        accommodationTotal: ugx(101),
        eligibleCollected: ugx(51),
        completed: true,
      }),
    ).toEqual([
      { month: "2026-07", earnedRevenue: 51, payableBase: 26 },
      { month: "2026-08", earnedRevenue: 50, payableBase: 25 },
    ]);
  });

  it("never creates a negative month when tiny amounts span many months", () => {
    expect(
      allocateEligibleCollection({
        checkIn: "2026-01-31",
        checkOut: "2026-05-01",
        accommodationTotal: ugx(2),
        eligibleCollected: ugx(2),
        completed: true,
      }).map(({ earnedRevenue, payableBase }) => ({ earnedRevenue, payableBase })),
    ).toEqual([
      { earnedRevenue: 0, payableBase: 0 },
      { earnedRevenue: 0, payableBase: 0 },
      { earnedRevenue: 1, payableBase: 1 },
      { earnedRevenue: 1, payableBase: 1 },
    ]);
  });

  it("does not unlock staff earnings until the stay is completed", () => {
    expect(
      allocateEligibleCollection({
        checkIn: "2026-07-14",
        checkOut: "2026-07-16",
        accommodationTotal: ugx(400_000),
        eligibleCollected: ugx(400_000),
        completed: false,
      }),
    ).toEqual([{ month: "2026-07", earnedRevenue: 0, payableBase: 0 }]);
  });

  it("caps eligible collections at completed-stay accommodation revenue", () => {
    expect(
      allocateEligibleCollection({
        checkIn: "2026-07-14",
        checkOut: "2026-07-15",
        accommodationTotal: ugx(300_000),
        eligibleCollected: ugx(450_000),
        completed: true,
      }),
    ).toEqual([{ month: "2026-07", earnedRevenue: 300_000, payableBase: 300_000 }]);
  });

  it.each([
    { accommodationTotal: -1, eligibleCollected: 0 },
    { accommodationTotal: 100.5, eligibleCollected: 0 },
    { accommodationTotal: 100, eligibleCollected: -1 },
    { accommodationTotal: 100, eligibleCollected: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects unsafe money input: %#", ({ accommodationTotal, eligibleCollected }) => {
    expect(() =>
      allocateEligibleCollection({
        checkIn: "2026-07-14",
        checkOut: "2026-07-15",
        accommodationTotal: accommodationTotal as ReturnType<typeof ugx>,
        eligibleCollected: eligibleCollected as ReturnType<typeof ugx>,
        completed: true,
      }),
    ).toThrow("whole non-negative UGX");
  });
});

describe("Net Collected Booking Revenue", () => {
  it("excludes non-accommodation money, refunds, and assigned processing charges", () => {
    expect(
      calculateNetCollectedBookingRevenue({
        accommodationTotal: ugx(1_000_000),
        collected: ugx(1_350_000),
        cleaningFeesCollected: ugx(100_000),
        guestTaxesCollected: ugx(80_000),
        refundableDepositsCollected: ugx(120_000),
        accommodationRefunds: ugx(40_000),
        accommodationProcessingCharges: ugx(10_000),
      }),
    ).toBe(1_000_000);
  });

  it("never returns a negative eligible base", () => {
    expect(
      calculateNetCollectedBookingRevenue({
        accommodationTotal: ugx(500_000),
        collected: ugx(100_000),
        cleaningFeesCollected: ugx(30_000),
        guestTaxesCollected: ugx(20_000),
        refundableDepositsCollected: ugx(10_000),
        accommodationRefunds: ugx(50_000),
        accommodationProcessingCharges: ugx(15_000),
      }),
    ).toBe(0);
  });
});
