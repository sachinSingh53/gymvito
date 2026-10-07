import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';

const migrations = JSON.parse(
  readFileSync(new URL('../src/data/database/migrations/manifest.json', import.meta.url), 'utf8'),
);
const database = new DatabaseSync(':memory:');
for (const migration of migrations) database.exec(migration.sql);

const insert = database.prepare(
  `INSERT INTO member(
     id, member_code, normalized_member_code, name, normalized_name, phone,
     normalized_phone, email, normalized_email, created_at_utc, updated_at_utc
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
database.exec('BEGIN');
for (let index = 1; index <= 10_000; index += 1) {
  const suffix = String(index).padStart(5, '0');
  const name = index % 50 === 0 ? `अमित Sharma ${suffix}` : `Member ${suffix}`;
  const phone = `98${String(index).padStart(8, '0')}`;
  const email = `member${suffix}@example.com`;
  insert.run(
    `member-${suffix}`,
    `GV-${suffix}`,
    `GV${suffix}`,
    name,
    name.toLocaleLowerCase('en-US'),
    phone,
    phone,
    email,
    email,
    '2026-10-07T00:00:00.000Z',
    '2026-10-07T00:00:00.000Z',
  );
}
database.exec('COMMIT');

const searches = [
  ['name', 'member 09999'],
  ['unicode', 'अमित'],
  ['phone', '9800009999'],
  ['email', 'member09999@example.com'],
  ['code', 'GV09999'],
];
const statement = database.prepare(
  `SELECT id, member_code, name, phone, email
   FROM member
   WHERE normalized_name LIKE ? OR normalized_phone LIKE ? OR
     normalized_email LIKE ? OR normalized_member_code LIKE ?
   ORDER BY updated_at_utc DESC, normalized_name
   LIMIT 100`,
);
const started = performance.now();
for (const [, value] of searches) {
  statement.all(
    `%${value}%`,
    `%${value}%`,
    `%${value}%`,
    `%${value.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase()}%`,
  );
}
const durationMs = performance.now() - started;
if (database.prepare('SELECT COUNT(*) AS count FROM member').get().count !== 10_000) {
  throw new Error('Phase 2 benchmark fixture count is invalid.');
}
if (durationMs > 1_000) {
  throw new Error(`Phase 2 search benchmark exceeded 1000 ms: ${durationMs.toFixed(1)} ms`);
}
database.close();
console.log(
  `Phase 2 10k-member benchmark passed: ${searches.length} searches in ${durationMs.toFixed(1)} ms.`,
);
