import { ugx } from "./money";
import type { MonthKey, RoleKey, StaffEarning, Ugx } from "./types";

export const DEFAULT_STAFF_RATES = {
  operations: 5,
  salesMarketing: 5,
  finance: 10,
  itLegal: 2,
  security: 5,
  ceo: 10,
} as const satisfies Readonly<Record<RoleKey, number>>;

export const STAFF_ROLE_ORDER = Object.freeze([
  "operations",
  "salesMarketing",
  "finance",
  "itLegal",
  "security",
  "ceo",
] as const satisfies readonly RoleKey[]);

function validBase(base: number): Ugx {
  if (!Number.isSafeInteger(base) || base < 0) {
    throw new Error("The compensation base must use whole non-negative UGX.");
  }
  return ugx(base);
}

function validRate(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error("The percentage must be between 0 and 100.");
  }
  return rate;
}

export function percentageOf(base: Ugx, rate: number): Ugx {
  return ugx(Math.round(validBase(base) * (validRate(rate) / 100)));
}

export function calculateCompensation(
  baseInput: Ugx,
  rates: Readonly<Record<RoleKey, number>>,
  month?: MonthKey,
): StaffEarning[] {
  const base = validBase(baseInput);
  const normalizedRates = STAFF_ROLE_ORDER.map((role) => validRate(rates[role]));
  const totalRate = normalizedRates.reduce((sum, rate) => sum + rate, 0);
  const targetValue = Math.round(base * (totalRate / 100));
  if (!Number.isSafeInteger(targetValue) || targetValue < 0) {
    throw new Error("The combined staff amount is outside the supported UGX range.");
  }

  const amounts = normalizedRates.map((rate) => percentageOf(base, rate));
  let residual = targetValue - amounts.reduce((sum, amount) => sum + amount, 0);
  if (residual >= 0) {
    amounts[amounts.length - 1] = ugx((amounts.at(-1) ?? 0) + residual);
  } else {
    for (let index = amounts.length - 1; index >= 0 && residual < 0; index -= 1) {
      const reduction = Math.min(amounts[index] ?? 0, -residual);
      amounts[index] = ugx((amounts[index] ?? 0) - reduction);
      residual += reduction;
    }
  }

  return STAFF_ROLE_ORDER.map((role, index) => ({
    ...(month ? { month } : {}),
    role,
    base,
    rate: normalizedRates[index] ?? 0,
    amount: amounts[index] ?? ugx(0),
  }));
}

export function calculateReferral(base: Ugx, rate: number): Ugx {
  return percentageOf(base, rate);
}
