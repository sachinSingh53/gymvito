import { router, type Href, usePathname } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSession } from '@/features/session/app-session-context';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

type NavKey = 'home' | 'members' | 'payments' | 'more';

export const BUSINESS_NAV_PHONE_HEIGHT = 68;
export const BUSINESS_NAV_TABLET_WIDTH = 84;

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  active: NavKey;
  headerAction?: ReactNode;
  scroll?: boolean;
  contentStyle?: object;
}>;

const NAV_ITEMS: readonly {
  key: NavKey;
  phoneIcon: string;
  tabletIcon: string;
  hindiLabel: string;
  labelKey: 'navHome' | 'navMembers' | 'navPayments' | 'navMore';
  route?: string;
}[] = [
  {
    key: 'home',
    phoneIcon: 'dashboard',
    tabletIcon: 'home',
    hindiLabel: 'होम',
    labelKey: 'navHome',
    route: '/home',
  },
  {
    key: 'members',
    phoneIcon: 'group',
    tabletIcon: 'group',
    hindiLabel: 'सदस्य',
    labelKey: 'navMembers',
    route: '/members',
  },
  {
    key: 'payments',
    phoneIcon: 'currency_rupee',
    tabletIcon: 'payments',
    hindiLabel: 'भुगतान',
    labelKey: 'navPayments',
    route: '/payments',
  },
  {
    key: 'more',
    phoneIcon: 'widgets',
    tabletIcon: 'widgets',
    hindiLabel: 'अधिक',
    labelKey: 'navMore',
    route: '/more',
  },
];

export function OperationalShell({
  title,
  subtitle,
  headerAction,
  scroll = true,
  contentStyle,
  children,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = width >= 600;
  const { t } = useTranslation();
  const { state, changeLanguage } = useAppSession();
  if (state.status !== 'unlocked') return null;
  const language = state.snapshot.settings?.language ?? 'en';
  const contentPadding = tablet ? spacing.lg : spacing.md;
  const responsiveContentStyle = {
    paddingLeft: contentPadding + (tablet ? 0 : insets.left),
    paddingRight: contentPadding + insets.right,
  };

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        tablet && styles.tabletContent,
        responsiveContentStyle,
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.content,
        tablet && styles.tabletContent,
        responsiveContentStyle,
        styles.flex,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={styles.safeArea}>
      <View style={styles.appArea}>
        <View
          style={[
            styles.header,
            {
              minHeight: 64 + insets.top,
              paddingTop: insets.top + 8,
              paddingLeft: spacing.md + (tablet ? 0 : insets.left),
              paddingRight: spacing.md + insets.right,
            },
          ]}
        >
          <View style={styles.headerIdentity}>
            {!tablet ? (
              <View style={styles.brandMark}>
                <MaterialSymbol color="#fff" name="fitness_center" size={24} />
              </View>
            ) : null}
            <View style={styles.headerTitles}>
              <View style={styles.brandLine}>
                <Text style={styles.brandName}>GymVito</Text>
                <Text style={styles.posBadge}>POS</Text>
              </View>
              <Text numberOfLines={1} style={styles.headerTitle}>
                {title}
              </Text>
              {tablet && subtitle ? (
                <Text numberOfLines={1} style={styles.headerSubtitle}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel={t('languageLabel')}
              accessibilityRole="button"
              onPress={() => void changeLanguage(language === 'en' ? 'hi' : 'en')}
              style={styles.languageToggle}
            >
              <Text numberOfLines={1} style={styles.languageText}>
                {language === 'en' ? 'EN|हिं' : 'हिन्दी|EN'}
              </Text>
            </Pressable>
            {headerAction}
            <View style={styles.ownerAvatar}>
              <Text style={styles.ownerAvatarText}>
                {state.ownerName.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
        {body}
      </View>
    </View>
  );
}

function activeNavigationKey(pathname: string): NavKey | null {
  if (pathname === '/home') return 'home';
  if (
    pathname === '/payments' ||
    pathname.startsWith('/invoice/') ||
    pathname.endsWith('/payment')
  ) {
    return 'payments';
  }
  if (pathname === '/members' || pathname.startsWith('/member/')) return 'members';
  if (
    pathname === '/more' ||
    pathname === '/plans' ||
    pathname.startsWith('/plan/') ||
    pathname === '/settings' ||
    pathname === '/billing-settings' ||
    pathname === '/gym-settings' ||
    pathname === '/backup-restore'
  ) {
    return 'more';
  }
  return null;
}

export function BusinessNavigation() {
  const pathname = usePathname();
  const active = activeNavigationKey(pathname);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = width >= 600;
  const { t } = useTranslation();
  const { state, lock } = useAppSession();
  if (state.status !== 'unlocked') return null;
  const language = state.snapshot.settings?.language ?? 'en';

  const navigate = (item: (typeof NAV_ITEMS)[number]) => {
    if (!item.route) return;
    if (item.key === active) return;
    router.navigate(item.route as Href);
  };

  return (
    <View
      style={
        tablet
          ? [
              styles.sideNavigation,
              {
                width: BUSINESS_NAV_TABLET_WIDTH + insets.left,
                paddingTop: insets.top + spacing.sm,
                paddingBottom: insets.bottom + spacing.sm,
                paddingLeft: insets.left,
              },
            ]
          : [
              styles.bottomNavigation,
              {
                height: BUSINESS_NAV_PHONE_HEIGHT + insets.bottom,
                paddingBottom: insets.bottom,
                paddingLeft: insets.left,
                paddingRight: insets.right,
              },
            ]
      }
    >
      {tablet ? (
        <View style={styles.sideBrand}>
          <View style={styles.sideBrandMark}>
            <MaterialSymbol color={colors.onDark} name="fitness_center" size={26} />
          </View>
          <Text style={styles.sideBrandText}>GYMVITO</Text>
        </View>
      ) : null}
      <View style={tablet ? styles.sideNavItems : styles.bottomNavItems}>
        {NAV_ITEMS.map((item) => {
          const selected = active === item.key;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.key}
              onPress={() => navigate(item)}
              style={({ pressed }) => [
                styles.navItem,
                !tablet && styles.bottomNavItem,
                tablet && styles.sideNavItem,
                !tablet && selected && styles.bottomNavItemSelected,
                tablet && selected && styles.sideNavItemSelected,
                pressed && styles.pressed,
              ]}
            >
              <MaterialSymbol
                color={
                  selected
                    ? tablet
                      ? '#a5f1e0'
                      : colors.primaryDark
                    : tablet
                      ? colors.border
                      : colors.textMuted
                }
                name={tablet ? item.tabletIcon : item.phoneIcon}
                size={tablet ? 22 : 24}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.navLabel,
                  tablet && styles.sideNavLabel,
                  selected && styles.navTextSelected,
                  tablet && selected && styles.sideNavTextSelected,
                ]}
              >
                {t(item.labelKey)}
              </Text>
              {tablet ? (
                <Text
                  numberOfLines={1}
                  style={[styles.navSecondaryLabel, selected && styles.sideNavTextSelected]}
                >
                  {language === 'hi' ? t(item.labelKey, { lng: 'en' }) : item.hindiLabel}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {tablet ? (
        <View style={styles.sideUtilities}>
          <View style={styles.localBadgeCompact}>
            <Text style={styles.localBadgeText}>{t('localDb')}</Text>
          </View>
          <Pressable
            accessibilityLabel={t('lockNow')}
            accessibilityRole="button"
            onPress={() => void lock('manual')}
            style={styles.lockButton}
          >
            <MaterialSymbol color={colors.onDark} name="lock" size={20} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function MaterialSymbol({
  name,
  size = 24,
  color = colors.text,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <Text
      allowFontScaling={false}
      style={{ color, fontFamily: fonts.symbols, fontSize: size, lineHeight: size + 2 }}
    >
      {name}
    </Text>
  );
}

export function SurfaceCard({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.surfaceCard, style]}>{children}</View>;
}

export function LocalDataBadge() {
  const { t } = useTranslation();
  return (
    <View style={styles.localBadge}>
      <View style={styles.localDot} />
      <Text style={styles.localBadgeText}>{t('savedOnDevice')}</Text>
    </View>
  );
}

export function StatusChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'active' | 'warning' | 'danger';
}) {
  return (
    <View
      style={[
        styles.statusChip,
        tone === 'active' && styles.statusActive,
        tone === 'warning' && styles.statusWarning,
        tone === 'danger' && styles.statusDanger,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          tone === 'active' && styles.statusTextActive,
          tone === 'warning' && styles.statusTextWarning,
          tone === 'danger' && styles.statusTextDanger,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  appArea: { flex: 1 },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerIdentity: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  headerTitles: { minWidth: 0, flex: 1 },
  brandLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  brandName: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 14 },
  posBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  headerTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 20, lineHeight: 25 },
  headerSubtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  headerActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  languageToggle: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
  },
  languageText: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 12 },
  ownerAvatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.primaryDark,
  },
  ownerAvatarText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  tabletContent: { padding: spacing.lg },
  bottomNavigation: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    minHeight: 68,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  bottomNavItems: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  sideNavigation: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 30,
    width: BUSINESS_NAV_TABLET_WIDTH,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.brandHeader,
  },
  sideBrand: { alignItems: 'center', gap: spacing.xs },
  sideBrandMark: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  sideBrandText: { color: '#a5f1e0', fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2 },
  sideNavItems: { width: '100%', gap: spacing.xs, paddingHorizontal: spacing.xs },
  navItem: {
    position: 'relative',
    minWidth: 64,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: 12,
  },
  bottomNavItem: { flex: 1, marginHorizontal: 2, marginVertical: 4 },
  bottomNavItemSelected: { backgroundColor: 'transparent' },
  sideNavItem: { width: '100%' },
  sideNavItemSelected: { backgroundColor: colors.primary },
  navLabel: {
    maxWidth: '100%',
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  sideNavLabel: { color: colors.border },
  navTextSelected: { color: colors.primaryDark, fontFamily: fonts.bold },
  sideNavTextSelected: { color: '#a5f1e0' },
  navSecondaryLabel: {
    maxWidth: '100%',
    color: colors.outline,
    fontFamily: fonts.medium,
    fontSize: 8,
    lineHeight: 10,
    textAlign: 'center',
  },
  sideUtilities: { alignItems: 'center', gap: spacing.sm },
  localBadgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1e3530',
  },
  lockButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#1e3530',
  },
  pressed: { opacity: 0.72 },
  surfaceCard: {
    minWidth: 0,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  localBadge: {
    minWidth: 0,
    minHeight: 28,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: '#ebf3f1',
  },
  localDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  localBadgeText: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 14,
  },
  statusChip: {
    minWidth: 0,
    minHeight: 28,
    maxWidth: '100%',
    flexShrink: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: '#ebf3f1',
  },
  statusActive: { borderColor: '#bee5d6', backgroundColor: colors.successSurface },
  statusWarning: { borderColor: colors.warningBorder, backgroundColor: colors.warningSurface },
  statusDanger: { borderColor: '#f5bebe', backgroundColor: colors.dangerSurface },
  statusText: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  statusTextActive: { color: colors.successText },
  statusTextWarning: { color: colors.warningText },
  statusTextDanger: { color: colors.dangerText },
});
