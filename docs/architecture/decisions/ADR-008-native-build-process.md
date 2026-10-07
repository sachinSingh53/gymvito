# ADR-008: Native build process

Status: Accepted; development-runtime choice amended by ADR-009

Local Android development builds remain available through CNG prebuild followed by `expo run:android`. EAS provides two checked-in internal-distribution profiles: `development` creates a development-client APK for Metro/Fast Refresh, while `preview` creates a standalone APK for periodic phase acceptance on physical devices without Android Studio. EAS manages and increments Android version codes so a newly signed preview APK can update an earlier installation. EAS is optional engineering distribution infrastructure, not a released-app runtime dependency, and OTA updates are not configured.

ADR-009 makes Expo Go the default routine-development runtime. This does not replace native builds for security or release acceptance.

The MVP defaults to owner-only product flows, A4 and 80 mm receipt qualification, explicit user-selected document providers, a 12-character minimum backup passphrase warning, and no remote recovery. The launch assumption is India/INR with two minor digits; tax is disabled by default and later owner-configurable rather than represented as automatic GST compliance. Product/legal review must confirm tax and fiscal-receipt obligations before billing release.
