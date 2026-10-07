# GymVito Membership Tracker

## Product Requirements and Feature Specification

| Field | Value |
|---|---|
| Product | GymVito |
| Document status | Draft for product and engineering review |
| Primary users | Independent gym owners, managers, and front-desk staff |
| Product model | Local-first, single-device application |
| Recommended initial target | Android phone and tablet (final platform decision pending) |
| Data storage | Local encrypted database on the user's device |
| Backend dependency | No GymVito backend server; internet access is permitted |
| Initial release target | MVP defined in Section 18 |
| Implementation plan | [React Native + Expo phase plan](./IMPLEMENTATION_PLAN.md) |

---

## 1. Product Summary

GymVito is a device-local membership management application for small and medium-sized gyms. It helps gym owners maintain member records, sell and renew memberships, record payments, track dues, issue receipts, and view useful business reports without requiring a backend server.

All operational data remains on the device. The app does not require a GymVito account, cloud database, or GymVito API. It may use the internet for transparent, non-core actions such as app distribution and updates, opening external help links, or user-initiated sharing/file-provider actions. Owners protect their data through local access controls and encrypted backup files that they can save or transfer themselves.

The interface supports multiple languages and regional formats. A user chooses a language during onboarding and can change it later without changing or damaging stored business data.

### 1.1 Product promise

> A gym owner can run daily membership operations reliably from one device, in their preferred language, without depending on a GymVito backend server.

### 1.2 Core product principles

1. **Local data is the source of truth.** Core membership and payment workflows do not depend on a remote backend; optional internet actions fail gracefully.
2. **The owner controls the data.** Data is stored locally and can be exported, backed up, restored, or permanently deleted by the owner.
3. **Daily tasks stay fast.** Member search, renewal, and payment entry should require minimal input.
4. **Financial records are traceable.** Corrections are recorded explicitly; finalized transactions are not silently rewritten.
5. **Language is not an afterthought.** Layout, pluralization, dates, numbers, receipts, and reminders must all be localizable.
6. **Device failure must be survivable.** The product regularly prompts the owner to create recoverable backups.

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Maintain an accurate, searchable member directory.
- Manage plans, memberships, renewals, freezes, cancellations, and expiry.
- Record payments, partial payments, refunds, discounts, and outstanding balances.
- Notify staff locally about expiring memberships, unpaid balances, and relevant daily tasks.
- Generate useful local reports and export them as shareable files.
- Support multilingual and regional use from the first release.
- Protect locally stored personal and financial data.
- Provide reliable encrypted backup and restore without a GymVito server.
- Remain usable on an affordable device. Core membership and financial operations continue when connectivity is unavailable.

### 2.2 Non-goals

The following are intentionally outside the local-first, single-device product boundary:

- Cloud accounts, web login, or browser administration.
- Automatic synchronization between phones, tablets, or branches.
- A centralized multi-branch view.
- Online member portals or remote self-service.
- Server-sent push notifications.
- Automated SMS, email, or WhatsApp delivery.
- Online payment collection, payment-gateway settlement, or bank reconciliation.
- Live access-control hardware integration.
- Remote staff access or remote technical support into the database.
- Server-side analytics, advertising, tracking, or telemetry.
- Payroll, full accounting, inventory, workout programming, or nutrition coaching.
- Attendance, member check-in/check-out, visit counting, kiosk access, and session-based entry control.

The app may let a user manually share a locally generated receipt or reminder through the device share sheet. The destination app may require connectivity, but GymVito itself must not depend on it.

---

## 3. Target Users and Personas

### 3.1 Owner or administrator

Owns the business and the device or is responsible for the complete gym operation.

Needs to:

- Configure the gym, plans, staff access, language, and backup policy.
- View revenue, dues, and membership summaries.
- Correct transactions, restore data, and export records.
- See who performed sensitive actions on a shared device.

### 3.2 Front-desk staff

Performs high-frequency member-facing tasks on a shared phone or tablet.

Needs to:

- Find and register members quickly.
- Look up members and see membership validity.
- Record payments and issue receipts.
- Renew memberships within granted permissions.
- Avoid access to security, backup, and sensitive business settings.

### 3.3 Gym manager

Supervises daily operations but may not own the business.

Needs to:

- Manage members and memberships.
- Review dues and expiring memberships.
- Correct routine errors with an audit trail.
- Export operational reports if permitted.

### 3.4 Member

The member does not need an app account. They interact indirectly by providing their details and receiving a printed or shared receipt.

---

## 4. Product Scope and Operating Model

### 4.1 Local-first and single-device boundary

- The application must complete all core actions using only local resources.
- The source of truth is one encrypted database on one device.
- Multiple staff profiles may use that device, but simultaneous multi-device editing is not supported.
- The application may access the internet, but it does not call or depend on a GymVito-owned backend, remote database, or account service.
- Permitted internet use must be visible and purpose-specific, such as app-store distribution and updates, opening an external help page, or a user-initiated operating-system share/document-provider action.
- Operational and personal data must not be transmitted automatically. Any feature that sends such data to an external service requires explicit user action, clear disclosure of the destination, and a separate privacy review.
- Loss of connectivity must not block member, membership, payment, receipt, report, export, backup, or restore workflows that use local resources.

### 4.2 Data ownership model

- No GymVito account is required.
- The user can export their operational data in readable formats.
- A complete backup uses an encrypted, versioned GymVito backup format.
- Deleting the app may delete its database, subject to operating-system behavior. The app must communicate this risk during onboarding and before destructive actions.
- GymVito cannot recover an owner PIN, backup passphrase, or lost data because no server-held recovery copy exists.

### 4.3 Recommended device model

- One owner-controlled phone or tablet is designated as the primary device.
- Staff share access using individual local profiles and PINs.
- The owner creates periodic encrypted backups to removable storage or a user-selected local/document-provider location.
- Moving to a new device is performed by creating a backup on the old device and restoring it on the new device.

---

## 5. Terminology and Status Model

| Term | Meaning |
|---|---|
| Member | A person registered with the gym, independent of current membership validity |
| Plan | A reusable commercial offering such as Monthly, Quarterly, or Annual |
| Membership | A dated or usage-limited entitlement purchased or granted to one member |
| Renewal | Creation of a new membership period linked to a prior membership |
| Freeze | A temporary pause that may extend the membership end date according to policy |
| Invoice | The amount charged for a membership transaction |
| Payment | Money recorded against an invoice; GymVito records but does not process it |
| Due | The unpaid balance of an invoice |
| Adjustment | A traceable correction such as a discount, fee waiver, refund, or void |
| Archive | Hides an inactive record from default views without destroying its history |

### 5.1 Member status

- **Active:** has an active membership today.
- **Upcoming:** has only a future scheduled membership.
- **Expired:** has membership history but no current or future membership.
- **No membership:** registered but has never received a membership.
- **Archived:** intentionally hidden from routine operations.

Member status is derived from memberships except for the explicit archived state.

### 5.2 Membership status

- **Draft:** being prepared and not yet finalized.
- **Scheduled:** finalized and starts in the future.
- **Active:** valid today and not frozen, cancelled, exhausted, or expired.
- **Frozen:** temporarily paused.
- **Expired:** its inclusive end date has passed.
- **Cancelled:** ended manually before normal expiry.

### 5.3 Invoice and payment status

- Invoice: **Unpaid**, **Partially paid**, **Paid**, **Voided**, or **Refunded**.
- Payment: **Recorded**, **Voided**, or **Refunded in part/full**.
- Status must be calculated from immutable transaction entries rather than manually selected.

---

## 6. Information Architecture

### 6.1 Primary navigation

1. **Home** — operational summary and actions.
2. **Members** — directory, profiles, and member history.
3. **Payments** — transactions, dues, and receipts.
4. **More** — plans, reports, imports/exports, backup, staff, and settings.

On larger screens, the same destinations may appear in a navigation rail or sidebar.

### 6.2 Global actions

- Search members by name, phone number, member code, or locally stored tag.
- Add member.
- Record payment.
- Lock the app.

---

## 7. Functional Requirements

Priority labels:

- **P0:** required for a usable MVP.
- **P1:** required for the full first public release.
- **P2:** valuable enhancement after the first release.

### 7.1 Onboarding and gym setup

| ID | Priority | Requirement |
|---|---:|---|
| ONB-01 | P0 | Let the owner choose an app language before entering business information. |
| ONB-02 | P0 | Create a local gym profile with gym name, owner/contact details, address, logo, receipt footer, currency, date format, time format, week start, and financial-year start. The app uses the device time zone and offers no separate gym time-zone setting. |
| ONB-03 | P0 | Require an owner PIN and explain that it cannot be remotely recovered. |
| ONB-04 | P1 | Offer biometric unlock backed by the device security system, with owner PIN fallback. |
| ONB-05 | P0 | Create at least one membership plan or let the owner start with editable templates. |
| ONB-06 | P0 | Explain local-only storage and guide the owner to create their first encrypted backup. |
| ONB-07 | P1 | Let the owner import members from a validated CSV file during or after onboarding. |
| ONB-08 | P0 | Allow onboarding to be resumed safely after interruption. |

Completion result: the owner reaches Home with a configured gym, a secured local profile, and a clear next action.

### 7.2 Home dashboard

The Home screen must prioritize actions over decorative analytics.

| ID | Priority | Requirement |
|---|---:|---|
| HOM-01 | P0 | Show counts for active members, memberships expiring soon, expired memberships, and outstanding dues. |
| HOM-02 | P0 | Show today's recorded collections, explicitly labelled as recorded payments rather than bank settlement. |
| HOM-03 | P0 | Provide shortcuts for Add member, Renew, and Record payment. |
| HOM-04 | P1 | Show an actionable task list ordered by urgency: overdue balances, expiry today, upcoming expiries, and failed/overdue backups. |
| HOM-05 | P1 | Allow dashboard values to be hidden for privacy at a shared front desk. |
| HOM-06 | P1 | Make every count open its filtered detail list. |

### 7.3 Member management

| ID | Priority | Requirement |
|---|---:|---|
| MEM-01 | P0 | Add a member with name and at least one unique identifier generated by the app. |
| MEM-02 | P0 | Support optional phone, email, date of birth, gender/self-description, address, emergency contact, joining source, notes, and profile photo. |
| MEM-03 | P0 | Generate a human-readable member code that is unique within the local gym database. |
| MEM-04 | P0 | Search case-insensitively by name, phone, email, or member code using the local database. |
| MEM-05 | P0 | Display current membership, balance due, and recent activity on the member profile. |
| MEM-06 | P0 | Edit member data while preserving created/modified timestamps and audit information. |
| MEM-07 | P0 | Archive and restore a member. Archived members remain in membership and financial history. |
| MEM-08 | P1 | Detect likely duplicates by normalized phone, email, and similar member code and warn before saving or importing. |
| MEM-09 | P1 | Add locally defined tags and custom fields. |
| MEM-10 | P1 | Merge duplicate member profiles only through an owner-authorized preview showing the resulting history. |
| MEM-11 | P1 | Record consent or acknowledgment notes where the gym's local policy requires them. |
| MEM-12 | P2 | Store local attachments such as a signed form, subject to file-size limits and backup inclusion. |

#### Member profile sections

- Summary.
- Membership history.
- Payments and outstanding balances.
- Notes and activity log.

### 7.4 Plan configuration

| ID | Priority | Requirement |
|---|---:|---|
| PLN-01 | P0 | Create plans with name, description, price, duration value/unit, and active/inactive state. |
| PLN-02 | P0 | Support day-, week-, month-, and year-based plans using calendar-aware date calculation. |
| PLN-03 | P0 | Configure admission fee, tax label/rate, default discount policy, and plan color. |
| PLN-04 | P1 | Configure whether freezing is allowed, maximum freeze days, and whether a freeze extends the end date. |
| PLN-05 | P1 | Configure advance renewal behavior: start immediately, start after current expiry, or ask each time. |
| PLN-06 | P0 | Deactivate a plan without changing historical memberships created from it. |
| PLN-07 | P0 | Snapshot the plan name, price, duration, and rules into each finalized membership so later plan edits do not rewrite history. |

### 7.5 Membership lifecycle

| ID | Priority | Requirement |
|---|---:|---|
| MSH-01 | P0 | Enroll a member in a plan and show start date, inclusive end date, charge breakdown, payment state, and resulting status before confirmation. |
| MSH-02 | P0 | Permit a custom price, discount, start date, or end date only to authorized roles and record the reason. |
| MSH-03 | P0 | Renew a membership using the existing plan or a different active plan. |
| MSH-04 | P0 | Preserve the original membership; renewal creates a linked membership record. |
| MSH-05 | P1 | Prevent unintended overlapping memberships and require an explicit choice when overlap is detected. |
| MSH-06 | P1 | Freeze and resume a membership with start date, expected resume date, reason, and calculated effect on expiry. |
| MSH-07 | P1 | Cancel a membership with effective date, reason, and optional financial adjustment. |
| MSH-08 | P1 | Support upgrades/downgrades as a controlled cancellation plus replacement, with a clearly shown credit or extra charge. |
| MSH-09 | P1 | Allow a complimentary membership with zero charge and a recorded authorization note. |
| MSH-10 | P0 | Recalculate status automatically at local-day boundaries and whenever relevant data changes. |
| MSH-11 | P1 | Display a chronological lifecycle timeline including creation, renewal, freeze, resume, expiry, cancellation, and corrections. |

#### Membership date rules

- The device time zone is the application's only time-zone source; there is no gym time-zone configuration or multi-time-zone mode.
- Membership start and end dates are stored as local calendar dates, so they do not shift when the device time zone changes.
- End dates are inclusive through the device-local calendar day.
- Month-based memberships use one documented calendar rule. Proposed rule: end on the day before the same calendar day in the target month; when that day does not exist, use the target month's final day. For example, a one-month membership starting 1 January ends 31 January, while one starting 31 January ends 28/29 February.
- Changing the device clock must not silently rewrite stored timestamps or finalized end dates.
- A scheduled renewal normally begins the day after the current membership's inclusive end date.
- Freeze calculations must be previewed before confirmation and stored, not recomputed later from changed plan settings.

### 7.6 Billing, payments, dues, and receipts

GymVito is a local ledger, not a payment processor.

| ID | Priority | Requirement |
|---|---:|---|
| PAY-01 | P0 | Create an invoice when a chargeable membership is finalized. |
| PAY-02 | P0 | Record full or partial payments against an invoice. |
| PAY-03 | P0 | Support configurable local methods such as cash, card, bank transfer, UPI, cheque, and other. These labels record how the owner says payment occurred. |
| PAY-04 | P0 | Capture amount, method, local transaction reference, note, received date/time, and staff actor. |
| PAY-05 | P0 | Calculate invoice subtotal, discount, tax, paid total, refunds, and balance due consistently. |
| PAY-06 | P0 | Generate sequential local invoice and receipt numbers using owner-configurable prefixes. |
| PAY-07 | P0 | Generate a localized printable/shareable PDF receipt without internet access. |
| PAY-08 | P1 | Record a promised due date and show overdue balances in task lists and reports. |
| PAY-09 | P1 | Record refunds or voids as linked adjustment entries with amount, reason, time, and authorized actor. |
| PAY-10 | P1 | Prevent deletion of finalized financial records; use voids and adjustments instead. |
| PAY-11 | P1 | Reprint or reshare any historical receipt with a visible duplicate-copy label where appropriate. |
| PAY-12 | P1 | Export the payment ledger to CSV and summarized reports to PDF. |

#### Financial safeguards

- Payment amount must be positive and use the configured currency precision.
- A payment greater than the outstanding balance requires explicit handling as credit, split allocation, or rejection; MVP should reject it with a clear message.
- Backdated entries require a reason and appropriate role.
- A refund cannot exceed the refundable recorded amount.
- Financial reports use recorded transaction dates and preserve the configured currency in every export.

### 7.7 Reminders and local notifications

| ID | Priority | Requirement |
|---|---:|---|
| REM-01 | P1 | Schedule on-device notifications for upcoming expiry, expiry today, overdue balances, birthdays, and backup reminders. |
| REM-02 | P1 | Let the owner configure lead times, notification time, enabled categories, and quiet hours. |
| REM-03 | P1 | Open the relevant filtered list when a notification is selected. |
| REM-04 | P1 | Provide localized reminder templates with safe placeholders such as member first name, gym name, expiry date, and amount due. |
| REM-05 | P1 | Let staff copy or manually share a prepared message through the operating-system share sheet. |
| REM-06 | P1 | Never claim that an externally shared message was delivered or read. |
| REM-07 | P1 | Rebuild future notification schedules after reboot, time-zone change, app update, restore, or relevant record change. |

Operating systems may delay background notifications. In-app task lists are therefore the authoritative reminder view.

### 7.8 Reports and insights

| ID | Priority | Requirement |
|---|---:|---|
| REP-01 | P0 | Provide member reports: active, upcoming, expired, no membership, archived, expiring within a selected period, and new joins. |
| REP-02 | P0 | Provide finance reports: recorded collections, invoiced amount, discounts, tax, refunds, outstanding dues, and overdue dues. |
| REP-03 | P1 | Show plan-wise membership and revenue breakdowns. |
| REP-04 | P1 | Compare selected periods while clearly showing the date range. |
| REP-05 | P0 | Filter by date, plan, membership status, payment method, and staff actor where applicable. |
| REP-06 | P0 | Export detail data to UTF-8 CSV and printable summaries to localized PDF. |
| REP-07 | P1 | Show when a report was generated, the device time zone, currency, filters, and whether voided transactions are included. |
| REP-08 | P1 | Ensure dashboard and report totals use the same shared calculation rules. |

All analytics are calculated locally. GymVito does not receive product-usage or business metrics.

### 7.9 Import and export

| ID | Priority | Requirement |
|---|---:|---|
| IEX-01 | P1 | Import members from CSV using a downloadable/generated template. |
| IEX-02 | P1 | Provide column mapping, encoding selection when detection fails, language-aware date parsing, and a preview before writing data. |
| IEX-03 | P1 | Validate every row and report actionable row-level errors without partially importing invalid rows unless the owner explicitly chooses valid rows only. |
| IEX-04 | P1 | Detect duplicates and offer skip, update safe fields, or create new; never merge silently. |
| IEX-05 | P0 | Export members, memberships, invoices, and payments as separate UTF-8 CSV files. |
| IEX-06 | P0 | Exports must preserve identifiers and ISO-formatted dates for portability while optionally adding localized display columns. |
| IEX-07 | P1 | Exports containing personal data require owner/manager authorization and a privacy warning. |
| IEX-08 | P1 | Import operations are transactional and can be rolled back if the app closes or validation fails. |

### 7.10 Backup, restore, and device migration

| ID | Priority | Requirement |
|---|---:|---|
| BAK-01 | P0 | Create a complete encrypted backup containing the database, gym logo, member photos, and supported local attachments. |
| BAK-02 | P0 | Require a backup passphrase or use a user-selected secure key method; clearly explain that GymVito cannot recover it. |
| BAK-03 | P0 | Include backup schema version, app version, created time, data counts, checksum, and integrity metadata. |
| BAK-04 | P0 | Let the user save the backup through the operating-system file picker without uploading it to a GymVito service. |
| BAK-05 | P0 | Validate checksum, format, compatibility, available storage, and passphrase before replacing current data. |
| BAK-06 | P0 | Show a restore preview with gym identity, creation date, app/schema version, and record counts. |
| BAK-07 | P0 | Create a safety backup of current data before restore when storage allows. |
| BAK-08 | P0 | Restore atomically: either the complete backup becomes active or the existing database remains intact. |
| BAK-09 | P1 | Prompt for backup on a configurable schedule and show the last successful backup date on Home/Settings. |
| BAK-10 | P1 | Detect stale backups and failed/cancelled exports without falsely reporting success. |
| BAK-11 | P1 | Support migration from older supported schema versions with a logged, testable migration path. |
| BAK-12 | P1 | Provide a documented old-device-to-new-device migration flow using only backup and restore. |

Automatic cloud backup is not assumed. If a user deliberately selects a third-party document provider in the operating-system file picker, that transfer is controlled by the user and provider, not GymVito.

### 7.11 Staff, roles, and audit trail

| ID | Priority | Requirement |
|---|---:|---|
| STF-01 | P0 | Support an owner profile and optional local staff profiles with display name, role, PIN, active state, and preferred language. |
| STF-02 | P0 | Support Owner, Manager, and Front Desk role presets. |
| STF-03 | P1 | Allow the owner to customize permissions for member editing, pricing overrides, refunds, reports, exports, backups, and settings. |
| STF-04 | P0 | Record the active staff actor for financial, membership, import, backup, restore, and settings events. |
| STF-05 | P0 | Auto-lock after a configurable inactivity interval and allow immediate manual lock. |
| STF-06 | P1 | Lock or deactivate a staff profile without erasing historical attribution. |
| STF-07 | P1 | Maintain an append-only local audit view for sensitive actions, with filters by date, actor, entity, and action. |
| STF-08 | P1 | Require owner re-authentication for restore, full data deletion, security changes, and owner-role changes. |

#### Default role matrix

| Capability | Owner | Manager | Front Desk |
|---|:---:|:---:|:---:|
| View/add/edit members | Yes | Yes | Yes |
| Archive or merge members | Yes | Configurable | No |
| Enroll and renew | Yes | Yes | Yes |
| Override price/dates | Yes | Configurable | No |
| Record ordinary payment | Yes | Yes | Yes |
| Refund/void transaction | Yes | Configurable | No |
| View business reports | Yes | Yes | Limited |
| Export personal/financial data | Yes | Configurable | No |
| Manage plans and staff | Yes | Configurable | No |
| Backup/restore/delete all data | Yes | No | No |

### 7.12 Settings and data controls

| ID | Priority | Requirement |
|---|---:|---|
| SET-01 | P0 | Edit gym identity, regional formats, receipt settings, and membership rules. |
| SET-02 | P0 | Change app language at runtime without reinstalling or altering stored records. |
| SET-03 | P1 | Preview date, currency, number, and receipt formatting before saving regional settings. |
| SET-04 | P1 | Export a human-readable copy of operational data in addition to complete backup. |
| SET-05 | P1 | Delete an individual member's personal profile only through a guided flow that preserves legally/business-required anonymized financial history. The exact behavior must follow the selected market's requirements. |
| SET-06 | P0 | Delete all local app data only after owner re-authentication, explicit typed confirmation, and a backup offer. |
| SET-07 | P1 | Provide storage usage by database, photos, attachments, exports, and backups where the operating system permits. |
| SET-08 | P1 | Provide an in-app help section explaining status rules, backup, restore, and common workflows. External help links may use the internet when available. |

---

## 8. Multilingual and Regional Requirements

### 8.1 Language scope

The final initial language list is a product decision. The implementation must launch with at least two fully tested languages and be able to add languages through application releases without database changes.

A practical first-market example is English plus one target-market language such as Hindi. A language is not considered supported until the complete UI, validation text, local notifications, receipts, reports, backup/restore messages, and help content pass review.

### 8.2 Localization behavior

- All interface text uses stable translation keys; no user-facing text is hard-coded in screens or business logic.
- Support Unicode input, display, search, CSV import/export, PDF generation, and printing.
- Use locale-aware number, currency, percentage, date, and time formatting.
- Use correct plural rules rather than concatenating a number with an English noun.
- Support text expansion of at least 30% without truncating critical actions.
- Layout must be capable of right-to-left mirroring before an RTL language is marketed as supported.
- Search must be tolerant of case and common spacing/punctuation differences. Transliteration search is P2 and language-specific.
- User-entered names, notes, plan names, and custom fields remain exactly as entered and are not automatically translated.
- System plan templates may have translated labels; once saved and edited, their user-visible names are gym-owned content.
- Language is stored per staff profile; the lock screen can switch profile/language.
- If a translation key is missing, fall back to the base language, log locally for diagnostics, and never show raw keys to users in production.
- Bundled fonts must cover every supported script in generated PDFs; font licensing and file size must be reviewed.

### 8.3 Translation quality workflow

1. Extract source strings with descriptions and screenshots/context.
2. Translate by a qualified speaker.
3. Review terminology for gym, finance, date, and privacy concepts.
4. Test pseudolocalization, long strings, numerals, and plural forms.
5. Test on small and large screens.
6. Validate every PDF/receipt template and notification.
7. Obtain native-speaker sign-off before declaring support.

### 8.4 Regional settings

- Currency and precision.
- Tax label and inclusive/exclusive display.
- Date and time format.
- Week start.
- Device time zone, used automatically without an in-app selector.
- Name display order.
- Phone formatting without requiring a specific country's format.
- Paper size (A4 and common receipt widths where printing is supported).

Changing locale changes presentation, not stored monetary values, dates, identifiers, or historical transaction currency.

---

## 9. Critical User Journeys and Acceptance Criteria

### 9.1 Register a new member and sell a membership

1. Staff selects **Add member**.
2. Staff enters required identity details; GymVito generates a member code.
3. The app warns about likely duplicates.
4. Staff chooses a plan and start date.
5. The app previews end date, price, tax, discount, amount paid, and due balance.
6. Staff confirms the membership and records full/partial/no payment.
7. The app saves member, membership, invoice, payment, and audit entries atomically.
8. Staff can print or share a receipt.

Acceptance criteria:

- The workflow succeeds when connectivity is unavailable because it uses only local operational data.
- Force-closing before final confirmation creates no partial financial record.
- Force-closing after successful confirmation does not duplicate the transaction.
- The new membership and payment appear consistently on Home, member history, and reports.
- Dates, amounts, and receipt text use the selected locale.

### 9.2 Renew an expiring membership

1. Staff opens an expiry task or member profile.
2. Staff selects Renew and confirms plan and start behavior.
3. The app previews overlap, dates, price, and due amount.
4. Confirmation creates a new linked membership and invoice.

Acceptance criteria:

- Historical membership terms do not change.
- Scheduled and immediate renewal behaviors are explicit.
- Overlaps require acknowledgment.
- The task list updates immediately after completion.

### 9.3 Record a partial payment and settle later

1. Staff records less than the invoice balance.
2. The invoice becomes Partially paid and appears in dues.
3. Staff later records the remaining payment.
4. The invoice becomes Paid and no longer appears as outstanding.

Acceptance criteria:

- Balance equals invoice total minus valid payments and plus/minus valid adjustments.
- Every payment has its own receipt/reference and actor.
- Voiding a payment restores the correct due without deleting history.

### 9.4 Back up and restore on a new device

1. Owner creates an encrypted backup and saves/transfers the file.
2. Owner installs GymVito on the new device and chooses Restore.
3. The app validates and previews the backup.
4. Owner enters the passphrase and confirms.
5. The app migrates if needed, verifies counts/integrity, and opens the restored gym.

Acceptance criteria:

- A wrong passphrase exposes no readable personal data.
- A damaged or unsupported backup never replaces the current database.
- Restored counts, financial totals, media, settings, and audit history match the source.
- Language can be chosen before restore so error and recovery instructions are understandable.

### 9.5 Change the interface language

1. Authorized user opens Language settings.
2. User chooses another supported language.
3. Visible screens update immediately or after a clearly communicated app restart.

Acceptance criteria:

- Stored member names, notes, transaction values, and IDs remain unchanged.
- Navigation, validation, dialogs, notifications, receipts, and reports use the new language.
- No action becomes unreachable because translated text is longer.

---

## 10. Data Model

The following is a logical model; physical schema decisions belong in the technical design.

| Entity | Important fields and relationships |
|---|---|
| GymProfile | id, name, logo reference, contact/address, locale, currency, tax settings, receipt settings, created/updated timestamps |
| StaffProfile | id, display name, role, permission overrides, PIN credential reference, preferred language, active state, timestamps |
| Member | id, member code, names, contact fields, birth date, gender/self-description, address, emergency contact, photo reference, tags, custom values, archive state, timestamps |
| Plan | id, name, duration rules, current price/tax defaults, freeze policy, active state, timestamps |
| Membership | id, member id, source plan id, snapshotted plan terms, start/end dates, status inputs, price breakdown, prior/replacement membership links, timestamps |
| MembershipEvent | id, membership id, event type, effective date, prior/new values, reason, actor id, created time |
| FreezePeriod | id, membership id, start/resume dates, extension days, reason, actor id |
| Invoice | id, invoice number, member/membership ids, currency, line items, subtotal, discount, tax, total, due date, void state, timestamps |
| Payment | id, receipt number, invoice id, amount, method, reference, received time, actor id, state |
| FinancialAdjustment | id, invoice/payment link, type, amount, reason, actor id, created time |
| ReminderPreference | type, enabled, lead time, schedule, quiet hours, template key/custom text |
| AuditEvent | id, timestamp, actor id, action, entity type/id, summary, integrity fields |
| BackupRecord | id, created time, target descriptor, app/schema version, checksum, result, size |
| AppSetting | versioned settings not owned by another entity |

### 10.1 Data integrity requirements

- Use stable, randomly generated internal identifiers; display codes are separate.
- Monetary values use fixed-precision minor units or exact decimals, never binary floating point.
- All writes spanning related records use database transactions.
- Store event timestamps as absolute instants and display them in the device's current time zone. Store membership start/end dates and other business dates as date-only values where their meaning is intentionally calendar-based.
- Use foreign keys and explicit archive/status fields; do not rely on UI filtering for integrity.
- Schema migrations are versioned, idempotent where practical, and tested using old database fixtures.
- Finalized plan and invoice terms are snapshotted to prevent history changes.
- Sensitive corrections append events/adjustments instead of overwriting the only record of the prior value.

---

## 11. Security, Privacy, and Trust

### 11.1 Local data protection

- Encrypt the database at rest using a maintained, platform-appropriate encrypted database solution.
- Store encryption keys in the operating system's hardware-backed keystore/keychain where available.
- Hash staff PIN verification material with a password-hardening algorithm; never store PINs in plaintext.
- Rate-limit failed PIN attempts and add progressively longer local delays.
- Hide sensitive app content in the operating-system recent-apps preview where supported.
- Apply an inactivity lock and require re-authentication for sensitive operations.
- Encrypt complete backup files independently of database-at-rest encryption.
- Avoid putting personal data in filenames, logs, crash text, URLs, network requests, or notification bodies shown on a locked screen by default.

### 11.2 Privacy model

- Internet permission does not authorize automatic upload of operational or personal data. No advertising SDKs, tracking SDKs, server analytics, or remote crash collection are included in the defined product.
- Request only permissions needed for an initiated feature: camera for profile photos, notifications for reminders, and document/media access through system pickers.
- Explain each permission at the moment of use and provide a non-permission alternative where possible.
- Provide an in-app privacy notice covering stored fields, device risk, permitted internet use, external destinations, exports, backups, and owner responsibilities.
- Lock-screen notification content defaults to generic wording such as “3 memberships need attention.”

### 11.3 Threats addressed

- Casual unauthorized access to a shared or lost device.
- Plaintext extraction of the local database or backup.
- Accidental record deletion or silent financial rewriting.
- Malicious or malformed import/backup files.
- Unintended transmission of local data through optional internet actions.
- Unauthorized export by restricted staff.

### 11.4 Explicit limitations

- A fully compromised or rooted/jailbroken device can weaken local protections.
- A forgotten owner PIN or backup passphrase cannot be recovered remotely.
- Data not included in a successfully exported backup can be permanently lost with device loss, app deletion, or storage failure.
- Local roles deter misuse but do not provide the same separation as independent devices and a server audit system.

---

## 12. Non-Functional Requirements

### 12.1 Performance targets

- Cold start to locked/home-ready state: target under 3 seconds on the minimum supported reference device.
- Member search results: target under 300 ms for 10,000 members.
- Dashboard aggregation: target under 1 second for 10,000 members, 50,000 memberships, and 50,000 payments.
- Common screens must remain responsive while exports, backups, or reports are generated in a cancellable background task.
- Large lists use indexed queries and pagination/virtualization rather than loading all records into memory.

These targets must be validated on representative low- and mid-range hardware, not only development devices.

### 12.2 Reliability

- No confirmed operation may disappear after a normal app restart.
- Financial, membership, import, and restore operations must be transactional.
- The database enables integrity checks and safe journaling supported by the chosen platform.
- On unexpected shutdown, the next start must recover automatically or show a safe recovery flow.
- Low storage, denied permissions, corrupt media, interrupted exports, and interrupted restores must produce actionable messages.
- A backup is successful only after the complete file is written and verified.

### 12.3 Capacity baseline

Support at minimum on the reference device:

- 10,000 member profiles.
- 50,000 memberships/invoices/payments each.
- 20 staff profiles.
- 100 active/inactive plans.
- Media constrained by available device storage, with visible usage and compression limits.

### 12.4 Accessibility and usability

- Meet WCAG 2.2 AA principles where applicable to the native app.
- Support dynamic text scaling without hiding critical controls.
- Provide accessible labels, logical focus order, keyboard navigation on supported devices, and sufficient contrast.
- Never communicate membership validity or payment status by color alone.
- Use large touch targets for front-desk workflows.
- Support both 12- and 24-hour time presentation.
- Destructive and financial actions require clear labels and consequences, not ambiguous icons alone.

### 12.5 Compatibility

The technical plan must define minimum supported OS versions based on encrypted database, notification, biometric, PDF, and file-picker capabilities. Upgrade testing must cover every supported app schema version and at least the previous two public app versions.

---

## 13. Business Rules and Edge Cases

### 13.1 Membership

- A person may have historical, current, and scheduled memberships.
- Overlapping active memberships require deterministic status and renewal rules that are shown and logged.
- Archiving a member does not cancel membership, erase dues, or delete history; the app warns if any remain active.
- Editing a plan affects only future memberships unless an owner performs an explicit bulk change workflow, which is out of MVP scope.
- A freeze cannot begin after cancellation/expiry or overlap another freeze.
- The owner must see the exact end-date change before confirming a freeze/resume.

### 13.2 Dates and clocks

- The device time zone is used for all displayed event times, report day boundaries, and notification schedules; the app has no alternate gym time-zone setting.
- Membership start/end dates are date-only values and therefore remain unchanged if the device time zone changes.
- Daylight-saving changes must not create duplicate/missing business dates.
- If the system clock moves backwards or the device time zone changes, generated document numbers remain unique and stored absolute audit timestamps are not rewritten.
- Leap years, month-end starts, and time-zone changes require automated tests.

### 13.3 Financial

- Currency cannot be changed retroactively for finalized transactions. If the gym changes currency, historical records retain the original code.
- Discounts and taxes store both the applied rule and calculated amount.
- Deleting a member must not destroy required invoice/payment history; a privacy workflow may anonymize personal fields.
- Receipt and invoice number collisions must be prevented after restore or settings changes.
- Financial totals exclude voided transactions and separately disclose refunds unless a report explicitly selects another treatment.

### 13.4 Imports and duplicates

- Blank rows and benign whitespace are ignored; malformed numbers/dates are not guessed silently.
- Imported member codes must be unique or remapped with a report.
- CSV formula-injection characters are escaped in exports intended for spreadsheet use.
- Imports and restores from newer unsupported formats are rejected with a readable explanation.

### 13.5 Storage and media

- Photos are resized/compressed locally and orientation metadata is handled correctly.
- Removing a profile photo deletes unreferenced local media after a recoverable grace period or confirmed cleanup.
- Backup estimates required space before starting.
- Reports/exports do not remain in private cache indefinitely; temporary files are cleaned safely.

---

## 14. Screen Inventory

### 14.1 Access and setup

- Language selection.
- Welcome and local-data explanation.
- Gym setup.
- Owner security setup.
- First plan setup.
- Backup education.
- Lock/profile chooser.

### 14.2 Daily operations

- Home dashboard and task list.
- Global member search.
- Member list and filters.
- Add/edit member.
- Member profile and history tabs.
- Plan list and plan editor.
- New membership/renewal summary.
- Freeze, resume, cancel, and correction dialogs.
- Payment/dues list.
- Invoice detail and record-payment flow.
- Receipt preview.

### 14.3 Management

- Reports hub and report detail.
- Export center.
- CSV import mapper, preview, result, and error report.
- Staff and role management.
- Audit log.
- Backup history, create backup, and restore preview.
- Gym, regional, language, receipt, reminders, security, storage, privacy, and help settings.

---

## 15. Permissions and Platform Capabilities

| Capability | Why used | Required? | Fallback |
|---|---|---:|---|
| Camera | Capture a member profile photo | No | File/photo picker or no photo |
| Notifications | Local operational reminders | No | In-app Home task list |
| Biometric authentication | Convenient unlock/re-authentication | No | Owner/staff PIN |
| System document picker | Import, export, backup, and restore | Required for those actions | App remains usable; action explains limitation |
| Printing/share sheet | Send receipts, cards, reports, and messages | No | Save locally or view in app |

The app should avoid broad storage access and use operating-system pickers and scoped storage.

---

## 16. Error Handling and Recovery

Errors must state what happened, whether data was saved, and the safest next action.

Required recovery cases include:

- Low or exhausted device storage.
- Database cannot be opened or integrity check fails.
- App closes during enrollment, payment, import, export, backup, or restore.
- Wrong backup passphrase.
- Corrupt, incomplete, unsupported, or malicious backup/import file.
- Camera or notification permission denied.
- PDF font cannot render a selected language.
- Printer/share destination unavailable.
- Duplicate member, receipt number, or import record.
- Device date/time or time zone changes significantly; the app refreshes date-based views using the current device settings without changing stored membership dates.
- Biometric state changes or hardware becomes unavailable.

No error should tell the user to contact a server administrator. Diagnostic details must be exportable as a local redacted file, excluding PINs, encryption keys, member personal data, and full financial records unless explicitly included by the owner.

---

## 17. Product Success Measures

Because the product has no telemetry, success is evaluated through opt-in research, support feedback supplied by users, and structured acceptance testing—not silent data collection.

### 17.1 Product outcome targets

- A new owner can configure the gym, add a member, sell a membership, and issue a receipt without training.
- A trained staff member can find a member and view membership/payment status in under 10 seconds.
- Owners can identify expiries and outstanding dues from Home without constructing a report.
- Backup creation and new-device restore pass for 100% of supported fixture versions in automated/release testing.
- All advertised languages receive native-speaker acceptance before release.
- No known P0 data-loss, financial-calculation, localization-blocking, or authentication defects at release.

### 17.2 Optional owner-visible health indicators

- Last successful backup and age.
- Database/media size.
- Record counts.
- Last integrity check.
- Pending operational tasks.

These remain on the device and are not transmitted.

---

## 18. Delivery Scope and Phasing

### 18.1 MVP — dependable membership ledger

The MVP is usable by a real gym on one device and includes:

- Language selection and localizable interface foundation.
- Gym profile, regional settings, owner PIN, and lock.
- Plans with calendar durations and historical snapshots.
- Member registration, editing, search, archive, and history.
- Membership enrollment, renewal, automatic status, and expiry views.
- Invoices, partial/full payment recording, dues, and local PDF receipts.
- Home dashboard and core member/finance reports.
- CSV exports.
- Encrypted backup, restore, and versioned migrations.
- Transactional writes, encryption at rest, and core audit entries.
- At least two completely tested languages.

Explicitly deferred from MVP: freeze/cancel/upgrade, CSV import, staff-custom permission rules, local notifications, refunds/voids beyond owner correction, custom fields, and advanced reports.

### 18.2 Release 1 — operational completeness

- Multiple local staff profiles and complete role controls.
- Freeze, resume, cancellation, upgrade/downgrade, and complimentary membership.
- Refund/void ledger and expanded audit view.
- CSV import with mapping and duplicate handling.
- On-device reminders and message templates.
- Plan-wise and comparison reports.
- Storage management, backup scheduling prompts, and enhanced help.

### 18.3 Later candidates

These remain compatible with the local-first product direction but require separate product specifications:

- Classes and appointment capacity on the same device.
- Trainer assignment and local schedules.
- Waiver/document templates and signature capture.
- Label/receipt printer optimization.
- Attendance and member check-in/check-out, if prioritized in the future.
- App-store or offline license purchase and distribution model without a GymVito backend.
- Signed local language-pack import.
- Read-only archive export for long-term retention.
- Local device-to-device transfer with explicit owner action and end-to-end encryption.

Any cloud sync, multi-branch, remote member app, online payment, messaging automation, or web portal would materially change the trust and architecture model and requires a separate product decision.

---

## 19. Release Acceptance Checklist

### Functional

- Every P0 requirement has passing acceptance tests.
- The five critical journeys pass after a clean install without a GymVito backend; local workflows also pass while connectivity is unavailable.
- Membership dates, balances, tax, refunds/voids in scope, and reports reconcile against fixed test fixtures.
- Dashboard drill-down counts match their destination lists.
- Exported CSV and PDF files open correctly in representative external apps.

### Data safety

- App termination is tested at every financial and restore transaction boundary.
- Backup/restore round trips produce equal record counts, totals, settings, media hashes, and integrity results.
- Migration tests cover every supported historical schema fixture.
- Low-storage and corrupt-file tests preserve the prior working database.
- Uninstall/data-loss warning and first-backup education are present.

### Security and privacy

- Database and backup are not readable as plaintext outside the unlocked app.
- PIN rate limiting, inactivity lock, biometric fallback, permission checks, and restricted exports pass testing.
- Logs, notifications, recent-app previews, URLs/network requests, and temporary files are checked for personal-data leakage.
- Dependency and platform security review has no unresolved critical issue.

### Localization and accessibility

- Every advertised language passes completeness, native-speaker, truncation, PDF, notification, and input tests.
- Pseudolocalization and RTL-readiness checks pass even if RTL is not initially advertised.
- Dynamic text, screen reader, contrast, focus, non-color status, and touch target checks pass for core journeys.

### Performance and compatibility

- Performance targets pass on minimum reference hardware using capacity-baseline data.
- Supported OS upgrade, application upgrade, backup migration, clock/time-zone change, and reboot tests pass.
- Battery/background behavior for local reminders is documented and tested.

---

## 20. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Device loss without backup | Complete business-data loss | First-run education, visible backup age, scheduled prompts, encrypted portable backup |
| Owner forgets PIN/passphrase | Inaccessible app or backup | Clear warnings, confirmation, optional recovery key stored by owner; never promise remote recovery |
| Shared-device misuse | Unauthorized views or changes | Individual staff PINs, roles, auto-lock, audit trail, re-authentication |
| Incorrect device clock | Wrong expiry, reports, or timestamps | Persist time-zone/business dates, detect major changes, warn, avoid retroactive recalculation |
| Database corruption or interrupted write | Missing/inconsistent history | Transactions, journaling, integrity checks, atomic restore, verified backups |
| Translation ambiguity | Financial or operational mistakes | Domain glossary, contextual translation, native review, localized fixtures |
| Large media/data volume | Slow app or failed backup | Compression, indexed/paged queries, storage dashboard, preflight space checks |
| Financial expectations exceed ledger scope | User assumes money was processed | Consistent “recorded payment” language and no settlement/delivery claims |
| OS background restrictions | Reminder arrives late | Authoritative in-app task list, schedule repair, transparent limitation |
| Requirement expands into multi-device sync | Architecture no longer fits | Treat as a separate product with identity, conflict resolution, server, privacy, and migration plan |

---

## 21. Decisions Required Before Technical Design

These choices do not block the product definition but must be resolved before implementation estimates are committed:

1. First platform: Android native, cross-platform mobile, or desktop.
2. Minimum OS version and minimum reference device.
3. Launch countries, languages, currencies, tax display, and applicable privacy/financial record rules.
4. Exact language pair for MVP and whether an RTL language is included at launch.
5. Calendar rule for month-based memberships and default renewal overlap policy.
6. Whether staff profiles are needed in MVP or owner-only operation is acceptable initially.
7. Receipt/invoice numbering format and whether local regulations require immutable fiscal documents.
8. Supported printer/paper targets.
9. Backup passphrase/recovery-key design and migration support window.
10. Business model for distributing/licensing an app without operating a GymVito backend.
11. Which internet uses are allowed at launch and whether third-party file providers are acceptable backup destinations.

---

## 22. Definition of Done for a Feature

A feature is complete only when:

- Its core data workflow does not depend on a GymVito backend, and behavior is defined for unavailable connectivity and every optional internet action.
- Authorization, audit, failure, cancellation, and low-storage behavior are defined and tested.
- Data changes are transactional and included in backup/restore and migration tests.
- Strings, validation, notifications, receipts, and help are localized for every supported language.
- Accessibility checks cover the complete workflow.
- Reports and exports remain consistent with the feature's data.
- No personal data is added to logs, temporary filenames, URLs/network requests, or lock-screen text without explicit justification.
- Documentation explains any irreversible consequence or operating-system limitation.

---

## Appendix A — Example Permission Details

### Owner

Full local authority. Only the owner can restore a backup, delete all data, change encryption/security recovery configuration, or grant owner access.

### Manager

Can run the gym and see operational reports. Sensitive financial corrections, exports, staff administration, and plan override permissions are owner-configurable.

### Front Desk

Can register members, enroll/renew using configured terms, record ordinary payments, and issue receipts. Cannot restore, export all data, change security, delete history, or silently override pricing.

## Appendix B — Example CSV Member Template

Recommended columns:

```text
member_code,first_name,last_name,phone,email,date_of_birth,address,emergency_contact_name,emergency_contact_phone,joining_date,tags,notes
```

- UTF-8 is the required default encoding.
- Dates should use ISO `YYYY-MM-DD` in the portable template.
- Phone values are treated as text so leading `+` or zeroes are preserved.
- Tags may use a documented separator.
- Membership and payment imports should use separate, explicitly linked templates if added later; they must not be inferred from ambiguous member rows.

## Appendix C — Example Local Reminder Templates

Templates below illustrate placeholders; shipped wording must be professionally translated.

- Expiry soon: “Hello {first_name}, your membership at {gym_name} expires on {expiry_date}.”
- Expired: “Hello {first_name}, your membership at {gym_name} expired on {expiry_date}. Contact us to renew.”
- Payment due: “Hello {first_name}, our records show {amount_due} due at {gym_name}.”

The user must review the generated message before manually sharing it. Sensitive values should be omitted from locked-screen local notifications by default.
