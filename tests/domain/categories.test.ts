import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ASSET_CATEGORIES,
  EXPENSE_CATEGORIES,
  REPORT_RATIOS,
  type AssetCategoryId,
  type ExpenseCategoryId,
  type ReportRatioId,
} from "../../src/domain/categories";

const expenseIds = [
  "gas",
  "electricity",
  "water",
  "solar",
  "maintenance",
  "dstv",
  "netflix",
  "internet",
  "toiletries",
  "complimentaryTea",
  "complimentaryCoffee",
  "complimentarySugar",
  "complimentaryMilk",
  "otherGuestAmenities",
  "hospitalityServices",
  "housekeeping",
  "security",
  "propertyManagement",
  "salariesAndStaffAllocations",
  "travelCosts",
  "rent",
  "insurance",
  "officeSupplies",
  "advertisingAndMarketing",
  "fuel",
  "municipalFees",
  "otherOperatingExpenses",
  "interestPaid",
  "cashPurchases",
  "creditPurchases",
] as const;

describe("EXPENSE_CATEGORIES", () => {
  it("covers every client-note and retained workbook expense exactly once", () => {
    expect(EXPENSE_CATEGORIES.map((category) => category.id)).toEqual(expenseIds);
    expect(new Set(EXPENSE_CATEGORIES.map((category) => category.id)).size).toBe(
      EXPENSE_CATEGORIES.length,
    );
  });

  it("provides labels, groups, and default scopes for every category", () => {
    for (const category of EXPENSE_CATEGORIES) {
      expect(category.label).not.toBe("");
      expect(category.group).not.toBe("");
      expect(["unit", "shared"]).toContain(category.defaultScope);
    }
  });

  it("maps note and workbook duplicates to canonical categories through aliases", () => {
    const byId = Object.fromEntries(EXPENSE_CATEGORIES.map((category) => [category.id, category]));

    expect(byId.electricity.aliases).toEqual(
      expect.arrayContaining(["Yaka", "Yaka/electricity"]),
    );
    expect(byId.maintenance.aliases).toContain("Repairs and maintenance");
    expect(byId.internet.aliases).toContain("Phone and Internet");
    expect(byId.salariesAndStaffAllocations.aliases).toContain("Salaries");
    expect(byId.complimentaryTea.aliases).toContain("Tea");
  });

  it("derives the expense category ID type from the registry", () => {
    expectTypeOf<ExpenseCategoryId>().toEqualTypeOf<(typeof expenseIds)[number]>();
  });
});

describe("ASSET_CATEGORIES", () => {
  it("retains every workbook fixed-asset category", () => {
    expect(ASSET_CATEGORIES.map((category) => category.id)).toEqual([
      "furniture",
      "machinery",
      "equipment",
      "vehicles",
      "land",
      "buildings",
    ]);
    expect(ASSET_CATEGORIES.find(({ id }) => id === "buildings")?.aliases).toContain("Building");
  });

  it("derives the asset category ID type from the registry", () => {
    expectTypeOf<AssetCategoryId>().toEqualTypeOf<
      "furniture" | "machinery" | "equipment" | "vehicles" | "land" | "buildings"
    >();
  });
});

describe("REPORT_RATIOS", () => {
  it("includes all ten approved workbook ratios", () => {
    expect(REPORT_RATIOS.map((ratio) => ratio.id)).toEqual([
      "inventoryTurnover",
      "receivablesTurnover",
      "currentRatio",
      "quickRatio",
      "debtToAssets",
      "debtToEquity",
      "returnOnAssets",
      "returnOnEquity",
      "workingCapital",
      "netProfitMargin",
    ]);
    expect(new Set(REPORT_RATIOS.map((ratio) => ratio.id)).size).toBe(10);
  });

  it("preserves workbook ratio labels as aliases", () => {
    const byId = Object.fromEntries(REPORT_RATIOS.map((ratio) => [ratio.id, ratio]));

    expect(byId.quickRatio.aliases).toContain("Acid test (quick ratio)");
    expect(byId.debtToAssets.aliases).toContain("Debt on Assets");
    expect(byId.returnOnAssets.aliases).toContain("ROA (Return on Assets)");
  });

  it("derives the report ratio ID type from the registry", () => {
    expectTypeOf<ReportRatioId>().toEqualTypeOf<
      | "inventoryTurnover"
      | "receivablesTurnover"
      | "currentRatio"
      | "quickRatio"
      | "debtToAssets"
      | "debtToEquity"
      | "returnOnAssets"
      | "returnOnEquity"
      | "workingCapital"
      | "netProfitMargin"
    >();
  });
});
