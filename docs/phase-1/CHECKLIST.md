# Phase 1 checklist

## Implemented

- [x] Startup states cover initializing, migration, setup-required, locked, unlocked, and localized recovery.
- [x] Route groups guard setup and business screens; locked sessions cannot mount business routes.
- [x] Language selection precedes business setup and persists for English and Hindi.
- [x] Interrupted onboarding resumes from the persisted step.
- [x] Gym identity and regional settings persist without a gym time-zone selector.
- [x] Owner PIN verifier is versioned; native builds use Argon2id and Expo Go is explicitly development-only.
- [x] Failed attempts and progressive lockout persist in SQLite.
- [x] Manual, inactivity, and background locking are implemented.
- [x] Optional biometric unlock falls back to the owner PIN.
- [x] Owner re-authentication protects automatic-lock changes.
- [x] Owner, Manager, and Front Desk role presets are seeded for later phases.
- [x] Security and audit events are append-only local records.
- [x] Privacy, unrecoverable-PIN, local-data-loss, and first-backup education are localized.
- [x] Runtime language and gym/regional setting edits persist without rewriting business records.
- [x] Local diagnostics accept only redacted codes and have no remote destination.

## Device acceptance still required

- [ ] Complete fresh and interrupted onboarding on a narrow Android phone and tablet.
- [ ] Kill/restart at every onboarding step and confirm the correct resume route.
- [ ] Confirm native Argon2id PIN setup/unlock and persisted lockout after process death.
- [ ] Exercise biometric unavailable, cancelled, failed, success, and enrollment-changed fallback.
- [ ] Confirm inactivity/background lock timing and recent-app obscuring on physical Android.
- [ ] Change device language, time zone, font scale, and 12/24-hour preference while backgrounded.
- [ ] Complete screen-reader and large-text review in English and Hindi.
