# Phase 4 evidence — Billing, Payments, Dues, and Receipts

Date: 2026-10-08

## Implemented

- Migration 5 adds future numbering prefixes, invoice/line/payment/adjustment tables, receipt/invoice sequences, owner-configurable recorded method labels, and deterministic invoice snapshots for memberships finalized before the upgrade.
- `Phase4Repository` provides atomic membership billing, idempotent payment recording, immutable owner corrections, dues/member/payment queries, settings, and dashboard/report-source totals.
- Enrollment and renewal can optionally record a full or partial payment in the same transaction as the membership and invoice; successful immediate payments open the receipt-ready invoice view.
- The Payments, Record Payment, Invoice Detail, Billing Settings, Home, Member Profile, and enrollment/renewal surfaces use the approved evergreen phone/tablet design language.
- Receipt HTML escapes every dynamic value, embeds the bundled Devanagari font, reconciles saved values, labels duplicate copies, and explicitly avoids processing/settlement claims.

## Automated evidence

Final local result:

```text
pnpm validate
  Formatting, lint, network/architecture boundaries, typecheck, migrations,
  translations, Phase 2 benchmark, EAS profiles, fixture scan, and test:ci passed.
  23 suites / 83 tests passed.
  Coverage: 92.59% statements, 90.38% branches, 95.91% functions, 95.25% lines.
  The bundled Expo Doctor step could not reach exp.host in the restricted sandbox.

pnpm expo:doctor (network-enabled rerun)
  21/21 checks passed.

git diff --check
  Passed.
```

Focused coverage is provided by:

```text
src/domain/billing/money.test.ts
src/domain/billing/receipt.test.ts
src/data/repositories/phase4-repository.test.ts
src/features/memberships/membership-form.test.tsx
src/features/payments/payment-form.test.tsx
```

The repository test executes the checked-in Phase 0–4 migration chain in an in-memory SQLite database with foreign keys enabled. It verifies invoice/receipt sequence allocation, integer totals, full and partial settlement, overpayment rejection, local-day overdue status, idempotency, owner correction without deletion, billing settings, dashboard reconciliation, and whole-transaction rollback when payment insertion fails.

## Device acceptance still required

- Compare the phone Record Payment and member ledger screens to the committed screenshots at narrow width, large font scale, English, and Hindi.
- Compare the tablet split payment/profile presentation to the committed tablet ledger screenshot.
- Generate English and Hindi receipts with long names and large Indian-numbering amounts; inspect A4 output and duplicate marking.
- Exercise Android preview/print/save/share success, cancellation, and unavailable-provider paths.
- Force-stop during record-payment attempts before/during/after commit and confirm no partial ledger rows or duplicate numbers.
- Repeat on low storage and confirm the already-recorded payment remains intact when PDF generation fails.

No physical-device, installed-build, print-provider, or share-provider claim is made by this local evidence note.
