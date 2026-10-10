import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppLanguage } from '@/domain/onboarding/onboarding';
import { useAppSession } from '@/features/session/app-session-context';
import { AppScreen } from '@/ui/components/app-screen';
import { AppButton, AppChoice, AppField, Notice } from '@/ui/components/core-controls';
import { colors, spacing } from '@/ui/theme/tokens';

const TIMEOUTS = [60, 300, 900] as const;

export default function SettingsRoute() {
  const { state, changeLanguage, changeInactivityTimeout, reauthenticateOwner, lock } =
    useAppSession();
  const { t } = useTranslation();
  const [timeout, setTimeoutValue] = useState(
    state.status === 'unlocked' ? (state.snapshot.settings?.inactivityTimeoutSeconds ?? 300) : 300,
  );
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (state.status !== 'unlocked') return null;
  const language = state.snapshot.settings?.language ?? 'en';

  const switchLanguage = async (next: AppLanguage) => {
    setSaving(true);
    await changeLanguage(next);
    setSaving(false);
  };

  const saveSecuritySetting = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (!(await reauthenticateOwner(pin))) {
        setMessage(t('pinIncorrect'));
        return;
      }
      await changeInactivityTimeout(timeout);
      setPin('');
      setMessage(t('settingsSaved'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen backHref="/more" canGoBack title={t('settings')} subtitle={t('settingsSubtitle')}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
        {t('languageLabel')}
      </Text>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        <AppChoice
          label="English"
          onPress={() => void switchLanguage('en')}
          selected={language === 'en'}
        />
        <AppChoice
          label="हिन्दी"
          onPress={() => void switchLanguage('hi')}
          selected={language === 'hi'}
        />
      </View>
      <AppButton onPress={() => router.push('/gym-settings' as Href)} variant="secondary">
        {t('editGymSettings')}
      </AppButton>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{t('autoLock')}</Text>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        {TIMEOUTS.map((seconds) => (
          <AppChoice
            key={seconds}
            label={t('minutesCount', { count: seconds / 60 })}
            onPress={() => setTimeoutValue(seconds)}
            selected={timeout === seconds}
          />
        ))}
      </View>
      <Notice>{t('reauthSecurityNotice')}</Notice>
      <AppField
        error={message === t('pinIncorrect') ? message : undefined}
        keyboardType="number-pad"
        label={t('ownerPin')}
        maxLength={12}
        onChangeText={setPin}
        secureTextEntry
        value={pin}
      />
      {message && message !== t('pinIncorrect') ? <Notice>{message}</Notice> : null}
      <AppButton disabled={saving || pin.length < 6} onPress={() => void saveSecuritySetting()}>
        {t('saveAutoLock')}
      </AppButton>
      <AppButton onPress={() => void lock('manual')} variant="danger">
        {t('lockNow')}
      </AppButton>
      <AppButton onPress={() => router.back()} variant="secondary">
        {t('back')}
      </AppButton>
    </AppScreen>
  );
}
