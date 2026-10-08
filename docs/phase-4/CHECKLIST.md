# Phase 4 checklist — Billing, Payments, Dues, and Receipts

## Product and data scope

- [x] PAY-01: Finalizing an enrollment or renewal atomically creates one immutable invoice and line-item snapshot.
- [x] PAY-02: Full, partial, and later-settlement payments are recorded against an invoice.
- [x] PAY-03: Cash, UPI/QR, card/POS, bank transfer, cheque, and other are selectable recorded methods; owner-configured labels apply to future payments.
- [x] PAY-04: Each payment stores amount, method label/code, optional reference/note, received instant/local date, and actor.
- [x] PAY-05: Subtotal, discount, tax, total, recorded paid, adjustments, and balance use integer minor units.
- [x] PAY-06: Invoice and receipt numbers are allocated inside the exclusive transaction from independent sequences and configurable prefixes.
- [x] PAY-07: English/Hindi escaped HTML receipts render through the bundled Devanagari font and support print plus save/share.
- [x] PAY-08: A promised due date drives device-local due and overdue projections.
- [x] PAY-10: Finalized financial rows have no ordinary delete path; owner corrections append a linked reversal event.
- [x] PAY-11: Historical receipt actions visibly mark regenerated documents as duplicate copies.
- [x] PAY-12 Phase 4 portion: Payment-ledger and dashboard/report-source totals are queryable and reconciled; CSV/report export remains in Phase 6 per the implementation plan.
- [x] MSH-01/MSH-03 billing portion: Membership, invoice, optional payment, sequences, and audits can commit in one exclusive transaction.

## Approved UI contract

- [x] Uses the committed `docs/design/DESIGN.md` tokens: evergreen hierarchy, tonal cards, pill actions, status surfaces, tabular money, and 48dp controls.
- [x] Phone payment flow follows `record_payment_hindi`: member/invoice context, due banner, prominent amount, quick amounts, method grid, reference/note, reconciliation, and one final action.
- [x] Tablet payment flow follows `tablet_member_profile_ledger`: responsive member context plus counter-settlement pane.
- [x] Member profile shows a pending ledger balance, collect action, total/paid/balance metrics, and invoice history.
- [x] Payments navigation exposes dues and immutable payment history.
- [x] English and Hindi resources contain the same complete key set.
- [x] Wording consistently says recorded payment; it never claims online processing or bank settlement.

## Integrity, recovery, and tests

- [x] Numbered migration 5 has a checked SHA-256 checksum and old-schema upgrade coverage.
- [x] Repository fixtures cover full/partial/later settlement, overpayment rejection, overdue boundaries, idempotent retry, correction, custom settings, and rollback after a simulated interrupted payment write.
- [x] Receipt fixtures reconcile money values, escape user text, localize Hindi, and mark duplicates.
- [x] Component tests cover the approved method hierarchy, exact minor-unit submission, receipt routing, and pre-write overpayment rejection.
- [x] Print/share failures happen after payment commit and cannot change ledger state.
- [ ] Physical Android phone/tablet review: narrow/dynamic text, Hindi glyphs, system print/share cancellation, A4 output, low storage, and force-stop/restart.

## Exit boundary

Local static, unit, component, and SQLite integration evidence can satisfy the code gate. Physical-device PDF rendering, actual Android print/share cancellation, process death, low-storage behavior, and visual comparison against the supplied phone/tablet screenshots remain device acceptance and must not be inferred from local tests.
