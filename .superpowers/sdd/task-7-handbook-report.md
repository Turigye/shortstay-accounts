# G7-B Handbook Report

## Status

Completed the comprehensive beginner handbook at `docs/user-guide/short-stay-accounts-handbook.md`.

## Self-review

- Reviewed `src/renderer/guidance/guide-content.ts` and the Today, Bookings, Payments, Expenses, Staff, Financial Position, Reports, Settings, Help Center, Setup, Unlock, and application-shell screens.
- Confirmed the 21 requested chapters are present in the requested order.
- Confirmed manual-entry/no-Airbnb language, local-only storage, password responsibility, correction/reversal audit trail, archive guidance, effective-dated rates, close/reopen reasons, reports, print/export, backup/restore, staff configuration, and the approved rental-tax wording.
- Ran a structural validation of chapter order, nine exact screenshot references, five WebM references, five WebP posters, required terms, and absence of placeholders. It passed.

## Media References

- Screenshots: 9 references (`01-today.webp` through `09-help-center.webp`).
- Demonstrations: 5 WebM references with 5 WebP poster fallbacks (`demo-booking`, `demo-partial-payment`, `demo-correction`, `demo-month-close`, and `demo-backup`).
- Every screenshot has a numbered-callout caption; every video is silent, has controls/muted/playsinline/preload metadata attributes, and is followed by static-reader-friendly descriptive text.

## Concern

The handbook references the parallel capture output in `docs/user-guide/media`. At this review point those media files have not materialized in this worktree, so their bytes and visual framing could not be inspected here. The handbook uses the exact capture-script filenames and does not alter the capture script, package configuration, or media files.
