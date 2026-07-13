export type ExpenseCategoryGroup =
  | "utilities"
  | "subscriptions"
  | "guestAmenities"
  | "propertyServices"
  | "staff"
  | "administration"
  | "occupancy"
  | "financial"
  | "purchases";

export type ExpenseDefaultScope = "unit" | "shared";

interface ExpenseCategoryDefinition {
  id: string;
  label: string;
  group: ExpenseCategoryGroup;
  defaultScope: ExpenseDefaultScope;
  aliases: readonly string[];
}

export const EXPENSE_CATEGORIES = [
  {
    id: "gas",
    label: "Gas",
    group: "utilities",
    defaultScope: "unit",
    aliases: [],
  },
  {
    id: "electricity",
    label: "Electricity",
    group: "utilities",
    defaultScope: "unit",
    aliases: ["Yaka", "Yaka/electricity"],
  },
  {
    id: "water",
    label: "Water",
    group: "utilities",
    defaultScope: "unit",
    aliases: [],
  },
  {
    id: "solar",
    label: "Solar",
    group: "utilities",
    defaultScope: "unit",
    aliases: [],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    group: "propertyServices",
    defaultScope: "unit",
    aliases: ["Repairs and maintenance"],
  },
  {
    id: "dstv",
    label: "DSTV",
    group: "subscriptions",
    defaultScope: "unit",
    aliases: [],
  },
  {
    id: "netflix",
    label: "Netflix",
    group: "subscriptions",
    defaultScope: "unit",
    aliases: [],
  },
  {
    id: "internet",
    label: "Internet",
    group: "subscriptions",
    defaultScope: "unit",
    aliases: ["Phone and Internet", "Phone and internet"],
  },
  {
    id: "toiletries",
    label: "Toiletries",
    group: "guestAmenities",
    defaultScope: "unit",
    aliases: [],
  },
  {
    id: "complimentaryTea",
    label: "Complimentary tea",
    group: "guestAmenities",
    defaultScope: "unit",
    aliases: ["Tea"],
  },
  {
    id: "complimentaryCoffee",
    label: "Complimentary coffee",
    group: "guestAmenities",
    defaultScope: "unit",
    aliases: ["Coffee"],
  },
  {
    id: "complimentarySugar",
    label: "Complimentary sugar",
    group: "guestAmenities",
    defaultScope: "unit",
    aliases: ["Sugar"],
  },
  {
    id: "complimentaryMilk",
    label: "Complimentary milk",
    group: "guestAmenities",
    defaultScope: "unit",
    aliases: ["Milk"],
  },
  {
    id: "otherGuestAmenities",
    label: "Other guest amenities",
    group: "guestAmenities",
    defaultScope: "unit",
    aliases: ["Complimentary amenities"],
  },
  {
    id: "hospitalityServices",
    label: "Hospitality services",
    group: "propertyServices",
    defaultScope: "unit",
    aliases: ["Hospitality"],
  },
  {
    id: "housekeeping",
    label: "Housekeeping",
    group: "propertyServices",
    defaultScope: "unit",
    aliases: [],
  },
  {
    id: "security",
    label: "Security",
    group: "propertyServices",
    defaultScope: "unit",
    aliases: [],
  },
  {
    id: "propertyManagement",
    label: "Property management",
    group: "propertyServices",
    defaultScope: "unit",
    aliases: [],
  },
  {
    id: "salariesAndStaffAllocations",
    label: "Salaries and staff allocations",
    group: "staff",
    defaultScope: "shared",
    aliases: ["Salaries"],
  },
  {
    id: "travelCosts",
    label: "Travel costs",
    group: "administration",
    defaultScope: "shared",
    aliases: [],
  },
  {
    id: "rent",
    label: "Rent",
    group: "occupancy",
    defaultScope: "unit",
    aliases: [],
  },
  {
    id: "insurance",
    label: "Insurance",
    group: "occupancy",
    defaultScope: "unit",
    aliases: [],
  },
  {
    id: "officeSupplies",
    label: "Office supplies",
    group: "administration",
    defaultScope: "shared",
    aliases: [],
  },
  {
    id: "advertisingAndMarketing",
    label: "Advertising and marketing",
    group: "administration",
    defaultScope: "shared",
    aliases: [],
  },
  {
    id: "fuel",
    label: "Fuel",
    group: "administration",
    defaultScope: "shared",
    aliases: [],
  },
  {
    id: "municipalFees",
    label: "Municipal fees",
    group: "occupancy",
    defaultScope: "unit",
    aliases: ["Municipal Fees"],
  },
  {
    id: "otherOperatingExpenses",
    label: "Other operating expenses",
    group: "administration",
    defaultScope: "shared",
    aliases: ["Other Operating Expenses"],
  },
  {
    id: "interestPaid",
    label: "Interest paid",
    group: "financial",
    defaultScope: "shared",
    aliases: ["Interest Paid"],
  },
  {
    id: "cashPurchases",
    label: "Cash purchases",
    group: "purchases",
    defaultScope: "shared",
    aliases: [],
  },
  {
    id: "creditPurchases",
    label: "Credit purchases",
    group: "purchases",
    defaultScope: "shared",
    aliases: [],
  },
] as const satisfies readonly ExpenseCategoryDefinition[];

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];

interface AssetCategoryDefinition {
  id: string;
  label: string;
  aliases: readonly string[];
}

export const ASSET_CATEGORIES = [
  { id: "furniture", label: "Furniture", aliases: [] },
  { id: "machinery", label: "Machinery", aliases: [] },
  { id: "equipment", label: "Equipment", aliases: [] },
  { id: "vehicles", label: "Vehicles", aliases: ["Vehicle"] },
  { id: "land", label: "Land", aliases: [] },
  { id: "buildings", label: "Buildings", aliases: ["Building"] },
] as const satisfies readonly AssetCategoryDefinition[];

export type AssetCategoryId = (typeof ASSET_CATEGORIES)[number]["id"];
export type CategoryId = ExpenseCategoryId | AssetCategoryId;

export type ReportRatioGroup = "activity" | "liquidity" | "debt" | "profitability" | "other";

interface ReportRatioDefinition {
  id: string;
  label: string;
  group: ReportRatioGroup;
  aliases: readonly string[];
}

export const REPORT_RATIOS = [
  {
    id: "inventoryTurnover",
    label: "Inventory turnover",
    group: "activity",
    aliases: ["Inventory Turnover"],
  },
  {
    id: "receivablesTurnover",
    label: "Receivables turnover",
    group: "activity",
    aliases: ["Receivables Turnover"],
  },
  {
    id: "currentRatio",
    label: "Current ratio",
    group: "liquidity",
    aliases: [],
  },
  {
    id: "quickRatio",
    label: "Quick ratio",
    group: "liquidity",
    aliases: ["Acid test (quick ratio)"],
  },
  {
    id: "debtToAssets",
    label: "Debt to assets",
    group: "debt",
    aliases: ["Debt on Assets"],
  },
  {
    id: "debtToEquity",
    label: "Debt to equity",
    group: "debt",
    aliases: ["Debt-equity ratio"],
  },
  {
    id: "returnOnAssets",
    label: "Return on assets",
    group: "profitability",
    aliases: ["ROA (Return on Assets)"],
  },
  {
    id: "returnOnEquity",
    label: "Return on equity",
    group: "profitability",
    aliases: ["ROE (Return on Equity)"],
  },
  {
    id: "workingCapital",
    label: "Working capital",
    group: "other",
    aliases: ["Working Capital"],
  },
  {
    id: "netProfitMargin",
    label: "Net profit margin",
    group: "other",
    aliases: ["Net Profit Margin"],
  },
] as const satisfies readonly ReportRatioDefinition[];

export type ReportRatioId = (typeof REPORT_RATIOS)[number]["id"];
