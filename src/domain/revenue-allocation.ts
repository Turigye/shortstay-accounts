import { ugx } from "./money";
import { splitStayByMonth } from "./periods";
import type { StayMonthAllocation, Ugx } from "./types";

export interface EligibleCollectionInput {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly accommodationTotal: Ugx;
  readonly eligibleCollected: Ugx;
  readonly completed: boolean;
}

export interface NetCollectedBookingRevenueInput {
  readonly accommodationTotal: Ugx;
  readonly collected: Ugx;
  readonly cleaningFeesCollected?: Ugx;
  readonly guestTaxesCollected?: Ugx;
  readonly refundableDepositsCollected?: Ugx;
  readonly accommodationRefunds?: Ugx;
  readonly accommodationProcessingCharges?: Ugx;
}

function wholeNonNegative(value: number): Ugx {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Amounts must use whole non-negative UGX.");
  }
  return ugx(value);
}

function checkedSum(values: readonly number[]): Ugx {
  return wholeNonNegative(
    values.reduce((sum, value) => {
      wholeNonNegative(value);
      const next = sum + value;
      if (!Number.isSafeInteger(next)) {
        throw new Error("Amounts must use whole non-negative UGX.");
      }
      return next;
    }, 0),
  );
}

export function calculateNetCollectedBookingRevenue(
  input: NetCollectedBookingRevenueInput,
): Ugx {
  const accommodationTotal = wholeNonNegative(input.accommodationTotal);
  const collected = wholeNonNegative(input.collected);
  const exclusions = checkedSum([
    input.cleaningFeesCollected ?? 0,
    input.guestTaxesCollected ?? 0,
    input.refundableDepositsCollected ?? 0,
    input.accommodationRefunds ?? 0,
    input.accommodationProcessingCharges ?? 0,
  ]);
  return ugx(Math.min(accommodationTotal, Math.max(0, collected - exclusions)));
}

function allocateAmount(total: Ugx, nights: readonly number[]): Ugx[] {
  const totalNights = nights.reduce((sum, value) => sum + value, 0);
  const shares = nights.map((monthNights, index) => {
    const exact = total * (monthNights / totalNights);
    return { index, amount: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let residual = total - shares.reduce((sum, share) => sum + share.amount, 0);
  const residualOrder = [...shares].sort(
    (left, right) => right.fraction - left.fraction || left.index - right.index,
  );
  for (let index = 0; residual > 0; index += 1, residual -= 1) {
    residualOrder[index % residualOrder.length]!.amount += 1;
  }
  return shares.sort((left, right) => left.index - right.index).map(({ amount }) => ugx(amount));
}

export function allocateEligibleCollection(
  input: EligibleCollectionInput,
): StayMonthAllocation[] {
  const accommodationTotal = wholeNonNegative(input.accommodationTotal);
  const eligibleCollected = wholeNonNegative(input.eligibleCollected);
  const occupiedMonths = splitStayByMonth(input.checkIn, input.checkOut);
  const eligibleTotal = input.completed
    ? ugx(Math.min(accommodationTotal, eligibleCollected))
    : ugx(0);
  const earned = allocateAmount(input.completed ? accommodationTotal : ugx(0), occupiedMonths.map(({ nights }) => nights));
  const payable = allocateAmount(eligibleTotal, occupiedMonths.map(({ nights }) => nights));

  return occupiedMonths.map(({ month }, index) => ({
    month,
    earnedRevenue: earned[index] ?? ugx(0),
    payableBase: payable[index] ?? ugx(0),
  }));
}
