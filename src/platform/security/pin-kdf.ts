import { getRandomBytesAsync } from 'expo-crypto';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

export const PIN_KDF_PARAMETERS = Object.freeze({
  algorithm: 'argon2id' as const,
  iterations: 3,
  memoryKiB: 32 * 1024,
  parallelism: 1,
  hashLength: 32,
});

export type Argon2PinVerifier = Readonly<{
  version: 1;
  algorithm: 'argon2id';
  saltHex: string;
  hashHex: string;
  iterations: number;
  memoryKiB: number;
  parallelism: number;
  hashLength: number;
}>;

export type DevelopmentPinVerifier = Readonly<{
  version: 1;
  algorithm: 'pbkdf2-sha256-development-only';
  saltHex: string;
  hashHex: string;
  iterations: number;
  hashLength: number;
}>;

export type PinVerifier = Argon2PinVerifier | DevelopmentPinVerifier;

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function deriveArgon2(
  pin: string,
  verifier: Omit<Argon2PinVerifier, 'version' | 'hashHex'>,
): Promise<string> {
  const { default: argon2 } = await import('react-native-argon2');
  const result = await argon2(pin, verifier.saltHex, {
    mode: verifier.algorithm,
    iterations: verifier.iterations,
    memory: verifier.memoryKiB,
    parallelism: verifier.parallelism,
    hashLength: verifier.hashLength,
    saltEncoding: 'hex',
  });
  return result.rawHash;
}

async function deriveDevelopmentPin(
  pin: string,
  verifier: Pick<DevelopmentPinVerifier, 'saltHex' | 'iterations' | 'hashLength'>,
): Promise<string> {
  const result = await pbkdf2Async(sha256, pin, hexToBytes(verifier.saltHex), {
    c: verifier.iterations,
    dkLen: verifier.hashLength,
    asyncTick: 8,
  });
  return bytesToHex(result);
}

export async function createPinVerifier(
  pin: string,
  mode: 'native' | 'expo-go-development' = 'native',
): Promise<PinVerifier> {
  if (!/^\d{6,12}$/.test(pin)) throw new Error('PIN_FORMAT_INVALID');
  if (mode === 'expo-go-development') {
    const base = {
      algorithm: 'pbkdf2-sha256-development-only' as const,
      saltHex: bytesToHex(await getRandomBytesAsync(16)),
      iterations: 120_000,
      hashLength: 32,
    };
    return { version: 1, ...base, hashHex: await deriveDevelopmentPin(pin, base) };
  }
  const base = {
    algorithm: PIN_KDF_PARAMETERS.algorithm,
    saltHex: bytesToHex(await getRandomBytesAsync(16)),
    iterations: PIN_KDF_PARAMETERS.iterations,
    memoryKiB: PIN_KDF_PARAMETERS.memoryKiB,
    parallelism: PIN_KDF_PARAMETERS.parallelism,
    hashLength: PIN_KDF_PARAMETERS.hashLength,
  };
  return { version: 1, ...base, hashHex: await deriveArgon2(pin, base) };
}

export async function verifyPin(pin: string, verifier: PinVerifier): Promise<boolean> {
  if (verifier.version !== 1) return false;
  const actual =
    verifier.algorithm === 'argon2id'
      ? await deriveArgon2(pin, verifier)
      : await deriveDevelopmentPin(pin, verifier);
  return constantTimeEqual(actual, verifier.hashHex);
}

export async function benchmarkPinKdf(pin = '739184'): Promise<number> {
  const startedAt = globalThis.performance.now();
  await createPinVerifier(pin);
  return Math.round(globalThis.performance.now() - startedAt);
}
