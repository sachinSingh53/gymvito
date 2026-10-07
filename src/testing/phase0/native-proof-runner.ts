import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytesAsync } from 'expo-crypto';
import { File } from 'expo-file-system';
import {
  defaultDatabaseDirectory,
  deleteDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { applyDatabaseKey } from '@/data/database/apply-key';
import { DATABASE_APPLICATION_ID } from '@/data/database/database-constants';
import { runMigrations } from '@/data/database/run-migrations';
import {
  Phase0ProofRepository,
  type SeedSummary,
} from '@/data/repositories/phase0-proof-repository';
import { readDeviceLocale } from '@/platform/localization/device-locale';
import { getRuntimeCapabilities } from '@/platform/runtime/runtime-capabilities';
import {
  createEncryptedBackup,
  restoreEncryptedBackup,
  verifyEncryptedBackup,
} from '@/platform/backup/sqlcipher-backup';
import { benchmarkPinKdf } from '@/platform/security/pin-kdf';

import { runAvatarBenchmark, type AvatarBenchmarkResult } from './avatar-benchmark';

const PROOF_DATABASE_NAME = 'gymvito-phase0-proof.db';
const PROOF_PASSPHRASE = 'GymVito proof passphrase 2026!';

export type NativeProofReport = Readonly<{
  createdAtUtc: string;
  locale: ReturnType<typeof readDeviceLocale>;
  schemaVersion: number;
  seed: SeedSummary;
  restored: SeedSummary;
  backupSha256: string;
  wrongKeyRejected: boolean;
  wrongPassphraseRejected: boolean;
  corruptBackupRejected: boolean;
  interruptedRestorePreservedLiveData: boolean;
  avatarBenchmark: AvatarBenchmarkResult;
  pinKdfDurationMs: number;
}>;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function randomKey(): Promise<string> {
  return bytesToHex(await getRandomBytesAsync(32));
}

async function openProofDatabase(key: string): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync(PROOF_DATABASE_NAME, { useNewConnection: true });
  await applyDatabaseKey(database, key);
  await database.execAsync(`
    PRAGMA application_id = ${DATABASE_APPLICATION_ID};
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
  `);
  await runMigrations(database);
  return database;
}

async function wrongKeyIsRejected(): Promise<boolean> {
  const connection = await openDatabaseAsync(PROOF_DATABASE_NAME, { useNewConnection: true });
  try {
    await applyDatabaseKey(connection, await randomKey());
    await connection.getFirstAsync('SELECT count(*) FROM sqlite_master');
    return false;
  } catch {
    return true;
  } finally {
    await connection.closeAsync().catch(() => undefined);
  }
}

async function createCorruptCopy(source: File): Promise<File> {
  const corrupt = new File(defaultDatabaseDirectory, `gymvito-corrupt-${Date.now()}.gymvito`);
  await source.copy(corrupt);
  const bytes = await corrupt.bytes();
  const index = Math.floor(bytes.length / 2);
  bytes[index] ^= 0xff;
  corrupt.write(bytes);
  return corrupt;
}

function sameSummary(left: SeedSummary, right: SeedSummary): boolean {
  return (
    left.count === right.count &&
    left.moneyTotalMinor === right.moneyTotalMinor &&
    left.mediaSha256 === right.mediaSha256
  );
}

export async function runNativePhase0Proofs(avatarRows = 10_000): Promise<NativeProofReport> {
  if (!getRuntimeCapabilities().nativeSecurityProofs) {
    throw new Error('Native security proofs require a GymVito development build.');
  }
  await deleteDatabaseAsync(PROOF_DATABASE_NAME).catch(() => undefined);
  const key = await randomKey();
  let database = await openProofDatabase(key);
  let backup: File | undefined;
  let corrupt: File | undefined;

  try {
    const fixture = await digestStringAsync(CryptoDigestAlgorithm.SHA256, 'GymVito avatar fixture');
    const seed = await new Phase0ProofRepository(database).seed(
      Uint8Array.from(fixture.match(/.{2}/g)?.map((value) => Number.parseInt(value, 16)) ?? []),
    );
    const schemaVersion =
      (await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))
        ?.user_version ?? 0;
    const wrongKeyRejected = await wrongKeyIsRejected();
    const avatarBenchmark = await runAvatarBenchmark(database, avatarRows);
    const pinKdfDurationMs = await benchmarkPinKdf();

    const proof = await createEncryptedBackup(database, PROOF_PASSPHRASE, schemaVersion);
    backup = proof.file;
    let wrongPassphraseRejected = false;
    try {
      await verifyEncryptedBackup(backup, 'Definitely wrong passphrase');
    } catch {
      wrongPassphraseRejected = true;
    }

    corrupt = await createCorruptCopy(backup);
    let corruptBackupRejected = false;
    try {
      await verifyEncryptedBackup(corrupt, PROOF_PASSPHRASE);
    } catch {
      corruptBackupRejected = true;
    }

    let interruptedRestorePreservedLiveData = false;
    try {
      await restoreEncryptedBackup(database, backup, PROOF_PASSPHRASE, key, {
        liveDatabaseName: PROOF_DATABASE_NAME,
        beforeLiveReplacement: async () => {
          throw new Error('SIMULATED_RESTORE_INTERRUPTION');
        },
      });
    } catch {
      const afterInterruption = await new Phase0ProofRepository(database).summary();
      interruptedRestorePreservedLiveData = sameSummary(seed, afterInterruption);
    }

    await database.closeAsync();
    await deleteDatabaseAsync(PROOF_DATABASE_NAME);
    database = await openDatabaseAsync(PROOF_DATABASE_NAME, { useNewConnection: true });
    await applyDatabaseKey(database, key);
    await database.execAsync('CREATE TABLE wipe_marker(id INTEGER PRIMARY KEY)');
    await restoreEncryptedBackup(database, backup, PROOF_PASSPHRASE, key, {
      liveDatabaseName: PROOF_DATABASE_NAME,
    });

    database = await openDatabaseAsync(PROOF_DATABASE_NAME, { useNewConnection: true });
    await applyDatabaseKey(database, key);
    const restored = await new Phase0ProofRepository(database).summary();
    if (!sameSummary(seed, restored)) throw new Error('BACKUP_ROUND_TRIP_MISMATCH');

    return {
      createdAtUtc: new Date().toISOString(),
      locale: readDeviceLocale(),
      schemaVersion,
      seed,
      restored,
      backupSha256: proof.fileSha256,
      wrongKeyRejected,
      wrongPassphraseRejected,
      corruptBackupRejected,
      interruptedRestorePreservedLiveData,
      avatarBenchmark,
      pinKdfDurationMs,
    };
  } finally {
    await database.closeAsync().catch(() => undefined);
    if (backup?.exists) backup.delete();
    if (corrupt?.exists) corrupt.delete();
    await deleteDatabaseAsync(PROOF_DATABASE_NAME).catch(() => undefined);
  }
}
