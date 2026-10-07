import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

export type SeedSummary = Readonly<{
  count: number;
  moneyTotalMinor: number;
  mediaSha256: string;
}>;

const SEED_ID = 'phase0-member-001';

export class Phase0ProofRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async seed(media: Uint8Array): Promise<SeedSummary> {
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO phase0_seed(id, member_name, amount_minor, media)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           member_name = excluded.member_name,
           amount_minor = excluded.amount_minor,
           media = excluded.media`,
        SEED_ID,
        'साक्षी / Sakshi',
        125_050,
        media,
      );
    });

    return this.summary();
  }

  async summary(): Promise<SeedSummary> {
    const row = await this.database.getFirstAsync<{
      count: number;
      moneyTotalMinor: number;
      media: Uint8Array | null;
    }>(
      `SELECT count(*) AS count,
              coalesce(sum(amount_minor), 0) AS moneyTotalMinor,
              media
       FROM phase0_seed`,
    );
    const media = row?.media ?? new Uint8Array();
    const hash = new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, Uint8Array.from(media)));
    const mediaSha256 = Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return {
      count: row?.count ?? 0,
      moneyTotalMinor: row?.moneyTotalMinor ?? 0,
      mediaSha256,
    };
  }

  async memberName(): Promise<string | null> {
    const row = await this.database.getFirstAsync<{ memberName: string }>(
      'SELECT member_name AS memberName FROM phase0_seed WHERE id = ?',
      SEED_ID,
    );
    return row?.memberName ?? null;
  }
}
