import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays, parseDateOnly, type DateOnly } from '@/domain/dates/date-rules';
import {
  calculateChargeBreakdown,
  calculateMembershipEndDate,
  deriveMembershipStatus,
  type ChargeBreakdown,
  type MemberMembershipStatus,
  type MembershipLifecycleState,
  type MembershipStatus,
} from '@/domain/memberships/membership';
import type { DiscountType, PlanDurationUnit, RenewalBehavior } from '@/domain/plans/plan';

import { Phase2Repository, type MemberListItem, type PlanRecord } from './phase2-repository';

export type MembershipDraftInput = Readonly<{
  operationId: string;
  memberId: string;
  planId: string;
  startDate: DateOnly;
  priorMembershipId?: string;
  priceMinor?: number;
  discountMinor?: number;
  overrideEndDate?: DateOnly;
  overrideReason: string;
  acknowledgeOverlap: boolean;
}>;

export type MembershipRecord = Readonly<{
  id: string;
  operationId: string;
  memberId: string;
  sourcePlanId: string;
  priorMembershipId: string | null;
  lifecycleState: MembershipLifecycleState;
  status: MembershipStatus;
  planName: string;
  planDescription: string;
  planColorHex: string;
  durationValue: number;
  durationUnit: PlanDurationUnit;
  startDate: DateOnly;
  endDate: DateOnly;
  currencyCode: string;
  planPriceMinor: number;
  priceMinor: number;
  admissionFeeMinor: number;
  planDiscountType: DiscountType;
  planDiscountValue: number;
  discountMinor: number;
  taxLabel: string;
  taxRateBasisPoints: number;
  taxMinor: number;
  totalMinor: number;
  renewalBehavior: RenewalBehavior;
  overrideReason: string;
  overlapAcknowledged: boolean;
  createdAtUtc: string;
  finalizedAtUtc: string | null;
}>;

export type MembershipPreview = Readonly<{
  memberId: string;
  plan: PlanRecord;
  startDate: DateOnly;
  endDate: DateOnly;
  charges: ChargeBreakdown;
  status: MembershipStatus;
  priorMembershipId: string | null;
  overlaps: readonly MembershipRecord[];
  hasOverrides: boolean;
}>;

export type MemberMembershipSummary = Readonly<{
  status: MemberMembershipStatus;
  current: MembershipRecord | null;
  upcoming: MembershipRecord | null;
  latest: MembershipRecord | null;
  historyCount: number;
}>;

export type MembershipDirectoryItem = MemberListItem & MemberMembershipSummary;

export type MembershipEventRecord = Readonly<{
  id: string;
  membershipId: string;
  eventType: 'enrolled' | 'renewed' | 'cancelled' | 'corrected';
  effectiveDate: DateOnly;
  reason: string;
  createdAtUtc: string;
}>;

export type MembershipDashboardCounts = Readonly<{
  active: number;
  upcoming: number;
  expired: number;
  noMembership: number;
  archived: number;
  expiringSoon: number;
}>;

type MembershipRow = {
  id: string;
  operation_id: string;
  member_id: string;
  source_plan_id: string;
  prior_membership_id: string | null;
  lifecycle_state: MembershipLifecycleState;
  plan_name: string;
  plan_description: string;
  plan_color_hex: string;
  duration_value: number;
  duration_unit: PlanDurationUnit;
  start_date: DateOnly;
  end_date: DateOnly;
  currency_code: string;
  plan_price_minor: number;
  price_minor: number;
  admission_fee_minor: number;
  plan_discount_type: DiscountType;
  plan_discount_value: number;
  discount_minor: number;
  tax_label: string;
  tax_rate_basis_points: number;
  tax_minor: number;
  total_minor: number;
  renewal_behavior: RenewalBehavior;
  override_reason: string;
  overlap_acknowledged: 0 | 1;
  created_by_staff_id: string;
  created_at_utc: string;
  finalized_at_utc: string | null;
};

function mapMembership(row: MembershipRow, today: DateOnly): MembershipRecord {
  return {
    id: row.id,
    operationId: row.operation_id,
    memberId: row.member_id,
    sourcePlanId: row.source_plan_id,
    priorMembershipId: row.prior_membership_id,
    lifecycleState: row.lifecycle_state,
    status: deriveMembershipStatus(
      { lifecycleState: row.lifecycle_state, startDate: row.start_date, endDate: row.end_date },
      today,
    ),
    planName: row.plan_name,
    planDescription: row.plan_description,
    planColorHex: row.plan_color_hex,
    durationValue: row.duration_value,
    durationUnit: row.duration_unit,
    startDate: row.start_date,
    endDate: row.end_date,
    currencyCode: row.currency_code,
    planPriceMinor: row.plan_price_minor,
    priceMinor: row.price_minor,
    admissionFeeMinor: row.admission_fee_minor,
    planDiscountType: row.plan_discount_type,
    planDiscountValue: row.plan_discount_value,
    discountMinor: row.discount_minor,
    taxLabel: row.tax_label,
    taxRateBasisPoints: row.tax_rate_basis_points,
    taxMinor: row.tax_minor,
    totalMinor: row.total_minor,
    renewalBehavior: row.renewal_behavior,
    overrideReason: row.override_reason,
    overlapAcknowledged: row.overlap_acknowledged === 1,
    createdAtUtc: row.created_at_utc,
    finalizedAtUtc: row.finalized_at_utc,
  };
}

function sortCurrent(left: MembershipRecord, right: MembershipRecord): number {
  return (
    right.startDate.localeCompare(left.startDate) ||
    right.createdAtUtc.localeCompare(left.createdAtUtc) ||
    right.id.localeCompare(left.id)
  );
}

export class Phase3Repository {
  private readonly phase2: Phase2Repository;

  constructor(private readonly database: SQLiteDatabase) {
    this.phase2 = new Phase2Repository(database);
  }

  async previewMembership(
    input: MembershipDraftInput,
    today: DateOnly,
  ): Promise<MembershipPreview> {
    return this.buildPreview(this.database, input, today);
  }

  async finalizeMembership(
    input: MembershipDraftInput,
    actorStaffId: string,
    today: DateOnly,
  ): Promise<MembershipRecord> {
    let result: MembershipRecord | null = null;
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      result = await this.finalizeMembershipInTransaction(transaction, input, actorStaffId, today);
    });
    if (!result) throw new Error('MEMBERSHIP_FINALIZE_FAILED');
    return result;
  }

  async finalizeMembershipInTransaction(
    transaction: SQLiteDatabase,
    input: MembershipDraftInput,
    actorStaffId: string,
    today: DateOnly,
  ): Promise<MembershipRecord> {
    const existing = await transaction.getFirstAsync<MembershipRow>(
      'SELECT * FROM membership WHERE operation_id = ?',
      input.operationId,
    );
    if (existing) {
      let expectedEndDate: DateOnly;
      let expectedCharges: ChargeBreakdown;
      try {
        expectedEndDate = calculateMembershipEndDate(
          input.startDate,
          existing.duration_value,
          existing.duration_unit,
          input.overrideEndDate,
        );
        expectedCharges = calculateChargeBreakdown(
          {
            priceMinor: existing.plan_price_minor,
            admissionFeeMinor: existing.admission_fee_minor,
            discountType: existing.plan_discount_type,
            discountValue: existing.plan_discount_value,
            taxRateBasisPoints: existing.tax_rate_basis_points,
          },
          { priceMinor: input.priceMinor, discountMinor: input.discountMinor },
        );
      } catch {
        throw new Error('MEMBERSHIP_OPERATION_CONFLICT');
      }
      if (
        existing.member_id !== input.memberId ||
        existing.source_plan_id !== input.planId ||
        existing.start_date !== input.startDate ||
        existing.prior_membership_id !== (input.priorMembershipId ?? null) ||
        existing.end_date !== expectedEndDate ||
        existing.price_minor !== expectedCharges.priceMinor ||
        existing.discount_minor !== expectedCharges.discountMinor ||
        existing.tax_minor !== expectedCharges.taxMinor ||
        existing.total_minor !== expectedCharges.totalMinor ||
        existing.override_reason !== input.overrideReason.trim() ||
        existing.overlap_acknowledged !== (input.acknowledgeOverlap ? 1 : 0) ||
        existing.created_by_staff_id !== actorStaffId
      ) {
        throw new Error('MEMBERSHIP_OPERATION_CONFLICT');
      }
      return mapMembership(existing, today);
    }
    const preview = await this.buildPreview(transaction, input, today);
    if (preview.overlaps.length && !input.acknowledgeOverlap) {
      throw new Error('MEMBERSHIP_OVERLAP_ACK_REQUIRED');
    }
    const actor = await transaction.getFirstAsync<{ is_owner: 0 | 1 }>(
      'SELECT is_owner FROM staff_profile WHERE id = ? AND is_active = 1',
      actorStaffId,
    );
    if (!actor) throw new Error('MEMBERSHIP_ACTOR_NOT_AUTHORIZED');
    if (preview.hasOverrides && actor.is_owner !== 1) {
      throw new Error('MEMBERSHIP_OVERRIDE_NOT_AUTHORIZED');
    }
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const plan = preview.plan;
    await transaction.runAsync(
      `INSERT INTO membership(
           id, operation_id, member_id, source_plan_id, prior_membership_id, lifecycle_state,
           plan_name, plan_description, plan_color_hex, duration_value, duration_unit,
           start_date, end_date, currency_code, plan_price_minor, price_minor,
           admission_fee_minor, plan_discount_type, plan_discount_value, discount_minor,
           tax_label, tax_rate_basis_points, tax_minor, total_minor, freeze_allowed,
           max_freeze_days, freeze_extends_end_date, renewal_behavior, override_reason,
           overlap_acknowledged, created_by_staff_id, created_at_utc, finalized_at_utc
         ) VALUES (?, ?, ?, ?, ?, 'finalized', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.operationId,
      input.memberId,
      input.planId,
      input.priorMembershipId ?? null,
      plan.name,
      plan.description,
      plan.colorHex,
      plan.durationValue,
      plan.durationUnit,
      preview.startDate,
      preview.endDate,
      plan.currencyCode,
      plan.priceMinor,
      preview.charges.priceMinor,
      preview.charges.admissionFeeMinor,
      plan.discountType,
      plan.discountValue,
      preview.charges.discountMinor,
      plan.taxLabel,
      plan.taxRateBasisPoints,
      preview.charges.taxMinor,
      preview.charges.totalMinor,
      plan.freezeAllowed ? 1 : 0,
      plan.maxFreezeDays,
      plan.freezeExtendsEndDate ? 1 : 0,
      plan.renewalBehavior,
      input.overrideReason.trim(),
      input.acknowledgeOverlap ? 1 : 0,
      actorStaffId,
      timestamp,
      timestamp,
    );
    const eventType = input.priorMembershipId ? 'renewed' : 'enrolled';
    await transaction.runAsync(
      `INSERT INTO membership_event(
           id, membership_id, event_type, effective_date, prior_values_json,
           new_values_json, reason, actor_staff_id, created_at_utc
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      id,
      eventType,
      preview.startDate,
      input.priorMembershipId ? JSON.stringify({ membershipId: input.priorMembershipId }) : null,
      JSON.stringify({
        planId: plan.id,
        planName: plan.name,
        startDate: preview.startDate,
        endDate: preview.endDate,
        totalMinor: preview.charges.totalMinor,
      }),
      input.overrideReason.trim(),
      actorStaffId,
      timestamp,
    );
    await transaction.runAsync(
      `INSERT INTO audit_event(
           id, occurred_at_utc, actor_staff_id, action, entity_type, entity_id, summary_code
         ) VALUES (?, ?, ?, ?, 'membership', ?, ?)`,
      randomUUID(),
      timestamp,
      actorStaffId,
      eventType === 'renewed' ? 'renew' : 'create',
      id,
      eventType === 'renewed' ? 'membership_renewed' : 'membership_enrolled',
    );
    const saved = await transaction.getFirstAsync<MembershipRow>(
      'SELECT * FROM membership WHERE id = ?',
      id,
    );
    if (!saved) throw new Error('MEMBERSHIP_FINALIZE_FAILED');
    return mapMembership(saved, today);
  }

  async listMemberships(memberId: string, today: DateOnly): Promise<readonly MembershipRecord[]> {
    const rows = await this.database.getAllAsync<MembershipRow>(
      `SELECT * FROM membership WHERE member_id = ?
       ORDER BY start_date DESC, created_at_utc DESC, id DESC`,
      memberId,
    );
    return rows.map((row) => mapMembership(row, today));
  }

  async listMembershipEvents(memberId: string): Promise<readonly MembershipEventRecord[]> {
    const rows = await this.database.getAllAsync<{
      id: string;
      membership_id: string;
      event_type: MembershipEventRecord['eventType'];
      effective_date: DateOnly;
      reason: string;
      created_at_utc: string;
    }>(
      `SELECT me.id, me.membership_id, me.event_type, me.effective_date, me.reason,
         me.created_at_utc
       FROM membership_event me
       JOIN membership m ON m.id = me.membership_id
       WHERE m.member_id = ?
       ORDER BY me.effective_date DESC, me.created_at_utc DESC, me.id DESC`,
      memberId,
    );
    return rows.map((row) => ({
      id: row.id,
      membershipId: row.membership_id,
      eventType: row.event_type,
      effectiveDate: row.effective_date,
      reason: row.reason,
      createdAtUtc: row.created_at_utc,
    }));
  }

  async getMemberSummary(memberId: string, today: DateOnly): Promise<MemberMembershipSummary> {
    const [member, memberships] = await Promise.all([
      this.phase2.getMember(memberId),
      this.listMemberships(memberId, today),
    ]);
    if (!member) throw new Error('MEMBER_NOT_FOUND');
    return this.summarize(memberships, member.isArchived);
  }

  async listMembers(
    today: DateOnly,
    query = '',
    archiveFilter: 'active' | 'archived' | 'all' = 'active',
    limit = 100,
  ): Promise<readonly MembershipDirectoryItem[]> {
    const members = await this.phase2.listMembers(query, archiveFilter, limit);
    if (!members.length) return [];
    const placeholders = members.map(() => '?').join(', ');
    const rows = await this.database.getAllAsync<MembershipRow>(
      `SELECT * FROM membership WHERE member_id IN (${placeholders})
       ORDER BY member_id, start_date DESC, created_at_utc DESC, id DESC`,
      ...members.map((member) => member.id),
    );
    const byMember = new Map<string, MembershipRecord[]>();
    for (const row of rows) {
      const existing = byMember.get(row.member_id) ?? [];
      existing.push(mapMembership(row, today));
      byMember.set(row.member_id, existing);
    }
    return members.map((member) => ({
      ...member,
      ...this.summarize(byMember.get(member.id) ?? [], member.isArchived),
    }));
  }

  async dashboardCounts(
    today: DateOnly,
    expiryWindowDays = 30,
  ): Promise<MembershipDashboardCounts> {
    const expiryEnd = addDays(today, expiryWindowDays);
    const row = await this.database.getFirstAsync<{
      active: number;
      upcoming: number;
      expired: number;
      no_membership: number;
      archived: number;
      expiring_soon: number;
    }>(
      `SELECT
        SUM(CASE WHEN m.is_archived = 0 AND EXISTS(
          SELECT 1 FROM membership x WHERE x.member_id = m.id AND x.lifecycle_state = 'finalized'
            AND x.start_date <= ? AND x.end_date >= ?
        ) THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN m.is_archived = 0 AND NOT EXISTS(
          SELECT 1 FROM membership x WHERE x.member_id = m.id AND x.lifecycle_state = 'finalized'
            AND x.start_date <= ? AND x.end_date >= ?
        ) AND EXISTS(
          SELECT 1 FROM membership x WHERE x.member_id = m.id AND x.lifecycle_state = 'finalized'
            AND x.start_date > ?
        ) THEN 1 ELSE 0 END) AS upcoming,
        SUM(CASE WHEN m.is_archived = 0 AND EXISTS(
          SELECT 1 FROM membership x WHERE x.member_id = m.id AND x.lifecycle_state = 'finalized'
        ) AND NOT EXISTS(
          SELECT 1 FROM membership x WHERE x.member_id = m.id AND x.lifecycle_state = 'finalized'
            AND x.end_date >= ?
        ) THEN 1 ELSE 0 END) AS expired,
        SUM(CASE WHEN m.is_archived = 0 AND NOT EXISTS(
          SELECT 1 FROM membership x WHERE x.member_id = m.id AND x.lifecycle_state = 'finalized'
        ) THEN 1 ELSE 0 END) AS no_membership,
        SUM(CASE WHEN m.is_archived = 1 THEN 1 ELSE 0 END) AS archived,
        SUM(CASE WHEN m.is_archived = 0 AND EXISTS(
          SELECT 1 FROM membership x WHERE x.member_id = m.id AND x.lifecycle_state = 'finalized'
            AND x.start_date <= ? AND x.end_date BETWEEN ? AND ?
        ) THEN 1 ELSE 0 END) AS expiring_soon
       FROM member m`,
      today,
      today,
      today,
      today,
      today,
      today,
      today,
      today,
      expiryEnd,
    );
    return {
      active: row?.active ?? 0,
      upcoming: row?.upcoming ?? 0,
      expired: row?.expired ?? 0,
      noMembership: row?.no_membership ?? 0,
      archived: row?.archived ?? 0,
      expiringSoon: row?.expiring_soon ?? 0,
    };
  }

  private summarize(
    memberships: readonly MembershipRecord[],
    archived: boolean,
  ): MemberMembershipSummary {
    const finalized = memberships.filter((membership) => membership.lifecycleState === 'finalized');
    const current =
      finalized.filter((membership) => membership.status === 'active').sort(sortCurrent)[0] ?? null;
    const upcoming =
      finalized
        .filter((membership) => membership.status === 'scheduled')
        .sort(
          (left, right) =>
            left.startDate.localeCompare(right.startDate) ||
            left.createdAtUtc.localeCompare(right.createdAtUtc) ||
            left.id.localeCompare(right.id),
        )[0] ?? null;
    const latest = finalized[0] ?? null;
    const status: MemberMembershipStatus = archived
      ? 'archived'
      : current
        ? 'active'
        : upcoming
          ? 'upcoming'
          : finalized.length
            ? 'expired'
            : 'no-membership';
    return { status, current, upcoming, latest, historyCount: finalized.length };
  }

  private async buildPreview(
    database: SQLiteDatabase,
    input: MembershipDraftInput,
    today: DateOnly,
  ): Promise<MembershipPreview> {
    if (!input.operationId.trim()) throw new Error('MEMBERSHIP_OPERATION_ID_REQUIRED');
    parseDateOnly(input.startDate);
    const [member, plan] = await Promise.all([
      database.getFirstAsync<{ id: string; is_archived: 0 | 1 }>(
        'SELECT id, is_archived FROM member WHERE id = ?',
        input.memberId,
      ),
      new Phase2Repository(database).getPlan(input.planId),
    ]);
    if (!member) throw new Error('MEMBER_NOT_FOUND');
    if (member.is_archived) throw new Error('MEMBER_ARCHIVED');
    if (!plan || !plan.isActive) throw new Error('PLAN_NOT_ACTIVE');
    let prior: { member_id: string; end_date: DateOnly } | null = null;
    if (input.priorMembershipId) {
      prior = await database.getFirstAsync<{ member_id: string; end_date: DateOnly }>(
        "SELECT member_id, end_date FROM membership WHERE id = ? AND lifecycle_state = 'finalized'",
        input.priorMembershipId,
      );
      if (!prior || prior.member_id !== input.memberId) throw new Error('RENEWAL_SOURCE_INVALID');
    }
    for (const value of [input.priceMinor, input.discountMinor]) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
        throw new Error('MEMBERSHIP_OVERRIDE_INVALID');
      }
    }
    const permittedStartDates = new Set<DateOnly>([today]);
    if (prior) permittedStartDates.add(addDays(prior.end_date, 1));
    const hasStartOverride = !permittedStartDates.has(input.startDate);
    const hasOverrides =
      hasStartOverride ||
      input.priceMinor !== undefined ||
      input.discountMinor !== undefined ||
      input.overrideEndDate !== undefined;
    if (hasOverrides && !input.overrideReason.trim())
      throw new Error('MEMBERSHIP_OVERRIDE_REASON_REQUIRED');
    const endDate = calculateMembershipEndDate(
      input.startDate,
      plan.durationValue,
      plan.durationUnit,
      input.overrideEndDate,
    );
    const charges = calculateChargeBreakdown(
      {
        priceMinor: plan.priceMinor,
        admissionFeeMinor: plan.admissionFeeMinor,
        discountType: plan.discountType,
        discountValue: plan.discountValue,
        taxRateBasisPoints: plan.taxRateBasisPoints,
      },
      { priceMinor: input.priceMinor, discountMinor: input.discountMinor },
    );
    const overlapRows = await database.getAllAsync<MembershipRow>(
      `SELECT * FROM membership
       WHERE member_id = ? AND lifecycle_state = 'finalized'
         AND start_date <= ? AND end_date >= ?
       ORDER BY start_date DESC, created_at_utc DESC, id DESC`,
      input.memberId,
      endDate,
      input.startDate,
    );
    return {
      memberId: input.memberId,
      plan,
      startDate: input.startDate,
      endDate,
      charges,
      status: deriveMembershipStatus(
        { lifecycleState: 'finalized', startDate: input.startDate, endDate },
        today,
      ),
      priorMembershipId: input.priorMembershipId ?? null,
      overlaps: overlapRows.map((row) => mapMembership(row, today)),
      hasOverrides,
    };
  }
}
