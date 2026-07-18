# Editor Access, Receipts, and UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local Admin and Editor profiles, printable booking-payment receipts, and a verified screen-by-screen visual polish pass without changing existing client data.

**Architecture:** Keep the encrypted SQLite business file and local Electron boundary. Add app-level users and capability checks in the main process, protect the existing database key with Electron `safeStorage`, render receipts in a dedicated print window, and use deterministic Playwright captures to audit all screens at three supported sizes.

**Tech Stack:** Electron 43, React 19, TypeScript 7, Zustand, Zod, encrypted SQLite, Node `crypto.scrypt`, Electron `safeStorage`, Vitest, Testing Library, Playwright, Electron Forge.

## Global Constraints

- The application remains local to one Windows or macOS computer.
- Roles are named `admin` and `editor`; visible labels are Admin and Editor.
- Editors may read operational data, create customers/bookings, edit active bookings, progress bookings, record receipts, print receipts, open Help, and lock.
- Editors may not cancel/archive bookings, overpay, refund, correct, reverse, manage accounts, or access financial administration.
- Main-process authorization is authoritative; renderer filtering is presentational only.
- Existing version-8 databases, encrypted backups, passwords, balances, application identity, and user-data paths remain compatible.
- Use the existing palette, typography, information architecture, Lucide icon family, and radius scale.
- Validate 1440x900, 1280x720, and 1024x640 without clipping, overlap, unreadable content, or unreachable actions.
- Do not introduce networking, cloud accounts, remote clients, receipt emailing, thermal-printer specialization, or government invoice numbering.

---

## File Map

### New Files

- `src/domain/users.ts`: roles, capabilities, user/session types, and role-capability mapping.
- `src/main/db/repositories/user-repository.ts`: user persistence, password hashing, bootstrap, login, profile management, and actor attribution.
- `src/main/credential-vault.ts`: `safeStorage` adapter and encrypted local sidecar lifecycle.
- `src/main/authorization.ts`: capability assertion against the active profile.
- `src/main/receipt-service.ts`: receipt projection, UGX words, stable reference, and print-document generation.
- `src/renderer/screens/ProfileLoginScreen.tsx`: app-level username/password login.
- `src/renderer/components/UserManager.tsx`: Admin-only Editor management.
- `src/renderer/components/ReceiptDialog.tsx`: post-payment preview and print action.
- `src/renderer/styles/receipt.css`: isolated receipt and print rules.
- `scripts/capture-ui-audit.mjs`: deterministic all-screen, all-size capture and overflow checks.
- `tests/domain/users.test.ts`: capability matrix.
- `tests/main/user-repository.test.ts`: bootstrap, authentication, reset, and deactivation.
- `tests/main/authorization.test.ts`: role enforcement.
- `tests/main/credential-vault.test.ts`: OS-storage success and fallback.
- `tests/main/receipt-service.test.ts`: receipt values and HTML safety.
- `tests/main/business-session.test.ts`: database unlock, profile login, logout, and recovery states.
- `tests/renderer/profile-login.test.tsx`: login behavior.
- `tests/renderer/user-manager.test.tsx`: Editor management behavior.
- `tests/renderer/receipt-dialog.test.tsx`: receipt workflow.
- `tests/e2e/editor-receipts.spec.ts`: end-to-end Admin, Editor, and receipt flow.

### Existing Files

- `src/main/db/migrations.ts`: additive version-9 user and actor schema.
- `src/main/db/repositories/audit-repository.ts`: optional actor on append-only events.
- `src/main/db/repositories/booking-repository.ts`: actor-aware booking audit.
- `src/main/db/repositories/payment-repository.ts`: actor attribution and receipt projection fields.
- `src/main/business-session.ts`: database-open and profile-authenticated session states.
- `src/main/ipc/register-handlers.ts`: new handlers and centralized capability checks.
- `src/main/main.ts`: credential vault and native receipt printing.
- `src/shared/ipc.ts`: profile, user-management, receipt, print, and `FORBIDDEN` schemas.
- `src/renderer/store/app-store.ts`: profile-aware phases and actions.
- `src/renderer/App.tsx`: profile login, role-aware routing, and receipt state.
- `src/renderer/components/AppShell.tsx`: filtered navigation, quick actions, and active profile.
- `src/renderer/screens/BookingsScreen.tsx`: Editor-safe controls.
- `src/renderer/screens/PaymentsScreen.tsx`: Editor-safe controls and receipt actions.
- `src/renderer/components/BookingBalance.tsx`: print action per receipt movement.
- `src/renderer/screens/SettingsScreen.tsx`: Users section.
- `src/renderer/styles/app.css`: targeted spacing, overflow, alignment, and visibility fixes.
- `src/renderer/styles/tokens.css`: only shared dimensions proven necessary by the audit.
- `src/renderer/guidance/guide-content.ts`: profiles and receipts guidance.
- `docs/user-guide/short-stay-accounts-handbook.md`: Admin, Editor, and receipt instructions.
- `scripts/capture-user-guide.mjs`: refreshed fictional screenshots and demonstrations.
- Existing main, renderer, E2E, packaging, and backup tests: regression coverage.

---

### Task 1: Add the User and Actor Data Model

**Files:**
- Create: `src/domain/users.ts`
- Create: `src/main/db/repositories/user-repository.ts`
- Modify: `src/main/db/migrations.ts`
- Modify: `src/main/db/repositories/audit-repository.ts`
- Modify: `src/main/db/repositories/booking-repository.ts`
- Modify: `src/main/db/repositories/payment-repository.ts`
- Test: `tests/domain/users.test.ts`
- Test: `tests/main/user-repository.test.ts`
- Test: `tests/main/database.test.ts`
- Test: `tests/main/booking-repository.test.ts`
- Test: `tests/main/payment-repository.test.ts`

**Interfaces:**
- Produces: `UserRole`, `Capability`, `AuthenticatedUser`, `capabilitiesFor(role)`.
- Produces: `UserRepository.bootstrapAdmin`, `authenticate`, `list`, `createEditor`, `updateIdentity`, `resetEditorPassword`, `setActive`.
- Produces: optional `actorUserId` repository context and persisted `createdByUserId` payment field.

- [ ] **Step 1: Write failing capability, migration, and user-repository tests**

```ts
expect(capabilitiesFor("editor")).toContain("payment.receipt");
expect(capabilitiesFor("editor")).not.toContain("payment.refund");

const upgraded = openVersionEightFixture();
migrateDatabase(upgraded);
expect(upgraded.pragma("user_version", { simple: true })).toBe(9);
expect(upgraded.prepare("select count(*) count from bookings").get()).toEqual({ count: 3 });

const admin = users.bootstrapAdmin("correct local password");
expect(users.authenticate("ADMIN", "correct local password")).toMatchObject({
  id: admin.id,
  role: "admin",
});
```

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npm test -- tests/domain/users.test.ts tests/main/user-repository.test.ts tests/main/database.test.ts`

Expected: FAIL because version 9, user types, and repository do not exist.

- [ ] **Step 3: Add explicit role and capability types**

```ts
export type UserRole = "admin" | "editor";
export type Capability =
  | "booking.read" | "booking.create" | "booking.update" | "booking.progress"
  | "payment.read" | "payment.receipt" | "receipt.print" | "admin.all";

export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly role: UserRole;
}
```

- [ ] **Step 4: Add the additive version-9 schema**

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor')),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (business_id, username)
);
ALTER TABLE audit_events ADD COLUMN actor_user_id TEXT REFERENCES users(id);
ALTER TABLE payments ADD COLUMN created_by_user_id TEXT REFERENCES users(id);
```

- [ ] **Step 5: Implement password hashing and profile rules**

```ts
const derived = scryptSync(password, Buffer.from(salt, "base64"), 64);
return timingSafeEqual(derived, Buffer.from(expectedHash, "base64"));
```

Use a random 16-byte salt, a 64-byte `scrypt` result, case-insensitive usernames, generic login failures, and a transaction for every profile mutation. Permit only Editors in Editor reset/deactivation methods and prevent deactivating the last active Admin.

- [ ] **Step 6: Add actor attribution without rewriting historic records**

```ts
audit.append({
  actorUserId,
  entityType: "booking",
  entityId: result.id,
  action: "create",
  after: result,
});
```

Pass `actorUserId` into booking/payment repository factories. Persist `created_by_user_id` only on newly inserted payment movements and map null to `createdByUserId: null`.

- [ ] **Step 7: Run focused data tests**

Run: `npm test -- tests/domain/users.test.ts tests/main/user-repository.test.ts tests/main/database.test.ts tests/main/booking-repository.test.ts tests/main/payment-repository.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/users.ts src/main/db/migrations.ts src/main/db/repositories tests/domain/users.test.ts tests/main
git commit -m "feat: add local user profiles and actor attribution"
```

### Task 2: Add Secure Database Reopening and Authenticated Sessions

**Files:**
- Create: `src/main/credential-vault.ts`
- Create: `src/main/authorization.ts`
- Modify: `src/main/business-session.ts`
- Modify: `src/main/main.ts`
- Test: `tests/main/credential-vault.test.ts`
- Test: `tests/main/authorization.test.ts`
- Test: `tests/main/business-session.test.ts`

**Interfaces:**
- Consumes: `AuthenticatedUser`, `Capability`, `UserRepository`.
- Produces: `CredentialVault.load/save/clear`.
- Produces: `BusinessSessionStatus` states `setup`, `databaseLocked`, `profileLocked`, and `ready`.
- Produces: `BusinessSession.login`, `logout`, `getCurrentUser`, and Admin user-management methods.

- [ ] **Step 1: Write failing vault and session-state tests**

```ts
const vault = createCredentialVault(fakeSafeStorage, credentialPath);
vault.save("database password");
expect(vault.load()).toBe("database password");

expect(session.unlockDatabase("database password")).toMatchObject({
  state: "ready",
  user: { username: "admin", role: "admin" },
});
session.logout();
expect(session.getStatus().state).toBe("profileLocked");
```

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npm test -- tests/main/credential-vault.test.ts tests/main/authorization.test.ts tests/main/business-session.test.ts`

Expected: FAIL because the vault, authorization module, and profile session states do not exist.

- [ ] **Step 3: Implement the OS-backed credential vault**

```ts
save(secret: string): void {
  if (!safeStorage.isEncryptionAvailable()) throw new CredentialVaultError("UNAVAILABLE");
  writeFileSync(path, safeStorage.encryptString(secret), { mode: 0o600 });
}
```

Read and write one opaque binary sidecar under Electron `userData`. Clear corrupt values and return null so startup falls back to Admin database unlock.

- [ ] **Step 4: Implement capability authorization**

```ts
export function assertCapability(
  user: AuthenticatedUser | null,
  capability: Capability,
): void {
  if (!user || !hasCapability(user.role, capability)) {
    throw new BusinessSessionError("FORBIDDEN", "Your profile cannot perform this action.");
  }
}
```

- [ ] **Step 5: Split database unlock from profile login**

On business creation or legacy unlock, bootstrap `Owner/admin`, authenticate that Admin, and save the database secret through the vault. On ordinary launch, load the secret, open the database, and expose `profileLocked`. Keep the active profile in memory only.

- [ ] **Step 6: Gate every business-session method**

Apply explicit capabilities to Editor-allowed operations. Treat all unlisted operations as `admin.all`. Reject Editor overpayment even though the payment repository supports Admin-confirmed overpayment.

- [ ] **Step 7: Clear sessions on sensitive lifecycle events**

```ts
logout(): void {
  activeUser = null;
}

lock(): void {
  activeUser = null;
  database?.close();
  database = undefined;
}
```

Clear the active user on logout, full database lock, restore, and application exit. Keep “Lock” as profile logout during normal operation; use full database lock only for recovery and shutdown.

- [ ] **Step 8: Run focused session tests**

Run: `npm test -- tests/main/credential-vault.test.ts tests/main/authorization.test.ts tests/main/business-session.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/main/credential-vault.ts src/main/authorization.ts src/main/business-session.ts src/main/main.ts tests/main
git commit -m "feat: add secure profile sessions"
```

### Task 3: Expose Profile and Permission Workflows Through IPC

**Files:**
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/ipc/register-handlers.ts`
- Modify: `src/preload/index.ts`
- Test: `tests/main/ipc.test.ts`

**Interfaces:**
- Produces channels: `profile:login`, `profile:logout`, `users:list`, `users:create-editor`, `users:update`, `users:reset-password`, `users:set-active`.
- Produces `SessionSnapshot = { business, user }`.
- Produces public failure code `FORBIDDEN`.

- [ ] **Step 1: Write failing request, response, and denial tests**

```ts
expect(ipcRequestSchema.safeParse({
  channel: IPC_CHANNELS.PROFILE_LOGIN,
  payload: { username: "desk", password: "strong editor password" },
}).success).toBe(true);

expect(await invokeAsEditor(IPC_CHANNELS.PAYMENT_REFUND, refund)).toMatchObject({
  ok: false,
  code: "FORBIDDEN",
});
```

- [ ] **Step 2: Run IPC tests and confirm they fail**

Run: `npm test -- tests/main/ipc.test.ts`

Expected: FAIL because profile channels and `FORBIDDEN` are not registered.

- [ ] **Step 3: Add strict Zod schemas and response types**

```ts
const profileLoginRequestSchema = z.object({
  channel: z.literal(IPC_CHANNELS.PROFILE_LOGIN),
  payload: z.object({
    username: z.string().trim().min(1).max(80),
    password: z.string().min(1).max(1024),
  }).strict(),
}).strict();
```

Use exact schemas for Editor creation, identity update, password reset, and active-state changes. Never return password salts or hashes.

- [ ] **Step 4: Register handlers and map public errors**

```ts
[IPC_CHANNELS.PROFILE_LOGIN]: (payload) => session.login(payload),
[IPC_CHANNELS.USERS_CREATE_EDITOR]: (payload) => session.createEditor(payload),
```

Keep the preload bridge generic; its inferred API expands through the shared channel union without exposing raw Electron APIs.

- [ ] **Step 5: Test the complete Editor capability matrix through handlers**

Cover all allowed and forbidden channels, including crafted cancel/archive/refund/correction/reversal/account/settings/report/backup requests.

- [ ] **Step 6: Run IPC and type tests**

Run: `npm test -- tests/main/ipc.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ipc.ts src/main/ipc/register-handlers.ts src/preload/index.ts tests/main/ipc.test.ts
git commit -m "feat: enforce profile permissions over IPC"
```

### Task 4: Build Profile Login and Role-Aware Application UI

**Files:**
- Create: `src/renderer/screens/ProfileLoginScreen.tsx`
- Create: `src/renderer/components/UserManager.tsx`
- Modify: `src/renderer/store/app-store.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/AppShell.tsx`
- Modify: `src/renderer/screens/SettingsScreen.tsx`
- Modify: `src/renderer/screens/BookingsScreen.tsx`
- Modify: `src/renderer/screens/PaymentsScreen.tsx`
- Modify: `src/renderer/styles/app.css`
- Test: `tests/renderer/profile-login.test.tsx`
- Test: `tests/renderer/user-manager.test.tsx`
- Test: `tests/renderer/App.test.tsx`
- Test: `tests/renderer/AppShell.test.tsx`

**Interfaces:**
- Consumes: `SessionSnapshot`, `AuthenticatedUser`.
- Produces: role-filtered `AppShell`, profile login, and Settings Users section.

- [ ] **Step 1: Write failing renderer tests**

```tsx
render(<AppShell user={editor} activeScreen="today" {...props} />);
expect(screen.getByRole("button", { name: "Bookings" })).toBeVisible();
expect(screen.queryByRole("button", { name: "Reports" })).toBeNull();
expect(screen.queryByRole("button", { name: "Expense" })).toBeNull();
```

- [ ] **Step 2: Run renderer tests and confirm they fail**

Run: `npm test -- tests/renderer/profile-login.test.tsx tests/renderer/user-manager.test.tsx tests/renderer/App.test.tsx tests/renderer/AppShell.test.tsx`

Expected: FAIL because profile-aware UI does not exist.

- [ ] **Step 3: Add profile-aware store phases**

```ts
type AppPhase = "booting" | "setup" | "databaseLocked" | "profileLocked" | "ready";
interface AppState {
  business: BusinessSettings | null;
  user: AuthenticatedUser | null;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}
```

- [ ] **Step 4: Build the compact profile login**

Use labeled username/password fields, business identity, generic inline failure, loading state, and keyboard submission. Do not reveal financial data or whether a username exists.

- [ ] **Step 5: Filter navigation and quick actions**

```ts
const visibleNavigation = user.role === "editor"
  ? navigationItems.filter(({ screen }) =>
      ["today", "bookings", "payments"].includes(screen))
  : navigationItems;
```

Show the active profile name and Editor/Admin label in the command bar. Ensure route state returns an Editor to Today if a previously selected Admin-only screen becomes invalid.

- [ ] **Step 6: Restrict booking and payment controls**

For Editors, retain create/edit/progress booking controls and receipt recording. Remove archive, cancellation, refund, correction, reversal, overpayment confirmation, and account-management controls.

- [ ] **Step 7: Add Admin Users settings**

Implement list, create Editor, rename profile, reset Editor password, deactivate/reactivate, busy/error/empty states, and final-Admin protection messaging.

- [ ] **Step 8: Run renderer tests**

Run: `npm test -- tests/renderer/profile-login.test.tsx tests/renderer/user-manager.test.tsx tests/renderer/App.test.tsx tests/renderer/AppShell.test.tsx tests/renderer/booking-editor.test.tsx tests/renderer/payment-editor.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/renderer tests/renderer
git commit -m "feat: add Admin and Editor workspaces"
```

### Task 5: Build Immutable Printable Receipts

**Files:**
- Create: `src/main/receipt-service.ts`
- Create: `src/renderer/components/ReceiptDialog.tsx`
- Create: `src/renderer/styles/receipt.css`
- Modify: `src/main/main.ts`
- Modify: `src/main/business-session.ts`
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/ipc/register-handlers.ts`
- Modify: `src/renderer/screens/PaymentsScreen.tsx`
- Modify: `src/renderer/components/BookingBalance.tsx`
- Modify: `src/renderer/styles/app.css`
- Test: `tests/main/receipt-service.test.ts`
- Test: `tests/renderer/receipt-dialog.test.tsx`
- Test: `tests/renderer/payment-editor.test.tsx`

**Interfaces:**
- Produces: `ReceiptDocument`, `getReceipt(paymentId)`, `printReceipt(paymentId)`.
- Produces channels: `receipts:get`, `receipts:print`.
- Consumes: immutable payment, booking, customer, unit, account, user, and reversal data.

- [ ] **Step 1: Write failing receipt projection and escaping tests**

```ts
expect(receipt).toMatchObject({
  reference: expect.stringMatching(/^RCT-20260718-[A-F0-9]{6}$/),
  guestName: "Amina Kato",
  amount: 150_000,
  amountWords: "One hundred fifty thousand Uganda shillings only",
  receivedBy: "Front Desk",
  remainingBalance: 350_000,
});
expect(renderReceiptHtml({ ...receipt, guestName: "<script>" })).not.toContain("<script>");
```

- [ ] **Step 2: Run receipt tests and confirm they fail**

Run: `npm test -- tests/main/receipt-service.test.ts tests/renderer/receipt-dialog.test.tsx`

Expected: FAIL because receipt projection and UI do not exist.

- [ ] **Step 3: Implement one authoritative receipt projection**

Query the receipt and all related entities in the main process. Calculate “received after this movement” chronologically, derive a stable `RCT-YYYYMMDD-XXXXXX` reference from immutable fields, detect a later reversal, and convert safe whole UGX values to words.

- [ ] **Step 4: Generate a self-contained print document**

```ts
export function renderReceiptHtml(receipt: ReceiptDocument): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${receiptCss}</style></head>
    <body><main class="receipt-sheet">${renderReceiptBody(receipt)}</main></body></html>`;
}
```

Escape all data, use system fonts, fit A4 and common half-page output, and include no application chrome.

- [ ] **Step 5: Print through a temporary hidden Electron window**

Load the HTML through a data URL, wait for `did-finish-load`, call `webContents.print({ printBackground: true })`, return cancelled/success status, then destroy the print window. Keep all printing in the main process.

- [ ] **Step 6: Add receipt actions to payment workflows**

After recording a receipt, keep the returned movement and open `ReceiptDialog`. Add a printer icon only to receipt movements. Editors can print receipts but cannot print refunds/corrections/reversals as receipts.

- [ ] **Step 7: Run receipt and payment tests**

Run: `npm test -- tests/main/receipt-service.test.ts tests/renderer/receipt-dialog.test.tsx tests/renderer/payment-editor.test.tsx tests/main/ipc.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/main src/shared/ipc.ts src/renderer/components src/renderer/screens/PaymentsScreen.tsx src/renderer/styles tests
git commit -m "feat: print client payment receipts"
```

### Task 6: Capture and Polish Every Screen

**Files:**
- Create: `scripts/capture-ui-audit.mjs`
- Modify: `src/renderer/styles/app.css`
- Modify: `src/renderer/styles/guidance.css`
- Modify: `src/renderer/styles/tokens.css`
- Modify only when a measured issue requires it: `src/renderer/screens/*.tsx`
- Modify only when a measured issue requires it: `src/renderer/components/*.tsx`
- Test: `tests/e2e/app.spec.ts`

**Interfaces:**
- Produces: screenshots under ignored `test-results/ui-audit/<size>/<screen>.png`.
- Produces: automated viewport, horizontal-overflow, occlusion, and actionable-element checks.

- [ ] **Step 1: Add a deterministic audit capture script**

```js
const sizes = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1024x640", width: 1024, height: 640 },
];
const screens = [
  "today", "bookings", "payments", "expenses", "staff",
  "financial-position", "reports", "settings", "help",
];
```

Capture setup, database unlock fallback, Admin login, Editor login, every main screen, every side editor, Users settings, receipt dialog, error states, and empty states. Seed fictional data only.

- [ ] **Step 2: Add measurable layout assertions**

```js
const violations = await page.evaluate(() =>
  [...document.querySelectorAll("button,input,select,textarea,[role=dialog]")]
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1;
    })
    .map((element) => element.getAttribute("aria-label") || element.textContent?.trim())
);
expect(violations).toEqual([]);
```

Allow intentional table scrolling containers, but reject document-level horizontal overflow, clipped dialog actions, inaccessible fixed panels, and zero-contrast controls.

- [ ] **Step 3: Run the baseline audit and inspect every image**

Run: `node scripts/capture-ui-audit.mjs`

Expected: screenshots are produced and the script reports exact failing screen/size/state combinations.

- [ ] **Step 4: Apply only evidence-based visual fixes**

Standardize page header action wrapping, 36/40px controls, panel padding, table action columns, side-panel max widths, sticky footer spacing, viewport-safe max heights, and narrow-window grids. Preserve existing colors, typography, icon family, and information architecture.

- [ ] **Step 5: Repeat capture and inspect each final image**

Run: `node scripts/capture-ui-audit.mjs`

Expected: all assertions pass; every screenshot is readable with no overlap, clipping, hidden action, compressed field, or accidental wrapping.

- [ ] **Step 6: Run renderer and E2E regressions**

Run: `npm test && npm run test:e2e`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/capture-ui-audit.mjs src/renderer tests/e2e/app.spec.ts
git commit -m "fix: polish desktop layouts across supported sizes"
```

### Task 7: Update In-App Guidance and Tutorial Media

**Files:**
- Modify: `src/renderer/guidance/guide-content.ts`
- Modify: `src/renderer/guidance/FirstUnlockWelcome.tsx`
- Modify: `docs/user-guide/short-stay-accounts-handbook.md`
- Modify: `scripts/capture-user-guide.mjs`
- Replace: `docs/user-guide/media/*.webp`
- Replace only changed workflows: `docs/user-guide/media/*.webm`
- Test: `tests/renderer/guide-content.test.ts`
- Test: `tests/e2e/guidance.spec.ts`

**Interfaces:**
- Consumes: final profile, user-management, and receipt controls.
- Produces: searchable guidance and fictional final-interface media.

- [ ] **Step 1: Write failing guide-content tests**

```ts
expect(searchGuide("editor password").some(({ id }) => id === "profiles")).toBe(true);
expect(searchGuide("print receipt").some(({ id }) => id === "receipts")).toBe(true);
```

- [ ] **Step 2: Run guidance tests and confirm they fail**

Run: `npm test -- tests/renderer/guide-content.test.ts tests/e2e/guidance.spec.ts`

Expected: FAIL because profile and receipt chapters do not exist.

- [ ] **Step 3: Add concise Admin, Editor, and receipt guidance**

Document profile creation/reset/deactivation, Editor limitations, first Admin unlock after upgrade, receipt recording/printing/reprinting, Save as PDF, and secure-storage fallback.

- [ ] **Step 4: Update the handbook**

Add short A-to-Z procedures and a permission table. Preserve existing accounting explanations and avoid claims that receipts are URA tax invoices.

- [ ] **Step 5: Refresh final tutorial media**

Update the capture script for profile login, Users settings, and receipt printing. Regenerate all static screen captures after the visual polish pass; regenerate demonstrations whose controls or layout changed.

- [ ] **Step 6: Verify media**

Run: `npm run guide:capture && npm test -- tests/renderer/guide-content.test.ts && npm run test:e2e -- tests/e2e/guidance.spec.ts`

Expected: PASS with readable fictional-data media.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/guidance docs/user-guide scripts/capture-user-guide.mjs tests
git commit -m "docs: teach Editor access and receipt printing"
```

### Task 8: Verify Upgrade Safety and Produce Release Artifacts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify when needed: `forge.config.ts`
- Modify: `.github/workflows/build-windows.yml`
- Modify: `README.md`
- Create: `docs/releases/0.3.0.md`
- Test: existing complete test suite and packaging probes.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: versioned macOS package, Windows Squirrel installer, checksums, and release documentation.

- [ ] **Step 1: Add an upgrade-retention E2E fixture**

Create a populated version-8 encrypted database with bookings, payments, assets, loans, and the existing password. Launch the updated app against it, complete Admin bootstrap, and assert record counts and financial totals remain unchanged.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
npm run typecheck
npm test
npm run test:e2e
npm run package
npm run package:probe
```

Expected: every command exits 0.

- [ ] **Step 3: Verify native printing manually on macOS**

Open a seeded receipt, launch the native print dialog, inspect preview, cancel once, then use Save as PDF and inspect the PDF. Confirm the application remains responsive.

- [ ] **Step 4: Build the Windows installer in the existing CI/release workflow**

Run the repository’s Windows Electron Forge build on `windows-latest`, producing the Squirrel `.exe` without changing `productName`, `name`, or Electron user-data identity.

- [ ] **Step 5: Install over version 0.2.0 on Windows**

Confirm the existing database is found, the original password performs the one-time Admin bootstrap, Editor login works after restart, and all historic figures remain identical.

- [ ] **Step 6: Refresh final screenshots after release build verification**

Run: `node scripts/capture-ui-audit.mjs && npm run guide:capture`

Expected: no visual-audit failures and tutorial media matches the released UI.

- [ ] **Step 7: Commit release metadata**

```bash
git add package.json forge.config.ts README.md docs
git commit -m "chore: prepare Editor and receipts release"
```

- [ ] **Step 8: Tag and publish only after all artifacts pass**

Create tag `v0.3.0`, upload the Windows installer and macOS archive with SHA-256 checksums, and state explicitly that installing the update preserves data in the existing Electron user-data directory.

---

## Final Acceptance Checklist

- [ ] Existing client data and encryption password survive the upgrade unchanged.
- [ ] Admin has complete access and can manage Editors.
- [ ] Editor can create/edit/progress bookings and record/print receipts.
- [ ] Every forbidden Editor action fails through IPC even when invoked directly.
- [ ] Every new booking and receipt records its actor.
- [ ] Historic records remain valid with the pre-profile attribution label.
- [ ] Printed receipts contain the approved fields and no application chrome.
- [ ] All application states pass capture review at all three supported sizes.
- [ ] Updated tutorials use fictional data and match the final interface.
- [ ] Tests, typecheck, E2E, package, packaged database probe, macOS output, and Windows installer pass.
