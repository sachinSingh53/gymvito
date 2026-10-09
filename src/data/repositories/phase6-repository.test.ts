import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import migrations from '@/data/database/migrations/manifest.json';
import { Phase6Repository, type ReportFilters } from './phase6-repository';

function databaseFixture(): { native: DatabaseSync; database: SQLiteDatabase } {
  const native = new DatabaseSync(':memory:');
  native.exec('PRAGMA foreign_keys = ON');
  for (const migration of migrations) native.exec(migration.sql);
  const values = (params: readonly SQLiteBindValue[]) => params as SQLInputValue[];
  const adapter = {
    getFirstAsync: async <T>(sql: string, ...params: SQLiteBindValue[]) =>
      (native.prepare(sql).get(...values(params)) as T | undefined) ?? null,
    getAllAsync: async <T>(sql: string, ...params: SQLiteBindValue[]) =>
      native.prepare(sql).all(...values(params)) as T[],
  } as unknown as SQLiteDatabase;
  return { native, database: adapter };
}

const FILTERS: ReportFilters = {
  fromDate: '2026-10-01',
  toDate: '2026-10-31',
  planId: null,
  membershipStatus: null,
  paymentMethod: null,
};

function seed(native: DatabaseSync) {
  native.exec(`
    INSERT INTO staff_profile(id, display_name, role_id, pin_verifier_json, preferred_language, is_owner, created_at_utc, updated_at_utc)
      VALUES ('owner', 'Owner', 'owner', '{}', 'en', 1, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z');
    INSERT INTO plan(id, name, normalized_name, duration_value, duration_unit, price_minor, currency_code, color_hex, created_at_utc, updated_at_utc)
      VALUES ('plan', 'Strength, Plus', 'strength plus', 1, 'month', 100000, 'INR', '#0D6659', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z');
    INSERT INTO member(id, member_code, normalized_member_code, name, normalized_name, phone, normalized_phone, created_at_utc, updated_at_utc)
      VALUES ('member', 'GV-00001', 'GV00001', '=साक्षी', '=साक्षी', '+915000000001', '915000000001', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z');
    INSERT INTO membership(id, operation_id, member_id, source_plan_id, lifecycle_state, plan_name, plan_color_hex, duration_value, duration_unit, start_date, end_date, currency_code, plan_price_minor, price_minor, admission_fee_minor, plan_discount_type, plan_discount_value, discount_minor, tax_rate_basis_points, tax_minor, total_minor, freeze_allowed, freeze_extends_end_date, renewal_behavior, created_by_staff_id, created_at_utc, finalized_at_utc)
      VALUES ('membership', 'membership-op', 'member', 'plan', 'finalized', 'Strength, Plus', '#0D6659', 1, 'month', '2026-10-01', '2026-10-31', 'INR', 100000, 100000, 0, 'fixed', 10000, 10000, 1000, 9000, 99000, 0, 0, 'ask', 'owner', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z');
    INSERT INTO invoice(id, operation_id, invoice_number, member_id, membership_id, currency_code, subtotal_minor, admission_fee_minor, discount_minor, tax_rate_basis_points, tax_minor, total_minor, due_date, finalized_at_utc, created_by_staff_id, created_at_utc)
      VALUES ('invoice', 'invoice-op', 'INV-000001', 'member', 'membership', 'INR', 100000, 0, 10000, 1000, 9000, 99000, '2026-10-05', '2026-10-01T00:00:00Z', 'owner', '2026-10-01T00:00:00Z');
    INSERT INTO payment(id, operation_id, receipt_number, invoice_id, amount_minor, currency_code, method_code, method_label, received_at_utc, received_local_date, actor_staff_id, created_at_utc)
      VALUES ('payment', 'payment-op', 'REC-000001', 'invoice', 40000, 'INR', 'upi', 'UPI', '2026-10-02T06:00:00Z', '2026-10-02', 'owner', '2026-10-02T06:00:00Z');
  `);
}

describe('Phase6Repository', () => {
  it('reconciles report totals with member and ledger detail rows', async () => {
    const { native, database } = databaseFixture();
    seed(native);
    const repository = new Phase6Repository(database);
    const members = await repository.memberReport('2026-10-09', 'active', FILTERS);
    const finance = await repository.financeReport('2026-10-09', FILTERS);
    expect(members).toHaveLength(1);
    expect(finance.summary).toMatchObject({
      recordedCollectionsMinor: 40000,
      invoicedMinor: 99000,
      discountsMinor: 10000,
      taxMinor: 9000,
      outstandingMinor: 59000,
      overdueMinor: 59000,
      invoiceCount: 1,
      paymentCount: 1,
    });
    expect(finance.invoices[0]?.balanceMinor).toBe(finance.summary.outstandingMinor);
    native.close();
  });

  it('exports separate portable tables with stable identifiers and ISO dates', async () => {
    const { native, database } = databaseFixture();
    seed(native);
    const repository = new Phase6Repository(database);
    const [members, memberships, invoices, payments] = await Promise.all([
      repository.exportTable('members'),
      repository.exportTable('memberships'),
      repository.exportTable('invoices'),
      repository.exportTable('payments'),
    ]);
    expect(members.headers).toEqual(expect.arrayContaining(['id', 'phone', 'created_at_utc']));
    expect(members.rows[0]).toEqual(expect.arrayContaining(['member', '+915000000001']));
    expect(memberships.headers).toEqual(expect.arrayContaining(['start_date', 'end_date']));
    expect(invoices.rows[0]).toEqual(expect.arrayContaining(['invoice', '2026-10-05']));
    expect(payments.rows[0]).toEqual(expect.arrayContaining(['payment', '2026-10-02']));
    native.close();
  });
});
