import type { SQLiteDatabase } from 'expo-sqlite';

const RESTART_PROBE_KEY = 'phase0_restart_probe_count';

export class FoundationRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async recordDevelopmentRestart(): Promise<number> {
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO app_metadata(key, value) VALUES (?, '1')
         ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)`,
        RESTART_PROBE_KEY,
      );
    });
    const row = await this.database.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_metadata WHERE key = ?',
      RESTART_PROBE_KEY,
    );
    return Number.parseInt(row?.value ?? '0', 10);
  }
}
