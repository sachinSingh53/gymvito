import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppSession } from '@/features/session/app-session-context';
import { AppButton, Notice } from '@/ui/components/core-controls';
import { OperationalShell, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, spacing } from '@/ui/theme/tokens';

export default function MoreRoute() {
  const { lock } = useAppSession();
  const { t } = useTranslation();
  return (
    <OperationalShell active="more" subtitle={t('managementTools')} title={t('more')}>
      <SurfaceCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t('management')}</Text>
        <AppButton onPress={() => router.push('/plans' as Href)} variant="secondary">
          {t('membershipPlans')}
        </AppButton>
        <AppButton onPress={() => router.push('/settings' as Href)} variant="secondary">
          {t('settings')}
        </AppButton>
      </SurfaceCard>
      <SurfaceCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t('dataTools')}</Text>
        <AppButton disabled onPress={() => undefined} variant="secondary">
          {t('importMembersPhase7')}
        </AppButton>
        <AppButton disabled onPress={() => undefined} variant="secondary">
          {t('exportMembersPhase6')}
        </AppButton>
        <Notice>{t('unavailableActionsNotice')}</Notice>
      </SurfaceCard>
      <View style={styles.lock}>
        <AppButton onPress={() => void lock('manual')} variant="danger">
          {t('lockNow')}
        </AppButton>
      </View>
    </OperationalShell>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  lock: { marginTop: spacing.sm },
});
