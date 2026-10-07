import { createPinVerifier, verifyPin } from './pin-kdf';

describe('PIN KDF compatibility mode', () => {
  it('creates and checks a clearly marked development-only verifier', async () => {
    const verifier = await createPinVerifier('739184', 'expo-go-development');
    expect(verifier.algorithm).toBe('pbkdf2-sha256-development-only');
    await expect(verifyPin('739184', verifier)).resolves.toBe(true);
    await expect(verifyPin('739185', verifier)).resolves.toBe(false);
  });

  it('rejects malformed PINs before deriving', async () => {
    await expect(createPinVerifier('123', 'expo-go-development')).rejects.toThrow(
      'PIN_FORMAT_INVALID',
    );
  });
});
