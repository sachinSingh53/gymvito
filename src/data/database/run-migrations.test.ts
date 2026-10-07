import type { SQLiteDatabase } from 'expo-sqlite';

import { migrations } from './migrations';
import { runMigrations } from './run-migrations';

jest.mock('expo-crypto', () => {
  const { createHash } = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algorithm: string, input: string) =>
      createHash('sha256').update(input).digest('hex'),
  };
});

type Applied = { id: number; name: string; checksum: string };

function migrationDatabase() {
  const applied: Applied[] = [];
  let userVersion = 0;
  const transaction = {
    execAsync: jest.fn(async (sql: string) => {
      const version = /PRAGMA user_version = (\d+)/.exec(sql);
      if (version) userVersion = Number(version[1]);
    }),
    runAsync: jest.fn(async (_sql: string, ...values: unknown[]) => {
      applied.push({
        id: values[0] as number,
        name: values[1] as string,
        checksum: values[2] as string,
      });
      return {};
    }),
  };
  const database = {
    execAsync: jest.fn(async () => undefined),
    getAllAsync: jest.fn(async () => applied.map((migration) => ({ ...migration }))),
    withExclusiveTransactionAsync: jest.fn(
      async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction),
    ),
  } as unknown as SQLiteDatabase;
  return { applied, database, transaction, userVersion: () => userVersion };
}

describe('migration runner', () => {
  it('migrates a version-zero database through every migration in order', async () => {
    const fake = migrationDatabase();
    await runMigrations(fake.database);
    expect(fake.applied.map(({ id }) => id)).toEqual(migrations.map(({ id }) => id));
    expect(fake.userVersion()).toBe(migrations.at(-1)?.id);
  });

  it('is idempotent on repeated startup', async () => {
    const fake = migrationDatabase();
    await runMigrations(fake.database);
    await runMigrations(fake.database);
    expect(fake.applied).toHaveLength(migrations.length);
    expect(fake.transaction.runAsync).toHaveBeenCalledTimes(migrations.length);
  });
});
