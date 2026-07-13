# Short-Stay Property Accounting Desktop Design

**Status:** Approved for implementation planning

**Date:** 2026-07-13

## Purpose

Build a fast, private desktop accounting application for a client operating two short-stay accommodation units. The app must make daily booking, payment, expense, and staff-allocation work easy while preserving the useful accounting depth of the Uganda Easy Accounts workbook.

The product runs locally on the client's Windows or macOS computer through Electron. It does not depend on Airbnb, a cloud account, an external booking platform, or a remote financial database.

## Sources

- Client workflow note: `/Users/turigyemicheal/Desktop/IMG_1787.jpg`
- Easy Accounts workbook: `/Users/turigyemicheal/Downloads/easyaccounts.xlsx`
- Existing implementation plan: `docs/superpowers/plans/2026-07-09-easyaccounts-desktop-mvp.md`
- Official Easy Accounts reference: `https://uganda.easyaccounts.org/`

The workbook has two sheets, `Transactions` and `FInancial Statements`. Its intended categories and reports are preserved, but obvious spreadsheet defects such as misspellings, inconsistent copied formulas, and division-by-zero displays are not reproduced.

## Product Principles

1. Daily work starts from guests, units, bookings, payments, and expenses rather than accounting jargon.
2. A routine booking or payment creates the corresponding accounting data automatically.
3. Questions are asked only when the answer cannot be inferred from recorded activity.
4. Every calculated amount has a visible explanation and source trail.
5. Core bookkeeping works without internet access.
6. Financial data remains local unless the user intentionally exports it.
7. The interface stays dense enough for repeated work but readable for a non-accountant.

## Scope

### Included

- Configurable properties and units, initially two units
- Manual booking entry
- Guest and customer records
- Multiple payments per booking
- Cash, mobile money, bank transfer, and card payment methods
- Partial, fully paid, overdue, cancelled, and refunded states
- Occupied-night and monthly allocation calculations
- Percentage-based staff compensation
- Optional referral commission
- Property-specific and shared expenses
- Manual tax provision tracking
- Cash, bank, receivable, payable, inventory, loan, asset, and equity balances
- Summary and detailed financial reports
- Per-unit and consolidated reporting
- Encrypted local storage, backup, and export
- Windows and macOS packaging

### Excluded From The First Release

- Airbnb branding, accounts, APIs, imports, or synchronization
- Other booking-platform integrations
- Cloud accounts or cloud synchronization
- Automatic bank or mobile-money synchronization
- Automatic tax filing or representation of a manual provision as a statutory assessment
- Multi-user network collaboration
- Inventory quantity management beyond financially relevant guest-supply balances

## Information Architecture

The permanent navigation is:

1. **Today** - daily command center
2. **Bookings** - calendar, booking list, guest stays, and booking details
3. **Payments** - collections, refunds, methods, references, and balances
4. **Expenses** - operating costs, purchases, suppliers, and recurring expenses
5. **Staff** - role rates, earnings, payment status, and calculation trace
6. **Financial Position** - cash, banks, receivables, inventory, payables, loans, assets, and equity
7. **Reports** - statements, cash flow, break-even, trends, and ratios
8. **Settings** - business, units, rates, tax provision, categories, backups, and security

`New Booking`, `Record Payment`, and `Add Expense` are available as persistent commands.

## Daily Command Center

The first screen shows only information that helps the client act today:

- Today's arrivals and departures
- Occupied and available units
- Current-month occupancy percentage
- Revenue collected this month
- Customer balances outstanding
- Expenses recorded this month
- Current net position
- Staff allocation earned and unpaid
- Monthly tax provision and amount funded
- Booking conflicts, overdue balances, missing payments, and other warnings
- Quick actions for booking, payment, and expense entry

Accounting statements and less frequent balances remain one navigation level away so the dashboard does not become a wall of figures.

## Booking Workflow

The compact booking questionnaire asks for:

- Unit
- Customer name
- Phone and optional email
- Check-in date and time
- Check-out date and time
- Nightly rate
- Optional adjustments or discounts
- Referral yes/no
- Referrer when applicable
- Initial payment, payment date, method, and reference
- Optional notes

The app calculates nights and booking value immediately. It prevents overlapping active bookings for the same unit. A booking may be saved without payment and then appears as unpaid.

### Booking States

- Draft
- Confirmed
- Checked in
- Completed
- Cancelled

Payment state is separate:

- Unpaid
- Partially paid
- Fully paid
- Overpaid
- Refunded in part
- Refunded in full

Cancelling or changing dates never silently deletes payments. The app asks whether money is retained, transferred, or refunded and records the decision.

## Payment Workflow

One booking can have any number of payments and refunds. Each money movement records:

- Booking or customer
- Direction: receipt or refund
- Amount in UGX
- Date and time
- Method: cash, mobile money, bank transfer, or card
- Reference or transaction identifier
- Account receiving or paying the money
- Optional note

The booking detail shows total value, received, refunded, net received, and remaining balance. Payment corrections use reversal or an explicit correction record so the audit trail remains understandable.

## Monthly Revenue Allocation

A stay spanning multiple months is divided by occupied nights in each month.

Example: a four-night stay covering July 30 through August 3 allocates two nights to July and two nights to August. Discounts attributable to the whole stay are allocated proportionally by occupied night unless the user assigns a specific amount to a month.

### Net Collected Booking Revenue

All six staff-role percentages use Net Collected Booking Revenue as their base.

For a reporting month:

`Net Collected Booking Revenue = eligible completed-stay accommodation revenue collected - accommodation refunds - payment-processing charges assigned to that revenue - pass-through guest taxes - refundable deposits`

Rules:

- Only completed-stay occupied nights are eligible.
- Only money actually collected is eligible.
- Cleaning fees are excluded by default.
- Refundable deposits are excluded.
- Cancelled nights are excluded unless retained revenue is deliberately reclassified as eligible cancellation income.
- Cross-month stays are allocated by occupied nights.
- When collection is lower than earned eligible revenue, staff earnings are limited to the eligible collected amount.
- Earnings remain attributed to the occupied-night month. If the customer pays later, the related earning becomes payable on collection without moving the stay revenue or performance into the collection month.

## Staff Compensation

The initial role rates are:

| Role | Rate |
|---|---:|
| Operations Manager | 5% |
| Sales and Marketing | 5% |
| Finance | 10% |
| IT and Legal | 2% |
| Security | 5% |
| CEO | 10% |
| **Total** | **37%** |

Rates are configurable from Settings with effective dates. Historical calculations keep the rate that was active for the relevant period.

Each monthly staff statement shows:

- Net Collected Booking Revenue base
- Role rate
- Gross role earning
- Adjustments with reasons
- Amount paid
- Amount due
- Payment dates and methods
- Per-booking calculation drill-down

The app warns when changed rates exceed 100% in total but does not silently alter user-entered rates.

## Referral Commission

Referral commission is optional per booking and initially 10%.

The base is eligible collected accommodation revenue for that referred booking, excluding cleaning fees, taxes, refundable deposits, cancellations refunded to the guest, and unrelated charges. A referral statement shows earned, paid, and due amounts by referrer and booking.

## Tax Provision

The client-selected planning amount is UGX 600,000 per unit per month.

For the initial two units:

- Monthly provision: UGX 1,200,000
- Annual provision: UGX 14,400,000

The app records this as a configurable **manual tax provision**, including provision amount, funding, payment, date, reference, and remaining balance.

This provision is not labeled as a statutory tax calculation or guaranteed legal liability. The app retains complete actual revenue and expense records, keeps statutory estimates separate when provided, and does not suppress activity or automate a knowingly false return.

## Income Categories

- Short-stay booking revenue
- Customer cancellation income when retained
- Owner investment or capital contribution
- Other operating income
- Other non-operating income
- Cash and credit classification where relevant

Owner investment is never included in operating revenue or staff compensation.

## Expense Categories

### Client Property Categories

- Gas
- Yaka/electricity
- Water
- Solar
- Maintenance
- DSTV
- Netflix
- Internet
- Toiletries
- Complimentary tea
- Complimentary coffee
- Complimentary sugar
- Complimentary milk
- Other guest amenities
- Hospitality services
- Housekeeping
- Security
- Property management

### Easy Accounts Categories Retained

- Salaries and staff allocations
- Travel costs
- Rent
- Insurance
- Repairs and maintenance
- Office supplies
- Advertising and marketing
- Electricity
- Water
- Phone and internet
- Fuel
- Municipal fees
- Other operating expenses
- Interest paid
- Cash purchases
- Credit purchases

Categories can be assigned to Unit 1, Unit 2, another configured unit, or Shared. Shared costs appear at business level and can optionally be allocated to units for management reporting without changing the legal books.

Recurring expenses are templates, not automatically confirmed transactions. The client reviews and posts the actual amount for each period.

## Easy Accounts Coverage Matrix

| Workbook Area | Product Destination |
|---|---|
| Cash sales and credit sales | Bookings, Payments, and Income reports |
| Cash and credit purchases | Expenses and supplier balances |
| Operating and financial expenses | Expenses with client-specific subcategories |
| Cash on hand and current bank accounts | Financial Position and Payment accounts |
| Deposits over one year | Financial Position, non-current financial assets |
| Customer and other receivables | Payments and Financial Position |
| Inventory of goods | Guest Supplies and Financial Position |
| Short-term bank and non-bank loans | Financial Position, current liabilities |
| Interest-bearing and interest-free loans | Loan details and interest expense |
| Commissions due | Staff/referral obligations and payables |
| Provider payments and credit purchases | Suppliers and accounts payable |
| Taxes, fees, and pension amounts due | Obligations and Financial Position |
| Long-term bank and non-bank loans | Financial Position, non-current liabilities |
| Furniture, machinery, and equipment | Asset register |
| Vehicles, land, and buildings | Asset register |
| Owner/shareholder equity | Capital and Financial Position |
| Summary and detailed income statement | Reports |
| Summary and detailed balance sheet | Reports |
| Cash flow | Reports |
| Break-even | Reports |
| Inventory and receivables turnover | Reports, activity ratios |
| Current and quick ratio | Reports, liquidity ratios |
| Debt/assets and debt/equity | Reports, debt ratios |
| ROA, ROE, working capital, and net margin | Reports, profitability and other ratios |

## Financial Position

The client can record month-end or transaction-level balances for:

- Cash on hand
- Bank and mobile-money accounts
- Long-term deposits
- Customer receivables
- Other receivables
- Guest-supply inventory
- Supplier payables
- Staff and referral amounts due
- Taxes and fees due
- Pension amounts due
- Bank and non-bank loans under 12 months
- Bank and non-bank loans over 12 months
- Interest-free loans from friends or family
- Owner capital and drawings
- Fixed assets

### Fixed Asset Register

Each asset records category, description, purchase date, amount, supplier, payment method, assigned unit or Shared, optional useful life, and status. Categories are furniture, machinery, equipment, vehicles, land, and buildings.

Depreciation is excluded from the first release unless the user later approves a specific accounting policy.

## Reports

Reports support current month, custom period, calendar year, individual unit, and consolidated business views where meaningful.

### Operational Reports

- Occupancy and available nights
- Revenue per occupied night
- Booking and customer balances
- Collections by payment method
- Expense breakdown by unit and category
- Staff earnings and payments
- Referral commissions
- Tax provision funding

### Financial Statements

- Summary income statement
- Detailed income statement
- Summary balance sheet
- Detailed balance sheet
- Cash-flow statement
- Break-even analysis

### Ratios

- Inventory turnover
- Receivables turnover
- Current ratio
- Quick ratio
- Debt to assets
- Debt to equity
- Return on assets
- Return on equity
- Working capital
- Net profit margin

Ratios with a zero denominator display `Not available` with an explanation rather than a spreadsheet error.

## Guided Month-End Questionnaire

The month-end review shows progress and asks only unresolved questions:

1. Confirm completed bookings and collections.
2. Confirm uncategorized or recurring expenses.
3. Enter cash on hand and verify bank/mobile-money balances.
4. Confirm unpaid customer balances and supplier bills.
5. Confirm inventory/guest-supply value.
6. Record new loans, repayments, assets, owner investments, or drawings.
7. Review staff and referral calculations.
8. Confirm the manual tax provision and payments.
9. Review exceptions and close the month.

Closing a month locks ordinary editing. Reopening requires a reason and records who reopened it and when.

## Data Model Boundaries

The core modules are intentionally separate:

- **Business and Units** - profile, units, reporting settings
- **Customers** - reusable contact records
- **Bookings** - stay dates, rates, state, unit allocation
- **Payments** - receipts, refunds, accounts, references
- **Expenses and Suppliers** - costs, purchases, recurring templates, payables
- **Compensation** - role rates, referral rules, earnings, payments
- **Financial Position** - accounts, balances, loans, inventory, assets, equity
- **Accounting Engine** - period allocation, ledgers, statements, ratios
- **Reports and Exports** - read-only projections of accounting data
- **Audit Trail** - corrections, reversals, month close/reopen events

A module communicates through typed interfaces and does not directly mutate another module's storage.

## Data Flow

1. The user records a booking.
2. The booking engine validates dates and unit availability.
3. Payments and refunds are recorded independently against the booking.
4. The allocation engine divides eligible stay revenue by occupied month.
5. The compensation engine calculates staff and referral earnings from eligible collections.
6. Expenses and financial-position events feed the accounting engine.
7. The accounting engine produces statements, cash flow, break-even, and ratios.
8. The dashboard and reports read calculated projections; they never contain separate hardcoded totals.

## Error Handling And Validation

- Prevent overlapping active bookings for one unit.
- Reject checkout dates that are not after check-in dates.
- Reject zero or negative payment amounts; use refund/reversal flows instead.
- Warn before recording payments above the outstanding booking balance.
- Prevent refunds beyond net receipts unless explicitly recorded as an additional settlement.
- Require reasons for corrections, adjustments, month reopen, and manual balance overrides.
- Preserve valid work when one questionnaire section has an error.
- Show plain-language errors next to the affected field.
- Store money as integer UGX amounts.
- Use safe division and explanatory unavailable states in ratios.
- Detect unbalanced accounting periods before month close.

## Privacy And Security

- Core operation requires no account and no internet connection.
- Database is encrypted at rest.
- The user unlocks the business file with a local password.
- Renderer code has no direct filesystem or database access.
- Electron context isolation is enabled and Node integration is disabled.
- Typed, validated IPC exposes only required operations.
- No telemetry, analytics, or automatic financial-data upload is included.
- Backups are encrypted and created only on user action or an explicitly enabled local schedule.
- Destructive actions require confirmation and favor archive/reversal over deletion.

## Desktop Visual Design

The product is a work-focused desktop tool:

- Restrained neutral surfaces with semantic green, amber, red, and blue accents
- High-contrast text meeting WCAG AA
- Stable sidebar and compact command bar
- Tables and lists for repeated accounting data
- Cards only for compact KPI groups and clearly bounded repeated records
- No marketing hero, decorative gradients, glass effects, or nested cards
- Icons accompany familiar commands; labels remain where ambiguity is possible
- Keyboard access for all controls
- Clear focus states and reduced-motion support
- Layout supports common laptop sizes and remains usable at 1280×720

The working `StayBooks` name in the visual mockup is provisional. The final app uses the approved product name or the client's business name and does not use Airbnb branding.

## Local Architecture

- Electron desktop shell for Windows and macOS
- React and TypeScript renderer
- Typed preload bridge and validated IPC
- Encrypted local SQLite database
- Pure TypeScript accounting and allocation engines
- Deterministic local calculations
- Excel export and print/PDF-ready report views

The database lives in the operating system's application-data directory. Business files and backups are portable through explicit export/import operations.

## Testing Strategy

### Unit Tests

- Night counts and overlap rules
- Cross-month occupied-night allocation
- Partial collections and later collections
- Refunds, cancellations, and retained cancellation income
- Net Collected Booking Revenue exclusions
- Every staff role percentage
- Referral commission eligibility
- Manual tax provision for configurable unit counts
- Expense and financial-position classifications
- Statement and ratio calculations
- Safe zero-denominator handling

### Integration Tests

- Booking through multiple payments to completed stay
- Booking correction and refund audit trail
- Monthly close, reopen, and recalculation
- Persistence and encrypted database reopening
- Backup and restore
- Excel export reconciliation

### End-To-End Tests

- Create a two-unit business
- Record a cross-month booking
- Take a deposit and final payment through different methods
- Record client-note expense categories
- Close a month
- Verify dashboard, staff earnings, tax provision, statements, and reports
- Package and launch on Windows and macOS

### Financial Reconciliation

Fixtures derived from the Easy Accounts workbook verify category totals and intended reports. The implementation uses independently tested formulas rather than copying workbook formula errors. Every fixture must satisfy the accounting equation and cash-flow reconciliation.

## Acceptance Criteria

The first release is acceptable when:

1. A non-accountant can create a booking with an initial payment in under one minute.
2. Overlapping bookings cannot be accidentally confirmed.
3. Multiple payments and refunds produce an accurate customer balance.
4. Cross-month stays allocate revenue by occupied night.
5. Staff earnings match the approved 5/5/10/2/5/10 percentages of Net Collected Booking Revenue.
6. Referral commission is optional and traceable per booking.
7. The two-unit manual tax provision equals UGX 1,200,000 per month and UGX 14,400,000 per year.
8. Every handwritten expense category is available.
9. Every relevant Easy Accounts category and report has a product destination.
10. Dashboard totals reconcile to detailed records and financial statements.
11. Ratios never display raw spreadsheet errors.
12. The application works offline and stores financial data locally in encrypted form.
13. The client can back up and export data without a cloud service.
14. Keyboard navigation, focus visibility, text contrast, and common laptop layouts pass UI verification.

## Implementation Sequence

The implementation plan should deliver working, testable slices in this order:

1. Secure desktop shell, local business file, units, and design foundation
2. Customers, bookings, overlap validation, and calendar/list views
3. Multiple payments, refunds, accounts, and customer balances
4. Cross-month revenue and Net Collected Booking Revenue engine
5. Staff and referral compensation
6. Client-specific expenses and supplier/payable workflow
7. Financial Position, month-end questionnaire, and month close
8. Statements, cash flow, break-even, ratios, and workbook reconciliation
9. Backup, Excel export, packaging, accessibility, and end-to-end verification
