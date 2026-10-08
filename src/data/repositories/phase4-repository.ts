import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { MembershipDraftInput, MembershipRecord } from '@/data/repositories/phase3-repository';
import { Phase3Repository } from '@/data/repositories/phase3-repository';
import { parseDateOnly, type DateOnly } from '@/domain/dates/date-rules';
import {
  calculateInvoiceAmounts,
  deriveDueStatus,
  deriveInvoiceStatus,
  formatSequence,
  invoiceBalanceMinor,
  validateRecordedPayment,
  type DueStatus,
  type InvoiceStatus,
  type PaymentMethod,
} from '@/domain/billing/money';

export type RecordPaymentInput = Readonly<{
  operationId: string;
  invoiceId: string;
  amountMinor: number;
  methodCode: PaymentMethod;
  methodLabel: string;
  transactionReference: string;
  note: string;
  receivedAtUtc: string;
  receivedLocalDate: DateOnly;
}>;

export type PaymentRecord = Readonly<{
  id: string;
  operationId: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  amountMinor: number;
  currencyCode: string;
  methodCode: PaymentMethod;
  methodLabel: string;
  transactionReference: string;
  note: string;
  receivedAtUtc: string;
  receivedLocalDate: DateOnly;
  actorStaffId: string;
  state: 'recorded' | 'corrected';
}>;

export type InvoiceRecord = Readonly<{
  id: string;
  operationId: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  memberPhone: string;
  membershipId: string;
  planName: string;
  currencyCode: string;
  subtotalMinor: number;
  admissionFeeMinor: number;
  discountMinor: number;
  taxLabel: string;
  taxRateBasisPoints: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  adjustmentMinor: number;
  balanceMinor: number;
  status: InvoiceStatus;
  dueDate: DateOnly | null;
  dueStatus: DueStatus;
  finalizedAtUtc: string;
  createdByStaffId: string;
}>;

export type InvoiceLineRecord = Readonly<{
  id: string;
  lineType: 'membership' | 'admission-fee' | 'discount' | 'tax';
  description: string;
  quantity: number;
  unitAmountMinor: number;
  lineTotalMinor: number;
}>;

export type InvoiceDetail = Readonly<{
  invoice: InvoiceRecord;
  lines: readonly InvoiceLineRecord[];
  payments: readonly PaymentRecord[];
}>;

export type MemberFinanceSummary = Readonly<{
  invoicedMinor: number;
  paidMinor: number;
  balanceMinor: number;
  overdueMinor: number;
  invoiceCount: number;
  paymentCount: number;
  latestOutstandingInvoiceId: string | null;
}>;

export type FinancialDashboard = Readonly<{
  invoicedMinor: number;
  recordedPaidMinor: number;
  outstandingMinor: number;
  overdueMinor: number;
  todayRecordedMinor: number;
}>;

export type PaymentMethodOption = Readonly<{
  code: PaymentMethod;
  label: string;
  isActive: boolean;
  sortOrder: number;
}>;

export type BillingSettings = Readonly<{
  invoicePrefix: string;
  receiptPrefix: string;
  paymentMethods: readonly PaymentMethodOption[];
}>;

type InvoiceRow = {
  id: string;
  operation_id: string;
  invoice_number: string;
  member_id: string;
  member_name: string;
  member_code: string;
  member_phone: string;
  membership_id: string;
  plan_name: string;
  currency_code: string;
  subtotal_minor: number;
  admission_fee_minor: number;
  discount_minor: number;
  tax_label: string;
  tax_rate_basis_points: number;
  tax_minor: number;
  total_minor: number;
  paid_minor: number;
  adjustment_minor: number;
  due_date: DateOnly | null;
  finalized_at_utc: string;
  created_by_staff_id: string;
};

type PaymentRow = {
  id: string;
  operation_id: string;
  receipt_number: string;
  invoice_id: string;
  invoice_number: string;
  member_id: string;
  member_name: string;
  amount_minor: number;
  currency_code: string;
  method_code: PaymentMethod;
  method_label: string;
  transaction_reference: string;
  note: string;
  received_at_utc: string;
  received_local_date: DateOnly;
  actor_staff_id: string;
  state: 'recorded' | 'corrected';
};

const INVOICE_SELECT = `
  SELECT i.*, member.name AS member_name, member.member_code AS member_code,
    member.phone AS member_phone,
    membership.plan_name AS plan_name,
    COALESCE((SELECT SUM(p.amount_minor) FROM payment p WHERE p.invoice_id = i.id), 0) AS paid_minor,
    COALESCE((SELECT SUM(a.amount_minor) FROM financial_adjustment a WHERE a.invoice_id = i.id), 0) AS adjustment_minor
  FROM invoice i
  JOIN member ON member.id = i.member_id
  JOIN membership ON membership.id = i.membership_id`;

const PAYMENT_SELECT = `
  SELECT p.*, i.invoice_number, i.member_id, member.name AS member_name
  FROM payment p
  JOIN invoice i ON i.id = p.invoice_id
  JOIN member ON member.id = i.member_id`;

function mapInvoice(row: InvoiceRow, today: DateOnly): InvoiceRecord {
  const balanceMinor = invoiceBalanceMinor(row.total_minor, row.paid_minor, row.adjustment_minor);
  return {
    id: row.id,
    operationId: row.operation_id,
    invoiceNumber: row.invoice_number,
    memberId: row.member_id,
    memberName: row.member_name,
    memberCode: row.member_code,
    memberPhone: row.member_phone,
    membershipId: row.membership_id,
    planName: row.plan_name,
    currencyCode: row.currency_code,
    subtotalMinor: row.subtotal_minor,
    admissionFeeMinor: row.admission_fee_minor,
    discountMinor: row.discount_minor,
    taxLabel: row.tax_label,
    taxRateBasisPoints: row.tax_rate_basis_points,
    taxMinor: row.tax_minor,
    totalMinor: row.total_minor,
    paidMinor: row.paid_minor,
    adjustmentMinor: row.adjustment_minor,
    balanceMinor,
    status: deriveInvoiceStatus(row.total_minor, balanceMinor),
    dueDate: row.due_date,
    dueStatus: deriveDueStatus(balanceMinor, row.due_date, today),
    finalizedAtUtc: row.finalized_at_utc,
    createdByStaffId: row.created_by_staff_id,
  };
}

function mapPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    operationId: row.operation_id,
    receiptNumber: row.receipt_number,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    memberId: row.member_id,
    memberName: row.member_name,
    amountMinor: row.amount_minor,
    currencyCode: row.currency_code,
    methodCode: row.method_code,
    methodLabel: row.method_label,
    transactionReference: row.transaction_reference,
    note: row.note,
    receivedAtUtc: row.received_at_utc,
    receivedLocalDate: row.received_local_date,
    actorStaffId: row.actor_staff_id,
    state: row.state,
  };
}

export class Phase4Repository {
  private readonly phase3: Phase3Repository;

  constructor(private readonly database: SQLiteDatabase) {
    this.phase3 = new Phase3Repository(database);
  }

  async finalizeMembershipWithBilling(
    input: MembershipDraftInput,
    actorStaffId: string,
    today: DateOnly,
    dueDate: DateOnly | null,
    payment?: Omit<RecordPaymentInput, 'invoiceId'>,
  ): Promise<{
    membership: MembershipRecord;
    invoice: InvoiceRecord;
    payment: PaymentRecord | null;
  }> {
    let result: {
      membership: MembershipRecord;
      invoice: InvoiceRecord;
      payment: PaymentRecord | null;
    } | null = null;
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      const membership = await this.phase3.finalizeMembershipInTransaction(
        transaction,
        input,
        actorStaffId,
        today,
      );
      const invoice = await this.ensureInvoiceInTransaction(
        transaction,
        membership,
        actorStaffId,
        today,
        dueDate,
      );
      const recorded = payment
        ? await this.recordPaymentInTransaction(
            transaction,
            { ...payment, invoiceId: invoice.id },
            actorStaffId,
            today,
          )
        : null;
      const refreshed = await this.getInvoiceFrom(transaction, invoice.id, today);
      result = { membership, invoice: refreshed, payment: recorded };
    });
    if (!result) throw new Error('BILLING_FINALIZE_FAILED');
    return result;
  }

  async recordPayment(
    input: RecordPaymentInput,
    actorStaffId: string,
    today: DateOnly,
  ): Promise<PaymentRecord> {
    let result: PaymentRecord | null = null;
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      result = await this.recordPaymentInTransaction(transaction, input, actorStaffId, today);
    });
    if (!result) throw new Error('PAYMENT_RECORD_FAILED');
    return result;
  }

  async correctPayment(
    operationId: string,
    paymentId: string,
    reason: string,
    actorStaffId: string,
  ): Promise<void> {
    if (!reason.trim()) throw new Error('CORRECTION_REASON_REQUIRED');
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      const actor = await transaction.getFirstAsync<{ is_owner: 0 | 1 }>(
        'SELECT is_owner FROM staff_profile WHERE id = ? AND is_active = 1',
        actorStaffId,
      );
      if (actor?.is_owner !== 1) throw new Error('CORRECTION_NOT_AUTHORIZED');
      const existing = await transaction.getFirstAsync<{ payment_id: string | null }>(
        'SELECT payment_id FROM financial_adjustment WHERE operation_id = ?',
        operationId,
      );
      if (existing) {
        if (existing.payment_id !== paymentId) throw new Error('CORRECTION_OPERATION_CONFLICT');
        return;
      }
      const payment = await transaction.getFirstAsync<{
        invoice_id: string;
        amount_minor: number;
        state: 'recorded' | 'corrected';
      }>('SELECT invoice_id, amount_minor, state FROM payment WHERE id = ?', paymentId);
      if (!payment) throw new Error('PAYMENT_NOT_FOUND');
      if (payment.state === 'corrected') throw new Error('PAYMENT_ALREADY_CORRECTED');
      const timestamp = new Date().toISOString();
      await transaction.runAsync(
        `INSERT INTO financial_adjustment(
          id, operation_id, invoice_id, payment_id, adjustment_type, amount_minor,
          reason, actor_staff_id, created_at_utc
        ) VALUES (?, ?, ?, ?, 'payment-reversal', ?, ?, ?, ?)`,
        randomUUID(),
        operationId,
        payment.invoice_id,
        paymentId,
        -payment.amount_minor,
        reason.trim(),
        actorStaffId,
        timestamp,
      );
      await transaction.runAsync("UPDATE payment SET state = 'corrected' WHERE id = ?", paymentId);
      await this.insertAudit(
        transaction,
        actorStaffId,
        'correct',
        'payment',
        paymentId,
        'payment_corrected',
        timestamp,
      );
    });
  }

  async getInvoice(invoiceId: string, today: DateOnly): Promise<InvoiceDetail | null> {
    const invoice = await this.getInvoiceFrom(this.database, invoiceId, today).catch(() => null);
    if (!invoice) return null;
    const [lines, payments] = await Promise.all([
      this.database.getAllAsync<{
        id: string;
        line_type: InvoiceLineRecord['lineType'];
        description: string;
        quantity: number;
        unit_amount_minor: number;
        line_total_minor: number;
      }>(
        `SELECT id, line_type, description, quantity, unit_amount_minor, line_total_minor
         FROM invoice_line WHERE invoice_id = ? ORDER BY line_order`,
        invoiceId,
      ),
      this.listPaymentsForInvoice(invoiceId),
    ]);
    return {
      invoice,
      lines: lines.map((line) => ({
        id: line.id,
        lineType: line.line_type,
        description: line.description,
        quantity: line.quantity,
        unitAmountMinor: line.unit_amount_minor,
        lineTotalMinor: line.line_total_minor,
      })),
      payments,
    };
  }

  async listOutstandingInvoices(today: DateOnly): Promise<readonly InvoiceRecord[]> {
    const rows = await this.database.getAllAsync<InvoiceRow>(
      `${INVOICE_SELECT} ORDER BY CASE WHEN i.due_date IS NULL THEN 1 ELSE 0 END,
       i.due_date, i.created_at_utc DESC`,
    );
    return rows.map((row) => mapInvoice(row, today)).filter((invoice) => invoice.balanceMinor > 0);
  }

  async listMemberInvoices(memberId: string, today: DateOnly): Promise<readonly InvoiceRecord[]> {
    const rows = await this.database.getAllAsync<InvoiceRow>(
      `${INVOICE_SELECT} WHERE i.member_id = ? ORDER BY i.created_at_utc DESC, i.id DESC`,
      memberId,
    );
    return rows.map((row) => mapInvoice(row, today));
  }

  async listRecentPayments(limit = 100): Promise<readonly PaymentRecord[]> {
    const rows = await this.database.getAllAsync<PaymentRow>(
      `${PAYMENT_SELECT} ORDER BY p.received_at_utc DESC, p.id DESC LIMIT ?`,
      limit,
    );
    return rows.map(mapPayment);
  }

  async getMemberFinanceSummary(memberId: string, today: DateOnly): Promise<MemberFinanceSummary> {
    const [invoices, payments] = await Promise.all([
      this.listMemberInvoices(memberId, today),
      this.database.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM payment p
         JOIN invoice i ON i.id = p.invoice_id WHERE i.member_id = ?`,
        memberId,
      ),
    ]);
    const outstanding = invoices.filter((invoice) => invoice.balanceMinor > 0);
    return {
      invoicedMinor: invoices.reduce((sum, invoice) => sum + invoice.totalMinor, 0),
      paidMinor: invoices.reduce(
        (sum, invoice) => sum + invoice.paidMinor + invoice.adjustmentMinor,
        0,
      ),
      balanceMinor: invoices.reduce((sum, invoice) => sum + invoice.balanceMinor, 0),
      overdueMinor: invoices
        .filter((invoice) => invoice.dueStatus === 'overdue')
        .reduce((sum, invoice) => sum + invoice.balanceMinor, 0),
      invoiceCount: invoices.length,
      paymentCount: payments?.count ?? 0,
      latestOutstandingInvoiceId: outstanding[0]?.id ?? null,
    };
  }

  async getFinancialDashboard(today: DateOnly): Promise<FinancialDashboard> {
    const [rows, todayPayments] = await Promise.all([
      this.database.getAllAsync<InvoiceRow>(`${INVOICE_SELECT} ORDER BY i.created_at_utc DESC`),
      this.database.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount_minor), 0) AS total FROM payment
         WHERE received_local_date = ? AND state = 'recorded'`,
        today,
      ),
    ]);
    const invoices = rows.map((row) => mapInvoice(row, today));
    return {
      invoicedMinor: invoices.reduce((sum, invoice) => sum + invoice.totalMinor, 0),
      recordedPaidMinor: invoices.reduce(
        (sum, invoice) => sum + invoice.paidMinor + invoice.adjustmentMinor,
        0,
      ),
      outstandingMinor: invoices.reduce((sum, invoice) => sum + invoice.balanceMinor, 0),
      overdueMinor: invoices
        .filter((invoice) => invoice.dueStatus === 'overdue')
        .reduce((sum, invoice) => sum + invoice.balanceMinor, 0),
      todayRecordedMinor: todayPayments?.total ?? 0,
    };
  }

  async getBillingSettings(): Promise<BillingSettings> {
    const [settings, methods] = await Promise.all([
      this.database.getFirstAsync<{ invoice_prefix: string; receipt_prefix: string }>(
        'SELECT invoice_prefix, receipt_prefix FROM settings WHERE id = 1',
      ),
      this.database.getAllAsync<{
        code: PaymentMethod;
        label: string;
        is_active: 0 | 1;
        sort_order: number;
      }>(
        'SELECT code, label, is_active, sort_order FROM payment_method_option ORDER BY sort_order',
      ),
    ]);
    if (!settings) throw new Error('BILLING_SETTINGS_NOT_FOUND');
    return {
      invoicePrefix: settings.invoice_prefix,
      receiptPrefix: settings.receipt_prefix,
      paymentMethods: methods.map((method) => ({
        code: method.code,
        label: method.label,
        isActive: method.is_active === 1,
        sortOrder: method.sort_order,
      })),
    };
  }

  async updateBillingSettings(input: BillingSettings, actorStaffId: string): Promise<void> {
    const prefixPattern = /^[A-Z0-9-]{1,8}$/;
    const invoicePrefix = input.invoicePrefix.trim().toUpperCase();
    const receiptPrefix = input.receiptPrefix.trim().toUpperCase();
    if (!prefixPattern.test(invoicePrefix) || !prefixPattern.test(receiptPrefix)) {
      throw new Error('INVALID_NUMBER_PREFIX');
    }
    if (
      input.paymentMethods.length !== 6 ||
      new Set(input.paymentMethods.map((method) => method.code)).size !== 6 ||
      !input.paymentMethods.some((method) => method.isActive) ||
      input.paymentMethods.some(
        (method) => method.label.trim().length < 1 || method.label.trim().length > 30,
      )
    ) {
      throw new Error('INVALID_PAYMENT_METHODS');
    }
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      const actor = await transaction.getFirstAsync<{ is_owner: 0 | 1 }>(
        'SELECT is_owner FROM staff_profile WHERE id = ? AND is_active = 1',
        actorStaffId,
      );
      if (actor?.is_owner !== 1) throw new Error('BILLING_SETTINGS_NOT_AUTHORIZED');
      await transaction.runAsync(
        'UPDATE settings SET invoice_prefix = ?, receipt_prefix = ?, updated_at_utc = ? WHERE id = 1',
        invoicePrefix,
        receiptPrefix,
        new Date().toISOString(),
      );
      for (const method of input.paymentMethods) {
        await transaction.runAsync(
          `UPDATE payment_method_option SET label = ?, is_active = ?, sort_order = ? WHERE code = ?`,
          method.label.trim(),
          method.isActive ? 1 : 0,
          method.sortOrder,
          method.code,
        );
      }
      await this.insertAudit(
        transaction,
        actorStaffId,
        'update',
        'settings',
        'billing',
        'billing_settings_changed',
        new Date().toISOString(),
      );
    });
  }

  private async ensureInvoiceInTransaction(
    transaction: SQLiteDatabase,
    membership: MembershipRecord,
    actorStaffId: string,
    today: DateOnly,
    dueDate: DateOnly | null,
  ): Promise<InvoiceRecord> {
    const operationId = `invoice:${membership.operationId}`;
    const existing = await transaction.getFirstAsync<InvoiceRow>(
      `${INVOICE_SELECT} WHERE i.operation_id = ?`,
      operationId,
    );
    if (existing) {
      if (
        existing.membership_id !== membership.id ||
        existing.due_date !== dueDate ||
        existing.created_by_staff_id !== actorStaffId
      ) {
        throw new Error('INVOICE_OPERATION_CONFLICT');
      }
      return mapInvoice(existing, today);
    }
    if (dueDate) parseDateOnly(dueDate);
    const actor = await transaction.getFirstAsync<{ id: string }>(
      'SELECT id FROM staff_profile WHERE id = ? AND is_active = 1',
      actorStaffId,
    );
    if (!actor) throw new Error('PAYMENT_ACTOR_NOT_AUTHORIZED');
    const prefixes = await transaction.getFirstAsync<{ invoice_prefix: string }>(
      'SELECT invoice_prefix FROM settings WHERE id = 1',
    );
    const amounts = calculateInvoiceAmounts(membership);
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const invoiceNumber = await this.allocateNumber(
      transaction,
      'invoice',
      prefixes?.invoice_prefix ?? 'INV',
    );
    await transaction.runAsync(
      `INSERT INTO invoice(
        id, operation_id, invoice_number, member_id, membership_id, currency_code,
        subtotal_minor, admission_fee_minor, discount_minor, tax_label,
        tax_rate_basis_points, tax_minor, total_minor, due_date, finalized_at_utc,
        created_by_staff_id, created_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      operationId,
      invoiceNumber,
      membership.memberId,
      membership.id,
      membership.currencyCode,
      amounts.subtotalMinor,
      membership.admissionFeeMinor,
      amounts.discountMinor,
      membership.taxLabel,
      membership.taxRateBasisPoints,
      amounts.taxMinor,
      amounts.totalMinor,
      dueDate,
      timestamp,
      actorStaffId,
      timestamp,
    );
    const lines: readonly [InvoiceLineRecord['lineType'], string, number][] = [
      ['membership', membership.planName, membership.priceMinor],
      ['admission-fee', 'Admission fee', membership.admissionFeeMinor],
      ['discount', 'Discount', -membership.discountMinor],
      ['tax', membership.taxLabel || 'Tax', membership.taxMinor],
    ];
    let lineOrder = 0;
    for (const [lineType, description, amountMinor] of lines) {
      if (amountMinor === 0) continue;
      await transaction.runAsync(
        `INSERT INTO invoice_line(
          id, invoice_id, line_order, line_type, description, quantity,
          unit_amount_minor, line_total_minor
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        randomUUID(),
        id,
        lineOrder++,
        lineType,
        description,
        amountMinor,
        amountMinor,
      );
    }
    await this.insertAudit(
      transaction,
      actorStaffId,
      'create',
      'invoice',
      id,
      'invoice_created',
      timestamp,
    );
    return this.getInvoiceFrom(transaction, id, today);
  }

  private async recordPaymentInTransaction(
    transaction: SQLiteDatabase,
    input: RecordPaymentInput,
    actorStaffId: string,
    today: DateOnly,
  ): Promise<PaymentRecord> {
    const existing = await transaction.getFirstAsync<PaymentRow>(
      `${PAYMENT_SELECT} WHERE p.operation_id = ?`,
      input.operationId,
    );
    if (existing) {
      if (
        existing.invoice_id !== input.invoiceId ||
        existing.amount_minor !== input.amountMinor ||
        existing.method_code !== input.methodCode ||
        existing.method_label !== input.methodLabel.trim() ||
        existing.transaction_reference !== input.transactionReference.trim() ||
        existing.note !== input.note.trim() ||
        existing.received_at_utc !== input.receivedAtUtc ||
        existing.received_local_date !== input.receivedLocalDate ||
        existing.actor_staff_id !== actorStaffId
      ) {
        throw new Error('PAYMENT_OPERATION_CONFLICT');
      }
      return mapPayment(existing);
    }
    const actor = await transaction.getFirstAsync<{ id: string }>(
      'SELECT id FROM staff_profile WHERE id = ? AND is_active = 1',
      actorStaffId,
    );
    if (!actor) throw new Error('PAYMENT_ACTOR_NOT_AUTHORIZED');
    const invoice = await this.getInvoiceFrom(transaction, input.invoiceId, today);
    validateRecordedPayment(input.amountMinor, invoice.balanceMinor);
    if (!input.methodLabel.trim()) throw new Error('PAYMENT_METHOD_LABEL_REQUIRED');
    parseDateOnly(input.receivedLocalDate);
    if (!Number.isFinite(Date.parse(input.receivedAtUtc))) {
      throw new Error('PAYMENT_RECEIVED_AT_INVALID');
    }
    const prefixes = await transaction.getFirstAsync<{ receipt_prefix: string }>(
      'SELECT receipt_prefix FROM settings WHERE id = 1',
    );
    const id = randomUUID();
    const receiptNumber = await this.allocateNumber(
      transaction,
      'receipt',
      prefixes?.receipt_prefix ?? 'REC',
    );
    const timestamp = new Date().toISOString();
    await transaction.runAsync(
      `INSERT INTO payment(
        id, operation_id, receipt_number, invoice_id, amount_minor, currency_code,
        method_code, method_label, transaction_reference, note, received_at_utc,
        received_local_date, actor_staff_id, state, created_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?)`,
      id,
      input.operationId,
      receiptNumber,
      input.invoiceId,
      input.amountMinor,
      invoice.currencyCode,
      input.methodCode,
      input.methodLabel.trim(),
      input.transactionReference.trim(),
      input.note.trim(),
      input.receivedAtUtc,
      input.receivedLocalDate,
      actorStaffId,
      timestamp,
    );
    await this.insertAudit(
      transaction,
      actorStaffId,
      'create',
      'payment',
      id,
      'payment_recorded',
      timestamp,
    );
    const saved = await transaction.getFirstAsync<PaymentRow>(
      `${PAYMENT_SELECT} WHERE p.id = ?`,
      id,
    );
    if (!saved) throw new Error('PAYMENT_RECORD_FAILED');
    return mapPayment(saved);
  }

  private async getInvoiceFrom(
    database: SQLiteDatabase,
    invoiceId: string,
    today: DateOnly,
  ): Promise<InvoiceRecord> {
    const row = await database.getFirstAsync<InvoiceRow>(
      `${INVOICE_SELECT} WHERE i.id = ?`,
      invoiceId,
    );
    if (!row) throw new Error('INVOICE_NOT_FOUND');
    return mapInvoice(row, today);
  }

  private async listPaymentsForInvoice(invoiceId: string): Promise<readonly PaymentRecord[]> {
    const rows = await this.database.getAllAsync<PaymentRow>(
      `${PAYMENT_SELECT} WHERE p.invoice_id = ? ORDER BY p.received_at_utc DESC, p.id DESC`,
      invoiceId,
    );
    return rows.map(mapPayment);
  }

  private async allocateNumber(
    transaction: SQLiteDatabase,
    key: 'invoice' | 'receipt',
    prefix: string,
  ): Promise<string> {
    const row = await transaction.getFirstAsync<{ next_value: number }>(
      'SELECT next_value FROM number_sequences WHERE sequence_key = ?',
      key,
    );
    if (!row) throw new Error('NUMBER_SEQUENCE_MISSING');
    await transaction.runAsync(
      'UPDATE number_sequences SET next_value = next_value + 1 WHERE sequence_key = ?',
      key,
    );
    return formatSequence(prefix, row.next_value);
  }

  private async insertAudit(
    transaction: SQLiteDatabase,
    actorStaffId: string,
    action: string,
    entityType: string,
    entityId: string,
    summaryCode: string,
    timestamp: string,
  ): Promise<void> {
    await transaction.runAsync(
      `INSERT INTO audit_event(
        id, occurred_at_utc, actor_staff_id, action, entity_type, entity_id, summary_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      timestamp,
      actorStaffId,
      action,
      entityType,
      entityId,
      summaryCode,
    );
  }
}
