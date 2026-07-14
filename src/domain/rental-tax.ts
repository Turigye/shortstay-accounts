import { ugx } from "./money";
import type { Ugx } from "./types";

export const RENTAL_TAX_RATE_PERCENT = 12;
export const RENTAL_TAX_ANNUAL_THRESHOLD = 2_820_000 as Ugx;

function requireInputs(activeUnitCount: number, monthlyRentalPerUnit: Ugx): void {
  if (!Number.isSafeInteger(activeUnitCount) || activeUnitCount < 0) {
    throw new Error("Active unit count must be a whole non-negative number.");
  }
  if (!Number.isSafeInteger(monthlyRentalPerUnit) || monthlyRentalPerUnit < 0) {
    throw new Error("Monthly rental income must be a whole non-negative UGX amount.");
  }
}

export function calculateAnnualRentalIncome(
  activeUnitCount: number,
  monthlyRentalPerUnit: Ugx,
): Ugx {
  requireInputs(activeUnitCount, monthlyRentalPerUnit);
  return ugx(activeUnitCount * monthlyRentalPerUnit * 12);
}

export function calculateAnnualRentalTax(
  activeUnitCount: number,
  monthlyRentalPerUnit: Ugx,
): Ugx {
  const annualIncome = calculateAnnualRentalIncome(activeUnitCount, monthlyRentalPerUnit);
  const chargeableIncome = Math.max(0, annualIncome - RENTAL_TAX_ANNUAL_THRESHOLD);
  return ugx(Math.round(chargeableIncome * RENTAL_TAX_RATE_PERCENT / 100));
}

export function calculateMonthlyRentalTaxProvision(
  activeUnitCount: number,
  monthlyRentalPerUnit: Ugx,
): Ugx {
  return ugx(Math.round(calculateAnnualRentalTax(activeUnitCount, monthlyRentalPerUnit) / 12));
}
