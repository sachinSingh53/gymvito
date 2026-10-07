import {
  addDays,
  calculateInclusiveEndDate,
  compareDateOnly,
  dateOnlyAtInstant,
  parseDateOnly,
  renewalStartAfterExpiry,
  type DateOnly,
} from './date-rules';

describe('date-only rules', () => {
  test.each([
    ['2026-01-01', { count: 1, unit: 'day' as const }, '2026-01-01'],
    ['2026-01-01', { count: 1, unit: 'week' as const }, '2026-01-07'],
    ['2026-01-15', { count: 1, unit: 'month' as const }, '2026-02-14'],
    ['2026-01-31', { count: 1, unit: 'month' as const }, '2026-02-27'],
    ['2024-01-31', { count: 1, unit: 'month' as const }, '2024-02-28'],
    ['2024-02-29', { count: 1, unit: 'year' as const }, '2025-02-27'],
    ['2023-03-01', { count: 1, unit: 'year' as const }, '2024-02-29'],
  ])('%s plus %o ends on %s inclusively', (start, duration, expected) => {
    expect(calculateInclusiveEndDate(start as DateOnly, duration)).toBe(expected);
  });

  it('rejects malformed and impossible date-only values', () => {
    expect(() => parseDateOnly('2026-2-01')).toThrow('INVALID_DATE_ONLY');
    expect(() => parseDateOnly('2026-02-30')).toThrow('INVALID_DATE_ONLY');
    expect(() => calculateInclusiveEndDate('2026-01-01', { count: 0, unit: 'day' })).toThrow(
      'INVALID_PLAN_DURATION',
    );
  });

  it('compares and advances date-only values without local-time conversion', () => {
    expect(compareDateOnly('2026-03-01', '2026-03-01')).toBe(0);
    expect(compareDateOnly('2026-02-28', '2026-03-01')).toBe(-1);
    expect(compareDateOnly('2026-03-02', '2026-03-01')).toBe(1);
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(renewalStartAfterExpiry('2026-12-31')).toBe('2027-01-01');
  });

  it('derives the local business date independently in two time zones', () => {
    const instant = new Date('2026-03-08T23:30:00.000Z');
    expect(dateOnlyAtInstant(instant, 'Asia/Kolkata')).toBe('2026-03-09');
    expect(dateOnlyAtInstant(instant, 'America/Los_Angeles')).toBe('2026-03-08');
  });

  it('does not skip a date across DST boundaries', () => {
    expect(dateOnlyAtInstant(new Date('2026-03-08T09:30:00Z'), 'America/Los_Angeles')).toBe(
      '2026-03-08',
    );
    expect(dateOnlyAtInstant(new Date('2026-03-08T10:30:00Z'), 'America/Los_Angeles')).toBe(
      '2026-03-08',
    );
  });
});
