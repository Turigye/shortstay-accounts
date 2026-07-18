# Editor Access, Receipts, and UI Polish Design

## Purpose

Add controlled staff access and printable client receipts without turning Short-Stay Accounts into a networked system. Complete the release with a restrained visual quality pass across every existing screen.

## Product Decisions

- The application remains local to one Windows or macOS computer.
- The privileged role is named **Admin**.
- The restricted role is named **Editor**.
- No cloud service, companion application, synchronization, or remote database is introduced.
- Existing business data, passwords, backups, and encrypted database files remain compatible.

## Local User Profiles

### Admin

An Admin can use every existing feature and can create, deactivate, and reset Editor profiles. New businesses create an initial Admin automatically. Existing businesses create it after the owner's first successful unlock following the upgrade. Its initial username is `admin`, its display name is `Owner`, and its initial profile password is the existing business password. The Admin can change the display name and username later.

### Editor

An Editor can:

- View the Today screen and operational booking information.
- Create customers required for new bookings.
- Create bookings.
- Edit active bookings.
- Move bookings through confirmed, checked-in, and completed states.
- View payment accounts for selecting where money was received.
- Record incoming booking receipts.
- Print and reprint receipts they are permitted to view.
- Open Help and lock or sign out of the application.

An Editor cannot:

- Cancel, archive, or delete bookings.
- Record refunds, corrections, reversals, or overpayments.
- Create or modify payment accounts.
- Access Expenses, Staff, Financial Position, Reports, or Settings.
- Manage users, units, rates, taxes, backups, restores, or exports.

Navigation and controls are filtered for clarity, but authorization is enforced in the Electron main process for every IPC request. A hidden control or crafted renderer request must not bypass a permission check.

## Authentication and Encryption

The encrypted SQLite database continues using its existing encryption password. On the first launch after upgrading:

1. The owner unlocks the existing business normally.
2. The application creates the initial Admin profile.
3. Electron `safeStorage` protects the database unlock secret for that operating-system user.
4. Later launches open the database securely and present an application-profile login screen.

Profile passwords are salted and hashed inside the encrypted database. Plain profile passwords are never stored. The database unlock secret is stored only as an operating-system-encrypted sidecar value.

If secure OS storage is unavailable or invalidated, the application falls back to the existing Admin database-unlock flow. An Admin unlock restores local profile access. An Editor cannot recover the database or reset an Admin password.

The active profile exists only in main-process memory and is cleared on lock, sign-out, database restore, and application exit.

## Data and Audit Model

A forward-only schema migration adds:

- A `users` table scoped to the business with name, username, role, password hash, active state, and timestamps.
- `actor_user_id` on new audit events.
- `created_by_user_id` on new payment movements so a receipt retains its original operator.

Historic audit events and payments keep a null actor and display “Recorded before user profiles.” Existing records are not rewritten.

Every profile-management action, booking creation or update, booking status transition, and payment receipt records the active actor. Usernames are unique without regard to letter case. Deactivation prevents future login but preserves attribution.

## Session and Permission Boundaries

The business session gains a distinct authenticated-user session. Repository methods continue owning accounting rules; an authorization layer checks the active role before invoking them.

Permissions use explicit capabilities rather than renderer screen names:

- `booking.read`
- `booking.create`
- `booking.update`
- `booking.progress`
- `payment.read`
- `payment.receipt`
- `receipt.print`
- Admin-only capabilities for all remaining operations

Denied operations return a stable `FORBIDDEN` error with a clear message. Authentication failures do not reveal whether a username exists. Repeated login attempts receive a short in-memory delay.

## Printable Client Receipts

Every immutable receipt payment has a printable view available after recording and from payment history.

The receipt contains:

- Business name and “Payment Receipt” heading.
- Stable receipt reference derived from the payment date and immutable payment ID.
- Payment date and time.
- Guest name and contact number.
- Unit, occupancy type, check-in, and check-out.
- Amount received in UGX and words.
- Payment method, receiving account, and external reference when supplied.
- Booking total, total received after this movement, and remaining balance.
- “Received by” profile name, or the historic-record fallback.
- Reversed status when an Admin has subsequently reversed the movement.
- A concise local-business footer without tax claims.

Printing uses a dedicated print document and Electron’s native print dialog. The operator can select a physical printer or Save as PDF. The ordinary application navigation and controls never appear on the printed page. Reprinting reads the immutable movement and current reversal status; it does not edit the payment.

## Interface Changes

### Profile Login

After secure database opening, a compact login screen asks for username and password. It shows the business name but no financial information. Lock returns to this screen. The active profile name and role appear discreetly in the command bar.

### User Management

Settings gains an Admin-only Users section. It supports creating an Editor, resetting their password, and deactivating or reactivating their profile. The final active Admin cannot be deactivated.

### Editor Workspace

The Editor sidebar contains Today, Bookings, Payments, and Help access. Quick actions contain Booking and Payment only. Unsupported actions are absent rather than disabled, while server-side authorization remains authoritative.

### Receipt Actions

After a successful receipt, the confirmation offers **Print receipt** and **Done**. Receipt rows in payment history expose an icon button with the accessible label “Print receipt”.

## Visual Quality Pass

The release includes an audit of every setup, login, application, editor, dialog, empty, loading, error, and print state at:

- 1440 × 900
- 1280 × 720
- 1024 × 640

The audit fixes only production-quality inconsistencies:

- Clipped or hidden content.
- Insufficient text, button, form, and status contrast.
- Uneven page, panel, field, and table spacing.
- Misaligned headers, actions, icons, and footer buttons.
- Compressed controls and wrapped button labels.
- Dialogs or drawers that exceed the viewport.
- Tables that fail to scroll or preserve important actions.
- Sticky elements that cover content.
- Inconsistent control heights, corner radii, and focus treatment.

The existing visual identity, palette, typography, information architecture, and Lucide icon family remain intact. No decorative redesign or unrelated component replacement is permitted.

## Guidance Updates

The Help Center, guided tours, handbook, screenshots, and demonstrations are updated for:

- Admin and Editor login.
- Creating, resetting, and deactivating Editors.
- Editor permission boundaries.
- Printing and reprinting receipts.

Tutorial media uses fictional data and the polished final interface.

## Upgrade and Recovery

- The migration is additive and runs inside the existing migration transaction.
- Existing encrypted databases open with their current password.
- Existing backups remain restorable.
- Restoring a backup clears the active user session and requires Admin recovery if the restored file predates profiles.
- Updating or reinstalling the application does not replace the database stored in Electron’s user-data directory.
- Windows packaging retains the existing application identity and data path.

## Testing and Acceptance

- Migration tests upgrade a populated version-8 database without changing business records or balances.
- Authentication tests cover Admin bootstrap, Editor login, deactivation, password reset, lock, and secure-storage fallback.
- IPC tests prove every Editor-allowed operation succeeds and every forbidden operation fails in the main process.
- Audit tests verify actor attribution and historic null-actor compatibility.
- Receipt tests verify exact fields, stable references, balance calculations, reversal status, and print-only layout.
- Renderer tests cover role-filtered navigation, receipt actions, user management, and accessible login errors.
- Electron E2E tests exercise Admin and Editor workflows.
- Every screen is captured and inspected at all three target sizes with no clipping, overlap, unreadable content, or unreachable action.
- Typecheck, unit tests, Electron E2E tests, packaged database probe, macOS package, and Windows installer build must pass before release.

## Scope Boundaries

- Editors use the same physical computer and operating-system account as the Admin.
- Independent phones, remote computers, cloud access, and live synchronization are excluded.
- Editor cancellation, deletion, refunds, corrections, reversals, account management, and financial reporting are excluded.
- Receipt emailing, custom branding templates, thermal-printer-specific formatting, and sequential government invoice numbering are excluded.
- The visual work is a consistency and usability pass, not a new product design.
