import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { applyDatabaseKey } from './apply-key';

type ExclusiveTask = Parameters<SQLiteDatabase['withExclusiveTransactionAsync']>[0];
type ExclusiveTransaction = Parameters<ExclusiveTask>[0];

function databaseLocation(databasePath: string): { directory: string; name: string } {
  const separator = databasePath.lastIndexOf('/');
  if (separator < 0) return { directory: '', name: databasePath };
  return {
    directory: databasePath.slice(0, separator),
    name: databasePath.slice(separator + 1),
  };
}

/**
 * expo-sqlite implements exclusive transactions with a separate connection. SQLCipher keys are
 * connection-local, so the stock helper cannot read an encrypted database until that connection
 * is keyed. Install an equivalent helper that keys and verifies every transaction connection.
 */
export function installKeyedExclusiveTransactions(database: SQLiteDatabase, key: string): void {
  const { directory, name } = databaseLocation(database.databasePath);

  database.withExclusiveTransactionAsync = async (task: ExclusiveTask): Promise<void> => {
    const transaction = await openDatabaseAsync(
      name,
      { ...database.options, useNewConnection: true },
      directory || undefined,
    );
    let transactionStarted = false;
    try {
      await applyDatabaseKey(transaction, key);
      await transaction.getFirstAsync('SELECT count(*) AS count FROM sqlite_master');
      await transaction.execAsync('BEGIN IMMEDIATE');
      transactionStarted = true;
      await task(transaction as ExclusiveTransaction);
      await transaction.execAsync('COMMIT');
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) await transaction.execAsync('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await transaction.closeAsync();
    }
  };
}
