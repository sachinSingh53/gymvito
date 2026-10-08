import { CryptoDigestAlgorithm, digest, digestStringAsync, randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

const COUNTED_TABLES = [
  'staff_profile',
  'plan',
  'member',
  'member_note',
  'member_media',
  'membership',
  'membership_event',
  'invoice',
  'invoice_line',
  'payment',
  'financial_adjustment',
  'audit_event',
] as const;

export type BackupRecordCounts = Readonly<Record<(typeof COUNTED_TABLES)[number], number>>;

export type BackupFinancialTotals = Readonly<{
  invoicedMinor: number;
  recordedPaymentsMinor: number;
  adjustmentsMinor: number;
  outstandingMinor: number;
}>;

export type BackupReconciliationSummary = Readonly<{
  recordCounts: BackupRecordCounts;
  financialTotals: BackupFinancialTotals;
  membershipStatusCounts: Readonly<Record<string, number>>;
  sequenceState: Readonly<Record<string, number>>;
  mediaSha256: string;
  logicalChecksum: string;
}>;

export type BackupHistoryRecord = Readonly<{
  id: string;
  operationType: 'backup' | 'restore';
  startedAtUtc: string;
  completedAtUtc: string | null;
  result: 'in-progress' | 'success' | 'failed' | 'cancelled';
  targetDescriptor: string;
  schemaVersion: number | null;
  fileSizeBytes: number | null;
  errorCode: string | null;
}>;

type CountRow = { count: number };
type AggregateRow = {
  invoicedMinor: number;
  recordedPaymentsMinor: number;
  adjustmentsMinor: number;
};
type MediaRow = { id: string; content: Uint8Array };
type HistoryRow = {
  id: string;
  operation_type: BackupHistoryRecord['operationType'];
  started_at_utc: string;
  completed_at_utc: string | null;
  result: BackupHistoryRecord['result'];
  target_descriptor: string;
  schema_version: number | null;
  file_size_bytes: number | null;
  error_code: string | null;
};

function mapHistoryRow(row: HistoryRow): BackupHistoryRecord {
  return {
    id: row.id,
    operationType: row.operation_type,
    startedAtUtc: row.started_at_utc,
    completedAtUtc: row.completed_at_utc,
    result: row.result,
    targetDescriptor: row.target_descriptor,
    schemaVersion: row.schema_version,
    fileSizeBytes: row.file_size_bytes,
    errorCode: row.error_code,
  };
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function errorCode(error: unknown): string {
  if (!(error instanceof Error)) return 'BACKUP_UNKNOWN_ERROR';
  return (
    error.message
      .replace(/[^A-Za-z0-9_.-]/g, '_')
      .toUpperCase()
      .slice(0, 80) || 'BACKUP_UNKNOWN_ERROR'
  );
}

export async function readBackupReconciliationSummary(
  database: SQLiteDatabase,
): Promise<BackupReconciliationSummary> {
  const countEntries = await Promise.all(
    COUNTED_TABLES.map(async (table) => {
      const row = await database.getFirstAsync<CountRow>(`SELECT count(*) AS count FROM ${table}`);
      return [table, row?.count ?? 0] as const;
    }),
  );
  const recordCounts = Object.fromEntries(countEntries) as Record<
    (typeof COUNTED_TABLES)[number],
    number
  >;

  const totals = await database.getFirstAsync<AggregateRow>(
    `SELECT
       (SELECT coalesce(sum(total_minor), 0) FROM invoice) AS invoicedMinor,
       (SELECT coalesce(sum(amount_minor), 0) FROM payment WHERE state = 'recorded')
         AS recordedPaymentsMinor,
       (SELECT coalesce(sum(amount_minor), 0) FROM financial_adjustment) AS adjustmentsMinor`,
  );
  const financialTotals = {
    invoicedMinor: totals?.invoicedMinor ?? 0,
    recordedPaymentsMinor: totals?.recordedPaymentsMinor ?? 0,
    adjustmentsMinor: totals?.adjustmentsMinor ?? 0,
    outstandingMinor:
      (totals?.invoicedMinor ?? 0) -
      (totals?.recordedPaymentsMinor ?? 0) +
      (totals?.adjustmentsMinor ?? 0),
  };

  const membershipRows = await database.getAllAsync<{ lifecycle_state: string; count: number }>(
    'SELECT lifecycle_state, count(*) AS count FROM membership GROUP BY lifecycle_state ORDER BY lifecycle_state',
  );
  const membershipStatusCounts = Object.fromEntries(
    membershipRows.map((row) => [row.lifecycle_state, row.count]),
  );
  const sequenceRows = await database.getAllAsync<{ sequence_key: string; next_value: number }>(
    'SELECT sequence_key, next_value FROM number_sequences ORDER BY sequence_key',
  );
  const sequenceState = Object.fromEntries(
    sequenceRows.map((row) => [row.sequence_key, row.next_value]),
  );

  const mediaRows = await database.getAllAsync<MediaRow>(
    'SELECT id, content FROM member_media ORDER BY id',
  );
  const mediaParts: string[] = [];
  for (const row of mediaRows) {
    mediaParts.push(
      `${row.id}:${hex(await digest(CryptoDigestAlgorithm.SHA256, Uint8Array.from(row.content)))}`,
    );
  }
  const mediaSha256 = await digestStringAsync(CryptoDigestAlgorithm.SHA256, mediaParts.join('|'));

  const logicalChecksum = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    JSON.stringify({
      recordCounts,
      financialTotals,
      membershipStatusCounts,
      sequenceState,
      mediaSha256,
    }),
  );
  return {
    recordCounts,
    financialTotals,
    membershipStatusCounts,
    sequenceState,
    mediaSha256,
    logicalChecksum,
  };
}

export class Phase5Repository {
  constructor(private readonly database: SQLiteDatabase) {}

  summary(): Promise<BackupReconciliationSummary> {
    return readBackupReconciliationSummary(this.database);
  }

  async listBackupHistory(limit = 12): Promise<BackupHistoryRecord[]> {
    const rows = await this.database.getAllAsync<HistoryRow>(
      `SELECT id, operation_type, started_at_utc, completed_at_utc, result,
              target_descriptor, schema_version, file_size_bytes, error_code
       FROM backup_record ORDER BY started_at_utc DESC LIMIT ?`,
      Math.max(1, Math.min(limit, 50)),
    );
    return rows.map(mapHistoryRow);
  }

  async beginOperation(
    operationType: BackupHistoryRecord['operationType'],
    actorStaffId: string,
    now = new Date(),
  ): Promise<string> {
    const id = randomUUID();
    await this.database.runAsync(
      `INSERT INTO backup_record(
         id, operation_type, started_at_utc, result, actor_staff_id
       ) VALUES (?, ?, ?, 'in-progress', ?)`,
      id,
      operationType,
      now.toISOString(),
      actorStaffId,
    );
    return id;
  }

  async completeOperation(
    id: string,
    result: Exclude<BackupHistoryRecord['result'], 'in-progress'>,
    details: {
      targetDescriptor?: string;
      formatVersion?: number;
      schemaVersion?: number;
      sourceAppVersion?: string;
      fileSizeBytes?: number;
      fileSha256?: string;
      recordCounts?: Readonly<Record<string, number>>;
      error?: unknown;
    },
    actorStaffId: string,
    now = new Date(),
  ): Promise<void> {
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `UPDATE backup_record SET completed_at_utc = ?, result = ?, target_descriptor = ?,
           format_version = ?, schema_version = ?, source_app_version = ?, file_size_bytes = ?,
           file_sha256 = ?, record_counts_json = ?, error_code = ?
         WHERE id = ? AND result = 'in-progress'`,
        now.toISOString(),
        result,
        details.targetDescriptor ?? '',
        details.formatVersion ?? null,
        details.schemaVersion ?? null,
        details.sourceAppVersion ?? null,
        details.fileSizeBytes ?? null,
        details.fileSha256 ?? null,
        details.recordCounts ? JSON.stringify(details.recordCounts) : null,
        details.error ? errorCode(details.error) : null,
        id,
      );
      await transaction.runAsync(
        `INSERT INTO audit_event(
           id, occurred_at_utc, actor_staff_id, action, entity_type, entity_id, summary_code
         ) VALUES (?, ?, ?, ?, 'backup_record', ?, ?)`,
        randomUUID(),
        now.toISOString(),
        actorStaffId,
        result === 'success' ? 'complete' : 'attempt',
        id,
        `${result}_${details.error ? errorCode(details.error) : 'ok'}`,
      );
    });
  }

  async lastSuccessfulBackup(): Promise<BackupHistoryRecord | null> {
    const row = await this.database.getFirstAsync<HistoryRow>(
      `SELECT id, operation_type, started_at_utc, completed_at_utc, result,
              target_descriptor, schema_version, file_size_bytes, error_code
       FROM backup_record
       WHERE operation_type = 'backup' AND result = 'success'
       ORDER BY completed_at_utc DESC LIMIT 1`,
    );
    return row ? mapHistoryRow(row) : null;
  }

  async recordSuccessfulRestore(details: {
    targetDescriptor: string;
    formatVersion: number;
    schemaVersion: number;
    sourceAppVersion: string;
    fileSizeBytes: number;
    recordCounts: Readonly<Record<string, number>>;
  }): Promise<void> {
    const owner = await this.database.getFirstAsync<{ id: string }>(
      'SELECT id FROM staff_profile WHERE is_owner = 1 AND is_active = 1',
    );
    if (!owner) throw new Error('RESTORED_OWNER_MISSING');
    const operationId = await this.beginOperation('restore', owner.id);
    await this.completeOperation(operationId, 'success', details, owner.id);
  }
}
