# Preview APK builds

Use the EAS `preview` profile for periodic, standalone phase acceptance on a physical Android device. Expo builds the APK in the cloud, so Android Studio and a local Android SDK are not required.

## Project link and workstation setup

GymVito is linked to the Expo project [`@sachin_53/gymvito`](https://expo.dev/accounts/sachin_53/projects/gymvito). The non-secret EAS project ID is checked into `app.json`, and `app.config.ts` preserves it in every environment.

On a new development workstation, run:

```sh
pnpm install --frozen-lockfile
pnpm eas:login
```

Sign in with an Expo account that has access to the linked project. Do not run `pnpm eas:init` again unless the app is intentionally moved to another EAS project.

When intentionally relinking the app, keep the project ID in `app.json` like this:

```json
{
  "expo": {
    "extra": {
      "environment": "development",
      "runtimeBackend": "none",
      "eas": {
        "projectId": "8e0a98d9-0004-460c-9c15-cb8a3bc3c10f"
      }
    }
  }
}
```

`app.config.ts` preserves that `extra.eas` object in every environment.

## Verified install artifacts

The first verified builds are available from their EAS build pages:

- [Development client, build 1](https://expo.dev/accounts/sachin_53/projects/gymvito/builds/dd116508-2aec-4892-bee7-81be991e68d4) for Metro and Fast Refresh.
- [Standalone preview, build 3](https://expo.dev/accounts/sachin_53/projects/gymvito/builds/73d6dd52-b7c3-41b9-834e-04c7cdb0f8cf) for phase acceptance without Metro.

Local verified copies are stored in the ignored `dist/` directory as `gymvito-development-v0.0.1-build1.apk` and `gymvito-preview-v0.0.1-build3.apk`.

## Build and install a standalone APK

Run:

```sh
pnpm build:android:preview
```

The `preview` profile:

- produces an APK through EAS cloud infrastructure;
- uses application ID `com.gymvito.app.preview`;
- embeds the JavaScript bundle, so Metro is not required;
- uses internal distribution for direct device installation;
- lets EAS manage and increment Android version codes remotely;
- reuses the EAS-managed Android signing credentials for later updates.

When the build finishes, open the printed EAS URL or QR code on the Android device, download the APK, allow installation from the browser when prompted, and install it.

For each phase, run the same build command and install the new APK over the existing GymVito Preview installation. Preserve test data by using the same EAS project and signing key, and do not uninstall the app or clear its storage.

## Development build versus preview APK

| Build              | Command                          | Metro required |         Phase 0 native harness |
| ------------------ | -------------------------------- | -------------: | -----------------------------: |
| Development client | `pnpm build:android:development` |            Yes |                            Yes |
| Standalone preview | `pnpm build:android:preview`     |             No | No; production routes are used |

After installing a development-client APK, put the phone and computer on the same network, run `pnpm start:dev-client` on the computer, and open GymVito Development on the phone. Rebuild the development client only when native dependencies or Expo config change; ordinary TypeScript changes use Fast Refresh. The default `pnpm start` command targets Expo Go instead.

The Phase 0 technical harness is guarded by `__DEV__` and intentionally excluded from standalone preview UI. Preview APKs are for testing completed user-facing phase flows.

## Data and security boundaries

- Expo Go is the routine-development compatibility runtime, uses plaintext SQLite, and must contain synthetic data only.
- Preview uses the same SQLCipher, SecureStore, Argon2id, backup, and no-direct-network architecture as production.
- Expo Go, preview, and development installations have isolated storage; preview and development also use different application IDs.
- Never publish the preview APK to an app store.
- Do not share the EAS build URL outside the intended test group.
