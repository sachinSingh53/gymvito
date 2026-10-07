import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MembershipDirectoryItem } from '@/data/repositories/phase3-repository';
import { memberInitials } from '@/domain/members/member';
import { StatusChip } from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

export function MemberCard({
  member,
  selected = false,
  onPress,
}: {
  member: MembershipDirectoryItem;
  selected?: boolean;
  onPress(): void;
}) {
  const { t } = useTranslation();
  const featured = member.current ?? member.upcoming ?? member.latest;
  const statusLabel =
    member.status === 'no-membership'
      ? t('memberStatusNoMembership')
      : member.status === 'upcoming'
        ? t('membershipStatusScheduled')
        : member.status === 'expired'
          ? t('membershipStatusExpired')
          : t(member.status);
  return (
    <Pressable
      accessibilityLabel={t('openMemberProfile', { name: member.name })}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{memberInitials(member.name)}</Text>
        </View>
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {member.name}
            </Text>
            <StatusChip
              label={statusLabel}
              tone={
                member.status === 'active'
                  ? 'active'
                  : member.status === 'upcoming'
                    ? 'warning'
                    : member.status === 'expired'
                      ? 'danger'
                      : 'neutral'
              }
            />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.code}>{member.memberCode}</Text>
            <Text numberOfLines={1} style={styles.meta}>
              {featured?.planName ?? t('noMembership')}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.statusStrip}>
        <Text numberOfLines={2} style={styles.statusText}>
          {featured
            ? featured.status === 'scheduled'
              ? t('startsOn', { date: featured.startDate })
              : t('validThrough', { date: featured.endDate })
            : t('membershipNotStarted')}
        </Text>
        <Text numberOfLines={2} style={styles.statusAction}>
          {featured ? t('renewMembership') : t('createInPhase3')}
        </Text>
      </View>
      <View style={styles.contactRow}>
        <Text numberOfLines={1} style={styles.contact}>
          {member.phone || member.email || t('noContact')}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 150,
    gap: spacing.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.surfaceLow },
  pressed: { opacity: 0.78 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
  },
  initials: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 18 },
  identity: { minWidth: 0, flex: 1, gap: spacing.xs },
  nameRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { minWidth: 0, flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  code: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    color: colors.textMuted,
    backgroundColor: colors.surfaceContainer,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  meta: { minWidth: 0, flex: 1, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  statusStrip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
  },
  statusText: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  statusAction: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
  },
  contactRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  contact: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  chevron: { color: colors.outline, fontFamily: fonts.regular, fontSize: 26 },
});
