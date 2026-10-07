# Phase 3 evidence

Phase 3 is implemented in source. This note separates reproducible local evidence from Android device acceptance.

## Implementation map

| Contract area                   | Implementation                                                           |
| ------------------------------- | ------------------------------------------------------------------------ |
| Phase 3 schema                  | migration 4 in `src/data/database/migrations/manifest.json`              |
| Status/date/charge rules        | `src/domain/memberships/membership.ts`, `src/domain/dates/date-rules.ts` |
| Enrollment/renewal transactions | `src/data/repositories/phase3-repository.ts`                             |
| Enrollment/renewal UI           | `src/features/memberships/membership-form.tsx`                           |
| Device-local day refresh        | `src/features/memberships/use-local-business-date.ts`                    |
| Member directory projections    | `src/app/(app)/members.tsx`, `src/features/members/member-card.tsx`      |
| Profile subscription/history UI | `src/features/members/member-profile-panel.tsx`                          |
| Home membership summaries       | `src/app/(app)/home.tsx`                                                 |
| English/Hindi UI                | `src/i18n/locales/en.json`, `src/i18n/locales/hi.json`                   |

No new architecture decision record was required. The implementation follows ADR-003's direct typed repository and checked-in migration decision, plus the existing device-time-zone and local-only contracts.

## Design conformance

The UI was implemented from `docs/design/DESIGN.md` and the committed phone/tablet profile and directory snapshots. It uses the approved mint/white/evergreen palette, outlined 14 px cards, pill actions, status chips, minimum 48 dp controls, current-subscription progress, compact term tiles, lifecycle history, phone bottom navigation, and tablet master-detail presentation.

The reference artwork also depicts payments, WhatsApp ledger sharing, check-in/turnstile data, and server-sync language. Those visual behaviors were deliberately excluded because the implementation plan places billing in Phase 4 and the product contract excludes attendance and a GymVito backend. The local badge says data is saved on this device.

## Reproducible local checks

Run from the repository root:

```sh
pnpm validate
```

Focused Phase 3 checks:

```sh
pnpm test --runInBand src/domain/memberships/membership.test.ts src/data/repositories/phase3-repository.test.ts src/features/members/member-card.test.tsx
pnpm validate:migrations
pnpm validate:translations
pnpm lint
pnpm typecheck
```

Local validation covers:

- inclusive day/week/month/year rules, including leap-day and month-end clamping;
- draft/scheduled/active/expired/cancelled derivation and date-only overlap;
- immutable plan snapshots after live plan edit/deactivation;
- same-plan/different-plan renewal links and overlap acknowledgment;
- idempotent retry after commit and conflicting-operation rejection;
- rollback when the required membership event write fails;
- populated Phase 2 to Phase 3 migration fixture;
- active/upcoming/expired/no-membership/archived projections and fixed dashboard counts;
- English/Hindi key and interpolation parity;
- architecture and no-direct-network boundaries.

Validation on 2026-10-08:

- Four ordered migration checksums and 335 English/Hindi translation keys passed validation.
- Jest passed 16 suites and 64 tests, including the final idempotency-conflict and deterministic-current-selection assertions.
- Global statement/branch/function/line coverage was 92.85%/90.42%/94.73%/94.05%.
- The existing 10,000-member desktop SQLite benchmark completed five representative searches in 9.1 ms. This remains regression evidence, not minimum Android hardware proof.
- Formatting, lint, architecture/no-network boundaries, TypeScript, EAS profiles, and fixture scanning passed.
- Android Metro export bundled 1,421 modules into a 3.4 MB Hermes bundle with the Inter, Material Symbols, and Noto Sans Devanagari assets.
- Expo Doctor initially could not reach `exp.host` inside the restricted network environment; its approved network retry passed all 21 checks.

## Evidence boundary

Jest, desktop SQLite, lint, TypeScript, migration checks, and Metro/Expo validation do not prove Android rendering, SQLCipher confidentiality, process-death timing, local-midnight refresh, low-storage behavior, TalkBack, or reference-device performance. Those items remain open in the checklist. Expo Go is suitable only for synthetic-data UI development; native security acceptance requires a GymVito development build.
