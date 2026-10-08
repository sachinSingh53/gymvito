import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import migrations from '@/data/database/migrations/manifest.json';

import { Phase5Repository, readBackupReconciliationSummary } from './phase5-repository';

let mockUuid = 0;
jest.mock('expo-crypto', () => {
  const { createHash } = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    randomUUID: () => `phase5-uuid-${++mockUuid}`,
    digest: async (_algorithm: string, value: Uint8Array) =>
      Uint8Array.from(createHash('sha256').update(value).digest()).buffer,
    digestStringAsync: async (_algorithm: string, value: string) =>
      createHash('sha256').update(value).digest('hex'),
  };
});

function nativeParams(params: readonly SQLiteBindValue[]): SQLInputValue[] {
  return params.map((value) =>
    typeof value === 'boolean' ? (value ? 1 : 0) : value,
  ) as SQLInputValue[];
}

function createDatabase(): { native: DatabaseSync; database: SQLiteDatabase } {
  const native = new DatabaseSync(':memory:');
  native.exec('PRAGMA foreign_keys = ON');
  for (const migration of migrations) native.exec(migration.sql);
  const adapter = {
    execAsync: async (sql: string) => native.exec(sql),
    runAsync: async (sql: string, ...params: SQLiteBindValue[]) => {
      const result = native.prepare(sql).run(...nativeParams(params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getFirstAsync: async <T>(sql: string, ...params: SQLiteBindValue[]) =>
      (native.prepare(sql).get(...nativeParams(params)) as T | undefined) ?? null,
    getAllAsync: async <T>(sql: string, ...params: SQLiteBindValue[]) =>
      native.prepare(sql).all(...nativeParams(params)) as T[],
    withExclusiveTransactionAsync: async (
      callback: (database: SQLiteDatabase) => Promise<void>,
    ) => {
      native.exec('BEGIN IMMEDIATE');
      try {
        await callback(adapter as unknown as SQLiteDatabase);
        native.exec('COMMIT');
      } catch (error) {
        native.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { native, database: adapter as unknown as SQLiteDatabase };
}

function seed(native: DatabaseSync) {
  const at = '2026-10-08T08:00:00.000Z';
  native
    .prepare(
      `INSERT INTO settings(
         id, language, onboarding_step, setup_completed_at_utc, created_at_utc, updated_at_utc
       ) VALUES (1, 'en', 'complete', ?, ?, ?)`,
    )
    .run(at, at, at);
  native
    .prepare(
      `INSERT INTO gym_profile(
         id, name, owner_name, created_at_utc, updated_at_utc
       ) VALUES ('gym', 'IronFit', 'Rajesh', ?, ?)`,
    )
    .run(at, at);
  native
    .prepare(
      `INSERT INTO staff_profile(
         id, display_name, role_id, pin_verifier_json, preferred_language,
         is_owner, created_at_utc, updated_at_utc
       ) VALUES ('owner', 'Rajesh', 'owner', '{}', 'en', 1, ?, ?)`,
    )
    .run(at, at);
  native
    .prepare(
      `INSERT INTO member(
         id, member_code, normalized_member_code, name, normalized_name,
         created_at_utc, updated_at_utc
       ) VALUES ('member', 'GV-00001', 'gv00001', 'Amit', 'amit', ?, ?)`,
    )
    .run(at, at);
  native
    .prepare(
      `INSERT INTO member_media(
         id, member_id, media_type, mime_type, byte_size, width, height, content,
         created_at_utc, updated_at_utc
       ) VALUES ('media', 'member', 'profile_photo', 'image/jpeg', 3, 1, 1, ?, ?, ?)`,
    )
    .run(Uint8Array.from([1, 2, 3]), at, at);
}

describe('Phase5Repository', () => {
  it('adds durable backup history when upgrading a Phase 4 database', () => {
    const native = new DatabaseSync(':memory:');
    for (const migration of migrations.slice(0, 5)) native.exec(migration.sql);
    native.exec(migrations[5]!.sql);
    expect(
      native
        .prepare(
          "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'backup_record'",
        )
        .get(),
    ).toMatchObject({ count: 1 });
    expect(
      native
        .prepare(
          "SELECT count(*) AS count FROM pragma_table_info('backup_manifest') WHERE name = 'logical_checksum'",
        )
        .get(),
    ).toMatchObject({ count: 1 });
    native.close();
  });

  it('reconciles business counts, media, money, and sequences deterministically', async () => {
    const { native, database } = createDatabase();
    seed(native);
    const first = await readBackupReconciliationSummary(database);
    const second = await readBackupReconciliationSummary(database);
    expect(first).toEqual(second);
    expect(first.recordCounts).toMatchObject({ member: 1, member_media: 1, staff_profile: 1 });
    expect(first.financialTotals).toEqual({
      invoicedMinor: 0,
      recordedPaymentsMinor: 0,
      adjustmentsMinor: 0,
      outstandingMinor: 0,
    });
    expect(first.sequenceState).toMatchObject({ member_code: 1, invoice: 1, receipt: 1 });
    expect(first.mediaSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.logicalChecksum).toMatch(/^[0-9a-f]{64}$/);
    native.close();
  });

  it('changes last-success state only after a successful completion', async () => {
    const { native, database } = createDatabase();
    seed(native);
    const repository = new Phase5Repository(database);
    const failedId = await repository.beginOperation('backup', 'owner');
    await repository.completeOperation(
      failedId,
      'failed',
      { error: new Error('DESTINATION_CANCELLED') },
      'owner',
    );
    expect(await repository.lastSuccessfulBackup()).toBeNull();

    const successId = await repository.beginOperation('backup', 'owner');
    await repository.completeOperation(
      successId,
      'success',
      {
        targetDescriptor: 'gymvito-verified.gymvito',
        schemaVersion: 6,
        fileSizeBytes: 4096,
      },
      'owner',
    );
    expect(await repository.lastSuccessfulBackup()).toMatchObject({
      id: successId,
      result: 'success',
      targetDescriptor: 'gymvito-verified.gymvito',
    });
    await repository.recordSuccessfulRestore({
      targetDescriptor: 'old-device.gymvito',
      formatVersion: 1,
      schemaVersion: 5,
      sourceAppVersion: '0.0.1',
      fileSizeBytes: 8192,
      recordCounts: { member: 1 },
    });
    expect(await repository.listBackupHistory()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operationType: 'restore',
          result: 'success',
          targetDescriptor: 'old-device.gymvito',
        }),
      ]),
    );
    expect(native.prepare('SELECT count(*) AS count FROM audit_event').get()).toMatchObject({
      count: 3,
    });
    native.close();
  });
});
