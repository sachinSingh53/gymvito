import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import migrations from '@/data/database/migrations/manifest.json';
import { Phase2Repository } from '@/data/repositories/phase2-repository';
import { Phase3Repository } from '@/data/repositories/phase3-repository';
import type { DateOnly } from '@/domain/dates/date-rules';
import type { MemberInput } from '@/domain/members/member';
import type { PlanInput } from '@/domain/plans/plan';

let mockUuidSequence = 100;
jest.mock('expo-crypto', () => ({ randomUUID: () => `phase3-uuid-${++mockUuidSequence}` }));

function nativeParams(params: readonly SQLiteBindValue[]): SQLInputValue[] {
  return params.map((value) =>
    typeof value === 'boolean' ? (value ? 1 : 0) : value,
  ) as SQLInputValue[];
}

function createDatabase(failMembershipEvent = false): {
  native: DatabaseSync;
  database: SQLiteDatabase;
} {
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
      '2026-10-08T00:00:00.000Z',
      '2026-10-08T00:00:00.000Z',
    );
  const adapter = {
    execAsync: async (sql: string) => native.exec(sql),
    runAsync: async (sql: string, ...params: SQLiteBindValue[]) => {
      if (failMembershipEvent && /INSERT INTO membership_event/.test(sql)) {
        throw new Error('SIMULATED_FORCE_CLOSE');
      }
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
  name: 'Monthly Strength',
  description: 'Full floor access',
  durationValue: 1,
  durationUnit: 'month',
  priceMinor: 100_000,
  admissionFeeMinor: 10_000,
  currencyCode: 'INR',
  taxLabel: 'GST',
  taxRateBasisPoints: 1_800,
  discountType: 'percentage',
  discountValue: 1_000,
  colorHex: '#0D6659',
  freezeAllowed: true,
  maxFreezeDays: 14,
  freezeExtendsEndDate: true,
  renewalBehavior: 'after-expiry',
};

const MEMBER: MemberInput = {
  name: 'Amit Sharma',
  phone: '+91 98201 44521',
  email: 'amit@example.com',
  dateOfBirth: '',
  gender: '',
  address: 'Mumbai',
  emergencyContactName: '',
  emergencyContactPhone: '',
  joiningSource: 'Walk-in',
  note: '',
};

async function seed(database: SQLiteDatabase) {
  const phase2 = new Phase2Repository(database);
  const planId = await phase2.savePlan(PLAN, 'owner');
  const member = await phase2.createMember(MEMBER, 'owner');
  return { memberId: member.id, phase2, planId };
}

describe('Phase3Repository', () => {
  it('upgrades a populated Phase 2 schema fixture without changing existing records', () => {
    const native = new DatabaseSync(':memory:');
    native.exec('PRAGMA foreign_keys = ON');
    for (const migration of migrations.slice(0, 3)) native.exec(migration.sql);
    native
      .prepare(
        `INSERT INTO member(
          id, member_code, normalized_member_code, name, normalized_name,
          created_at_utc, updated_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'legacy-member',
        'GV-00001',
        'GV00001',
        'Legacy Member',
        'legacy member',
        '2026-10-07',
        '2026-10-07',
      );
    native.exec(migrations[3]!.sql);

    expect(
      native.prepare('SELECT name FROM member WHERE id = ?').get('legacy-member'),
    ).toMatchObject({
      name: 'Legacy Member',
    });
    expect(
      native
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('membership', 'membership_event')",
        )
        .get(),
    ).toMatchObject({ count: 2 });
    native.close();
  });

  it('previews and finalizes an immutable plan snapshot with one required event', async () => {
    const { database, native } = createDatabase();
    const { memberId, phase2, planId } = await seed(database);
    const repository = new Phase3Repository(database);
    const input = {
      operationId: 'enroll-1',
      memberId,
      planId,
      startDate: '2026-01-31' as DateOnly,
      overrideReason: 'Member requested a scheduled start',
      acknowledgeOverlap: false,
    };

    await expect(repository.previewMembership(input, '2026-01-15')).resolves.toMatchObject({
      startDate: '2026-01-31',
      endDate: '2026-02-28',
      status: 'scheduled',
      charges: { discountMinor: 10_000, taxMinor: 18_000, totalMinor: 118_000 },
    });
    const membership = await repository.finalizeMembership(input, 'owner', '2026-01-15');
    await phase2.savePlan({ ...PLAN, name: 'Edited Plan', priceMinor: 999_999 }, 'owner', planId);
    await phase2.setPlanActive(planId, false, 'owner');

    expect((await repository.listMemberships(memberId, '2026-02-01'))[0]).toMatchObject({
      id: membership.id,
      planName: 'Monthly Strength',
      planPriceMinor: 100_000,
      status: 'active',
    });
    expect(native.prepare('SELECT COUNT(*) AS count FROM membership_event').get()).toMatchObject({
      count: 1,
    });
    native.close();
  });

  it('is idempotent after commit and rejects unacknowledged overlap', async () => {
    const { database, native } = createDatabase();
    const { memberId, planId } = await seed(database);
    const repository = new Phase3Repository(database);
    const firstInput = {
      operationId: 'enroll-1',
      memberId,
      planId,
      startDate: '2026-01-01' as DateOnly,
      overrideReason: '',
      acknowledgeOverlap: false,
    };
    const first = await repository.finalizeMembership(firstInput, 'owner', '2026-01-01');
    await expect(
      repository.finalizeMembership(firstInput, 'owner', '2026-01-01'),
    ).resolves.toMatchObject({
      id: first.id,
    });
    await expect(
      repository.finalizeMembership({ ...firstInput, priceMinor: 1 }, 'owner', '2026-01-01'),
    ).rejects.toThrow('MEMBERSHIP_OPERATION_CONFLICT');
    await expect(
      repository.finalizeMembership(
        { ...firstInput, operationId: 'renew-1', priorMembershipId: first.id },
        'owner',
        '2026-01-01',
      ),
    ).rejects.toThrow('MEMBERSHIP_OVERLAP_ACK_REQUIRED');
    const renewal = await repository.finalizeMembership(
      {
        ...firstInput,
        operationId: 'renew-1',
        priorMembershipId: first.id,
        acknowledgeOverlap: true,
      },
      'owner',
      '2026-01-01',
    );
    expect(renewal.priorMembershipId).toBe(first.id);
    await expect(repository.getMemberSummary(memberId, '2026-01-01')).resolves.toMatchObject({
      current: { id: renewal.id },
      historyCount: 2,
    });
    expect(native.prepare('SELECT COUNT(*) AS count FROM membership').get()).toMatchObject({
      count: 2,
    });
    expect(native.prepare('SELECT COUNT(*) AS count FROM membership_event').get()).toMatchObject({
      count: 2,
    });
    native.close();
  });

  it('rolls back membership when its event cannot be committed', async () => {
    const { database, native } = createDatabase(true);
    const { memberId, planId } = await seed(database);
    await expect(
      new Phase3Repository(database).finalizeMembership(
        {
          operationId: 'force-close',
          memberId,
          planId,
          startDate: '2026-01-01',
          overrideReason: '',
          acknowledgeOverlap: false,
        },
        'owner',
        '2026-01-01',
      ),
    ).rejects.toThrow('SIMULATED_FORCE_CLOSE');
    expect(native.prepare('SELECT COUNT(*) AS count FROM membership').get()).toMatchObject({
      count: 0,
    });
    native.close();
  });

  it('derives deterministic member and dashboard projections', async () => {
    const { database, native } = createDatabase();
    const { memberId, planId } = await seed(database);
    const phase2 = new Phase2Repository(database);
    const repository = new Phase3Repository(database);
    await repository.finalizeMembership(
      {
        operationId: 'active',
        memberId,
        planId,
        startDate: '2026-01-01',
        overrideReason: 'Backdated enrollment correction',
        acknowledgeOverlap: false,
      },
      'owner',
      '2026-01-10',
    );
    const upcomingMember = await phase2.createMember({ ...MEMBER, name: 'Future Member' }, 'owner');
    await repository.finalizeMembership(
      {
        operationId: 'future',
        memberId: upcomingMember.id,
        planId,
        startDate: '2026-04-01',
        overrideReason: 'Scheduled future start',
        acknowledgeOverlap: false,
      },
      'owner',
      '2026-01-10',
    );
    await phase2.createMember({ ...MEMBER, name: 'No Plan Member' }, 'owner');

    await expect(repository.getMemberSummary(memberId, '2026-01-10')).resolves.toMatchObject({
      status: 'active',
      current: { planName: 'Monthly Strength' },
      historyCount: 1,
    });
    await expect(repository.dashboardCounts('2026-01-10')).resolves.toMatchObject({
      active: 1,
      upcoming: 1,
      expired: 0,
      noMembership: 1,
      archived: 0,
      expiringSoon: 1,
    });
    await expect(repository.listMembers('2026-01-10', '', 'active')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: memberId, status: 'active', historyCount: 1 }),
        expect.objectContaining({ id: upcomingMember.id, status: 'upcoming', historyCount: 1 }),
        expect.objectContaining({ status: 'no-membership', historyCount: 0 }),
      ]),
    );
    native.close();
  });
});
