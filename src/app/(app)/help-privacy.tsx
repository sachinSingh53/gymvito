import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton, Notice } from '@/ui/components/core-controls';
import { OperationalShell, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, spacing } from '@/ui/theme/tokens';

const SECTIONS = [
  {
    title: 'privacyNoticeTitle',
    items: [
      'privacyStoredFields',
      'privacyEncryptedDevice',
      'privacyNoAutomaticUploadDetailed',
      'privacyExternalDestinations',
      'privacyOwnerResponsibility',
    ],
  },
  {
    title: 'helpBackupTitle',
    items: ['helpBackupCreate', 'helpBackupPassphrase', 'helpBackupRestore'],
  },
  {
    title: 'helpStatusTitle',
    items: ['helpStatusActive', 'helpStatusUpcoming', 'helpStatusExpired', 'helpStatusDue'],
  },
  {
    title: 'helpWorkflowTitle',
    items: ['helpWorkflowMember', 'helpWorkflowPayment', 'helpWorkflowReports'],
  },
  {
    title: 'helpPermissionsTitle',
    items: ['helpPermissionsScoped', 'helpPermissionsFallback'],
  },
] as const;

export default function HelpPrivacyRoute() {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <OperationalShell
      active="more"
      backHref="/more"
      canGoBack
      subtitle={t('helpPrivacySubtitle')}
      title={t('helpAndPrivacy')}
    >
      <View style={styles.content}>
        <Notice danger>{t('uninstallDataLossWarning')}</Notice>
        {SECTIONS.map((section) => (
          <SurfaceCard key={section.title} style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {t(section.title)}
            </Text>
            <View accessibilityRole="list" style={styles.list}>
              {section.items.map((item) => (
                <View accessible key={item} style={styles.listItem}>
                  <Text accessibilityElementsHidden style={styles.bullet}>
                    •
                  </Text>
                  <Text style={styles.body}>{t(item)}</Text>
                </View>
              ))}
            </View>
          </SurfaceCard>
        ))}
        <SurfaceCard style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('aboutGymVito')}
          </Text>
          <Text style={styles.body}>{t('appVersion', { version })}</Text>
          <Text style={styles.body}>{t('localFirstSummary')}</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.back()} variant="secondary">
          {t('back')}
        </AppButton>
      </View>
    </OperationalShell>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: spacing.md },
  section: { gap: spacing.md },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 26,
  },
  list: { gap: spacing.sm },
  listItem: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bullet: { color: colors.primary, fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  body: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
  },
});
