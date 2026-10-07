import { remainingLockoutSeconds } from '@/domain/security/lockout-policy';
import type { AppStateRepository } from '@/data/repositories/app-state-repository';
import { verifyPin, type PinVerifier } from '@/platform/security/pin-kdf';

export type UnlockResult =
  | { status: 'success'; ownerId: string; ownerName: string }
  | { status: 'invalid-pin' }
  | { status: 'locked-out'; remainingSeconds: number };

export class SecurityService {
  constructor(private readonly repository: AppStateRepository) {}

  async unlockWithPin(pin: string, now = new Date()): Promise<UnlockResult> {
    const owner = await this.repository.getOwnerAuth();
    if (!owner) throw new Error('OWNER_NOT_FOUND');
    const remaining = remainingLockoutSeconds(owner.locked_until_utc, now);
    if (remaining > 0) return { status: 'locked-out', remainingSeconds: remaining };

    let verifier: PinVerifier;
    try {
      verifier = JSON.parse(owner.pin_verifier_json) as PinVerifier;
    } catch {
      throw new Error('PIN_VERIFIER_INVALID');
    }
    if (!(await verifyPin(pin, verifier))) {
      const lockedUntil = await this.repository.recordFailedPin(owner.id, now);
      const lockSeconds = remainingLockoutSeconds(lockedUntil, now);
      return lockSeconds > 0
        ? { status: 'locked-out', remainingSeconds: lockSeconds }
        : { status: 'invalid-pin' };
    }

    await this.repository.recordSuccessfulUnlock(owner.id, 'pin', now);
    return { status: 'success', ownerId: owner.id, ownerName: owner.display_name };
  }
}
