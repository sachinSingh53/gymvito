export const MAX_FAILED_ATTEMPTS_BEFORE_DELAY = 5;
export const MAX_LOCKOUT_SECONDS = 15 * 60;

export function lockoutSecondsFor(failedAttempts: number): number {
  if (!Number.isSafeInteger(failedAttempts) || failedAttempts < 1) return 0;
  if (failedAttempts < MAX_FAILED_ATTEMPTS_BEFORE_DELAY) return 0;
  return Math.min(
    30 * 2 ** (failedAttempts - MAX_FAILED_ATTEMPTS_BEFORE_DELAY),
    MAX_LOCKOUT_SECONDS,
  );
}

export function remainingLockoutSeconds(lockedUntilUtc: string | null, now: Date): number {
  if (!lockedUntilUtc) return 0;
  const remaining = Date.parse(lockedUntilUtc) - now.getTime();
  return Number.isFinite(remaining) && remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}
