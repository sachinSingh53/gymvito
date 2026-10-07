# ADR-010: Expo Go development-only PIN verifier

Status: Accepted for synthetic-data development only

## Decision

Native GymVito builds continue to create and verify owner PINs with Argon2id using the parameters in ADR-004. Expo Go cannot load `react-native-argon2`, so its isolated compatibility database uses PBKDF2-HMAC-SHA-256 from `@noble/hashes` with a random 128-bit salt, 120,000 iterations, and a 32-byte output.

The serialized verifier includes the algorithm name `pbkdf2-sha256-development-only`. The runtime selects this algorithm only when `Constants.appOwnership` identifies Expo Go. Verification dispatches from the persisted algorithm, so an Expo Go verifier is never represented as Argon2id.

## Consequences

- The complete onboarding, persistence, lockout, and unlock UI can be developed in Expo Go.
- Expo Go remains synthetic-data-only. Its plaintext database and PBKDF2 verifier provide no production security acceptance evidence.
- Development, preview, and production builds require native Argon2id and SQLCipher.
- Data is already isolated by application identity. Moving an Expo Go compatibility database into a native GymVito installation is unsupported.
- Any future change to the native KDF requires a separate security review and migration design.

## Rationale

The product requires Expo Go for routine development, while the production security contract requires a memory-hard native KDF. An explicitly labelled compatibility verifier supports the development workflow without silently weakening or misdescribing the native build.
