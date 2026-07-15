# Task 5 Report

Status: complete

Commit: `f6ba91c feat: connect tutorials to live workflow controls`

Implemented semantic `data-tour` markers for every tour target across the shell and workflow screens. Steps for editors and non-default tabs now point to visible opening controls or containers, and the guide copy tells the user what to open next without changing records or opening UI automatically.

Added a target manifest/integrity test that groups selectors by screen and verifies complete tour coverage, kebab-case naming, uniqueness, and renderer source bindings.

Validation:

- `npm test -- tests/renderer` - 14 files, 70 tests passed
- `npm run typecheck` - passed

Concerns: none. Closed editors, report/settings tabs, and month-end controls remain closed until the user explicitly opens them.
