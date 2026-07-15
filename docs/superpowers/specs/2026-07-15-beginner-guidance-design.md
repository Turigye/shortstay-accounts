# Beginner Guidance System Design

## Purpose

Make Short-Stay Accounts understandable to a first-time operator and teach the owner well enough to explain every workflow to a client. Guidance must be optional, replayable, based on the real interface, and useful without internet access.

## Learning Structure

The product will use three connected layers instead of one long tutorial:

1. **First-unlock welcome**: a concise invitation explaining what the operator will learn, with Start, Explore independently, and Open guide choices. A dismissal is remembered locally.
2. **Contextual guided tours**: short tours that navigate to real screens and spotlight real controls. Each tour has three to seven steps, Back, Next, Skip, progress, keyboard dismissal, and a clear finish.
3. **A-to-Z Help Center and handbook**: complete reference material for study, troubleshooting, printing, and client demonstrations.

## Guided Tours

### Orientation

Teach the sidebar, daily dashboard, quick-entry commands, attention list, unit status, and local lock. The success moment is understanding what needs action today and where new records begin.

### Booking Lifecycle

Teach customer selection, unit availability, check-in and check-out, nightly pricing, total amount, referral details, booking status, editing, and archiving. Explain that bookings are entered manually and are not connected to Airbnb.

### Money In and Money Out

Teach accounts, receipts, booking allocation, partial balances, refunds, reversals, corrections, expenses, supplier credit, supplier payments, and recurring-expense review. Emphasize that corrections preserve the audit trail.

### Staff and Referrals

Teach the collected-booking-revenue base, six percentage allocations, the 37% total, referral commission, earned versus paid values, and calculation traces.

### Financial Position and Month End

Teach cash and account balances, receivables, inventory, assets, loans, payables, equity, balancing, month-end checks, closing, and reason-gated reopening.

### Reports and Tax

Teach report periods, income statement, balance sheet, cash flow, break-even, ratios, printing, and Excel export. Explain the individual-landlord rental-tax estimate: 12% of annual gross rental income above UGX 2,820,000. The configured UGX 600,000 is the monthly gross rental basis per active unit, not the tax itself.

### Administration and Safety

Teach units, effective-dated rates, categories, accounts, encrypted backup, restore confirmation, export, lock, local-only storage, and password responsibility.

## In-App Help Center

A Help icon in the command bar opens a dedicated Help Center without displacing primary accounting navigation. It contains:

- Search across topics and keywords.
- A beginner learning path with completion markers.
- Workflow chapters matching the tours above.
- Concise definitions for every status, amount, report, and configuration value.
- “Start tour” actions and direct links to the relevant screen.
- Daily, per-booking, weekly, month-end, and backup checklists.
- Troubleshooting for incorrect balances, wrong payments, closed periods, forgotten workflow steps, and backup recovery.
- Clear boundaries where an accountant or URA confirmation is appropriate.

Help content is maintained as structured TypeScript data so search, tours, and the visible guide share terminology without duplicating business logic.

## Tour Presentation

The tour overlay dims the workspace while leaving the target clear. A restrained animated focus ring draws attention without pulsing continuously. The explanation panel stays within the viewport, avoids covering the target, and changes placement when space is limited.

Motion uses short opacity and position transitions and respects `prefers-reduced-motion`. Focus moves into the tour panel, Escape closes it, and completion or dismissal returns focus to the control that opened the tour. The tour never edits business data automatically.

Progress is stored in local storage under versioned keys. A new guide version may offer new material once, while completed tours remain replayable.

## Visual Handbook

Create `docs/user-guide/short-stay-accounts-handbook.md` with:

- A complete table of contents and glossary.
- Beginner setup and first-day walkthrough.
- Step-by-step instructions for every screen and action.
- Worked examples using a fictional two-unit property.
- Real screenshots captured from the application at a consistent desktop viewport.
- Annotated screenshots using numbered callouts that correspond to nearby instructions.
- Short silent recorded demonstrations for interactions where movement improves understanding, such as creating a booking, recording a partial payment, correcting a transaction, closing a month, and creating a backup.
- Daily, weekly, monthly, and recovery checklists.

Screenshots will be compressed WebP files. Demonstrations will use WebM for efficient repository storage, with static fallback images and descriptive captions. No real client or guest data will appear in tutorial media.

## Architecture

- `HelpCenterScreen`: searchable chapter and checklist interface.
- `GuidedTour`: accessible spotlight, panel, progress, and navigation controls.
- `TourProvider`: owns active tour state, target discovery, screen navigation, persistence, and focus restoration.
- `guide-content.ts`: chapters, glossary, checklists, and tour metadata.
- `data-tour` attributes: stable target identifiers on existing controls; no brittle text selectors.
- `docs/user-guide/media`: captured and annotated tutorial assets.

Missing or hidden targets are skipped safely with a logged development warning. A tour waits briefly when navigating between screens, then advances only after the target exists.

## Testing and Verification

- Unit tests for persistence, search, progression, skipping, completion, and missing targets.
- Renderer tests for welcome behavior, Help Center navigation, focus management, Escape, and reduced motion.
- Electron E2E coverage that completes the orientation tour and opens each guide chapter.
- Visual verification at 1280x720, 1440x900, and the minimum supported window size.
- Accessibility audit for labels, focus order, dialog semantics, contrast, and keyboard-only use.
- Media inspection to confirm readable annotations, fictional data, and correct application state.

## Scope Boundaries

- Tutorials do not create, alter, or delete real business records.
- No online analytics or cloud progress tracking.
- No voice narration in the first release; captions make every recording understandable silently.
- The handbook explains operation and calculation behavior but does not replace professional accounting or legal advice.
