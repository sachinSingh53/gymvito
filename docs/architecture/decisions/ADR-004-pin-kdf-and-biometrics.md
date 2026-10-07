# ADR-004: PIN KDF and biometric fallback

Status: Accepted provisionally; reference-device calibration pending

Use native Argon2id through `react-native-argon2` 4.0.0 with a random 128-bit salt, 32 MiB memory, three iterations, parallelism one, and a 32-byte output. Store the versioned verifier and parameters, never the PIN. Phase 0 measures creation time on device; adjust parameters if reference-device latency is outside roughly 250–750 ms.

Biometrics are convenience only. Cancellation, failure, unavailable hardware, or enrollment change returns to PIN. The SQLCipher key is not biometric-bound.

Expo Go cannot load this native KDF. ADR-010 defines a clearly labelled, synthetic-data-only compatibility verifier; it is not production-equivalent evidence and does not change this native-build decision.
