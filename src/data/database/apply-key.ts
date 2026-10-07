import type { SQLiteDatabase } from 'expo-sqlite';

import { assertDatabaseKey } from '@/platform/secure-storage/database-key';

/** SQLCipher does not accept a bound parameter for PRAGMA key. The value is fixed-width validated hex. */
export async function applyDatabaseKey(database: SQLiteDatabase, key: string): Promise<void> {
  assertDatabaseKey(key);
  await database.execAsync(`PRAGMA key = "x'${key}'"`);
}
