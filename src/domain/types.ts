export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type Ugx = Brand<number, "UGX">;
export type MonthKey = `${number}-${string}`;

export type BusinessId = Brand<string, "BusinessId">;
export type UnitId = Brand<string, "UnitId">;
export type CustomerId = Brand<string, "CustomerId">;
export type BookingId = Brand<string, "BookingId">;
export type PaymentId = Brand<string, "PaymentId">;
export type ExpenseId = Brand<string, "ExpenseId">;
export type SupplierId = Brand<string, "SupplierId">;
export type AccountId = Brand<string, "AccountId">;
export type AssetId = Brand<string, "AssetId">;

export type RoleKey =
  | "operations"
  | "salesMarketing"
  | "finance"
  | "itLegal"
  | "security"
  | "ceo";

export type BookingStatus =
  | "draft"
  | "confirmed"
  | "checkedIn"
  | "completed"
  | "cancelled";

export type PaymentState =
  | "unpaid"
  | "partiallyPaid"
  | "fullyPaid"
  | "overpaid"
  | "partiallyRefunded"
  | "fullyRefunded";

export interface MonthNightAllocation {
  month: MonthKey;
  nights: number;
}

export interface BusinessSettings {
  businessId: string;
  name: string;
  currency: "UGX";
  unitIds: string[];
  units: BusinessUnit[];
  staffRates: Record<RoleKey, number>;
  referralRate: number;
  taxProvisionPerUnit: Ugx;
  closedMonths: string[];
  rateHistory: {
    staff: StaffRateSetting[];
    referral: RateSetting[];
    taxProvision: RateSetting[];
  };
}

export interface BusinessUnit {
  id: string;
  name: string;
  status: "active" | "inactive";
}

export interface RateSetting {
  id: string;
  value: number;
  effectiveFrom: string;
  reason: string | null;
}

export interface StaffRateSetting extends RateSetting {
  role: RoleKey;
}

export interface BookingBalanceSummary {
  received: Ugx;
  refunded: Ugx;
  netReceived: Ugx;
  due: Ugx;
  state: PaymentState;
}

export interface StayMonthAllocation {
  month: MonthKey;
  earnedRevenue: Ugx;
  payableBase: Ugx;
}

export interface StaffEarning {
  month: MonthKey;
  role: RoleKey;
  base: Ugx;
  rate: number;
  amount: Ugx;
}

export type RatioResult =
  | { state: "available"; value: number }
  | { state: "unavailable"; reason: string };

export interface FinancialReport {
  incomeStatement: {
    revenue: Ugx;
    purchases: Ugx;
    grossProfit: Ugx;
    operatingAndFinancialExpenses: Ugx;
    taxExpense: Ugx;
    profitBeforeTax: Ugx;
    netIncome: Ugx;
  };
  balanceSheet: {
    currentAssets: Ugx;
    fixedAssets: Ugx;
    totalAssets: Ugx;
    currentLiabilities: Ugx;
    nonCurrentLiabilities: Ugx;
    equity: Ugx;
    totalLiabilitiesAndEquity: Ugx;
  };
  cashFlow: { openingCash: Ugx; netMovement: Ugx; closingCash: Ugx };
  breakEven: RatioResult;
  ratios: Record<string, RatioResult>;
}
