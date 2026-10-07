import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import migrations from '@/data/database/migrations/manifest.json';
import { Phase2Repository } from '@/data/repositories/phase2-repository';
import type { MemberInput } from '@/domain/members/member';
import type { PlanInput } from '@/domain/plans/plan';

let mockUuidSequence = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `test-uuid-${++mockUuidSequence}` }));

function nativeParams(params: readonly SQLiteBindValue[]): SQLInputValue[] {
  return params.map((value) =>
    typeof value === 'boolean' ? (value ? 1 : 0) : value,
  ) as SQLInputValue[];
}

function createDatabase(): { native: DatabaseSync; database: SQLiteDatabase } {
  const native = new DatabaseSync(':memory:');
  native.exec('PRAGMA foreign_keys = ON');
  for (const migration of migrations) native.exec(migration.sql);
  native
    .prepare(
      `INSERT INTO staff_profile(
       id, display_name, role_id, pin_verifier_json, preferred_language,
       is_owner, created_at_utc, updated_at_utc
     ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      'owner',
      'Owner',
      'owner',
      '{}',
      'en',
      '2026-10-07T00:00:00.000Z',
      '2026-10-07T00:00:00.000Z',
    );
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

const PLAN: PlanInput = {
  name: 'Quarterly Strength',
  description: 'Three month plan',
  durationValue: 3,
  durationUnit: 'month',
  priceMinor: 450000,
  admissionFeeMinor: 50000,
  currencyCode: 'INR',
  taxLabel: 'GST',
  taxRateBasisPoints: 1800,
  discountType: 'percentage',
  discountValue: 1000,
  colorHex: '#0D6659',
  freezeAllowed: true,
  maxFreezeDays: 14,
  freezeExtendsEndDate: true,
  renewalBehavior: 'after-expiry',
};

const MEMBER: MemberInput = {
  name: 'José कुमार Singh',
  phone: '+91 12345-43210',
  email: 'Jose@example.com',
  dateOfBirth: '1995-04-12',
  gender: 'Male',
  address: 'Pune',
  emergencyContactName: 'Riya Singh',
  emergencyContactPhone: '1122334455',
  joiningSource: 'Referral',
  note: 'Prefers morning sessions',
};

describe('Phase2Repository', () => {
  it('creates, edits, deactivates, and retains plans', async () => {
    const { database, native } = createDatabase();
    const repository = new Phase2Repository(database);
    const id = await repository.savePlan(PLAN, 'owner');

    expect(await repository.getPlan(id)).toMatchObject({ ...PLAN, isActive: true });
    await repository.savePlan({ ...PLAN, priceMinor: 500000 }, 'owner', id);
    await repository.setPlanActive(id, false, 'owner');

    expect(await repository.getPlan(id)).toMatchObject({ priceMinor: 500000, isActive: false });
    expect(
      native.prepare("SELECT COUNT(*) AS count FROM audit_event WHERE entity_type = 'plan'").get(),
    ).toMatchObject({ count: 3 });
    native.close();
  });

  it('allocates collision-safe codes and supports Unicode, phone, and email search', async () => {
    const { database, native } = createDatabase();
    const repository = new Phase2Repository(database);
    const first = await repository.createMember(MEMBER, 'owner');
    native
      .prepare("UPDATE number_sequences SET next_value = 1 WHERE sequence_key = 'member_code'")
      .run();
    const second = await repository.createMember(
      { ...MEMBER, name: 'अनाया Patel', phone: '5123456789', email: 'anaya@example.com', note: '' },
      'owner',
    );

    expect(first.memberCode).toBe('GV-00001');
    expect(second.memberCode).toBe('GV-00002');
    await expect(repository.listMembers('कुमार')).resolves.toHaveLength(1);
    await expect(repository.listMembers('JOSÉ')).resolves.toHaveLength(1);
    await expect(repository.listMembers('12345 43210')).resolves.toHaveLength(1);
    await expect(repository.listMembers('ANAYA@example.com')).resolves.toHaveLength(1);
    native.close();
  });

  it('warns on duplicates, stores bounded photos, appends notes, and archives without deleting', async () => {
    const { database, native } = createDatabase();
    const repository = new Phase2Repository(database);
    const photo = {
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/jpeg' as const,
      width: 256,
      height: 256,
    };
    const created = await repository.createMember(MEMBER, 'owner', photo);

    await expect(repository.findDuplicates({ phone: '01234543210', email: '' })).resolves.toEqual([
      expect.objectContaining({ id: created.id, match: 'phone' }),
    ]);
    const replacement = {
      bytes: new Uint8Array([9, 8]),
      mimeType: 'image/jpeg' as const,
      width: 256,
      height: 256,
    };
    await repository.updateMember(
      created.id,
      { ...MEMBER, address: 'Mumbai', note: 'Updated note' },
      'owner',
      replacement,
    );
    await repository.setMemberArchived(created.id, true, 'owner');

    expect(await repository.listMembers('', 'active')).toHaveLength(0);
    expect(await repository.listMembers('', 'archived')).toHaveLength(1);
    expect(await repository.getMember(created.id)).toMatchObject({
      address: 'Mumbai',
      isArchived: true,
      photo: { bytes: new Uint8Array([9, 8]), width: 256, height: 256 },
      notes: [{ content: 'Updated note' }, { content: 'Prefers morning sessions' }],
    });
    expect(
      native.prepare('SELECT COUNT(*) AS count FROM member WHERE id = ?').get(created.id),
    ).toMatchObject({ count: 1 });
    expect((await repository.listMembers('', 'archived'))[0]).not.toHaveProperty('photo');

    await expect(
      repository.updateMember('missing-member', { ...MEMBER, note: 'must roll back' }, 'owner'),
    ).rejects.toThrow('MEMBER_NOT_FOUND');
    expect(
      native
        .prepare("SELECT COUNT(*) AS count FROM member_note WHERE content = 'must roll back'")
        .get(),
    ).toMatchObject({ count: 0 });

    await repository.updateMember(created.id, { ...MEMBER, note: '' }, 'owner', null);
    expect((await repository.getMember(created.id))?.photo).toBeNull();
    native.close();
  });
});
