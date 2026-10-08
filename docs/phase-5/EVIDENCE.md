# Phase 5 Evidence

## Implemented contracts

- Migration 6 extends `backup_manifest` with production reconciliation metadata and adds durable `backup_record` history.
- `Phase5Repository` derives deterministic counts, financial totals, membership states, number sequences, media SHA-256, and a logical checksum.
- The SQLCipher adapter independently verifies exported backups, migrates restore candidates, checks storage and integrity, verifies safety copies, replaces the live database with rollback handling, and removes stale WAL/SHM files.
- The session owns handle shutdown/restart across restore and destructive reset.
- The backup center and recovery screen implement owner verification, passphrase warnings, previews, explicit confirmations, local-only disclosures, and English/Hindi responsive UI.

## Local automated evidence

Run from the repository root:

```sh
pnpm validate
pnpm exec expo export --platform android --output-dir /tmp/gymvito-phase5-android
git diff --check
```

Focused Phase 5 tests:

```sh
pnpm test --runInBand \
  src/platform/backup/backup-manifest.test.ts \
  src/data/repositories/phase5-repository.test.ts \
  src/data/database/run-migrations.test.ts
```

These local tests validate manifest rejection, migration ordering, Phase 4 → Phase 5 schema upgrade, deterministic reconciliation, backup-attempt history, and last-success semantics. They do not execute SQLCipher export, Android document providers, process-death replacement, or physical-device rendering.

Recorded on 2026-10-08:

- Full Jest/coverage: 24 suites and 89 tests passed; 92.83% statements, 90.87% branches, 96.07% functions, and 95.43% lines.
- Focused Phase 5: 3 suites and 18 tests passed.
- Formatting, lint, architecture/network boundaries, strict TypeScript, 6 migration checksums, 505 English/Hindi keys, EAS profiles, fixture scan, and the Phase 2 10k-member benchmark passed.
- Android production export completed successfully with 1,445 modules.
- Expo Doctor passed 21/21 checks when run with network access. The first restricted run could not resolve `exp.host`; that was an environment-only failure.
- `git diff --check` passed.

## Required device evidence

Phase 5 is not release-accepted for real gym data until every unchecked item in [CHECKLIST.md](./CHECKLIST.md) is completed on SQLCipher-enabled Android phone/tablet targets. Expo Go is never evidence for encrypted database or backup confidentiality.
