import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  FinanceReport,
  MemberReportCategory,
  MemberReportRow,
  ReportFilters,
} from '@/data/repositories/phase6-repository';
import type { PlanRecord } from '@/data/repositories/phase2-repository';
import type { PaymentMethodOption } from '@/data/repositories/phase4-repository';
import { addDays, parseDateOnly, type DateOnly } from '@/domain/dates/date-rules';
import type { MemberMembershipStatus } from '@/domain/memberships/membership';
import { useLocalBusinessDate } from '@/features/memberships/use-local-business-date';
import { useAppSession } from '@/features/session/app-session-context';
import { formatDateOnly, formatMoneyMinor } from '@/i18n/formatters/regional-formatters';
import { logLocalDiagnostic } from '@/platform/diagnostics/local-diagnostic-logger';
import {
  createReportPdf,
  deleteTemporaryReport,
  shareReportPdf,
} from '@/platform/export/report-pdf';
import { pdfShareFailureCode } from '@/platform/printing/share-pdf';
import { AppButton, AppField, LoadingState, Notice } from '@/ui/components/core-controls';
import {
  DateRangeFilter,
  FilterBar,
  FilterChip,
  FilterSelect,
  type DateRangePreset,
} from '@/ui/components/filter-controls';
import { OperationalShell, StatusChip, SurfaceCard } from '@/ui/components/operational-shell';
import { actionPressed, colors, fonts, glass, radii, spacing } from '@/ui/theme/tokens';

const CATEGORIES: readonly MemberReportCategory[] = [
  'all',
  'active',
  'upcoming',
  'expired',
  'no-membership',
  'archived',
  'expiring',
  'new-joins',
];
const DEFAULT_CATEGORY: MemberReportCategory = 'active';
const FINANCE_STATUSES = ['active', 'upcoming', 'expired', 'no-membership'] as const;
const CATEGORY_KEYS = {
  all: 'reportAll',
  active: 'reportActive',
  upcoming: 'reportUpcoming',
  expired: 'reportExpired',
  'no-membership': 'reportNoMembership',
  archived: 'reportArchived',
  expiring: 'reportExpiring',
  'new-joins': 'reportNewJoins',
} as const;

export default function ReportsRoute() {
  const { t, i18n } = useTranslation();
  const {
    state,
    getPhase2Repository,
    getPhase4Repository,
    getPhase6Repository,
    reauthenticateOwner,
  } = useAppSession();
  const today = useLocalBusinessDate(
    state.status === 'unlocked' ? state.deviceLocale.timeZone : 'UTC',
  );
  const [tab, setTab] = useState<'members' | 'finance'>('members');
  const [category, setCategory] = useState<MemberReportCategory>(DEFAULT_CATEGORY);
  const [fromDate, setFromDate] = useState<DateOnly>(addDays(today, -29));
  const [toDate, setToDate] = useState<DateOnly>(today);
  const [planId, setPlanId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodOption['code'] | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<MemberMembershipStatus | null>(null);
  const [plans, setPlans] = useState<readonly PlanRecord[]>([]);
  const [methods, setMethods] = useState<readonly PaymentMethodOption[]>([]);
  const [members, setMembers] = useState<readonly MemberReportRow[]>([]);
  const [finance, setFinance] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ text: string; danger: boolean } | null>(
    null,
  );

  const filters = useMemo<ReportFilters>(
    () => ({
      fromDate,
      toDate,
      planId,
      membershipStatus: tab === 'finance' ? membershipStatus : null,
      paymentMethod,
    }),
    [fromDate, membershipStatus, paymentMethod, planId, tab, toDate],
  );

  const datesValid = useMemo(() => {
    try {
      parseDateOnly(fromDate);
      parseDateOnly(toDate);
      return fromDate <= toDate;
    } catch {
      return false;
    }
  }, [fromDate, toDate]);

  const datePresets = useMemo<readonly DateRangePreset[]>(
    () => [
      { key: 'last7', label: t('last7Days'), from: addDays(today, -6), to: today },
      { key: 'last30', label: t('last30Days'), from: addDays(today, -29), to: today },
      { key: 'thisMonth', label: t('thisMonth'), from: `${today.slice(0, 8)}01`, to: today },
      { key: 'last90', label: t('last90Days'), from: addDays(today, -89), to: today },
    ],
    [t, today],
  );
  const filtersChanged =
    category !== DEFAULT_CATEGORY ||
    planId !== null ||
    paymentMethod !== null ||
    membershipStatus !== null ||
    fromDate !== addDays(today, -29) ||
    toDate !== today;
  const resetFilters = () => {
    setCategory(DEFAULT_CATEGORY);
    setPlanId(null);
    setPaymentMethod(null);
    setMembershipStatus(null);
    setFromDate(addDays(today, -29));
    setToDate(today);
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setMessage('');
      if (!datesValid) {
        setLoading(false);
        setMessage(t('invalidDateRange'));
        return () => {
          active = false;
        };
      }
      void Promise.all([
        getPhase2Repository().listPlans(),
        getPhase4Repository().getBillingSettings(),
        getPhase6Repository().memberReport(today, category, filters),
        getPhase6Repository().financeReport(today, filters),
      ])
        .then(([nextPlans, billing, memberRows, financeReport]) => {
          if (!active) return;
          setPlans(nextPlans);
          setMethods(billing.paymentMethods);
          setMembers(memberRows);
          setFinance(financeReport);
        })
        .catch(() => active && setMessage(t('reportLoadFailed')))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [
      category,
      datesValid,
      filters,
      getPhase2Repository,
      getPhase4Repository,
      getPhase6Repository,
      t,
      today,
    ]),
  );

  if (state.status !== 'unlocked') return null;
  const regional = {
    language: state.snapshot.settings?.language ?? 'en',
    currencyCode: state.snapshot.settings?.currencyCode ?? 'INR',
    dateFormat: state.snapshot.settings?.dateFormat ?? ('day-month-year' as const),
  };
  const rangeLabel = datesValid
    ? `${formatDateOnly(fromDate, regional)} – ${formatDateOnly(toDate, regional)}`
    : `${fromDate} – ${toDate}`;

  const exportPdf = async () => {
    if (!finance || exporting) return;
    if (!(await reauthenticateOwner(ownerPin))) {
      setExportMessage({ text: t('ownerPinIncorrect'), danger: true });
      return;
    }
    setExporting(true);
    setExportMessage(null);
    let file: Awaited<ReturnType<typeof createReportPdf>> | null = null;
    try {
      const rows =
        tab === 'members'
          ? members.map((member) => [
              member.memberCode,
              member.name,
              member.current?.planName ?? member.latest?.planName ?? '—',
              t(CATEGORY_KEYS[member.status === 'no-membership' ? 'no-membership' : member.status]),
              formatDateOnly(member.reportDate, regional),
            ])
          : finance.invoices.map((invoice) => [
              invoice.invoiceNumber,
              invoice.memberName,
              invoice.planName,
              formatMoneyMinor(invoice.totalMinor, regional),
              formatMoneyMinor(invoice.balanceMinor, regional),
            ]);
      file = await createReportPdf({
        title: tab === 'members' ? t('memberReports') : t('financeReports'),
        gymName: state.snapshot.gym?.name ?? t('appName'),
        generatedLabel: t('generatedAt'),
        generatedValue: new Intl.DateTimeFormat(i18n.language, {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: state.deviceLocale.timeZone,
        }).format(new Date()),
        timeZoneLabel: t('deviceTimeZone'),
        timeZone: state.deviceLocale.timeZone,
        filtersLabel: t('filters'),
        filters: `${fromDate} — ${toDate}`,
        columns:
          tab === 'members'
            ? [
                t('memberCode'),
                t('reportMember'),
                t('reportPlan'),
                t('reportStatus'),
                t('reportDate'),
              ]
            : [
                t('invoiceNumber'),
                t('reportMember'),
                t('reportPlan'),
                t('invoicedAmount'),
                t('outstandingDues'),
              ],
        rows,
      });
    } catch {
      logLocalDiagnostic('error', 'REPORT.PDF_CREATE_FAILED');
      setExportMessage({ text: t('exportFailed'), danger: true });
      setExporting(false);
      return;
    }
    try {
      const shared = await shareReportPdf(file, t('exportSummaryPdf'));
      setExportMessage({
        text:
          shared === 'shared'
            ? t('exportReady')
            : shared === 'opened'
              ? t('exportOpenedForSharing')
              : shared === 'saved'
                ? t('exportSavedForSharing')
                : t('exportUnavailable'),
        danger: shared === 'unavailable',
      });
      setOwnerPin('');
    } catch (error) {
      logLocalDiagnostic('error', 'REPORT.PDF_SHARE_FAILED');
      setExportMessage({
        text: t('exportShareFailedWithCode', { code: pdfShareFailureCode(error) }),
        danger: true,
      });
    } finally {
      if (file) deleteTemporaryReport(file);
      setExporting(false);
    }
  };

  return (
    <OperationalShell
      active="more"
      backHref="/more"
      canGoBack
      subtitle={t('reportsSubtitle')}
      title={t('reports')}
    >
      <View style={[styles.tabs, styles.glassTabs]}>
        <Tab
          label={t('memberReports')}
          selected={tab === 'members'}
          onPress={() => setTab('members')}
        />
        <Tab
          label={t('financeReports')}
          selected={tab === 'finance'}
          onPress={() => setTab('finance')}
        />
      </View>
      <FilterBar>
        <DateRangeFilter
          defaultPresetKey="last30"
          from={fromDate}
          fromLabel={t('fromDate')}
          onChange={(from, to) => {
            setFromDate(from as DateOnly);
            setToDate(to as DateOnly);
          }}
          presets={datePresets}
          rangeLabel={rangeLabel}
          title={t('dateRange')}
          to={toDate}
          toLabel={t('toDate')}
        />
        {tab === 'members' ? (
          <FilterSelect
            defaultValue={DEFAULT_CATEGORY}
            onChange={setCategory}
            options={CATEGORIES.map((value) => ({ value, label: t(CATEGORY_KEYS[value]) }))}
            title={t('reportStatus')}
            value={category}
          />
        ) : null}
        <FilterSelect
          defaultValue={null}
          onChange={setPlanId}
          options={[
            { value: null, label: t('allPlans') },
            ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
          ]}
          title={t('reportPlan')}
          value={planId}
        />
        {tab === 'finance' ? (
          <>
            <FilterSelect
              defaultValue={null}
              onChange={setPaymentMethod}
              options={[
                { value: null, label: t('allPaymentMethods') },
                ...methods.map((method) => ({ value: method.code, label: method.label })),
              ]}
              title={t('paymentMethod')}
              value={paymentMethod}
            />
            <FilterSelect
              defaultValue={null}
              onChange={setMembershipStatus}
              options={[
                { value: null, label: t('allStatuses') },
                ...FINANCE_STATUSES.map((value) => ({ value, label: t(CATEGORY_KEYS[value]) })),
              ]}
              title={t('reportStatus')}
              value={membershipStatus}
            />
          </>
        ) : null}
        {filtersChanged ? (
          <FilterChip
            icon={{ name: 'restart_alt' }}
            kind="action"
            label={t('resetFilters')}
            onPress={resetFilters}
            selected={false}
          />
        ) : null}
      </FilterBar>
      <View style={styles.results}>
        {loading ? <LoadingState label={t('loading')} /> : null}
        {message ? (
          <Notice danger={message === t('reportLoadFailed') || message === t('invalidDateRange')}>
            {message}
          </Notice>
        ) : null}
        {!loading && tab === 'members' ? <MemberResults rows={members} /> : null}
        {!loading && tab === 'finance' && finance ? (
          <FinanceResults report={finance} regional={regional} />
        ) : null}
        <SurfaceCard style={styles.exportCard}>
          <Notice>{t('exportPrivacyWarning')}</Notice>
          <AppField
            label={t('exportOwnerPin')}
            value={ownerPin}
            onChangeText={setOwnerPin}
            keyboardType="number-pad"
            secureTextEntry
          />
          {exportMessage ? (
            <Notice danger={exportMessage.danger}>{exportMessage.text}</Notice>
          ) : null}
          <View style={styles.exportActions}>
            <View style={styles.flex}>
              <AppButton disabled={exporting || !ownerPin} onPress={() => void exportPdf()}>
                {exporting ? t('loading') : t('exportSummaryPdf')}
              </AppButton>
            </View>
            <View style={styles.flex}>
              <AppButton variant="secondary" onPress={() => router.push('/data-export' as Href)}>
                {t('dataExport')}
              </AppButton>
            </View>
          </View>
        </SurfaceCard>
      </View>
    </OperationalShell>
  );
}

function Tab({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        styles.glassTab,
        selected && styles.glassTabSelected,
        pressed && actionPressed,
      ]}
    >
      <Text
        style={[
          styles.tabText,
          styles.glassTabText,
          selected && styles.tabTextSelected,
          selected && styles.glassTabTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function rowStyle({ pressed }: { pressed: boolean }) {
  return [styles.row, styles.glassRow, pressed && actionPressed];
}

function MemberResults({ rows }: { rows: readonly MemberReportRow[] }) {
  const { t } = useTranslation();
  return (
    <SurfaceCard style={styles.list}>
      <Text style={[styles.title, styles.glassListTitle]}>
        {t('reportResults')} · {rows.length}
      </Text>
      {!rows.length ? (
        <Notice>{t('noReportRecords')}</Notice>
      ) : (
        rows.slice(0, 200).map((row) => (
          <Pressable
            key={row.id}
            onPress={() => router.push(`/member/${row.id}` as Href)}
            style={rowStyle}
          >
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{row.name}</Text>
              <Text style={styles.rowMeta}>
                {row.memberCode} ·{' '}
                {row.current?.planName ?? row.latest?.planName ?? t('reportNoMembership')}
              </Text>
            </View>
            <StatusChip
              label={t(
                CATEGORY_KEYS[row.status === 'no-membership' ? 'no-membership' : row.status],
              )}
              tone={
                row.status === 'active' ? 'active' : row.status === 'expired' ? 'danger' : 'warning'
              }
            />
          </Pressable>
        ))
      )}
    </SurfaceCard>
  );
}

function FinanceResults({
  report,
  regional,
}: {
  report: FinanceReport;
  regional: Parameters<typeof formatMoneyMinor>[1];
}) {
  const { t } = useTranslation();
  const metrics = [
    [t('recordedCollections'), report.summary.recordedCollectionsMinor],
    [t('invoicedAmount'), report.summary.invoicedMinor],
    [t('discounts'), report.summary.discountsMinor],
    [t('tax'), report.summary.taxMinor],
    [t('refundsCorrections'), report.summary.refundsMinor],
    [t('outstandingDues'), report.summary.outstandingMinor],
    [t('overdueDues'), report.summary.overdueMinor],
  ] as const;
  return (
    <>
      <View style={styles.metricGrid}>
        {metrics.map(([label, value]) => (
          <SurfaceCard style={styles.metric} key={label}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>
              {formatMoneyMinor(value, regional)}
            </Text>
          </SurfaceCard>
        ))}
      </View>
      <SurfaceCard style={styles.list}>
        <Text style={[styles.title, styles.glassListTitle]}>
          {t('invoicesCount', { count: report.summary.invoiceCount })} ·{' '}
          {t('paymentsCount', { count: report.summary.paymentCount })}
        </Text>
        {!report.invoices.length ? (
          <Notice>{t('noReportRecords')}</Notice>
        ) : (
          report.invoices.slice(0, 200).map((invoice) => (
            <Pressable
              key={invoice.id}
              onPress={() => router.push(`/invoice/${invoice.id}` as Href)}
              style={rowStyle}
            >
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{invoice.memberName}</Text>
                <Text style={styles.rowMeta}>
                  {invoice.invoiceNumber} · {invoice.planName}
                </Text>
              </View>
              <Text style={styles.amount}>{formatMoneyMinor(invoice.totalMinor, regional)}</Text>
            </Pressable>
          ))
        )}
      </SurfaceCard>
    </>
  );
}

const styles = StyleSheet.create({
  tabs: {
    minHeight: 52,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
  },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  tabText: { color: colors.textMuted, fontFamily: fonts.medium },
  tabTextSelected: { color: colors.primaryDark, fontFamily: fonts.semibold },
  results: { minWidth: 0, flex: 1, gap: spacing.md },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  flex: { minWidth: 150, flex: 1 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { minWidth: 150, flex: 1, gap: spacing.xs },
  metricLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12 },
  metricValue: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  list: { padding: 0, overflow: 'hidden' },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowCopy: { minWidth: 0, flex: 1 },
  rowTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  rowMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  amount: { color: colors.primaryDark, fontFamily: fonts.bold, fontVariant: ['tabular-nums'] },
  exportCard: { gap: spacing.md },
  exportActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  glassTabs: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: radii.pill,
    backgroundColor: glass.fillNeutral,
  },
  glassTab: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radii.pill },
  glassTabSelected: { backgroundColor: colors.primary },
  glassTabText: { color: colors.text, textAlign: 'center' },
  glassTabTextSelected: { color: colors.onPrimary },
  glassListTitle: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  glassRow: { borderTopColor: glass.divider },
});
