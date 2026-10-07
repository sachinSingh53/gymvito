import {
  calculateInclusiveEndDate,
  compareDateOnly,
  daysBetweenDateOnly,
  parseDateOnly,
  type DateOnly,
} from '@/domain/dates/date-rules';
import type { DiscountType, PlanDurationUnit } from '@/domain/plans/plan';

export type MembershipLifecycleState = 'draft' | 'finalized' | 'cancelled';
export type MembershipStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'cancelled';
export type MemberMembershipStatus =
  'active' | 'upcoming' | 'expired' | 'no-membership' | 'archived';

export type MembershipTerms = Readonly<{
  startDate: DateOnly;
  endDate: DateOnly;
  durationValue: number;
  durationUnit: PlanDurationUnit;
  priceMinor: number;
  admissionFeeMinor: number;
  discountType: DiscountType;
  discountValue: number;
  taxRateBasisPoints: number;
}>;

export type ChargeBreakdown = Readonly<{
  priceMinor: number;
  admissionFeeMinor: number;
  discountMinor: number;
  taxableMinor: number;
  taxMinor: number;
  totalMinor: number;
}>;

export function deriveMembershipStatus(
  membership: Pick<MembershipTerms, 'startDate' | 'endDate'> & {
    lifecycleState: MembershipLifecycleState;
  },
  today: DateOnly,
): MembershipStatus {
  parseDateOnly(today);
  if (membership.lifecycleState === 'draft') return 'draft';
  if (membership.lifecycleState === 'cancelled') return 'cancelled';
  if (compareDateOnly(today, membership.startDate) < 0) return 'scheduled';
  if (compareDateOnly(today, membership.endDate) > 0) return 'expired';
  return 'active';
}

export function calculateDiscountMinor(
  priceMinor: number,
  discountType: DiscountType,
  discountValue: number,
): number {
  if (discountType === 'none') return 0;
  if (discountType === 'fixed') return Math.min(priceMinor, discountValue);
  return Math.min(priceMinor, Math.round((priceMinor * discountValue) / 10_000));
}

export function calculateChargeBreakdown(
  terms: Pick<
    MembershipTerms,
    'priceMinor' | 'admissionFeeMinor' | 'discountType' | 'discountValue' | 'taxRateBasisPoints'
  >,
  overrides: { priceMinor?: number; discountMinor?: number } = {},
): ChargeBreakdown {
  const priceMinor = overrides.priceMinor ?? terms.priceMinor;
  const defaultDiscount = calculateDiscountMinor(
    priceMinor,
    terms.discountType,
    terms.discountValue,
  );
  const discountMinor = Math.min(
    priceMinor + terms.admissionFeeMinor,
    overrides.discountMinor ?? defaultDiscount,
  );
  const taxableMinor = Math.max(0, priceMinor + terms.admissionFeeMinor - discountMinor);
  const taxMinor = Math.round((taxableMinor * terms.taxRateBasisPoints) / 10_000);
  return {
    priceMinor,
    admissionFeeMinor: terms.admissionFeeMinor,
    discountMinor,
    taxableMinor,
    taxMinor,
    totalMinor: taxableMinor + taxMinor,
  };
}

export function calculateMembershipEndDate(
  startDate: DateOnly,
  durationValue: number,
  durationUnit: PlanDurationUnit,
  overrideEndDate?: DateOnly,
): DateOnly {
  if (overrideEndDate) {
    parseDateOnly(overrideEndDate);
    if (compareDateOnly(overrideEndDate, startDate) < 0) throw new Error('END_BEFORE_START');
    return overrideEndDate;
  }
  return calculateInclusiveEndDate(startDate, { count: durationValue, unit: durationUnit });
}

export function membershipsOverlap(
  left: Pick<MembershipTerms, 'startDate' | 'endDate'>,
  right: Pick<MembershipTerms, 'startDate' | 'endDate'>,
): boolean {
  return (
    compareDateOnly(left.startDate, right.endDate) <= 0 &&
    compareDateOnly(right.startDate, left.endDate) <= 0
  );
}

export function membershipProgress(
  membership: Pick<MembershipTerms, 'startDate' | 'endDate'>,
  today: DateOnly,
): { elapsedDays: number; totalDays: number; remainingDays: number; ratio: number } {
  const totalDays = daysBetweenDateOnly(membership.startDate, membership.endDate) + 1;
  const elapsedDays = Math.max(
    0,
    Math.min(totalDays, daysBetweenDateOnly(membership.startDate, today) + 1),
  );
  return {
    elapsedDays,
    totalDays,
    remainingDays: Math.max(0, daysBetweenDateOnly(today, membership.endDate)),
    ratio: totalDays > 0 ? elapsedDays / totalDays : 0,
  };
}

export function validateMembershipOverride(input: {
  priceMinor?: number;
  discountMinor?: number;
  overrideEndDate?: string;
  overrideReason: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (
    input.priceMinor !== undefined &&
    (!Number.isSafeInteger(input.priceMinor) || input.priceMinor < 0)
  ) {
    errors.priceMinor = 'invalid';
  }
  if (
    input.discountMinor !== undefined &&
    (!Number.isSafeInteger(input.discountMinor) || input.discountMinor < 0)
  ) {
    errors.discountMinor = 'invalid';
  }
  if (input.overrideEndDate) {
    try {
      parseDateOnly(input.overrideEndDate);
    } catch {
      errors.overrideEndDate = 'invalid';
    }
  }
  if (
    (input.priceMinor !== undefined ||
      input.discountMinor !== undefined ||
      Boolean(input.overrideEndDate)) &&
    !input.overrideReason.trim()
  ) {
    errors.overrideReason = 'required';
  }
  return errors;
}
