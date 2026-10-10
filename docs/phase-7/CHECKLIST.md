# Phase 7 MVP Release Checklist

Status: implemented and locally hardened; MVP release approval remains blocked on signed physical-device acceptance.

## Product and UI

- [x] Core MVP routes cover onboarding, plans, members, memberships, invoices, payments, receipts, Home, reports, exports, backup, restore, settings, and destructive reset.
- [x] Help & Privacy is available from More in English and Hindi.
- [x] Privacy copy covers stored fields, device risk, permitted external destinations, exports, backups, and owner responsibilities.
- [x] Setup and Help & Privacy both warn that uninstall, app-storage clearing, device loss, or reset can permanently erase unbacked-up data.
- [x] The disabled Phase 7 CSV-import placeholder was removed because import is explicitly deferred beyond MVP.
- [x] New UI uses the approved evergreen surfaces, outlined cards, readable hierarchy, wrapping copy, responsive maximum width, and 48dp shared buttons.
- [x] Release icon, adaptive foreground, and splash mark use the approved deep-evergreen and mint brand palette.

## Release engineering

- [x] App version is `1.0.0` in application and package metadata.
- [x] EAS has a production store/app-bundle profile with remote auto-incremented build versions.
- [x] Production configuration removes the Expo Go development-runtime marker.
- [x] Release configuration, required assets, package identity, blocked broad-storage permissions, and system-backup policy are checked locally.
- [x] Direct production/development dependency licenses are checked against the reviewed allowlist.
- [x] CI runs the same release configuration, license, migration, translation, fixture, test, and export checks through `pnpm validate`.

## Automated hardening

- [x] English/Hindi translation keys and placeholders have parity.
- [x] The Help & Privacy route has accessible headings, grouped list content, long Hindi coverage, and no raw-key rendering in tests.
- [x] Every supported schema start version (1 through 6) upgrades to the current schema and passes SQLite quick-check locally.
- [x] Backup manifests for supported schema versions 1 through 6 pass compatibility validation; newer/invalid versions fail closed.
- [x] A local capacity fixture covers 10,000 members, 100 plans, 20 staff records, and 50,000 memberships, invoices, and payments with reconciled dashboard totals.
- [x] Network-boundary and sensitive-fixture scans cover runtime imports and committed source fixtures.

## Required device and release gates

- [ ] Complete TalkBack, switch/keyboard navigation, focus order, dynamic text, contrast, and non-color-state review for every core journey.
- [ ] Complete native-speaker English/Hindi review on narrow phone and 600dp/960dp tablet layouts, including receipts and reports.
- [ ] Run cold-start, search, dashboard, export, report, backup, and restore performance on the minimum supported Android device using the capacity dataset.
- [ ] Run SQLCipher and Argon2 acceptance in a production-like custom build; Expo Go is not acceptable security evidence.
- [ ] Run airplane-mode journeys and verify no local workflow requires connectivity.
- [ ] Exercise clock/time-zone changes, reboot, application upgrade, process death, low storage, picker cancellation, and permission denial.
- [ ] Round-trip every supported encrypted backup fixture on a clean install/new device and reconcile counts, totals, settings, media, sequences, and audit records.
- [ ] Open exported CSV/PDF files in representative Android apps and verify print/share behavior and Devanagari glyphs.
- [x] Complete a live dependency vulnerability audit against the package registry and resolve any critical issue (0 critical; reviewed high/moderate transitive findings are documented).
- [ ] Configure production signing credentials, privacy-policy/support URLs, screenshots, content rating, data-safety answers, countries, and Play listing.
- [ ] Build the signed production app bundle and pass the seven Phase 7 acceptance journeys on physical phone and tablet targets.

MVP release must not be declared until every item in the final section is complete.
