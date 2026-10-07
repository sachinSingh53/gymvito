import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isValidPin } from '@/domain/onboarding/onboarding';
import { useAppSession } from '@/features/session/app-session-context';
import { getRuntimeCapabilities } from '@/platform/runtime/runtime-capabilities';
import { AppScreen } from '@/ui/components/app-screen';
import { AppButton, AppField, Notice } from '@/ui/components/core-controls';
import { colors, spacing } from '@/ui/theme/tokens';

export default function SecuritySetupRoute() {
  const { state, saveSecurity } = useAppSession();
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [biometrics, setBiometrics] = useState(false);
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
        label={t('ownerPin')}
        maxLength={12}
        onChangeText={setPin}
        secureTextEntry
        value={pin}
      />
      <AppField
        autoComplete="off"
        keyboardType="number-pad"
        label={t('confirmPin')}
        maxLength={12}
        onChangeText={setConfirmation}
        secureTextEntry
        value={confirmation}
      />
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text style={styles.switchTitle}>{t('enableBiometrics')}</Text>
          <Text style={styles.switchSubtitle}>{t('biometricsFallbackNotice')}</Text>
        </View>
        <Switch
          accessibilityLabel={t('enableBiometrics')}
          onValueChange={setBiometrics}
          trackColor={{ true: colors.primary }}
          value={biometrics}
        />
      </View>
      <AppButton disabled={saving} onPress={() => void submit()}>
        {saving ? t('securing') : t('continue')}
      </AppButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchCopy: { flex: 1, gap: spacing.xs },
  switchTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  switchSubtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
