# Phase 0 dependency review

Reviewed: 2026-10-02 with `pnpm audit --json`

The dependency set is locked, but the registry currently reports three transitive advisories. None has a compatible direct upgrade supplied by Expo SDK 57 at this review date.

| Severity | Advisory            | Path                                                | Runtime reachability and disposition                                                                                                                                                                                                                                                                         |
| -------- | ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| High     | GHSA-86w9-cpqp-85rv | `expo > @expo/cli > node-forge`                     | Expo CLI/build tooling; it is not in the exported Android application bundle. The registry reports no patched `node-forge` version. Do not use untrusted signing material with the local CLI; monitor Expo/node-forge and upgrade immediately when a supported fix lands.                                    |
| Moderate | GHSA-w5hq-g745-h8pq | `expo > @expo/config-plugins > xcode > uuid`        | CNG/Xcode build tooling. GymVito does not call the affected UUID buffer APIs. Monitor Expo config-plugin updates.                                                                                                                                                                                            |
| Moderate | GHSA-vcc3-ghjq-m6fr | `expo-router > query-string > decode-uri-component` | Potential malformed-query CPU denial of service. Phase 0 exposes no product deep-link flow and no web build; no external Android intent filter is configured after removal of the custom scheme. Add length limits before any future reviewed deep-link adapter and upgrade with Expo Router when available. |

Do not force incompatible transitive overrides: major-version overrides for `uuid` or `decode-uri-component` could break Expo tooling/router behavior, and no fixed `node-forge` version exists according to the registry. Re-run the audit before every native release. These findings do not expose member data to a network because the application has no business network client, but the high build-tool advisory remains an explicit release review item.

## Android compatibility patch

`react-native-argon2` 4.0.0 still declares the removed Gradle `jcenter()` repository. The reproducible pnpm patch in `patches/react-native-argon2@4.0.0.patch` replaces only that repository declaration with `mavenCentral()`. A clean frozen install applied the patch, and EAS build `73d6dd52-b7c3-41b9-834e-04c7cdb0f8cf` compiled the native Argon2 module successfully. Reassess and remove the patch when upgrading `react-native-argon2`.
