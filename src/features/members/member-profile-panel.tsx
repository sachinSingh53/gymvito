import { router, type Href } from 'expo-router';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MemberRecord } from '@/data/repositories/phase2-repository';
import { memberInitials } from '@/domain/members/member';
import { useAppSession } from '@/features/session/app-session-context';
import { memberPhotoDataUri } from '@/platform/images/member-photo';
import { AppButton, Notice } from '@/ui/components/core-controls';
import { LocalDataBadge, StatusChip, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

const AUDIT_LABELS: Record<string, string> = {
  member_created: 'auditMemberCreated',
  member_updated: 'auditMemberUpdated',
  member_archived: 'auditMemberArchived',
  member_restored: 'auditMemberRestored',
};

export function MemberProfilePanel({
  member,
  onChanged,
  compact = false,
}: {
  member: MemberRecord;
  onChanged?(): void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { state, getPhase2Repository } = useAppSession();
  if (state.status !== 'unlocked') return null;

  const toggleArchive = () => {
    Alert.alert(
      member.isArchived ? t('restoreMember') : t('archiveMember'),
      member.isArchived ? t('restoreMemberMessage') : t('archiveMemberMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: member.isArchived ? t('restore') : t('archive'),
          style: member.isArchived ? 'default' : 'destructive',
          onPress: () =>
            void getPhase2Repository()
              .setMemberArchived(member.id, !member.isArchived, state.ownerId)
              .then(() => onChanged?.()),
        },
      ],
    );
  };

  return (
    <View style={[styles.panel, compact && styles.compact]}>
      <View style={styles.ribbon}>
        <LocalDataBadge />
        <StatusChip
          label={member.isArchived ? t('archived') : t('active')}
          tone={member.isArchived ? 'neutral' : 'active'}
        />
      </View>
      <SurfaceCard style={styles.profileCard}>
        <View style={styles.identityRow}>
          {member.photo ? (
            <Image
              accessibilityLabel={t('memberPhoto', { name: member.name })}
              source={{ uri: memberPhotoDataUri(member.photo) }}
              style={styles.photo}
            />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={styles.initials}>{memberInitials(member.name)}</Text>
            </View>
          )}
          <View style={styles.identityText}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{member.name}</Text>
              <Text style={styles.code}>{member.memberCode}</Text>
            </View>
            <Text style={styles.memberSince}>
              {t('memberSince', { date: member.createdAtUtc.slice(0, 10) })}
            </Text>
            <Text style={styles.contact}>{member.phone || member.email || t('noContact')}</Text>
          </View>
        </View>
        <View style={styles.emptyMembership}>
          <Text style={styles.emptyMembershipTitle}>{t('noCurrentMembership')}</Text>
          <Text style={styles.emptyMembershipText}>{t('membershipPhase3Message')}</Text>
        </View>
      </SurfaceCard>
      <View style={styles.actions}>
        <AppButton
          onPress={() => router.push(`/member/${member.id}/edit` as Href)}
          variant="secondary"
        >
          {t('editProfile')}
        </AppButton>
        <AppButton onPress={toggleArchive} variant={member.isArchived ? 'secondary' : 'danger'}>
          {member.isArchived ? t('restore') : t('archive')}
        </AppButton>
      </View>
      <View style={styles.tabs}>
        <View style={styles.activeTab}>
          <Text style={styles.activeTabText}>{t('summary')}</Text>
        </View>
        <Text style={styles.tabText}>{t('plans')}</Text>
        <Text style={styles.tabText}>{t('payments')}</Text>
        <Text style={styles.tabText}>{t('notes')}</Text>
      </View>
      <SurfaceCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t('memberDetails')}</Text>
        <Detail label={t('emailOptional')} value={member.email || '—'} />
        <Detail label={t('dateOfBirth')} value={member.dateOfBirth || '—'} />
        <Detail label={t('genderOptional')} value={member.gender || '—'} />
        <Detail label={t('addressOptional')} value={member.address || '—'} />
        <Detail
          label={t('emergencyContact')}
          value={
            [member.emergencyContactName, member.emergencyContactPhone]
              .filter(Boolean)
              .join(' • ') || '—'
          }
        />
        <Detail label={t('joiningSource')} value={member.joiningSource || '—'} />
      </SurfaceCard>
      <SurfaceCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('deskNotes')}</Text>
          <Text style={styles.sectionMeta}>{member.notes.length}</Text>
        </View>
        {!member.notes.length ? (
          <Text style={styles.emptyText}>{t('noNotes')}</Text>
        ) : (
          member.notes.map((note) => (
            <View key={note.id} style={styles.note}>
              <Text style={styles.noteText}>{note.content}</Text>
              <Text style={styles.noteDate}>{note.createdAtUtc.slice(0, 10)}</Text>
            </View>
          ))
        )}
      </SurfaceCard>
      <SurfaceCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('recentActivity')}</Text>
          <Text style={styles.sectionMeta}>{t('auditTrail')}</Text>
        </View>
        {!member.audit.length ? (
          <Text style={styles.emptyText}>{t('noActivity')}</Text>
        ) : (
          member.audit.map((event) => (
            <View key={event.id} style={styles.activity}>
              <View style={styles.activityDot} />
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle}>
                  {t(AUDIT_LABELS[event.summaryCode] ?? 'auditMemberUpdated')}
                </Text>
                <Text style={styles.noteDate}>{event.occurredAtUtc.slice(0, 10)}</Text>
              </View>
            </View>
          ))
        )}
      </SurfaceCard>
      <Notice>{t('memberHistoryPreserved')}</Notice>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', maxWidth: 900, alignSelf: 'center', gap: spacing.md },
  compact: { maxWidth: undefined },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  profileCard: { gap: spacing.md },
  identityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  photo: { width: 68, height: 68, borderRadius: 34 },
  photoFallback: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
    backgroundColor: colors.surfaceHigh,
  },
  initials: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 22 },
  identityText: { minWidth: 0, flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 22 },
  code: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    color: colors.textMuted,
    backgroundColor: colors.surfaceContainer,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  memberSince: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  contact: { color: colors.primaryDark, fontFamily: fonts.medium, fontSize: 14 },
  emptyMembership: {
    gap: spacing.xs,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
  },
  emptyMembershipTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  emptyMembershipText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  tabs: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
  },
  activeTab: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  activeTabText: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 12 },
  tabText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'center',
  },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16 },
  sectionMeta: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11 },
  detail: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  detailLabel: { flex: 1, color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12 },
  detailValue: {
    flex: 2,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'right',
  },
  note: {
    gap: spacing.xs,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLow,
  },
  noteText: { color: colors.text, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  noteDate: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  activity: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activityDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceHigh },
  activityCopy: { flex: 1 },
  activityTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 13 },
});
