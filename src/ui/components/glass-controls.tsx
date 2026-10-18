import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/ui/components/core-controls';
import { GlassSurface } from '@/ui/components/glass-surface';
import { MaterialSymbol, StatusChip } from '@/ui/components/operational-shell';
import {
  actionPressed,
  CARD_RADIUS,
  colors,
  fonts,
  glass,
  radii,
  spacing,
} from '@/ui/theme/tokens';

/** Round 48dp icon action with the brand-tinted fill, for use on glass panels. */
export function GlassIconButton({
  icon,
  accessibilityLabel,
  onPress,
}: {
  icon: string;
  accessibilityLabel: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && actionPressed]}
    >
      <MaterialSymbol color={colors.primaryDark} name={icon} size={22} />
    </Pressable>
  );
}

/** Stacked icon-over-label action; fits three to a row without truncating labels. */
export function ActionTile({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: string;
  label: string;
  onPress(): void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        primary && styles.tilePrimary,
        pressed && actionPressed,
      ]}
    >
      <View style={[styles.tileIcon, primary && styles.tileIconPrimary]}>
        <MaterialSymbol
          color={primary ? colors.onPrimary : colors.primaryDark}
          name={icon}
          size={22}
        />
      </View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={1}
        style={[styles.tileText, primary && styles.tileTextPrimary]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type ListRowAction = {
  icon: string;
  label: string;
  accessibilityLabel: string;
  onPress(): void;
};

/** Glass list card: avatar, title and meta, a trailing status chip, then amount and action. */
export function GlassListRow({
  title,
  meta,
  avatarText,
  tone = 'neutral',
  status,
  amount,
  action,
}: {
  title: string;
  meta: string;
  avatarText: string;
  tone?: 'neutral' | 'active' | 'warning' | 'danger';
  status?: string;
  amount?: string;
  action?: ListRowAction;
}) {
  const danger = tone === 'danger';
  return (
    <GlassSurface radius={CARD_RADIUS} style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.identity}>
          <View style={[styles.avatar, danger && styles.avatarDanger]}>
            <Text style={[styles.avatarText, danger && styles.avatarTextDanger]}>{avatarText}</Text>
          </View>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            <Text numberOfLines={2} style={styles.meta}>
              {meta}
            </Text>
          </View>
        </View>
        {status ? (
          <View style={styles.status}>
            <StatusChip label={status} tone={tone} />
          </View>
        ) : null}
      </View>
      {amount !== undefined || action ? (
        <View style={styles.actionRow}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={[styles.amount, danger && styles.amountDanger]}
          >
            {amount}
          </Text>
          {action ? (
            <AppButton
              accessibilityLabel={action.accessibilityLabel}
              icon={<MaterialSymbol color={colors.onPrimary} name={action.icon} size={18} />}
              onPress={action.onPress}
              style={styles.action}
              variant={danger ? 'danger' : 'primary'}
            >
              {action.label}
            </AppButton>
          ) : null}
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    backgroundColor: glass.fillAccent,
  },
  tile: {
    minWidth: 0,
    minHeight: 84,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.xs,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: 20,
    backgroundColor: glass.fillOpaque,
  },
  tilePrimary: { borderColor: colors.primaryDark, backgroundColor: colors.primary },
  tileIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: glass.fillAccent,
  },
  tileIconPrimary: { backgroundColor: glass.fillOnPrimary },
  tileText: {
    maxWidth: '100%',
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  tileTextPrimary: { color: colors.onPrimary },
  row: { gap: spacing.sm, padding: spacing.md },
  rowTop: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  identity: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: glass.rim,
    backgroundColor: glass.fillMuted,
  },
  avatarDanger: { borderColor: glass.rimDangerStrong, backgroundColor: glass.fillDanger },
  avatarText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 14 },
  avatarTextDanger: { color: colors.dangerText },
  copy: { minWidth: 0, flex: 1, gap: 2 },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  meta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  status: { maxWidth: '45%', flexShrink: 0 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: glass.divider,
  },
  amount: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  amountDanger: { color: colors.danger },
  action: { flexShrink: 1, paddingHorizontal: spacing.md },
});
