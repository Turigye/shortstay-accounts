# Beginner Guidance System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, replayable in-app learning system and a comprehensive media-backed handbook that teaches a beginner every Short-Stay Accounts workflow without changing business data.

**Architecture:** Structured guide content is the single source for Help Center chapters, glossary, checklists, and seven guided tours. A context provider manages versioned local progress and screen navigation; an accessible spotlight dialog discovers stable `data-tour` targets in the live interface. A deterministic Playwright capture script generates fictional screenshots and silent demonstrations for the repository handbook.

**Tech Stack:** React 19, TypeScript 7, Zustand-free React context for tutorial state, lucide-react, Vitest, Testing Library, Electron 43, Playwright 1.61, Markdown, WebP, WebM.

## Global Constraints

- Guidance is optional, replayable, and fully usable without internet access.
- Each contextual tour contains three to seven steps and supports Back, Next, Skip, Escape, progress, and a clear finish.
- Tutorials never create, alter, or delete business records.
- Progress uses the versioned local-storage key `shortstay-guidance:v1`; there is no cloud progress or analytics.
- Motion is restrained and respects `prefers-reduced-motion`.
- All targets use stable `data-tour` identifiers; missing targets are skipped after a short bounded wait with a development warning.
- The tax copy says: 12% of annual gross rental income above UGX 2,820,000; UGX 600,000 is the monthly gross rental basis per active unit, not the tax.
- Tutorial media uses only fictional guest, supplier, staff, and property data.
- Screenshots are WebP, demonstrations are silent WebM with static fallback images and descriptive captions.
- No voice narration in this release.

---

## File Map

- Create `src/renderer/guidance/types.ts`: shared guide, tour, and persistence contracts.
- Create `src/renderer/guidance/guide-content.ts`: seven chapters, tours, glossary, checklists, search keywords, and tax/accounting explanations.
- Create `src/renderer/guidance/guide-search.ts`: pure normalized search and progress helpers.
- Create `src/renderer/guidance/TourProvider.tsx`: active-tour state, versioned persistence, screen navigation, and focus restoration.
- Create `src/renderer/guidance/GuidedTour.tsx`: target discovery, spotlight geometry, dialog controls, keyboard behavior, and placement.
- Create `src/renderer/guidance/FirstUnlockWelcome.tsx`: optional first-run invitation.
- Create `src/renderer/screens/HelpCenterScreen.tsx`: searchable learning path, chapters, glossary, checklists, and troubleshooting.
- Create `src/renderer/styles/guidance.css`: Help Center and tour visuals, responsive rules, and reduced-motion behavior.
- Modify `src/renderer/components/AppShell.tsx`: Help command and stable shell tour targets.
- Modify `src/renderer/App.tsx`: provider integration, Help Center routing, first-unlock welcome, and tour-to-screen navigation.
- Modify key screen/component files: add semantic `data-tour` targets only; no accounting behavior changes.
- Create `tests/renderer/guide-content.test.ts`, `TourProvider.test.tsx`, `GuidedTour.test.tsx`, and `HelpCenterScreen.test.tsx`.
- Modify `tests/renderer/AppShell.test.tsx` and `tests/e2e/app.spec.ts`: Help entry and full orientation coverage.
- Create `scripts/capture-user-guide.mjs`: deterministic fictional-data screenshot and WebM capture.
- Create `docs/user-guide/short-stay-accounts-handbook.md` and `docs/user-guide/media/`.
- Modify `package.json`: add `guide:capture` without adding runtime dependencies.

### Task 1: Structured Guide Content and Search

**Files:**
- Create: `src/renderer/guidance/types.ts`
- Create: `src/renderer/guidance/guide-content.ts`
- Create: `src/renderer/guidance/guide-search.ts`
- Test: `tests/renderer/guide-content.test.ts`

**Interfaces:**
- Produces: `GuideChapter`, `TourDefinition`, `TourStep`, `GuideChecklist`, `GlossaryEntry`, `GuidanceProgress`, `GUIDE_VERSION`, `GUIDANCE_STORAGE_KEY`, `guideChapters`, `tourDefinitions`, `guideChecklists`, `glossaryEntries`, `searchGuide(query)`, and `createInitialProgress()`.
- `TourStep.screen` uses the existing `AppScreen` union and `target` is a `data-tour` value without selector punctuation.

- [ ] **Step 1: Write the failing content contract tests**

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { guideChapters, guideChecklists, glossaryEntries, tourDefinitions } from "../../src/renderer/guidance/guide-content";
import { createInitialProgress, searchGuide } from "../../src/renderer/guidance/guide-search";

describe("beginner guide content", () => {
  it("defines seven complete learning chapters and tours", () => {
    expect(guideChapters).toHaveLength(7);
    expect(tourDefinitions).toHaveLength(7);
    expect(tourDefinitions.every((tour) => tour.steps.length >= 3 && tour.steps.length <= 7)).toBe(true);
  });

  it("finds tax guidance by meaning and states the approved formula", () => {
    const results = searchGuide("rental tax threshold");
    expect(results[0]?.searchText).toContain("12%");
    expect(results[0]?.searchText).toContain("2,820,000");
    expect(results[0]?.searchText).toContain("600,000");
  });

  it("includes daily, booking, weekly, month-end, and recovery checklists", () => {
    expect(guideChecklists.map((item) => item.id)).toEqual(["daily", "booking", "weekly", "month-end", "recovery"]);
    expect(glossaryEntries.length).toBeGreaterThan(20);
  });

  it("creates versioned empty local progress", () => {
    expect(createInitialProgress()).toEqual({ version: 1, welcomeDismissed: false, completedTourIds: [], completedChapterIds: [] });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm module resolution fails**

Run: `npm test -- tests/renderer/guide-content.test.ts`

Expected: FAIL because `src/renderer/guidance/guide-content.ts` does not exist.

- [ ] **Step 3: Implement exact contracts and complete structured content**

```ts
// types.ts
import type { AppScreen } from "../components/AppShell";

export type GuideChapterId = "orientation" | "bookings" | "money" | "staff" | "month-end" | "reports" | "administration";
export type GuideChecklistId = "daily" | "booking" | "weekly" | "month-end" | "recovery";
export interface TourStep { id: string; screen: AppScreen; target: string; title: string; body: string; placement?: "top" | "right" | "bottom" | "left"; }
export interface TourDefinition { id: GuideChapterId; title: string; summary: string; steps: TourStep[]; }
export interface GuideSection { heading: string; paragraphs: string[]; }
export interface GuideChapter { id: GuideChapterId; title: string; summary: string; screen: AppScreen; keywords: string[]; sections: GuideSection[]; }
export interface GuideChecklist { id: GuideChecklistId; title: string; items: string[]; }
export interface GlossaryEntry { term: string; definition: string; }
export interface GuidanceProgress { version: 1; welcomeDismissed: boolean; completedTourIds: GuideChapterId[]; completedChapterIds: GuideChapterId[]; }
export interface GuideSearchResult { id: string; kind: "chapter" | "glossary" | "checklist"; title: string; summary: string; searchText: string; }
export const GUIDE_VERSION = 1 as const;
export const GUIDANCE_STORAGE_KEY = "shortstay-guidance:v1";
```

Populate `guide-content.ts` with the exact seven chapters and tours from the approved spec, all five checklists, and definitions for every status and major amount shown by the app. Keep all tax wording identical to Global Constraints. Implement normalized token search in `guide-search.ts` so every query token must appear in `searchText`, with title matches ranked first.

- [ ] **Step 4: Run content tests and typecheck**

Run: `npm test -- tests/renderer/guide-content.test.ts && npm run typecheck`

Expected: all guide content tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the content foundation**

```bash
git add src/renderer/guidance tests/renderer/guide-content.test.ts
git commit -m "feat: add structured beginner guide content"
```

### Task 2: Tour State, Persistence, and Focus Restoration

**Files:**
- Create: `src/renderer/guidance/TourProvider.tsx`
- Test: `tests/renderer/TourProvider.test.tsx`

**Interfaces:**
- Consumes: `TourDefinition`, `GuideChapterId`, `GuidanceProgress`, `tourDefinitions`, `GUIDANCE_STORAGE_KEY`, `createInitialProgress()`.
- Produces: `TourProvider({ children, navigate })`, `useTour()`, and `TourContextValue` with `activeTour`, `stepIndex`, `progress`, `startTour(id, opener?)`, `nextStep()`, `previousStep()`, `skipTour()`, `completeTour()`, `dismissWelcome()`, and `markChapterComplete(id)`.

- [ ] **Step 1: Write failing provider behavior tests**

Test a fresh state, malformed-storage recovery, start navigation, next/back, completion persistence, skip without completion, welcome dismissal, and restoration of focus to the opener. Use a three-step inline test tour only through the exported provider API; mock `localStorage` and `HTMLElement.prototype.focus`.

- [ ] **Step 2: Run the provider tests and confirm failure**

Run: `npm test -- tests/renderer/TourProvider.test.tsx`

Expected: FAIL because `TourProvider` is missing.

- [ ] **Step 3: Implement the provider**

```tsx
export interface TourContextValue {
  activeTour: TourDefinition | null;
  stepIndex: number;
  progress: GuidanceProgress;
  startTour: (id: GuideChapterId, opener?: HTMLElement | null) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  dismissWelcome: () => void;
  markChapterComplete: (id: GuideChapterId) => void;
}
```

Read storage once with a guarded parser that accepts only version 1 arrays and booleans. Persist every state change, navigate before exposing each changed step, never mutate app-store state, and restore focus with `requestAnimationFrame` after close.

- [ ] **Step 4: Run provider tests and typecheck**

Run: `npm test -- tests/renderer/TourProvider.test.tsx && npm run typecheck`

Expected: all provider tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/guidance/TourProvider.tsx tests/renderer/TourProvider.test.tsx
git commit -m "feat: manage guided tour progress locally"
```

### Task 3: Accessible Spotlight and First-Unlock Welcome

**Files:**
- Create: `src/renderer/guidance/GuidedTour.tsx`
- Create: `src/renderer/guidance/FirstUnlockWelcome.tsx`
- Create: `src/renderer/styles/guidance.css`
- Modify: `src/renderer/styles/app.css`
- Test: `tests/renderer/GuidedTour.test.tsx`

**Interfaces:**
- Consumes: `useTour()` and active `TourStep.target`.
- Produces: `GuidedTour()` and `FirstUnlockWelcome({ onOpenGuide })`.
- Target selector is `[data-tour="${CSS.escape(step.target)}"]`; discovery retries every 50ms for at most 1,000ms.

- [ ] **Step 1: Write failing interaction and accessibility tests**

Cover dialog name, `Step 1 of N`, target highlight geometry, Next/Back/Finish, Skip, Escape, focus moved to the heading, focus restored to opener, missing-target advancement, and welcome Start/Explore/Open guide actions. Mock `getBoundingClientRect()` to a fixed rectangle and enable reduced motion with `matchMedia`.

- [ ] **Step 2: Run the tests and confirm failure**

Run: `npm test -- tests/renderer/GuidedTour.test.tsx`

Expected: FAIL because the spotlight and welcome components are missing.

- [ ] **Step 3: Implement spotlight geometry and controls**

Render one fixed overlay with four dimming rectangles around a padded target, a non-interactive focus ring, and a `role="dialog" aria-modal="true"` panel. Recalculate on resize and capture-phase scroll. Choose the requested placement when it leaves 16px viewport margins, otherwise use the side with most free space. Use icon buttons with accessible labels for close and back, visible text for Skip and Next/Finish, and one short opacity/translate transition disabled under `prefers-reduced-motion: reduce`.

- [ ] **Step 4: Implement the welcome dialog**

Show the welcome only while `progress.welcomeDismissed` is false and no tour is active. `Start` dismisses and starts Orientation, `Explore independently` only dismisses, and `Open guide` dismisses before calling `onOpenGuide`.

- [ ] **Step 5: Run focused tests and inspect CSS constraints**

Run: `npm test -- tests/renderer/GuidedTour.test.tsx && npm run typecheck && rg "border-radius|transition|prefers-reduced-motion" src/renderer/styles/guidance.css`

Expected: tests PASS, typecheck exits 0, cards/dialogs use radii no greater than 8px, and reduced-motion rules are present.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/guidance src/renderer/styles tests/renderer/GuidedTour.test.tsx
git commit -m "feat: add accessible tutorial spotlight"
```

### Task 4: Help Center and App Integration

**Files:**
- Create: `src/renderer/screens/HelpCenterScreen.tsx`
- Modify: `src/renderer/components/AppShell.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `tests/renderer/AppShell.test.tsx`
- Create: `tests/renderer/HelpCenterScreen.test.tsx`

**Interfaces:**
- Consumes: guide collections, `searchGuide`, `useTour`, and `AppScreen` navigation.
- Produces: `HelpCenterScreen({ onClose, onNavigate })`; `AppShell` gains `onHelp?: (opener: HTMLButtonElement) => void`.
- Help is an app-level full workspace view; closing restores the previously active accounting screen.

- [ ] **Step 1: Add failing shell and Help Center tests**

Assert that the command bar exposes a `Help` icon button with tooltip/accessible name, Help opens without adding a ninth primary-navigation item, search for `partial payment` returns Money In and Money Out, each of seven chapter actions starts its matching tour, `Go to screen` navigates and closes Help, completion markers update, and glossary/checklist tabs are keyboard reachable.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/renderer/AppShell.test.tsx tests/renderer/HelpCenterScreen.test.tsx`

Expected: FAIL for missing Help control and Help Center.

- [ ] **Step 3: Implement the Help Center**

Use a compact toolbar with Back, search, and three tabs: Learn, Checklists, Glossary. Learn shows a seven-row path with summary, completion state, Start tour, and Go to screen. Search returns mixed chapter/checklist/glossary rows with kind labels. Include troubleshooting sections for incorrect balances, wrong payments, closed periods, missed workflow steps, backup recovery, and when to consult an accountant or URA.

- [ ] **Step 4: Wire provider, welcome, tour, and Help into App**

Wrap the unlocked application in `TourProvider navigate={setActiveScreen}`. Track `helpOpen` and `screenBeforeHelp` separately from `AppScreen`. Pass the actual Help button as opener, render `HelpCenterScreen` in the workspace when open, and mount `FirstUnlockWelcome` plus `GuidedTour` as siblings of `AppShell` so overlays are never clipped.

- [ ] **Step 5: Run integration tests**

Run: `npm test -- tests/renderer/AppShell.test.tsx tests/renderer/HelpCenterScreen.test.tsx tests/renderer/GuidedTour.test.tsx && npm run typecheck`

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/AppShell.tsx src/renderer/screens/HelpCenterScreen.tsx src/renderer/styles tests/renderer
git commit -m "feat: add searchable in-app help center"
```

### Task 5: Stable Live Targets Across Every Workflow

**Files:**
- Modify: `src/renderer/components/AppShell.tsx`
- Modify: `src/renderer/screens/TodayScreen.tsx`
- Modify: `src/renderer/screens/BookingsScreen.tsx`
- Modify: `src/renderer/screens/PaymentsScreen.tsx`
- Modify: `src/renderer/screens/ExpensesScreen.tsx`
- Modify: `src/renderer/screens/StaffScreen.tsx`
- Modify: `src/renderer/screens/FinancialPositionScreen.tsx`
- Modify: `src/renderer/screens/ReportsScreen.tsx`
- Modify: `src/renderer/screens/SettingsScreen.tsx`
- Modify relevant editor/components where the real control lives.
- Test: `tests/renderer/guide-content.test.ts`

**Interfaces:**
- Consumes: every `TourStep.target` in `tourDefinitions`.
- Produces: exactly one visible `[data-tour]` element for every step after navigating to `step.screen` in the default seeded state.

- [ ] **Step 1: Add a failing target-integrity test**

Build a set of all tour target values; assert uniqueness within each screen, assert naming uses `^[a-z0-9-]+$`, and maintain an explicit target manifest grouped by screen so renamed or missing selectors fail review.

- [ ] **Step 2: Run the target test and confirm failure**

Run: `npm test -- tests/renderer/guide-content.test.ts`

Expected: FAIL because live controls do not yet expose all declared targets.

- [ ] **Step 3: Add semantic attributes without changing behavior**

Add attributes for sidebar/navigation, quick entry, Today attention and unit status, booking create/table/status, receipt/refund and booking balance, expense/supplier/recurring review, staff allocation/calculation trace, account balances/assets/loans/month end, report period/statements/export/tax, and settings units/rates/categories/accounts/backup/restore/lock. If an editor target is not visible until user action, target the opening command in the tour and explain the form in the same step; do not auto-open or submit it.

- [ ] **Step 4: Run all renderer tests**

Run: `npm test -- tests/renderer && npm run typecheck`

Expected: all renderer tests PASS with no accounting snapshot or behavior changes.

- [ ] **Step 5: Commit**

```bash
git add src/renderer tests/renderer/guide-content.test.ts
git commit -m "feat: connect tutorials to live workflow controls"
```

### Task 6: Electron E2E Tour and Responsive Visual Verification

**Files:**
- Modify: `tests/e2e/app.spec.ts`
- Create: `tests/e2e/guidance.spec.ts`

**Interfaces:**
- Consumes: the real Electron application, local encrypted profile, welcome, Help Center, and Orientation tour.
- Produces: repeatable keyboard and navigation proof at 1280x720, 1440x900, and minimum supported window size.

- [ ] **Step 1: Write the failing E2E guidance test**

Create an isolated profile, complete setup, verify welcome choices, complete all Orientation steps, reopen it from Help, search for rental tax, open all seven chapters, press Escape during a tour, and assert the database file modification time is unchanged by tutorial navigation. Repeat the no-overflow assertions at all three viewport sizes.

- [ ] **Step 2: Run guidance E2E and confirm failure**

Run: `npx playwright test tests/e2e/guidance.spec.ts --reporter=line`

Expected: FAIL before all live targets and responsive placement are correct.

- [ ] **Step 3: Correct only demonstrated integration defects**

Adjust target visibility, panel placement, focus, or responsive CSS based on failing assertions. Do not relax assertions that protect data immutability, keyboard access, or viewport containment.

- [ ] **Step 4: Run complete E2E**

Run: `npm run test:e2e`

Expected: original encrypted-business workflow and guidance workflow PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e src/renderer
git commit -m "test: verify beginner guidance in Electron"
```

### Task 7: Deterministic Screenshots, Demonstrations, and A-to-Z Handbook

**Files:**
- Create: `scripts/capture-user-guide.mjs`
- Create: `docs/user-guide/short-stay-accounts-handbook.md`
- Create: `docs/user-guide/media/*.webp`
- Create: `docs/user-guide/media/*.webm`
- Modify: `package.json`
- Modify: `.gitignore` only if Playwright temporary video output needs exclusion.

**Interfaces:**
- Consumes: actual Electron renderer, a temporary encrypted business profile, and fictional Eden Grove demonstration records.
- Produces: `npm run guide:capture`, deterministic 1440x900 WebP screenshots, five silent WebM demonstrations, fallback images, and the full handbook.

- [ ] **Step 1: Add the capture command and deterministic script**

Add `"guide:capture": "node scripts/capture-user-guide.mjs"`. The script creates a temporary profile, sets up `Eden Grove Learning Property`, seeds fictional records only through approved preload APIs, captures each primary screen and Help Center at 1440x900, records booking/partial-payment/correction/month-close/backup flows, converts screenshots to WebP using the existing Playwright Chromium image pipeline, copies named outputs to `docs/user-guide/media`, and removes the temporary profile in `finally`.

- [ ] **Step 2: Write the complete handbook**

Use this fixed top-level order: Quick Start; How Data Stays Private; Screen Map; First Day; Today; Bookings; Payments; Expenses; Staff and Referrals; Financial Position; Month End; Reports and Tax; Settings and Safety; Daily Checklist; Per-Booking Checklist; Weekly Checklist; Month-End Checklist; Backup and Recovery; Troubleshooting; Glossary; Client Demonstration Script. Every action names the real button and expected visible result. Every moving demonstration includes a static fallback image and a prose caption.

- [ ] **Step 3: Capture media and validate files**

Run: `npm run guide:capture && find docs/user-guide/media -type f -size 0 -print && file docs/user-guide/media/*`

Expected: capture exits 0, the zero-byte search prints nothing, screenshots report WebP, and demonstrations report WebM.

- [ ] **Step 4: Inspect media for fictional data and readable framing**

Run: `rg -n -i "airbnb|real guest|password|token|secret" docs/user-guide scripts/capture-user-guide.mjs`

Expected: only explanatory Airbnb text appears; no password, token, secret, or non-fictional person data is present. Open every screenshot at original resolution and verify no clipped controls, unreadable annotations, or overlapping tutorial panels.

- [ ] **Step 5: Commit handbook and media**

```bash
git add package.json scripts/capture-user-guide.mjs docs/user-guide .gitignore
git commit -m "docs: add complete visual user handbook"
```

### Task 8: Full Verification, Documentation Links, and Release Readiness

**Files:**
- Modify: `README.md`
- Modify: `docs/user-guide/short-stay-accounts-handbook.md` only for defects found during verification.
- Modify application/test files only for defects demonstrated by verification.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a discoverable handbook, green test/build evidence, clean repository state, and a pushed feature branch ready for merge/release.

- [ ] **Step 1: Link the guide from README**

Add a `User guide` section linking to `docs/user-guide/short-stay-accounts-handbook.md`, state that Help is available from the app command bar, and include the exact Windows installer link already published for v0.1.0 without changing it.

- [ ] **Step 2: Run the full automated verification suite**

Run: `npm test && npm run typecheck && npm run test:e2e && npm run package && npm run package:probe`

Expected: 100% command success; all unit/renderer tests pass, all E2E tests pass, TypeScript exits 0, Electron packages, and the encrypted packaged-database probe passes.

- [ ] **Step 3: Perform final accessibility and tax-content checks**

Run: `rg -n "12%|2,820,000|600,000" src/renderer/guidance docs/user-guide`

Expected: all three approved rental-tax values appear in both in-app guidance and handbook.

- [ ] **Step 4: Commit verification-facing changes**

```bash
git add README.md src tests docs scripts package.json package-lock.json
git commit -m "docs: make beginner guidance discoverable"
```

- [ ] **Step 5: Push and inspect CI**

Run: `git push -u origin feature/short-stay-desktop && gh run list --repo Turigye/shortstay-accounts --limit 5`

Expected: push succeeds and the latest repository workflow is queued or completed successfully. Do not create a new release until CI is green and the user has seen the tutorial build.

---

## Completion Evidence

- A new operator can dismiss or complete the first-unlock introduction.
- Help is available without changing the eight-item primary accounting navigation.
- All seven tours work against real controls, are keyboard accessible, and never write accounting data.
- Search finds chapters, checklists, glossary terms, troubleshooting, and the approved rental-tax explanation.
- The repository contains a complete A-to-Z handbook, real fictional-data screenshots, five silent demonstrations, and static fallbacks.
- Renderer, Electron E2E, typecheck, package, encrypted database probe, and GitHub CI all pass.
