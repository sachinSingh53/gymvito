import { router, type Href } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD_RADIUS, actionPressed, colors, fonts, spacing } from '@/ui/theme/tokens';
import { useGlassBlurTarget } from '@/ui/components/glass-context';
import { GlassBackdrop, GlassSurface } from '@/ui/components/glass-surface';
import { MaterialSymbol, useBusinessNavigationInset } from '@/ui/components/operational-shell';

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  scroll?: boolean;
  canGoBack?: boolean;
  backHref?: Href;
}>;

export function AppScreen({
  title,
  subtitle,
  footer,
  scroll = true,
  canGoBack = false,
  backHref = '/home',
  children,
}: Props) {
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const layoutBackdrop = Boolean(useGlassBlurTarget());
  const navigationInset = useBusinessNavigationInset();
  const tablet = width >= 600;
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(backHref);
  };
  const headerRow = (
    <View style={styles.headerRow}>
      {canGoBack ? (
        <Pressable
          accessibilityLabel={t('back')}
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.backButton, pressed && actionPressed]}
        >
          <MaterialSymbol color={colors.primaryDark} name="arrow_back" size={24} />
        </Pressable>
      ) : null}
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
  const body = (
    <View style={[styles.content, tablet && styles.tabletContent]}>
      <GlassSurface radius={CARD_RADIUS} style={[styles.panel, tablet && styles.tabletPanel]}>
        {headerRow}
      </GlassSurface>
      <GlassSurface
        radius={CARD_RADIUS}
        style={[styles.panel, styles.panelGap, tablet && styles.tabletPanel]}
      >
        {children}
      </GlassSurface>
    </View>
  );
  const navigationSpace = navigationInset.bottom;
  const scrollUnderNavigation = scroll && !footer && navigationSpace > 0;
  return (
    <SafeAreaView
      edges={navigationSpace > 0 ? ['top', 'left', 'right'] : undefined}
      style={[styles.safeArea, layoutBackdrop && styles.transparent]}
    >
      {layoutBackdrop ? null : <GlassBackdrop />}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              scrollUnderNavigation && { paddingBottom: navigationSpace },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
        {footer ? <GlassSurface style={styles.footer}>{footer}</GlassSurface> : null}
        {navigationSpace > 0 && !scrollUnderNavigation ? (
          <View style={{ height: navigationSpace }} />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  transparent: { backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1 },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: spacing.md,
    gap: 12,
  },
  tabletContent: { padding: spacing.lg, gap: spacing.lg },
  headerRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  header: { minWidth: 0, flex: 1, gap: spacing.sm },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    borderRadius: 24,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 40,
  },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  panel: { minWidth: 0, padding: spacing.md },
  panelGap: { gap: spacing.md },
  tabletPanel: { padding: spacing.lg },
  footer: { marginHorizontal: 12, marginBottom: 12, padding: spacing.md },
});
