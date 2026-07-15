# Guidance Task G4 Report

## Status

Complete. The unlocked application now has a command-bar Help Center that preserves the active accounting screen, restores a persistent focus target, and integrates the existing first-unlock welcome and guided tours.

## Implementation

- Added `HelpCenterScreen` with a compact search toolbar and keyboard-operable Learn, Checklists, and Glossary tabs.
- Learn presents all seven guide chapters as bordered workflow rows with completion status, matching tour actions, and direct screen navigation.
- Search combines chapter, checklist, and glossary material through the existing guide search index. Searching `partial payment` returns the Money In and Money Out chapter.
- Added troubleshooting for incorrect balances, wrong payments, closed periods, missed steps, and backup recovery, plus clear accountant/URA boundaries.
- Added the Help icon button only to the command bar and passed the actual button element to App for return-focus handling.
- Wrapped the unlocked shell in `TourProvider`, mounted `FirstUnlockWelcome` and `GuidedTour` outside the shell's scrollable content, and registered the shell targets required by the orientation tour.
- Kept Help state separate from `AppScreen` using `helpOpen` and `screenBeforeHelp`; closing restores the saved screen, while Go to screen closes first and then applies the requested destination.

## TDD Evidence

- Added the shell and Help Center renderer specifications before implementation.
- Initial focused run failed as expected because the Help command and `HelpCenterScreen` module did not yet exist.
- Added explicit jsdom cleanup after discovering this runner retains rendered DOM between tests.

## Verification

- `npm test -- tests/renderer/AppShell.test.tsx tests/renderer/HelpCenterScreen.test.tsx tests/renderer/GuidedTour.test.tsx` passed: 22 tests in 3 files.
- `npm run typecheck` passed.
- `git diff --check` passed.

## Self-Review

- Corrected the Go to screen ordering so the close-path restore cannot overwrite the requested destination.
- No unresolved G4 concerns. Existing tour targets inside individual accounting screens remain owned by their respective screen work; this task wires the shared shell targets and mounts the tour layer.
