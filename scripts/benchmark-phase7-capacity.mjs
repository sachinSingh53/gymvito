import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';

const migrations = JSON.parse(
  readFileSync(new URL('../src/data/database/migrations/manifest.json', import.meta.url), 'utf8'),
);
const database = new DatabaseSync(':memory:');
for (const migration of migrations) database.exec(migration.sql);

const at = '2026-10-09T06:00:00.000Z';
database.exec(`
  INSERT INTO staff_profile(
    id, display_name, role_id, pin_verifier_json, preferred_language,
    is_owner, created_at_utc, updated_at_utc
  ) VALUES ('staff-0', 'Owner', 'owner', '{}', 'en', 1, '${at}', '${at}');
`);
const staff = database.prepare(
  `INSERT INTO staff_profile(
     id, display_name, role_id, pin_verifier_json, preferred_language,
     created_at_utc, updated_at_utc
   ) VALUES (?, ?, 'front-desk', '{}', 'en', ?, ?)`,
);
const plan = database.prepare(
  `INSERT INTO plan(
     id, name, normalized_name, duration_value, duration_unit, price_minor,
     currency_code, created_at_utc, updated_at_utc
   ) VALUES (?, ?, ?, 1, 'month', 100000, 'INR', ?, ?)`,
);
const member = database.prepare(
  `INSERT INTO member(
     id, member_code, normalized_member_code, name, normalized_name,
     phone, normalized_phone, email, normalized_email, created_at_utc, updated_at_utc
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const membership = database.prepare(
  `INSERT INTO membership(
     id, operation_id, member_id, source_plan_id, lifecycle_state, plan_name,
     plan_color_hex, duration_value, duration_unit, start_date, end_date,
     currency_code, plan_price_minor, price_minor, admission_fee_minor,
     plan_discount_type, plan_discount_value, discount_minor, tax_rate_basis_points,
     tax_minor, total_minor, freeze_allowed, freeze_extends_end_date, renewal_behavior,
     created_by_staff_id, created_at_utc, finalized_at_utc
   ) VALUES (?, ?, ?, ?, 'finalized', ?, '#0D6659', 1, 'year', '2026-01-01',
     '2026-12-31', 'INR', 100000, 100000, 0, 'none', 0, 0, 0, 0, 100000,
     0, 0, 'after-expiry', 'staff-0', ?, ?)`,
);
const invoice = database.prepare(
  `INSERT INTO invoice(
     id, operation_id, invoice_number, member_id, membership_id, currency_code,
     subtotal_minor, admission_fee_minor, discount_minor, tax_rate_basis_points,
     tax_minor, total_minor, due_date, finalized_at_utc, created_by_staff_id, created_at_utc
   ) VALUES (?, ?, ?, ?, ?, 'INR', 100000, 0, 0, 0, 0, 100000,
     '2026-10-01', ?, 'staff-0', ?)`,
);
const payment = database.prepare(
  `INSERT INTO payment(
     id, operation_id, receipt_number, invoice_id, amount_minor, currency_code,
     method_code, method_label, received_at_utc, received_local_date,
     actor_staff_id, created_at_utc
   ) VALUES (?, ?, ?, ?, 80000, 'INR', 'upi', 'UPI / QR', ?, '2026-10-09', 'staff-0', ?)`,
);

database.exec('BEGIN');
for (let index = 1; index < 20; index += 1) {
  staff.run(`staff-${index}`, `Staff ${index}`, at, at);
}
for (let index = 0; index < 100; index += 1) {
  plan.run(`plan-${index}`, `Plan ${index}`, `plan ${index}`, at, at);
}
for (let index = 0; index < 10_000; index += 1) {
  const suffix = String(index).padStart(5, '0');
  const name = index % 50 === 0 ? `अमित Sharma ${suffix}` : `Member ${suffix}`;
  const phone = `98${String(index).padStart(8, '0')}`;
  const email = `member${suffix}@example.com`;
  member.run(
    `member-${suffix}`,
    `GV-${suffix}`,
    `GV${suffix}`,
    name,
    name.toLocaleLowerCase('en-US'),
    phone,
    phone,
    email,
    email,
    at,
    at,
  );
}
for (let index = 0; index < 50_000; index += 1) {
  const suffix = String(index).padStart(5, '0');
  const memberSuffix = String(index % 10_000).padStart(5, '0');
  const membershipId = `membership-${suffix}`;
  const invoiceId = `invoice-${suffix}`;
  membership.run(
    membershipId,
    `membership-operation-${suffix}`,
    `member-${memberSuffix}`,
    `plan-${index % 100}`,
    `Plan ${index % 100}`,
    at,
    at,
  );
  invoice.run(
    invoiceId,
    `invoice-operation-${suffix}`,
    `INV-${suffix}`,
    `member-${memberSuffix}`,
    membershipId,
    at,
    at,
  );
  payment.run(
    `payment-${suffix}`,
    `payment-operation-${suffix}`,
    `REC-${suffix}`,
    invoiceId,
    at,
    at,
  );
}
database.exec('COMMIT');

const started = performance.now();
const dashboard = database
  .prepare(
    `SELECT i.total_minor,
      COALESCE((SELECT SUM(p.amount_minor) FROM payment p WHERE p.invoice_id = i.id), 0) AS paid_minor
     FROM invoice i ORDER BY i.created_at_utc DESC`,
  )
  .all();
const totals = dashboard.reduce(
  (summary, row) => ({
    invoiced: summary.invoiced + Number(row.total_minor),
    paid: summary.paid + Number(row.paid_minor),
  }),
  { invoiced: 0, paid: 0 },
);
const dashboardMs = performance.now() - started;

if (dashboard.length !== 50_000 || totals.invoiced !== 5_000_000_000) {
  throw new Error('Phase 7 capacity fixture did not reconcile.');
}
if (dashboardMs > 2_000) {
  throw new Error(`Local dashboard benchmark exceeded 2000 ms: ${dashboardMs.toFixed(1)} ms`);
}

database.close();
console.log(
  `Phase 7 capacity fixture passed: 10,000 members and 50,000 memberships/invoices/payments; dashboard ${dashboardMs.toFixed(1)} ms.`,
);
