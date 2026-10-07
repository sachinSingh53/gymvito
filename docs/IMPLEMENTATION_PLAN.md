# GymVito Phase-wise Implementation Plan

## React Native + Expo

| Field | Decision |
|---|---|
| Product contract | [GymVito Feature Specification](./FEATURE_SPECIFICATION.md) |
| Application model | Local-first, single-device app |
| Runtime backend | None |
| Internet | Permitted, but no GymVito API, remote database, account service, or sync service |
| Primary release target | Android phone and tablet |
| Application framework | React Native with Expo and TypeScript |
| Navigation | Expo Router |
| Primary database | Expo SQLite with SQLCipher |
| Development runtime | Expo Go by default; GymVito development build for native security work |
| Time zone | Current device time zone only; no selectable or multi-time-zone support |
| Excluded feature | Attendance and member check-in/check-out |
| Plan status | Draft implementation contract |

---

## 1. Purpose

This document turns the GymVito feature specification into an ordered engineering plan. Each phase produces a testable product increment, declares its data migrations, and has an exit gate that must pass before dependent work starts.

This is an execution plan, not a replacement for the product specification. If the two documents conflict, the feature specification defines product behavior and this plan must be updated before implementation continues.

### 1.1 Locked scope boundaries

- All operational and personal data is stored on the device.
- The application has no GymVito backend server, remote database, web account, or synchronization engine.
- Internet access is allowed for explicit non-core actions such as app-store delivery, external help links, and user-initiated operating-system sharing or document-provider access.
- Core member, membership, payment, receipt, report, export, backup, and restore workflows work without connectivity.
- The app uses the current device time zone. There is no gym time-zone setting.
- Membership start/end dates are stored as date-only values and do not shift when the device time zone changes.
- Attendance, check-in/check-out, visits, kiosk mode, and session-based admission are outside this implementation plan.
- The initial product is a native mobile/tablet app. A web build is not part of the plan.

### 1.2 Planning rule

Phase numbers describe dependency order, not calendar duration. Delivery estimates should be produced after Phase 0 proves the highest-risk native, encryption, backup, and document-generation paths.

---

## 2. Technical Baseline

### 2.1 Application platform

- Bootstrap with the current stable Expo SDK available at implementation kickoff.
- Record and pin the exact Expo, React Native, Node, package-manager, Android Gradle, Java, and native toolchain versions.
- Use TypeScript in strict mode.
- Use Expo Continuous Native Generation/config plugins instead of hand-editing generated native projects.
- Use Expo Go as the default routine-development runtime and keep `expo-dev-client` plus local Android development builds available from the first phase.
- Keep SQLCipher, Argon2id, encrypted backup/restore, and release acceptance on GymVito native builds. Expo Go is a compatibility path and must not be treated as evidence for those capabilities.
- Target Android first. Keep domain, data, localization, and UI code platform-neutral so an iOS release can be qualified later without redesign.
- Do not configure Expo/EAS over-the-air updates for the MVP. Release updates through the app store or a deliberately managed installation artifact so the runtime has no update-service dependency.

### 2.2 Recommended dependencies

Exact versions must be selected with `expo install` or compatibility-checked at Phase 0 and then locked.

| Concern | Proposed package/approach |
|---|---|
| Routing | `expo-router` with typed routes |
| Encrypted database | `expo-sqlite` configured with `useSQLCipher: true` |
| Device key storage | `expo-secure-store` |
| Biometric prompt | `expo-local-authentication` |
| Device locale/time zone | `expo-localization` |
| Translation runtime | `i18next` and `react-i18next` |
| Forms | `react-hook-form` with `zod` schemas |
| IDs and file hashes | `expo-crypto` where its reviewed APIs are sufficient |
| Profile images | `expo-image-picker` and `expo-image-manipulator` |
| Local files | Current `expo-file-system` API |
| Import/restore selection | `expo-document-picker` |
| Share sheet | `expo-sharing` |
| PDF/printing | `expo-print` using controlled local HTML templates |
| Local reminders | `expo-notifications`; no push token or push service |
| Screen privacy | `expo-screen-capture` where supported |
| Large lists | Start with React Native lists; adopt `@shopify/flash-list` only if benchmark evidence requires it |
| Unit/component tests | Jest, `jest-expo`, React Native Testing Library |
| Native end-to-end tests | Maestro or an equivalent device-level runner selected in Phase 0 |

Do not add a general-purpose HTTP client, remote-data cache, authentication SDK, analytics SDK, advertising SDK, or cloud-database SDK to the MVP.

### 2.3 Important Expo constraints

- SQLCipher support is available through Expo SQLite configuration but requires a native build.
- In Expo Go, use only its isolated plaintext SQLite database and synthetic data. Do not copy, import, or enter real gym/member data into that runtime.
- Gate every custom-native dependency behind an explicit runtime capability boundary so importing a development screen cannot make the Expo Go bundle fail at startup.
- Use `withExclusiveTransactionAsync` for multi-record business transactions so unrelated asynchronous queries cannot accidentally join a transaction.
- Use prepared/bound SQL statements for all user input.
- Store critical data in SQLite, not SecureStore. SecureStore holds small secrets/key material and is not the database.
- Do not protect the only copy of the database key using biometric-bound SecureStore behavior; a biometric enrollment change can invalidate such values. Biometrics unlock the app experience, while the owner PIN remains the fallback.
- Re-read device locale/calendar information when the app returns to the foreground so device setting changes are reflected.

---

## 3. Architecture

### 3.1 Layering

```text
Expo Router screens
        |
Feature controllers and view models
        |
Domain use cases and pure business rules
        |
Repository interfaces
        |
Expo SQLite repositories + platform adapters
        |
Encrypted database / SecureStore / device file APIs
```

Rules:

- Route files remain thin. They compose screens, read route parameters, and invoke feature controllers.
- Business rules do not import React, Expo, SQLite, or device APIs.
- Repositories are the only production code allowed to issue business-data SQL.
- Platform adapters isolate printing, sharing, files, notifications, biometrics, image processing, localization, and external links.
- UI state is temporary. SQLite is the source of truth for persisted business state.
- No screen writes related records through several independent calls. A domain use case owns the entire atomic operation.

### 3.2 Proposed project structure

```text
src/
  app/
    _layout.tsx
    (public)/
      language.tsx
      unlock.tsx
    (setup)/
      welcome.tsx
      gym.tsx
      security.tsx
      first-plan.tsx
      backup-intro.tsx
    (app)/
      _layout.tsx
      (tabs)/
        home/
        members/
        payments/
        more/
      member/[memberId]/
      membership/[membershipId]/
      invoice/[invoiceId]/
      reports/
      settings/
  features/
    onboarding/
    security/
    gym/
    members/
    plans/
    memberships/
    billing/
    dashboard/
    reports/
    import-export/
    backup-restore/
    reminders/
    staff/
    audit/
  domain/
    entities/
    errors/
    money/
    dates/
    permissions/
    use-cases/
  data/
    database/
      open-database.ts
      migrations/
      schema/
      transactions/
    repositories/
    mappers/
  platform/
    secure-storage/
    biometrics/
    files/
    printing/
    sharing/
    notifications/
    localization/
    images/
    external-links/
  i18n/
    locales/
    formatters/
    translation-types.ts
  ui/
    components/
    forms/
    theme/
    accessibility/
  testing/
    factories/
    fixtures/
    matchers/
```

The exact route tree may evolve, but the dependency direction must not reverse.

### 3.3 State management

- Persisted state: SQLite repositories.
- Session state: a small React context/reducer for lock state, active staff profile, selected language, and app readiness.
- Form state: React Hook Form with Zod validation.
- Read caching: begin with feature hooks and explicit invalidation after transactions. Add a cache library only if measured complexity justifies it.
- Never store members, balances, invoices, payments, or membership status in AsyncStorage.
- Derived dashboard counts and invoice states must be calculated from shared repository/domain queries, not duplicated per screen.

### 3.4 Network boundary

The initial application contains no business API client.

- Do not define an API base URL, auth token, sync queue, remote retry policy, or server schema.
- App-store updates are outside application runtime logic.
- Opening a help page uses the operating system browser through the external-link adapter.
- Sharing a receipt/message uses the operating system share sheet; GymVito does not report delivery.
- Selecting a third-party document provider uses the operating-system picker under explicit user control.
- Add an ESLint restriction that prevents direct `fetch`, `XMLHttpRequest`, or unapproved network-library imports outside a future reviewed network adapter.
- Any future direct internet integration needs a new architecture decision record, privacy review, error/offline behavior, and explicit product scope.

---

## 4. Data Architecture

### 4.1 Database configuration

At database open:

1. Retrieve or create a random device database key through SecureStore.
2. Open the SQLCipher database and apply the key before any other operation.
3. Enable foreign keys.
4. Enable WAL mode after confirming SQLCipher/platform compatibility.
5. Apply a conservative busy timeout.
6. Read and validate application ID, schema version, and migration checksums.
7. Run pending migrations in an exclusive transaction.
8. Run a lightweight startup integrity check appropriate for the database size.

Do not log SQLCipher keys, backup passphrases, PIN material, member data, or interpolated SQL.

### 4.2 Migration contract

- Every schema change is an immutable numbered migration committed to source control.
- Maintain both `PRAGMA user_version` and a `schema_migrations` table containing migration ID, checksum, and applied timestamp.
- Never edit an already released migration; add a new one.
- Migration SQL must be safe inside an exclusive transaction or explicitly document why it cannot be.
- Before a destructive or long migration, create an internal encrypted safety copy when storage permits.
- Keep old database fixtures for each supported public schema version.
- An application build may open the schema versions it explicitly supports; newer schemas fail closed with a localized explanation.

### 4.3 Initial logical tables

Tables are introduced only when their owning phase begins, but identifiers and conventions are fixed from Phase 1.

| Group | Tables |
|---|---|
| System | `app_metadata`, `schema_migrations`, `settings`, `number_sequences` |
| Gym/security | `gym_profile`, `staff_profile`, `role`, `role_permission`, `staff_permission`, `security_event` |
| Members | `member`, `member_tag`, `member_tag_link`, `member_note`, `member_media` |
| Plans/memberships | `plan`, `membership`, `membership_event`, later `freeze_period` |
| Billing | `invoice`, `invoice_line`, `payment`, `financial_adjustment` |
| Operations | `audit_event`, `backup_record`, later `reminder_schedule` |

There is no attendance, check-in, check-out, visit, or session-consumption table.

### 4.4 Storage conventions

- Internal IDs: random UUIDs generated on-device.
- Display/member codes: separate human-readable values with unique indexes.
- Money: signed integer minor units plus ISO currency code; never floating-point values.
- Calendar dates: ISO `YYYY-MM-DD` strings validated by domain utilities.
- Event timestamps: UTC epoch milliseconds or ISO UTC instants; display using the current device time zone.
- Boolean values: constrained integer values where required by SQLite.
- Status: constrained text values plus domain transition validation.
- Search: normalized companion fields and indexes for member code, phone, email, and name. Benchmark before adopting FTS.
- Soft lifecycle: archive/inactive fields for user-managed records; immutable financial records use void/adjustment events.
- Snapshots: finalized memberships and invoices retain the applied plan/price/tax terms.

### 4.5 Profile media decision

For the MVP, profile photos should be resized and compressed locally to a small avatar and stored as an encrypted SQLite BLOB. This keeps the complete backup within one encrypted database file and avoids plaintext media in app storage.

Phase 0 must benchmark:

- Insert/read performance with 10,000 representative thumbnail BLOBs.
- Database and backup size.
- Memory usage while listing members; list queries must never fetch the BLOB column.
- PDF and profile rendering quality.

If the capacity gate fails, switch to separately encrypted private media files and include them in a versioned encrypted backup container. Plaintext app-private media is not an acceptable fallback.

### 4.6 Transaction boundaries

The following are single exclusive transactions:

- Create member plus initial tags/notes.
- Finalize membership plus membership event plus invoice plus optional payment plus audit events.
- Renew membership plus linked membership plus invoice/payment/audit records.
- Record payment plus receipt-number allocation plus invoice status projection plus audit record.
- Void/refund plus financial adjustment plus status projection plus audit record.
- Import accepted rows.
- Restore database replacement after all preflight validation.

Receipt/invoice sequence allocation occurs inside the same transaction as the document record.

---

## 5. Security and Key Model

### 5.1 Device database key

- Generate a cryptographically random 256-bit key on first setup.
- Store only that small key in SecureStore under a versioned service name.
- Use it as the SQLCipher database key.
- Do not store it in source, environment files, JavaScript logs, crash reports, backups, or settings tables.
- Treat a missing SecureStore key with an existing encrypted database as a recovery event, not a reason to overwrite the database.

### 5.2 Owner PIN

- Never store the PIN.
- Store a salted, password-hardened verifier.
- Prefer Argon2id through a maintained Expo-development-build-compatible native package; Phase 0 must prove the chosen package on the supported Android baseline.
- If Argon2id is not viable, select a reviewed PBKDF2/scrypt alternative with documented parameters after a security decision record. Do not build a custom hash scheme.
- Rate-limit failed attempts and persist lockout state so restarting the app does not reset it.
- The owner PIN is the recovery authentication method for normal app access. GymVito cannot remotely recover it.

### 5.3 Biometrics

- Biometrics are an optional convenience after a successful PIN unlock.
- `expo-local-authentication` performs the prompt.
- Do not make a biometric-bound SecureStore value the only copy of the database key because biometric enrollment changes can invalidate it.
- A failed/unavailable/changed biometric setup returns to PIN without corrupting or recreating data.

### 5.4 Locked state

- Do not mount business routes until database initialization and lock-state checks complete.
- Obscure recent-app previews and sensitive screen capture where the platform supports it.
- Default notification content is generic on the lock screen.
- Auto-lock after a configurable interval and whenever the app remains backgrounded beyond the threshold.
- Sensitive actions require recent owner re-authentication even when the app is generally unlocked.

---

## 6. Backup and Restore Design

Backup/restore is a release blocker, not a later convenience.

### 6.1 Proposed `.gymvito` format

For MVP, use a SQLCipher database exported under a user-provided backup passphrase and saved with a `.gymvito` extension.

The encrypted database contains a backup manifest with:

- Format version.
- Schema version.
- Source app version/build.
- Created instant.
- Device locale and device time zone at creation for display only.
- Gym ID/name.
- Record counts.
- Currency.
- Database integrity result.
- Source-database logical checksum or verification summary.

Because profile thumbnails are BLOBs, they are included automatically.

### 6.2 Create backup

1. Owner re-authenticates.
2. App estimates required space and validates a strong backup passphrase.
3. Complete pending writes and checkpoint the WAL.
4. Export the live device-key-encrypted database into a temporary SQLCipher database encrypted with the backup passphrase.
5. Open the temporary database independently and run schema, manifest, record-count, and cipher integrity checks.
6. Ask the owner for a destination through the system document flow.
7. Copy the verified file and verify destination size/hash where the platform exposes it.
8. Record success only after verification; otherwise retain the prior last-success value.
9. Delete temporary files securely as far as platform APIs permit.

### 6.3 Restore

1. Owner selects a `.gymvito` file through Document Picker.
2. Copy it to a private temporary location.
3. Request passphrase and open it without exposing data on failure.
4. Validate format/application ID, cipher integrity, schema compatibility, manifest, counts, and required storage.
5. Show a localized preview and require owner confirmation.
6. Create and verify a safety backup of current data when possible.
7. Export the selected backup into a new temporary database encrypted with the current device database key.
8. Run migrations on the temporary database if supported.
9. Reopen it and run full integrity and reconciliation checks.
10. Close all database handles and atomically replace the live database.
11. Reopen, verify, clear caches, rebuild reminders, and show restored counts.
12. If any step fails, retain or restore the prior live database.

Phase 0 must prove that Expo SQLite exposes the SQLCipher `ATTACH`/`sqlcipher_export` path required by this design. If it does not, stop feature work and approve an alternate native backup adapter before proceeding.

---

## 7. Localization and Device-Time Rules

### 7.1 Localization architecture

- Bundle every supported language in the application; do not download language packs at runtime.
- Use stable typed translation keys grouped by feature.
- Base/fallback language: English.
- The second MVP language must be selected before Phase 1 exits.
- Store the selected language per staff profile; during owner-only MVP, store it on the owner profile.
- Use `Intl` for dates, numbers, currency, and plurals where supported by the target runtime.
- Bundle fonts covering every advertised script and embed the required font data in PDF generation.
- CI rejects missing keys, unexpected extra keys, and untranslated placeholders.
- Add pseudolocale tests for text expansion and layout resilience.

### 7.2 Device locale and time zone

- Read locale and calendar preferences through `expo-localization`.
- Re-read them whenever the app returns to the foreground.
- Do not present a time-zone selector.
- Event timestamps are stored as instants and formatted in the current device time zone.
- Membership, invoice due, birth, joining, and other date-only values remain unchanged after a time-zone change.
- Recompute “today,” dashboard day ranges, report day boundaries, and future local notification schedules when the device time zone changes.
- Never recompute already finalized membership start/end dates due to clock or time-zone changes.

### 7.3 Date rule module

Create a framework-independent date module with exhaustive tests for:

- Inclusive end dates.
- Day/week/month/year plan durations.
- Month-end clamping according to the product rule.
- Leap years.
- Immediate and after-expiry renewal.
- Date-only comparison.
- Device day-boundary refresh.
- Manual clock movement and DST boundaries without rewriting stored dates.

No feature is allowed to calculate membership dates directly in a screen.

---

## 8. Phase Execution Contract

Every phase must provide:

1. A scoped checklist linked to requirement IDs in the feature specification.
2. Any architecture decision records required by that phase.
3. Numbered database migrations and old/new schema fixtures.
4. Unit, repository/integration, component, and device tests appropriate to the change.
5. Updated English and second-language resources.
6. Accessibility labels and dynamic-text behavior.
7. Failure, cancellation, restart, and low-storage behavior where data is written.
8. Backup/restore inclusion for new persistent data after backup is implemented.
9. A phase evidence note listing commands, devices, fixtures, and any unverified live behavior.
10. A passing exit gate before the phase is marked complete.

“Screen works” is not a phase completion criterion. Data integrity, migration, localization, and recovery behavior are part of the feature.

---

## 9. Phase 0 — Technical Foundation and Risk Proofs

### Objective

Prove that the chosen Expo architecture can securely store, back up, restore, localize, and render the product's critical data before building feature screens.

### In scope

- Create the Expo TypeScript project with Expo Router.
- Establish package manager, Node version, formatting, linting, type checking, test runner, and commit hooks.
- Configure app identifiers, environments, config plugins, and Android development signing.
- Support startup and routine development in Expo Go.
- Keep `expo-dev-client`; produce and install a local Android development build for native security work.
- Configure Expo SQLite with SQLCipher.
- Prove device-key generation/retrieval with SecureStore.
- Prove encrypted DB open, restart persistence, wrong-key failure, foreign keys, WAL, prepared statements, and exclusive transactions.
- Prove the proposed SQLCipher export/restore path with a seeded database and media BLOB.
- Prove a corrupt/wrong-passphrase backup cannot replace current data.
- Benchmark compressed avatar BLOBs at representative scale.
- Prove PIN KDF package compatibility and record calibrated parameters.
- Prove English plus candidate second-language screen, validation, and PDF font rendering.
- Prove device locale/time-zone refresh on foreground.
- Prove local file selection, save/share, printing/PDF, and temporary-file cleanup.
- Select and prove the device end-to-end test runner.
- Add the no-direct-network lint boundary.

### Required architecture decisions

- ADR-001: Expo SDK/toolchain versions and Android minimum version.
- ADR-002: SQLCipher configuration and device-key lifecycle.
- ADR-003: Direct typed repositories versus an ORM. Default recommendation: direct Expo SQLite repositories with checked-in SQL migrations.
- ADR-004: PIN KDF and biometric fallback model.
- ADR-005: Profile-photo storage based on benchmark evidence.
- ADR-006: `.gymvito` backup format and restore replacement method.
- ADR-007: Second MVP language and bundled fonts.
- ADR-008: Local versus EAS native build process. Either is acceptable for development; neither may become a runtime dependency.
- ADR-009: Expo Go as the default routine-development runtime, with native security capability boundaries.

### Deliverables

- Bootable Expo Go compatibility app and encrypted GymVito development app.
- Reproducible native build instructions.
- Technical spike screen or test harness excluded from production routes.
- Backup round-trip proof report with hashes/counts.
- Date-rule fixture suite.
- Bilingual PDF samples.
- Initial architecture decision records.

### Exit gate

- App runs in Expo Go for compatible development workflows and in a native Android development build for the full security runtime.
- Plaintext inspection does not reveal seeded database/member content.
- Kill/restart preserves encrypted data.
- Backup → wipe test database → restore produces equal schema, counts, money totals, and media hash.
- Wrong key, wrong passphrase, corrupt file, and interrupted restore leave existing data intact.
- Month-end/date-only fixtures pass under at least two device time zones.
- Both languages render correctly in app and PDF.
- No unresolved blocker remains for SQLCipher, SecureStore, backup, fonts, or native builds.

If this gate fails, revise the technical architecture before feature implementation.

---

## 10. Phase 1 — App Shell, Onboarding, Security, and Localization

### Objective

Deliver a production-shaped app shell that can initialize safely, onboard an owner, lock/unlock locally, and persist gym settings.

### Product requirements

ONB-01 through ONB-04, ONB-06, ONB-08; SET-02 and relevant parts of SET-01; STF-01/02/05 for the owner-only MVP subset. ONB-05 is completed with plan creation in Phase 2.

### In scope

- Final project layering and route groups.
- App startup state machine: initializing, migration, setup-required, locked, unlocked, recovery error.
- Language selection before business setup.
- Gym profile and regional settings, excluding a time-zone selector.
- Currency/date/time/week-start/financial-year configuration.
- Owner profile, PIN setup, retry limiting, inactivity lock, manual lock, and owner re-authentication.
- Optional biometric unlock with PIN fallback.
- Theme tokens, core controls, form fields, dialogs, empty/loading/error states, and responsive phone/tablet layout.
- Accessibility baseline and screen-reader labels.
- Translation resources, typed keys, pluralization, and locale formatters.
- Schema migration framework and application metadata.
- In-app privacy notice and local-data-loss explanation.
- First-backup education; actual complete backup arrives in Phase 5.
- Redacted local diagnostic logger with no remote destination.

### Data introduced

- `app_metadata`
- `schema_migrations`
- `settings`
- `gym_profile`
- `staff_profile` with one owner
- `role` and `role_permission` seed data if required for later compatibility
- `security_event`
- `audit_event`

### Tests

- Fresh install and interrupted/resumed onboarding.
- PIN setup, correct/incorrect PIN, lockout persistence, inactivity/background lock.
- Biometrics unavailable, cancelled, failed, and enrollment-changed fallback.
- Language switch during onboarding and after setup.
- Device locale/time-zone changes while app is backgrounded.
- Dynamic text, narrow phone, tablet, and second-language layout.
- Migration 0 → 1 and repeated startup idempotency.

### Exit gate

- A new install reaches Home only after valid local setup.
- An existing install opens locked and cannot expose business routes before unlock.
- Language change does not require reinstall and persists locally.
- No time-zone configuration is exposed.
- Startup, migration, setup, and lock failures have recoverable localized paths.

---

## 11. Phase 2 — Plans and Member Directory

### Objective

Allow the owner to define reusable membership plans and maintain a fast, reliable member directory.

### Product requirements

ONB-05; PLN-01 through PLN-07; MEM-01 through MEM-08. Later member enhancements MEM-09 through MEM-12 are deferred to Release 1 unless explicitly reprioritized.

### In scope

- Plan list, create, edit, deactivate, and detail views.
- Day/week/month/year duration rules.
- Plan price, admission fee, tax defaults, discount defaults, color, and future freeze/renewal policies.
- Member list, add, edit, search, archive, restore, and basic profile.
- Generated unique member code.
- Unicode-safe normalized search for name, phone, email, and member code.
- Duplicate warnings using normalized phone/email and code.
- Optional compressed profile photo.
- Member notes from the core profile. Tags, custom fields, duplicate merge, consent-specific workflows, and attachments stay deferred.
- Audit entries for creation, edits, archive/restore, and plan changes.
- Empty states and import/export calls-to-action clearly marked unavailable until their phases.

### Data introduced

- `plan`
- `member`
- `member_note`
- `member_media`

### Critical rules

- Plan edits do not alter any future snapshotted membership data.
- Archived members remain queryable by explicit filter and retain history.
- Duplicate matches warn; they never auto-merge.
- List queries omit photo BLOBs and large note content.
- All searchable fields have explicit normalization and indexes.

### Tests

- CRUD and archive/restore repository tests.
- Unique member-code collision/retry.
- Unicode names, punctuation, spaces, phone prefixes, and case-insensitive search.
- Duplicate warning fixtures.
- 10,000-member search benchmark on minimum reference hardware.
- Profile image resize, orientation, size cap, replacement, and cleanup.
- Plan duration input validation and localized money entry.

### Exit gate

- The owner can create plans and members, find any seeded member within the performance target, and recover from an interrupted save without partial records.
- Member photos remain encrypted at rest and are included in the Phase 0 backup proof path.
- Archived data and plan deactivation do not destroy history.

---

## 12. Phase 3 — Core Membership Lifecycle

### Objective

Implement enrollment, validity, renewal, expiry, and historical membership terms without billing implementation leakage.

### Product requirements

MSH-01 through MSH-05, MSH-10/11; core membership status model and date rules.

### In scope

- New membership draft/preview/finalization.
- Plan-term snapshot into membership.
- Start date, inclusive end date, derived status, and local-day refresh.
- Draft, scheduled, active, expired, and cancelled-compatible schema states; cancellation UI remains Release 1.
- Renewal using same or different active plan.
- After-current-expiry versus immediate start behavior.
- Overlap detection, preview, explicit acknowledgment, and deterministic current-membership selection.
- Membership history and lifecycle timeline.
- Member status projection: active, upcoming, expired, no membership, archived.
- Authorized price/date override fields and reasons; in owner-only MVP, the owner is authorized.
- Home/member summary projections needed by later dashboard work.

### Data introduced

- `membership`
- `membership_event`
- membership indexes and current-status query views/helpers

### Critical rules

- Finalizing or renewing is one exclusive transaction.
- Historical plan terms never read live plan values after finalization.
- Membership status is derived from saved dates/events and the device-local current date; screens do not store their own status.
- Time-zone changes never rewrite membership dates.
- Repeated confirmation after a UI retry cannot create duplicate memberships; use an operation/idempotency identifier locally.

### Tests

- Full date-rule fixture matrix.
- Leap day, month-end, year-end, DST boundary, and device time-zone change.
- Scheduled/immediate renewal and overlap behavior.
- Plan edited/deactivated after membership finalization.
- Force-close simulations before/during/after transaction completion.
- Member status projections and dashboard-count query fixtures.
- Localization of all status and timeline text.

### Exit gate

- Enrollment and renewal produce correct immutable history across the date fixture matrix.
- A force-close cannot leave a membership without its required event or create duplicates on retry.
- All screens use the shared status/date rules.

---

## 13. Phase 4 — Billing, Payments, Dues, and Receipts

### Objective

Add a traceable local financial ledger integrated atomically with membership creation and renewal.

### Product requirements

PAY-01 through PAY-08 and PAY-10 through PAY-12, with MVP correction behavior explicitly scoped; invoice/payment parts of MSH-01/03.

### In scope

- Invoice and line-item creation from membership charges.
- Subtotal, admission fee, discount, tax, total, paid, and balance calculations.
- Integer-minor-unit money module.
- Full, partial, and later settlement payments.
- Configurable recorded payment method labels.
- Due date and overdue projection.
- Atomic local invoice/receipt numbering with prefixes.
- Payment and dues lists and invoice detail.
- Member financial history and current due.
- Localized HTML receipt template, PDF generation, preview, print, save, and share.
- Duplicate-copy marking on regenerated receipts.
- Owner correction path allowed by MVP, represented by traceable events rather than deletion.
- Recorded-payment wording throughout; no payment processing or settlement claim.

### Data introduced

- `number_sequences`
- `invoice`
- `invoice_line`
- `payment`
- minimal `financial_adjustment` structure required for safe owner corrections

### Critical rules

- Membership finalization, invoice creation, optional payment, number allocation, and audit events commit together.
- Money never uses floating point.
- Invoice status is calculated from valid ledger entries.
- Payment cannot exceed outstanding balance in MVP.
- Finalized invoice/payment records cannot be hard-deleted.
- Currency on historical transactions never changes when settings change.
- PDF content is generated only from escaped values and bundled templates/fonts.

### Tests

- Money fixtures for zero, partial, full, discount, tax-inclusive/exclusive display, and rounding boundaries.
- Unique sequences under rapid repeated actions.
- Retry/idempotency and force-close at transaction boundaries.
- Due and overdue calculations at device-local day boundaries.
- Receipt content reconciliation to database values.
- English and second-language PDF rendering, long names, large amounts, and A4/receipt-width layouts in scope.
- Share/print cancelled/unavailable without changing payment status.

### Exit gate

- Member, membership, invoice, payment, receipt, dashboard query, and report-source totals reconcile on fixed fixtures.
- A failed PDF/share/print action does not roll back a successfully recorded payment and does not claim delivery.
- No finalized financial record can disappear through ordinary UI actions.

---

## 14. Phase 5 — Production Backup, Restore, and Recovery

### Objective

Turn the Phase 0 proof into owner-facing, release-grade data protection before broader reporting and release preparation.

### Product requirements

BAK-01 through BAK-08 and BAK-11/12; SET-06 data-deletion safeguards.

### In scope

- Complete `.gymvito` backup creation and manifest.
- Passphrase entry/confirmation, strength guidance, and unrecoverable-passphrase warning.
- File picker/document-provider destination.
- Backup integrity verification and local backup history.
- Restore selection, wrong-passphrase handling, preview, compatibility checks, storage checks, safety backup, migration, atomic replacement, and final reconciliation.
- Old-device-to-new-device documented flow.
- Recovery UI for missing device key, corrupt live DB, interrupted migration, and unsupported/newer backup.
- Owner-authenticated delete-all flow with backup offer.
- Internal temporary/safety-file cleanup policy.

### Tests

- Round-trip every schema fixture supported at this phase.
- Wrong passphrase, malformed file, truncated file, wrong app file, newer schema, low storage, cancelled picker, destination failure, and interrupted restore.
- Restore with a different selected UI language.
- Restore on a new device key.
- Backup with maximum representative member/photo/financial dataset.
- Compare counts, financial totals, membership statuses, media hashes, settings, sequences, and audit records before/after.
- Ensure a failed restore preserves the original live database.

### Exit gate

- Automated and physical-device round trips pass for every supported fixture.
- No tested failure mode replaces a valid live database with incomplete data.
- Last-successful-backup state changes only after the destination artifact is verified.
- The product is not approved for real gym data before this phase passes.

---

## 15. Phase 6 — Home, Reports, CSV Export, and Operational Polish

### Objective

Expose consistent business summaries and portable owner-controlled data using the completed member, membership, and billing model.

### Product requirements

HOM-01 through HOM-03; REP-01, REP-02, REP-05, and REP-06; IEX-05 and IEX-06; SET-04. Remaining P1 dashboard, report, and export controls are completed in Phase 10 unless explicitly pulled forward.

### In scope

- Home metrics: active members, expiring soon, expired, outstanding dues, overdue dues, and today's recorded collections.
- Dashboard shortcuts and drill-down filters for the core metrics.
- Member reports: active/upcoming/expired/no membership/archived/new joins/expiring.
- Finance reports: collections, invoices, discounts, tax, refunds in scope, outstanding and overdue dues.
- Consistent date, plan, membership-status, and payment-method filters.
- UTF-8 CSV export for members, memberships, invoices, and payments.
- Localized printable PDF summaries.
- Background/cancellable generation for large exports.
- Spreadsheet formula-injection protection and ISO portable columns.

### Critical rules

- Home drill-down lists execute the same filter definition as the displayed count.
- Report totals use shared ledger/status queries rather than reimplementing formulas.
- Owner authorization and a privacy warning are required before export.
- Temporary files are cleaned without deleting user-saved artifacts.
- There are no attendance reports or exports.

### Tests

- Reconciliation fixtures across Home, detail lists, member profiles, reports, and CSV/PDF output.
- Device time-zone change and date-boundary filters.
- UTF-8 multilingual values, commas, quotes, newlines, leading plus/zero phone values, and spreadsheet-formula characters.
- Large dataset performance/cancellation and low storage.
- Locked/background behavior during a long export.

### Exit gate

- Every displayed total reconciles to its detail records and exported values.
- Exported files open correctly in representative spreadsheet/PDF apps.
- Reporting meets performance targets on minimum hardware.

---

## 16. Phase 7 — MVP Hardening and Release

### Objective

Qualify the complete MVP for real single-device gym use.

### In scope

- Finish all P0 requirements and resolve any intentionally deferred P0 gap.
- Complete accessibility review for core journeys.
- Complete English and second-language native review.
- Capacity/performance testing at the feature-specification baseline.
- Security review of SQLCipher key handling, PIN verification, logs, screen privacy, exports, temporary files, and permissions.
- Dependency/license review and locked dependency audit.
- Database migration and backup compatibility matrix.
- Airplane/no-connectivity regression for local workflows, while preserving the permitted-internet architecture.
- Device clock/time-zone change, reboot, upgrade, low-storage, process-death, and permission-denial testing.
- Release app icon, splash, privacy copy, help content, store metadata, signing, and versioning.
- Release build with development-only routes/logging removed.
- Data reset and uninstall warnings.

### MVP acceptance journeys

1. First launch → language → gym → owner security → first plan → Home.
2. Add member → enroll → record partial/full payment → create localized receipt.
3. Find member → renew after current expiry → verify history and invoice.
4. View dues/expiry dashboard → drill down → record remaining payment.
5. Export reports and CSV.
6. Create encrypted backup → restore on a clean install/new device → reconcile data.
7. Change language and device time zone → verify presentation changes without business-date mutation.

### Exit gate

- Feature specification release checklist passes for the implemented MVP scope.
- No open P0 data-loss, encryption, financial, migration, backup, localization, accessibility, or authentication defect.
- All supported schema fixtures migrate and round-trip through backup/restore.
- Signed release build passes physical-device smoke tests.
- Evidence clearly separates automated/local proof from app-store or user acceptance not yet performed.

MVP release occurs only after this gate.

---

## 17. Phase 8 — Release 1 Staff, Roles, and Audit Controls

### Objective

Support several staff members safely sharing the same device.

### In scope

- Staff profile creation, activation/deactivation, individual PIN, preferred language, and role.
- Owner, Manager, and Front Desk presets.
- Permission overrides for member edits, price/date overrides, corrections, reports, exports, plans, staff, backup, restore, and settings.
- Profile chooser and rapid lock/switch flow.
- Actor attribution for every sensitive action.
- Filterable audit screen.
- Owner re-authentication for security, role, restore, export, and delete-all operations.
- Historical actor retention after staff deactivation.

### Tests

- Default role matrix and every protected route/use case.
- UI hiding plus domain-layer authorization; hidden UI alone is insufficient.
- Staff switch during forms/long tasks.
- Deactivated staff and historical audit display.
- Per-profile language switching.
- Audit append behavior and tamper-evident consistency checks selected by the architecture.

### Exit gate

- Permission bypass attempts at route, controller, and use-case levels fail.
- Every financial and sensitive operation has an actor and audit event.
- Owner-only recovery paths remain available.

---

## 18. Phase 9 — Release 1 Advanced Membership and Finance

### Objective

Complete the operational membership lifecycle and financial correction model.

### In scope

- Freeze/resume with policy, preview, and stored expiry impact.
- Cancellation with effective date and reason.
- Upgrade/downgrade as controlled replacement plus credit/charge.
- Complimentary membership authorization.
- Refund and payment void ledger entries.
- Invoice void rules.
- Reprint/reshare duplicate marking.
- Expanded lifecycle and financial audit timeline.

### Data introduced/extended

- `freeze_period`
- Full `financial_adjustment` behavior
- Additional membership and audit event types

### Tests

- Freeze overlap, invalid dates, maximum days, resume early/late, and changed plan policy after start.
- Cancellation before start/during active period/after expiry.
- Upgrade/downgrade reconciliation.
- Partial/full refund and over-refund prevention.
- Voided payment restoring correct balance.
- Historical reports before and after adjustment.

### Exit gate

- Every lifecycle transition is explicit, authorized, reversible only through another event, and reflected consistently in reports/exports/backups.
- No finalized history is silently overwritten.

---

## 19. Phase 10 — Release 1 Import, Reminders, and Management Features

### Objective

Reduce owner setup work and add proactive on-device operations without introducing a backend.

### In scope

- Member CSV template, picker, encoding/date mapping, preview, validation, duplicate policy, transactional import, and error report.
- On-device expiry, overdue, birthday, and backup reminders.
- Reminder preferences, quiet hours, generic lock-screen copy, deep links, cancellation, and schedule rebuild.
- User-reviewed copy/share reminder templates.
- Backup-age task and storage usage.
- Tags, custom member fields, duplicate merge, consent-specific notes, and attachments if retained as Release 1 priorities.
- Actionable Home task list and dashboard privacy mode.
- Plan-wise reports, period comparisons, report metadata, staff-actor filters, and management help.

### Network constraint

- Use local scheduled notifications only.
- Do not obtain an Expo push token.
- Do not send messages directly. Copy/share opens a user-controlled external app and GymVito makes no delivery claim.

### Tests

- CSV Unicode, delimiters, malformed rows, dates, numbers, duplicates, formula injection, cancel, process death, and rollback.
- Notification permission denial and later enablement.
- Reboot, app upgrade, restore, record edits, language change, device time-zone change, and clock change schedule repair.
- Locked-screen privacy and deep-link authorization.
- Notification delivery limitations documented on representative Android vendors where practical.

### Exit gate

- Import never silently merges or leaves partial invalid state.
- The in-app task list remains authoritative if the operating system delays a notification.
- Every scheduled reminder can be traced to local data and cancelled/rebuilt deterministically.

---

## 20. Phase 11 — Release 1 Hardening

### Objective

Run the full cross-feature qualification after all Release 1 migrations and behaviors are present.

### In scope

- Full regression across owner and staff roles.
- Native-speaker and accessibility review of new flows.
- Capacity tests including import, audit, reminders, adjustments, and multiple staff.
- Migration from every public MVP version.
- Backup/restore across every supported schema and language.
- Security and privacy re-review for imports, notifications, custom fields, and staff access.
- Signed production build and staged distribution plan.

### Exit gate

- Release 1 acceptance checklist passes with no P0/P1 release blocker.
- Migration, rollback/recovery, and backup compatibility evidence is archived.
- No attendance/check-in feature has entered the release through adjacent plan, member, or reminder work.

---

## 21. Test Strategy

### 21.1 Pure unit tests

Highest coverage is required for:

- Money arithmetic and invoice state.
- Plan duration and membership dates.
- Membership/status transitions.
- Discounts/tax/adjustments.
- Permissions.
- Search normalization.
- CSV parsing/escaping.
- Translation interpolation.
- Backup manifest validation.

These tests run without React Native or SQLite where possible.

### 21.2 Repository and migration tests

- Execute actual migration SQL against SQLite fixtures.
- Exercise real SQLCipher behavior in the native test harness for encryption-specific checks.
- Test constraints, indexes, foreign keys, transaction rollback, and sequence allocation.
- Keep anonymized deterministic fixtures for each supported schema.
- Reconcile repository projections against independent expected fixture totals.

### 21.3 Component tests

- Forms, validation, destructive confirmations, privacy mode, long localized text, dynamic type, error states, and role restrictions.
- Mock repositories at the boundary; do not mock business rules inside screens.

### 21.4 Device end-to-end tests

- Run core journeys on Android emulator and at least one minimum/reference physical device.
- Use Expo Go for compatible smoke and UI checks only. Use the native development/release client for security and release acceptance.
- Cover app termination/relaunch, background lock, locale/time-zone change, document picker, share, print/PDF, backup/restore, and permission denial.
- Keep release smoke tests small and deterministic; destructive restore tests use disposable fixture installs.

### 21.5 Non-functional tests

- 10,000 members, 50,000 memberships, 50,000 invoices/payments, representative media.
- Cold start, search latency, dashboard/report latency, memory, backup duration/size, and restore duration.
- Low storage and large export cancellation.
- Static dependency/license/security checks.
- Manual plaintext inspection of database, backup, logs, cache, URLs, and exported diagnostics.

---

## 22. CI and Quality Gates

Every pull request should run:

1. Lockfile-frozen dependency installation.
2. Formatting check.
3. ESLint, including restricted network imports and architecture boundaries.
4. TypeScript strict type check.
5. Unit and component tests with coverage thresholds focused on domain code.
6. Migration checksum/order validation.
7. Translation-key parity and placeholder validation.
8. Secret and accidental-PII fixture scan.
9. Production bundle/export sanity check.

Scheduled or release workflows should additionally run:

- Native Android build.
- Native repository/SQLCipher tests.
- Device E2E smoke suite.
- Dependency/license/security review.
- Schema migration matrix.
- Backup/restore round-trip matrix.
- Performance fixtures on controlled hardware or an explicitly documented manual run.

CI/build services are engineering infrastructure, not an application backend. A released app must keep working if those services are unavailable.

---

## 23. Phase Dependency Map

```text
Phase 0: technical proofs
    |
Phase 1: shell/onboarding/security/i18n
    |
Phase 2: plans + members
    |
Phase 3: memberships
    |
Phase 4: billing + receipts
    |\
    | Phase 5: production backup/restore
    |/
Phase 6: dashboard/reports/exports
    |
Phase 7: MVP hardening and release
    |
Phase 8: staff/roles/audit
    |
Phase 9: advanced lifecycle/finance
    |
Phase 10: import/reminders/management
    |
Phase 11: Release 1 hardening
```

Phase 5 implementation can begin after Phase 1 and continue as schemas are added, but its final gate requires the Phase 4 schema. Phase 6 may begin report query design after Phase 3, but financial reports require Phase 4.

---

## 24. Requirements-to-Phase Traceability

| Feature area | MVP phase | Release 1 extension |
|---|---:|---:|
| Platform/encryption proofs | 0 | Revalidated in 11 |
| Onboarding/gym/language | 1 | Staff language in 8 |
| Owner security/lock | 1 | Staff roles in 8 |
| Plans | 2 | Advanced policies in 9 |
| Members/search/archive | 2 | Import/custom fields in 10 |
| Membership enrollment/renewal | 3 | Freeze/cancel/upgrade in 9 |
| Billing/payments/dues | 4 | Refund/void in 9 |
| Receipts/PDF/share | 4 | Additional layouts as separately prioritized |
| Backup/restore/migration | 0 proof, 5 production | Scheduling/storage polish in 10 |
| Home/reports/export | 6 | Advanced comparisons in 10 |
| Accessibility/localization | Every phase, release gate 7 | Every phase, release gate 11 |
| Local reminders | — | 10 |
| Attendance/check-in/out | Not in scope | Not in scope |

---

## 25. Risks and Stop Conditions

| Risk | Early control | Stop condition |
|---|---|---|
| SQLCipher or key lifecycle is unreliable in Expo build | Phase 0 native proof | Do not build feature data until encryption/restart tests pass |
| Backup export/atomic restore is not possible through Expo SQLite APIs | Phase 0 SQLCipher export spike | Approve a native module/alternate database approach before continuing |
| SecureStore key is lost or invalidated | Key-state recovery tests and no biometric-only key | Never create a new empty DB over an existing encrypted DB automatically |
| PDF cannot render target script reliably | Phase 0 embedded-font samples | Do not advertise that language or issue receipts until fixed |
| Month-end rules remain ambiguous | Product decision plus date fixtures | Do not implement membership finalization until the rule is approved |
| Photo BLOB design exceeds capacity/performance | Phase 0 benchmark | Switch to reviewed encrypted media storage before member phase exits |
| Direct network calls creep into features | Restricted imports and architecture checks | Reject change until explicit scope/privacy ADR exists |
| Financial totals diverge across screens | Shared query/calculation modules and reconciliation fixtures | Do not release with unexplained differences |
| A migration or restore can destroy current data | Old-schema fixtures and failure injection | Do not ship the migration/build |
| New work introduces attendance concepts | Requirements traceability and schema review | Remove it or approve a separate product specification first |

---

## 26. Decisions Needed Before Phase 0 Exit

1. Confirm Android as the first public platform and define its minimum OS/reference device.
2. Select the two MVP languages.
3. Confirm currency/tax launch market assumptions.
4. Approve the exact month-duration rule in the feature specification.
5. Decide whether the MVP is owner-only or needs multiple staff before first release. This plan defaults to owner-only MVP and staff in Release 1.
6. Confirm accepted receipt paper sizes and printer expectations.
7. Decide whether local/EAS builds are used in CI and release engineering; this does not affect the no-backend runtime contract.
8. Confirm whether third-party document providers are acceptable destinations when explicitly selected by the owner.
9. Define supported migration window after public release.
10. Approve the backup-passphrase policy and owner-facing recovery warning.

---

## 27. Implementation Definition of Done

A phase or feature is complete only when:

- It satisfies the linked product requirements and phase exit gate.
- It introduces no backend dependency, remote business data, time-zone selector, attendance, or check-in/out behavior.
- Business writes are transactional and retry-safe.
- Database changes have migrations, fixtures, and upgrade tests.
- Backup/restore includes all new persisted data once Phase 5 is present.
- Security/permission checks exist below the UI layer.
- Both MVP languages and accessibility behavior are complete.
- Local/no-connectivity and optional-internet failure behavior are tested.
- Logs and diagnostics contain no secrets or personal/financial data.
- Focused tests, native tests where relevant, type checks, lint, and translation checks pass.
- Evidence states exactly what was verified and what still requires physical-device, app-store, printer, or user acceptance.

---

## 28. Official Technical References

- [Expo SQLite and SQLCipher](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo LocalAuthentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/)
- [Expo Localization](https://docs.expo.dev/versions/latest/sdk/localization/)
- [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [Expo DocumentPicker](https://docs.expo.dev/versions/latest/sdk/document-picker/)
- [Expo Print](https://docs.expo.dev/versions/latest/sdk/print/)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [SQLCipher API and `sqlcipher_export`](https://www.zetetic.net/sqlcipher/sqlcipher-api/)
