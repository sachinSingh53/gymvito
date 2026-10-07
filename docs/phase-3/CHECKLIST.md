# Phase 3 checklist

## Implemented

- [x] MSH-01: enrollment previews the selected plan, inclusive local dates, projected price/admission/discount/tax total, payment-not-recorded state, and resulting membership status before confirmation.
- [x] MSH-02: owner-authorized start/end/price/discount overrides require and retain a reason; all monetary values remain integer minor units.
- [x] MSH-03/04: renewal can use the same or another active plan and creates a new membership linked to the preserved prior membership.
- [x] MSH-05: inclusive date overlap is previewed and finalization requires explicit acknowledgment.
- [x] MSH-10: membership and member status are derived from saved date-only values and the current device-local date, refreshed on foreground, time-zone change, and local-day rollover.
- [x] MSH-11: member profiles show chronological membership history and lifecycle events.
- [x] Migration 4 adds `membership`, `membership_event`, foreign keys, constraints, immutable snapshots, operation identifiers, and status/date indexes.
- [x] A populated Phase 2 schema fixture upgrades through migration 4 without changing existing member data.
- [x] Enrollment/renewal, the required lifecycle event, and audit entry use one exclusive transaction.
- [x] A unique local operation identifier makes repeated confirmation after a committed response idempotent and rejects reuse with conflicting terms.
- [x] Repository tests simulate a failure between membership and event writes and prove the transaction leaves neither record.
- [x] Plan edits/deactivation after finalization do not change saved membership terms.
- [x] Current membership selection is deterministic when explicitly acknowledged memberships overlap.
- [x] Member directory filters/cards, member profile, and Home use the shared status projection rather than screen-owned status.
- [x] English and Hindi contain matching Phase 3 status, preview, overlap, history, and timeline resources.
- [x] Phone and tablet UI follows `docs/design/`: mint canvas, white outlined cards, evergreen pill actions, status chips, subscription progress, history timelines, 48 dp targets, bottom navigation, and tablet master-detail.
- [x] Payment collection, receipts, check-in/attendance, cloud sync, and cancellation controls remain outside Phase 3.

## Deferred by the phase contract

- [ ] Invoice/payment persistence and receipts arrive in Phase 4; Phase 3 only stores snapshotted commercial terms and shows a payment-not-recorded notice.
- [ ] Complete production backup/restore inclusion arrives in Phase 5. Migration 4 will be included automatically by the database-level format, but this is not production backup acceptance evidence.
- [ ] Cancellation, freeze/resume, upgrade/downgrade, and correction UI remain Release 1 work even though the schema/event vocabulary is forward-compatible.

## Physical-device acceptance still required

- [ ] Exercise enrollment, immediate renewal, scheduled renewal, overlap acknowledgment, and double-tap/retry on an Android development build.
- [ ] Force-stop before, during, and immediately after confirmation and verify no partial or duplicate membership on the device database.
- [ ] Keep the app open across local midnight and change the device time zone; verify views refresh without rewriting stored dates.
- [ ] Review narrow phone, tablet master-detail, Hindi, large text, keyboard, TalkBack, and contrast behavior against `docs/design/screens/member_profile` and `docs/design/screens/tablet_member_profile_ledger`.
- [ ] Verify SQLCipher at-rest evidence for membership terms and event reasons. Expo Go remains plaintext and synthetic-data-only.
- [ ] Exercise low-storage/database-full behavior and confirm the localized failure state does not claim success.
