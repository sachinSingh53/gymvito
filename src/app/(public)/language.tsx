import { Redirect } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppLanguage } from '@/domain/onboarding/onboarding';
import { useAppSession } from '@/features/session/app-session-context';
import { AppButton, AppChoice, Notice } from '@/ui/components/core-controls';
import { AppScreen } from '@/ui/components/app-screen';
import { spacing } from '@/ui/theme/tokens';

export default function LanguageRoute() {
  const { state, chooseLanguage } = useAppSession();
  const { t } = useTranslation();
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [saving, setSaving] = useState(false);
  if (state.status !== 'setup-required' || state.step !== 'language') return <Redirect href="/" />;

  const continueSetup = async () => {
    setSaving(true);
    try {
      await chooseLanguage(language);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen title={t('chooseLanguageTitle')} subtitle={t('chooseLanguageSubtitle')}>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        <AppChoice label="English" selected={language === 'en'} onPress={() => setLanguage('en')} />
        <AppChoice label="हिन्दी" selected={language === 'hi'} onPress={() => setLanguage('hi')} />
      </View>
      <Notice>{t('languageRecordsNotice')}</Notice>
      <AppButton disabled={saving} onPress={() => void continueSetup()}>
        {saving ? t('saving') : t('continue')}
      </AppButton>
    </AppScreen>
  );
}
