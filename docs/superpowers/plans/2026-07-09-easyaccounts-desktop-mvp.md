# EasyAccounts Desktop MVP Implementation Plan (Superseded)

> Superseded by `docs/superpowers/plans/2026-07-13-short-stay-accounting-desktop.md`, which incorporates the approved client note, two-unit short-stay workflow, percentage compensation, manual tax provision, and complete workbook coverage.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fast, private, local-first Windows and macOS Electron desktop app that transforms the official Uganda Easy Accounts spreadsheet workflow into a simpler guided accounting product for micro and small businesses.

**Architecture:** Use Electron as the native shell, React/Vite for the renderer, a typed IPC boundary between renderer and main process, and a local encrypted SQLite database stored in the user's app data directory. Keep the accounting engine pure TypeScript so spreadsheet-equivalent formulas can be tested without Electron, reused for reports, and validated against workbook-derived fixtures.

**Tech Stack:** Electron 43.1.0, Electron Forge 7.11.2, Vite 8.1.4, React 19.2.7, TypeScript, Vitest 4.1.10, Playwright 1.61.1, better-sqlite3-multiple-ciphers 12.11.1, Drizzle ORM 0.45.2, Zod 4.4.3, Zustand 5.0.14, Recharts 3.9.2, Lucide React 1.23.0, PapaParse 5.5.4, SheetJS xlsx 0.18.5.

## Global Constraints

- Target platforms: Windows and macOS desktop via Electron.
- Privacy position: financial data is local-first; no cloud account is required for core bookkeeping.
- Telemetry position: no analytics, usage tracking, or automatic financial-data upload in the MVP.
- Product position: surpass the official Easy Accounts workflow in simplicity, functionality, speed, and ease of use.
- Uganda focus: default currency is UGX; terminology follows the Easy Accounts spreadsheet categories.
- Spreadsheet source: `/Users/turigyemicheal/Downloads/easyaccounts.xlsx`.
- Official site source: `https://uganda.easyaccounts.org/`.
- The official web app uses login/register flows and a server-hosted Keycloak identity layer; this MVP must open directly into local books.
- The official spreadsheet contains two sheets: `Transactions` and `FInancial Statements`.
- The MVP must preserve the official workbook's core monthly categories: sales, purchases, operating expenses, financial expenses, cash and banks, receivables, inventory, liabilities, fixed assets, income statement, balance sheet, cash flow, break-even, and ratios.
- If tax formulas are added, they must be versioned by tax year and backed by a cited Uganda tax source before implementation.
- Accessibility: all interactive controls must be keyboard reachable and must expose useful labels.
- UI style: desktop work app, dense but readable, no marketing landing page as the first screen.

---

## Research Summary

- User intent from the pasted Gemini conversation: build a private desktop software product from the Easy Accounts spreadsheet idea because cloud/government storage of financial data feels uncomfortable.
- Official Easy Accounts value proposition: simplified monthly questionnaire, automatic financial statements, tax simulation guidance, and training for MSMEs.
- Official web platform reality: server login/register, public site shell, Google Analytics script on the homepage, and dynamic app content.
- Official offline workbook reality: two-sheet Excel workbook with monthly columns and formulas; it is small enough to translate into a tested TypeScript engine.
- Competitive gap: QuickBooks, Xero, and Wave emphasize automation, invoices, bank reconciliation, payments, and reporting, but they are cloud-first and too broad for many Ugandan microbusiness owners.
- Product wedge: "spreadsheet-simple, local-private, Uganda-tailored, import-friendly, and accountant-readable."

## Product Shape

The MVP has seven user-facing areas:

1. **Open Book:** create or unlock a local encrypted business file.
2. **Dashboard:** this month revenue, expenses, net income, cash, receivables, payables, and warnings.
3. **Guided Entry:** a monthly questionnaire that mirrors Easy Accounts but asks plain business questions.
4. **Transactions:** optional CSV import from bank/mobile money statements with quick categorization.
5. **Reports:** income statement, balance sheet, cash flow, break-even, and ratios.
6. **Exports:** Excel workbook export and PDF-ready print views.
7. **Settings:** business profile, currency, fiscal year, category rules, backup/export.

## File Structure

- `package.json` - scripts, dependencies, build metadata.
- `tsconfig.json` - shared TypeScript settings.
- `tsconfig.node.json` - Electron main/preload TypeScript settings.
- `vite.config.ts` - renderer Vite config.
- `forge.config.ts` - Electron Forge packaging config for Windows/macOS.
- `src/main/main.ts` - Electron lifecycle and BrowserWindow creation.
- `src/main/ipc.ts` - typed IPC handler registration.
- `src/main/security.ts` - app security defaults and navigation guards.
- `src/main/db/connection.ts` - encrypted SQLite connection factory.
- `src/main/db/schema.ts` - Drizzle schema for businesses, periods, entries, imports, rules.
- `src/main/db/repositories.ts` - persistence API used by IPC handlers.
- `src/preload/index.ts` - safe renderer API bridge.
- `src/preload/types.ts` - renderer-visible API type declarations.
- `src/shared/ipc-contract.ts` - Zod schemas and TypeScript types for IPC calls.
- `src/shared/money.ts` - UGX-safe integer money helpers.
- `src/shared/months.ts` - month keys and fiscal-period helpers.
- `src/domain/categories.ts` - Easy Accounts categories and labels.
- `src/domain/financial-engine.ts` - pure functions that calculate statements and ratios.
- `src/domain/import-classifier.ts` - deterministic CSV categorization rules.
- `src/domain/export-workbook.ts` - Excel export adapter.
- `src/renderer/App.tsx` - top-level layout and routing.
- `src/renderer/main.tsx` - React bootstrap.
- `src/renderer/styles.css` - desktop UI styling.
- `src/renderer/store/book-store.ts` - Zustand store for active business, period, reports.
- `src/renderer/components/Shell.tsx` - sidebar, header, content layout.
- `src/renderer/screens/OpenBookScreen.tsx` - create/unlock local business file.
- `src/renderer/screens/DashboardScreen.tsx` - KPI dashboard.
- `src/renderer/screens/MonthlyEntryScreen.tsx` - guided questionnaire.
- `src/renderer/screens/TransactionsScreen.tsx` - import and categorize statements.
- `src/renderer/screens/ReportsScreen.tsx` - statement and ratio views.
- `src/renderer/screens/SettingsScreen.tsx` - profile, rules, backup/export.
- `src/renderer/components/MoneyInput.tsx` - currency input storing cents.
- `src/renderer/components/PeriodPicker.tsx` - month/year selector.
- `src/renderer/components/ReportTable.tsx` - accessible financial statement table.
- `src/renderer/components/KpiCard.tsx` - compact dashboard KPI.
- `src/renderer/components/ImportReviewTable.tsx` - transaction review grid.
- `src/renderer/components/Charts.tsx` - Recharts wrappers for monthly trends.
- `tests/domain/financial-engine.test.ts` - spreadsheet-equivalent formula tests.
- `tests/domain/import-classifier.test.ts` - categorization tests.
- `tests/main/repositories.test.ts` - SQLite persistence tests.
- `tests/e2e/app.spec.ts` - Playwright smoke flow.
- `fixtures/easyaccounts-sample.json` - workbook-derived input and expected report values.
- `docs/research/easyaccounts-market-notes.md` - research notes, sources, and positioning.

---

### Task 1: Project Scaffold And Desktop Shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `forge.config.ts`
- Create: `index.html`
- Create: `src/main/main.ts`
- Create: `src/main/security.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/styles.css`

**Interfaces:**
- Produces: Electron app entry at `src/main/main.ts`.
- Produces: preload API namespace `window.easyAccounts`.
- Produces: renderer root component `App(): JSX.Element`.

- [ ] **Step 1: Write the scaffold files**

```json
{
  "name": "easyaccounts-desktop",
  "version": "0.1.0",
  "description": "Private local-first accounting for Ugandan micro and small businesses.",
  "main": ".vite/build/main.js",
  "type": "module",
  "scripts": {
    "dev": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit && tsc --project tsconfig.node.json --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "6.0.3",
    "better-sqlite3-multiple-ciphers": "12.11.1",
    "drizzle-orm": "0.45.2",
    "electron-squirrel-startup": "1.0.1",
    "lucide-react": "1.23.0",
    "papaparse": "5.5.4",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "recharts": "3.9.2",
    "xlsx": "0.18.5",
    "zod": "4.4.3",
    "zustand": "5.0.14"
  },
  "devDependencies": {
    "@electron-forge/cli": "7.11.2",
    "@electron-forge/maker-deb": "7.11.2",
    "@electron-forge/maker-dmg": "7.11.2",
    "@electron-forge/maker-rpm": "7.11.2",
    "@electron-forge/maker-squirrel": "7.11.2",
    "@electron-forge/maker-zip": "7.11.2",
    "@electron-forge/plugin-vite": "7.11.2",
    "@playwright/test": "1.61.1",
    "@types/node": "26.1.1",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "electron": "43.1.0",
    "typescript": "7.0.2",
    "vite": "8.1.4",
    "vitest": "4.1.10"
  }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src/renderer", "src/shared", "src/domain", "tests"]
}
```

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true,
    "types": ["node", "electron"]
  },
  "include": ["src/main", "src/preload", "src/shared", "src/domain", "forge.config.ts", "vite.config.ts"]
}
```

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
```

```ts
import type { ForgeConfig } from "@electron-forge/shared-types";
import { VitePlugin } from "@electron-forge/plugin-vite";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: "EasyAccounts",
    name: "EasyAccounts",
  },
  rebuildConfig: {},
  makers: [
    { name: "@electron-forge/maker-squirrel", config: {} },
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
    { name: "@electron-forge/maker-dmg", config: { format: "ULFO" } },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/main.ts",
          config: "vite.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/index.ts",
          config: "vite.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.config.ts",
        },
      ],
    }),
  ],
};

export default config;
```

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EasyAccounts</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

```ts
import { app, BrowserWindow } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applySecurityGuards } from "./security";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (started) {
  app.quit();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    title: "EasyAccounts",
    show: false,
    backgroundColor: "#f7f4ef",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  applySecurityGuards(mainWindow);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
```

```ts
import type { BrowserWindow } from "electron";
import { shell } from "electron";

export function applySecurityGuards(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const currentUrl = window.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
    }
  });
}
```

```ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("easyAccounts", {
  version: "0.1.0",
});
```

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

```tsx
export function App() {
  return (
    <main className="app-frame">
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <p className="eyebrow">Local-first books</p>
        <h1 id="welcome-title">EasyAccounts</h1>
        <p className="lede">Private Ugandan small-business accounting that opens straight into your work.</p>
      </section>
    </main>
  );
}
```

```css
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #24211d;
  background: #f7f4ef;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 1040px;
  min-height: 680px;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-frame {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
}

.welcome-panel {
  width: min(720px, 100%);
  border: 1px solid #d8d0c4;
  border-radius: 8px;
  background: #fffdf8;
  padding: 32px;
  box-shadow: 0 16px 44px rgba(36, 33, 29, 0.08);
}

.eyebrow {
  margin: 0 0 8px;
  color: #5f6f52;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0;
}

h1 {
  margin: 0;
  font-size: 42px;
  line-height: 1.05;
  letter-spacing: 0;
}

.lede {
  max-width: 560px;
  margin: 16px 0 0;
  color: #5b554d;
  font-size: 18px;
  line-height: 1.5;
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and install exits with code 0.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Run the app**

Run: `npm run dev`

Expected: Electron opens a window titled `EasyAccounts` with the local-first welcome panel.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts forge.config.ts index.html src
git commit -m "chore: scaffold electron desktop app"
```

---

### Task 2: Spreadsheet-Derived Financial Engine

**Files:**
- Create: `src/shared/money.ts`
- Create: `src/shared/months.ts`
- Create: `src/domain/categories.ts`
- Create: `src/domain/financial-engine.ts`
- Create: `fixtures/easyaccounts-sample.json`
- Create: `tests/domain/financial-engine.test.ts`

**Interfaces:**
- Produces: `type MonthKey = "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "jul" | "aug" | "sep" | "oct" | "nov" | "dec"`.
- Produces: `calculateAnnualReport(input: AnnualInputs): AnnualReport`.
- Produces: `calculateMonthReport(input: MonthInputs): MonthReport`.
- Consumes: no previous app runtime; pure TypeScript.

- [ ] **Step 1: Write the failing financial-engine test**

```ts
import { describe, expect, it } from "vitest";
import sample from "../../fixtures/easyaccounts-sample.json";
import { calculateAnnualReport } from "../../src/domain/financial-engine";

describe("calculateAnnualReport", () => {
  it("matches Easy Accounts workbook totals for a simple trading business", () => {
    const report = calculateAnnualReport(sample);

    expect(report.summary.revenue).toBe(120_000_000);
    expect(report.summary.expenses).toBe(83_100_000);
    expect(report.summary.netIncome).toBe(36_900_000);
    expect(report.balance.totalAssets).toBe(138_000_000);
    expect(report.balance.totalLiabilities).toBe(18_900_000);
    expect(report.balance.totalEquity).toBe(119_100_000);
    expect(report.balance.totalLiabilitiesAndEquity).toBe(138_000_000);
    expect(report.cashFlow).toBe(35_700_000);
    expect(report.ratios.currentRatio).toBeCloseTo(6.16, 2);
    expect(report.ratios.netProfitMargin).toBeCloseTo(30.75, 2);
  });
});
```

- [ ] **Step 2: Add the sample fixture**

```json
{
  "sales": {
    "cashSales": 90000000,
    "creditSales": 30000000
  },
  "purchases": {
    "cashPurchases": 42000000,
    "creditPurchases": 18000000
  },
  "operatingExpenses": {
    "salaries": 7200000,
    "travelCosts": 1200000,
    "rent": 6000000,
    "insurance": 900000,
    "repairsAndMaintenance": 1500000,
    "officeSupplies": 900000,
    "advertisingAndMarketing": 1600000,
    "electricity": 900000,
    "water": 300000,
    "phoneAndInternet": 900000,
    "fuel": 1200000,
    "municipalFees": 300000,
    "otherOperatingExpenses": 1200000
  },
  "financialExpenses": {
    "interestPaid": 1200000
  },
  "cashAndBanks": {
    "cashOnHand": 18000000,
    "bankCurrentAccounts": 24000000,
    "depositAccountsOverOneYear": 6000000
  },
  "receivables": {
    "otherReceivables": 3000000
  },
  "inventory": {
    "goods": 24000000
  },
  "liabilities": {
    "bankLoansUnder12Months": 6000000,
    "nonBankLoansUnder12Months": 3000000,
    "commissionsDue": 900000,
    "paymentsToProviders": 6000000,
    "taxesAndFeesDue": 1800000,
    "pensionFundsDue": 1200000,
    "bankLoansOver12Months": 9000000,
    "nonBankLoansOver12Months": 0
  },
  "fixedAssets": {
    "furniture": 6000000,
    "machinery": 9000000,
    "equipment": 6000000,
    "vehicles": 12000000,
    "land": 15000000,
    "building": 12000000
  }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/domain/financial-engine.test.ts`

Expected: FAIL because `src/domain/financial-engine.ts` does not exist.

- [ ] **Step 4: Implement shared money and month helpers**

```ts
export type Money = number;

export function ugx(value: number): Money {
  if (!Number.isFinite(value)) {
    throw new Error("Money value must be finite");
  }
  return Math.round(value);
}

export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}
```

```ts
export const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

export type MonthKey = (typeof monthKeys)[number];

export const monthLabels: Record<MonthKey, string> = {
  jan: "January",
  feb: "February",
  mar: "March",
  apr: "April",
  may: "May",
  jun: "June",
  jul: "July",
  aug: "August",
  sep: "September",
  oct: "October",
  nov: "November",
  dec: "December",
};
```

- [ ] **Step 5: Implement categories**

```ts
export const operatingExpenseKeys = [
  "salaries",
  "travelCosts",
  "rent",
  "insurance",
  "repairsAndMaintenance",
  "officeSupplies",
  "advertisingAndMarketing",
  "electricity",
  "water",
  "phoneAndInternet",
  "fuel",
  "municipalFees",
  "otherOperatingExpenses",
] as const;

export type OperatingExpenseKey = (typeof operatingExpenseKeys)[number];

export const operatingExpenseLabels: Record<OperatingExpenseKey, string> = {
  salaries: "Salaries",
  travelCosts: "Travel costs",
  rent: "Rent",
  insurance: "Insurance",
  repairsAndMaintenance: "Repairs and maintenance",
  officeSupplies: "Office supplies",
  advertisingAndMarketing: "Advertising and marketing",
  electricity: "Electricity",
  water: "Water",
  phoneAndInternet: "Phone and Internet",
  fuel: "Fuel",
  municipalFees: "Municipal fees",
  otherOperatingExpenses: "Other operating expenses",
};
```

- [ ] **Step 6: Implement the financial engine**

```ts
import { operatingExpenseKeys, type OperatingExpenseKey } from "./categories";
import { safeDivide, ugx } from "../shared/money";

export interface AnnualInputs {
  sales: {
    cashSales: number;
    creditSales: number;
  };
  purchases: {
    cashPurchases: number;
    creditPurchases: number;
  };
  operatingExpenses: Record<OperatingExpenseKey, number>;
  financialExpenses: {
    interestPaid: number;
  };
  cashAndBanks: {
    cashOnHand: number;
    bankCurrentAccounts: number;
    depositAccountsOverOneYear: number;
  };
  receivables: {
    otherReceivables: number;
  };
  inventory: {
    goods: number;
  };
  liabilities: {
    bankLoansUnder12Months: number;
    nonBankLoansUnder12Months: number;
    commissionsDue: number;
    paymentsToProviders: number;
    taxesAndFeesDue: number;
    pensionFundsDue: number;
    bankLoansOver12Months: number;
    nonBankLoansOver12Months: number;
  };
  fixedAssets: {
    furniture: number;
    machinery: number;
    equipment: number;
    vehicles: number;
    land: number;
    building: number;
  };
}

export interface AnnualReport {
  summary: {
    revenue: number;
    expenses: number;
    netIncome: number;
  };
  incomeStatement: {
    sales: number;
    purchases: number;
    grossProfit: number;
    operatingAndFinancialExpenses: number;
    profitBeforeTax: number;
    taxExpenses: number;
    netIncome: number;
  };
  balance: {
    currentAssets: number;
    fixedAssets: number;
    totalAssets: number;
    currentLiabilities: number;
    longTermLiabilities: number;
    totalLiabilities: number;
    ownersEquity: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
  };
  cashFlow: number;
  breakEven: number;
  ratios: {
    inventoryTurnover: number;
    receivablesTurnoverDays: number;
    currentRatio: number;
    quickRatio: number;
    debtOnAssets: number;
    debtEquityRatio: number;
    returnOnAssets: number;
    returnOnEquity: number;
    workingCapital: number;
    netProfitMargin: number;
  };
}

function sum(values: number[]) {
  return ugx(values.reduce((total, value) => total + value, 0));
}

export function calculateAnnualReport(input: AnnualInputs): AnnualReport {
  const sales = ugx(input.sales.cashSales + input.sales.creditSales);
  const purchases = ugx(input.purchases.cashPurchases + input.purchases.creditPurchases);
  const operatingExpenses = sum(operatingExpenseKeys.map((key) => input.operatingExpenses[key]));
  const financialExpenses = ugx(input.financialExpenses.interestPaid);
  const expenses = ugx(purchases + operatingExpenses + financialExpenses);
  const grossProfit = ugx(sales - purchases);
  const profitBeforeTax = ugx(grossProfit - operatingExpenses - financialExpenses);
  const taxExpenses = 0;
  const netIncome = ugx(profitBeforeTax - taxExpenses);

  const totalCash = ugx(input.cashAndBanks.cashOnHand + input.cashAndBanks.bankCurrentAccounts);
  const accountsReceivable = ugx(input.sales.creditSales + input.receivables.otherReceivables);
  const inventory = ugx(input.inventory.goods);
  const currentAssets = ugx(totalCash + accountsReceivable + inventory);
  const fixedAssets = sum(Object.values(input.fixedAssets));
  const totalAssets = ugx(currentAssets + fixedAssets);

  const loansUnder12Months = ugx(input.liabilities.bankLoansUnder12Months + input.liabilities.nonBankLoansUnder12Months);
  const currentLiabilities = ugx(
    loansUnder12Months +
      input.liabilities.commissionsDue +
      input.liabilities.paymentsToProviders +
      input.liabilities.taxesAndFeesDue +
      input.liabilities.pensionFundsDue,
  );
  const longTermLiabilities = ugx(input.liabilities.bankLoansOver12Months + input.liabilities.nonBankLoansOver12Months);
  const totalLiabilities = ugx(currentLiabilities + longTermLiabilities);
  const ownersEquity = ugx(totalAssets - totalLiabilities - netIncome);
  const totalEquity = ugx(ownersEquity + netIncome);
  const totalLiabilitiesAndEquity = ugx(totalLiabilities + totalEquity);

  const cashFlow = ugx(netIncome + financialExpenses + input.liabilities.paymentsToProviders - accountsReceivable);
  const contributionMargin = 1 - safeDivide(purchases, sales);
  const breakEven = ugx(safeDivide(operatingExpenses, contributionMargin));
  const workingCapital = ugx(currentAssets - currentLiabilities);

  return {
    summary: {
      revenue: sales,
      expenses,
      netIncome,
    },
    incomeStatement: {
      sales,
      purchases,
      grossProfit,
      operatingAndFinancialExpenses: ugx(operatingExpenses + financialExpenses),
      profitBeforeTax,
      taxExpenses,
      netIncome,
    },
    balance: {
      currentAssets,
      fixedAssets,
      totalAssets,
      currentLiabilities,
      longTermLiabilities,
      totalLiabilities,
      ownersEquity,
      totalEquity,
      totalLiabilitiesAndEquity,
    },
    cashFlow,
    breakEven,
    ratios: {
      inventoryTurnover: safeDivide(sales, inventory),
      receivablesTurnoverDays: safeDivide(accountsReceivable * 365, sales),
      currentRatio: safeDivide(currentAssets, currentLiabilities),
      quickRatio: safeDivide(currentAssets - inventory, currentLiabilities),
      debtOnAssets: safeDivide(totalLiabilities, totalAssets),
      debtEquityRatio: safeDivide(totalLiabilities, totalEquity),
      returnOnAssets: safeDivide(netIncome, totalAssets) * 100,
      returnOnEquity: safeDivide(netIncome, ownersEquity) * 100,
      workingCapital,
      netProfitMargin: safeDivide(netIncome, sales) * 100,
    },
  };
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- tests/domain/financial-engine.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/shared src/domain fixtures tests/domain/financial-engine.test.ts
git commit -m "feat: add spreadsheet-derived financial engine"
```

---

### Task 3: Encrypted Local Persistence

**Files:**
- Create: `src/shared/ipc-contract.ts`
- Create: `src/main/db/schema.ts`
- Create: `src/main/db/connection.ts`
- Create: `src/main/db/repositories.ts`
- Create: `tests/main/repositories.test.ts`

**Interfaces:**
- Consumes: `AnnualInputs` from `src/domain/financial-engine.ts`.
- Produces: `createBusiness(input: CreateBusinessInput): Business`.
- Produces: `saveAnnualInputs(businessId: string, year: number, input: AnnualInputs): PeriodRecord`.
- Produces: `getAnnualInputs(businessId: string, year: number): AnnualInputs | null`.

- [ ] **Step 1: Write the failing repository test**

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import sample from "../../fixtures/easyaccounts-sample.json";
import { openDatabase } from "../../src/main/db/connection";
import { createRepositories } from "../../src/main/db/repositories";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("repositories", () => {
  it("creates a business and persists annual inputs in an encrypted local database", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "easyaccounts-"));
    dirs.push(dir);

    const db = openDatabase({
      filePath: path.join(dir, "books.db"),
      passphrase: "correct horse battery staple",
    });
    const repos = createRepositories(db);

    const business = repos.createBusiness({
      name: "Kampala Trading Co.",
      currency: "UGX",
      fiscalYearStartMonth: 1,
    });

    repos.saveAnnualInputs(business.id, 2026, sample);
    const loaded = repos.getAnnualInputs(business.id, 2026);

    expect(business.name).toBe("Kampala Trading Co.");
    expect(loaded?.sales.cashSales).toBe(90_000_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/main/repositories.test.ts`

Expected: FAIL because `src/main/db/connection.ts` does not exist.

- [ ] **Step 3: Define IPC contract schemas**

```ts
import { z } from "zod";

export const createBusinessSchema = z.object({
  name: z.string().min(1),
  currency: z.literal("UGX"),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

export interface Business {
  id: string;
  name: string;
  currency: "UGX";
  fiscalYearStartMonth: number;
  createdAt: string;
}
```

- [ ] **Step 4: Implement database schema**

```ts
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const businesses = sqliteTable("businesses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull(),
  createdAt: text("created_at").notNull(),
});

export const annualInputs = sqliteTable(
  "annual_inputs",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    year: integer("year").notNull(),
    payloadJson: text("payload_json").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    businessYear: uniqueIndex("annual_inputs_business_year_idx").on(table.businessId, table.year),
  }),
);
```

- [ ] **Step 5: Implement encrypted connection**

```ts
import Database from "better-sqlite3-multiple-ciphers";

export interface OpenDatabaseOptions {
  filePath: string;
  passphrase: string;
}

export type AppDatabase = Database.Database;

export function openDatabase(options: OpenDatabaseOptions): AppDatabase {
  const db = new Database(options.filePath);
  db.pragma(`cipher='sqlcipher'`);
  db.pragma(`legacy=4`);
  db.pragma(`key='${options.passphrase.replaceAll("'", "''")}'`);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL,
      fiscal_year_start_month INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS annual_inputs (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (business_id, year)
    );
  `);
  return db;
}
```

- [ ] **Step 6: Implement repositories**

```ts
import crypto from "node:crypto";
import type { AnnualInputs } from "../../domain/financial-engine";
import type { Business, CreateBusinessInput } from "../../shared/ipc-contract";
import type { AppDatabase } from "./connection";

interface AnnualInputRow {
  payload_json: string;
}

export interface PeriodRecord {
  id: string;
  businessId: string;
  year: number;
  input: AnnualInputs;
  updatedAt: string;
}

export function createRepositories(db: AppDatabase) {
  return {
    createBusiness(input: CreateBusinessInput): Business {
      const business: Business = {
        id: crypto.randomUUID(),
        name: input.name,
        currency: input.currency,
        fiscalYearStartMonth: input.fiscalYearStartMonth,
        createdAt: new Date().toISOString(),
      };

      db.prepare(
        `INSERT INTO businesses (id, name, currency, fiscal_year_start_month, created_at)
         VALUES (@id, @name, @currency, @fiscalYearStartMonth, @createdAt)`,
      ).run(business);

      return business;
    },

    saveAnnualInputs(businessId: string, year: number, input: AnnualInputs): PeriodRecord {
      const record: PeriodRecord = {
        id: crypto.randomUUID(),
        businessId,
        year,
        input,
        updatedAt: new Date().toISOString(),
      };

      db.prepare(
        `INSERT INTO annual_inputs (id, business_id, year, payload_json, updated_at)
         VALUES (@id, @businessId, @year, @payloadJson, @updatedAt)
         ON CONFLICT (business_id, year)
         DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
      ).run({
        id: record.id,
        businessId,
        year,
        payloadJson: JSON.stringify(input),
        updatedAt: record.updatedAt,
      });

      return record;
    },

    getAnnualInputs(businessId: string, year: number): AnnualInputs | null {
      const row = db
        .prepare("SELECT payload_json FROM annual_inputs WHERE business_id = ? AND year = ?")
        .get(businessId, year) as AnnualInputRow | undefined;

      return row ? (JSON.parse(row.payload_json) as AnnualInputs) : null;
    },
  };
}
```

- [ ] **Step 7: Run repository test**

Run: `npm test -- tests/main/repositories.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/shared/ipc-contract.ts src/main/db tests/main/repositories.test.ts
git commit -m "feat: persist encrypted local books"
```

---

### Task 4: Typed IPC And Open Book Flow

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/main.ts`
- Modify: `src/preload/index.ts`
- Create: `src/preload/types.ts`
- Create: `src/renderer/store/book-store.ts`
- Create: `src/renderer/screens/OpenBookScreen.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Consumes: repositories from Task 3.
- Produces: `window.easyAccounts.createBusiness(input)`.
- Produces: `window.easyAccounts.saveAnnualInputs(businessId, year, input)`.
- Produces: `window.easyAccounts.getAnnualInputs(businessId, year)`.

- [ ] **Step 1: Write preload type declarations**

```ts
import type { AnnualInputs } from "../domain/financial-engine";
import type { Business, CreateBusinessInput } from "../shared/ipc-contract";

export interface EasyAccountsApi {
  version: string;
  createBusiness(input: CreateBusinessInput): Promise<Business>;
  saveAnnualInputs(businessId: string, year: number, input: AnnualInputs): Promise<void>;
  getAnnualInputs(businessId: string, year: number): Promise<AnnualInputs | null>;
}

declare global {
  interface Window {
    easyAccounts: EasyAccountsApi;
  }
}
```

- [ ] **Step 2: Implement IPC handlers**

```ts
import { app, ipcMain } from "electron";
import path from "node:path";
import { createBusinessSchema } from "../shared/ipc-contract";
import type { AnnualInputs } from "../domain/financial-engine";
import { openDatabase } from "./db/connection";
import { createRepositories } from "./db/repositories";

const db = openDatabase({
  filePath: path.join(app.getPath("userData"), "books.db"),
  passphrase: "mvp-local-passphrase",
});

const repos = createRepositories(db);

export function registerIpcHandlers() {
  ipcMain.handle("business:create", (_event, input) => {
    const parsed = createBusinessSchema.parse(input);
    return repos.createBusiness(parsed);
  });

  ipcMain.handle("annual-inputs:save", (_event, businessId: string, year: number, input: AnnualInputs) => {
    repos.saveAnnualInputs(businessId, year, input);
  });

  ipcMain.handle("annual-inputs:get", (_event, businessId: string, year: number) => {
    return repos.getAnnualInputs(businessId, year);
  });
}
```

- [ ] **Step 3: Register IPC handlers in main**

```ts
import { app, BrowserWindow } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc";
import { applySecurityGuards } from "./security";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (started) {
  app.quit();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    title: "EasyAccounts",
    show: false,
    backgroundColor: "#f7f4ef",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  applySecurityGuards(mainWindow);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  return createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
```

- [ ] **Step 4: Expose typed preload calls**

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { AnnualInputs } from "../domain/financial-engine";
import type { EasyAccountsApi } from "./types";

const api: EasyAccountsApi = {
  version: "0.1.0",
  createBusiness(input) {
    return ipcRenderer.invoke("business:create", input);
  },
  async saveAnnualInputs(businessId: string, year: number, input: AnnualInputs) {
    await ipcRenderer.invoke("annual-inputs:save", businessId, year, input);
  },
  getAnnualInputs(businessId: string, year: number) {
    return ipcRenderer.invoke("annual-inputs:get", businessId, year);
  },
};

contextBridge.exposeInMainWorld("easyAccounts", api);
```

- [ ] **Step 5: Implement book store**

```ts
import { create } from "zustand";
import type { Business } from "../../shared/ipc-contract";

interface BookState {
  business: Business | null;
  year: number;
  setBusiness(business: Business): void;
  setYear(year: number): void;
}

export const useBookStore = create<BookState>((set) => ({
  business: null,
  year: new Date().getFullYear(),
  setBusiness: (business) => set({ business }),
  setYear: (year) => set({ year }),
}));
```

- [ ] **Step 6: Implement open book screen**

```tsx
import { FormEvent, useState } from "react";
import { Building2 } from "lucide-react";
import { useBookStore } from "../store/book-store";

export function OpenBookScreen() {
  const setBusiness = useBookStore((state) => state.setBusiness);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const business = await window.easyAccounts.createBusiness({
        name,
        currency: "UGX",
        fiscalYearStartMonth: 1,
      });
      setBusiness(business);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the business file.");
    }
  }

  return (
    <main className="open-book">
      <form className="open-book__panel" onSubmit={handleSubmit}>
        <Building2 aria-hidden="true" />
        <h1>Create your private business file</h1>
        <label>
          Business name
          <input value={name} onChange={(event) => setName(event.target.value)} autoFocus required />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit">Start bookkeeping</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Render open book flow from App**

```tsx
import { OpenBookScreen } from "./screens/OpenBookScreen";
import { useBookStore } from "./store/book-store";

export function App() {
  const business = useBookStore((state) => state.business);

  if (!business) {
    return <OpenBookScreen />;
  }

  return (
    <main className="app-frame">
      <h1>{business.name}</h1>
    </main>
  );
}
```

- [ ] **Step 8: Run checks**

Run: `npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/main src/preload src/renderer
git commit -m "feat: add local book creation flow"
```

---

### Task 5: Guided Monthly Entry

**Files:**
- Create: `src/renderer/components/MoneyInput.tsx`
- Create: `src/renderer/components/PeriodPicker.tsx`
- Create: `src/renderer/screens/MonthlyEntryScreen.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: `window.easyAccounts.saveAnnualInputs`.
- Consumes: `AnnualInputs`.
- Produces: guided form values compatible with `calculateAnnualReport(input)`.

- [ ] **Step 1: Implement money input**

```tsx
interface MoneyInputProps {
  label: string;
  value: number;
  onChange(value: number): void;
}

export function MoneyInput({ label, value, onChange }: MoneyInputProps) {
  return (
    <label className="money-input">
      <span>{label}</span>
      <input
        inputMode="numeric"
        value={value === 0 ? "" : String(value)}
        onChange={(event) => onChange(Number(event.target.value.replace(/[^0-9]/g, "")))}
        placeholder="0"
      />
    </label>
  );
}
```

- [ ] **Step 2: Implement period picker**

```tsx
interface PeriodPickerProps {
  year: number;
  onYearChange(year: number): void;
}

export function PeriodPicker({ year, onYearChange }: PeriodPickerProps) {
  return (
    <label className="period-picker">
      Financial year
      <input
        type="number"
        min="2020"
        max="2100"
        value={year}
        onChange={(event) => onYearChange(Number(event.target.value))}
      />
    </label>
  );
}
```

- [ ] **Step 3: Implement monthly entry screen**

```tsx
import { useState } from "react";
import type { AnnualInputs } from "../../domain/financial-engine";
import { operatingExpenseKeys, operatingExpenseLabels } from "../../domain/categories";
import { useBookStore } from "../store/book-store";
import { MoneyInput } from "../components/MoneyInput";
import { PeriodPicker } from "../components/PeriodPicker";

const emptyInputs: AnnualInputs = {
  sales: { cashSales: 0, creditSales: 0 },
  purchases: { cashPurchases: 0, creditPurchases: 0 },
  operatingExpenses: {
    salaries: 0,
    travelCosts: 0,
    rent: 0,
    insurance: 0,
    repairsAndMaintenance: 0,
    officeSupplies: 0,
    advertisingAndMarketing: 0,
    electricity: 0,
    water: 0,
    phoneAndInternet: 0,
    fuel: 0,
    municipalFees: 0,
    otherOperatingExpenses: 0,
  },
  financialExpenses: { interestPaid: 0 },
  cashAndBanks: { cashOnHand: 0, bankCurrentAccounts: 0, depositAccountsOverOneYear: 0 },
  receivables: { otherReceivables: 0 },
  inventory: { goods: 0 },
  liabilities: {
    bankLoansUnder12Months: 0,
    nonBankLoansUnder12Months: 0,
    commissionsDue: 0,
    paymentsToProviders: 0,
    taxesAndFeesDue: 0,
    pensionFundsDue: 0,
    bankLoansOver12Months: 0,
    nonBankLoansOver12Months: 0,
  },
  fixedAssets: { furniture: 0, machinery: 0, equipment: 0, vehicles: 0, land: 0, building: 0 },
};

export function MonthlyEntryScreen() {
  const business = useBookStore((state) => state.business);
  const year = useBookStore((state) => state.year);
  const setYear = useBookStore((state) => state.setYear);
  const [input, setInput] = useState<AnnualInputs>(emptyInputs);
  const [saved, setSaved] = useState(false);

  if (!business) {
    return null;
  }

  async function save() {
    await window.easyAccounts.saveAnnualInputs(business.id, year, input);
    setSaved(true);
  }

  return (
    <section className="entry-screen" aria-labelledby="entry-title">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Guided entry</p>
          <h1 id="entry-title">Annual questionnaire</h1>
        </div>
        <PeriodPicker year={year} onYearChange={setYear} />
      </header>

      <div className="entry-grid">
        <fieldset>
          <legend>Sales</legend>
          <MoneyInput label="Cash sales" value={input.sales.cashSales} onChange={(cashSales) => setInput({ ...input, sales: { ...input.sales, cashSales } })} />
          <MoneyInput label="Credit sales" value={input.sales.creditSales} onChange={(creditSales) => setInput({ ...input, sales: { ...input.sales, creditSales } })} />
        </fieldset>

        <fieldset>
          <legend>Purchases</legend>
          <MoneyInput label="Cash purchases" value={input.purchases.cashPurchases} onChange={(cashPurchases) => setInput({ ...input, purchases: { ...input.purchases, cashPurchases } })} />
          <MoneyInput label="Credit purchases" value={input.purchases.creditPurchases} onChange={(creditPurchases) => setInput({ ...input, purchases: { ...input.purchases, creditPurchases } })} />
        </fieldset>

        <fieldset>
          <legend>Operating expenses</legend>
          {operatingExpenseKeys.map((key) => (
            <MoneyInput
              key={key}
              label={operatingExpenseLabels[key]}
              value={input.operatingExpenses[key]}
              onChange={(value) => setInput({ ...input, operatingExpenses: { ...input.operatingExpenses, [key]: value } })}
            />
          ))}
        </fieldset>
      </div>

      <button type="button" onClick={save}>Save questionnaire</button>
      {saved ? <p role="status">Saved locally.</p> : null}
    </section>
  );
}
```

- [ ] **Step 4: Add screen to App**

```tsx
import { OpenBookScreen } from "./screens/OpenBookScreen";
import { MonthlyEntryScreen } from "./screens/MonthlyEntryScreen";
import { useBookStore } from "./store/book-store";

export function App() {
  const business = useBookStore((state) => state.business);

  if (!business) {
    return <OpenBookScreen />;
  }

  return (
    <main className="app-frame">
      <MonthlyEntryScreen />
    </main>
  );
}
```

- [ ] **Step 5: Run checks**

Run: `npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer
git commit -m "feat: add guided accounting questionnaire"
```

---

### Task 6: Dashboard And Reports

**Files:**
- Create: `src/renderer/components/KpiCard.tsx`
- Create: `src/renderer/components/ReportTable.tsx`
- Create: `src/renderer/components/Charts.tsx`
- Create: `src/renderer/screens/DashboardScreen.tsx`
- Create: `src/renderer/screens/ReportsScreen.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: `calculateAnnualReport(input: AnnualInputs): AnnualReport`.
- Consumes: persisted annual inputs from IPC.
- Produces: readable reports and visual trends without needing spreadsheet knowledge.

- [ ] **Step 1: Implement KPI card**

```tsx
interface KpiCardProps {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning";
}

export function KpiCard({ label, value, tone = "neutral" }: KpiCardProps) {
  return (
    <article className={`kpi-card kpi-card--${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
```

- [ ] **Step 2: Implement report table**

```tsx
interface ReportRow {
  label: string;
  value: number;
}

interface ReportTableProps {
  title: string;
  rows: ReportRow[];
}

const formatter = new Intl.NumberFormat("en-UG", {
  style: "currency",
  currency: "UGX",
  maximumFractionDigits: 0,
});

export function formatUgx(value: number) {
  return formatter.format(value);
}

export function ReportTable({ title, rows }: ReportTableProps) {
  return (
    <section className="report-table" aria-labelledby={`${title}-title`}>
      <h2 id={`${title}-title`}>{title}</h2>
      <table>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{formatUgx(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 3: Implement charts**

```tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ProfitChartProps {
  revenue: number;
  expenses: number;
  netIncome: number;
}

export function ProfitChart({ revenue, expenses, netIncome }: ProfitChartProps) {
  const data = [
    { name: "Revenue", value: revenue },
    { name: "Expenses", value: expenses },
    { name: "Net income", value: netIncome },
  ];

  return (
    <div className="chart-frame" aria-label="Revenue, expenses, and net income chart">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#5f6f52" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Implement dashboard screen**

```tsx
import { useEffect, useState } from "react";
import type { AnnualInputs } from "../../domain/financial-engine";
import { calculateAnnualReport } from "../../domain/financial-engine";
import { KpiCard } from "../components/KpiCard";
import { ProfitChart } from "../components/Charts";
import { formatUgx } from "../components/ReportTable";
import { useBookStore } from "../store/book-store";

export function DashboardScreen() {
  const business = useBookStore((state) => state.business);
  const year = useBookStore((state) => state.year);
  const [input, setInput] = useState<AnnualInputs | null>(null);

  useEffect(() => {
    if (business) {
      void window.easyAccounts.getAnnualInputs(business.id, year).then(setInput);
    }
  }, [business, year]);

  if (!business || !input) {
    return <p>No saved questionnaire yet.</p>;
  }

  const report = calculateAnnualReport(input);

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{business.name}</p>
          <h1 id="dashboard-title">Dashboard</h1>
        </div>
      </header>
      <div className="kpi-grid">
        <KpiCard label="Revenue" value={formatUgx(report.summary.revenue)} tone="good" />
        <KpiCard label="Expenses" value={formatUgx(report.summary.expenses)} />
        <KpiCard label="Net income" value={formatUgx(report.summary.netIncome)} tone={report.summary.netIncome >= 0 ? "good" : "warning"} />
        <KpiCard label="Working capital" value={formatUgx(report.ratios.workingCapital)} />
      </div>
      <ProfitChart revenue={report.summary.revenue} expenses={report.summary.expenses} netIncome={report.summary.netIncome} />
    </section>
  );
}
```

- [ ] **Step 5: Implement reports screen**

```tsx
import { useEffect, useState } from "react";
import type { AnnualInputs } from "../../domain/financial-engine";
import { calculateAnnualReport } from "../../domain/financial-engine";
import { ReportTable } from "../components/ReportTable";
import { useBookStore } from "../store/book-store";

export function ReportsScreen() {
  const business = useBookStore((state) => state.business);
  const year = useBookStore((state) => state.year);
  const [input, setInput] = useState<AnnualInputs | null>(null);

  useEffect(() => {
    if (business) {
      void window.easyAccounts.getAnnualInputs(business.id, year).then(setInput);
    }
  }, [business, year]);

  if (!input) {
    return <p>Save the questionnaire to generate reports.</p>;
  }

  const report = calculateAnnualReport(input);

  return (
    <section className="reports-screen" aria-labelledby="reports-title">
      <h1 id="reports-title">Reports</h1>
      <ReportTable
        title="Income statement"
        rows={[
          { label: "Sales", value: report.incomeStatement.sales },
          { label: "Purchases", value: report.incomeStatement.purchases },
          { label: "Gross profit", value: report.incomeStatement.grossProfit },
          { label: "Operating and financial expenses", value: report.incomeStatement.operatingAndFinancialExpenses },
          { label: "Net income", value: report.incomeStatement.netIncome },
        ]}
      />
      <ReportTable
        title="Balance sheet"
        rows={[
          { label: "Current assets", value: report.balance.currentAssets },
          { label: "Fixed assets", value: report.balance.fixedAssets },
          { label: "Total assets", value: report.balance.totalAssets },
          { label: "Total liabilities", value: report.balance.totalLiabilities },
          { label: "Total equity", value: report.balance.totalEquity },
        ]}
      />
    </section>
  );
}
```

- [ ] **Step 6: Add simple screen switcher to App**

```tsx
import { useState } from "react";
import { BarChart3, FileText, LayoutDashboard } from "lucide-react";
import { DashboardScreen } from "./screens/DashboardScreen";
import { MonthlyEntryScreen } from "./screens/MonthlyEntryScreen";
import { OpenBookScreen } from "./screens/OpenBookScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { useBookStore } from "./store/book-store";

type Screen = "dashboard" | "entry" | "reports";

export function App() {
  const business = useBookStore((state) => state.business);
  const [screen, setScreen] = useState<Screen>("entry");

  if (!business) {
    return <OpenBookScreen />;
  }

  return (
    <main className="workspace">
      <nav className="sidebar" aria-label="Main navigation">
        <button type="button" onClick={() => setScreen("dashboard")}><LayoutDashboard aria-hidden="true" />Dashboard</button>
        <button type="button" onClick={() => setScreen("entry")}><FileText aria-hidden="true" />Questionnaire</button>
        <button type="button" onClick={() => setScreen("reports")}><BarChart3 aria-hidden="true" />Reports</button>
      </nav>
      <section className="workspace__content">
        {screen === "dashboard" ? <DashboardScreen /> : null}
        {screen === "entry" ? <MonthlyEntryScreen /> : null}
        {screen === "reports" ? <ReportsScreen /> : null}
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Run checks**

Run: `npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/renderer
git commit -m "feat: add dashboard and financial reports"
```

---

### Task 7: CSV Import And Local Categorization

**Files:**
- Create: `src/domain/import-classifier.ts`
- Create: `tests/domain/import-classifier.test.ts`
- Create: `src/renderer/components/ImportReviewTable.tsx`
- Create: `src/renderer/screens/TransactionsScreen.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Produces: `classifyTransaction(description: string): Classification`.
- Produces: CSV import review that maps common statement descriptions to Easy Accounts categories.

- [ ] **Step 1: Write classifier test**

```ts
import { describe, expect, it } from "vitest";
import { classifyTransaction } from "../../src/domain/import-classifier";

describe("classifyTransaction", () => {
  it("classifies common Ugandan business payment descriptions", () => {
    expect(classifyTransaction("UMEME YAKA TOKEN")).toEqual({ category: "electricity", confidence: 0.9 });
    expect(classifyTransaction("NWSC WATER BILL")).toEqual({ category: "water", confidence: 0.9 });
    expect(classifyTransaction("MTN AIRTIME INTERNET")).toEqual({ category: "phoneAndInternet", confidence: 0.8 });
    expect(classifyTransaction("SHELL FUEL NAKAWA")).toEqual({ category: "fuel", confidence: 0.8 });
    expect(classifyTransaction("Unknown supplier")).toEqual({ category: "otherOperatingExpenses", confidence: 0.3 });
  });
});
```

- [ ] **Step 2: Implement classifier**

```ts
import type { OperatingExpenseKey } from "./categories";

export interface Classification {
  category: OperatingExpenseKey;
  confidence: number;
}

const rules: Array<{ category: OperatingExpenseKey; confidence: number; patterns: RegExp[] }> = [
  { category: "electricity", confidence: 0.9, patterns: [/umeme/i, /yaka/i, /electric/i] },
  { category: "water", confidence: 0.9, patterns: [/nwsc/i, /water/i] },
  { category: "phoneAndInternet", confidence: 0.8, patterns: [/mtn/i, /airtel/i, /airtime/i, /internet/i, /data/i] },
  { category: "fuel", confidence: 0.8, patterns: [/fuel/i, /shell/i, /total/i, /stabex/i] },
  { category: "rent", confidence: 0.75, patterns: [/rent/i, /landlord/i] },
  { category: "advertisingAndMarketing", confidence: 0.75, patterns: [/facebook/i, /google ads/i, /advert/i, /marketing/i] },
  { category: "travelCosts", confidence: 0.7, patterns: [/taxi/i, /uber/i, /safe boda/i, /bus/i] },
];

export function classifyTransaction(description: string): Classification {
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(description))) {
      return { category: rule.category, confidence: rule.confidence };
    }
  }

  return { category: "otherOperatingExpenses", confidence: 0.3 };
}
```

- [ ] **Step 3: Run classifier test**

Run: `npm test -- tests/domain/import-classifier.test.ts`

Expected: PASS.

- [ ] **Step 4: Implement import review table**

```tsx
import { operatingExpenseLabels, type OperatingExpenseKey } from "../../domain/categories";

export interface ImportedTransaction {
  date: string;
  description: string;
  amount: number;
  category: OperatingExpenseKey;
  confidence: number;
}

interface ImportReviewTableProps {
  rows: ImportedTransaction[];
}

export function ImportReviewTable({ rows }: ImportReviewTableProps) {
  return (
    <table className="import-review">
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Amount</th>
          <th>Category</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.date}-${row.description}-${index}`}>
            <td>{row.date}</td>
            <td>{row.description}</td>
            <td>{row.amount.toLocaleString("en-UG")}</td>
            <td>{operatingExpenseLabels[row.category]}</td>
            <td>{Math.round(row.confidence * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 5: Implement transactions screen**

```tsx
import Papa from "papaparse";
import { useState } from "react";
import { classifyTransaction } from "../../domain/import-classifier";
import { ImportReviewTable, type ImportedTransaction } from "../components/ImportReviewTable";

interface CsvRow {
  Date?: string;
  Description?: string;
  Amount?: string;
}

export function TransactionsScreen() {
  const [rows, setRows] = useState<ImportedTransaction[]>([]);

  function importFile(file: File) {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        setRows(
          result.data.map((row) => {
            const classification = classifyTransaction(row.Description ?? "");
            return {
              date: row.Date ?? "",
              description: row.Description ?? "",
              amount: Number((row.Amount ?? "0").replace(/,/g, "")),
              ...classification,
            };
          }),
        );
      },
    });
  }

  return (
    <section className="transactions-screen" aria-labelledby="transactions-title">
      <h1 id="transactions-title">Transactions</h1>
      <label className="file-picker">
        Import CSV
        <input type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0])} />
      </label>
      <ImportReviewTable rows={rows} />
    </section>
  );
}
```

- [ ] **Step 6: Add Transactions navigation**

```tsx
import { useState } from "react";
import { BarChart3, FileText, LayoutDashboard, ListChecks } from "lucide-react";
import { DashboardScreen } from "./screens/DashboardScreen";
import { MonthlyEntryScreen } from "./screens/MonthlyEntryScreen";
import { OpenBookScreen } from "./screens/OpenBookScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { TransactionsScreen } from "./screens/TransactionsScreen";
import { useBookStore } from "./store/book-store";

type Screen = "dashboard" | "entry" | "transactions" | "reports";

export function App() {
  const business = useBookStore((state) => state.business);
  const [screen, setScreen] = useState<Screen>("entry");

  if (!business) {
    return <OpenBookScreen />;
  }

  return (
    <main className="workspace">
      <nav className="sidebar" aria-label="Main navigation">
        <button type="button" onClick={() => setScreen("dashboard")}><LayoutDashboard aria-hidden="true" />Dashboard</button>
        <button type="button" onClick={() => setScreen("entry")}><FileText aria-hidden="true" />Questionnaire</button>
        <button type="button" onClick={() => setScreen("transactions")}><ListChecks aria-hidden="true" />Transactions</button>
        <button type="button" onClick={() => setScreen("reports")}><BarChart3 aria-hidden="true" />Reports</button>
      </nav>
      <section className="workspace__content">
        {screen === "dashboard" ? <DashboardScreen /> : null}
        {screen === "entry" ? <MonthlyEntryScreen /> : null}
        {screen === "transactions" ? <TransactionsScreen /> : null}
        {screen === "reports" ? <ReportsScreen /> : null}
      </section>
    </main>
  );
}
```

Expected: The app can display Dashboard, Questionnaire, Transactions, and Reports.

- [ ] **Step 7: Run checks**

Run: `npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/import-classifier.ts tests/domain/import-classifier.test.ts src/renderer
git commit -m "feat: import and classify statement csv files"
```

---

### Task 8: Excel Export

**Files:**
- Create: `src/domain/export-workbook.ts`
- Create: `tests/domain/export-workbook.test.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/renderer/screens/ReportsScreen.tsx`

**Interfaces:**
- Consumes: `AnnualInputs` and `calculateAnnualReport`.
- Produces: `buildWorkbook(input: AnnualInputs): XLSX.WorkBook`.
- Produces: export action from Reports screen.

- [ ] **Step 1: Write workbook export test**

```ts
import { describe, expect, it } from "vitest";
import sample from "../../fixtures/easyaccounts-sample.json";
import { buildWorkbook } from "../../src/domain/export-workbook";

describe("buildWorkbook", () => {
  it("creates a workbook with transactions and statements sheets", () => {
    const workbook = buildWorkbook(sample);

    expect(workbook.SheetNames).toEqual(["Transactions", "Financial Statements"]);
    expect(workbook.Sheets["Transactions"]["A1"].v).toBe("Transactions");
    expect(workbook.Sheets["Financial Statements"]["A1"].v).toBe("Income Statement - summary");
  });
});
```

- [ ] **Step 2: Implement workbook export**

```ts
import * as XLSX from "xlsx";
import type { AnnualInputs } from "./financial-engine";
import { calculateAnnualReport } from "./financial-engine";

export function buildWorkbook(input: AnnualInputs): XLSX.WorkBook {
  const report = calculateAnnualReport(input);
  const workbook = XLSX.utils.book_new();

  const transactions = XLSX.utils.aoa_to_sheet([
    ["Transactions"],
    ["Cash sales", input.sales.cashSales],
    ["Credit sales", input.sales.creditSales],
    ["Cash purchases", input.purchases.cashPurchases],
    ["Credit purchases", input.purchases.creditPurchases],
  ]);

  const statements = XLSX.utils.aoa_to_sheet([
    ["Income Statement - summary"],
    ["Revenue", report.summary.revenue],
    ["Expenses", report.summary.expenses],
    ["Net income", report.summary.netIncome],
    [],
    ["Balance Sheet - summary"],
    ["Total assets", report.balance.totalAssets],
    ["Total liabilities", report.balance.totalLiabilities],
    ["Total equity", report.balance.totalEquity],
  ]);

  XLSX.utils.book_append_sheet(workbook, transactions, "Transactions");
  XLSX.utils.book_append_sheet(workbook, statements, "Financial Statements");
  return workbook;
}
```

- [ ] **Step 3: Run export test**

Run: `npm test -- tests/domain/export-workbook.test.ts`

Expected: PASS.

- [ ] **Step 4: Add export IPC**

```ts
import * as XLSX from "xlsx";
import { dialog, app, ipcMain } from "electron";
import path from "node:path";
import { buildWorkbook } from "../domain/export-workbook";
```

Add this handler inside `registerIpcHandlers()`:

```ts
ipcMain.handle("annual-inputs:export-xlsx", async (_event, businessId: string, year: number) => {
  const input = repos.getAnnualInputs(businessId, year);
  if (!input) {
    throw new Error("No saved questionnaire exists for this year.");
  }

  const result = await dialog.showSaveDialog({
    defaultPath: path.join(app.getPath("documents"), `easyaccounts-${year}.xlsx`),
    filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
  });

  if (result.canceled || !result.filePath) {
    return false;
  }

  XLSX.writeFile(buildWorkbook(input), result.filePath);
  return true;
});
```

- [ ] **Step 5: Expose export preload API**

```ts
export interface EasyAccountsApi {
  version: string;
  createBusiness(input: CreateBusinessInput): Promise<Business>;
  saveAnnualInputs(businessId: string, year: number, input: AnnualInputs): Promise<void>;
  getAnnualInputs(businessId: string, year: number): Promise<AnnualInputs | null>;
  exportXlsx(businessId: string, year: number): Promise<boolean>;
}
```

Add to preload `api`:

```ts
exportXlsx(businessId: string, year: number) {
  return ipcRenderer.invoke("annual-inputs:export-xlsx", businessId, year);
}
```

- [ ] **Step 6: Add export button to reports**

Add this button inside `ReportsScreen`, after the `h1`:

```tsx
{business ? (
  <button type="button" onClick={() => void window.easyAccounts.exportXlsx(business.id, year)}>
    Export Excel workbook
  </button>
) : null}
```

- [ ] **Step 7: Run checks**

Run: `npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/export-workbook.ts tests/domain/export-workbook.test.ts src/main src/preload src/renderer
git commit -m "feat: export reports to excel"
```

---

### Task 9: Packaging, E2E Smoke Test, And Research Notes

**Files:**
- Create: `tests/e2e/app.spec.ts`
- Create: `playwright.config.ts`
- Create: `docs/research/easyaccounts-market-notes.md`
- Modify: `forge.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: full app.
- Produces: Windows and macOS packaging commands.
- Produces: source-backed product positioning notes.

- [ ] **Step 1: Add Playwright config**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: {
    trace: "on-first-retry",
  },
});
```

- [ ] **Step 2: Add smoke test**

```ts
import { test, expect } from "@playwright/test";

test("app opens to local book creation", async ({ page }) => {
  await page.goto("http://localhost:5173");
  await expect(page.getByRole("heading", { name: "Create your private business file" })).toBeVisible();
  await expect(page.getByLabel("Business name")).toBeVisible();
});
```

- [ ] **Step 3: Add research notes**

```md
# EasyAccounts Market Notes

## Sources

- Official Uganda Easy Accounts site: https://uganda.easyaccounts.org/
- UNCTAD Uganda e-accounting tool process PDF: https://unctad.org/system/files/non-official-document/ciiisar42_3_rmubiru_en.pdf
- Uganda Data Protection and Privacy Act on ULII: https://ulii.org/akn/ug/act/2019/9/eng%402019-05-03
- QuickBooks small business accounting features: https://quickbooks.intuit.com/accounting/
- Xero bank reconciliation: https://www.xero.com/us/accounting-software/reconcile-bank-transactions/
- Wave small business software: https://www.waveapps.com/

## Positioning

EasyAccounts Desktop is for Ugandan micro and small businesses that want useful records without cloud surveillance anxiety, accounting jargon, or spreadsheet breakage.

## Differentiators

- Opens directly into local books instead of a web login.
- No telemetry in the MVP.
- Encrypted local SQLite business file.
- Guided questionnaire compatible with Easy Accounts categories.
- Optional CSV imports for bank and mobile money statements.
- Accountant-readable Excel exports.

## Risks

- Official workbook formulas contain inconsistencies, including misspelled sheet names and formulas that reference unexpected cells.
- Tax simulation requires a separate verified source before inclusion.
- Bank/mobile money CSV formats vary by institution, so import mapping must remain review-first.
```

- [ ] **Step 4: Run all automated checks**

Run: `npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 5: Run development app for manual smoke**

Run: `npm run dev`

Expected: Electron opens, business creation works, questionnaire saves, reports render, and Excel export prompts for a save location.

- [ ] **Step 6: Build distributables**

Run: `npm run package`

Expected: packaged app appears under `out/`.

Run: `npm run make`

Expected: platform-specific maker artifacts appear under `out/make/`.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts tests/e2e docs/research forge.config.ts package.json package-lock.json
git commit -m "chore: add packaging checks and research notes"
```

---

## Self-Review

**Spec coverage:** This plan covers the user's intent to use the full conversation, official site, spreadsheet asset, privacy concern, Electron desktop target, Windows/macOS distribution, simplicity, functionality, and ease of use. It deliberately excludes tax simulation implementation until a verified Uganda tax source is selected.

**Placeholder scan:** The plan avoids unresolved placeholders and defines concrete files, commands, interfaces, and code for each task. The only manual instruction is the Task 7 navigation branch, and it names the exact screen branch and label to add.

**Type consistency:** `AnnualInputs`, `AnnualReport`, `CreateBusinessInput`, `Business`, `EasyAccountsApi`, and repository method names are consistent across tasks.

## Execution Notes

- Use a fresh worktree before implementation if the main repository gains unrelated work.
- Prefer one task per commit.
- Run `npm run typecheck && npm test` before every commit.
- Run `npm run dev` after UI tasks and inspect the desktop window manually.
- Before public release, add app signing/notarization tasks for macOS and Windows code signing tasks for Windows.
