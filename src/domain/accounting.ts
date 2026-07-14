import { ugx } from "./money";
import type { Ugx } from "./types";

export type MetricResult = { state:"available";value:number } | { state:"unavailable";reason:string };
export interface FinancialReportInput {
  cashSales:number; creditSales:number; cashPurchases:number; creditPurchases:number;
  operatingExpenses:Readonly<Record<string,number>>; financialExpenses:number; taxExpense:number;
  cash:number; longTermDeposits:number; receivables:number; inventory:number; fixedAssets:number;
  currentLiabilities:number; nonCurrentLiabilities:number; ownerEquity:number; drawings:number;
  openingCash:number; cashReceipts:number; cashPayments:number; fixedCosts:number; variableCosts:number;
}
export interface FinancialReport {
  incomeStatement:{revenue:Ugx;purchases:Ugx;grossProfit:Ugx;operatingExpenses:Ugx;financialExpenses:Ugx;profitBeforeTax:Ugx;taxExpense:Ugx;netIncome:Ugx};
  balanceSheet:{currentAssets:Ugx;fixedAssets:Ugx;totalAssets:Ugx;currentLiabilities:Ugx;nonCurrentLiabilities:Ugx;totalLiabilities:Ugx;equity:Ugx;totalLiabilitiesAndEquity:Ugx;difference:number};
  cashFlow:{openingCash:Ugx;cashReceipts:Ugx;cashPayments:Ugx;netChange:Ugx;closingCash:Ugx};
  breakEven:MetricResult;
  ratios:{inventoryTurnover:MetricResult;receivablesTurnover:MetricResult;currentRatio:MetricResult;quickRatio:MetricResult;debtToAssets:MetricResult;debtToEquity:MetricResult;returnOnAssets:MetricResult;returnOnEquity:MetricResult;workingCapital:MetricResult;netProfitMargin:MetricResult};
}

function amount(value:number,label:string):number { if(!Number.isSafeInteger(value))throw new Error(`${label} must be a whole safe-integer UGX amount.`);return value; }
function sum(values:readonly number[]):number{return values.reduce((total,value)=>total+value,0);}
function ratio(numerator:number,denominator:number,reason:string):MetricResult{return denominator===0?{state:"unavailable",reason}:{state:"available",value:numerator/denominator};}

export function buildFinancialReport(input:FinancialReportInput):FinancialReport {
  for(const [label,value] of Object.entries(input))if(typeof value==="number")amount(value,label);
  for(const [label,value] of Object.entries(input.operatingExpenses))amount(value,label);
  const revenue=input.cashSales+input.creditSales,purchases=input.cashPurchases+input.creditPurchases;
  const operating=sum(Object.values(input.operatingExpenses)),grossProfit=revenue-purchases;
  const profitBeforeTax=grossProfit-operating-input.financialExpenses,netIncome=profitBeforeTax-input.taxExpense;
  const currentAssets=input.cash+input.receivables+input.inventory;
  const totalAssets=currentAssets+input.longTermDeposits+input.fixedAssets;
  const totalLiabilities=input.currentLiabilities+input.nonCurrentLiabilities;
  const equity=input.ownerEquity+netIncome-input.drawings;
  const totalLiabilitiesAndEquity=totalLiabilities+equity;
  const netChange=input.cashReceipts-input.cashPayments,closingCash=input.openingCash+netChange;
  const contribution=revenue-input.variableCosts;
  const breakEven=revenue===0?{state:"unavailable" as const,reason:"Revenue is zero"}:contribution<=0?{state:"unavailable" as const,reason:"Contribution margin is not positive"}:{state:"available" as const,value:input.fixedCosts/(contribution/revenue)};
  return {
    incomeStatement:{revenue:ugx(revenue),purchases:ugx(purchases),grossProfit:ugx(grossProfit),operatingExpenses:ugx(operating),financialExpenses:ugx(input.financialExpenses),profitBeforeTax:ugx(profitBeforeTax),taxExpense:ugx(input.taxExpense),netIncome:ugx(netIncome)},
    balanceSheet:{currentAssets:ugx(currentAssets),fixedAssets:ugx(input.longTermDeposits+input.fixedAssets),totalAssets:ugx(totalAssets),currentLiabilities:ugx(input.currentLiabilities),nonCurrentLiabilities:ugx(input.nonCurrentLiabilities),totalLiabilities:ugx(totalLiabilities),equity:ugx(equity),totalLiabilitiesAndEquity:ugx(totalLiabilitiesAndEquity),difference:totalAssets-totalLiabilitiesAndEquity},
    cashFlow:{openingCash:ugx(input.openingCash),cashReceipts:ugx(input.cashReceipts),cashPayments:ugx(input.cashPayments),netChange:ugx(netChange),closingCash:ugx(closingCash)},breakEven,
    ratios:{inventoryTurnover:ratio(purchases,input.inventory,"Inventory is zero"),receivablesTurnover:ratio(revenue,input.receivables,"Receivables are zero"),currentRatio:ratio(currentAssets,input.currentLiabilities,"Current liabilities are zero"),quickRatio:ratio(currentAssets-input.inventory,input.currentLiabilities,"Current liabilities are zero"),debtToAssets:ratio(totalLiabilities,totalAssets,"Total assets are zero"),debtToEquity:ratio(totalLiabilities,equity,"Equity is zero"),returnOnAssets:ratio(netIncome,totalAssets,"Total assets are zero"),returnOnEquity:ratio(netIncome,equity,"Equity is zero"),workingCapital:{state:"available",value:currentAssets-input.currentLiabilities},netProfitMargin:ratio(netIncome,revenue,"Revenue is zero")},
  };
}
