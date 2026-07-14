import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
import { buildFinancialReport } from "../../src/domain/accounting";

const fixture=JSON.parse(readFileSync(new URL("../../fixtures/easyaccounts-coverage.json",import.meta.url),"utf8"));
describe("Easy Accounts workbook coverage",()=>{it("preserves every relevant workbook label",()=>{expect(fixture.transactionLabels).toHaveLength(59);expect(fixture.statementLabels).toHaveLength(72);for(const label of ["Cash sales","Credit purchases","Pension Funds due","Owner's (or shareholders') equity","Acid test (quick ratio)","Net Profit Margin"])expect([...fixture.transactionLabels,...fixture.statementLabels]).toContain(label);});it("reconciles the workbook-derived scenario",()=>{const report=buildFinancialReport(fixture.scenario.input);expect(report.incomeStatement.revenue).toBe(fixture.scenario.expected.revenue);expect(report.incomeStatement.netIncome).toBe(fixture.scenario.expected.netIncome);expect(report.balanceSheet.totalAssets).toBe(report.balanceSheet.totalLiabilitiesAndEquity);expect(report.cashFlow.closingCash).toBe(fixture.scenario.expected.closingCash);});});
