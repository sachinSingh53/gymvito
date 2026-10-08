# Phase 5 Acceptance Checklist

## Production backup

- [x] Backup creation is owner-PIN authenticated and unavailable in Expo Go.
- [x] Passphrases require 12–512 characters, at least one letter, and at least one number.
- [x] The UI warns that GymVito cannot recover a lost passphrase.
- [x] The complete SQLCipher database, including member-photo BLOBs, is exported to `.gymvito`.
- [x] The manifest records format/schema/app versions, time/locale, gym identity, currency, record counts, financial totals, membership states, sequences, media hash, and logical checksum.
- [x] The temporary backup is independently opened and reconciled before the destination picker appears.
- [x] Destination size and SHA-256 are verified before backup history records success.
- [x] Failed or cancelled destinations do not change the last-successful-backup state.

## Restore and recovery

- [x] Restore selection accepts only `.gymvito` files copied through the system picker.
- [x] Wrong passphrases, wrong-app files, corrupt files, unsupported formats, newer schemas, and low storage fail closed.
- [x] A localized preview shows gym identity, creation time, source versions, and record counts.
- [x] Normal restore requires owner PIN re-authentication and explicit replacement acknowledgement.
- [x] A candidate is re-keyed to the current device key, migrated, integrity-checked, and reconciled before replacement.
- [x] Current data is checkpointed and copied to a verified encrypted safety database before replacement.
- [x] Main database, WAL, and SHM replacement is coordinated with the session database handle.
- [x] Replacement failure moves the safety database back into place.
- [x] New-install and startup-error recovery can restore with the backup passphrase when the old device key is unavailable.
- [x] Startup cleans abandoned temporary files only after the active live database passes integrity checks.

## Destructive reset and UI

- [x] Delete-all requires an owner PIN, a backup acknowledgement, and typed `DELETE` confirmation.
- [x] Delete-all removes the local database, WAL/SHM files, and device database key before returning to setup.
- [x] Backup status appears on Home and the full history/action center is available from More.
- [x] Phone/tablet layouts use approved colors, surfaces, gutters, cards, wrapping, and 48dp controls.
- [x] English and Hindi keys are complete; long confirmation labels wrap without reducing touch targets.

## Remaining release/device gates

- [ ] Run encrypted round trips for every supported schema fixture in a SQLCipher-enabled Android build.
- [ ] Force-close at every candidate/safety/live replacement boundary and verify the prior database remains usable.
- [ ] Exercise wrong passphrase, truncation, wrong-app file, newer schema, low storage, picker cancellation, and provider-write failure on Android.
- [ ] Verify phone/tablet visuals, Hindi text, large font, keyboard/IME, safe areas, TalkBack, and landscape behavior.
- [ ] Restore on a genuinely new device key and reconcile counts, money, memberships, media hashes, settings, sequences, and audit history.
- [ ] Verify representative maximum-data backup duration, memory, and storage estimates.
