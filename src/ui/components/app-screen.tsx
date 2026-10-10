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

import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';
import { MaterialSymbol } from '@/ui/components/operational-shell';

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
  const tablet = width >= 600;
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(backHref);
  };
  const body = (
    <View style={[styles.content, tablet && styles.tabletContent]}>
      <View style={styles.headerRow}>
        {canGoBack ? (
          <Pressable
            accessibilityLabel={t('back')}
            accessibilityRole="button"
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
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
      <View style={[styles.card, tablet && styles.tabletCard]}>{children}</View>
    </View>
  );
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: spacing.md,
    gap: spacing.md,
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
  pressed: { opacity: 0.72 },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 40,
  },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  card: {
    minWidth: 0,
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  tabletCard: { padding: spacing.lg },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
});
