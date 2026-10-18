import { router, type Href, useIsFocused, usePathname } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { type EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSession } from '@/features/session/app-session-context';
import { useGlassBlurTarget } from '@/ui/components/glass-context';
import { GlassBackdrop, GlassSurface } from '@/ui/components/glass-surface';
import {
  CARD_RADIUS,
  actionPressed,
  colors,
  fonts,
  glass,
  radii,
  spacing,
} from '@/ui/theme/tokens';

type NavKey = 'home' | 'members' | 'payments' | 'more';

export const BUSINESS_NAV_PHONE_HEIGHT = 68;
export const BUSINESS_NAV_TABLET_WIDTH = 84;
/** Gap between floating glass chrome and the screen edges. */
const GLASS_CHROME_INSET = 12;

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  active: NavKey;
  canGoBack?: boolean;
  backHref?: Href;
  headerAction?: ReactNode;
  scroll?: boolean;
  contentStyle?: object;
}>;

type NavigationInset = { left: number; bottom: number };

const NO_NAVIGATION_INSET: NavigationInset = Object.freeze({ left: 0, bottom: 0 });

/** Space the floating glass navigation takes from the route area. */
function floatingNavigationInset(tablet: boolean, insets: EdgeInsets): NavigationInset {
  return tablet
    ? { left: GLASS_CHROME_INSET + BUSINESS_NAV_TABLET_WIDTH + insets.left, bottom: 0 }
    : {
        left: 0,
        bottom: Math.max(insets.bottom, GLASS_CHROME_INSET) + BUSINESS_NAV_PHONE_HEIGHT,
      };
}

/** Holds the focused screen's floating header so it can render outside the blur target. */
type FloatingHeaderSlot = {
  show(owner: object, header: ReactNode): void;
  hide(owner: object): void;
  subscribe(listener: () => void): () => void;
  current(): ReactNode;
};

function createFloatingHeaderSlot(): FloatingHeaderSlot {
  let owner: object | null = null;
  let header: ReactNode = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    show(nextOwner, nextHeader) {
      owner = nextOwner;
      header = nextHeader;
      notify();
    },
    hide(currentOwner) {
      if (owner !== currentOwner) return;
      owner = null;
      header = null;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    current: () => header,
  };
}

const BusinessChromeContext = createContext<{
  header: FloatingHeaderSlot;
  navigationInset: NavigationInset;
} | null>(null);

/**
 * Floating glass chrome for the business navigator. On Android a blur target cannot contain the
 * blur, so screens hand their header to `FloatingHeaderHost`, which sits beside the
 * `GlassBlurTarget` with `BusinessNavigation`.
 */
export function BusinessChromeProvider({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [header] = useState(createFloatingHeaderSlot);
  const navigationInset = floatingNavigationInset(width >= 600, insets);
  const { left, bottom } = navigationInset;
  const value = useMemo(
    () => ({ header, navigationInset: { left, bottom } }),
    [header, left, bottom],
  );
  return <BusinessChromeContext.Provider value={value}>{children}</BusinessChromeContext.Provider>;
}

/** Space to leave for the floating navigation; zero outside `BusinessChromeProvider`. */
export function useBusinessNavigationInset(): NavigationInset {
  return useContext(BusinessChromeContext)?.navigationInset ?? NO_NAVIGATION_INSET;
}

const NO_HEADER_SLOT: Pick<FloatingHeaderSlot, 'subscribe' | 'current'> = {
  subscribe: () => () => undefined,
  current: () => null,
};

export function FloatingHeaderHost({ style }: { style?: StyleProp<ViewStyle> }) {
  const slot = useContext(BusinessChromeContext)?.header ?? NO_HEADER_SLOT;
  const header = useSyncExternalStore(slot.subscribe, slot.current);
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, style]}>
      {header}
    </View>
  );
}

/** Shows `header` in the host while this screen is focused. */
function FloatingHeaderPortal({ slot, header }: { slot: FloatingHeaderSlot; header: ReactNode }) {
  const focused = useIsFocused();
  const [owner] = useState(() => ({}));
  useLayoutEffect(() => {
    if (focused) slot.show(owner, header);
  }, [focused, header, owner, slot]);
  useLayoutEffect(() => {
    if (!focused) return;
    return () => slot.hide(owner);
  }, [focused, owner, slot]);
  return null;
}

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
  active,
  canGoBack = false,
  backHref,
  headerAction,
  scroll = true,
  contentStyle,
  children,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const chrome = useContext(BusinessChromeContext);
  const blurTargetRef = useGlassBlurTarget();
  const [glassHeaderHeight, setGlassHeaderHeight] = useState(64);
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
  const fallbackHref = backHref ?? (`/${active}` as Href);
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  };

  const navigationInset = chrome?.navigationInset ?? NO_NAVIGATION_INSET;
  const chromeContentStyle = [
    { paddingTop: insets.top + GLASS_CHROME_INSET + glassHeaderHeight + spacing.md },
    navigationInset.bottom > 0 &&
      (scroll
        ? { paddingBottom: navigationInset.bottom + contentPadding }
        : { marginBottom: navigationInset.bottom }),
  ];

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        tablet && styles.tabletContent,
        responsiveContentStyle,
        contentStyle,
        chromeContentStyle,
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
        chromeContentStyle,
      ]}
    >
      {children}
    </View>
  );

  const headerContent = (
    <>
      <View style={styles.headerIdentity}>
        {canGoBack ? (
          <Pressable
            accessibilityLabel={t('back')}
            accessibilityRole="button"
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <MaterialSymbol color={colors.primaryDark} name="arrow_back" size={24} />
          </Pressable>
        ) : !tablet ? (
          <View style={styles.brandMark}>
            <MaterialSymbol color={colors.onPrimary} name="fitness_center" size={24} />
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
    </>
  );

  const header = (
    <GlassSurface
      blurTarget={blurTargetRef}
      onLayout={setGlassHeaderHeight}
      style={[
        styles.header,
        {
          top: insets.top + GLASS_CHROME_INSET,
          left: GLASS_CHROME_INSET + (tablet ? navigationInset.left : insets.left),
          right: GLASS_CHROME_INSET + insets.right,
        },
      ]}
    >
      {headerContent}
    </GlassSurface>
  );
  if (chrome) {
    return (
      <View style={styles.flex}>
        {body}
        <FloatingHeaderPortal header={header} slot={chrome.header} />
      </View>
    );
  }
  return (
    <View style={styles.safeArea}>
      <GlassBackdrop />
      {body}
      {header}
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
    pathname === '/backup-restore' ||
    pathname === '/reports' ||
    pathname === '/data-export' ||
    pathname === '/help-privacy'
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
  const blurTargetRef = useGlassBlurTarget();
  if (state.status !== 'unlocked') return null;
  const language = state.snapshot.settings?.language ?? 'en';
  const chromeBottom = Math.max(insets.bottom, GLASS_CHROME_INSET);

  const navigate = (item: (typeof NAV_ITEMS)[number]) => {
    if (!item.route) return;
    if (item.key === active) return;
    router.navigate(item.route as Href);
  };

  const iconColor = (selected: boolean) => (selected ? colors.primaryDark : colors.textMuted);

  const content = (
    <>
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
                selected && styles.navItemSelected,
                pressed && actionPressed,
              ]}
            >
              <MaterialSymbol
                color={iconColor(selected)}
                name={tablet ? item.tabletIcon : item.phoneIcon}
                size={tablet ? 22 : 24}
              />
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                numberOfLines={1}
                style={[styles.navLabel, selected && styles.navTextSelected]}
              >
                {t(item.labelKey)}
              </Text>
              {tablet ? (
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  numberOfLines={1}
                  style={styles.navSecondaryLabel}
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
            style={({ pressed }) => [styles.lockButton, pressed && actionPressed]}
          >
            <MaterialSymbol color={colors.primaryDark} name="lock" size={20} />
          </Pressable>
        </View>
      ) : null}
    </>
  );

  return (
    <GlassSurface
      blurTarget={blurTargetRef}
      style={
        tablet
          ? [
              styles.sideNavigation,
              {
                top: insets.top + GLASS_CHROME_INSET,
                bottom: chromeBottom,
                left: GLASS_CHROME_INSET + insets.left,
              },
            ]
          : [
              styles.bottomNavigation,
              {
                bottom: chromeBottom,
                left: GLASS_CHROME_INSET + insets.left,
                right: GLASS_CHROME_INSET + insets.right,
              },
            ]
      }
    >
      {content}
    </GlassSurface>
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

/**
 * Content panel. A caller's `backgroundColor` (e.g. a warning wash) becomes the glass tint,
 * since the frost would otherwise cover it.
 */
export function SurfaceCard({ children, style }: PropsWithChildren<{ style?: object }>) {
  const { backgroundColor, ...panelStyle } =
    StyleSheet.flatten(style as StyleProp<ViewStyle>) ?? {};
  return (
    <GlassSurface
      radius={CARD_RADIUS}
      style={[styles.surfaceCard, panelStyle]}
      tint={typeof backgroundColor === 'string' ? backgroundColor : undefined}
    >
      {children}
    </GlassSurface>
  );
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
  header: {
    position: 'absolute',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingHorizontal: 12,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: glass.panelRim,
    backgroundColor: 'transparent',
    // Android `elevation` paints its shadow through translucent glass as a gray smear; an
    // outset box shadow is drawn only outside the border box.
    shadowOpacity: 0,
    boxShadow: glass.chromeShadow,
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.rimSoft,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    borderRadius: 24,
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
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: radii.pill,
    backgroundColor: glass.fillAccent,
  },
  languageText: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 12 },
  ownerAvatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.rimSoft,
    borderRadius: 20,
    backgroundColor: colors.primaryDark,
  },
  ownerAvatarText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 16 },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: 'transparent',
  },
  tabletContent: { padding: spacing.lg },
  bottomNavigation: {
    position: 'absolute',
    zIndex: 20,
    height: BUSINESS_NAV_PHONE_HEIGHT,
    paddingHorizontal: spacing.xs,
    shadowOpacity: 0,
    boxShadow: glass.chromeShadow,
  },
  bottomNavItems: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  sideNavigation: {
    position: 'absolute',
    zIndex: 30,
    width: BUSINESS_NAV_TABLET_WIDTH,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    shadowOpacity: 0,
    boxShadow: glass.chromeShadow,
  },
  sideBrand: { alignItems: 'center', gap: spacing.xs },
  sideBrandMark: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.rimSoft,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  sideBrandText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  sideNavItems: { width: '100%', gap: spacing.xs, paddingHorizontal: spacing.xs },
  navItem: {
    position: 'relative',
    minWidth: 64,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radii.pill,
  },
  navItemSelected: {
    borderColor: glass.rimAccent,
    backgroundColor: glass.fillAccent,
  },
  bottomNavItem: { flex: 1, marginHorizontal: 2, marginVertical: 4 },
  sideNavItem: { width: '100%' },
  navLabel: {
    maxWidth: '100%',
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  navTextSelected: { color: colors.primaryDark, fontFamily: fonts.bold },
  navSecondaryLabel: {
    maxWidth: '100%',
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  sideUtilities: { alignItems: 'center', gap: spacing.sm },
  localBadgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: 8,
    backgroundColor: glass.fillAccent,
  },
  lockButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: 24,
    backgroundColor: glass.fillAccent,
  },
  pressed: { opacity: 0.72 },
  surfaceCard: { minWidth: 0, padding: spacing.md },
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
    borderColor: glass.rimAccent,
    borderRadius: radii.pill,
    backgroundColor: glass.fillNeutral,
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
    borderColor: glass.rimAccent,
    borderRadius: radii.pill,
    backgroundColor: glass.fillNeutral,
  },
  statusActive: { borderColor: glass.rimSuccess, backgroundColor: glass.fillSuccess },
  statusWarning: { borderColor: glass.rimWarning, backgroundColor: glass.fillWarning },
  statusDanger: { borderColor: glass.rimDanger, backgroundColor: glass.fillDanger },
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
