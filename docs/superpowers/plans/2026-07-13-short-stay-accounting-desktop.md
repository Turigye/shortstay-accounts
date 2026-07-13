# Short-Stay Property Accounting Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready, local-first Windows and macOS desktop application for manually operating and accounting for two short-stay accommodation units.

**Architecture:** Electron owns the encrypted SQLite database, filesystem access, backups, and exports. React renders the work-focused desktop UI through a narrow typed preload bridge; pure TypeScript domain modules calculate booking allocation, collected revenue, compensation, statements, and ratios without depending on Electron or the database.

**Tech Stack:** Electron 43.1.0, Electron Forge 7.11.2, Vite 8.1.4, React 19.2.7, TypeScript 7.0.2, Vitest 4.1.10, Playwright 1.61.1, better-sqlite3-multiple-ciphers 12.11.1, Zod 4.4.3, Zustand 5.0.14, Recharts 3.9.2, Lucide React 1.23.0, SheetJS xlsx 0.20.3 from the official `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` tarball.

## Global Constraints

- Target platforms are Windows and macOS desktop via Electron.
- Core operation requires no account, internet connection, Airbnb account, external booking platform, or remote financial database.
- Initial configuration contains two units but the data model supports additional units.
- Default currency is UGX and money is stored as integer UGX amounts.
- Financial data is encrypted at rest and remains local unless the user explicitly exports it.
- No telemetry, analytics, or automatic financial-data upload is included.
- All six staff roles use Net Collected Booking Revenue at 5%, 5%, 10%, 2%, 5%, and 10% respectively.
- Referral commission is optional per booking and defaults to 10% of eligible collected accommodation revenue.
- The manual tax provision defaults to UGX 600,000 per active unit per month; two units produce UGX 1,200,000 monthly and UGX 14,400,000 annually.
- Cross-month stays allocate revenue by occupied night; compensation remains attributed to the occupied-night month and becomes payable when related money is collected.
- The application must preserve every relevant category and report listed in `docs/superpowers/specs/2026-07-13-short-stay-accounting-design.md`.
- Ratios with zero denominators display `Not available`, never a spreadsheet error.
- UI text contrast meets WCAG AA, every control is keyboard reachable, and layouts remain usable at 1280x720.
- `StayBooks` is a provisional mockup name; keep the product name in one configurable constant until the user approves a final name.
- During UI tasks, use the globally installed Taste and Impeccable skills when their triggers match; use Emil Kowalski animation skills only for purposeful motion review.

---

## File Structure

### Desktop Boundary

- `package.json` - scripts, pinned dependencies, and Electron entry metadata.
- `forge.config.ts` - Windows/macOS makers and Vite integration.
- `vite.main.config.ts` - Electron main-process build.
- `vite.preload.config.ts` - preload build.
- `vite.renderer.config.ts` - React renderer build.
- `src/main/main.ts` - Electron lifecycle and secure window creation.
- `src/main/security.ts` - navigation, permission, and window-opening guards.
- `src/main/ipc/register-handlers.ts` - validated IPC registration.
- `src/preload/index.ts` - narrow `window.stayBooks` API.
- `src/shared/ipc.ts` - Zod request/response contracts.

### Domain

- `src/domain/types.ts` - shared entity, status, and result types.
- `src/domain/money.ts` - integer UGX validation and arithmetic.
- `src/domain/periods.ts` - month keys and occupied-night splitting.
- `src/domain/categories.ts` - client-note and workbook category definitions.
- `src/domain/bookings.ts` - booking totals, state rules, and overlap validation.
- `src/domain/payments.ts` - receipt/refund totals and customer balances.
- `src/domain/revenue-allocation.ts` - stay-month and collection eligibility allocation.
- `src/domain/compensation.ts` - staff and referral earnings.
- `src/domain/accounting.ts` - ledger projection, statements, break-even, and ratios.

### Persistence

- `src/main/db/connection.ts` - encrypted SQLite connection and key application.
- `src/main/db/migrations.ts` - ordered idempotent schema migrations.
- `src/main/db/repositories/business-repository.ts` - business, unit, and settings persistence.
- `src/main/db/repositories/booking-repository.ts` - customers and bookings.
- `src/main/db/repositories/payment-repository.ts` - receipts and refunds.
- `src/main/db/repositories/expense-repository.ts` - expenses, suppliers, and recurring templates.
- `src/main/db/repositories/finance-repository.ts` - accounts, loans, inventory, assets, equity, and period close.
- `src/main/db/repositories/audit-repository.ts` - append-only correction and close events.

### Renderer

- `src/renderer/main.tsx` - React bootstrap.
- `src/renderer/App.tsx` - top-level screen routing.
- `src/renderer/styles/tokens.css` - color, typography, spacing, and z-index tokens.
- `src/renderer/styles/app.css` - stable desktop layout and responsive constraints.
- `src/renderer/store/app-store.ts` - active business, period, and refresh state.
- `src/renderer/components/AppShell.tsx` - sidebar, command bar, and content shell.
- `src/renderer/components/MoneyInput.tsx` - UGX-safe input.
- `src/renderer/components/StatusBadge.tsx` - semantic booking/payment states.
- `src/renderer/components/DataTable.tsx` - accessible sortable table.
- `src/renderer/screens/TodayScreen.tsx` - command center.
- `src/renderer/screens/BookingsScreen.tsx` - calendar/list and booking editor.
- `src/renderer/screens/PaymentsScreen.tsx` - collections, refunds, and balances.
- `src/renderer/screens/ExpensesScreen.tsx` - costs and suppliers.
- `src/renderer/screens/StaffScreen.tsx` - staff/referral calculations and payments.
- `src/renderer/screens/FinancialPositionScreen.tsx` - balances, loans, assets, and close.
- `src/renderer/screens/ReportsScreen.tsx` - statements, cash flow, break-even, and ratios.
- `src/renderer/screens/SettingsScreen.tsx` - units, rates, provision, backup, and security.

### Tests And Fixtures

- `tests/domain/*.test.ts` - pure calculation tests.
- `tests/main/*.test.ts` - encrypted repository and IPC tests.
- `tests/renderer/*.test.tsx` - component workflow tests.
- `tests/e2e/app.spec.ts` - complete two-unit business flow.
- `fixtures/easyaccounts-coverage.json` - workbook-derived categories and expected statements.

---

### Task 1: Secure Electron Shell And Product Design Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `forge.config.ts`
- Create: `vite.main.config.ts`
- Create: `vite.preload.config.ts`
- Create: `vite.renderer.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main/main.ts`
- Create: `src/main/security.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/components/AppShell.tsx`
- Create: `src/renderer/components/MoneyInput.tsx`
- Create: `src/renderer/components/StatusBadge.tsx`
- Create: `src/renderer/components/DataTable.tsx`
- Create: `src/renderer/styles/tokens.css`
- Create: `src/renderer/styles/app.css`
- Test: `tests/main/security.test.ts`

**Interfaces:**
- Produces: Electron entry `src/main/main.ts`.
- Produces: isolated preload namespace `window.stayBooks`.
- Produces: renderer shell with route union `AppScreen`.

- [ ] **Step 1: Create the project manifest and TypeScript/Vite/Forge configuration**

Create this complete manifest:

```json
{
  "name": "short-stay-accounts",
  "productName": "Short-Stay Accounts",
  "version": "0.1.0",
  "private": true,
  "description": "Private desktop accounting for short-stay accommodation",
  "main": ".vite/build/main.js",
  "scripts": {
    "start": "electron-forge start",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "package": "electron-forge package",
    "make": "electron-forge make"
  },
  "dependencies": {
    "better-sqlite3-multiple-ciphers": "12.11.1",
    "lucide-react": "1.23.0",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "recharts": "3.9.2",
    "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
    "zod": "4.4.3",
    "zustand": "5.0.14"
  },
  "devDependencies": {
    "@electron-forge/cli": "7.11.2",
    "@electron-forge/maker-squirrel": "7.11.2",
    "@electron-forge/maker-zip": "7.11.2",
    "@electron-forge/plugin-auto-unpack-natives": "7.11.2",
    "@electron-forge/plugin-vite": "7.11.2",
    "@playwright/test": "1.61.1",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.1",
    "@types/node": "26.1.1",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.3",
    "electron": "43.1.0",
    "jsdom": "29.1.1",
    "typescript": "7.0.2",
    "vite": "8.1.4",
    "vitest": "4.1.10"
  }
}
```

Configure Forge's Vite plugin with `src/main/main.ts`, `src/preload/index.ts`, and renderer name `main_window`. Configure Squirrel for Windows and ZIP for macOS.

- [ ] **Step 2: Write the failing security test**

```ts
import { describe, expect, it, vi } from "vitest";
import { isAllowedNavigation } from "../../src/main/security";

describe("isAllowedNavigation", () => {
  it("allows the packaged app origin and blocks remote navigation", () => {
    expect(isAllowedNavigation("file:///Applications/StayBooks/index.html")).toBe(true);
    expect(isAllowedNavigation("https://example.com/phishing")).toBe(false);
  });
});
```

- [ ] **Step 3: Run the security test and confirm failure**

Run: `npm test -- tests/main/security.test.ts`

Expected: FAIL because `src/main/security.ts` does not exist.

- [ ] **Step 4: Implement the secure BrowserWindow and navigation guards**

```ts
export function isAllowedNavigation(url: string): boolean {
  return url.startsWith("file://") || url.startsWith("http://localhost:");
}

export function applySecurityGuards(window: Electron.BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
}
```

Create the window with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and the generated preload entry.

- [ ] **Step 5: Build the high-contrast desktop shell**

Define tokens for ink, surface, canvas, success, warning, danger, information, focus, spacing, and stable sidebar/toolbar dimensions. Implement the permanent navigation from the specification without functional screens. Keep cards at 8px radius or less and ensure 4.5:1 body-text contrast.

- [ ] **Step 6: Verify the shell**

Run: `npm test -- tests/main/security.test.ts && npm run typecheck`

Expected: PASS and zero TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json forge.config.ts vite.*.config.ts vitest.config.ts index.html src/main src/preload src/renderer tests/main/security.test.ts
git commit -m "feat: scaffold secure desktop shell"
```

---

### Task 2: Domain Types, Money, Periods, And Complete Categories

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/money.ts`
- Create: `src/domain/periods.ts`
- Create: `src/domain/categories.ts`
- Test: `tests/domain/money.test.ts`
- Test: `tests/domain/periods.test.ts`
- Test: `tests/domain/categories.test.ts`

**Interfaces:**
- Produces: branded `Ugx`, `MonthKey`, entity identifiers, booking/payment statuses, and category IDs.
- Produces: `splitStayByMonth(checkIn, checkOut): MonthNightAllocation[]`.
- Produces: `EXPENSE_CATEGORIES`, `ASSET_CATEGORIES`, and `REPORT_RATIOS`.

- [ ] **Step 1: Write failing money and period tests**

```ts
import { describe, expect, it } from "vitest";
import { ugx } from "../../src/domain/money";
import { splitStayByMonth } from "../../src/domain/periods";

it("rejects fractional UGX", () => expect(() => ugx(1200.5)).toThrow("whole UGX"));

it("splits a cross-month stay by occupied nights", () => {
  expect(splitStayByMonth("2026-07-30", "2026-08-03")).toEqual([
    { month: "2026-07", nights: 2 },
    { month: "2026-08", nights: 2 }
  ]);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/domain/money.test.ts tests/domain/periods.test.ts`

Expected: FAIL with missing module errors.

- [ ] **Step 3: Implement exact domain primitives**

```ts
export type Ugx = number & { readonly __brand: "UGX" };
export function ugx(value: number): Ugx {
  if (!Number.isSafeInteger(value)) throw new Error("Money must be whole UGX");
  return value as Ugx;
}

export type MonthKey = `${number}-${string}`;
export interface MonthNightAllocation { month: MonthKey; nights: number }

export type RoleKey = "operations" | "salesMarketing" | "finance" | "itLegal" | "security" | "ceo";
export type BookingStatus = "draft" | "confirmed" | "checkedIn" | "completed" | "cancelled";
export type PaymentState = "unpaid" | "partiallyPaid" | "fullyPaid" | "overpaid" | "partiallyRefunded" | "fullyRefunded";

export interface BusinessSettings {
  businessId: string;
  name: string;
  currency: "UGX";
  unitIds: string[];
  staffRates: Record<RoleKey, number>;
  referralRate: number;
  taxProvisionPerUnit: Ugx;
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
  incomeStatement: { revenue: Ugx; purchases: Ugx; grossProfit: Ugx; operatingAndFinancialExpenses: Ugx; taxExpense: Ugx; profitBeforeTax: Ugx; netIncome: Ugx };
  balanceSheet: { currentAssets: Ugx; fixedAssets: Ugx; totalAssets: Ugx; currentLiabilities: Ugx; nonCurrentLiabilities: Ugx; equity: Ugx; totalLiabilitiesAndEquity: Ugx };
  cashFlow: { openingCash: Ugx; netMovement: Ugx; closingCash: Ugx };
  breakEven: RatioResult;
  ratios: Record<string, RatioResult>;
}
```

Implement `splitStayByMonth` using UTC date arithmetic and checkout-exclusive nights. Reject checkout on or before check-in.

- [ ] **Step 4: Encode the complete category registry**

Include every client-note category and every retained workbook category. Each expense category has `{ id, label, group, defaultScope }`; duplicate concepts such as Yaka/electricity and repairs/maintenance map to one canonical ID while preserving aliases for import/export labels.

- [ ] **Step 5: Verify category coverage**

The test must assert the presence of gas, electricity, water, solar, maintenance, DSTV, Netflix, internet, toiletries, tea, coffee, sugar, milk, hospitality, housekeeping, security, property management, travel, rent, insurance, office supplies, advertising, fuel, municipal fees, other operating expenses, interest, and cash/credit purchases.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- tests/domain && npm run typecheck`

Expected: PASS.

```bash
git add src/domain tests/domain
git commit -m "feat: define accounting domain primitives"
```

---

### Task 3: Encrypted Database, Migrations, Audit Trail, And Typed IPC

**Files:**
- Create: `src/main/db/connection.ts`
- Create: `src/main/db/migrations.ts`
- Create: `src/main/db/repositories/audit-repository.ts`
- Create: `src/shared/ipc.ts`
- Create: `src/main/ipc/register-handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/main.ts`
- Test: `tests/main/database.test.ts`
- Test: `tests/main/ipc.test.ts`

**Interfaces:**
- Produces: `openEncryptedDatabase(path, key): Database.Database`.
- Produces: schema version 1 with all entity tables required by later tasks.
- Produces: validated `invoke(channel, payload)` bridge.

- [ ] **Step 1: Write the failing encrypted-open test**

```ts
it("cannot reopen a business database without its key", () => {
  const path = tempFile("business.db");
  const db = openEncryptedDatabase(path, "correct horse battery staple");
  db.exec("insert into app_meta(key,value) values ('probe','ok')");
  db.close();
  expect(() => openEncryptedDatabase(path, "wrong key")).toThrow();
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npm test -- tests/main/database.test.ts`

Expected: FAIL because the connection module is missing.

- [ ] **Step 3: Implement encrypted connection and migration transaction**

Apply `PRAGMA key`, `cipher='sqlcipher'`, `foreign_keys=ON`, and `journal_mode=WAL` before queries. Create schema tables for businesses, units, customers, bookings, booking_months, accounts, payments, expenses, suppliers, recurring_expenses, staff_roles, staff_earnings, referrers, referral_earnings, balance_snapshots, loans, assets, inventory_snapshots, period_closes, and audit_events. Every mutable table includes `id`, `created_at`, `updated_at`, and `archived_at` where archival is valid.

- [ ] **Step 4: Implement the append-only audit repository**

```ts
export interface AuditEventInput {
  entityType: string;
  entityId: string;
  action: "create" | "update" | "reverse" | "close" | "reopen";
  reason?: string;
  before?: unknown;
  after?: unknown;
}
export interface AuditRepository { append(input: AuditEventInput): void }
```

- [ ] **Step 5: Define and validate IPC contracts**

Use Zod discriminated schemas. The renderer can invoke only named channels. Reject unknown keys and convert validation failures into `{ ok: false, code, message, fieldErrors }`.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- tests/main/database.test.ts tests/main/ipc.test.ts && npm run typecheck`

Expected: PASS.

```bash
git add src/main/db src/main/ipc src/shared/ipc.ts src/preload/index.ts src/main/main.ts tests/main
git commit -m "feat: add encrypted local data boundary"
```

---

### Task 4: Business Setup, Units, Local Unlock, And Settings

**Files:**
- Create: `src/main/db/repositories/business-repository.ts`
- Create: `src/renderer/screens/SetupScreen.tsx`
- Create: `src/renderer/screens/UnlockScreen.tsx`
- Create: `src/renderer/screens/SettingsScreen.tsx`
- Create: `src/renderer/store/app-store.ts`
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/ipc/register-handlers.ts`
- Modify: `src/renderer/App.tsx`
- Test: `tests/main/business-repository.test.ts`
- Test: `tests/renderer/setup.test.tsx`

**Interfaces:**
- Produces: `BusinessSettings` with business name, currency, units, role rates, referral rate, and per-unit tax provision.
- Produces: create/unlock/lock flows with no cloud account.

- [ ] **Step 1: Write failing defaults test**

```ts
it("creates two units and approved financial defaults", () => {
  const business = repository.create({ name: "Client Business", password: "long local password" });
  expect(business.units).toHaveLength(2);
  expect(business.staffRates).toEqual({ operations: 5, salesMarketing: 5, finance: 10, itLegal: 2, security: 5, ceo: 10 });
  expect(business.referralRate).toBe(10);
  expect(business.taxProvisionPerUnit).toBe(600_000);
});
```

- [ ] **Step 2: Implement repository and setup questionnaire**

Ask for business name, two unit names, local password, and confirmation of approved defaults. Show the calculated UGX 1,200,000 monthly provision before creation. Store rate changes with effective dates.

- [ ] **Step 3: Implement Settings views**

Provide units, compensation, referral, tax provision, categories, accounts, backup, and security tabs. Require a reason when changing a rate effective in a closed or historical period.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- tests/main/business-repository.test.ts tests/renderer/setup.test.tsx && npm run typecheck`

Expected: PASS.

```bash
git add src/main/db/repositories/business-repository.ts src/renderer src/shared/ipc.ts src/main/ipc tests
git commit -m "feat: add local business setup and settings"
```

---

### Task 5: Customers, Manual Bookings, And Overlap-Safe Unit Schedule

**Files:**
- Create: `src/domain/bookings.ts`
- Create: `src/main/db/repositories/booking-repository.ts`
- Create: `src/renderer/screens/BookingsScreen.tsx`
- Create: `src/renderer/components/BookingEditor.tsx`
- Create: `src/renderer/components/UnitSchedule.tsx`
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/ipc/register-handlers.ts`
- Test: `tests/domain/bookings.test.ts`
- Test: `tests/main/booking-repository.test.ts`
- Test: `tests/renderer/booking-editor.test.tsx`

**Interfaces:**
- Produces: `calculateBookingTotal(input): Ugx`.
- Produces: `overlaps(a, b): boolean` using checkout-exclusive ranges.
- Produces: booking CRUD with Draft, Confirmed, CheckedIn, Completed, and Cancelled states.

- [ ] **Step 1: Write failing overlap and total tests**

```ts
expect(overlaps(
  { checkIn: "2026-07-10", checkOut: "2026-07-12" },
  { checkIn: "2026-07-12", checkOut: "2026-07-14" }
)).toBe(false);
expect(calculateBookingTotal({ nights: 3, nightlyRate: ugx(180_000), adjustment: ugx(-20_000) })).toBe(520_000);
```

- [ ] **Step 2: Implement booking rules and repository transaction**

Validate unit, customer, dates, whole-UGX rate, adjustment, referral fields, and state transitions. Recheck overlap inside the database transaction before confirming to prevent stale UI conflicts.

- [ ] **Step 3: Implement the compact manual-entry editor**

The editor contains unit, customer/contact, check-in/out, nightly rate, adjustment, referral, referrer, initial payment, and notes. Display nights and total immediately. Keep advanced fields collapsed. Save a booking without payment as Unpaid.

- [ ] **Step 4: Implement list and unit schedule views**

Use tabs for Schedule and List. Schedule uses stable unit rows and day columns; List supports status, unit, customer, dates, total, and balance filters. Both open the same booking detail.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/domain/bookings.test.ts tests/main/booking-repository.test.ts tests/renderer/booking-editor.test.tsx`

Expected: PASS.

```bash
git add src/domain/bookings.ts src/main/db/repositories/booking-repository.ts src/renderer src/shared/ipc.ts src/main/ipc tests
git commit -m "feat: add manual booking workflow"
```

---

### Task 6: Multiple Payments, Refunds, Accounts, And Customer Balances

**Files:**
- Create: `src/domain/payments.ts`
- Create: `src/main/db/repositories/payment-repository.ts`
- Create: `src/renderer/screens/PaymentsScreen.tsx`
- Create: `src/renderer/components/PaymentEditor.tsx`
- Create: `src/renderer/components/BookingBalance.tsx`
- Modify: `src/renderer/components/BookingEditor.tsx`
- Test: `tests/domain/payments.test.ts`
- Test: `tests/main/payment-repository.test.ts`
- Test: `tests/renderer/payment-editor.test.tsx`

**Interfaces:**
- Produces: `summarizeBookingBalance(total, movements): BookingBalanceSummary`.
- Produces: receipt, refund, and reversal records; records are never silently overwritten.

- [ ] **Step 1: Write the failing multiple-payment test**

```ts
expect(summarizeBookingBalance(ugx(900_000), [
  { direction: "receipt", amount: ugx(300_000) },
  { direction: "receipt", amount: ugx(600_000) },
  { direction: "refund", amount: ugx(100_000) }
])).toEqual({ received: 900_000, refunded: 100_000, netReceived: 800_000, due: 100_000, state: "partiallyPaid" });
```

- [ ] **Step 2: Implement payment rules**

Require positive amounts, date, method, and account. Support cash, mobile money, bank transfer, and card. Warn on overpayment; prevent refunds beyond net receipts unless an explicit additional-settlement reason is recorded.

- [ ] **Step 3: Implement payment UI and booking timeline**

Show total, received, refunded, net received, and due. Display each movement with method/reference. Use reversal/correction commands with a required reason.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- tests/domain/payments.test.ts tests/main/payment-repository.test.ts tests/renderer/payment-editor.test.tsx`

Expected: PASS.

```bash
git add src/domain/payments.ts src/main/db/repositories/payment-repository.ts src/renderer src/shared src/main/ipc tests
git commit -m "feat: track booking payments and refunds"
```

---

### Task 7: Occupied-Month Revenue, Eligible Collections, Staff, And Referrals

**Files:**
- Create: `src/domain/revenue-allocation.ts`
- Create: `src/domain/compensation.ts`
- Create: `src/renderer/screens/StaffScreen.tsx`
- Create: `src/renderer/components/CalculationTrace.tsx`
- Modify: `src/main/db/repositories/booking-repository.ts`
- Modify: `src/main/db/repositories/payment-repository.ts`
- Test: `tests/domain/revenue-allocation.test.ts`
- Test: `tests/domain/compensation.test.ts`

**Interfaces:**
- Produces: `allocateEligibleCollection(input): StayMonthAllocation[]`.
- Produces: `calculateCompensation(base, rates): StaffEarning[]`.
- Produces: `calculateReferral(base, rate): Ugx`.

- [ ] **Step 1: Write failing cross-month and collection tests**

```ts
it("attributes earnings to occupied months and unlocks them on collection", () => {
  const result = allocateEligibleCollection({
    checkIn: "2026-07-30",
    checkOut: "2026-08-03",
    accommodationTotal: ugx(800_000),
    eligibleCollected: ugx(400_000),
    completed: true
  });
  expect(result).toEqual([
    { month: "2026-07", earnedRevenue: 400_000, payableBase: 200_000 },
    { month: "2026-08", earnedRevenue: 400_000, payableBase: 200_000 }
  ]);
});
```

- [ ] **Step 2: Implement Net Collected Booking Revenue**

Exclude cleaning fees, pass-through guest taxes, refundable deposits, refunded accommodation, and payment-processing charges assigned to accommodation. Require a completed stay. Allocate partial eligible collections proportionally across occupied-night months until each month's earned revenue is fully unlocked.

- [ ] **Step 3: Implement exact staff and referral calculations**

```ts
export const DEFAULT_STAFF_RATES = {
  operations: 5,
  salesMarketing: 5,
  finance: 10,
  itLegal: 2,
  security: 5,
  ceo: 10
} as const;

export function percentageOf(base: Ugx, rate: number): Ugx {
  return ugx(Math.round((base * rate) / 100));
}
```

Record residual rounding deterministically on the final role statement so totals reconcile.

- [ ] **Step 4: Implement Staff screen**

Show month, NCBR base, each role rate/earning, adjustments, paid, due, and per-booking trace. Add a Referrals tab with booking, referrer, base, rate, earned, paid, and due.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/domain/revenue-allocation.test.ts tests/domain/compensation.test.ts`

Expected: PASS, including zero-business months.

```bash
git add src/domain src/renderer/screens/StaffScreen.tsx src/renderer/components/CalculationTrace.tsx src/main/db tests/domain
git commit -m "feat: calculate activity-based compensation"
```

---

### Task 8: Expenses, Suppliers, Credit Purchases, And Recurring Templates

**Files:**
- Create: `src/main/db/repositories/expense-repository.ts`
- Create: `src/renderer/screens/ExpensesScreen.tsx`
- Create: `src/renderer/components/ExpenseEditor.tsx`
- Create: `src/renderer/components/RecurringExpenseReview.tsx`
- Test: `tests/main/expense-repository.test.ts`
- Test: `tests/renderer/expense-editor.test.tsx`

**Interfaces:**
- Produces: property-unit or Shared expense records.
- Produces: supplier bills with paid/partial/unpaid states.
- Produces: recurring templates that require review before posting.

- [ ] **Step 1: Write category and supplier-balance tests**

Test one Yaka expense assigned to Unit 1, one shared Netflix expense, one credit maintenance purchase, and a partial supplier payment. Assert the category totals and remaining payable.

- [ ] **Step 2: Implement expense repository transaction**

Store amount, date, category, scope, supplier, cash/credit classification, account, due date, reference, and note. A credit purchase creates a payable; supplier payments reduce it without rewriting the original expense.

- [ ] **Step 3: Implement fast expense entry and review**

Place date, amount, category, scope, and payment status first. Show contextual fields only for supplier credit, recurring templates, or shared allocation. Include filters by unit, category, supplier, status, and month.

- [ ] **Step 4: Verify complete category display**

Use the category coverage test from Task 2 and a renderer test that opens each category group without clipped labels at 1280x720.

- [ ] **Step 5: Run and commit**

Run: `npm test -- tests/main/expense-repository.test.ts tests/renderer/expense-editor.test.tsx`

Expected: PASS.

```bash
git add src/main/db/repositories/expense-repository.ts src/renderer tests
git commit -m "feat: add property expense and supplier tracking"
```

---

### Task 9: Financial Position, Assets, Loans, Inventory, Tax Provision, And Month Close

**Files:**
- Create: `src/main/db/repositories/finance-repository.ts`
- Create: `src/renderer/screens/FinancialPositionScreen.tsx`
- Create: `src/renderer/components/MonthEndQuestionnaire.tsx`
- Create: `src/renderer/components/AssetEditor.tsx`
- Create: `src/renderer/components/LoanEditor.tsx`
- Test: `tests/main/finance-repository.test.ts`
- Test: `tests/renderer/month-end.test.tsx`

**Interfaces:**
- Produces: month-end balances for cash, banks, deposits, receivables, inventory, payables, loans, assets, and equity.
- Produces: `calculateTaxProvision(activeUnitCount, perUnitAmount): Ugx`.
- Produces: close/reopen with reason and audit event.

- [ ] **Step 1: Write the approved provision test**

```ts
expect(calculateTaxProvision(2, ugx(600_000))).toBe(1_200_000);
expect(calculateAnnualProvision(2, ugx(600_000))).toBe(14_400_000);
```

- [ ] **Step 2: Implement financial-position records**

Support cash, bank/mobile-money, deposits over one year, customer/other receivables, guest-supply inventory, provider/staff/referral/tax/pension payables, short/long bank and non-bank loans, interest-free loans, owner capital/drawings, and fixed assets.

- [ ] **Step 3: Implement month-end questionnaire**

Use the nine approved sections from the design. Pre-fill inferred totals. Save progress after each section. Display exceptions first and block close while accounting is unbalanced.

- [ ] **Step 4: Implement close and reopen**

Closing locks ordinary mutations for the month. Reopening requires a non-empty reason and appends an audit event. Reports show a visible Open, Closed, or Reopened state.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/main/finance-repository.test.ts tests/renderer/month-end.test.tsx`

Expected: PASS.

```bash
git add src/main/db/repositories/finance-repository.ts src/renderer tests
git commit -m "feat: add financial position and month close"
```

---

### Task 10: Accounting Engine, Workbook Reconciliation, Statements, Break-Even, And Ratios

**Files:**
- Create: `src/domain/accounting.ts`
- Create: `fixtures/easyaccounts-coverage.json`
- Create: `src/renderer/screens/ReportsScreen.tsx`
- Create: `src/renderer/components/ReportTable.tsx`
- Create: `src/renderer/components/RatioTable.tsx`
- Test: `tests/domain/accounting.test.ts`
- Test: `tests/domain/workbook-coverage.test.ts`

**Interfaces:**
- Produces: `buildFinancialReport(input): FinancialReport`.
- Produces: summary/detailed income statement, summary/detailed balance sheet, cash flow, break-even, and ten approved ratios.

- [ ] **Step 1: Create workbook-derived fixture**

Encode every label from `Transactions!A4:A73` and `FInancial Statements!A4:A94`, plus a non-zero twelve-month scenario. Store expected totals for revenue, purchases, gross profit, operating/financial expenses, tax provision, net income, current/fixed assets, current/non-current liabilities, equity, cash flow, and break-even.

- [ ] **Step 2: Write failing statement and safe-ratio tests**

```ts
expect(report.balanceSheet.totalAssets).toBe(report.balanceSheet.totalLiabilitiesAndEquity);
expect(report.ratios.currentRatio).toEqual({ state: "unavailable", reason: "Current liabilities are zero" });
expect(report.incomeStatement.netIncome).toBe(
  report.incomeStatement.profitBeforeTax - report.incomeStatement.taxExpense
);
```

- [ ] **Step 3: Implement ledger projection and reports**

Project operational records into canonical account groups. Use one source of truth for all dashboard/report totals. Break-even uses fixed costs divided by contribution-margin ratio and returns unavailable when contribution margin is not positive.

- [ ] **Step 4: Implement all ratios**

Inventory turnover, receivables turnover, current ratio, quick ratio, debt/assets, debt/equity, ROA, ROE, working capital, and net profit margin return typed available/unavailable results with explanations.

- [ ] **Step 5: Build report UI**

Support month, custom period, year, unit, and consolidated filters. Use tabs for Overview, Income Statement, Balance Sheet, Cash Flow, Break-Even, and Ratios. Keep summary first and detailed drill-down available.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- tests/domain/accounting.test.ts tests/domain/workbook-coverage.test.ts`

Expected: PASS with accounting equation and cash-flow checks equal to zero.

```bash
git add src/domain/accounting.ts fixtures src/renderer/screens/ReportsScreen.tsx src/renderer/components tests/domain
git commit -m "feat: add workbook-complete financial reporting"
```

---

### Task 11: Daily Command Center And Cross-Screen Actions

**Files:**
- Create: `src/renderer/screens/TodayScreen.tsx`
- Create: `src/renderer/components/KpiStrip.tsx`
- Create: `src/renderer/components/TodayAgenda.tsx`
- Create: `src/renderer/components/ActionCenter.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/AppShell.tsx`
- Test: `tests/renderer/today.test.tsx`

**Interfaces:**
- Consumes: booking, payment, expense, compensation, provision, and accounting read models.
- Produces: action-oriented dashboard matching the approved visual design.

- [ ] **Step 1: Write failing dashboard reconciliation test**

Render a fixture with two units, one arrival, one departure, one overdue balance, staff due, expenses, and provision. Assert all visible totals exactly match the report read model and every warning links to its source screen.

- [ ] **Step 2: Implement the command center**

Show date, New Booking, Record Payment, Add Expense, occupancy, collected, outstanding, net position, today's agenda, unit status, staff allocation, tax provision, expenses, and action warnings. Do not introduce additional dashboard-only calculations.

- [ ] **Step 3: Verify keyboard and 1280x720 layout**

Tab order begins with quick actions, proceeds through warnings, then navigation. No KPI, label, or action overlaps or truncates at 1280x720.

- [ ] **Step 4: Run and commit**

Run: `npm test -- tests/renderer/today.test.tsx && npm run typecheck`

Expected: PASS.

```bash
git add src/renderer tests/renderer/today.test.tsx
git commit -m "feat: add daily property command center"
```

---

### Task 12: Backups, Excel Export, Print Views, Accessibility, Packaging, And Final Verification

**Files:**
- Create: `src/main/backup.ts`
- Create: `src/domain/export-workbook.ts`
- Create: `src/main/export.ts`
- Modify: `src/renderer/screens/SettingsScreen.tsx`
- Create: `tests/main/backup.test.ts`
- Create: `tests/domain/export-workbook.test.ts`
- Create: `tests/e2e/app.spec.ts`
- Create: `playwright.config.ts`
- Create: `docs/research/easyaccounts-market-notes.md`

**Interfaces:**
- Produces: encrypted backup/restore with validation.
- Produces: Excel workbook with operational data and financial reports.
- Produces: Windows and macOS distributables.

- [ ] **Step 1: Write backup and export tests**

Create a populated temporary business, back it up, restore it under a new path, and compare report totals. Export to Excel and assert sheets for Dashboard, Bookings, Payments, Expenses, Staff, Financial Position, Income Statement, Balance Sheet, Cash Flow, Break-Even, and Ratios.

- [ ] **Step 2: Implement explicit local backup and restore**

Use SQLite online backup while the database is open. Encrypt backups with the business key. Validate schema version and integrity before replacing an active database. Never overwrite without confirmation.

- [ ] **Step 3: Implement Excel and print exports**

Use SheetJS with typed numeric cells, UGX formats, real dates, frozen headers, readable widths, and formula-free report snapshots. Include export date, business, period, and unit/consolidated scope.

- [ ] **Step 4: Write the complete end-to-end flow**

The test creates a business, records a July/August booking, takes deposit and final payment through different methods, completes the stay, records Yaka and housekeeping expenses, confirms staff percentages and tax provision, closes July, and verifies statements and exports.

- [ ] **Step 5: Run design and accessibility review**

Use Impeccable for product-UI audit and Taste for final hierarchy/spacing review. Use Emil's animation review only if motion was added. Fix all WCAG AA contrast, focus, overflow, reduced-motion, and 1280x720 findings. Capture Playwright screenshots of Today, Booking Editor, Payments, Expenses, Staff, Financial Position, and Reports on macOS-sized and Windows-sized viewports.

- [ ] **Step 6: Run the full verification suite**

Run: `npm test && npm run typecheck && npm run test:e2e && npm run make`

Expected: all tests pass; Electron Forge produces macOS ZIP on macOS and Windows Squirrel output on Windows CI. Native installers are built on their target operating systems.

- [ ] **Step 7: Commit**

```bash
git add src tests playwright.config.ts forge.config.ts docs/research
git commit -m "feat: ship backed-up exportable desktop app"
```

---

## Execution Notes

- Use a dedicated git worktree before Task 1.
- Execute tasks sequentially because later slices consume earlier contracts.
- Within a task, parallelize read-only inspection and independent test runs; do not let agents edit the same files concurrently.
- After every task, run a specification-compliance review followed by a code-quality review before merging its commit.
- Keep user-visible terminology aligned with the design spec: customer, booking, unit, payment, expense, staff earning, referral, tax provision, financial position, and reports.
- Pause for user review after Task 5 (bookings), Task 7 (compensation), Task 11 (complete daily workflow), and Task 12 (release candidate).

## Self-Review

- Spec coverage: Tasks 1-12 cover every approved product, accounting, privacy, desktop, reporting, backup, and packaging requirement.
- Workbook coverage: Task 10 explicitly maps all transaction labels, statements, break-even, cash flow, and ten ratios.
- Client-note coverage: Tasks 4-9 include two units, manual entry, percentage roles, referral commission, tax provision, and every handwritten expense category.
- Type consistency: `Ugx`, `MonthKey`, `BusinessSettings`, `BookingBalanceSummary`, `StayMonthAllocation`, `StaffEarning`, and `FinancialReport` are defined before consumption.
- Execution safety: task boundaries prevent concurrent edits to shared domain and persistence modules.
