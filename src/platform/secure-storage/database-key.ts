import { getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { MissingDatabaseKeyError } from '@/domain/errors/foundation-errors';

const DATABASE_KEY_NAME = 'gymvito.database-key.v1';
const DATABASE_KEY_SERVICE = 'com.gymvito.database-key.v1';
const KEY_PATTERN = /^[0-9a-f]{64}$/;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function assertDatabaseKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error('INVALID_DATABASE_KEY');
  }
}

export async function getOrCreateDatabaseKey(databaseExists: boolean): Promise<string> {
  const existing = await SecureStore.getItemAsync(DATABASE_KEY_NAME, {
    keychainService: DATABASE_KEY_SERVICE,
  });

  if (existing) {
    assertDatabaseKey(existing);
    return existing;
  }

  if (databaseExists) {
    throw new MissingDatabaseKeyError();
  }

  const generated = bytesToHex(await getRandomBytesAsync(32));
  await SecureStore.setItemAsync(DATABASE_KEY_NAME, generated, {
    keychainService: DATABASE_KEY_SERVICE,
    requireAuthentication: false,
  });
  return generated;
}

export async function getOrCreateRecoveryDatabaseKey(): Promise<string> {
  const existing = await readDatabaseKey();
  if (existing) return existing;
  const generated = bytesToHex(await getRandomBytesAsync(32));
  await SecureStore.setItemAsync(DATABASE_KEY_NAME, generated, {
    keychainService: DATABASE_KEY_SERVICE,
    requireAuthentication: false,
  });
  return generated;
}

export async function readDatabaseKey(): Promise<string | null> {
  const key = await SecureStore.getItemAsync(DATABASE_KEY_NAME, {
    keychainService: DATABASE_KEY_SERVICE,
  });
  if (key) assertDatabaseKey(key);
  return key;
}

export async function deleteDatabaseKey(): Promise<void> {
  await SecureStore.deleteItemAsync(DATABASE_KEY_NAME, {
    keychainService: DATABASE_KEY_SERVICE,
  });
}
