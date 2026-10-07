import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppLanguage, GymSetupInput, OnboardingStep } from '@/domain/onboarding/onboarding';
import { lockoutSecondsFor } from '@/domain/security/lockout-policy';
import type { PinVerifier } from '@/platform/security/pin-kdf';

type SettingsRow = {
  language: AppLanguage;
  currency_code: string;
  date_format: GymSetupInput['dateFormat'];
  time_format: GymSetupInput['timeFormat'];
  week_starts_on: 0 | 1;
  financial_year_start_month: number;
  financial_year_start_day: number;
  inactivity_timeout_seconds: number;
  biometrics_enabled: 0 | 1;
  onboarding_step: Exclude<OnboardingStep, 'language'>;
  setup_completed_at_utc: string | null;
};

type GymRow = {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  email: string;
  address: string;
  receipt_footer: string;
};

type OwnerAuthRow = {
  id: string;
  display_name: string;
  pin_verifier_json: string;
  preferred_language: AppLanguage;
  failed_pin_attempts: number;
  locked_until_utc: string | null;
};

export type PersistedSettings = Readonly<{
  language: AppLanguage;
  currencyCode: string;
  dateFormat: GymSetupInput['dateFormat'];
  timeFormat: GymSetupInput['timeFormat'];
  weekStartsOn: 0 | 1;
  financialYearStartMonth: number;
  financialYearStartDay: number;
  inactivityTimeoutSeconds: number;
  biometricsEnabled: boolean;
}>;

export type PersistedGymProfile = Readonly<{
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  receiptFooter: string;
}>;

export type StartupSnapshot = Readonly<{
  setupComplete: boolean;
  onboardingStep: OnboardingStep;
  settings: PersistedSettings | null;
  gym: PersistedGymProfile | null;
  ownerExists: boolean;
}>;

function mapSettings(row: SettingsRow): PersistedSettings {
  return {
    language: row.language,
    currencyCode: row.currency_code,
    dateFormat: row.date_format,
    timeFormat: row.time_format,
    weekStartsOn: row.week_starts_on,
    financialYearStartMonth: row.financial_year_start_month,
    financialYearStartDay: row.financial_year_start_day,
    inactivityTimeoutSeconds: row.inactivity_timeout_seconds,
    biometricsEnabled: row.biometrics_enabled === 1,
  };
}

function mapGym(row: GymRow): PersistedGymProfile {
  return {
    id: row.id,
    name: row.name,
    ownerName: row.owner_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    receiptFooter: row.receipt_footer,
  };
}

export class AppStateRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async loadStartupSnapshot(): Promise<StartupSnapshot> {
    const [settings, gym, owner] = await Promise.all([
      this.database.getFirstAsync<SettingsRow>('SELECT * FROM settings WHERE id = 1'),
      this.database.getFirstAsync<GymRow>('SELECT * FROM gym_profile WHERE singleton_key = 1'),
      this.database.getFirstAsync<{ id: string }>(
        'SELECT id FROM staff_profile WHERE is_owner = 1 AND is_active = 1',
      ),
    ]);
    return {
      setupComplete: Boolean(settings?.setup_completed_at_utc && gym && owner),
      onboardingStep: settings?.onboarding_step ?? 'language',
      settings: settings ? mapSettings(settings) : null,
      gym: gym ? mapGym(gym) : null,
      ownerExists: Boolean(owner),
    };
  }

  async saveLanguage(language: AppLanguage, now = new Date()): Promise<void> {
    const timestamp = now.toISOString();
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO settings(id, language, onboarding_step, created_at_utc, updated_at_utc)
         VALUES (1, ?, 'gym', ?, ?)
         ON CONFLICT(id) DO UPDATE SET language = excluded.language, updated_at_utc = excluded.updated_at_utc`,
        language,
        timestamp,
        timestamp,
      );
      await transaction.runAsync(
        'UPDATE staff_profile SET preferred_language = ?, updated_at_utc = ? WHERE is_owner = 1',
        language,
        timestamp,
      );
    });
  }

  async saveGymSetup(input: GymSetupInput, now = new Date()): Promise<void> {
    const timestamp = now.toISOString();
    const existing = await this.database.getFirstAsync<{ id: string }>(
      'SELECT id FROM gym_profile WHERE singleton_key = 1',
    );
    const gymId = existing?.id ?? randomUUID();
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO gym_profile(
           id, singleton_key, name, owner_name, phone, email, address, receipt_footer,
           created_at_utc, updated_at_utc
         ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(singleton_key) DO UPDATE SET
           name = excluded.name, owner_name = excluded.owner_name, phone = excluded.phone,
           email = excluded.email, address = excluded.address,
           receipt_footer = excluded.receipt_footer, updated_at_utc = excluded.updated_at_utc`,
        gymId,
        input.gymName.trim(),
        input.ownerName.trim(),
        input.phone.trim(),
        input.email.trim(),
        input.address.trim(),
        input.receiptFooter.trim(),
        timestamp,
        timestamp,
      );
      await transaction.runAsync(
        `UPDATE settings SET currency_code = ?, date_format = ?, time_format = ?,
           week_starts_on = ?, financial_year_start_month = ?, financial_year_start_day = ?,
           onboarding_step = 'security', updated_at_utc = ? WHERE id = 1`,
        input.currencyCode,
        input.dateFormat,
        input.timeFormat,
        input.weekStartsOn,
        input.financialYearStartMonth,
        input.financialYearStartDay,
        timestamp,
      );
      await transaction.runAsync(
        `INSERT INTO audit_event(
           id, occurred_at_utc, actor_staff_id, action, entity_type, entity_id, summary_code
         ) VALUES (?, ?, NULL, 'create_or_update', 'gym_profile', ?, 'onboarding_gym_saved')`,
        randomUUID(),
        timestamp,
        gymId,
      );
    });
  }

  async updateGymSettings(input: GymSetupInput, now = new Date()): Promise<void> {
    const timestamp = now.toISOString();
    const [gym, owner] = await Promise.all([
      this.database.getFirstAsync<{ id: string }>(
        'SELECT id FROM gym_profile WHERE singleton_key = 1',
      ),
      this.getOwnerAuth(),
    ]);
    if (!gym || !owner) throw new Error('SETUP_NOT_COMPLETE');
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `UPDATE gym_profile SET name = ?, owner_name = ?, phone = ?, email = ?, address = ?,
           receipt_footer = ?, updated_at_utc = ? WHERE id = ?`,
        input.gymName.trim(),
        input.ownerName.trim(),
        input.phone.trim(),
        input.email.trim(),
        input.address.trim(),
        input.receiptFooter.trim(),
        timestamp,
        gym.id,
      );
      await transaction.runAsync(
        `UPDATE settings SET currency_code = ?, date_format = ?, time_format = ?,
           week_starts_on = ?, financial_year_start_month = ?, financial_year_start_day = ?,
           updated_at_utc = ? WHERE id = 1`,
        input.currencyCode,
        input.dateFormat,
        input.timeFormat,
        input.weekStartsOn,
        input.financialYearStartMonth,
        input.financialYearStartDay,
        timestamp,
      );
      await transaction.runAsync(
        'UPDATE staff_profile SET display_name = ?, updated_at_utc = ? WHERE id = ?',
        input.ownerName.trim(),
        timestamp,
        owner.id,
      );
      await transaction.runAsync(
        `INSERT INTO audit_event(
           id, occurred_at_utc, actor_staff_id, action, entity_type, entity_id, summary_code
         ) VALUES (?, ?, ?, 'update', 'gym_profile', ?, 'gym_settings_changed')`,
        randomUUID(),
        timestamp,
        owner.id,
        gym.id,
      );
    });
  }

  async saveOwnerSecurity(
    verifier: PinVerifier,
    biometricsEnabled: boolean,
    now = new Date(),
  ): Promise<void> {
    const timestamp = now.toISOString();
    const gym = await this.database.getFirstAsync<{ owner_name: string }>(
      'SELECT owner_name FROM gym_profile WHERE singleton_key = 1',
    );
    const settings = await this.database.getFirstAsync<{ language: AppLanguage }>(
      'SELECT language FROM settings WHERE id = 1',
    );
    if (!gym || !settings) throw new Error('ONBOARDING_STATE_INVALID');
    const existing = await this.database.getFirstAsync<{ id: string }>(
      'SELECT id FROM staff_profile WHERE is_owner = 1',
    );
    const ownerId = existing?.id ?? randomUUID();
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO staff_profile(
           id, display_name, role_id, pin_verifier_json, preferred_language, is_active,
           is_owner, created_at_utc, updated_at_utc
         ) VALUES (?, ?, 'owner', ?, ?, 1, 1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name,
           pin_verifier_json = excluded.pin_verifier_json,
           preferred_language = excluded.preferred_language, failed_pin_attempts = 0,
           locked_until_utc = NULL, updated_at_utc = excluded.updated_at_utc`,
        ownerId,
        gym.owner_name,
        JSON.stringify(verifier),
        settings.language,
        timestamp,
        timestamp,
      );
      await transaction.runAsync(
        `UPDATE settings SET biometrics_enabled = ?, onboarding_step = 'backup-intro',
           updated_at_utc = ? WHERE id = 1`,
        biometricsEnabled ? 1 : 0,
        timestamp,
      );
      await transaction.runAsync(
        `INSERT INTO security_event(id, occurred_at_utc, actor_staff_id, event_type, outcome, metadata_code)
         VALUES (?, ?, ?, 'pin_setup', 'success', ?)`,
        randomUUID(),
        timestamp,
        ownerId,
        verifier.algorithm,
      );
    });
  }

  async completeOnboarding(now = new Date()): Promise<void> {
    const timestamp = now.toISOString();
    const owner = await this.getOwnerAuth();
    if (!owner) throw new Error('ONBOARDING_STATE_INVALID');
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `UPDATE settings SET onboarding_step = 'complete', setup_completed_at_utc = ?,
           updated_at_utc = ? WHERE id = 1`,
        timestamp,
        timestamp,
      );
      await transaction.runAsync(
        `INSERT INTO audit_event(
           id, occurred_at_utc, actor_staff_id, action, entity_type, entity_id, summary_code
         ) VALUES (?, ?, ?, 'complete', 'onboarding', 'local-setup', 'onboarding_completed')`,
        randomUUID(),
        timestamp,
        owner.id,
      );
    });
  }

  async getOwnerAuth(): Promise<OwnerAuthRow | null> {
    return this.database.getFirstAsync<OwnerAuthRow>(
      `SELECT id, display_name, pin_verifier_json, preferred_language,
         failed_pin_attempts, locked_until_utc
       FROM staff_profile WHERE is_owner = 1 AND is_active = 1`,
    );
  }

  async recordFailedPin(ownerId: string, now = new Date()): Promise<string | null> {
    let lockedUntil: string | null = null;
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      const row = await transaction.getFirstAsync<{ failed_pin_attempts: number }>(
        'SELECT failed_pin_attempts FROM staff_profile WHERE id = ?',
        ownerId,
      );
      if (!row) throw new Error('OWNER_NOT_FOUND');
      const failures = row.failed_pin_attempts + 1;
      const delaySeconds = lockoutSecondsFor(failures);
      lockedUntil = delaySeconds
        ? new Date(now.getTime() + delaySeconds * 1000).toISOString()
        : null;
      await transaction.runAsync(
        `UPDATE staff_profile SET failed_pin_attempts = ?, locked_until_utc = ?,
           updated_at_utc = ? WHERE id = ?`,
        failures,
        lockedUntil,
        now.toISOString(),
        ownerId,
      );
      await transaction.runAsync(
        `INSERT INTO security_event(id, occurred_at_utc, actor_staff_id, event_type, outcome, metadata_code)
         VALUES (?, ?, ?, 'unlock', 'failure', ?)`,
        randomUUID(),
        now.toISOString(),
        ownerId,
        delaySeconds ? 'rate_limited' : 'invalid_pin',
      );
    });
    return lockedUntil;
  }

  async recordSuccessfulUnlock(
    ownerId: string,
    method: 'pin' | 'biometric',
    now = new Date(),
  ): Promise<void> {
    const timestamp = now.toISOString();
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `UPDATE staff_profile SET failed_pin_attempts = 0, locked_until_utc = NULL,
           last_unlocked_at_utc = ?, updated_at_utc = ? WHERE id = ?`,
        timestamp,
        timestamp,
        ownerId,
      );
      await transaction.runAsync(
        `INSERT INTO security_event(id, occurred_at_utc, actor_staff_id, event_type, outcome, metadata_code)
         VALUES (?, ?, ?, 'unlock', 'success', ?)`,
        randomUUID(),
        timestamp,
        ownerId,
        method,
      );
    });
  }

  async recordLock(ownerId: string, reason: 'manual' | 'inactivity' | 'background'): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO security_event(id, occurred_at_utc, actor_staff_id, event_type, outcome, metadata_code)
       VALUES (?, ?, ?, 'lock', 'success', ?)`,
      randomUUID(),
      new Date().toISOString(),
      ownerId,
      reason,
    );
  }

  async updateLanguage(language: AppLanguage, now = new Date()): Promise<void> {
    await this.saveLanguage(language, now);
    const owner = await this.getOwnerAuth();
    if (owner) {
      await this.database.runAsync(
        `INSERT INTO audit_event(
           id, occurred_at_utc, actor_staff_id, action, entity_type, entity_id, summary_code
         ) VALUES (?, ?, ?, 'update', 'settings', 'language', 'language_changed')`,
        randomUUID(),
        now.toISOString(),
        owner.id,
      );
    }
  }

  async updateInactivityTimeout(seconds: number, now = new Date()): Promise<void> {
    if (!Number.isInteger(seconds) || seconds < 30 || seconds > 3600) {
      throw new Error('INVALID_INACTIVITY_TIMEOUT');
    }
    await this.database.runAsync(
      'UPDATE settings SET inactivity_timeout_seconds = ?, updated_at_utc = ? WHERE id = 1',
      seconds,
      now.toISOString(),
    );
  }
}
