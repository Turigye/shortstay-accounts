// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  guideChapters,
  guideChecklists,
  glossaryEntries,
  tourDefinitions,
} from "../../src/renderer/guidance/guide-content";
import {
  createInitialProgress,
  searchGuide,
} from "../../src/renderer/guidance/guide-search";

const tourTargetManifest = {
  today: ["sidebar", "today-summary", "quick-actions", "lock"],
  bookings: ["booking-action", "booking-editor", "booking-status", "booking-archive"],
  payments: ["payment-action", "payment-balance", "payment-history"],
  expenses: ["expense-action"],
  staff: ["staff-base", "staff-rates", "referral-earnings", "calculation-trace"],
  "financial-position": ["position-summary", "position-balances", "month-end", "reopen-period"],
  reports: ["report-period", "report-tabs"],
  settings: ["tax-guidance", "excel-export", "unit-settings", "effective-rates", "backup", "restore", "security"],
} as const;

const targetSourceFiles: Record<string, string> = {
  sidebar: "src/renderer/components/AppShell.tsx",
  "quick-actions": "src/renderer/components/AppShell.tsx",
  lock: "src/renderer/components/AppShell.tsx",
  "today-summary": "src/renderer/screens/TodayScreen.tsx",
  "booking-action": "src/renderer/screens/BookingsScreen.tsx",
  "booking-editor": "src/renderer/screens/BookingsScreen.tsx",
  "booking-status": "src/renderer/screens/BookingsScreen.tsx",
  "booking-archive": "src/renderer/screens/BookingsScreen.tsx",
  "payment-action": "src/renderer/screens/PaymentsScreen.tsx",
  "payment-balance": "src/renderer/components/BookingBalance.tsx",
  "payment-history": "src/renderer/screens/PaymentsScreen.tsx",
  "expense-action": "src/renderer/screens/ExpensesScreen.tsx",
  "staff-base": "src/renderer/screens/StaffScreen.tsx",
  "staff-rates": "src/renderer/screens/StaffScreen.tsx",
  "referral-earnings": "src/renderer/screens/StaffScreen.tsx",
  "calculation-trace": "src/renderer/components/CalculationTrace.tsx",
  "position-summary": "src/renderer/screens/FinancialPositionScreen.tsx",
  "position-balances": "src/renderer/screens/FinancialPositionScreen.tsx",
  "month-end": "src/renderer/screens/FinancialPositionScreen.tsx",
  "reopen-period": "src/renderer/screens/FinancialPositionScreen.tsx",
  "report-period": "src/renderer/screens/ReportsScreen.tsx",
  "report-tabs": "src/renderer/screens/ReportsScreen.tsx",
  "tax-guidance": "src/renderer/screens/SettingsScreen.tsx",
  "excel-export": "src/renderer/screens/SettingsScreen.tsx",
  "unit-settings": "src/renderer/screens/SettingsScreen.tsx",
  "effective-rates": "src/renderer/screens/SettingsScreen.tsx",
  backup: "src/renderer/screens/SettingsScreen.tsx",
  restore: "src/renderer/screens/SettingsScreen.tsx",
  security: "src/renderer/screens/SettingsScreen.tsx",
};

const dynamicTargetMarkers: Partial<Record<string, readonly string[]>> = {
  "reopen-period": ['data-tour={item==="month-end"?"reopen-period":undefined}'],
  "tax-guidance": ["data-tour={tabTourTargets[id]}", 'tax: "tax-guidance"'],
  "excel-export": ["data-tour={tabTourTargets[id]}", 'backup: "excel-export"'],
  "effective-rates": ["data-tour={tabTourTargets[id]}", 'compensation: "effective-rates"'],
  security: ["data-tour={tabTourTargets[id]}", 'security: "security"'],
};

describe("beginner guide content", () => {
  it("defines seven complete learning chapters and tours", () => {
    expect(guideChapters).toHaveLength(7);
    expect(tourDefinitions).toHaveLength(7);
    expect(tourDefinitions.every((tour) => tour.steps.length >= 3 && tour.steps.length <= 7)).toBe(true);
  });

  it("finds tax guidance by meaning and states the approved formula", () => {
    const results = searchGuide("rental tax threshold");

    expect(results[0]?.searchText).toContain("12%");
    expect(results[0]?.searchText).toContain("2,820,000");
    expect(results[0]?.searchText).toContain("600,000");
  });

  it("keeps case-insensitive search stable across uppercase and lowercase queries", () => {
    expect(searchGuide("IT LEGAL").map((result) => result.id)).toEqual(
      searchGuide("it legal").map((result) => result.id),
    );
  });

  it("includes daily, booking, weekly, month-end, and recovery checklists", () => {
    expect(guideChecklists.map((item) => item.id)).toEqual(["daily", "booking", "weekly", "month-end", "recovery"]);
    expect(glossaryEntries.length).toBeGreaterThan(20);
  });

  it("creates versioned empty local progress", () => {
    expect(createInitialProgress()).toEqual({
      version: 1,
      welcomeDismissed: false,
      completedTourIds: [],
      completedChapterIds: [],
    });
  });

  it("keeps every tour target mapped to one stable, live screen control", () => {
    const targetsByScreen = Object.fromEntries(
      [...new Set(tourDefinitions.flatMap((tour) => tour.steps.map((step) => step.screen)))].map((screen) => [
        screen,
        tourDefinitions.flatMap((tour) => tour.steps)
          .filter((step) => step.screen === screen)
          .map((step) => step.target),
      ]),
    );
    const manifestTargets = Object.values(tourTargetManifest).flat();

    expect(targetsByScreen).toEqual(tourTargetManifest);
    expect(manifestTargets).toHaveLength(new Set(manifestTargets).size);
    expect(manifestTargets.every((target) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target))).toBe(true);
    expect(Object.keys(targetSourceFiles).sort()).toEqual([...manifestTargets].sort());

    for (const target of manifestTargets) {
      const source = readFileSync(resolve(process.cwd(), targetSourceFiles[target]), "utf8");
      for (const marker of dynamicTargetMarkers[target] ?? [`data-tour="${target}"`]) {
        expect(source).toContain(marker);
      }
    }
  });
});
