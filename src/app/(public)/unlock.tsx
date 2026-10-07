import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppSession } from '@/features/session/app-session-context';
import { AppScreen } from '@/ui/components/app-screen';
import { AppButton, AppField, Notice } from '@/ui/components/core-controls';
import { colors } from '@/ui/theme/tokens';

export default function UnlockRoute() {
  const { state, unlockWithPin, unlockWithBiometrics, changeLanguage } = useAppSession();
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  if (state.status !== 'locked') return <Redirect href="/" />;
  const settings = state.snapshot.settings;

  const submitPin = async () => {
    if (remaining > 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await unlockWithPin(pin);
      if (result.status === 'invalid-pin') setMessage(t('pinIncorrect'));
      if (result.status === 'locked-out') {
        setRemaining(result.remainingSeconds);
        setMessage(t('pinLocked', { count: result.remainingSeconds }));
      }
      if (result.status !== 'success') setPin('');
    } catch {
      setMessage(t('unlockFailed'));
    } finally {
      setBusy(false);
    }
  };

  const biometricUnlock = async () => {
    setBusy(true);
    const result = await unlockWithBiometrics();
    if (result !== 'success') setMessage(t('biometricFallback'));
    setBusy(false);
  };

  return (
    <AppScreen title={t('unlockTitle')} subtitle={t('unlockSubtitle')}>
      {remaining > 0 ? <Notice danger>{t('pinLocked', { count: remaining })}</Notice> : null}
      <AppField
        autoComplete="off"
        error={message ?? undefined}
        keyboardType="number-pad"
        label={t('ownerPin')}
        maxLength={12}
        onChangeText={setPin}
        onSubmitEditing={() => void submitPin()}
        secureTextEntry
        value={pin}
      />
      <AppButton
        disabled={busy || pin.length < 6 || remaining > 0}
        onPress={() => void submitPin()}
      >
        {busy ? t('unlocking') : t('unlock')}
      </AppButton>
      {settings?.biometricsEnabled ? (
        <AppButton disabled={busy} onPress={() => void biometricUnlock()} variant="secondary">
          {t('useBiometrics')}
        </AppButton>
      ) : null}
      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
        {t('forgotPinNoRecovery')}
      </Text>
      <AppButton
        onPress={() => void changeLanguage(settings?.language === 'hi' ? 'en' : 'hi')}
        variant="secondary"
      >
        {settings?.language === 'hi' ? 'English' : 'हिन्दी'}
      </AppButton>
    </AppScreen>
  );
}
