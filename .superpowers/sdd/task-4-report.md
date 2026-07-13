# Task 4 Report

## Status

Complete. Business setup, exactly two editable initial units, local encrypted create/unlock/lock, approved defaults, settings tabs, and effective-dated rate changes are implemented.

## Implementation

- Added transactional business and unit persistence with approved staff, referral, and UGX 600,000 per-unit tax defaults.
- Added effective-dated staff, referral, and tax histories; historical and closed-period changes require a reason.
- Added a main-owned encrypted database session and strict typed IPC for status, create, unlock, lock, unit renaming, and rate updates.
- Added compact keyboard-usable setup, unlock, and settings screens, including the visible UGX 1,200,000 monthly total.
- Added Units, Compensation, Referral, Tax provision, Categories, Accounts, Backup, and Security settings surfaces without later-task action placeholders.

## Security Review

- No cloud account or remote data path was added.
- Plaintext passwords are not persisted or returned; renderer password fields and action variables are cleared around the request.
- The main process owns the open database and closes/clears it on lock and application quit.
- Wrong passwords fail closed with a sanitized public error and no database or stack details.

## Verification

- Focused: 10 tests passed in 2 files.
- Full: 65 tests passed in 13 files.
- Typecheck: `tsc --noEmit` passed.
- Diff check: clean.
- 1280x720 setup and settings renders had no viewport overflow or console errors.

## Self-Review

Resolved deterministic unit ordering and correct retrieval of an effective 0% referral rate. No unresolved Task 4 concerns.

## Review Fix Evidence - 2026-07-14

- Same-effective-date rate saves now update the existing row deterministically; different effective dates remain separate history records.
- Historical and closed-period updates still require a reason. Rate audit events include the effective rate row ID, before/after snapshots, and reason.
- Repository validation and conflicts cross strict IPC as allowlisted structured failures with field errors.
- First-run setup remains exactly two units. Post-setup settings reconcile any non-empty active-unit list, add units, rename all retained units, and archive omitted units without changing retained IDs.
- Failed unlocks close a database handle opened before settings loading fails and leave the session locked. Successful unlocks retain one handle until lock.
- Password fields and renderer action variables remain cleared around create/unlock requests; no password persistence was added.
- Focused review suite: 25 tests passed in 3 files.
- Full suite: 72 tests passed in 13 files.
- Typecheck: `tsc --noEmit` passed.
- Self-review and `git diff --check`: clean; no unresolved Task 4 findings.

## Final Review Fix Evidence - 2026-07-14

- Referral and tax history mutations now run one shared latest-applicable recomputation inside the same transaction as mutation and audit.
- Backdated history no longer displaces a later applicable rate; future rows remain in history without changing today's denormalized business values.
- IPC rate schemas are split by type: referral is finite 0..100 and tax provision is nonnegative whole safe-integer UGX.
- Effective dates must be real ISO calendar dates. Impossible dates fail at `payload.effectiveFrom` before handler execution.
- First-run unit names receive semantic duplicate-name validation; managed active-unit names use the same case-insensitive rule.
- Invalid Task 4 payloads return field-level `VALIDATION_ERROR`, never `INTERNAL_ERROR`.
- Focused Task 4 suite: 28 tests passed in 3 files.
- Full suite: 75 tests passed in 13 files.
- Typecheck: `tsc --noEmit` passed.
- Self-review and `git diff --check`: clean; no remaining Task 4 findings.
