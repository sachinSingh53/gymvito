# Phase 1 evidence

Phase 1 is implemented in source. This file separates reproducible local evidence from physical-device acceptance.

## Implementation map

| Contract area             | Implementation                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Startup/session state     | `src/features/session/app-session-context.tsx`                                                                           |
| Guarded routes            | `src/app/(public)`, `src/app/(setup)`, `src/app/(app)`                                                                   |
| Schema and role seeds     | migration 2 in `src/data/database/migrations/manifest.json`                                                              |
| Transactional persistence | `src/data/repositories/app-state-repository.ts`                                                                          |
| PIN and lockout           | `src/platform/security/pin-kdf.ts`, `src/domain/security/lockout-policy.ts`, `src/features/security/security-service.ts` |
| Biometrics                | `src/platform/security/biometrics.ts`                                                                                    |
| Localization              | `src/i18n`, English/Hindi locale files, regional formatters                                                              |
| Redacted diagnostics      | `src/platform/diagnostics/local-diagnostic-logger.ts`                                                                    |
| UI baseline               | `src/ui/components`, `src/ui/theme`                                                                                      |

## Reproducible local checks

Run from the repository root:

```sh
pnpm validate
```

This validates formatting, lint and architecture/network boundaries, TypeScript, migration checksums, English/Hindi key and placeholder parity, EAS profiles, sensitive fixtures, Jest tests/coverage, and Expo Doctor.

Validation on 2026-10-07:

- Formatting, lint, network/architecture boundaries, TypeScript, two migration checksums, 110 translation keys in both languages, EAS profiles, and the sensitive-fixture scan passed.
- Jest passed 9 suites and 38 tests; global statement/branch/function/line coverage was 94.89%/98.68%/89.47%/95.55%.
- An Android Metro export passed with 1,379 modules and produced a Hermes bundle.
- The Phase 1 SQL was also executed in an in-memory SQLite engine: 12 tables, three seeded roles, 18 seeded permissions, and `integrity_check=ok`.
- Expo Doctor passed 19 of 21 checks. Its Expo config-schema and React Native Directory checks require external metadata; both were blocked by DNS in the restricted environment. They remain pending rather than being treated as product failures.

The migration test exercises a version-zero database through migrations 1 and 2 and repeats startup to prove runner idempotency at the orchestration boundary. Domain tests cover setup validation, progressive lockout and remaining-delay calculation. Security-service tests cover persisted lockout, incorrect PIN, and successful PIN paths. The development verifier test covers correct/incorrect PIN behavior without claiming native Argon2id proof.

## Evidence boundary

Local checks do not establish Android rendering, process-death persistence, biometric behavior, native Argon2id, SQLCipher confidentiality, background timing, accessibility, or phone/tablet layout. Those items remain open in the checklist until run on the required devices. Expo Go is plaintext and synthetic-data-only.
