import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { applyDatabaseKey } from './apply-key';
import { installKeyedExclusiveTransactions } from './keyed-exclusive-transaction';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('./apply-key', () => ({ applyDatabaseKey: jest.fn() }));

function databaseDouble(path: string): SQLiteDatabase {
  return {
    databasePath: path,
    options: { useNewConnection: true },
    withExclusiveTransactionAsync: jest.fn(),
  } as unknown as SQLiteDatabase;
}

describe('keyed exclusive transactions', () => {
  const key = 'a'.repeat(64);

  beforeEach(() => jest.clearAllMocks());

  it('keys and verifies the separate transaction connection before beginning', async () => {
    const database = databaseDouble('/data/user/0/com.gymvito.app/files/SQLite/gymvito.db');
    const transaction = {
      execAsync: jest.fn(async () => undefined),
      getFirstAsync: jest.fn(async () => ({ count: 1 })),
      closeAsync: jest.fn(async () => undefined),
    } as unknown as SQLiteDatabase;
    jest.mocked(openDatabaseAsync).mockResolvedValue(transaction);
    jest.mocked(applyDatabaseKey).mockResolvedValue(undefined);
    const task = jest.fn(async () => undefined);

    installKeyedExclusiveTransactions(database, key);
    await database.withExclusiveTransactionAsync(task);

    expect(openDatabaseAsync).toHaveBeenCalledWith(
      'gymvito.db',
      { useNewConnection: true },
      '/data/user/0/com.gymvito.app/files/SQLite',
    );
    expect(applyDatabaseKey).toHaveBeenCalledWith(transaction, key);
    expect(transaction.getFirstAsync).toHaveBeenCalledWith(
      'SELECT count(*) AS count FROM sqlite_master',
    );
    expect(transaction.execAsync).toHaveBeenNthCalledWith(1, 'BEGIN IMMEDIATE');
    expect(task).toHaveBeenCalledWith(transaction);
    expect(transaction.execAsync).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(transaction.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('rolls back and closes when the transaction task fails', async () => {
    const database = databaseDouble('/tmp/gymvito.db');
    const transaction = {
      execAsync: jest.fn(async () => undefined),
      getFirstAsync: jest.fn(async () => ({ count: 1 })),
      closeAsync: jest.fn(async () => undefined),
    } as unknown as SQLiteDatabase;
    jest.mocked(openDatabaseAsync).mockResolvedValue(transaction);
    const failure = new Error('WRITE_FAILED');

    installKeyedExclusiveTransactions(database, key);
    await expect(
      database.withExclusiveTransactionAsync(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(transaction.execAsync).toHaveBeenNthCalledWith(1, 'BEGIN IMMEDIATE');
    expect(transaction.execAsync).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(transaction.closeAsync).toHaveBeenCalledTimes(1);
  });
});
