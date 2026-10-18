import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { validateGymSetup, type GymSetupInput } from '@/domain/onboarding/onboarding';
import { GymProfileFields } from '@/features/gym/gym-profile-fields';
import { useAppSession } from '@/features/session/app-session-context';
import { AppScreen } from '@/ui/components/app-screen';
import { Notice } from '@/ui/components/core-controls';
import { FormActions } from '@/ui/components/form-layout';

export default function GymSettingsRoute() {
  const { state, updateGym } = useAppSession();
  const { t } = useTranslation();
  const gym = state.status === 'unlocked' ? state.snapshot.gym : null;
  const settings = state.status === 'unlocked' ? state.snapshot.settings : null;
  const [form, setForm] = useState<GymSetupInput>({
    gymName: gym?.name ?? '',
    ownerName: gym?.ownerName ?? '',
    phone: gym?.phone ?? '',
    email: gym?.email ?? '',
    address: gym?.address ?? '',
    receiptFooter: gym?.receiptFooter ?? '',
    currencyCode: settings?.currencyCode ?? 'INR',
    dateFormat: settings?.dateFormat ?? 'day-month-year',
    timeFormat: settings?.timeFormat ?? '12-hour',
    weekStartsOn: settings?.weekStartsOn ?? 1,
    financialYearStartMonth: settings?.financialYearStartMonth ?? 4,
    financialYearStartDay: settings?.financialYearStartDay ?? 1,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  if (state.status !== 'unlocked') return null;
  const update = <K extends keyof GymSetupInput>(key: K, value: GymSetupInput[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const submit = async () => {
    const nextErrors = validateGymSetup(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    await updateGym(form);
    setSaving(false);
    setSaved(true);
  };

  return (
    <AppScreen
      backHref="/settings"
      canGoBack
      title={t('editGymSettings')}
      subtitle={t('gymSettingsSubtitle')}
    >
      <GymProfileFields errors={errors} form={form} onChange={update} />
      {saved ? <Notice>{t('settingsSaved')}</Notice> : null}
      <FormActions
        onPrimary={() => void submit()}
        onSecondary={() => router.back()}
        primaryDisabled={saving}
        primaryLabel={saving ? t('saving') : t('save')}
        secondaryLabel={t('back')}
      />
    </AppScreen>
  );
}
