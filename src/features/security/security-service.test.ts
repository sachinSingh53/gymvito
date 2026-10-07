import type { AppStateRepository } from '@/data/repositories/app-state-repository';
import { verifyPin } from '@/platform/security/pin-kdf';

import { SecurityService } from './security-service';

jest.mock('@/platform/security/pin-kdf', () => ({ verifyPin: jest.fn() }));

const mockedVerifyPin = jest.mocked(verifyPin);

function repository(overrides: Partial<AppStateRepository> = {}): AppStateRepository {
  return {
    getOwnerAuth: jest.fn(async () => ({
      id: 'owner-id',
      display_name: 'Owner',
      pin_verifier_json: JSON.stringify({ version: 1, algorithm: 'argon2id' }),
      preferred_language: 'en',
      failed_pin_attempts: 0,
      locked_until_utc: null,
    })),
    recordFailedPin: jest.fn(async () => null),
    recordSuccessfulUnlock: jest.fn(async () => undefined),
    ...overrides,
  } as unknown as AppStateRepository;
}

describe('security service', () => {
  beforeEach(() => mockedVerifyPin.mockReset());

  it('does not derive a PIN while a persisted lockout is active', async () => {
    const repo = repository({
      getOwnerAuth: jest.fn(async () => ({
        id: 'owner-id',
        display_name: 'Owner',
        pin_verifier_json: '{}',
        preferred_language: 'en' as const,
        failed_pin_attempts: 5,
        locked_until_utc: '2026-10-07T10:01:00.000Z',
      })),
    });
    await expect(
      new SecurityService(repo).unlockWithPin('123456', new Date('2026-10-07T10:00:00.000Z')),
    ).resolves.toEqual({ status: 'locked-out', remainingSeconds: 60 });
    expect(mockedVerifyPin).not.toHaveBeenCalled();
  });

  it('persists a failed attempt for an incorrect PIN', async () => {
    mockedVerifyPin.mockResolvedValue(false);
    const repo = repository();
    await expect(new SecurityService(repo).unlockWithPin('123456')).resolves.toEqual({
      status: 'invalid-pin',
    });
    expect(repo.recordFailedPin).toHaveBeenCalledWith('owner-id', expect.any(Date));
  });

  it('clears failure state and returns the owner after a correct PIN', async () => {
    mockedVerifyPin.mockResolvedValue(true);
    const repo = repository();
    await expect(new SecurityService(repo).unlockWithPin('123456')).resolves.toEqual({
      status: 'success',
      ownerId: 'owner-id',
      ownerName: 'Owner',
    });
    expect(repo.recordSuccessfulUnlock).toHaveBeenCalledWith('owner-id', 'pin', expect.any(Date));
  });
});
