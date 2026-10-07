import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(
  readFileSync(new URL('../src/data/database/migrations/manifest.json', import.meta.url), 'utf8'),
);

let previous = 0;
for (const migration of manifest) {
  if (!Number.isSafeInteger(migration.id) || migration.id !== previous + 1) {
    throw new Error(`Migration order is invalid at ${migration.id}.`);
  }
  const checksum = createHash('sha256').update(migration.sql).digest('hex');
  if (checksum !== migration.checksum) {
    throw new Error(`Migration ${migration.id} checksum mismatch: ${checksum}`);
  }
  previous = migration.id;
}
console.log(`Validated ${manifest.length} ordered migration(s).`);
