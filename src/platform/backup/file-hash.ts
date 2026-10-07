import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import type { File } from 'expo-file-system';

export async function sha256File(file: File): Promise<string> {
  const result = new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, await file.bytes()));
  return Array.from(result, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
