# Phase 0 checklist

## Requirement links

- ONB-01 / SET-02: English and Hindi resources, runtime switching, bundled Devanagari font.
- ONB-02: device locale/time-zone adapter; no gym time-zone setting.
- ONB-03 / ONB-04: Argon2id PIN verifier and biometric-to-PIN fallback adapter.
- ONB-06 and BAK-01 through BAK-08: encrypted SQLCipher export, manifest, independent verification, safety copy, and atomic replacement proof.
- BAK-11 / BAK-12: immutable migration/checksum foundation and portable device-independent backup key.
- SET-06: key/data recovery rules established; destructive product UI remains Phase 5.
- Product Sections 8, 10.1, 12.2, 12.3, and 13.2: bilingual output, transactions, encryption, capacity, and date rules.

## Implementation

- [x] Expo Router TypeScript project and development-client entry point.
- [x] Exact Node/package/native versions recorded and locked.
- [x] Formatting, ESLint, type checking, Jest, commit hook, and CI quality workflow.
- [x] Android application IDs, environment suffixes, CNG plugins, minimum SDK, and debug signing path.
- [x] SQLCipher config and SecureStore 256-bit device key lifecycle.
- [x] Foreign keys, WAL, busy timeout, prepared business statements, exclusive writes, application ID, schema version, immutable checksummed migrations, and startup integrity check.
- [x] Missing-key-with-existing-database fails closed.
- [x] SQLCipher export/restore implementation with manifest/count/money/media reconciliation and verified safety replacement.
- [x] Wrong-key, wrong-passphrase, corrupt-backup, simulated-interruption, wipe/restore, and restart proof harness.
- [x] Argon2id PIN adapter and on-device timing measurement.
- [x] English/Hindi screen and embedded-font A4 PDF generation.
- [x] Device locale/time-zone foreground refresh.
- [x] Document picker, verified directory save, share, print, and temporary cleanup adapters.
- [x] 10,000-row compressed-avatar BLOB benchmark that omits BLOBs from list queries.
- [x] Maestro selected with a deterministic development-client smoke flow.
- [x] EAS development-client and standalone preview APK profiles for testing without Android Studio.
- [x] Direct-network and architecture boundary checks.
- [x] Dependency audit reviewed; three transitive advisories and mitigations recorded in `DEPENDENCY_REVIEW.md`.
- [ ] Install/run on Android emulator and minimum/reference physical device.
- [ ] Record plaintext-at-rest inspection and kill/restart evidence from an Android build.
- [ ] Record measured backup, restore, avatar memory, PDF visual review, and Argon2 calibration evidence on reference hardware.
- [ ] Native-speaker Hindi acceptance.

The unchecked items are native acceptance gates, not claims established by JavaScript tests or generated Android source.
