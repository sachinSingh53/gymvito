import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { defaultDatabaseDirectory, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { applyDatabaseKey } from '@/data/database/apply-key';
import {
  BACKUP_FORMAT_VERSION,
  DATABASE_APPLICATION_ID,
  DATABASE_NAME,
} from '@/data/database/database-constants';
import { migrations } from '@/data/database/migrations';
import {
  Phase0ProofRepository,
  type SeedSummary,
} from '@/data/repositories/phase0-proof-repository';
import { BackupValidationError } from '@/domain/errors/foundation-errors';
import { assertDatabaseKey } from '@/platform/secure-storage/database-key';

import { validateBackupManifest, type BackupManifest } from './backup-manifest';
import { sha256File } from './file-hash';

const MINIMUM_PASSPHRASE_LENGTH = 12;
const BACKUP_ALIAS = 'gymvito_backup';
const RESTORE_ALIAS = 'gymvito_restore';

type ManifestRow = {
  format_version: number;
  schema_version: number;
  source_app_version: string;
  created_at_utc: string;
  locale: string;
  time_zone: string;
  gym_id: string;
  gym_name: string;
  currency: string;
  record_count: number;
  money_total_minor: number;
  media_sha256: string;
  integrity_result: 'ok';
};

export type BackupProof = Readonly<{
  file: File;
  fileSha256: string;
  manifest: BackupManifest;
}>;

export type RestoreHooks = Readonly<{
  beforeLiveReplacement?: () => Promise<void>;
  liveDatabaseName?: string;
}>;

function assertPassphrase(passphrase: string): void {
  if (passphrase.length < MINIMUM_PASSPHRASE_LENGTH || passphrase.length > 512) {
    throw new BackupValidationError('Backup passphrase must contain 12 to 512 characters.');
  }
}

function sqlStringLiteral(secret: string): string {
  assertPassphrase(secret);
  // PRAGMA key does not accept SQLite bind parameters. Escaping is isolated here and never logged.
  return `'${secret.replaceAll("'", "''")}'`;
}

async function applyBackupPassphrase(database: SQLiteDatabase, passphrase: string): Promise<void> {
  await database.execAsync(`PRAGMA key = ${sqlStringLiteral(passphrase)}`);
}

function mapManifest(row: ManifestRow): BackupManifest {
  return {
    formatVersion: row.format_version,
    schemaVersion: row.schema_version,
    sourceAppVersion: row.source_app_version,
    createdAtUtc: row.created_at_utc,
    locale: row.locale,
    timeZone: row.time_zone,
    gymId: row.gym_id,
    gymName: row.gym_name,
    currency: row.currency,
    recordCount: row.record_count,
    moneyTotalMinor: row.money_total_minor,
    mediaSha256: row.media_sha256,
    integrityResult: row.integrity_result,
  };
}

async function readAndValidateManifest(database: SQLiteDatabase): Promise<BackupManifest> {
  const integrity = await database.getFirstAsync<{ cipher_integrity_check: string }>(
    'PRAGMA cipher_integrity_check',
  );
  if (integrity && integrity.cipher_integrity_check !== 'ok') {
    throw new BackupValidationError('Backup cipher integrity check failed.');
  }
  const quickCheck = await database.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check');
  if (quickCheck?.quick_check !== 'ok') {
    throw new BackupValidationError('Backup database integrity check failed.');
  }

  const row = await database.getFirstAsync<ManifestRow>(
    'SELECT * FROM backup_manifest WHERE id = 1',
  );
  if (!row) throw new BackupValidationError('Backup manifest is missing.');
  const manifest = mapManifest(row);
  validateBackupManifest(manifest, migrations.at(-1)?.id ?? 0);

  const summary = await new Phase0ProofRepository(database).summary();
  if (
    manifest.recordCount !== summary.count ||
    manifest.moneyTotalMinor !== summary.moneyTotalMinor ||
    manifest.mediaSha256 !== summary.mediaSha256
  ) {
    throw new BackupValidationError('Backup record reconciliation failed.');
  }
  return manifest;
}

async function openBackup(file: File, passphrase: string): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync(
    file.name,
    { useNewConnection: true },
    file.parentDirectory.uri,
  );
  try {
    await applyBackupPassphrase(database, passphrase);
    await database.getFirstAsync('SELECT count(*) AS count FROM sqlite_master');
    return database;
  } catch (error) {
    await database.closeAsync().catch(() => undefined);
    throw new BackupValidationError('Backup passphrase is wrong or the file is corrupt.', {
      cause: error,
    });
  }
}

function tempDatabaseFile(name: string): File {
  return new File(defaultDatabaseDirectory, name);
}

function removeIfPresent(file: File): void {
  if (file.exists) file.delete();
}

async function writeManifest(
  database: SQLiteDatabase,
  summary: SeedSummary,
  schemaVersion: number,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO backup_manifest(
       id, format_version, schema_version, source_app_version, created_at_utc,
       locale, time_zone, gym_id, gym_name, currency, record_count,
       money_total_minor, media_sha256, integrity_result
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok')
     ON CONFLICT(id) DO UPDATE SET
       format_version = excluded.format_version,
       schema_version = excluded.schema_version,
       source_app_version = excluded.source_app_version,
       created_at_utc = excluded.created_at_utc,
       locale = excluded.locale,
       time_zone = excluded.time_zone,
       gym_id = excluded.gym_id,
       gym_name = excluded.gym_name,
       currency = excluded.currency,
       record_count = excluded.record_count,
       money_total_minor = excluded.money_total_minor,
       media_sha256 = excluded.media_sha256,
       integrity_result = excluded.integrity_result`,
    BACKUP_FORMAT_VERSION,
    schemaVersion,
    Constants.expoConfig?.version ?? '0.0.0',
    new Date().toISOString(),
    Intl.DateTimeFormat().resolvedOptions().locale,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    'phase0-gym',
    'GymVito Proof Gym',
    'INR',
    summary.count,
    summary.moneyTotalMinor,
    summary.mediaSha256,
  );
}

export async function createEncryptedBackup(
  database: SQLiteDatabase,
  passphrase: string,
  schemaVersion: number,
): Promise<BackupProof> {
  assertPassphrase(passphrase);
  const summary = await new Phase0ProofRepository(database).summary();
  await writeManifest(database, summary, schemaVersion);
  await database.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');

  const file = tempDatabaseFile(`gymvito-proof-${Date.now()}.gymvito`);
  removeIfPresent(file);
  let attached = false;
  try {
    await database.runAsync(`ATTACH DATABASE ? AS ${BACKUP_ALIAS} KEY ?`, file.uri, passphrase);
    attached = true;
    await database.getFirstAsync(`SELECT sqlcipher_export('${BACKUP_ALIAS}') AS exported`);
    await database.execAsync(`
      PRAGMA ${BACKUP_ALIAS}.application_id = ${DATABASE_APPLICATION_ID};
      PRAGMA ${BACKUP_ALIAS}.user_version = ${schemaVersion};
    `);
  } finally {
    if (attached) await database.execAsync(`DETACH DATABASE ${BACKUP_ALIAS}`);
  }

  const verificationDatabase = await openBackup(file, passphrase);
  try {
    const manifest = await readAndValidateManifest(verificationDatabase);
    return { file, fileSha256: await sha256File(file), manifest };
  } finally {
    await verificationDatabase.closeAsync();
  }
}

export async function verifyEncryptedBackup(
  file: File,
  passphrase: string,
): Promise<BackupManifest> {
  const database = await openBackup(file, passphrase);
  try {
    return await readAndValidateManifest(database);
  } finally {
    await database.closeAsync();
  }
}

export async function restoreEncryptedBackup(
  liveDatabase: SQLiteDatabase,
  sourceFile: File,
  passphrase: string,
  deviceKey: string,
  hooks: RestoreHooks = {},
): Promise<BackupManifest> {
  assertDatabaseKey(deviceKey);
  const sourceDatabase = await openBackup(sourceFile, passphrase);
  const candidate = tempDatabaseFile(`gymvito-restore-${Date.now()}.db`);
  const safety = tempDatabaseFile(`gymvito-safety-${Date.now()}.db`);
  const live = tempDatabaseFile(hooks.liveDatabaseName ?? DATABASE_NAME);
  let candidateMoved = false;
  removeIfPresent(candidate);
  removeIfPresent(safety);

  try {
    const manifest = await readAndValidateManifest(sourceDatabase);
    await sourceDatabase.runAsync(
      `ATTACH DATABASE ? AS ${RESTORE_ALIAS} KEY "x'${deviceKey}'"`,
      candidate.uri,
    );
    try {
      await sourceDatabase.getFirstAsync(`SELECT sqlcipher_export('${RESTORE_ALIAS}') AS exported`);
      await sourceDatabase.execAsync(`
        PRAGMA ${RESTORE_ALIAS}.application_id = ${DATABASE_APPLICATION_ID};
        PRAGMA ${RESTORE_ALIAS}.user_version = ${manifest.schemaVersion};
      `);
    } finally {
      await sourceDatabase.execAsync(`DETACH DATABASE ${RESTORE_ALIAS}`);
    }

    const candidateDatabase = await openDatabaseAsync(
      candidate.name,
      { useNewConnection: true },
      candidate.parentDirectory.uri,
    );
    try {
      await applyDatabaseKey(candidateDatabase, deviceKey);
      await readAndValidateManifest(candidateDatabase);
    } finally {
      await candidateDatabase.closeAsync();
    }

    await liveDatabase.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');
    await hooks.beforeLiveReplacement?.();
    await liveDatabase.closeAsync();
    await live.copy(safety);

    try {
      live.delete();
      await candidate.move(live);
      candidateMoved = true;
      const replacement = await openDatabaseAsync(live.name, { useNewConnection: true });
      try {
        await applyDatabaseKey(replacement, deviceKey);
        await readAndValidateManifest(replacement);
      } finally {
        await replacement.closeAsync();
      }
      removeIfPresent(safety);
      return manifest;
    } catch (error) {
      removeIfPresent(live);
      await safety.move(live);
      throw error;
    }
  } finally {
    await sourceDatabase.closeAsync().catch(() => undefined);
    if (!candidateMoved) removeIfPresent(candidate);
    if (safety.exists && live.exists && safety.uri !== live.uri) removeIfPresent(safety);
  }
}

export async function saveBackupToDirectory(backup: File): Promise<File> {
  const directory = await Directory.pickDirectoryAsync();
  const destination = new File(directory, backup.name);
  await backup.copy(destination, { overwrite: true });
  if (
    destination.size !== backup.size ||
    (await sha256File(destination)) !== (await sha256File(backup))
  ) {
    removeIfPresent(destination);
    throw new BackupValidationError('Saved backup verification failed.');
  }
  return destination;
}

export function clearTemporaryBackup(file: File): void {
  if (file.exists && file.uri.startsWith(Paths.cache.uri)) file.delete();
  if (file.exists && file.uri.includes('gymvito-proof-')) file.delete();
}
