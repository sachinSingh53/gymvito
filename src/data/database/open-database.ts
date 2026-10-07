import { File } from 'expo-file-system';
import { defaultDatabaseDirectory, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { UnsupportedDatabaseError } from '@/domain/errors/foundation-errors';
import {
  getRuntimeCapabilities,
  type DatabaseSecurityMode,
} from '@/platform/runtime/runtime-capabilities';
import { getOrCreateDatabaseKey } from '@/platform/secure-storage/database-key';

import { applyDatabaseKey } from './apply-key';
import {
  DATABASE_APPLICATION_ID,
  DATABASE_BUSY_TIMEOUT_MS,
  DATABASE_NAME,
} from './database-constants';
import { migrations } from './migrations';
import { runMigrations } from './run-migrations';
import { FoundationRepository } from '../repositories/foundation-repository';

type PragmaNumber = { application_id?: number; user_version?: number };
type IntegrityResult = { quick_check: string };

export type OpenedDatabase = Readonly<{
  database: SQLiteDatabase;
  key: string | null;
  databaseSecurityMode: DatabaseSecurityMode;
  schemaVersion: number;
  developmentRestartCount: number;
}>;

export function databaseFile(): File {
  return new File(defaultDatabaseDirectory, DATABASE_NAME);
}

export async function openGymVitoDatabase(): Promise<OpenedDatabase> {
  const capabilities = getRuntimeCapabilities();
  const key = capabilities.isExpoGo ? null : await getOrCreateDatabaseKey(databaseFile().exists);
  const database = await openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });

  try {
    if (key) await applyDatabaseKey(database, key);
    await database.getFirstAsync('SELECT count(*) AS count FROM sqlite_master');
    await database.execAsync(`
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS};
      PRAGMA journal_mode = WAL;
    `);

    const appId = await database.getFirstAsync<PragmaNumber>('PRAGMA application_id');
    if ((appId?.application_id ?? 0) === 0) {
      await database.execAsync(`PRAGMA application_id = ${DATABASE_APPLICATION_ID}`);
    } else if (appId?.application_id !== DATABASE_APPLICATION_ID) {
      throw new UnsupportedDatabaseError('The database belongs to another application.');
    }

    const versionBefore = await database.getFirstAsync<PragmaNumber>('PRAGMA user_version');
    const latestVersion = migrations.at(-1)?.id ?? 0;
    if ((versionBefore?.user_version ?? 0) > latestVersion) {
      throw new UnsupportedDatabaseError('This database was created by a newer GymVito build.');
    }

    await runMigrations(database);
    const integrity = await database.getFirstAsync<IntegrityResult>('PRAGMA quick_check(1)');
    if (integrity?.quick_check !== 'ok') {
      throw new UnsupportedDatabaseError('Database integrity check failed.');
    }

    const versionAfter = await database.getFirstAsync<PragmaNumber>('PRAGMA user_version');
    const developmentRestartCount = __DEV__
      ? await new FoundationRepository(database).recordDevelopmentRestart()
      : 0;
    return {
      database,
      key,
      databaseSecurityMode: capabilities.databaseSecurityMode,
      schemaVersion: versionAfter?.user_version ?? 0,
      developmentRestartCount,
    };
  } catch (error) {
    await database.closeAsync().catch(() => undefined);
    throw error;
  }
}
