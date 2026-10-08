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
import { runMigrations } from '@/data/database/run-migrations';
import { readBackupReconciliationSummary } from '@/data/repositories/phase5-repository';
import { Phase0ProofRepository } from '@/data/repositories/phase0-proof-repository';
import { BackupValidationError } from '@/domain/errors/foundation-errors';
import { toFileSystemUri } from '@/platform/files/file-system-uri';
import { assertDatabaseKey } from '@/platform/secure-storage/database-key';

import { validateBackupManifest, type BackupManifest } from './backup-manifest';
import { sha256File } from './file-hash';

export type BackupDatabaseHandle = SQLiteDatabase;

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
  record_counts_json?: string;
  financial_totals_json?: string;
  membership_status_counts_json?: string;
  sequence_state_json?: string;
  logical_checksum?: string;
};

export type BackupProof = Readonly<{
  file: File;
  fileSha256: string;
  manifest: BackupManifest;
}>;

export type RestoreHooks = Readonly<{
  beforeLiveReplacement?: () => Promise<void>;
  afterReplacementVerified?: (database: SQLiteDatabase, manifest: BackupManifest) => Promise<void>;
  liveDatabaseName?: string;
}>;

export function assertBackupPassphrase(passphrase: string): void {
  if (passphrase.length < MINIMUM_PASSPHRASE_LENGTH || passphrase.length > 512) {
    throw new BackupValidationError('Backup passphrase must contain 12 to 512 characters.');
  }
  if (!/\p{L}/u.test(passphrase) || !/\d/.test(passphrase)) {
    throw new BackupValidationError('Backup passphrase must include a letter and a number.');
  }
}

function sqlStringLiteral(secret: string): string {
  assertBackupPassphrase(secret);
  // PRAGMA key does not accept SQLite bind parameters. Escaping is isolated here and never logged.
  return `'${secret.replaceAll("'", "''")}'`;
}

async function applyBackupPassphrase(database: SQLiteDatabase, passphrase: string): Promise<void> {
  await database.execAsync(`PRAGMA key = ${sqlStringLiteral(passphrase)}`);
}

function mapManifest(row: ManifestRow): BackupManifest {
  const parseRecord = (value: string | undefined): Readonly<Record<string, number>> => {
    if (!value) return {};
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, number>)
        : {};
    } catch {
      return {};
    }
  };
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
    recordCounts: parseRecord(row.record_counts_json),
    financialTotals: parseRecord(row.financial_totals_json),
    membershipStatusCounts: parseRecord(row.membership_status_counts_json),
    sequenceState: parseRecord(row.sequence_state_json),
    logicalChecksum:
      row.logical_checksum ??
      (row.schema_version < 6 ? row.media_sha256 : 'invalid-missing-logical-checksum'),
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

  const application = await database.getFirstAsync<{ application_id: number }>(
    'PRAGMA application_id',
  );
  if (application?.application_id !== DATABASE_APPLICATION_ID) {
    throw new BackupValidationError('The selected file is not a GymVito backup.');
  }

  const row = await database.getFirstAsync<ManifestRow>(
    'SELECT * FROM backup_manifest WHERE id = 1',
  );
  if (!row) throw new BackupValidationError('Backup manifest is missing.');
  const manifest = mapManifest(row);
  validateBackupManifest(manifest, migrations.at(-1)?.id ?? 0);

  const schema = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (schema?.user_version !== manifest.schemaVersion) {
    throw new BackupValidationError('Backup schema metadata does not match the database.');
  }

  if (manifest.schemaVersion < 6) {
    const summary = await new Phase0ProofRepository(database).summary();
    if (
      manifest.recordCount !== summary.count ||
      manifest.moneyTotalMinor !== summary.moneyTotalMinor ||
      manifest.mediaSha256 !== summary.mediaSha256
    ) {
      throw new BackupValidationError('Backup record reconciliation failed.');
    }
  } else {
    const summary = await readBackupReconciliationSummary(database);
    if (
      manifest.recordCount !== Object.values(summary.recordCounts).reduce((a, b) => a + b, 0) ||
      manifest.moneyTotalMinor !== summary.financialTotals.recordedPaymentsMinor ||
      manifest.mediaSha256 !== summary.mediaSha256 ||
      manifest.logicalChecksum !== summary.logicalChecksum ||
      JSON.stringify(manifest.recordCounts) !== JSON.stringify(summary.recordCounts) ||
      JSON.stringify(manifest.financialTotals) !== JSON.stringify(summary.financialTotals) ||
      JSON.stringify(manifest.membershipStatusCounts) !==
        JSON.stringify(summary.membershipStatusCounts) ||
      JSON.stringify(manifest.sequenceState) !== JSON.stringify(summary.sequenceState)
    ) {
      throw new BackupValidationError('Backup record reconciliation failed.');
    }
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
  return new File(toFileSystemUri(defaultDatabaseDirectory), name);
}

function removeIfPresent(file: File): void {
  if (file.exists) file.delete();
}

function removeLiveCompanionFiles(): void {
  removeIfPresent(tempDatabaseFile(`${DATABASE_NAME}-wal`));
  removeIfPresent(tempDatabaseFile(`${DATABASE_NAME}-shm`));
}

async function writeManifest(database: SQLiteDatabase, schemaVersion: number): Promise<void> {
  const [summary, gym, settings] = await Promise.all([
    readBackupReconciliationSummary(database),
    database.getFirstAsync<{ id: string; name: string }>(
      'SELECT id, name FROM gym_profile WHERE singleton_key = 1',
    ),
    database.getFirstAsync<{ currency_code: string }>(
      'SELECT currency_code FROM settings WHERE id = 1',
    ),
  ]);
  if (!gym || !settings) throw new BackupValidationError('Gym setup is incomplete.');
  await database.runAsync(
    `INSERT INTO backup_manifest(
       id, format_version, schema_version, source_app_version, created_at_utc,
       locale, time_zone, gym_id, gym_name, currency, record_count,
       money_total_minor, media_sha256, integrity_result, record_counts_json,
       financial_totals_json, membership_status_counts_json, sequence_state_json,
       logical_checksum
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', ?, ?, ?, ?, ?)
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
       integrity_result = excluded.integrity_result,
       record_counts_json = excluded.record_counts_json,
       financial_totals_json = excluded.financial_totals_json,
       membership_status_counts_json = excluded.membership_status_counts_json,
       sequence_state_json = excluded.sequence_state_json,
       logical_checksum = excluded.logical_checksum`,
    BACKUP_FORMAT_VERSION,
    schemaVersion,
    Constants.expoConfig?.version ?? '0.0.0',
    new Date().toISOString(),
    Intl.DateTimeFormat().resolvedOptions().locale,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    gym.id,
    gym.name,
    settings.currency_code,
    Object.values(summary.recordCounts).reduce((a, b) => a + b, 0),
    summary.financialTotals.recordedPaymentsMinor,
    summary.mediaSha256,
    JSON.stringify(summary.recordCounts),
    JSON.stringify(summary.financialTotals),
    JSON.stringify(summary.membershipStatusCounts),
    JSON.stringify(summary.sequenceState),
    summary.logicalChecksum,
  );
}

export async function createEncryptedBackup(
  database: SQLiteDatabase,
  passphrase: string,
  schemaVersion: number,
): Promise<BackupProof> {
  assertBackupPassphrase(passphrase);
  await writeManifest(database, schemaVersion);
  await database.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');

  const file = tempDatabaseFile(
    `gymvito-${new Date().toISOString().slice(0, 10)}-${Date.now()}.gymvito`,
  );
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
      await runMigrations(candidateDatabase);
      await writeManifest(candidateDatabase, migrations.at(-1)?.id ?? manifest.schemaVersion);
      const migratedIntegrity = await candidateDatabase.getFirstAsync<{ quick_check: string }>(
        'PRAGMA quick_check',
      );
      if (migratedIntegrity?.quick_check !== 'ok') {
        throw new BackupValidationError('Migrated backup integrity check failed.');
      }
    } finally {
      await candidateDatabase.closeAsync();
    }

    await liveDatabase.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');
    assertRestoreSpace(sourceFile.size, live.size);
    await hooks.beforeLiveReplacement?.();
    await liveDatabase.closeAsync();
    await live.copy(safety);

    const safetyDatabase = await openDatabaseAsync(
      safety.name,
      { useNewConnection: true },
      safety.parentDirectory.uri,
    );
    try {
      await applyDatabaseKey(safetyDatabase, deviceKey);
      const safetyIntegrity = await safetyDatabase.getFirstAsync<{ quick_check: string }>(
        'PRAGMA quick_check',
      );
      if (safetyIntegrity?.quick_check !== 'ok') {
        throw new BackupValidationError('Current-data safety backup verification failed.');
      }
    } finally {
      await safetyDatabase.closeAsync();
    }

    try {
      removeLiveCompanionFiles();
      live.delete();
      await candidate.move(live);
      candidateMoved = true;
      const replacement = await openDatabaseAsync(live.name, { useNewConnection: true });
      try {
        await applyDatabaseKey(replacement, deviceKey);
        await readAndValidateManifest(replacement);
        await hooks.afterReplacementVerified?.(replacement, manifest);
      } finally {
        await replacement.closeAsync();
      }
      removeIfPresent(safety);
      return manifest;
    } catch (error) {
      removeIfPresent(live);
      removeLiveCompanionFiles();
      await safety.move(live);
      throw error;
    }
  } finally {
    await sourceDatabase.closeAsync().catch(() => undefined);
    if (!candidateMoved) removeIfPresent(candidate);
    if (safety.exists && live.exists && safety.uri !== live.uri) removeIfPresent(safety);
  }
}

export async function recoverEncryptedBackup(
  sourceFile: File,
  passphrase: string,
  deviceKey: string,
  hooks: Pick<RestoreHooks, 'afterReplacementVerified'> = {},
): Promise<BackupManifest> {
  assertDatabaseKey(deviceKey);
  const sourceDatabase = await openBackup(sourceFile, passphrase);
  const candidate = tempDatabaseFile(`gymvito-recovery-${Date.now()}.db`);
  const safety = tempDatabaseFile(`gymvito-recovery-safety-${Date.now()}.db`);
  const live = tempDatabaseFile(DATABASE_NAME);
  let replacementSucceeded = false;
  removeIfPresent(candidate);
  removeIfPresent(safety);
  try {
    const manifest = await readAndValidateManifest(sourceDatabase);
    assertRestoreSpace(sourceFile.size, live.exists ? live.size : 0);
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
      await runMigrations(candidateDatabase);
      await writeManifest(candidateDatabase, migrations.at(-1)?.id ?? manifest.schemaVersion);
      const integrity = await candidateDatabase.getFirstAsync<{ quick_check: string }>(
        'PRAGMA quick_check',
      );
      if (integrity?.quick_check !== 'ok') {
        throw new BackupValidationError('Recovered database integrity check failed.');
      }
    } finally {
      await candidateDatabase.closeAsync();
    }

    if (live.exists) await live.copy(safety);
    try {
      removeLiveCompanionFiles();
      removeIfPresent(live);
      await candidate.move(live);
      const replacement = await openDatabaseAsync(live.name, { useNewConnection: true });
      try {
        await applyDatabaseKey(replacement, deviceKey);
        await readAndValidateManifest(replacement);
        await hooks.afterReplacementVerified?.(replacement, manifest);
      } finally {
        await replacement.closeAsync();
      }
      replacementSucceeded = true;
      removeIfPresent(safety);
      return manifest;
    } catch (error) {
      removeIfPresent(live);
      removeLiveCompanionFiles();
      if (safety.exists) await safety.move(live);
      throw error;
    }
  } finally {
    await sourceDatabase.closeAsync().catch(() => undefined);
    if (!replacementSucceeded) removeIfPresent(candidate);
    if (safety.exists && live.exists) removeIfPresent(safety);
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
  if (file.exists && file.uri.includes('gymvito-') && file.uri.endsWith('.gymvito')) file.delete();
}

function assertRestoreSpace(sourceSize: number, liveSize: number): void {
  const required = sourceSize * 2 + liveSize * 2 + 5 * 1024 * 1024;
  if (Paths.availableDiskSpace < required) {
    throw new BackupValidationError('Not enough free storage to restore safely.');
  }
}
