import type { DateOnly } from '@/domain/dates/date-rules';

import {
  calculateChargeBreakdown,
  calculateMembershipEndDate,
  deriveMembershipStatus,
  membershipProgress,
  membershipsOverlap,
  validateMembershipOverride,
} from './membership';

const terms = {
  startDate: '2026-01-01' as DateOnly,
  endDate: '2026-01-31' as DateOnly,
  durationValue: 1,
  durationUnit: 'month' as const,
  priceMinor: 100_000,
  admissionFeeMinor: 10_000,
  discountType: 'percentage' as const,
  discountValue: 1_000,
  taxRateBasisPoints: 1_800,
};

describe('membership rules', () => {
  it.each([
    ['draft', '2026-01-15', 'draft'],
    ['cancelled', '2026-01-15', 'cancelled'],
    ['finalized', '2025-12-31', 'scheduled'],
    ['finalized', '2026-01-01', 'active'],
    ['finalized', '2026-01-31', 'active'],
    ['finalized', '2026-02-01', 'expired'],
  ] as const)('derives %s on %s as %s', (lifecycleState, today, expected) => {
    expect(deriveMembershipStatus({ ...terms, lifecycleState }, today)).toBe(expected);
  });

  it('calculates immutable date and charge previews using integer minor units', () => {
    expect(calculateMembershipEndDate('2026-01-31', 1, 'month')).toBe('2026-02-28');
    expect(calculateChargeBreakdown(terms)).toEqual({
      priceMinor: 100_000,
      admissionFeeMinor: 10_000,
      discountMinor: 10_000,
      taxableMinor: 100_000,
      taxMinor: 18_000,
      totalMinor: 118_000,
    });
    expect(calculateChargeBreakdown(terms, { priceMinor: 80_000, discountMinor: 5_000 })).toEqual(
      expect.objectContaining({ priceMinor: 80_000, discountMinor: 5_000, totalMinor: 100_300 }),
    );
  });

  it('detects inclusive overlap and calculates inclusive progress', () => {
    expect(
      membershipsOverlap(terms, { ...terms, startDate: '2026-01-31', endDate: '2026-02-28' }),
    ).toBe(true);
    expect(
      membershipsOverlap(terms, { ...terms, startDate: '2026-02-01', endDate: '2026-02-28' }),
    ).toBe(false);
    expect(membershipProgress(terms, '2026-01-16')).toEqual({
      elapsedDays: 16,
      totalDays: 31,
      remainingDays: 15,
      ratio: 16 / 31,
    });
  });

  it('requires an owner reason for any terms override', () => {
    expect(validateMembershipOverride({ priceMinor: 90_000, overrideReason: '' })).toEqual({
      overrideReason: 'required',
    });
    expect(
      validateMembershipOverride({ priceMinor: 90_000, overrideReason: 'Retention offer' }),
    ).toEqual({});
    expect(() => calculateMembershipEndDate('2026-03-01', 1, 'month', '2026-02-28')).toThrow(
      'END_BEFORE_START',
    );
  });
});
