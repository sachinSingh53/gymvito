import { randomUUID } from 'expo-crypto';
import type { SQLiteBindValue, SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';

import {
  normalizeEmail,
  normalizeMemberCode,
  normalizePhone,
  normalizeSearchText,
  type MemberInput,
} from '@/domain/members/member';
import type { PlanInput } from '@/domain/plans/plan';

export const MEMBER_PHOTO_MAX_BYTES = 256 * 1024;

export type MemberPhotoInput = Readonly<{
  bytes: Uint8Array;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
}>;

export type PlanRecord = PlanInput &
  Readonly<{
    id: string;
    isActive: boolean;
    createdAtUtc: string;
    updatedAtUtc: string;
  }>;

export type MemberListItem = Readonly<{
  id: string;
  memberCode: string;
  name: string;
  phone: string;
  email: string;
  isArchived: boolean;
  hasPhoto: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}>;

export type MemberNote = Readonly<{
  id: string;
  content: string;
  createdAtUtc: string;
}>;

export type MemberAuditItem = Readonly<{
  id: string;
  action: string;
  summaryCode: string;
  occurredAtUtc: string;
}>;

export type MemberRecord = MemberListItem &
  Omit<MemberInput, 'note'> &
  Readonly<{
    notes: readonly MemberNote[];
    photo: (MemberPhotoInput & { id: string }) | null;
    audit: readonly MemberAuditItem[];
  }>;

export type DuplicateMember = Readonly<{
  id: string;
  memberCode: string;
  name: string;
  match: 'phone' | 'email' | 'code';
}>;

type PlanRow = {
  id: string;
  name: string;
  description: string;
  duration_value: number;
  duration_unit: PlanInput['durationUnit'];
  price_minor: number;
  admission_fee_minor: number;
  currency_code: string;
  tax_label: string;
  tax_rate_basis_points: number;
  discount_type: PlanInput['discountType'];
  discount_value: number;
  color_hex: string;
  freeze_allowed: 0 | 1;
  max_freeze_days: number | null;
  freeze_extends_end_date: 0 | 1;
  renewal_behavior: PlanInput['renewalBehavior'];
  is_active: 0 | 1;
  created_at_utc: string;
  updated_at_utc: string;
};

type MemberRow = {
  id: string;
  member_code: string;
  name: string;
  phone: string;
  email: string;
  date_of_birth: string | null;
  gender: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  joining_source: string;
  is_archived: 0 | 1;
  has_photo: 0 | 1;
  created_at_utc: string;
  updated_at_utc: string;
};

function mapPlan(row: PlanRow): PlanRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationValue: row.duration_value,
    durationUnit: row.duration_unit,
    priceMinor: row.price_minor,
    admissionFeeMinor: row.admission_fee_minor,
    currencyCode: row.currency_code,
    taxLabel: row.tax_label,
    taxRateBasisPoints: row.tax_rate_basis_points,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    colorHex: row.color_hex,
    freezeAllowed: row.freeze_allowed === 1,
    maxFreezeDays: row.max_freeze_days,
    freezeExtendsEndDate: row.freeze_extends_end_date === 1,
    renewalBehavior: row.renewal_behavior,
    isActive: row.is_active === 1,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
  };
}

function mapMemberList(row: MemberRow): MemberListItem {
  return {
    id: row.id,
    memberCode: row.member_code,
    name: row.name,
    phone: row.phone,
    email: row.email,
    isArchived: row.is_archived === 1,
    hasPhoto: row.has_photo === 1,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
  };
}

function assertPhoto(photo: MemberPhotoInput): void {
  if (photo.mimeType !== 'image/jpeg' || photo.bytes.byteLength < 1) {
    throw new Error('MEMBER_PHOTO_INVALID');
  }
  if (photo.bytes.byteLength > MEMBER_PHOTO_MAX_BYTES) throw new Error('MEMBER_PHOTO_TOO_LARGE');
  if (photo.width < 1 || photo.height < 1) throw new Error('MEMBER_PHOTO_DIMENSIONS_INVALID');
}

export class Phase2Repository {
  constructor(private readonly database: SQLiteDatabase) {}

  async listPlans(includeInactive = true): Promise<readonly PlanRecord[]> {
    const rows = await this.database.getAllAsync<PlanRow>(
      `SELECT * FROM plan ${includeInactive ? '' : 'WHERE is_active = 1'}
       ORDER BY is_active DESC, normalized_name`,
    );
    return rows.map(mapPlan);
  }

  async getPlan(planId: string): Promise<PlanRecord | null> {
    const row = await this.database.getFirstAsync<PlanRow>(
      'SELECT * FROM plan WHERE id = ?',
      planId,
    );
    return row ? mapPlan(row) : null;
  }

  async savePlan(input: PlanInput, actorStaffId: string, planId?: string): Promise<string> {
    const id = planId ?? randomUUID();
    const timestamp = new Date().toISOString();
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      if (planId) {
        const result = await transaction.runAsync(
          `UPDATE plan SET name = ?, normalized_name = ?, description = ?, duration_value = ?,
             duration_unit = ?, price_minor = ?, admission_fee_minor = ?, currency_code = ?,
             tax_label = ?, tax_rate_basis_points = ?, discount_type = ?, discount_value = ?,
             color_hex = ?, freeze_allowed = ?, max_freeze_days = ?,
             freeze_extends_end_date = ?, renewal_behavior = ?, updated_at_utc = ?
           WHERE id = ?`,
          ...this.planValues(input),
          timestamp,
          id,
        );
        this.assertChanged(result, 'PLAN_NOT_FOUND');
      } else {
        await transaction.runAsync(
          `INSERT INTO plan(
             id, name, normalized_name, description, duration_value, duration_unit, price_minor,
             admission_fee_minor, currency_code, tax_label, tax_rate_basis_points, discount_type,
             discount_value, color_hex, freeze_allowed, max_freeze_days,
             freeze_extends_end_date, renewal_behavior, created_at_utc, updated_at_utc
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          ...this.planValues(input),
          timestamp,
          timestamp,
        );
      }
      await this.insertAudit(
        transaction,
        actorStaffId,
        planId ? 'update' : 'create',
        'plan',
        id,
        planId ? 'plan_updated' : 'plan_created',
        timestamp,
      );
    });
    return id;
  }

  async setPlanActive(planId: string, active: boolean, actorStaffId: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      const result = await transaction.runAsync(
        'UPDATE plan SET is_active = ?, updated_at_utc = ? WHERE id = ?',
        active ? 1 : 0,
        timestamp,
        planId,
      );
      this.assertChanged(result, 'PLAN_NOT_FOUND');
      await this.insertAudit(
        transaction,
        actorStaffId,
        active ? 'restore' : 'deactivate',
        'plan',
        planId,
        active ? 'plan_activated' : 'plan_deactivated',
        timestamp,
      );
    });
  }

  async listMembers(
    query = '',
    archiveFilter: 'active' | 'archived' | 'all' = 'active',
    limit = 100,
  ): Promise<readonly MemberListItem[]> {
    const normalized = normalizeSearchText(query);
    const phone = normalizePhone(query);
    const email = normalizeEmail(query);
    const code = normalizeMemberCode(query);
    const archiveClause =
      archiveFilter === 'all' ? '1 = 1' : `m.is_archived = ${archiveFilter === 'archived' ? 1 : 0}`;
    const searchClause = normalized
      ? `AND ((? <> '' AND m.normalized_name LIKE ?) OR
              (? <> '' AND m.normalized_phone LIKE ?) OR
              (? <> '' AND m.normalized_email LIKE ?) OR
              (? <> '' AND m.normalized_member_code LIKE ?))`
      : '';
    const parameters = normalized
      ? [
          normalized,
          `%${normalized}%`,
          phone,
          `%${phone}%`,
          email,
          `%${email}%`,
          code,
          `%${code}%`,
          limit,
        ]
      : [limit];
    const rows = await this.database.getAllAsync<MemberRow>(
      `SELECT m.id, m.member_code, m.name, m.phone, m.email, m.date_of_birth, m.gender,
         m.address, m.emergency_contact_name, m.emergency_contact_phone, m.joining_source,
         m.is_archived, m.created_at_utc, m.updated_at_utc,
         EXISTS(SELECT 1 FROM member_media mm
                WHERE mm.member_id = m.id AND mm.media_type = 'profile_photo') AS has_photo
       FROM member m
       WHERE ${archiveClause} ${searchClause}
       ORDER BY m.updated_at_utc DESC, m.normalized_name
       LIMIT ?`,
      ...parameters,
    );
    return rows.map(mapMemberList);
  }

  async memberCounts(): Promise<{ active: number; archived: number; total: number }> {
    const row = await this.database.getFirstAsync<{
      active: number;
      archived: number;
      total: number;
    }>(
      `SELECT
         SUM(CASE WHEN is_archived = 0 THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END) AS archived,
         COUNT(*) AS total
       FROM member`,
    );
    return { active: row?.active ?? 0, archived: row?.archived ?? 0, total: row?.total ?? 0 };
  }

  async findDuplicates(
    input: Pick<MemberInput, 'phone' | 'email'> & { memberCode?: string },
    excludeMemberId?: string,
  ): Promise<readonly DuplicateMember[]> {
    const phone = normalizePhone(input.phone);
    const email = normalizeEmail(input.email);
    const code = normalizeMemberCode(input.memberCode ?? '');
    if (!phone && !email && !code) return [];
    const rows = await this.database.getAllAsync<{
      id: string;
      member_code: string;
      name: string;
      normalized_phone: string;
      normalized_email: string;
      normalized_member_code: string;
    }>(
      `SELECT id, member_code, name, normalized_phone, normalized_email, normalized_member_code
       FROM member
       WHERE id <> ? AND (
         (? <> '' AND normalized_phone = ?) OR
         (? <> '' AND normalized_email = ?) OR
         (? <> '' AND normalized_member_code = ?)
       ) ORDER BY normalized_name LIMIT 10`,
      excludeMemberId ?? '',
      phone,
      phone,
      email,
      email,
      code,
      code,
    );
    return rows.map((row) => ({
      id: row.id,
      memberCode: row.member_code,
      name: row.name,
      match:
        code && row.normalized_member_code === code
          ? 'code'
          : phone && row.normalized_phone === phone
            ? 'phone'
            : 'email',
    }));
  }

  async createMember(
    input: MemberInput,
    actorStaffId: string,
    photo?: MemberPhotoInput | null,
  ): Promise<{ id: string; memberCode: string }> {
    if (photo) assertPhoto(photo);
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    let memberCode = '';
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      memberCode = await this.allocateMemberCode(transaction);
      await transaction.runAsync(
        `INSERT INTO member(
           id, member_code, normalized_member_code, name, normalized_name, phone,
           normalized_phone, email, normalized_email, date_of_birth, gender, address,
           emergency_contact_name, emergency_contact_phone, joining_source,
           created_at_utc, updated_at_utc
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        memberCode,
        normalizeMemberCode(memberCode),
        ...this.memberValues(input),
        timestamp,
        timestamp,
      );
      if (input.note.trim())
        await this.insertNote(transaction, id, input.note, actorStaffId, timestamp);
      if (photo) await this.upsertPhoto(transaction, id, photo, timestamp);
      await this.insertAudit(
        transaction,
        actorStaffId,
        'create',
        'member',
        id,
        'member_created',
        timestamp,
      );
    });
    return { id, memberCode };
  }

  async updateMember(
    memberId: string,
    input: MemberInput,
    actorStaffId: string,
    photo?: MemberPhotoInput | null,
  ): Promise<void> {
    if (photo) assertPhoto(photo);
    const timestamp = new Date().toISOString();
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      const result = await transaction.runAsync(
        `UPDATE member SET name = ?, normalized_name = ?, phone = ?, normalized_phone = ?,
           email = ?, normalized_email = ?, date_of_birth = ?, gender = ?, address = ?,
           emergency_contact_name = ?, emergency_contact_phone = ?, joining_source = ?,
           updated_at_utc = ? WHERE id = ?`,
        ...this.memberValues(input),
        timestamp,
        memberId,
      );
      this.assertChanged(result, 'MEMBER_NOT_FOUND');
      if (input.note.trim())
        await this.insertNote(transaction, memberId, input.note, actorStaffId, timestamp);
      if (photo === null) {
        await transaction.runAsync(
          "DELETE FROM member_media WHERE member_id = ? AND media_type = 'profile_photo'",
          memberId,
        );
      } else if (photo) {
        await this.upsertPhoto(transaction, memberId, photo, timestamp);
      }
      await this.insertAudit(
        transaction,
        actorStaffId,
        'update',
        'member',
        memberId,
        'member_updated',
        timestamp,
      );
    });
  }

  async setMemberArchived(
    memberId: string,
    archived: boolean,
    actorStaffId: string,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      const result = await transaction.runAsync(
        `UPDATE member SET is_archived = ?, archived_at_utc = ?, updated_at_utc = ? WHERE id = ?`,
        archived ? 1 : 0,
        archived ? timestamp : null,
        timestamp,
        memberId,
      );
      this.assertChanged(result, 'MEMBER_NOT_FOUND');
      await this.insertAudit(
        transaction,
        actorStaffId,
        archived ? 'archive' : 'restore',
        'member',
        memberId,
        archived ? 'member_archived' : 'member_restored',
        timestamp,
      );
    });
  }

  async getMember(memberId: string): Promise<MemberRecord | null> {
    const row = await this.database.getFirstAsync<MemberRow>(
      `SELECT m.id, m.member_code, m.name, m.phone, m.email, m.date_of_birth, m.gender,
         m.address, m.emergency_contact_name, m.emergency_contact_phone, m.joining_source,
         m.is_archived, m.created_at_utc, m.updated_at_utc,
         EXISTS(SELECT 1 FROM member_media mm
                WHERE mm.member_id = m.id AND mm.media_type = 'profile_photo') AS has_photo
       FROM member m WHERE m.id = ?`,
      memberId,
    );
    if (!row) return null;
    const [photo, notes, audit] = await Promise.all([
      this.database.getFirstAsync<{
        id: string;
        mime_type: 'image/jpeg';
        content: Uint8Array;
        width: number;
        height: number;
      }>(
        `SELECT id, mime_type, content, width, height FROM member_media
         WHERE member_id = ? AND media_type = 'profile_photo'`,
        memberId,
      ),
      this.database.getAllAsync<{ id: string; content: string; created_at_utc: string }>(
        `SELECT id, content, created_at_utc FROM member_note
         WHERE member_id = ? ORDER BY created_at_utc DESC, rowid DESC LIMIT 20`,
        memberId,
      ),
      this.database.getAllAsync<{
        id: string;
        action: string;
        summary_code: string;
        occurred_at_utc: string;
      }>(
        `SELECT id, action, summary_code, occurred_at_utc FROM audit_event
         WHERE entity_type = 'member' AND entity_id = ?
         ORDER BY occurred_at_utc DESC, rowid DESC LIMIT 20`,
        memberId,
      ),
    ]);
    return {
      ...mapMemberList(row),
      dateOfBirth: row.date_of_birth ?? '',
      gender: row.gender,
      address: row.address,
      emergencyContactName: row.emergency_contact_name,
      emergencyContactPhone: row.emergency_contact_phone,
      joiningSource: row.joining_source,
      notes: notes.map((note) => ({
        id: note.id,
        content: note.content,
        createdAtUtc: note.created_at_utc,
      })),
      photo: photo
        ? {
            id: photo.id,
            bytes: photo.content,
            mimeType: photo.mime_type,
            width: photo.width,
            height: photo.height,
          }
        : null,
      audit: audit.map((event) => ({
        id: event.id,
        action: event.action,
        summaryCode: event.summary_code,
        occurredAtUtc: event.occurred_at_utc,
      })),
    };
  }

  private planValues(input: PlanInput): readonly SQLiteBindValue[] {
    return [
      input.name.trim(),
      normalizeSearchText(input.name),
      input.description.trim(),
      input.durationValue,
      input.durationUnit,
      input.priceMinor,
      input.admissionFeeMinor,
      input.currencyCode,
      input.taxLabel.trim(),
      input.taxRateBasisPoints,
      input.discountType,
      input.discountValue,
      input.colorHex.toUpperCase(),
      input.freezeAllowed ? 1 : 0,
      input.freezeAllowed ? input.maxFreezeDays : null,
      input.freezeAllowed && input.freezeExtendsEndDate ? 1 : 0,
      input.renewalBehavior,
    ];
  }

  private memberValues(input: MemberInput): readonly SQLiteBindValue[] {
    return [
      input.name.trim(),
      normalizeSearchText(input.name),
      input.phone.trim(),
      normalizePhone(input.phone),
      input.email.trim(),
      normalizeEmail(input.email),
      input.dateOfBirth.trim() || null,
      input.gender.trim(),
      input.address.trim(),
      input.emergencyContactName.trim(),
      input.emergencyContactPhone.trim(),
      input.joiningSource.trim(),
    ];
  }

  private async allocateMemberCode(database: SQLiteDatabase): Promise<string> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const sequence = await database.getFirstAsync<{ next_value: number }>(
        "SELECT next_value FROM number_sequences WHERE sequence_key = 'member_code'",
      );
      if (!sequence) throw new Error('MEMBER_SEQUENCE_MISSING');
      const code = `GV-${String(sequence.next_value).padStart(5, '0')}`;
      await database.runAsync(
        "UPDATE number_sequences SET next_value = ? WHERE sequence_key = 'member_code'",
        sequence.next_value + 1,
      );
      const collision = await database.getFirstAsync<{ id: string }>(
        'SELECT id FROM member WHERE normalized_member_code = ?',
        normalizeMemberCode(code),
      );
      if (!collision) return code;
    }
    throw new Error('MEMBER_CODE_ALLOCATION_FAILED');
  }

  private async insertNote(
    database: SQLiteDatabase,
    memberId: string,
    content: string,
    actorStaffId: string,
    timestamp: string,
  ): Promise<void> {
    await database.runAsync(
      `INSERT INTO member_note(id, member_id, content, actor_staff_id, created_at_utc, updated_at_utc)
       VALUES (?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      memberId,
      content.trim(),
      actorStaffId,
      timestamp,
      timestamp,
    );
  }

  private async upsertPhoto(
    database: SQLiteDatabase,
    memberId: string,
    photo: MemberPhotoInput,
    timestamp: string,
  ): Promise<void> {
    await database.runAsync(
      `INSERT INTO member_media(
         id, member_id, media_type, mime_type, byte_size, width, height, content,
         created_at_utc, updated_at_utc
       ) VALUES (?, ?, 'profile_photo', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(member_id, media_type) DO UPDATE SET mime_type = excluded.mime_type,
         byte_size = excluded.byte_size, width = excluded.width, height = excluded.height,
         content = excluded.content, updated_at_utc = excluded.updated_at_utc`,
      randomUUID(),
      memberId,
      photo.mimeType,
      photo.bytes.byteLength,
      photo.width,
      photo.height,
      photo.bytes,
      timestamp,
      timestamp,
    );
  }

  private async insertAudit(
    database: SQLiteDatabase,
    actorStaffId: string,
    action: string,
    entityType: string,
    entityId: string,
    summaryCode: string,
    timestamp: string,
  ): Promise<void> {
    await database.runAsync(
      `INSERT INTO audit_event(
         id, occurred_at_utc, actor_staff_id, action, entity_type, entity_id, summary_code
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      timestamp,
      actorStaffId,
      action,
      entityType,
      entityId,
      summaryCode,
    );
  }

  private assertChanged(result: SQLiteRunResult, code: string): void {
    if (result.changes !== 1) throw new Error(code);
  }
}
