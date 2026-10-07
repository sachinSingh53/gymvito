# ADR-009: Expo Go development runtime

Status: Accepted

## Decision

Expo Go is the default runtime for routine UI and product development. `pnpm start` explicitly passes Expo CLI's `--go` mode and presents an Expo Go-compatible QR code. `pnpm start:dev-client` remains available for the GymVito development client.

The app detects Expo Go through `Constants.appOwnership`. In Expo Go it opens the SDK-bundled SQLite database without applying a SQLCipher key and does not load or run the SQLCipher/Argon2id native security path. Phase 1 PIN flows use the explicitly development-only verifier described in ADR-010.

GymVito development, preview, and production builds retain SQLCipher, SecureStore key management, Argon2id, encrypted backup/restore, and the existing native configuration. Expo Go data is held in the Expo Go sandbox and is not shared with those installed apps.

## Consequences

- Developers can install Expo Go, scan the Metro QR code, and work without building a custom client.
- Only synthetic data may be used in Expo Go because its GymVito SQLite database is not encrypted with SQLCipher.
- Expo Go validates compatible UI, localization, migrations, persistence, lock-state behavior, PDF, sharing, and document-picker work. It does not establish encryption, wrong-key rejection, Argon2id, production PIN security, encrypted backup/restore, application identity, icons, permissions, or release behavior.
- Native development or preview builds remain mandatory for security proofs and release acceptance.
- Any new dependency must identify whether it is bundled in Expo Go. Native-only code must stay behind an explicit runtime capability boundary and retain a native-build test path.

## Rationale

Expo Go has a fixed native runtime. Expo SQLite is included, but its SQLCipher option and the third-party `react-native-argon2` module require a custom native build. A deliberate compatibility mode gives the project the requested low-friction development loop without weakening or falsely claiming the production security model.
