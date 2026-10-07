# ADR-005: Profile-photo storage

Status: Accepted provisionally; physical benchmark pending

Resize avatars to 256×256 JPEG at approximately 72% quality and store them as encrypted SQLite BLOBs. Directory/list queries must omit the BLOB column. The development harness measures 10,000 rows, database peak size, insert time, and list latency, then cleans the fixture.

Retain this design if the reference device remains responsive and backup size/runtime are acceptable. Otherwise stop before Phase 2 and adopt separately encrypted private media with a versioned backup container; plaintext media is not a fallback.
