# ADR-001: Toolchain and Android baseline

Status: Accepted for Phase 0

Use Expo SDK 57.0.26, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3, Node 22.23.1, pnpm 10.21.0, and Java 17. Android is first, with API 28 minimum and API 36 compile/target. The controlled emulator is a Pixel 3a API 28 profile with 4 GB RAM; the physical reference is a 4 GB Samsung Galaxy A12-class device on Android 11, with at least 2 GB free app storage.

Generated native projects are CNG output. Expo Go is supported for routine development through the compatibility mode defined in ADR-009. SQLCipher and other custom native capabilities remain available only in GymVito development, preview, and production builds.
