import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { validateGymSetup, type GymSetupInput } from '@/domain/onboarding/onboarding';
import { useAppSession } from '@/features/session/app-session-context';
import { AppScreen } from '@/ui/components/app-screen';
import { AppButton, AppChoice, AppField } from '@/ui/components/core-controls';
import { colors, spacing } from '@/ui/theme/tokens';

export default function GymSetupRoute() {
  const { state, saveGym } = useAppSession();
  const { t } = useTranslation();
  const prior = state.status === 'setup-required' ? state.snapshot.gym : null;
  const priorSettings = state.status === 'setup-required' ? state.snapshot.settings : null;
  const [form, setForm] = useState<GymSetupInput>({
    gymName: prior?.name ?? '',
    ownerName: prior?.ownerName ?? '',
    phone: prior?.phone ?? '',
    email: prior?.email ?? '',
    address: prior?.address ?? '',
    receiptFooter: prior?.receiptFooter ?? '',
    currencyCode: priorSettings?.currencyCode ?? 'INR',
    dateFormat: priorSettings?.dateFormat ?? 'day-month-year',
    timeFormat: priorSettings?.timeFormat ?? '12-hour',
    weekStartsOn: priorSettings?.weekStartsOn ?? 1,
    financialYearStartMonth: priorSettings?.financialYearStartMonth ?? 4,
    financialYearStartDay: priorSettings?.financialYearStartDay ?? 1,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (state.status !== 'setup-required' || state.step !== 'gym') return <Redirect href="/" />;
  const update = <K extends keyof GymSetupInput>(key: K, value: GymSetupInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const errorFor = (key: string) => (errors[key] ? t('fieldInvalid') : undefined);

  const submit = async () => {
    const validation = validateGymSetup(form);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setSaving(true);
    try {
      await saveGym(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen title={t('gymSetupTitle')} subtitle={t('gymSetupSubtitle')}>
      <AppField
        autoCapitalize="words"
        error={errorFor('gymName')}
        label={t('gymName')}
        onChangeText={(value) => update('gymName', value)}
        value={form.gymName}
      />
      <AppField
        autoCapitalize="words"
        error={errorFor('ownerName')}
        label={t('ownerName')}
        onChangeText={(value) => update('ownerName', value)}
        value={form.ownerName}
      />
      <AppField
        keyboardType="phone-pad"
        label={t('phoneOptional')}
        onChangeText={(value) => update('phone', value)}
        value={form.phone}
      />
      <AppField
        autoCapitalize="none"
        error={errorFor('email')}
        keyboardType="email-address"
        label={t('emailOptional')}
        onChangeText={(value) => update('email', value)}
        value={form.email}
      />
      <AppField
        label={t('addressOptional')}
        multiline
        onChangeText={(value) => update('address', value)}
        value={form.address}
      />
      <AppField
        label={t('receiptFooterOptional')}
        onChangeText={(value) => update('receiptFooter', value)}
        value={form.receiptFooter}
      />
      <Text style={{ color: colors.text, fontWeight: '700' }}>{t('regionalSettings')}</Text>
      <AppField
        autoCapitalize="characters"
        error={errorFor('currencyCode')}
        label={t('currencyCode')}
        maxLength={3}
        onChangeText={(value) => update('currencyCode', value.toUpperCase())}
        value={form.currencyCode}
      />
      <Text style={{ color: colors.text }}>{t('dateFormat')}</Text>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        {(['day-month-year', 'month-day-year', 'year-month-day'] as const).map((value) => (
          <AppChoice
            key={value}
            label={t(value)}
            onPress={() => update('dateFormat', value)}
            selected={form.dateFormat === value}
          />
        ))}
      </View>
      <Text style={{ color: colors.text }}>{t('timeFormat')}</Text>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        <AppChoice
          label={t('time12')}
          onPress={() => update('timeFormat', '12-hour')}
          selected={form.timeFormat === '12-hour'}
        />
        <AppChoice
          label={t('time24')}
          onPress={() => update('timeFormat', '24-hour')}
          selected={form.timeFormat === '24-hour'}
        />
      </View>
      <Text style={{ color: colors.text }}>{t('weekStartsOn')}</Text>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        <AppChoice
          label={t('monday')}
          onPress={() => update('weekStartsOn', 1)}
          selected={form.weekStartsOn === 1}
        />
        <AppChoice
          label={t('sunday')}
          onPress={() => update('weekStartsOn', 0)}
          selected={form.weekStartsOn === 0}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppField
            error={errorFor('financialYearStartMonth')}
            keyboardType="number-pad"
            label={t('financialYearMonth')}
            onChangeText={(value) => update('financialYearStartMonth', Number(value))}
            value={String(form.financialYearStartMonth)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <AppField
            error={errorFor('financialYearStartDay')}
            keyboardType="number-pad"
            label={t('financialYearDay')}
            onChangeText={(value) => update('financialYearStartDay', Number(value))}
            value={String(form.financialYearStartDay)}
          />
        </View>
      </View>
      <Text style={{ color: colors.textMuted }}>{t('deviceTimezoneNotice')}</Text>
      <AppButton disabled={saving} onPress={() => void submit()}>
        {saving ? t('saving') : t('continue')}
      </AppButton>
    </AppScreen>
  );
}
