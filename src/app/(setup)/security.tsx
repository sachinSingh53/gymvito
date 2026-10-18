import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isValidPin } from '@/domain/onboarding/onboarding';
import { useAppSession } from '@/features/session/app-session-context';
import { getRuntimeCapabilities } from '@/platform/runtime/runtime-capabilities';
import { AppScreen } from '@/ui/components/app-screen';
import { AppField, Notice } from '@/ui/components/core-controls';
import { AppSwitchRow, FormActions } from '@/ui/components/form-layout';

export default function SecuritySetupRoute() {
  const { state, saveSecurity } = useAppSession();
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [biometrics, setBiometrics] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (state.status !== 'setup-required' || state.step !== 'security') return <Redirect href="/" />;

  const submit = async () => {
    if (!isValidPin(pin)) {
      setError(t('pinFormatError'));
      return;
    }
    if (pin !== confirmation) {
      setError(t('pinMismatch'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveSecurity(pin, biometrics);
    } catch {
      setError(t('securitySetupFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen title={t('securitySetupTitle')} subtitle={t('securitySetupSubtitle')}>
      <Notice danger>{t('pinNoRecoveryNotice')}</Notice>
      {getRuntimeCapabilities().isExpoGo ? <Notice>{t('expoGoPinNotice')}</Notice> : null}
      <AppField
        autoComplete="off"
        error={error ?? undefined}
        hint={t('pinHint')}
        keyboardType="number-pad"
        icon="pin"
        label={t('ownerPin')}
        maxLength={12}
        onChangeText={setPin}
        secureTextEntry
        value={pin}
      />
      <AppField
        autoComplete="off"
        keyboardType="number-pad"
        icon="lock"
        label={t('confirmPin')}
        maxLength={12}
        onChangeText={setConfirmation}
        secureTextEntry
        value={confirmation}
      />
      <AppSwitchRow
        description={t('biometricsFallbackNotice')}
        icon="fingerprint"
        label={t('enableBiometrics')}
        onValueChange={setBiometrics}
        value={biometrics}
      />
      <FormActions
        onPrimary={() => void submit()}
        primaryDisabled={saving}
        primaryIcon="lock"
        primaryLabel={saving ? t('securing') : t('continue')}
      />
    </AppScreen>
  );
}
