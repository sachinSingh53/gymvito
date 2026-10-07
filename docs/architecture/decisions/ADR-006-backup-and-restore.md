# ADR-006: `.gymvito` backup and atomic restore

Status: Accepted provisionally; Android SQLCipher proof pending

A `.gymvito` file is a SQLCipher database exported with `ATTACH ... KEY` and `sqlcipher_export`, protected by a user passphrase. SQLCipher owns passphrase salting/KDF. A manifest stores format/schema/app versions, timestamp, device presentation context, gym identity, currency, counts, money total, media hash, and integrity result.

Creation checkpoints WAL, exports, independently opens the result, reconciles contents, and hashes the artifact before it can be reported successful. Restore validates before replacement, exports under the current device key, verifies a candidate, takes a safety copy, closes handles, replaces the live file, reopens/reconciles, and rolls back on error. Passphrase PRAGMA escaping is isolated because SQLite does not bind PRAGMA values; the secret is never logged.

Third-party document providers are acceptable only when the owner explicitly selects them. Support the current schema and at least two prior public schema versions after release.
