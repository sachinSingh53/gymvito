# Phase 2 evidence

Phase 2 is implemented in source. This file separates reproducible local evidence from Android reference-device acceptance.

## Implementation map

| Contract area                       | Implementation                                              |
| ----------------------------------- | ----------------------------------------------------------- |
| Phase 2 schema                      | migration 3 in `src/data/database/migrations/manifest.json` |
| Plan/member transactions            | `src/data/repositories/phase2-repository.ts`                |
| Plan validation and money parsing   | `src/domain/plans/plan.ts`                                  |
| Member validation and normalization | `src/domain/members/member.ts`                              |
| Photo crop/compression/cleanup      | `src/platform/images/member-photo.ts`                       |
| Phone/tablet visual shell           | `src/ui/components/operational-shell.tsx`                   |
| Plan routes                         | `src/app/(app)/plans.tsx`, `src/app/(app)/plan`             |
| Member directory/profile routes     | `src/app/(app)/members.tsx`, `src/app/(app)/member`         |
| English/Hindi UI                    | `src/i18n/locales/en.json`, `src/i18n/locales/hi.json`      |
| 10k local benchmark                 | `scripts/benchmark-phase2-members.mjs`                      |

## Design conformance

The implementation derives its visual system from `docs/design/DESIGN.md` and the supplied phone, Hindi, and tablet reference screens:

- mint canvas, white bordered cards, dark evergreen headers/rail, and muted green surfaces;
- Inter UI typography with the bundled Noto Sans Devanagari support;
- 8-point spacing rhythm, rounded cards, pill actions, and at least 48 dp interactive targets;
- bottom navigation on phones and an 84 dp rail plus master-detail member view on tablets;
- compact local-device badges, status chips, member cards, profile summary, search filters, and floating add action.

The visual references contain attendance/check-in concepts that are outside the product and Phase 2 contracts. Their visual language is used, but those behaviors are intentionally absent. Payments, membership assignment, import, and export are similarly shown only as unavailable future actions.

## Reproducible local checks

Run from the repository root:

```sh
pnpm validate
```

The Phase 2-specific benchmark can also be run independently:

```sh
pnpm validate:phase2
```

Validation on 2026-10-08:

- Three ordered migration checksums and 276 English/Hindi translation keys validated.
- Jest passed 14 suites and 49 tests, including member-directory component behavior and real in-memory SQLite repository coverage for plan CRUD/deactivation, member CRUD/archive, notes, photo replacement/removal, duplicate warning, collision retry, transaction rollback, and Unicode/phone/email/code search.
- Global statement/branch/function/line coverage was 95.48%/95.10%/93.10%/96.35%.
- The desktop SQLite 10,000-member fixture completed five representative searches in under the enforced 1,000 ms ceiling. This is regression evidence, not the minimum Android hardware gate.
- Android Metro export passed with 1,416 modules and produced a 3.4 MB Hermes bundle containing both Inter and Noto Sans Devanagari assets.
- Expo Doctor passed all 21 checks against live Expo and React Native Directory metadata after aligning SDK 57 patch versions.
- Network and architecture boundary checks passed; Phase 2 adds no backend or remote operational-data path.

## Evidence boundary

Unit tests, desktop SQLite, TypeScript checks, and Metro export cannot establish Android rendering, native image orientation, SQLCipher at-rest confidentiality, process-death behavior, accessibility, or minimum-device responsiveness. Those items remain open in the checklist. Expo Go remains plaintext and synthetic-data-only; native security acceptance requires a GymVito development build.
