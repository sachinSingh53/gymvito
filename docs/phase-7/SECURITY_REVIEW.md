# Phase 7 Security and Privacy Review

## Reviewed controls

| Area            | Implemented control                                                                                                                                                     | Remaining acceptance                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Database        | SQLCipher is enabled in native configuration; the device key is stored through SecureStore and never placed in application settings.                                    | Verify ciphertext and hardware-backed key behavior on production Android hardware.        |
| Owner PIN       | Native builds use Argon2id verification, rate limiting, inactivity lock, optional biometric fallback, and PIN reauthentication for sensitive actions.                   | Exercise lockout, biometric-state changes, process death, and reboot on device.           |
| Screen privacy  | Screen capture is prevented; iOS app-switcher protection is platform-gated.                                                                                             | Verify Android recent-app behavior on supported OS versions.                              |
| Backup/restore  | Backups use an independent passphrase, integrity metadata, candidate validation, a safety copy, and coordinated atomic replacement.                                     | Run encrypted schema-fixture round trips and interruption injection on SQLCipher devices. |
| Export/share    | Owner PIN and a privacy warning precede exports; cache artifacts are deleted after the system share flow.                                                               | Verify cancellation, denied destinations, low storage, and provider failure.              |
| Logs            | Diagnostics use bounded local codes and exclude PINs, keys, member details, and financial records. Source fixtures are scanned for realistic personal data and secrets. | Inspect Android logs during all acceptance journeys.                                      |
| Network         | Runtime source imports are checked against the no-operational-backend boundary; no analytics, advertising, or remote crash SDK is declared.                             | Confirm airplane-mode behavior and inspect release traffic.                               |
| Permissions     | Broad Android storage permissions are blocked; document-provider/share flows are user initiated.                                                                        | Review generated production manifest and denial behavior.                                 |
| Reset/uninstall | Delete-all requires owner PIN, backup acknowledgement, and typed confirmation; setup and Help & Privacy warn about uninstall/reset loss.                                | Verify removal of database, WAL/SHM, and key material on device.                          |

## Local conclusion

No open code-level critical finding was identified in the reviewed Phase 7 scope. The live registry audit reported no critical advisory; two high and three moderate transitive findings are dispositioned in `DEPENDENCY_REVIEW.md`. This is not production security approval: the native and physical-device checks in the table remain release-blocking.
