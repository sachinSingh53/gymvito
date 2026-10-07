import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppSession } from '@/features/session/app-session-context';
import { AppScreen } from '@/ui/components/app-screen';
import { AppButton, Notice } from '@/ui/components/core-controls';
import { colors, spacing } from '@/ui/theme/tokens';

export default function BackupIntroRoute() {
  const { state, completeOnboarding } = useAppSession();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  if (state.status !== 'setup-required' || state.step !== 'backup-intro')
    return <Redirect href="/" />;

  const complete = async () => {
    setSaving(true);
    try {
      await completeOnboarding();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen title={t('localDataTitle')} subtitle={t('localDataSubtitle')}>
      <Notice danger>{t('localDataLossNotice')}</Notice>
      <View style={styles.list}>
        <Text style={styles.item}>• {t('privacyStoredLocally')}</Text>
        <Text style={styles.item}>• {t('privacyNoAutomaticUpload')}</Text>
        <Text style={styles.item}>• {t('privacyExportsUserControlled')}</Text>
        <Text style={styles.item}>• {t('privacyDeviceRisk')}</Text>
      </View>
      <Notice>{t('backupPhaseNotice')}</Notice>
      <AppButton disabled={saving} onPress={() => void complete()}>
        {saving ? t('finishingSetup') : t('finishSetup')}
      </AppButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  item: { color: colors.text, fontSize: 15, lineHeight: 22 },
});
