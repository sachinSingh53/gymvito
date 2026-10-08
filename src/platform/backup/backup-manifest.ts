import { BackupValidationError } from '@/domain/errors/foundation-errors';

export type BackupManifest = Readonly<{
  formatVersion: number;
  schemaVersion: number;
  sourceAppVersion: string;
  createdAtUtc: string;
  locale: string;
  timeZone: string;
  gymId: string;
  gymName: string;
  currency: string;
  recordCount: number;
  moneyTotalMinor: number;
  mediaSha256: string;
  integrityResult: 'ok';
  recordCounts: Readonly<Record<string, number>>;
  financialTotals: Readonly<Record<string, number>>;
  membershipStatusCounts: Readonly<Record<string, number>>;
  sequenceState: Readonly<Record<string, number>>;
  logicalChecksum: string;
}>;

const HASH_PATTERN = /^[0-9a-f]{64}$/;

export function validateBackupManifest(value: BackupManifest, latestSchema: number): void {
  if (value.formatVersion !== 1) {
    throw new BackupValidationError('Unsupported backup format.');
  }
  if (!Number.isSafeInteger(value.schemaVersion) || value.schemaVersion < 1) {
    throw new BackupValidationError('Invalid backup schema version.');
  }
  if (value.schemaVersion > latestSchema) {
    throw new BackupValidationError('The backup was created by a newer GymVito version.');
  }
  if (!Number.isSafeInteger(value.recordCount) || value.recordCount < 0) {
    throw new BackupValidationError('Invalid backup record count.');
  }
  if (!Number.isSafeInteger(value.moneyTotalMinor)) {
    throw new BackupValidationError('Invalid backup money total.');
  }
  if (!HASH_PATTERN.test(value.mediaSha256)) {
    throw new BackupValidationError('Invalid backup media hash.');
  }
  if (!HASH_PATTERN.test(value.logicalChecksum)) {
    throw new BackupValidationError('Invalid backup logical checksum.');
  }
  if (value.integrityResult !== 'ok' || Number.isNaN(Date.parse(value.createdAtUtc))) {
    throw new BackupValidationError('Invalid backup integrity metadata.');
  }
  if (!value.gymId || !value.gymName || !/^[A-Z]{3}$/.test(value.currency)) {
    throw new BackupValidationError('Invalid backup identity metadata.');
  }
  for (const collection of [
    value.recordCounts,
    value.membershipStatusCounts,
    value.sequenceState,
  ]) {
    if (
      !collection ||
      Array.isArray(collection) ||
      Object.values(collection).some((item) => !Number.isSafeInteger(item) || item < 0)
    ) {
      throw new BackupValidationError('Invalid backup reconciliation metadata.');
    }
  }
  if (
    !value.financialTotals ||
    Array.isArray(value.financialTotals) ||
    Object.values(value.financialTotals).some((item) => !Number.isSafeInteger(item))
  ) {
    throw new BackupValidationError('Invalid backup financial metadata.');
  }
}
