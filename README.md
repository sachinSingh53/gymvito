# GymVito

GymVito is a local-first Expo application. Phase 0 established the encrypted native foundation; Phase 1 added the guarded, localized owner shell; Phase 2 adds membership plans and a searchable, auditable member directory with encrypted-database profile photos.

## Toolchain

- Node 22.23.1 (`.nvmrc` and `.node-version`)
- pnpm 10.21.0
- Expo 57.0.26 / React Native 0.86.3 / React 19.2.3
- Java 17
- Android SDK 36, Build Tools 36.0.0, minimum Android API 28

## Install and validate

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm validate
```

## Run in Expo Go

Expo Go is the default runtime for routine UI and product development:

```sh
cp .env.example .env
pnpm start
```

Install the Expo Go app on a phone, keep the phone and workstation on the same network, and scan the QR code printed by Expo. Press `a` instead when an Android emulator with Expo Go is already running.

Expo Go uses its bundled, unencrypted SQLite implementation because SQLCipher and `react-native-argon2` require custom native code. The app detects Expo Go, skips database keying, and uses a clearly marked development-only PBKDF2 PIN verifier so the Phase 1 flow can be tested. Use synthetic test data only: Expo Go storage is isolated from GymVito development, preview, and production installations but does not prove the production security model.

## Native Android security development build

Use a GymVito development build for SQLCipher, encrypted backup/restore, Argon2id, or native security acceptance. These production-shaping capabilities cannot run inside Expo Go.

1. Install Android Studio, Android SDK Platform 36, Build Tools 36.0.0, Platform Tools, and an API 28-or-newer emulator image.
2. Point `ANDROID_HOME` and `ANDROID_SDK_ROOT` to the installed SDK, for example `/Users/yourname/Library/Android/sdk`, and add its `platform-tools` and `emulator` directories to `PATH`.
3. Start an emulator or connect a USB-debugging device.
4. Run:

```sh
cp .env.example .env
pnpm prebuild
pnpm android:device
pnpm start:dev-client
```

Continuous Native Generation owns `android/` and `ios/`; do not hand-edit generated projects. Android development signing uses the generated debug keystore. Production signing is deliberately not checked in.

The development build uses SQLCipher and native Argon2id for the production-shaped Phase 1 flow. Phase 0 proof helpers remain under `src/testing/phase0`; they are not mounted in production routes.

## Device E2E

Install [Maestro](https://maestro.mobile.dev/) and run:

```sh
maestro test .maestro/phase0-smoke.yaml
```

The app ID is `com.gymvito.app.development`. Use `GYMVITO_ENV=production` only for intentional production artifacts.

See [Phase 0 evidence](docs/phase-0/EVIDENCE.md) for verified and device-pending gates.
See [Phase 1 evidence](docs/phase-1/EVIDENCE.md) for the implemented scope, local validation, and remaining physical-device checks.
See [Phase 2 evidence](docs/phase-2/EVIDENCE.md) for plan/member implementation proof and the remaining reference-device checks.

## Standalone phase-testing APK

For an installable APK that runs without Android Studio or Metro, follow [Preview APK builds](docs/PREVIEW_APK.md). The short path is:

```sh
pnpm eas:login
pnpm build:android:preview
```

The app is already linked to `@sachin_53/gymvito`; run `pnpm eas:init` only when intentionally moving it to another Expo project.

For encrypted development without Android Studio, install the development-client APK once, run `pnpm start:dev-client`, and open GymVito Development on the phone. Ordinary TypeScript changes then use Fast Refresh; rebuild the client only after native dependency or Expo configuration changes.

The runtime policy and its security boundary are recorded in [ADR-009](docs/architecture/decisions/ADR-009-expo-go-development-runtime.md). The development-only PIN compatibility decision is recorded in [ADR-010](docs/architecture/decisions/ADR-010-expo-go-pin-verifier.md).
