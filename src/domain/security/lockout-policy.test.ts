import { lockoutSecondsFor, remainingLockoutSeconds } from './lockout-policy';

describe('persistent PIN lockout policy', () => {
  it('adds a progressively longer delay after five failures and caps it', () => {
    expect(lockoutSecondsFor(4)).toBe(0);
    expect(lockoutSecondsFor(5)).toBe(30);
    expect(lockoutSecondsFor(6)).toBe(60);
    expect(lockoutSecondsFor(20)).toBe(900);
  });

  it('returns a rounded-up remaining delay', () => {
    const now = new Date('2026-10-07T10:00:00.000Z');
    expect(remainingLockoutSeconds('2026-10-07T10:00:01.100Z', now)).toBe(2);
    expect(remainingLockoutSeconds('2026-10-07T09:59:59.000Z', now)).toBe(0);
    expect(remainingLockoutSeconds(null, now)).toBe(0);
  });
});
