import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { SQLiteDatabase } from 'expo-sqlite';

export type AvatarBenchmarkResult = Readonly<{
  rows: number;
  avatarBytes: number;
  insertDurationMs: number;
  listReadDurationMs: number;
  databaseBytesAtPeak: number;
  listFetchedBlob: false;
}>;

async function representativeAvatar(): Promise<{ bytes: Uint8Array; temporary: File }> {
  const asset = Asset.fromModule(require('../../../assets/images/react-logo.png'));
  if (!asset.localUri) await asset.downloadAsync();
  if (!asset.localUri) throw new Error('AVATAR_FIXTURE_UNAVAILABLE');
  const image = await manipulateAsync(asset.localUri, [{ resize: { width: 256, height: 256 } }], {
    compress: 0.72,
    format: SaveFormat.JPEG,
  });
  const temporary = new File(image.uri);
  return { bytes: await temporary.bytes(), temporary };
}

export async function runAvatarBenchmark(
  database: SQLiteDatabase,
  rows = 10_000,
): Promise<AvatarBenchmarkResult> {
  const avatar = await representativeAvatar();
  try {
    const insertStartedAt = globalThis.performance.now();
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync('DELETE FROM avatar_benchmark');
      const statement = await transaction.prepareAsync(
        'INSERT INTO avatar_benchmark(id, display_name, avatar) VALUES (?, ?, ?)',
      );
      try {
        for (let id = 1; id <= rows; id += 1) {
          await statement.executeAsync([id, `Member ${String(id).padStart(5, '0')}`, avatar.bytes]);
        }
      } finally {
        await statement.finalizeAsync();
      }
    });
    const insertDurationMs = Math.round(globalThis.performance.now() - insertStartedAt);

    const pageCount = await database.getFirstAsync<{ page_count: number }>('PRAGMA page_count');
    const pageSize = await database.getFirstAsync<{ page_size: number }>('PRAGMA page_size');
    const listStartedAt = globalThis.performance.now();
    const list = await database.getAllAsync<{ id: number; displayName: string }>(
      `SELECT id, display_name AS displayName
       FROM avatar_benchmark
       ORDER BY display_name
       LIMIT 100`,
    );
    const listReadDurationMs = Math.round(globalThis.performance.now() - listStartedAt);
    if (list.length !== Math.min(100, rows)) throw new Error('AVATAR_LIST_RECONCILIATION_FAILED');

    return {
      rows,
      avatarBytes: avatar.bytes.byteLength,
      insertDurationMs,
      listReadDurationMs,
      databaseBytesAtPeak: (pageCount?.page_count ?? 0) * (pageSize?.page_size ?? 0),
      listFetchedBlob: false,
    };
  } finally {
    await database.execAsync('DELETE FROM avatar_benchmark; PRAGMA wal_checkpoint(TRUNCATE);');
    if (avatar.temporary.exists) avatar.temporary.delete();
  }
}
