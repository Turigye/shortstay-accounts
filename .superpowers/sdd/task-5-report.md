# Task 5 Report

Status: complete

Commit: `f6ba91c feat: connect tutorials to live workflow controls`

Implemented semantic `data-tour` markers for every tour target across the shell and workflow screens. Steps for editors and non-default tabs now point to visible opening controls or containers, and the guide copy tells the user what to open next without changing records or opening UI automatically.

Added a target manifest/integrity test that groups selectors by screen and verifies complete tour coverage, kebab-case naming, uniqueness, and renderer source bindings.

Validation:

- `npm test -- tests/renderer` - 14 files, 70 tests passed
- `npm run typecheck` - passed

Concerns: none. Closed editors, report/settings tabs, and month-end controls remain closed until the user explicitly opens them.

## G5 Review Follow-up

Status: complete

Payments now keeps `payment-balance` on the booking selector and `payment-history` on the always-rendered content area. The empty state explicitly says there is no payment history to review. The obsolete balance marker was removed from `BookingBalance` so the selector remains the only balance target.

Bookings now places `booking-editor` on the visible `New booking` button, while `booking-action` marks the surrounding header.

Settings now uses the visible `Backup` tab as the shared `backup-tools` target for export, backup, and restore steps. The default Units panel no longer carries a restore marker.

Rendered regression coverage verifies the empty Payments, default Bookings, and default Settings states. The guide-content test retains manifest, kebab-case, and source-binding checks, but labels source binding as structural rather than live-visibility proof.

Validation:

- Focused renderer tests: 4 files, 36 tests passed.
- All renderer tests: 14 files, 74 tests passed.
- `npm run typecheck` passed.
- `git diff --check` passed.

Concerns: none.

## G5 Uniqueness Fix

Status: complete

Settings keeps the Backup tab visible and selected targets stable while assigning distinct semantic markers: `backup` is on the tab button, `restore` is on an inline-flex icon-and-label wrapper, and `excel-export` is on the visible label span. Settings still defaults to Units, and tab dimensions and click behavior are preserved.

Guide content and the settings manifest now use the three distinct target values. The guide integrity test compares the full target sequence without de-duplication and asserts manifest uniqueness. The rendered Settings test verifies exactly one visible element for each target while Units remains active.

Validation:

- Focused guide and setup tests: 2 files, 15 tests passed
- All renderer tests: 14 files, 74 tests passed
- `npm run typecheck` passed
- `git diff --check` passed

Concerns: none.
