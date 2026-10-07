import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MemberRecord } from '@/data/repositories/phase2-repository';
import type {
  MemberMembershipSummary,
  MembershipEventRecord,
  MembershipRecord,
} from '@/data/repositories/phase3-repository';
import { memberInitials } from '@/domain/members/member';
import { membershipProgress } from '@/domain/memberships/membership';
import { useLocalBusinessDate } from '@/features/memberships/use-local-business-date';
import { useAppSession } from '@/features/session/app-session-context';
import { formatDateOnly, formatMoneyMinor } from '@/i18n/formatters/regional-formatters';
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

const STATUS_LABELS = {
  draft: 'membershipStatusDraft',
  scheduled: 'membershipStatusScheduled',
  active: 'membershipStatusActive',
  expired: 'membershipStatusExpired',
  cancelled: 'membershipStatusCancelled',
} as const;

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
  const { state, getPhase2Repository, getPhase3Repository } = useAppSession();
  const timeZone = state.status === 'unlocked' ? state.deviceLocale.timeZone : 'UTC';
  const today = useLocalBusinessDate(timeZone);
  const [memberships, setMemberships] = useState<readonly MembershipRecord[]>([]);
  const [events, setEvents] = useState<readonly MembershipEventRecord[]>([]);
  const [summary, setSummary] = useState<MemberMembershipSummary | null>(null);
  useEffect(() => {
    let active = true;
    const repository = getPhase3Repository();
    void Promise.all([
      repository.listMemberships(member.id, today),
      repository.listMembershipEvents(member.id),
      repository.getMemberSummary(member.id, today),
    ])
      .then(([nextMemberships, nextEvents, nextSummary]) => {
        if (!active) return;
        setMemberships(nextMemberships);
        setEvents(nextEvents);
        setSummary(nextSummary);
      })
      .catch(() => {
        if (!active) return;
        setMemberships([]);
        setEvents([]);
        setSummary(null);
      });
    return () => {
      active = false;
    };
  }, [getPhase3Repository, member.id, today]);
  if (state.status !== 'unlocked') return null;

  const settings = {
    language: state.snapshot.settings?.language ?? 'en',
    currencyCode: state.snapshot.settings?.currencyCode ?? 'INR',
    dateFormat: state.snapshot.settings?.dateFormat ?? ('day-month-year' as const),
  };
  const featured = summary?.current ?? summary?.upcoming ?? summary?.latest ?? null;
  const progress = featured ? membershipProgress(featured, today) : null;
  const memberStatus = member.isArchived ? 'archived' : (summary?.status ?? 'no-membership');
  const memberStatusLabel =
    memberStatus === 'no-membership'
      ? t('memberStatusNoMembership')
      : memberStatus === 'upcoming'
        ? t('membershipStatusScheduled')
        : memberStatus === 'expired'
          ? t('membershipStatusExpired')
          : t(memberStatus);

  const toggleArchive = () => {
    Alert.alert(
      member.isArchived ? t('restoreMember') : t('archiveMember'),
      member.isArchived
        ? t('restoreMemberMessage')
        : summary?.current || summary?.upcoming
          ? t('archiveMemberActiveMessage')
          : t('archiveMemberMessage'),
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
          label={memberStatusLabel}
          tone={
            memberStatus === 'active'
              ? 'active'
              : memberStatus === 'upcoming'
                ? 'warning'
                : memberStatus === 'expired'
                  ? 'danger'
                  : 'neutral'
          }
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
        {featured ? (
          <View
            style={[
              styles.membershipBanner,
              featured.status === 'expired' && styles.membershipBannerDanger,
            ]}
          >
            <View style={styles.membershipBannerCopy}>
              <Text style={styles.emptyMembershipTitle}>
                {featured.status === 'active'
                  ? t('currentSubscription')
                  : featured.status === 'scheduled'
                    ? t('upcomingSubscription')
                    : t('membershipStatusExpired')}
              </Text>
              <Text style={styles.emptyMembershipText}>{featured.planName}</Text>
            </View>
            <StatusChip
              label={t(STATUS_LABELS[featured.status])}
              tone={
                featured.status === 'active'
                  ? 'active'
                  : featured.status === 'scheduled'
                    ? 'warning'
                    : 'danger'
              }
            />
          </View>
        ) : (
          <View style={styles.emptyMembership}>
            <Text style={styles.emptyMembershipTitle}>{t('noCurrentMembership')}</Text>
            <Text style={styles.emptyMembershipText}>{t('membershipPhase3Message')}</Text>
          </View>
        )}
      </SurfaceCard>
      <View style={styles.actions}>
        {!member.isArchived ? (
          <AppButton
            onPress={() =>
              router.push(
                (featured
                  ? `/member/${member.id}/membership?renewFrom=${featured.id}`
                  : `/member/${member.id}/membership`) as Href,
              )
            }
          >
            {featured ? t('renewMembership') : t('enrollMembership')}
          </AppButton>
        ) : null}
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
        <Text style={styles.tabText}>{`${t('plans')} (${memberships.length})`}</Text>
        <Text style={styles.tabText}>{t('payments')}</Text>
        <Text style={styles.tabText}>{t('notes')}</Text>
      </View>
      {featured && progress ? (
        <SurfaceCard style={styles.subscriptionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {featured.status === 'active' ? t('currentSubscription') : t('upcomingSubscription')}
            </Text>
            <StatusChip
              label={t(STATUS_LABELS[featured.status])}
              tone={
                featured.status === 'active'
                  ? 'active'
                  : featured.status === 'scheduled'
                    ? 'warning'
                    : 'danger'
              }
            />
          </View>
          <Text style={styles.subscriptionName}>{featured.planName}</Text>
          {featured.planDescription ? (
            <Text style={styles.subscriptionDescription}>{featured.planDescription}</Text>
          ) : null}
          <View style={styles.progressCard}>
            <View style={styles.progressLabels}>
              <Text style={[styles.progressText, styles.progressTextStart]}>
                {formatDateOnly(featured.startDate, settings)}
              </Text>
              <Text style={styles.progressEmphasis}>
                {t('dayProgress', { elapsed: progress.elapsedDays, total: progress.totalDays })}
              </Text>
              <Text style={[styles.progressText, styles.progressTextEnd]}>
                {formatDateOnly(featured.endDate, settings)}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(progress.ratio * 100)}%` }]}
              />
            </View>
          </View>
          <View style={styles.termGrid}>
            <TermMetric
              label={t('projectedTotal')}
              value={formatMoneyMinor(featured.totalMinor, settings)}
            />
            <TermMetric label={t('paymentNotRecorded')} value="—" muted />
            <TermMetric
              label={
                featured.status === 'scheduled' ? t('membershipStatusScheduled') : t('validity')
              }
              value={
                featured.status === 'scheduled'
                  ? formatDateOnly(featured.startDate, settings)
                  : t('daysRemaining', { count: progress.remainingDays })
              }
            />
          </View>
        </SurfaceCard>
      ) : null}
      <SurfaceCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('membershipHistory')}</Text>
          <Text style={styles.sectionMeta}>{memberships.length}</Text>
        </View>
        {!memberships.length ? (
          <Text style={styles.emptyText}>{t('noMembershipHistory')}</Text>
        ) : (
          memberships.map((membership) => (
            <View key={membership.id} style={styles.historyItem}>
              <View style={styles.historyTop}>
                <Text style={styles.historyName}>{membership.planName}</Text>
                <StatusChip
                  label={t(STATUS_LABELS[membership.status])}
                  tone={
                    membership.status === 'active'
                      ? 'active'
                      : membership.status === 'scheduled'
                        ? 'warning'
                        : membership.status === 'expired'
                          ? 'neutral'
                          : 'danger'
                  }
                />
              </View>
              <Text style={styles.historyMeta}>
                {t('membershipDateRange', {
                  start: formatDateOnly(membership.startDate, settings),
                  end: formatDateOnly(membership.endDate, settings),
                })}
              </Text>
              <Text style={styles.historyAmount}>
                {formatMoneyMinor(membership.totalMinor, settings)}
              </Text>
            </View>
          ))
        )}
      </SurfaceCard>
      <SurfaceCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('lifecycleTimeline')}</Text>
          <Text style={styles.sectionMeta}>{t('auditTrail')}</Text>
        </View>
        {!events.length ? (
          <Text style={styles.emptyText}>{t('noMembershipHistory')}</Text>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.activity}>
              <View style={styles.activityDot} />
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle}>
                  {t(event.eventType === 'renewed' ? 'membershipRenewed' : 'membershipEnrolled')}
                </Text>
                <Text style={styles.noteDate}>{formatDateOnly(event.effectiveDate, settings)}</Text>
                {event.reason ? <Text style={styles.historyMeta}>{event.reason}</Text> : null}
              </View>
            </View>
          ))
        )}
      </SurfaceCard>
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

function TermMetric({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View style={[styles.termMetric, muted && styles.termMetricMuted]}>
      <Text style={styles.termLabel}>{label}</Text>
      <Text style={[styles.termValue, muted && styles.termValueMuted]}>{value}</Text>
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
  membershipBanner: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
  },
  membershipBannerDanger: { backgroundColor: colors.dangerSurface },
  membershipBannerCopy: { minWidth: 0, flex: 1, gap: spacing.xs },
  emptyMembershipTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  emptyMembershipText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  subscriptionCard: { gap: spacing.sm },
  subscriptionName: { color: colors.text, fontFamily: fonts.bold, fontSize: 21 },
  subscriptionDescription: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  progressCard: {
    gap: spacing.sm,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLow,
  },
  progressLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  progressText: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 14,
  },
  progressTextStart: { textAlign: 'left' },
  progressTextEnd: { textAlign: 'right' },
  progressEmphasis: {
    minWidth: 0,
    flex: 1.4,
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  progressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: colors.surfaceHighest,
  },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  termGrid: { flexDirection: 'row', gap: spacing.sm },
  termMetric: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs,
    padding: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceContainer,
  },
  termMetricMuted: { backgroundColor: colors.canvas },
  termLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  termValue: { color: colors.text, fontFamily: fonts.semibold, fontSize: 12 },
  termValueMuted: { color: colors.textMuted },
  historyItem: {
    gap: spacing.xs,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLow,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  historyName: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  historyMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  historyAmount: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  sectionHeader: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  sectionMeta: {
    flexShrink: 0,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
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
  detailLabel: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  detailValue: {
    minWidth: 0,
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
