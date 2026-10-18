import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MembershipDirectoryItem } from '@/data/repositories/phase3-repository';
import type { InvoiceRecord } from '@/data/repositories/phase4-repository';
import type { BackupHistoryRecord } from '@/data/repositories/phase5-repository';
import { addDays } from '@/domain/dates/date-rules';
import { useAppSession } from '@/features/session/app-session-context';
import { useLocalBusinessDate } from '@/features/memberships/use-local-business-date';
import { formatDateOnly, formatMoneyMinor } from '@/i18n/formatters/regional-formatters';
import { AppButton } from '@/ui/components/core-controls';
import { ActionTile, GlassIconButton, GlassListRow } from '@/ui/components/glass-controls';
import { GlassSurface } from '@/ui/components/glass-surface';
import {
  LocalDataBadge,
  MaterialSymbol,
  OperationalShell,
} from '@/ui/components/operational-shell';
import {
  actionPressed,
  CARD_RADIUS,
  colors,
  fonts,
  glass,
  radii,
  spacing,
} from '@/ui/theme/tokens';

export default function HomeRoute() {
  const { width } = useWindowDimensions();
  const wideDashboard = width >= 960;
  const {
    state,
    getPhase2Repository,
    getPhase3Repository,
    getPhase4Repository,
    getBackupService,
    lock,
  } = useAppSession();
  const { t, i18n } = useTranslation();
  const today = useLocalBusinessDate(
    state.status === 'unlocked' ? state.deviceLocale.timeZone : 'UTC',
  );
  const [counts, setCounts] = useState({
    active: 0,
    upcoming: 0,
    expired: 0,
    noMembership: 0,
    archived: 0,
    expiringSoon: 0,
  });
  const [planCount, setPlanCount] = useState<number | null>(null);
  const [finance, setFinance] = useState({
    invoicedMinor: 0,
    recordedPaidMinor: 0,
    outstandingMinor: 0,
    overdueMinor: 0,
    todayRecordedMinor: 0,
  });
  const [members, setMembers] = useState<readonly MembershipDirectoryItem[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<readonly InvoiceRecord[]>([]);
  const [showSensitive, setShowSensitive] = useState(true);
  const [lastBackup, setLastBackup] = useState<BackupHistoryRecord | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const repository = getPhase2Repository();
      void Promise.all([
        getPhase3Repository().dashboardCounts(today),
        repository.listPlans(false),
        getPhase4Repository().getFinancialDashboard(today),
        getBackupService().lastSuccessfulBackup(),
        getPhase3Repository().listMembers(today, '', 'active'),
        getPhase4Repository().listOutstandingInvoices(today),
      ]).then(([membershipCounts, plans, financialCounts, backup, directory, invoices]) => {
        if (active) {
          setCounts(membershipCounts);
          setPlanCount(plans.length);
          setFinance(financialCounts);
          setLastBackup(backup);
          setMembers(directory);
          setOutstandingInvoices(invoices);
        }
      });
      return () => {
        active = false;
      };
    }, [getBackupService, getPhase2Repository, getPhase3Repository, getPhase4Repository, today]),
  );

  if (state.status !== 'unlocked') return null;
  const gym = state.snapshot.gym;
  const regionalSettings = {
    language: state.snapshot.settings?.language ?? 'en',
    currencyCode: state.snapshot.settings?.currencyCode ?? 'INR',
    dateFormat: state.snapshot.settings?.dateFormat ?? ('day-month-year' as const),
  };
  const overdueInvoices = outstandingInvoices.filter((invoice) => invoice.dueStatus === 'overdue');
  const expiryEnd = addDays(today, 10);
  const expiringMembers = members
    .filter(
      (member) =>
        member.current && member.current.endDate >= today && member.current.endDate <= expiryEnd,
    )
    .sort((left, right) =>
      (left.current?.endDate ?? '').localeCompare(right.current?.endDate ?? ''),
    );
  const shownInvoices = overdueInvoices.slice(0, 3);
  const shownInvoiceMembers = new Set(shownInvoices.map((invoice) => invoice.memberId));
  const shownMembers = expiringMembers
    .filter((member) => !shownInvoiceMembers.has(member.id))
    .slice(0, Math.max(0, 3 - shownInvoices.length));
  const urgentCount = overdueInvoices.length + counts.expiringSoon;

  const welcome = (
    <GlassSurface radius={CARD_RADIUS} style={styles.welcomeCard}>
      <View style={styles.welcomeTop}>
        <View style={styles.welcomeCopy}>
          <Text numberOfLines={2} style={styles.welcome}>
            {t('welcomeOwner', { name: state.ownerName })}
          </Text>
          <Text numberOfLines={1} style={styles.gym}>
            {gym?.name}
          </Text>
        </View>
        <View style={styles.welcomeActions}>
          <GlassIconButton
            accessibilityLabel={showSensitive ? t('hideAmounts') : t('showAmounts')}
            icon={showSensitive ? 'visibility' : 'visibility_off'}
            onPress={() => setShowSensitive((visible) => !visible)}
          />
          <GlassIconButton
            accessibilityLabel={t('lockNow')}
            icon="lock"
            onPress={() => void lock('manual')}
          />
        </View>
      </View>
      <View style={styles.localRow}>
        <LocalDataBadge />
        <Text numberOfLines={1} style={styles.device}>
          {state.deviceLocale.timeZone}
        </Text>
      </View>
    </GlassSurface>
  );

  const actions = (
    <View style={styles.actionDeck}>
      <ActionTile
        icon="person_add"
        label={t('addMember')}
        onPress={() => router.push('/member/new' as Href)}
        primary
      />
      <ActionTile
        icon="autorenew"
        label={t('renewMembership')}
        onPress={() => router.push('/members' as Href)}
      />
      <ActionTile
        icon="payments"
        label={t('recordPay')}
        onPress={() => router.push('/payments' as Href)}
      />
    </View>
  );

  const firstPlan =
    planCount === 0 ? (
      <GlassSurface radius={CARD_RADIUS} style={styles.firstPlanCard} tint={glass.fillMint}>
        <View style={styles.firstPlanCopy}>
          <Text style={styles.firstPlanTitle}>{t('noPlansTitle')}</Text>
          <Text style={styles.firstPlanText}>{t('createFirstPlanPrompt')}</Text>
        </View>
        <AppButton onPress={() => router.push('/plan/new' as Href)}>
          {t('createFirstPlan')}
        </AppButton>
      </GlassSurface>
    ) : null;

  const urgentTasks =
    urgentCount > 0 ? (
      <View style={styles.urgentSection}>
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeadingMain}>
            <Text numberOfLines={2} style={styles.sectionTitle}>
              {t('urgentFrontDeskTasks')}
            </Text>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>
                {t('pendingCount', { count: urgentCount })}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/payments' as Href)}
            style={({ pressed }) => [styles.linkButton, pressed && actionPressed]}
          >
            <Text style={styles.linkButtonText}>{t('viewLedger')}</Text>
          </Pressable>
        </View>
        {shownInvoices.map((invoice) => (
          <GlassListRow
            action={{
              icon: 'receipt_long',
              label: t('recordPayment'),
              accessibilityLabel: `${t('recordPayment')}: ${invoice.memberName}`,
              onPress: () => router.push(`/invoice/${invoice.id}` as Href),
            }}
            amount={
              showSensitive ? formatMoneyMinor(invoice.balanceMinor, regionalSettings) : '••••'
            }
            avatarText={initialsFor(invoice.memberName)}
            key={`invoice-${invoice.id}`}
            meta={`${invoice.planName}${
              invoice.dueDate
                ? ` • ${t('dueDateValue', {
                    date: formatDateOnly(invoice.dueDate, regionalSettings),
                  })}`
                : ''
            }`}
            status={t('overdue')}
            title={invoice.memberName}
            tone="danger"
          />
        ))}
        {shownMembers.map((member) => {
          const membership = member.current;
          if (!membership) return null;
          return (
            <GlassListRow
              action={{
                icon: 'autorenew',
                label: t('renewMembership'),
                accessibilityLabel: `${t('renewMembership')}: ${member.name}`,
                onPress: () => router.push(`/member/${member.id}/membership` as Href),
              }}
              amount={
                showSensitive ? formatMoneyMinor(membership.totalMinor, regionalSettings) : '••••'
              }
              avatarText={initialsFor(member.name)}
              key={`membership-${member.id}`}
              meta={`${membership.planName} • ${t('expiresOn', {
                date: formatDateOnly(membership.endDate, regionalSettings),
              })}`}
              status={t('expiringSoon')}
              title={member.name}
              tone="warning"
            />
          );
        })}
        {counts.expiringSoon > shownMembers.length ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/members?filter=expiring' as Href)}
            style={({ pressed }) => [styles.reviewRow, pressed && actionPressed]}
          >
            <MaterialSymbol color={colors.textMuted} name="date_range" size={22} />
            <View style={styles.reviewCopy}>
              <Text style={styles.reviewTitle}>{t('expiringSoon')}</Text>
              <Text numberOfLines={1} style={styles.reviewDetail}>
                {t('expiringSoonCount', { count: counts.expiringSoon })}
              </Text>
            </View>
            <View style={styles.reviewButton}>
              <Text style={styles.reviewButtonText}>{t('review')}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    ) : null;

  const metrics = (
    <View style={styles.metricGrid}>
      <MetricCard
        detail={t('expiringSoonCount', { count: counts.expiringSoon })}
        label={t('activeMembers')}
        onPress={() => router.push('/members?filter=active' as Href)}
        tone="active"
        value={String(counts.active)}
      />
      <MetricCard
        detail={t('nextTenDays')}
        label={t('expiringSoon')}
        onPress={() => router.push('/members?filter=expiring' as Href)}
        tone="warning"
        value={String(counts.expiringSoon)}
      />
      <MetricCard
        detail={t('historyPreserved')}
        label={t('expiredMembers')}
        onPress={() => router.push('/members?filter=expired' as Href)}
        tone="danger"
        value={String(counts.expired)}
      />
      <MetricCard
        detail={t('overdueAmountValue', {
          amount: showSensitive ? formatMoneyMinor(finance.overdueMinor, regionalSettings) : '••••',
        })}
        label={t('outstandingDues')}
        onPress={() => router.push('/payments?filter=outstanding' as Href)}
        tone="danger"
        value={
          showSensitive ? formatMoneyMinor(finance.outstandingMinor, regionalSettings) : '••••'
        }
      />
    </View>
  );

  const collections = (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/payments?filter=today' as Href)}
      style={({ pressed }) => pressed && actionPressed}
    >
      <GlassSurface radius={CARD_RADIUS} style={styles.collectionCard}>
        <View style={styles.collectionHeading}>
          <MaterialSymbol color={colors.primaryDark} name="point_of_sale" size={20} />
          <Text style={styles.collectionTitle}>{t('todayRecordedCollections')}</Text>
        </View>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={styles.collectionValue}
        >
          {showSensitive ? formatMoneyMinor(finance.todayRecordedMinor, regionalSettings) : '••••'}
        </Text>
        <Text style={styles.collectionDetail}>{t('recordedPaymentsOnly')}</Text>
      </GlassSurface>
    </Pressable>
  );

  const backup = (
    <GlassSurface
      radius={CARD_RADIUS}
      style={styles.backupBanner}
      tint={lastBackup ? glass.tintSuccess : glass.tintWarning}
    >
      <View style={[styles.backupIcon, !lastBackup && styles.backupIconWarning]}>
        <MaterialSymbol
          color={lastBackup ? colors.successText : colors.warningSurface}
          name={lastBackup ? 'cloud_done' : 'warning'}
          size={19}
        />
      </View>
      <View style={styles.backupCopy}>
        <Text
          numberOfLines={1}
          style={[styles.backupTitle, !lastBackup && styles.backupTitleWarning]}
        >
          {lastBackup ? t('homeBackupProtectedShort') : t('homeBackupNeededShort')}
        </Text>
        <Text numberOfLines={1} style={styles.backupDetail}>
          {lastBackup?.completedAtUtc
            ? t('homeLastBackup', {
                date: new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(lastBackup.completedAtUtc)),
              })
            : t('homeNoVerifiedBackup')}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/backup-restore' as Href)}
        style={({ pressed }) => [styles.backupAction, pressed && actionPressed]}
      >
        <MaterialSymbol color={colors.onPrimary} name="cloud_upload" size={18} />
        <Text numberOfLines={1} style={styles.backupActionText}>
          {t('homeBackupNow')}
        </Text>
      </Pressable>
    </GlassSurface>
  );

  return (
    <OperationalShell
      active="home"
      contentStyle={styles.dashboardContent}
      subtitle={gym?.name ?? t('appName')}
      title={t('dashboard')}
    >
      {wideDashboard ? (
        <View style={styles.tabletColumns}>
          <View style={styles.tabletPrimaryColumn}>
            {welcome}
            {actions}
            {firstPlan}
            {backup}
            {urgentTasks}
          </View>
          <View style={styles.tabletSecondaryColumn}>
            {collections}
            {metrics}
          </View>
        </View>
      ) : (
        <View style={styles.phoneDashboard}>
          {welcome}
          {actions}
          {firstPlan}
          {urgentTasks}
          {metrics}
          {collections}
          {backup}
        </View>
      )}
    </OperationalShell>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'active' | 'danger' | 'warning';
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.metricPressable, pressed && actionPressed]}
    >
      <GlassSurface radius={CARD_RADIUS} style={styles.metricCard}>
        <View style={styles.metricLabelRow}>
          <Text numberOfLines={2} style={styles.metricLabel}>
            {label}
          </Text>
          <View
            style={[
              styles.metricDot,
              tone === 'active' && styles.metricDotActive,
              tone === 'warning' && styles.metricDotWarning,
              tone === 'danger' && styles.metricDotDanger,
            ]}
          />
        </View>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.68}
          numberOfLines={1}
          style={[styles.metricValue, tone === 'danger' && styles.metricValueDanger]}
        >
          {value}
        </Text>
        <Text numberOfLines={2} style={styles.metricDetail}>
          {detail}
        </Text>
      </GlassSurface>
    </Pressable>
  );
}

function initialsFor(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  dashboardContent: { paddingTop: 0 },
  phoneDashboard: { width: '100%', gap: 12 },
  tabletColumns: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  tabletPrimaryColumn: { minWidth: 0, flex: 3, gap: spacing.md },
  tabletSecondaryColumn: { minWidth: 300, flex: 2, gap: spacing.md },
  welcomeCard: { gap: spacing.sm, padding: spacing.md },
  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  welcomeCopy: { minWidth: 0, flex: 1 },
  welcome: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  gym: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  welcomeActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  localRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: glass.divider,
  },
  device: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'right',
  },
  actionDeck: { width: '100%', flexDirection: 'row', gap: spacing.sm },
  firstPlanCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderColor: glass.rimPrimary,
  },
  firstPlanCopy: { minWidth: 180, flex: 1, gap: spacing.xs },
  firstPlanTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  firstPlanText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  urgentSection: { width: '100%', gap: spacing.sm },
  sectionHeadingRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionHeadingMain: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  pendingBadge: {
    flexShrink: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: glass.rimSoft,
    backgroundColor: glass.fillDangerStrong,
  },
  pendingBadgeText: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 14,
  },
  linkButton: {
    minHeight: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    backgroundColor: glass.fillAccent,
  },
  linkButtonText: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 12 },
  reviewRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 12,
    overflow: 'hidden',
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: glass.rim,
    backgroundColor: glass.fillMint,
  },
  reviewCopy: { minWidth: 0, flex: 1 },
  reviewTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  reviewDetail: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  reviewButton: {
    minHeight: 48,
    flexShrink: 0,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    backgroundColor: glass.fillOpaque,
  },
  reviewButtonText: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 12 },
  metricGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  metricPressable: { minWidth: 136, flexBasis: '48%', flexGrow: 1, flexShrink: 1 },
  metricCard: { width: '100%', minWidth: 136, minHeight: 102, gap: spacing.xs, padding: 14 },
  metricLabelRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metricLabel: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  metricDot: {
    width: 12,
    height: 12,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: glass.rim,
  },
  metricDotActive: { backgroundColor: colors.primary },
  metricDotWarning: { backgroundColor: colors.warningAccent },
  metricDotDanger: { backgroundColor: colors.danger },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  metricValueDanger: { color: colors.danger },
  metricDetail: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  collectionCard: { gap: spacing.xs, padding: spacing.md },
  collectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  collectionTitle: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  collectionValue: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 38,
    fontVariant: ['tabular-nums'],
  },
  collectionDetail: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  backupBanner: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 12,
  },
  backupIcon: {
    width: 34,
    height: 34,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: glass.rim,
    backgroundColor: glass.fill,
  },
  backupIconWarning: { borderColor: glass.rimSoft, backgroundColor: glass.fillWarningStrong },
  backupCopy: { minWidth: 0, flex: 1 },
  backupTitle: { color: colors.successText, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
  backupTitleWarning: { color: colors.warningStrongText },
  backupDetail: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  backupAction: {
    minHeight: 48,
    maxWidth: 128,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  backupActionText: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.onPrimary,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
});
