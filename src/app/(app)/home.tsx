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
import {
  LocalDataBadge,
  MaterialSymbol,
  OperationalShell,
  SurfaceCard,
} from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

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
  const expiryEnd = addDays(today, 30);
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
    <SurfaceCard style={[styles.dashboardCard, styles.welcomeCard]}>
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
          <Pressable
            accessibilityLabel={showSensitive ? t('hideAmounts') : t('showAmounts')}
            accessibilityRole="button"
            onPress={() => setShowSensitive((visible) => !visible)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.actionPressed]}
          >
            <MaterialSymbol
              color={colors.textMuted}
              name={showSensitive ? 'visibility' : 'visibility_off'}
              size={22}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={t('lockNow')}
            accessibilityRole="button"
            onPress={() => void lock('manual')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.actionPressed]}
          >
            <MaterialSymbol color={colors.textMuted} name="lock" size={22} />
          </Pressable>
        </View>
      </View>
      <View style={styles.localRow}>
        <LocalDataBadge />
        <Text numberOfLines={1} style={styles.device}>
          {state.deviceLocale.timeZone}
        </Text>
      </View>
    </SurfaceCard>
  );

  const actions = (
    <View style={styles.actionDeck}>
      <CounterAction
        icon="person_add"
        label={t('addMember')}
        onPress={() => router.push('/member/new' as Href)}
        primary
      />
      <CounterAction
        icon="autorenew"
        label={t('renewMembership')}
        onPress={() => router.push('/members' as Href)}
      />
      <CounterAction
        icon="payments"
        label={t('recordPay')}
        onPress={() => router.push('/payments' as Href)}
      />
    </View>
  );

  const firstPlan =
    planCount === 0 ? (
      <SurfaceCard style={[styles.dashboardCard, styles.firstPlanCard]}>
        <View style={styles.firstPlanCopy}>
          <Text style={styles.firstPlanTitle}>{t('noPlansTitle')}</Text>
          <Text style={styles.firstPlanText}>{t('createFirstPlanPrompt')}</Text>
        </View>
        <AppButton onPress={() => router.push('/plan/new' as Href)}>
          {t('createFirstPlan')}
        </AppButton>
      </SurfaceCard>
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
            style={({ pressed }) => [styles.linkButton, pressed && styles.actionPressed]}
          >
            <Text style={styles.linkButtonText}>{t('viewLedger')}</Text>
          </Pressable>
        </View>
        {shownInvoices.map((invoice) => (
          <UrgentTaskCard
            actionIcon="receipt_long"
            actionLabel={t('recordPayment')}
            amount={
              showSensitive ? formatMoneyMinor(invoice.balanceMinor, regionalSettings) : '••••'
            }
            key={`invoice-${invoice.id}`}
            meta={`${invoice.planName}${
              invoice.dueDate
                ? ` • ${t('dueDateValue', {
                    date: formatDateOnly(invoice.dueDate, regionalSettings),
                  })}`
                : ''
            }`}
            name={invoice.memberName}
            onPress={() => router.push(`/invoice/${invoice.id}` as Href)}
            status={t('overdue')}
            tone="danger"
          />
        ))}
        {shownMembers.map((member) => {
          const membership = member.current;
          if (!membership) return null;
          return (
            <UrgentTaskCard
              actionIcon="autorenew"
              actionLabel={t('renewMembership')}
              amount={
                showSensitive ? formatMoneyMinor(membership.totalMinor, regionalSettings) : '••••'
              }
              key={`membership-${member.id}`}
              meta={`${membership.planName} • ${t('expiresOn', {
                date: formatDateOnly(membership.endDate, regionalSettings),
              })}`}
              name={member.name}
              onPress={() => router.push(`/member/${member.id}/membership` as Href)}
              status={t('expiringSoon')}
              tone="warning"
            />
          );
        })}
        {counts.expiringSoon > shownMembers.length ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/members?filter=expiring' as Href)}
            style={({ pressed }) => [styles.reviewRow, pressed && styles.actionPressed]}
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
        detail={t('nextThirtyDays')}
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
      style={({ pressed }) => pressed && styles.actionPressed}
    >
      <SurfaceCard style={[styles.dashboardCard, styles.collectionCard]}>
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
      </SurfaceCard>
    </Pressable>
  );

  const backup = (
    <SurfaceCard
      style={[styles.dashboardCard, styles.backupBanner, !lastBackup && styles.backupBannerWarning]}
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
        style={({ pressed }) => [styles.backupAction, pressed && styles.actionPressed]}
      >
        <MaterialSymbol color="#fff" name="cloud_upload" size={18} />
        <Text numberOfLines={1} style={styles.backupActionText}>
          {t('homeBackupNow')}
        </Text>
      </Pressable>
    </SurfaceCard>
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

function CounterAction({
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
        styles.counterAction,
        primary && styles.counterActionPrimary,
        pressed && styles.actionPressed,
      ]}
    >
      <MaterialSymbol color={primary ? '#fff' : colors.primaryDark} name={icon} size={20} />
      <Text
        numberOfLines={1}
        style={[styles.counterActionText, primary && styles.counterActionTextPrimary]}
      >
        {primary ? '+ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

function UrgentTaskCard({
  name,
  meta,
  status,
  amount,
  tone,
  actionIcon,
  actionLabel,
  onPress,
}: {
  name: string;
  meta: string;
  status: string;
  amount: string;
  tone: 'warning' | 'danger';
  actionIcon: string;
  actionLabel: string;
  onPress(): void;
}) {
  return (
    <SurfaceCard style={[styles.dashboardCard, styles.taskCard]}>
      <View style={styles.taskTop}>
        <View style={styles.taskIdentity}>
          <View style={[styles.taskAvatar, tone === 'danger' && styles.taskAvatarDanger]}>
            <Text style={[styles.taskAvatarText, tone === 'danger' && styles.taskAvatarTextDanger]}>
              {initialsFor(name)}
            </Text>
          </View>
          <View style={styles.taskCopy}>
            <View style={styles.taskNameRow}>
              <Text numberOfLines={1} style={styles.taskName}>
                {name}
              </Text>
              <View style={[styles.taskStatus, tone === 'danger' && styles.taskStatusDanger]}>
                <Text
                  numberOfLines={1}
                  style={[styles.taskStatusText, tone === 'danger' && styles.taskStatusTextDanger]}
                >
                  {status}
                </Text>
              </View>
            </View>
            <Text numberOfLines={1} style={styles.taskMeta}>
              {meta}
            </Text>
          </View>
        </View>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={[styles.taskAmount, tone === 'danger' && styles.taskAmountDanger]}
        >
          {amount}
        </Text>
      </View>
      <View style={styles.taskActionRow}>
        <Pressable
          accessibilityLabel={`${actionLabel}: ${name}`}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.taskAction, pressed && styles.actionPressed]}
        >
          <MaterialSymbol color="#fff" name={actionIcon} size={18} />
          <Text numberOfLines={1} style={styles.taskActionText}>
            {actionLabel}
          </Text>
        </Pressable>
      </View>
    </SurfaceCard>
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
      style={({ pressed }) => [styles.metricPressable, pressed && styles.actionPressed]}
    >
      <SurfaceCard style={[styles.dashboardCard, styles.metricCard]}>
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
      </SurfaceCard>
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
  dashboardCard: {
    borderWidth: 0,
    elevation: 1,
    shadowColor: colors.brandHeader,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  welcomeCard: { gap: 6, padding: 12 },
  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  welcomeCopy: { minWidth: 0, flex: 1 },
  welcome: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  gym: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  welcomeActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  localRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  actionDeck: { width: '100%', flexDirection: 'row', gap: spacing.xs },
  counterAction: {
    minWidth: 0,
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: '#bec9c5',
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  counterActionPrimary: { borderColor: colors.primary, backgroundColor: colors.primary },
  counterActionText: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  counterActionTextPrimary: { color: '#fff' },
  actionPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  firstPlanCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceLow,
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
    backgroundColor: colors.danger,
  },
  pendingBadgeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 10, lineHeight: 14 },
  linkButton: { minHeight: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  linkButtonText: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 12 },
  taskCard: { gap: spacing.sm, padding: 12 },
  taskTop: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  taskIdentity: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  taskAvatar: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.surfaceHighest,
  },
  taskAvatarDanger: { backgroundColor: colors.dangerSurface },
  taskAvatarText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 14 },
  taskAvatarTextDanger: { color: colors.dangerText },
  taskCopy: { minWidth: 0, flex: 1 },
  taskNameRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  taskName: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  taskStatus: {
    maxWidth: 90,
    flexShrink: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.warningSurface,
  },
  taskStatusDanger: { backgroundColor: colors.dangerSurface },
  taskStatusText: {
    color: colors.warningText,
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 12,
  },
  taskStatusTextDanger: { color: colors.dangerText },
  taskMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  taskAmount: {
    maxWidth: 92,
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  taskAmountDanger: { color: colors.danger },
  taskActionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  taskAction: {
    minWidth: 126,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  taskActionText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 12 },
  reviewRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
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
    backgroundColor: colors.surface,
  },
  reviewButtonText: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 12 },
  metricGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricPressable: { minWidth: 136, flex: 1 },
  metricCard: { minWidth: 136, minHeight: 102, flex: 1, gap: spacing.xs, padding: 12 },
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
  metricDot: { width: 10, height: 10, marginTop: 2, borderRadius: 5 },
  metricDotActive: { backgroundColor: colors.primary },
  metricDotWarning: { backgroundColor: '#615a43' },
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
  collectionCard: { gap: spacing.xs, padding: 12 },
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
    backgroundColor: colors.successSurface,
  },
  backupBannerWarning: { backgroundColor: '#ede2c5' },
  backupIcon: {
    width: 34,
    height: 34,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.surface,
  },
  backupIconWarning: { backgroundColor: '#615a43' },
  backupCopy: { minWidth: 0, flex: 1 },
  backupTitle: { color: colors.successText, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
  backupTitleWarning: { color: '#201b09' },
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
    backgroundColor: '#201b09',
  },
  backupActionText: {
    minWidth: 0,
    flexShrink: 1,
    color: '#fff',
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
});
