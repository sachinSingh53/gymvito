import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import migrations from '@/data/database/migrations/manifest.json';
import { Phase2Repository } from '@/data/repositories/phase2-repository';
import { Phase4Repository } from '@/data/repositories/phase4-repository';
import type { MemberInput } from '@/domain/members/member';
import type { PlanInput } from '@/domain/plans/plan';

let mockUuidSequence = 400;
jest.mock('expo-crypto', () => ({ randomUUID: () => `phase4-uuid-${++mockUuidSequence}` }));

function nativeParams(params: readonly SQLiteBindValue[]): SQLInputValue[] {
  return params.map((value) =>
    typeof value === 'boolean' ? (value ? 1 : 0) : value,
  ) as SQLInputValue[];
}

function createDatabase(failPayment = false): { native: DatabaseSync; database: SQLiteDatabase } {
  const native = new DatabaseSync(':memory:');
  native.exec('PRAGMA foreign_keys = ON');
  for (const migration of migrations) native.exec(migration.sql);
  native
    .prepare(
      `INSERT INTO settings(
        id, language, onboarding_step, created_at_utc, updated_at_utc,
        invoice_prefix, receipt_prefix
      ) VALUES (1, 'en', 'complete', ?, ?, 'INV', 'REC')`,
    )
    .run('2026-10-08T00:00:00.000Z', '2026-10-08T00:00:00.000Z');
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
      if (failPayment && /INSERT INTO payment\(/.test(sql))
        throw new Error('SIMULATED_FORCE_CLOSE');
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
  name: 'Annual Strength',
  description: 'Full floor access',
  durationValue: 1,
  durationUnit: 'year',
  priceMinor: 180_000,
  admissionFeeMinor: 20_000,
  currencyCode: 'INR',
  taxLabel: 'GST',
  taxRateBasisPoints: 1_800,
  discountType: 'fixed',
  discountValue: 10_000,
  colorHex: '#0D6659',
  freezeAllowed: false,
  maxFreezeDays: null,
  freezeExtendsEndDate: false,
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
  return { memberId: member.id, planId };
}

describe('Phase4Repository', () => {
  it('upgrades a populated Phase 3 fixture and retains memberships', () => {
    const native = new DatabaseSync(':memory:');
    native.exec('PRAGMA foreign_keys = ON');
    for (const migration of migrations.slice(0, 4)) native.exec(migration.sql);
    native
      .prepare(
        `INSERT INTO staff_profile(
          id, display_name, role_id, pin_verifier_json, preferred_language,
          is_owner, created_at_utc, updated_at_utc
        ) VALUES ('legacy-owner', 'Legacy Owner', 'owner', '{}', 'en', 1, ?, ?)`,
      )
      .run('2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
    native
      .prepare(
        `INSERT INTO plan(
          id, name, normalized_name, duration_value, duration_unit, price_minor,
          currency_code, color_hex, created_at_utc, updated_at_utc
        ) VALUES ('legacy-plan', 'Legacy Annual', 'legacy annual', 1, 'year', 120000,
          'INR', '#0D6659', ?, ?)`,
      )
      .run('2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
    native
      .prepare(
        `INSERT INTO member(
          id, member_code, normalized_member_code, name, normalized_name,
          created_at_utc, updated_at_utc
        ) VALUES ('legacy-member', 'GV-00001', 'GV00001', 'Legacy Member',
          'legacy member', ?, ?)`,
      )
      .run('2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
    native
      .prepare(
        `INSERT INTO membership(
          id, operation_id, member_id, source_plan_id, lifecycle_state,
          plan_name, plan_color_hex, duration_value, duration_unit, start_date,
          end_date, currency_code, plan_price_minor, price_minor,
          admission_fee_minor, plan_discount_type, plan_discount_value,
          discount_minor, tax_rate_basis_points, tax_minor, total_minor,
          freeze_allowed, freeze_extends_end_date, renewal_behavior,
          created_by_staff_id, created_at_utc, finalized_at_utc
        ) VALUES (
          'legacy-membership', 'legacy-enroll', 'legacy-member', 'legacy-plan', 'finalized',
          'Legacy Annual', '#0D6659', 1, 'year', '2026-10-01', '2027-09-30',
          'INR', 120000, 120000, 5000, 'fixed', 10000, 10000, 1800,
          20700, 135700, 0, 0, 'after-expiry', 'legacy-owner', ?, ?
        )`,
      )
      .run('2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
    native.exec(migrations[4]!.sql);
    expect(
      native
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('invoice', 'invoice_line', 'payment', 'financial_adjustment')",
        )
        .get(),
    ).toMatchObject({ count: 4 });
    expect(
      native
        .prepare("SELECT next_value FROM number_sequences WHERE sequence_key = 'invoice'")
        .get(),
    ).toMatchObject({ next_value: 2 });
    expect(
      native
        .prepare(
          `SELECT invoice_number, membership_id, subtotal_minor, discount_minor,
            tax_minor, total_minor FROM invoice WHERE membership_id = 'legacy-membership'`,
        )
        .get(),
    ).toMatchObject({
      invoice_number: 'INV-000001',
      membership_id: 'legacy-membership',
      subtotal_minor: 125_000,
      discount_minor: 10_000,
      tax_minor: 20_700,
      total_minor: 135_700,
    });
    expect(
      native
        .prepare(
          "SELECT COUNT(*) AS count FROM invoice_line WHERE invoice_id = 'phase4-invoice-legacy-membership'",
        )
        .get(),
    ).toMatchObject({ count: 4 });
    native.close();
  });

  it('atomically finalizes membership, invoice, full payment, and unique numbers', async () => {
    const { database, native } = createDatabase();
    const { memberId, planId } = await seed(database);
    const repository = new Phase4Repository(database);
    const result = await repository.finalizeMembershipWithBilling(
      {
        operationId: 'enroll-and-pay',
        memberId,
        planId,
        startDate: '2026-10-08',
        overrideReason: '',
        acknowledgeOverlap: false,
      },
      'owner',
      '2026-10-08',
      '2026-10-08',
      {
        operationId: 'payment-1',
        amountMinor: 224_200,
        methodCode: 'upi',
        methodLabel: 'UPI / QR',
        transactionReference: 'UTR-42',
        note: '',
        receivedAtUtc: '2026-10-08T04:30:00.000Z',
        receivedLocalDate: '2026-10-08',
      },
    );
    expect(result.invoice).toMatchObject({
      invoiceNumber: 'INV-000001',
      subtotalMinor: 200_000,
      discountMinor: 10_000,
      taxMinor: 34_200,
      totalMinor: 224_200,
      balanceMinor: 0,
      status: 'paid',
    });
    expect(result.payment).toMatchObject({ receiptNumber: 'REC-000001', amountMinor: 224_200 });
    expect(native.prepare('SELECT COUNT(*) AS count FROM audit_event').get()).toMatchObject({
      count: 5,
    });
    const retry = await repository.finalizeMembershipWithBilling(
      {
        operationId: 'enroll-and-pay',
        memberId,
        planId,
        startDate: '2026-10-08',
        overrideReason: '',
        acknowledgeOverlap: false,
      },
      'owner',
      '2026-10-08',
      '2026-10-08',
      {
        operationId: 'payment-1',
        amountMinor: 224_200,
        methodCode: 'upi',
        methodLabel: 'UPI / QR',
        transactionReference: 'UTR-42',
        note: '',
        receivedAtUtc: '2026-10-08T04:30:00.000Z',
        receivedLocalDate: '2026-10-08',
      },
    );
    expect(retry.invoice.id).toBe(result.invoice.id);
    expect(native.prepare('SELECT COUNT(*) AS count FROM invoice').get()).toMatchObject({
      count: 1,
    });
    expect(native.prepare('SELECT COUNT(*) AS count FROM payment').get()).toMatchObject({
      count: 1,
    });
    await expect(
      repository.finalizeMembershipWithBilling(
        {
          operationId: 'enroll-and-pay',
          memberId,
          planId,
          startDate: '2026-10-08',
          overrideReason: '',
          acknowledgeOverlap: false,
        },
        'owner',
        '2026-10-08',
        '2026-10-09',
      ),
    ).rejects.toThrow('INVOICE_OPERATION_CONFLICT');
    await expect(
      repository.recordPayment(
        {
          operationId: 'payment-1',
          invoiceId: result.invoice.id,
          amountMinor: 224_200,
          methodCode: 'upi',
          methodLabel: 'UPI / QR',
          transactionReference: 'DIFFERENT-UTR',
          note: '',
          receivedAtUtc: '2026-10-08T04:30:00.000Z',
          receivedLocalDate: '2026-10-08',
        },
        'owner',
        '2026-10-08',
      ),
    ).rejects.toThrow('PAYMENT_OPERATION_CONFLICT');
    native.close();
  });

  it('supports partial then later settlement and rejects overpayment', async () => {
    const { database, native } = createDatabase();
    const { memberId, planId } = await seed(database);
    const repository = new Phase4Repository(database);
    const { invoice } = await repository.finalizeMembershipWithBilling(
      {
        operationId: 'enroll-due',
        memberId,
        planId,
        startDate: '2026-10-08',
        overrideReason: '',
        acknowledgeOverlap: false,
      },
      'owner',
      '2026-10-08',
      '2026-10-07',
    );
    await repository.recordPayment(
      {
        operationId: 'partial',
        invoiceId: invoice.id,
        amountMinor: 100_000,
        methodCode: 'cash',
        methodLabel: 'Cash',
        transactionReference: '',
        note: '',
        receivedAtUtc: '2026-10-08T05:00:00.000Z',
        receivedLocalDate: '2026-10-08',
      },
      'owner',
      '2026-10-08',
    );
    const partial = await repository.getInvoice(invoice.id, '2026-10-08');
    expect(partial?.invoice).toMatchObject({
      balanceMinor: 124_200,
      status: 'partially-paid',
      dueStatus: 'overdue',
    });
    await expect(
      repository.recordPayment(
        {
          operationId: 'too-much',
          invoiceId: invoice.id,
          amountMinor: 124_201,
          methodCode: 'cash',
          methodLabel: 'Cash',
          transactionReference: '',
          note: '',
          receivedAtUtc: '2026-10-08T05:10:00.000Z',
          receivedLocalDate: '2026-10-08',
        },
        'owner',
        '2026-10-08',
      ),
    ).rejects.toThrow('PAYMENT_EXCEEDS_OUTSTANDING');
    await expect(repository.getFinancialDashboard('2026-10-08')).resolves.toEqual({
      invoicedMinor: 224_200,
      recordedPaidMinor: 100_000,
      outstandingMinor: 124_200,
      overdueMinor: 124_200,
      todayRecordedMinor: 100_000,
    });
    await repository.recordPayment(
      {
        operationId: 'settle',
        invoiceId: invoice.id,
        amountMinor: 124_200,
        methodCode: 'card',
        methodLabel: 'Card / POS',
        transactionReference: 'RRN-9',
        note: '',
        receivedAtUtc: '2026-10-08T05:20:00.000Z',
        receivedLocalDate: '2026-10-08',
      },
      'owner',
      '2026-10-08',
    );
    expect((await repository.getInvoice(invoice.id, '2026-10-08'))?.invoice.status).toBe('paid');
    expect(
      native
        .prepare("SELECT next_value FROM number_sequences WHERE sequence_key = 'receipt'")
        .get(),
    ).toMatchObject({ next_value: 3 });
    native.close();
  });

  it('records an owner correction without deleting the payment', async () => {
    const { database, native } = createDatabase();
    const { memberId, planId } = await seed(database);
    const repository = new Phase4Repository(database);
    const { invoice } = await repository.finalizeMembershipWithBilling(
      {
        operationId: 'enroll-correct',
        memberId,
        planId,
        startDate: '2026-10-08',
        overrideReason: '',
        acknowledgeOverlap: false,
      },
      'owner',
      '2026-10-08',
      null,
    );
    const payment = await repository.recordPayment(
      {
        operationId: 'wrong-payment',
        invoiceId: invoice.id,
        amountMinor: 50_000,
        methodCode: 'cash',
        methodLabel: 'Cash',
        transactionReference: '',
        note: '',
        receivedAtUtc: '2026-10-08T05:00:00.000Z',
        receivedLocalDate: '2026-10-08',
      },
      'owner',
      '2026-10-08',
    );
    await repository.correctPayment(
      'correct-payment-1',
      payment.id,
      'Entered against wrong cash count',
      'owner',
    );
    expect((await repository.getInvoice(invoice.id, '2026-10-08'))?.invoice.balanceMinor).toBe(
      224_200,
    );
    expect(native.prepare('SELECT state FROM payment WHERE id = ?').get(payment.id)).toMatchObject({
      state: 'corrected',
    });
    expect(native.prepare('SELECT COUNT(*) AS count FROM payment').get()).toMatchObject({
      count: 1,
    });
    native.close();
  });

  it('persists owner-configured number prefixes and payment method labels', async () => {
    const { database, native } = createDatabase();
    const repository = new Phase4Repository(database);
    const settings = await repository.getBillingSettings();
    expect(settings.paymentMethods).toHaveLength(6);
    await expect(
      repository.updateBillingSettings(
        {
          ...settings,
          paymentMethods: settings.paymentMethods.map((method) => ({
            ...method,
            isActive: false,
          })),
        },
        'owner',
      ),
    ).rejects.toThrow('INVALID_PAYMENT_METHODS');
    await repository.updateBillingSettings(
      {
        invoicePrefix: 'tax-inv',
        receiptPrefix: 'paid',
        paymentMethods: settings.paymentMethods.map((method) =>
          method.code === 'upi' ? { ...method, label: 'UPI Counter QR' } : method,
        ),
      },
      'owner',
    );
    await expect(repository.getBillingSettings()).resolves.toMatchObject({
      invoicePrefix: 'TAX-INV',
      receiptPrefix: 'PAID',
      paymentMethods: expect.arrayContaining([
        { code: 'upi', label: 'UPI Counter QR', isActive: true, sortOrder: 10 },
      ]),
    });
    expect(
      native
        .prepare(
          "SELECT COUNT(*) AS count FROM audit_event WHERE summary_code = 'billing_settings_changed'",
        )
        .get(),
    ).toMatchObject({ count: 1 });
    native.close();
  });

  it('rolls back membership and invoice if the optional payment write fails', async () => {
    const { database, native } = createDatabase(true);
    const { memberId, planId } = await seed(database);
    await expect(
      new Phase4Repository(database).finalizeMembershipWithBilling(
        {
          operationId: 'force-close',
          memberId,
          planId,
          startDate: '2026-10-08',
          overrideReason: '',
          acknowledgeOverlap: false,
        },
        'owner',
        '2026-10-08',
        null,
        {
          operationId: 'force-close-payment',
          amountMinor: 1,
          methodCode: 'cash',
          methodLabel: 'Cash',
          transactionReference: '',
          note: '',
          receivedAtUtc: '2026-10-08T05:00:00.000Z',
          receivedLocalDate: '2026-10-08',
        },
      ),
    ).rejects.toThrow('SIMULATED_FORCE_CLOSE');
    expect(native.prepare('SELECT COUNT(*) AS count FROM membership').get()).toMatchObject({
      count: 0,
    });
    expect(native.prepare('SELECT COUNT(*) AS count FROM invoice').get()).toMatchObject({
      count: 0,
    });
    native.close();
  });
});
