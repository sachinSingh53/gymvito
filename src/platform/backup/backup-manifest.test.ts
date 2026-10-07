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
};

describe('backup manifest validation', () => {
  it('accepts a supported complete manifest', () => {
    expect(() => validateBackupManifest(valid, 1)).not.toThrow();
  });

  test.each([
    [{ formatVersion: 2 }, 'Unsupported backup format.'],
    [{ schemaVersion: 2 }, 'newer GymVito'],
    [{ schemaVersion: 0 }, 'Invalid backup schema'],
    [{ recordCount: -1 }, 'record count'],
    [{ moneyTotalMinor: 1.2 }, 'money total'],
    [{ mediaSha256: 'bad' }, 'media hash'],
    [{ integrityResult: 'failed' }, 'integrity metadata'],
    [{ createdAtUtc: 'bad-date' }, 'integrity metadata'],
    [{ currency: 'rupees' }, 'identity metadata'],
  ])('rejects %o', (patch, message) => {
    expect(() => validateBackupManifest({ ...valid, ...patch } as BackupManifest, 1)).toThrow(
      message,
    );
  });
});
