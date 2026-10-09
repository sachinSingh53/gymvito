import type { SQLiteDatabase } from 'expo-sqlite';

import type { PaymentMethod } from '@/domain/billing/money';
import { addDays, type DateOnly } from '@/domain/dates/date-rules';
import type { MemberMembershipStatus } from '@/domain/memberships/membership';

import { Phase3Repository, type MembershipDirectoryItem } from './phase3-repository';
import { Phase4Repository, type InvoiceRecord } from './phase4-repository';

export type MemberReportCategory =
  | 'all'
  | 'active'
  | 'upcoming'
  | 'expired'
  | 'no-membership'
  | 'archived'
  | 'expiring'
  | 'new-joins';

export type ReportFilters = Readonly<{
  fromDate: DateOnly;
  toDate: DateOnly;
  planId: string | null;
  membershipStatus: MemberMembershipStatus | null;
  paymentMethod: PaymentMethod | null;
}>;

export type MemberReportRow = MembershipDirectoryItem &
  Readonly<{ reportDate: DateOnly; planId: string | null }>;

export type FinanceReportSummary = Readonly<{
  recordedCollectionsMinor: number;
  invoicedMinor: number;
  discountsMinor: number;
  taxMinor: number;
  refundsMinor: number;
  outstandingMinor: number;
  overdueMinor: number;
  invoiceCount: number;
  paymentCount: number;
}>;

export type FinanceReport = Readonly<{
  summary: FinanceReportSummary;
  invoices: readonly InvoiceRecord[];
}>;

export type ExportDataset = 'members' | 'memberships' | 'invoices' | 'payments';
export type ExportTable = Readonly<{
  headers: readonly string[];
  rows: readonly (readonly unknown[])[];
}>;

type ExportRow = Record<string, string | number | null>;

const datePart = (timestamp: string): DateOnly => timestamp.slice(0, 10) as DateOnly;

function inRange(date: DateOnly, filters: ReportFilters): boolean {
  return date >= filters.fromDate && date <= filters.toDate;
}

export class Phase6Repository {
  private readonly phase3: Phase3Repository;
  private readonly phase4: Phase4Repository;

  constructor(private readonly database: SQLiteDatabase) {
    this.phase3 = new Phase3Repository(database);
    this.phase4 = new Phase4Repository(database);
  }

  async memberReport(
    today: DateOnly,
    category: MemberReportCategory,
    filters: ReportFilters,
  ): Promise<readonly MemberReportRow[]> {
    const members = await this.phase3.listMembers(today, '', 'all', 100_000);
    const expiryEnd = filters.toDate || addDays(today, 30);
    return members
      .map((member) => {
        const membership = member.current ?? member.upcoming ?? member.latest;
        return {
          ...member,
          reportDate: datePart(member.createdAtUtc),
          planId: membership?.sourcePlanId ?? null,
        };
      })
      .filter((member) => {
        if (filters.planId && member.planId !== filters.planId) return false;
        if (filters.membershipStatus && member.status !== filters.membershipStatus) return false;
        if (category === 'archived') return member.isArchived;
        if (member.isArchived) return category === 'all';
        if (category === 'new-joins') return inRange(member.reportDate, filters);
        if (category === 'expiring') {
          return (
            member.status === 'active' &&
            !!member.current &&
            member.current.endDate >= filters.fromDate &&
            member.current.endDate <= expiryEnd
          );
        }
        return category === 'all' || member.status === category;
      })
      .sort(
        (left, right) =>
          right.reportDate.localeCompare(left.reportDate) || left.name.localeCompare(right.name),
      );
  }

  async financeReport(today: DateOnly, filters: ReportFilters): Promise<FinanceReport> {
    const [allInvoices, payments, refunds, members] = await Promise.all([
      this.database.getAllAsync<{
        id: string;
        member_id: string;
        plan_id: string;
        finalized_date: DateOnly;
      }>(
        `SELECT i.id, i.member_id, m.source_plan_id AS plan_id, substr(i.finalized_at_utc, 1, 10) AS finalized_date
         FROM invoice i JOIN membership m ON m.id = i.membership_id`,
      ),
      this.database.getAllAsync<{
        invoice_id: string;
        amount_minor: number;
        method_code: PaymentMethod;
        received_local_date: DateOnly;
        state: 'recorded' | 'corrected';
      }>(`SELECT invoice_id, amount_minor, method_code, received_local_date, state FROM payment`),
      this.database.getAllAsync<{
        invoice_id: string;
        amount_minor: number;
        created_date: DateOnly;
      }>(
        `SELECT invoice_id, amount_minor, substr(created_at_utc, 1, 10) AS created_date
         FROM financial_adjustment
         WHERE adjustment_type = 'payment-reversal'`,
      ),
      filters.membershipStatus
        ? this.phase3.listMembers(today, '', 'all', 100_000)
        : Promise.resolve([]),
    ]);
    const eligibleMembers = filters.membershipStatus
      ? new Set(
          members
            .filter((member) => member.status === filters.membershipStatus)
            .map((member) => member.id),
        )
      : null;
    const dimensionRows = allInvoices
      .filter((row) => !filters.planId || row.plan_id === filters.planId)
      .filter((row) => !eligibleMembers || eligibleMembers.has(row.member_id))
      .filter(
        (row) =>
          !filters.paymentMethod ||
          payments.some(
            (payment) =>
              payment.invoice_id === row.id && payment.method_code === filters.paymentMethod,
          ),
      );
    const eligibleIds = new Set(dimensionRows.map((row) => row.id));
    const invoiceIds = new Set(
      dimensionRows.filter((row) => inRange(row.finalized_date, filters)).map((row) => row.id),
    );
    const invoiceDetails = await Promise.all(
      [...invoiceIds].map((id) => this.phase4.getInvoice(id, today)),
    );
    const invoices = invoiceDetails
      .filter((detail): detail is NonNullable<typeof detail> => detail !== null)
      .map((detail) => detail.invoice)
      .filter((invoice) => {
        if (!filters.membershipStatus) return true;
        if (filters.membershipStatus === 'expired') return invoice.dueStatus === 'overdue';
        return true;
      });
    const selectedPayments = payments.filter(
      (payment) =>
        eligibleIds.has(payment.invoice_id) &&
        inRange(payment.received_local_date, filters) &&
        (!filters.paymentMethod || payment.method_code === filters.paymentMethod),
    );
    return {
      summary: {
        recordedCollectionsMinor: selectedPayments
          .filter((payment) => payment.state === 'recorded')
          .reduce((sum, payment) => sum + payment.amount_minor, 0),
        invoicedMinor: invoices.reduce((sum, invoice) => sum + invoice.totalMinor, 0),
        discountsMinor: invoices.reduce((sum, invoice) => sum + invoice.discountMinor, 0),
        taxMinor: invoices.reduce((sum, invoice) => sum + invoice.taxMinor, 0),
        refundsMinor: Math.abs(
          refunds
            .filter(
              (refund) =>
                eligibleIds.has(refund.invoice_id) && inRange(refund.created_date, filters),
            )
            .reduce((sum, refund) => sum + Math.min(0, refund.amount_minor), 0),
        ),
        outstandingMinor: invoices.reduce((sum, invoice) => sum + invoice.balanceMinor, 0),
        overdueMinor: invoices
          .filter((invoice) => invoice.dueStatus === 'overdue')
          .reduce((sum, invoice) => sum + invoice.balanceMinor, 0),
        invoiceCount: invoices.length,
        paymentCount: selectedPayments.length,
      },
      invoices,
    };
  }

  async exportTable(dataset: ExportDataset): Promise<ExportTable> {
    const queryByDataset: Record<ExportDataset, string> = {
      members: `SELECT id, member_code, name, phone, email, date_of_birth, gender, address,
        emergency_contact_name, emergency_contact_phone, joining_source, is_archived,
        created_at_utc, updated_at_utc FROM member ORDER BY created_at_utc, id`,
      memberships: `SELECT id, operation_id, member_id, source_plan_id, prior_membership_id,
        lifecycle_state, plan_name, start_date, end_date, currency_code, price_minor,
        admission_fee_minor, discount_minor, tax_label, tax_rate_basis_points, tax_minor,
        total_minor, created_by_staff_id, created_at_utc, finalized_at_utc
        FROM membership ORDER BY created_at_utc, id`,
      invoices: `SELECT id, operation_id, invoice_number, member_id, membership_id, currency_code,
        subtotal_minor, admission_fee_minor, discount_minor, tax_label, tax_rate_basis_points,
        tax_minor, total_minor, due_date, finalized_at_utc, created_by_staff_id, created_at_utc
        FROM invoice ORDER BY created_at_utc, id`,
      payments: `SELECT id, operation_id, receipt_number, invoice_id, amount_minor, currency_code,
        method_code, method_label, transaction_reference, note, received_at_utc,
        received_local_date, actor_staff_id, state, created_at_utc
        FROM payment ORDER BY created_at_utc, id`,
    };
    const rows = await this.database.getAllAsync<ExportRow>(queryByDataset[dataset]);
    const headers = rows.length
      ? Object.keys(rows[0])
      : {
          members: ['id', 'member_code', 'name', 'phone', 'email', 'created_at_utc'],
          memberships: ['id', 'member_id', 'source_plan_id', 'start_date', 'end_date'],
          invoices: ['id', 'invoice_number', 'member_id', 'total_minor', 'due_date'],
          payments: ['id', 'receipt_number', 'invoice_id', 'amount_minor', 'received_local_date'],
        }[dataset];
    return { headers, rows: rows.map((row) => headers.map((header) => row[header] ?? '')) };
  }
}
