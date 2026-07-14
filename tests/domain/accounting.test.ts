import { describe,expect,it } from "vitest";
import { buildFinancialReport,type FinancialReportInput } from "../../src/domain/accounting";

const base:FinancialReportInput={cashSales:8_000_000,creditSales:2_000_000,cashPurchases:1_200_000,creditPurchases:800_000,operatingExpenses:{salaries:3_700_000,utilities:500_000,maintenance:300_000},financialExpenses:100_000,taxExpense:1_200_000,cash:5_000_000,longTermDeposits:2_000_000,receivables:1_000_000,inventory:500_000,fixedAssets:10_000_000,currentLiabilities:2_000_000,nonCurrentLiabilities:5_000_000,ownerEquity:9_300_000,drawings:0,openingCash:1_000_000,cashReceipts:8_000_000,cashPayments:4_000_000,fixedCosts:4_500_000,variableCosts:2_000_000};
describe("financial reporting",()=>{
 it("builds reconciled statements from one source",()=>{const report=buildFinancialReport(base);expect(report.balanceSheet.totalAssets).toBe(report.balanceSheet.totalLiabilitiesAndEquity);expect(report.incomeStatement.netIncome).toBe(report.incomeStatement.profitBeforeTax-report.incomeStatement.taxExpense);expect(report.cashFlow.closingCash).toBe(5_000_000);expect(report.breakEven).toEqual({state:"available",value:5_625_000});});
 it("returns explained unavailable ratios",()=>{const report=buildFinancialReport({...base,currentLiabilities:0,receivables:0,inventory:0});expect(report.ratios.currentRatio).toEqual({state:"unavailable",reason:"Current liabilities are zero"});expect(report.ratios.receivablesTurnover).toEqual({state:"unavailable",reason:"Receivables are zero"});});
});
