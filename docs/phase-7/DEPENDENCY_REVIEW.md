# Phase 7 Dependency and License Review

Date: 2026-10-09 (Asia/Kolkata)

## Lock and licenses

- CI installs with `pnpm install --frozen-lockfile`.
- `scripts/review-direct-licenses.mjs` checked 51 direct runtime/development packages.
- Direct licenses are MIT, Apache-2.0, ISC/BSD-family, or reviewed font composites (`MIT AND OFL-1.1`, `MIT AND Apache-2.0`).
- No advertising, telemetry, or remote crash-reporting dependency is declared.

## Live registry audit

Command:

```sh
pnpm audit --prod --json
```

Result: 0 critical, 2 high, 3 moderate advisories across 763 packages.

| Severity | Package and path                                                                              | Disposition                                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | `expo > @expo/cli > node-forge` (`GHSA-86w9-cpqp-85rv`)                                       | Expo build/CLI path; audit reports no patched version. GymVito does not import it at runtime. Monitor Expo SDK releases and re-audit before signing.                 |
| High     | `expo > @expo/metro > metro-file-map > micromatch > braces` (`GHSA-vfj7-8cjw-p6xm`)           | Metro build-tool path; audit reports no patched version. Untrusted brace patterns are not accepted by the app. Monitor Expo/Metro releases.                          |
| Moderate | `expo > @expo/config-plugins > xcode > uuid` (`GHSA-w5hq-g745-h8pq`)                          | Native configuration tool path; vulnerable buffered v3/v5/v6 APIs are not used by GymVito runtime identifiers. Monitor Expo update.                                  |
| Moderate | `expo-router > query-string > decode-uri-component` (`GHSA-vcc3-ghjq-m6fr`)                   | Runtime transitive URL decoder. GymVito routes do not accept remote/unbounded query payloads; retain route input bounds and update with Expo Router when compatible. |
| Moderate | `expo-router > @testing-library/react-native > jest ... > sprintf-js` (`GHSA-hp3w-g68c-fv3c`) | Test/tooling chain; no user-controlled format strings in the application runtime.                                                                                    |

## Release disposition

The Phase 7 critical-severity gate passes because the registry reported zero critical advisories. The high/moderate transitive findings remain documented and must be rechecked immediately before the signed build. Forced package overrides were not added because the audit reports no patched versions for the high findings and bypassing the Expo SDK dependency set would create unverified native/build compatibility risk.
