# Phase 0 evidence

Date: 2026-10-02

## Local evidence

Verified in this checkout on 2026-10-02:

| Check                                                                                  | Result                                                                                                                                                                        |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                                                       | Passed with TypeScript strict mode.                                                                                                                                           |
| `pnpm lint`                                                                            | Passed Expo ESLint plus network and architecture boundary scripts.                                                                                                            |
| `pnpm validate:migrations`                                                             | One ordered migration; SHA-256 matches.                                                                                                                                       |
| `pnpm validate:translations`                                                           | 20 keys match across English and Hindi.                                                                                                                                       |
| `pnpm validate:eas`                                                                    | Development-client and standalone preview profiles resolve to internal APK builds with isolated environments; preview version codes auto-increment remotely.                  |
| `pnpm scan:fixtures`                                                                   | No detected secret, private key, realistic email, or Indian phone fixture.                                                                                                    |
| `pnpm test:ci`                                                                         | 3 suites, 24 tests passed, including Expo Go/native runtime capability selection; global collected coverage 92.85% statements, 100% branches, 86.66% functions, 92.75% lines. |
| `pnpm expo:doctor --verbose`                                                           | 21/21 checks passed with live Expo/React Native metadata.                                                                                                                     |
| `pnpm expo config --type public`                                                       | Development IDs and native config resolve.                                                                                                                                    |
| `GYMVITO_ENV=preview pnpm expo config --type public`                                   | Preview config resolves to `GymVito preview` and Android package `com.gymvito.app.preview`.                                                                                   |
| `pnpm expo prebuild --platform android --clean --no-install`                           | Passed. Generated properties contain SQLCipher enabled, API 28 minimum, API 36 compile/target, and `allowBackup=false`; legacy broad storage permissions are removed.         |
| Expo module/RN autolinking inspection                                                  | `expo-sqlite`, SecureStore, FileSystem, Localization, Print, and `react-native-argon2` resolve for Android.                                                                   |
| `pnpm expo export --platform android --output-dir /tmp/gymvito-expo-go-export --clear` | Passed; the Android Hermes bundle and 31 assets were produced after the Expo Go compatibility change.                                                                         |
| `pnpm start`                                                                           | Metro started in explicit Expo Go mode, printed an `exp://` URL and QR code, and reported `Using Expo Go`; the server was then stopped cleanly.                               |
| `pnpm audit --json`                                                                    | One high build-tool and two moderate transitive advisories; reachability and mitigations are recorded in `DEPENDENCY_REVIEW.md`.                                              |

The workspace has no `.git` directory, so Husky reported that hooks could not be installed here. The hook file and `prepare` script are committed-ready and activate after this tree is placed in a Git checkout.

## EAS Android build evidence

Verified on 2026-10-02:

| Check                | Result                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EAS project          | Linked to [`@sachin_53/gymvito`](https://expo.dev/accounts/sachin_53/projects/gymvito), project ID `8e0a98d9-0004-460c-9c15-cb8a3bc3c10f`.                                                                                      |
| Preview build        | [Build `73d6dd52-b7c3-41b9-834e-04c7cdb0f8cf`](https://expo.dev/accounts/sachin_53/projects/gymvito/builds/73d6dd52-b7c3-41b9-834e-04c7cdb0f8cf) finished for `com.gymvito.app.preview`, version `0.0.1`, version code `3`.     |
| Development build    | [Build `dd116508-2aec-4892-bee7-81be991e68d4`](https://expo.dev/accounts/sachin_53/projects/gymvito/builds/dd116508-2aec-4892-bee7-81be991e68d4) finished for `com.gymvito.app.development`, version `0.0.1`, version code `1`. |
| Preview APK archive  | `dist/gymvito-preview-v0.0.1-build3.apk`, 148,875,794 bytes; ZIP integrity passed; SHA-256 `9bc53d5fc1308ac1ef4b0164dbf3ec2bfa70a030dac7aeeb9055e538082cd488`.                                                                  |
| Development APK      | `dist/gymvito-development-v0.0.1-build1.apk`, 311,136,460 bytes; ZIP integrity passed; SHA-256 `69980a4de3bb051936384513bde12b6e6b87547b164c17d2517a707995f1aa2d`.                                                              |
| Native contents      | APK contains the Hermes bundle plus ARM64 `libexpo-sqlite.so`, `libargon2jni.so`, and `libargon2native.so`; an APK signing block is present.                                                                                    |
| Argon2 Gradle repair | The pnpm patch replacing obsolete `jcenter()` with `mavenCentral()` survived a clean frozen install and allowed the native Argon2 module to compile.                                                                            |

This establishes successful cloud compilation and artifact creation. Installation, launch, and behavior on a physical Android device remain device acceptance work.

## Native proof report

The development-only harness returns and displays:

- backup SHA-256;
- schema, record count, money total, and media hash before/after restore;
- wrong-key, wrong-passphrase, corrupted-file, and interrupted-restore results;
- 10,000-avatar insert latency, first-page list latency, avatar size, and database peak size;
- Argon2id duration;
- current locale, calendar, and time zone.

Capture the JSON/report and device identity here after running it on each reference device.

## Not established by local checks

- Successful Android install, launch, and relaunch on a physical device.
- Successful QR scan and interactive GymVito launch in Expo Go on a physical device; Metro startup and bundling are verified locally.
- SQLCipher plaintext inspection on the actual device filesystem.
- Native `sqlcipher_export` behavior on Android.
- SecureStore persistence across kill/restart and missing-key recovery on Android.
- Hindi glyph shaping and printed/PDF visual acceptance on target viewers/printers.
- Share sheet, document provider, and print cancellation behavior.
- Maestro execution, low-storage behavior, and physical-device performance.

The current machine cannot run those device checks locally: `ANDROID_HOME` points to `/Users/sachinsingh/Library/Android/sdk`, which does not exist; Android Studio, `adb`, and `sdkmanager` are absent. The EAS project is linked and signed preview and development-client APKs have been built successfully, so remaining Android acceptance can be performed by installing the artifacts directly on a physical device.

Phase 0 is not exit-gate complete until these are recorded without unresolved blockers.
