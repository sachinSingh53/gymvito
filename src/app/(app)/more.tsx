import { router, type Href } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MaterialSymbol, OperationalShell, SurfaceCard } from '@/ui/components/operational-shell';
import { actionPressed, colors, fonts, glass, radii, spacing } from '@/ui/theme/tokens';

type MenuItem = { icon: string; route: string; titleKey: string; descriptionKey: string };

const MANAGEMENT: readonly MenuItem[] = [
  {
    icon: 'card_membership',
    route: '/plans',
    titleKey: 'membershipPlans',
    descriptionKey: 'plansSubtitle',
  },
  {
    icon: 'settings',
    route: '/settings',
    titleKey: 'settings',
    descriptionKey: 'settingsSubtitle',
  },
  {
    icon: 'receipt_long',
    route: '/billing-settings',
    titleKey: 'billingSettings',
    descriptionKey: 'numberPrefixes',
  },
  {
    icon: 'backup',
    route: '/backup-restore',
    titleKey: 'backupCenterTitle',
    descriptionKey: 'backupCenterSubtitle',
  },
  { icon: 'bar_chart', route: '/reports', titleKey: 'reports', descriptionKey: 'reportsSubtitle' },
  {
    icon: 'help',
    route: '/help-privacy',
    titleKey: 'helpAndPrivacy',
    descriptionKey: 'helpPrivacySubtitle',
  },
];

const DATA_TOOLS: readonly MenuItem[] = [
  {
    icon: 'ios_share',
    route: '/data-export',
    titleKey: 'dataExport',
    descriptionKey: 'dataExportSubtitle',
  },
];

export default function MoreRoute() {
  const { t } = useTranslation();
  return (
    <OperationalShell active="more" subtitle={t('managementTools')} title={t('more')}>
      <MenuSection items={MANAGEMENT} title={t('management')} />
      <MenuSection items={DATA_TOOLS} title={t('dataTools')}>
        <View accessibilityRole="summary" style={styles.privacyNote}>
          <MaterialSymbol color={colors.warningText} name="shield_lock" size={20} />
          <Text style={styles.privacyText}>{t('exportPrivacyWarning')}</Text>
        </View>
      </MenuSection>
    </OperationalShell>
  );
}

function MenuSection({
  title,
  items,
  children,
}: {
  title: string;
  items: readonly MenuItem[];
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      <SurfaceCard style={styles.list}>
        {items.map((item, index) => (
          <Fragment key={item.route}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <Pressable
              accessibilityLabel={t(item.titleKey)}
              accessibilityRole="button"
              onPress={() => router.push(item.route as Href)}
              style={({ pressed }) => [styles.row, pressed && actionPressed]}
            >
              <View style={styles.bubble}>
                <MaterialSymbol color={colors.primaryDark} name={item.icon} size={22} />
              </View>
              <View style={styles.rowCopy}>
                <Text numberOfLines={2} style={styles.rowTitle}>
                  {t(item.titleKey)}
                </Text>
                <Text numberOfLines={2} style={styles.rowDescription}>
                  {t(item.descriptionKey)}
                </Text>
              </View>
              <MaterialSymbol color={colors.textMuted} name="chevron_right" size={24} />
            </Pressable>
          </Fragment>
        ))}
        {children}
      </SurfaceCard>
    </View>
  );
}

const BUBBLE_SIZE = 44;

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: {
    paddingHorizontal: spacing.xs,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 22,
  },
  list: { padding: spacing.xs },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: 14,
    backgroundColor: glass.fillAccent,
  },
  rowCopy: { minWidth: 0, flex: 1, gap: 2 },
  rowTitle: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
  },
  rowDescription: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    marginLeft: 12 + BUBBLE_SIZE + 12,
    marginRight: 12,
    backgroundColor: glass.divider,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    margin: spacing.xs,
    padding: 12,
    borderWidth: 1,
    borderColor: glass.rimWarning,
    borderRadius: radii.lg,
    backgroundColor: glass.fillWarning,
  },
  privacyText: {
    minWidth: 0,
    flex: 1,
    color: colors.warningText,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
});
