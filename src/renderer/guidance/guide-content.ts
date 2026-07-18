import type { GlossaryEntry, GuideChapter, GuideChecklist, TourDefinition } from "./types";

export const guideChapters: GuideChapter[] = [
  {
    id: "orientation", title: "Orientation", screen: "today", keywords: ["today", "dashboard", "sidebar", "attention", "unit", "lock"],
    summary: "Learn what needs action today and where new records begin.",
    sections: [
      { heading: "Start with Today", paragraphs: ["The Today screen brings together arrivals, departures, balances, and work requiring attention.", "Use the attention list and unit status to decide the next action; this screen does not change records by itself."] },
      { heading: "Move and protect", paragraphs: ["The sidebar opens each accounting area. The command bar starts a booking, payment, or expense from anywhere.", "Lock when leaving the computer. Short-Stay Accounts is local and private, so keep the local password safe."] },
    ],
  },
  {
    id: "bookings", title: "Booking Lifecycle", screen: "bookings", keywords: ["booking", "guest", "customer", "check in", "check out", "nightly rate", "fixed", "one room", "monthly rent", "remove", "airbnb"],
    summary: "Enter and manage a guest stay from draft through checkout.",
    sections: [
      { heading: "Create a manual booking", paragraphs: ["Select the customer and unit, then choose Two bedrooms or One room only. Use a nightly rate for ordinary stays or Monthly rent for monthly and negotiated rent.", "Bookings are entered manually. Short-Stay Accounts is not connected to Airbnb or another booking platform."] },
      { heading: "Track and correct the stay", paragraphs: ["Use Draft, Confirmed, Checked in, Completed, and Cancelled to describe the booking lifecycle. A cancelled booking releases the unit for future stays.", "Open an unpaid mistaken booking and select Remove to exclude it from schedules and reports. A booking with payment history is protected; correct or reverse its payments instead."] },
    ],
  },
  {
    id: "money", title: "Money In and Money Out", screen: "payments", keywords: ["payment", "receipt", "print", "pdf", "refund", "reversal", "correction", "expense", "supplier", "recurring"],
    summary: "Record collections and costs while preserving the audit trail.",
    sections: [
      { heading: "Collections and receipts", paragraphs: ["Choose the account and booking when recording a receipt. Partial payments leave an outstanding balance; payment allocation keeps each booking balance accurate.", "The receipt opens after an incoming payment is saved. Use Print receipt to choose a printer or Save as PDF. Reopen it later with the printer button in payment history.", "Record a refund when money is returned to a customer. Use a reversal or correction to correct a recorded movement instead of silently replacing history."] },
      { heading: "Costs and suppliers", paragraphs: ["Add Visa or another card in Settings > Accounts, then choose it when recording the expense. Supplier credit records an amount due for later supplier payment.", "For Netflix, Yaka service fees, and similar costs, open Expenses > Recurring review > New template, choose Monthly, and confirm the real bill when due."] },
    ],
  },
  {
    id: "staff", title: "Staff and Referrals", screen: "staff", keywords: ["staff", "allocation", "operations", "sales", "finance", "security", "ceo", "referral", "commission"],
    summary: "Understand staff allocations, referral commission, and calculation traces.",
    sections: [
      { heading: "Allocation base", paragraphs: ["Staff allocations use collected booking revenue, not booked totals or unpaid balances. The six default allocations are Operations 5%, Sales and Marketing 5%, Finance 10%, IT and Legal 2%, Security 5%, and CEO 10%.", "These six percentages total 37%. Earned amounts are calculated from the relevant collected-booking-revenue base."] },
      { heading: "This business's configuration", paragraphs: ["The six allocations and their 37% total are this business's configured rates and categories. They are not fictional staff records and are not a universal accounting or legal standard.", "Tutorial names and amounts, when shown, are fictional examples; use this business's configured rates for its real calculations."] },
      { heading: "Referrals and payment", paragraphs: ["Referral commission is calculated for referred bookings using the configured referral rate. Earned shows what the calculation has produced; paid shows what has actually been settled.", "Open the calculation trace when explaining an amount to verify its base, rate, and result."] },
    ],
  },
  {
    id: "month-end", title: "Financial Position and Month End", screen: "financial-position", keywords: ["cash", "receivable", "inventory", "asset", "loan", "payable", "equity", "balance", "close", "reopen"],
    summary: "Review financial position, balance the books, and close a month carefully.",
    sections: [
      { heading: "Financial position", paragraphs: ["Review cash and account balances, receivables, guest-supply inventory, assets, loans, payables, and owner equity. The position is balanced when total assets equal liabilities plus equity.", "For land, buildings, or capital renovations, add the item under Assets at historical cost, then record how it was funded as Owner capital or a Loan. Investment is not rental income.", "Use the pencil action to correct an asset or loan. A loan can record annual interest, repayment frequency, installment amount, term, due date, and outstanding balance."] },
      { heading: "Close and reopen", paragraphs: ["Complete month-end checks before closing a period. Closing protects a completed month from ordinary changes.", "Reopen only when a real correction is necessary and provide the reason. The reason-gated reopening records why the protected period changed."] },
    ],
  },
  {
    id: "reports", title: "Reports and Tax", screen: "reports", keywords: ["reports", "income statement", "balance sheet", "cash flow", "break even", "ratios", "tax", "rental"],
    summary: "Read monthly reports, share them, and understand the rental-tax estimate.",
    sections: [
      { heading: "Read reports", paragraphs: ["Choose the report period, then use the income statement, balance sheet, cash flow, break-even, and ratios views to explain performance and financial position.", "Print or export to Excel after checking the selected period and the figures being shared."] },
      { heading: "Rental-tax estimate", paragraphs: ["The individual-landlord rental-tax estimate: 12% of annual gross rental income above UGX 2,820,000.", "The annual threshold is UGX 2,820,000. The configured UGX 600,000 is the monthly gross rental basis per active unit, not the tax itself.", "Confirm tax treatment with URA or an accountant when a decision depends on it."] },
    ],
  },
  {
    id: "administration", title: "Administration and Safety", screen: "settings", keywords: ["admin", "editor", "user", "profile", "sign in", "units", "rate", "category", "account", "backup", "restore", "export", "lock", "password", "local"],
    summary: "Maintain settings and protect the local accounting file.",
    sections: [
      { heading: "Profiles and permissions", paragraphs: ["The Admin has full access. In Settings > Users, the Admin can add an Editor, reset an Editor password, or deactivate the profile.", "An Editor can view Today, add or update active bookings, record incoming payments, and print receipts. Editors cannot access expenses, reports, settings, refunds, reversals, account management, or destructive booking actions."] },
      { heading: "Configuration", paragraphs: ["Manage units, effective-dated rates, categories, and payment accounts from Settings. Add a Card / Visa account before recording card-paid expenses.", "Changing a historical or closed-period rate requires a reason."] },
      { heading: "Safety", paragraphs: ["Lock returns to profile sign-in without deleting work. Each person should use their own username and password.", "Create encrypted backups regularly and keep them somewhere separate from the computer. Restore requires explicit overwrite confirmation because it replaces local data.", "Export creates a workbook for review. Data is stored locally only; password responsibility remains with the business owner."] },
    ],
  },
];

export const tourDefinitions: TourDefinition[] = [
  { id: "orientation", title: "Orientation", summary: "See today’s work and the main controls.", steps: [
    { id: "sidebar", screen: "today", target: "sidebar", title: "Navigate the workspace", body: "Use the sidebar to move between daily work, bookings, money, reports, and settings.", placement: "right" },
    { id: "today-summary", screen: "today", target: "today-summary", title: "Review today", body: "Start with arrivals, departures, balances, and the work requiring attention." },
    { id: "quick-actions", screen: "today", target: "quick-actions", title: "Start a new record", body: "These commands begin a booking, payment, or expense from any screen.", placement: "bottom" },
    { id: "lock", screen: "today", target: "lock", title: "Lock locally", body: "Lock before leaving the computer to protect local records." },
  ] },
  { id: "bookings", title: "Booking Lifecycle", summary: "Enter, monitor, and complete manual stays.", steps: [
    { id: "booking-action", screen: "bookings", target: "booking-action", title: "Create a booking", body: "Bookings are entered manually; the app is not connected to Airbnb. Use New booking to start a manual stay." },
    { id: "booking-editor", screen: "bookings", target: "booking-editor", title: "Open the booking form", body: "Select New booking to open the form, then choose customer and unit, dates, nightly rate, and referral details." },
    { id: "booking-status", screen: "bookings", target: "booking-status", title: "Follow the lifecycle", body: "Choose List, select a booking, then update it from Draft through Confirmed, Checked in, and Completed, or cancel when needed." },
    { id: "booking-archive", screen: "bookings", target: "booking-archive", title: "Keep records tidy", body: "Choose List, open a booking, then edit facts or archive records that no longer belong in daily lists." },
  ] },
  { id: "money", title: "Money In and Money Out", summary: "Record money movements with a traceable history.", steps: [
    { id: "payment-action", screen: "payments", target: "payment-action", title: "Record a receipt", body: "Select the booking and account so the collection is allocated correctly." },
    { id: "payment-balance", screen: "payments", target: "payment-balance", title: "Track balances", body: "Select a booking before reviewing its balance. Partial payments leave an outstanding balance until the booking is settled." },
    { id: "payment-history", screen: "payments", target: "payment-history", title: "Correct transparently", body: "Select a booking before reviewing its history. Use Record refund, or open a movement to reverse or correct it; those records preserve the audit trail rather than erase history." },
    { id: "expense-action", screen: "expenses", target: "expense-action", title: "Record costs", body: "Record cash expenses, supplier credit, supplier payments, and recurring-expense reviews." },
  ] },
  { id: "staff", title: "Staff and Referrals", summary: "Explain every earned and paid allocation.", steps: [
    { id: "staff-base", screen: "staff", target: "staff-base", title: "Use the right base", body: "Allocations use collected booking revenue, not unpaid balances." },
    { id: "staff-rates", screen: "staff", target: "staff-rates", title: "Review six allocations", body: "This business's configured allocation rates total 37%: Operations 5%, Sales and Marketing 5%, Finance 10%, IT and Legal 2%, Security 5%, and CEO 10%. They are not fictional staff records or a universal accounting or legal standard." },
    { id: "referral-earnings", screen: "staff", target: "referral-earnings", title: "Track referrals", body: "Choose Referrals to review commission earned at the configured rate for referred bookings." },
    { id: "calculation-trace", screen: "staff", target: "calculation-trace", title: "Explain the number", body: "Open the calculation trace to see the base, rate, earned amount, and payment status." },
  ] },
  { id: "month-end", title: "Financial Position and Month End", summary: "Balance, close, and reopen periods responsibly.", steps: [
    { id: "position-summary", screen: "financial-position", target: "position-summary", title: "Check the equation", body: "Total assets should equal liabilities plus equity." },
    { id: "position-balances", screen: "financial-position", target: "position-balances", title: "Review balances", body: "Review cash, receivables, inventory, assets, loans, and payables." },
    { id: "month-end", screen: "financial-position", target: "month-end", title: "Close the month", body: "Select Month-end, then complete the checks before closing." },
    { id: "reopen-period", screen: "financial-position", target: "reopen-period", title: "Reopen with a reason", body: "Select Month-end to reopen a closed period only for a real correction and a recorded reason." },
  ] },
  { id: "reports", title: "Reports and Tax", summary: "Read reports and the approved tax estimate.", steps: [
    { id: "report-period", screen: "reports", target: "report-period", title: "Choose the period", body: "Confirm the month before explaining, printing, or exporting a report." },
    { id: "report-tabs", screen: "reports", target: "report-tabs", title: "Read each view", body: "Income statement, balance sheet, cash flow, break-even, and ratios answer different questions." },
    { id: "tax-guidance", screen: "settings", target: "tax-guidance", title: "Understand the estimate", body: "Select the Rental tax tab to review the individual-landlord estimate shown there: 12% of annual gross rental income above UGX 2,820,000." },
    { id: "excel-export", screen: "settings", target: "excel-export", title: "Share a workbook", body: "Choose Export Excel shortcut to open the Backup section. Then use the Export Excel control after checking the report period." },
  ] },
  { id: "administration", title: "Administration and Safety", summary: "Maintain settings and secure local records.", steps: [
    { id: "unit-settings", screen: "settings", target: "unit-settings", title: "Manage units", body: "Keep active units and their details current." },
    { id: "effective-rates", screen: "settings", target: "effective-rates", title: "Date rate changes", body: "Select the Compensation tab to review effective-dated role allocations, then record a rate change; effective dates retain the calculation basis for historical periods." },
    { id: "backup", screen: "settings", target: "backup", title: "Create encrypted backups", body: "Choose Backup to open the Backup section. Then enter the local password and use Create backup to store the encrypted copy separately." },
    { id: "users", screen: "settings", target: "users", title: "Give limited access", body: "Choose Users to add an Editor who can manage active bookings, record incoming payments, and print receipts without seeing the Admin-only accounting areas." },
    { id: "restore", screen: "settings", target: "restore", title: "Restore deliberately", body: "Choose Restore shortcut to open the Backup section. Then use Restore only after reviewing the overwrite confirmation because it replaces local data." },
    { id: "security", screen: "settings", target: "security", title: "Keep the password safe", body: "Select the Security tab to review encrypted local access, then lock the application. Storage is local only, and the business owner is responsible for the password." },
  ] },
];

export const guideChecklists: GuideChecklist[] = [
  { id: "daily", title: "Daily checklist", items: ["Review arrivals, departures, and the attention list.", "Confirm unit status and follow up on outstanding balances.", "Record receipts, refunds, and expenses that happened today.", "Lock the application when leaving the computer."] },
  { id: "booking", title: "Per-booking checklist", items: ["Confirm the customer, unit, check-in, and checkout dates.", "Check availability before confirming the stay.", "Verify nightly rate, adjustment, total, and referral details.", "Record the initial payment or leave the balance clearly outstanding.", "Update the status through check-in, checkout, completion, or cancellation."] },
  { id: "weekly", title: "Weekly checklist", items: ["Review unpaid and partially paid bookings.", "Reconcile cash, bank, and mobile-money accounts.", "Review supplier credit and supplier payments due.", "Check recurring expenses and staff or referral earned versus paid amounts.", "Create an encrypted backup."] },
  { id: "month-end", title: "Month-end checklist", items: ["Choose and review the month in Financial Position and Reports.", "Confirm cash, receivables, inventory, assets, loans, payables, and equity.", "Resolve any balance difference and review report figures.", "Review the rental-tax estimate with URA or an accountant when needed.", "Close the period only after checks are complete."] },
  { id: "recovery", title: "Backup recovery checklist", items: ["Locate the correct encrypted backup and its password.", "Confirm the restore destination can be overwritten.", "Restore only after the overwrite confirmation has been reviewed.", "Reopen the application and check the business, units, and recent records.", "Create a fresh backup after recovery is verified."] },
];

export const glossaryEntries: GlossaryEntry[] = [
  { term: "Draft", definition: "A booking started but not yet confirmed." },
  { term: "Confirmed", definition: "A booking accepted for the selected unit and dates." },
  { term: "Checked in", definition: "A guest is currently staying in the unit." },
  { term: "Completed", definition: "A stay has ended and its booking lifecycle is complete." },
  { term: "Cancelled", definition: "A booking will not proceed; its unit dates are released." },
  { term: "Unpaid", definition: "No payment has been recorded against the booking." },
  { term: "Partially paid", definition: "Some money has been recorded, but a balance remains." },
  { term: "Fully paid", definition: "Net recorded payments settle the booking total." },
  { term: "Overpaid", definition: "Net recorded payments exceed the booking total." },
  { term: "Partially refunded", definition: "Some recorded customer money has been returned." },
  { term: "Fully refunded", definition: "All net customer money for the booking has been returned." },
  { term: "Collected", definition: "Booking revenue actually received, used for staff allocation calculations." },
  { term: "Outstanding", definition: "The amount still due on a booking after recorded movements." },
  { term: "Receipt", definition: "A recorded collection into a cash, bank, or mobile-money account." },
  { term: "Admin", definition: "A full-access local profile that manages accounting, settings, backups, and Editor profiles." },
  { term: "Editor", definition: "A restricted local profile that manages active bookings, incoming payments, and receipts only." },
  { term: "Refund", definition: "Money returned to a customer." },
  { term: "Reversal", definition: "A separate record that reverses a previous money movement while preserving history." },
  { term: "Supplier credit", definition: "An expense received now and payable to the supplier later." },
  { term: "Recurring expense", definition: "A regularly expected cost that should be reviewed before it is recorded." },
  { term: "Receivable", definition: "Money owed to the business, including customer balances." },
  { term: "Payable", definition: "Money the business owes, such as supplier, staff, referral, or tax obligations." },
  { term: "Asset", definition: "A resource controlled by the business, including cash, inventory, and fixed assets." },
  { term: "Loan", definition: "A borrowing with an outstanding balance owed to a lender." },
  { term: "Equity", definition: "The owner’s residual interest after liabilities are deducted from assets." },
  { term: "Balanced", definition: "Total assets equal total liabilities plus equity." },
  { term: "Month close", definition: "Protection applied after month-end checks are complete." },
  { term: "Reopen", definition: "A reason-gated action that makes a closed period available for a needed correction." },
  { term: "Income statement", definition: "A report of revenue, expenses, and net income for a period." },
  { term: "Balance sheet", definition: "A report of assets, liabilities, and equity at a point in time." },
  { term: "Cash flow", definition: "A report of opening cash, receipts, payments, movement, and closing cash." },
  { term: "Break-even", definition: "The revenue level needed to cover the relevant costs when available." },
  { term: "Ratio", definition: "A calculated measure used to interpret financial performance or position." },
  { term: "Monthly gross rental basis", definition: "The configured UGX 600,000 per active unit used as the rental-income basis, not the tax itself." },
  { term: "Rental-tax estimate", definition: "The individual-landlord rental-tax estimate: 12% of annual gross rental income above UGX 2,820,000." },
  { term: "Effective-dated rate", definition: "A rate that applies from a chosen date so historical calculations retain their original basis." },
  { term: "Encrypted backup", definition: "A password-protected local copy of business data." },
  { term: "Restore", definition: "Replacing local data from an encrypted backup after explicit overwrite confirmation." },
  { term: "Local-only storage", definition: "Business records remain on the local computer; the app does not use cloud progress tracking." },
];
