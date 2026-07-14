# Task 5 Report: Customers, Manual Bookings, and Unit Schedule

## Status

Complete. Task 5 is implemented and committed as one scoped feature change.

## Delivered

- Checkout-exclusive booking date rules, calendar-night calculation, exact whole-UGX totals, and legal booking transitions.
- Business-scoped customer CRUD with archived-customer protection.
- Business-scoped booking CRUD with active unit/customer/referrer validation.
- Immediate SQLite transactions around booking create, update, confirm/transition, and archive operations.
- Overlap rechecks inside the transaction for confirmed, checked-in, and completed stays.
- Explicit non-blocking semantics for draft and cancelled bookings.
- Typed, strict IPC contracts for customer and booking operations.
- Compact manual booking editor with customer/contact, dates and times, nightly rate, adjustment, referral, referrer, initial payment metadata, notes, live nights, and live total.
- Nonzero initial payments remain entered and produce field-level validation; Task 5 does not fake receipt persistence before Task 6 provides account-backed payments.
- Shared booking editor/detail path from Schedule and List views.
- Keyboard-accessible unit schedule with stable unit rows and checkout-exclusive day spans.
- Booking list with status, unit, customer, stay, total, balance, and corresponding filters.

## TDD Coverage

- Adjacent and overlapping checkout-exclusive stays.
- Invalid calendar dates and non-positive ranges.
- Whole-UGX arithmetic, negative totals, and safe-integer overflow.
- Draft/cancelled occupancy semantics and legal/illegal transitions.
- Stale draft confirmation and overlapping confirmed updates.
- Archived and cross-business unit/customer references.
- Customer validation and archival.
- Unpaid booking defaults.
- Live editor totals, new customer creation, initial-payment retention, keyboard schedule controls, and shared List/Schedule detail path.
- Strict IPC allowlisting, payload validation, and public repository errors.

## Verification

- Focused: `npm test -- tests/domain/bookings.test.ts tests/main/booking-repository.test.ts tests/renderer/booking-editor.test.tsx` - 3 files, 38 tests passed.
- Full: `npm test` - 16 files, 117 tests passed.
- Typecheck: `npm run typecheck` - passed.
- Diff hygiene: `git diff --check` - passed.
- Visual checks: Schedule, List, and editor rendered at 1280x720 with no document/main overflow or filter overlap.

## Self-Review

- No release-blocking defects found in the Task 5 scope.
- Repository mutations preserve business boundaries and recheck occupancy while holding an immediate write transaction.
- No platform import, Airbnb assumption, or synthetic payment row was introduced.
- Task 6 must replace the current nonzero-initial-payment validation boundary with transactional account-backed receipt persistence.

## Review Fixes

- Persisted a newly created customer ID into booking-editor state before booking submission, so conflict and unexpected-error retries reuse the same customer instead of creating a duplicate.
- Added renderer and repository regressions proving retries leave exactly one customer and submit the persisted customer ID again.
- Made referral intent strict at IPC and repository boundaries: non-referrals reject entered referral details, while referrals require exactly one active business-scoped referrer ID or one nonblank new name.
- Added IPC and repository coverage for contradictory payloads plus archived and cross-business referrer IDs.
- Kept contradictory referral names visible in the editor and blocked submission until the user resolves them; no entered referral data is silently discarded.
- Preserved the accepted field-level validation boundary for nonzero initial payments.

## Review Verification

- Focused: `npm test -- tests/domain/bookings.test.ts tests/main/booking-repository.test.ts tests/main/ipc.test.ts tests/renderer/booking-editor.test.tsx` - 4 files, 74 tests passed.
- Full: `npm test` - 16 files, 138 tests passed.
- Typecheck: `npm run typecheck` - passed.
- Self-review: no additional Task 5 defects or scope expansion found.
