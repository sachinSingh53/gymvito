# ADR-003: Direct repositories and migrations

Status: Accepted

Use typed direct Expo SQLite repositories rather than an ORM. Business SQL belongs in repositories; database lifecycle SQL belongs in the database layer and backup-specific system SQL in the backup adapter. Every migration is ordered, immutable, SHA-256 checked, transactionally applied, and represented in both `PRAGMA user_version` and `schema_migrations`.

This minimizes native dependencies and keeps transaction boundaries explicit.
