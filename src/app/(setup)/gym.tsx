import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { validateGymSetup, type GymSetupInput } from '@/domain/onboarding/onboarding';
import { GymProfileFields } from '@/features/gym/gym-profile-fields';
import { useAppSession } from '@/features/session/app-session-context';
import { AppScreen } from '@/ui/components/app-screen';
import { FormActions } from '@/ui/components/form-layout';

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
      <GymProfileFields errors={errors} form={form} onChange={update} />
      <FormActions
        onPrimary={() => void submit()}
        primaryDisabled={saving}
        primaryIcon="arrow_forward"
        primaryLabel={saving ? t('saving') : t('continue')}
      />
    </AppScreen>
  );
}
