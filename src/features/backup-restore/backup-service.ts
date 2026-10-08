import { File, Paths } from 'expo-file-system';

import { Phase5Repository, type BackupHistoryRecord } from '@/data/repositories/phase5-repository';
import { BackupValidationError } from '@/domain/errors/foundation-errors';
import {
  clearTemporaryBackup,
  createEncryptedBackup,
  restoreEncryptedBackup,
  saveBackupToDirectory,
  verifyEncryptedBackup,
  type BackupProof,
  type BackupDatabaseHandle,
  type RestoreHooks,
} from '@/platform/backup/sqlcipher-backup';
import type { BackupManifest } from '@/platform/backup/backup-manifest';
import { toFileSystemUri } from '@/platform/files/file-system-uri';
import { getRuntimeCapabilities } from '@/platform/runtime/runtime-capabilities';

export type SavedBackup = Readonly<{
  manifest: BackupManifest;
  fileName: string;
  fileSizeBytes: number;
}>;

function isPickerCancellation(error: unknown): boolean {
  return (
    error instanceof Error &&
    /cancel|canceled|cancelled|dismiss/i.test(`${error.name} ${error.message}`)
  );
}

export class BackupService {
  private readonly repository: Phase5Repository;

  constructor(
    private readonly database: BackupDatabaseHandle,
    private readonly schemaVersion: number,
    private readonly actorStaffId: string,
    private readonly deviceKey: string | null,
  ) {
    this.repository = new Phase5Repository(database);
  }

  private assertNativeSecurity(): string {
    if (!getRuntimeCapabilities().nativeSecurityProofs || !this.deviceKey) {
      throw new BackupValidationError(
        'Encrypted backup and restore require a GymVito development or release build.',
      );
    }
    return this.deviceKey;
  }

  listHistory(): Promise<BackupHistoryRecord[]> {
    return this.repository.listBackupHistory();
  }

  lastSuccessfulBackup(): Promise<BackupHistoryRecord | null> {
    return this.repository.lastSuccessfulBackup();
  }

  async create(passphrase: string): Promise<SavedBackup> {
    this.assertNativeSecurity();
    const operationId = await this.repository.beginOperation('backup', this.actorStaffId);
    let proof: BackupProof | null = null;
    try {
      const liveSize = new File(toFileSystemUri(this.database.databasePath)).size;
      if (Paths.availableDiskSpace < liveSize * 2 + 5 * 1024 * 1024) {
        throw new BackupValidationError('Not enough free storage to create and verify a backup.');
      }
      proof = await createEncryptedBackup(this.database, passphrase, this.schemaVersion);
      const destination = await saveBackupToDirectory(proof.file);
      await this.repository.completeOperation(
        operationId,
        'success',
        {
          targetDescriptor: destination.name,
          formatVersion: proof.manifest.formatVersion,
          schemaVersion: proof.manifest.schemaVersion,
          sourceAppVersion: proof.manifest.sourceAppVersion,
          fileSizeBytes: destination.size,
          fileSha256: proof.fileSha256,
          recordCounts: proof.manifest.recordCounts,
        },
        this.actorStaffId,
      );
      return {
        manifest: proof.manifest,
        fileName: destination.name,
        fileSizeBytes: destination.size,
      };
    } catch (error) {
      await this.repository.completeOperation(
        operationId,
        isPickerCancellation(error) ? 'cancelled' : 'failed',
        { error },
        this.actorStaffId,
      );
      throw error;
    } finally {
      if (proof) clearTemporaryBackup(proof.file);
    }
  }

  preview(file: File, passphrase: string): Promise<BackupManifest> {
    this.assertNativeSecurity();
    return verifyEncryptedBackup(file, passphrase);
  }

  async restore(file: File, passphrase: string, hooks: RestoreHooks = {}): Promise<BackupManifest> {
    const deviceKey = this.assertNativeSecurity();
    return restoreEncryptedBackup(this.database, file, passphrase, deviceKey, {
      ...hooks,
      afterReplacementVerified: async (replacement, manifest) => {
        const repository = new Phase5Repository(replacement);
        await repository.recordSuccessfulRestore({
          targetDescriptor: file.name,
          formatVersion: manifest.formatVersion,
          schemaVersion: manifest.schemaVersion,
          sourceAppVersion: manifest.sourceAppVersion,
          fileSizeBytes: file.size,
          recordCounts: manifest.recordCounts,
        });
        await hooks.afterReplacementVerified?.(replacement, manifest);
      },
    });
  }
}
