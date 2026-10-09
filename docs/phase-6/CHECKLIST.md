# Phase 6 Checklist

Status: implemented locally; physical-device acceptance is still required.

## Home and drill-downs

- [x] Active, expiring, expired, outstanding, overdue, and today's recorded-collection values use the existing membership and ledger rules.
- [x] Home metric cards open the corresponding member, dues, or payment-history list.
- [x] Add member, Renew, and Record payment remain the primary action-first shortcuts.
- [x] Phone and tablet composition follows the approved Home references, including 16dp/24dp gutters and 48dp targets.

## Reports

- [x] Member reports cover active, upcoming, expired, no membership, archived, expiring, and new joins.
- [x] Finance reports cover recorded collections, invoiced amount, discounts, tax, payment corrections/refunds, outstanding dues, and overdue dues.
- [x] Date, plan, membership-status, and payment-method filters are supported where applicable.
- [x] Summary totals are calculated from the same Phase 3/4 status and ledger records used by operational screens.
- [x] Localized printable PDF summaries include generation time, device time zone, and filter period.
- [x] No attendance report or export exists.

## Export and privacy

- [x] Members, memberships, invoices, and payments export as separate UTF-8 CSV files.
- [x] Stable identifiers and ISO date/timestamp fields are included.
- [x] CSV values are quoted and spreadsheet-formula prefixes are neutralized.
- [x] Owner PIN reauthentication and a privacy warning precede CSV/PDF export.
- [x] CSV generation yields in chunks, reports progress, and can be cancelled.
- [x] GymVito deletes its cache artifact after the native share sheet closes without touching the user's saved copy.

## Remaining device gates

- [ ] Verify English and Hindi layouts on narrow Android phones and 600dp/960dp tablets.
- [ ] Open CSVs in representative spreadsheet apps and confirm leading plus/zero values, multiline text, Devanagari, commas, and quotes.
- [ ] Open, print, and share localized PDFs and confirm bundled Devanagari glyphs.
- [ ] Exercise cancellation, background/lock, process death, and low-storage behavior during a large export.
- [ ] Measure report/export performance on minimum supported hardware.
