import { validateBackupManifest, type BackupManifest } from './backup-manifest';

const valid: BackupManifest = {
  formatVersion: 1,
  schemaVersion: 1,
  sourceAppVersion: '0.0.1',
  createdAtUtc: '2026-10-02T07:00:00.000Z',
  locale: 'en-IN',
  timeZone: 'Asia/Kolkata',
  gymId: 'phase0-gym',
  gymName: 'GymVito Proof Gym',
  currency: 'INR',
  recordCount: 1,
  moneyTotalMinor: 125050,
  mediaSha256: 'a'.repeat(64),
  integrityResult: 'ok',
  recordCounts: { member: 1 },
  financialTotals: { invoicedMinor: 100, recordedPaymentsMinor: 50 },
  membershipStatusCounts: { finalized: 1 },
  sequenceState: { member_code: 2 },
  logicalChecksum: 'b'.repeat(64),
};

describe('backup manifest validation', () => {
  it('accepts a supported complete manifest', () => {
    expect(() => validateBackupManifest(valid, 1)).not.toThrow();
  });

  test.each([1, 2, 3, 4, 5, 6])('accepts supported schema %i for migration', (schemaVersion) => {
    expect(() => validateBackupManifest({ ...valid, schemaVersion }, 6)).not.toThrow();
  });

  test.each([
    [{ formatVersion: 2 }, 'Unsupported backup format.'],
    [{ schemaVersion: 2 }, 'newer GymVito'],
    [{ schemaVersion: 0 }, 'Invalid backup schema'],
    [{ recordCount: -1 }, 'record count'],
    [{ moneyTotalMinor: 1.2 }, 'money total'],
    [{ mediaSha256: 'bad' }, 'media hash'],
    [{ logicalChecksum: 'bad' }, 'logical checksum'],
    [{ recordCounts: { member: -1 } }, 'reconciliation metadata'],
    [{ financialTotals: { invoicedMinor: 1.5 } }, 'financial metadata'],
    [{ integrityResult: 'failed' }, 'integrity metadata'],
    [{ createdAtUtc: 'bad-date' }, 'integrity metadata'],
    [{ currency: 'rupees' }, 'identity metadata'],
  ])('rejects %o', (patch, message) => {
    expect(() => validateBackupManifest({ ...valid, ...patch } as BackupManifest, 1)).toThrow(
      message,
    );
  });
});
