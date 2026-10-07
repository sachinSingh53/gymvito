import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { UnsupportedDatabaseError } from '@/domain/errors/foundation-errors';

import { migrations } from './migrations';

type AppliedMigration = { id: number; name: string; checksum: string };

export async function runMigrations(database: SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at_utc TEXT NOT NULL
    );
  `);

  const applied = await database.getAllAsync<AppliedMigration>(
    'SELECT id, name, checksum FROM schema_migrations ORDER BY id',
  );
  const appliedById = new Map(applied.map((migration) => [migration.id, migration]));

  for (const migration of migrations) {
    const actualChecksum = await digestStringAsync(CryptoDigestAlgorithm.SHA256, migration.sql);
    if (actualChecksum !== migration.checksum) {
      throw new UnsupportedDatabaseError(
        `Migration ${migration.id} checksum does not match source.`,
      );
    }

    const prior = appliedById.get(migration.id);
    if (prior) {
      if (prior.name !== migration.name || prior.checksum !== migration.checksum) {
        throw new UnsupportedDatabaseError(`Released migration ${migration.id} was modified.`);
      }
      continue;
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(migration.sql);
      await transaction.runAsync(
        'INSERT INTO schema_migrations(id, name, checksum, applied_at_utc) VALUES (?, ?, ?, ?)',
        migration.id,
        migration.name,
        migration.checksum,
        new Date().toISOString(),
      );
      await transaction.execAsync(`PRAGMA user_version = ${migration.id}`);
    });
  }
}
