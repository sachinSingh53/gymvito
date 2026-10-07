# Phase 2 checklist

## Implemented

- [x] First-run home state points the owner to plan creation without silently seeding templates.
- [x] Plans support list, create, edit, activate/deactivate, day/week/month/year durations, integer-minor pricing, admission fees, tax and discount defaults, color, freeze, and renewal policies.
- [x] Plan updates and deactivation retain the same stable plan record and append local audit events.
- [x] Members support list, create, edit, exact duplicate warnings, archive/restore, and a basic profile.
- [x] Member codes use a persisted sequence with collision detection and retry.
- [x] Search normalizes Unicode, punctuation, spacing, Indian phone prefixes, email case, and member-code punctuation.
- [x] Directory queries omit photo BLOBs and note bodies.
- [x] Notes are append-only from the profile form and member changes append audit events.
- [x] Optional photos are center-cropped, resized to 256×256, JPEG-compressed, size-capped, stored as database BLOBs, and removed from temporary storage after processing.
- [x] Plan/member writes, notes, media, and audit entries use exclusive transactions to prevent partial records.
- [x] Archive/restore and plan deactivation preserve records and history.
- [x] English and Hindi cover every Phase 2 screen with matching interpolation placeholders.
- [x] Phone and tablet shells follow the supplied mint/white/evergreen visual system, 8-point spacing, minimum 48 dp targets, bottom navigation, and tablet rail/master-detail layouts.
- [x] Deferred payments, memberships, import, and export are visibly unavailable and do not leak later-phase behavior.

## Device acceptance still required

- [ ] Measure 10,000-member search and photo-backed directory behavior on the minimum Android reference device.
- [ ] Verify image orientation, crop quality, replacement, and temporary-file cleanup with camera/gallery images on Android.
- [ ] Verify SQLCipher at-rest evidence for member rows and `member_media` in a GymVito development build; Expo Go is not security evidence.
- [ ] Run interrupted-save/process-death scenarios for plan and member writes on Android.
- [ ] Review narrow phone, tablet split-pane, Hindi, large-text, keyboard, and screen-reader behavior against `docs/design/`.
- [ ] Exercise all plan and member flows manually on a physical Android device, including archive/restore and collision warnings.
