import { Redirect, router, type Href } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppSession } from '@/features/session/app-session-context';
import { AppButton } from '@/ui/components/core-controls';
import { colors, spacing } from '@/ui/theme/tokens';

export default function IndexRoute() {
  const { state, retryStartup } = useAppSession();
  const { t } = useTranslation();

  if (state.status === 'initializing' || state.status === 'migrating') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator accessibilityLabel={t('startupLoading')} color={colors.primary} />
        <Text style={styles.loadingText}>
          {state.status === 'migrating' ? t('startupMigrating') : t('startupLoading')}
        </Text>
      </SafeAreaView>
    );
  }
  if (state.status === 'recovery-error') {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.errorCard}>
          <Text accessibilityRole="header" style={styles.errorTitle}>
            {t('startupRecoveryTitle')}
          </Text>
          <Text accessibilityRole="alert" style={styles.errorText}>
            {t('startupRecoveryMessage')}
          </Text>
          <Text style={styles.errorCode}>{state.messageCode}</Text>
          <AppButton onPress={retryStartup}>{t('retry')}</AppButton>
          <AppButton onPress={() => router.push('/recovery' as Href)} variant="secondary">
            {t('restoreFromBackup')}
          </AppButton>
        </View>
      </SafeAreaView>
    );
  }
  if (state.status === 'locked') return <Redirect href={'/unlock' as Href} />;
  if (state.status === 'unlocked') return <Redirect href={'/home' as Href} />;
  switch (state.step) {
    case 'language':
      return <Redirect href={'/language' as Href} />;
    case 'gym':
      return <Redirect href={'/gym' as Href} />;
    case 'security':
      return <Redirect href={'/security' as Href} />;
    case 'backup-intro':
      return <Redirect href={'/backup-intro' as Href} />;
    case 'complete':
      return <Redirect href={'/unlock' as Href} />;
  }
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  loadingText: { color: colors.text, fontSize: 16 },
  errorCard: {
    width: '100%',
    maxWidth: 560,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  errorTitle: { color: colors.text, fontSize: 24, fontWeight: '700' },
  errorText: { color: colors.text, fontSize: 16, lineHeight: 23 },
  errorCode: { color: colors.textMuted, fontSize: 12 },
});
