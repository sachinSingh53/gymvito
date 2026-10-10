import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import {
  createReportPdf,
  deleteTemporaryReport,
  shareReportPdf,
} from '@/platform/export/report-pdf';
import {
  AppButton,
  AppChoice,
  AppField,
  LoadingState,
  Notice,
} from '@/ui/components/core-controls';
import { OperationalShell, StatusChip, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, spacing } from '@/ui/theme/tokens';

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
  const { width } = useWindowDimensions();
  const wide = width >= 960;
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
  const [category, setCategory] = useState<MemberReportCategory>('active');
  const [fromDate, setFromDate] = useState<DateOnly>(addDays(today, -30));
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
  const [refreshKey, setRefreshKey] = useState(0);

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

  useFocusEffect(
    useCallback(() => {
      void refreshKey;
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
      refreshKey,
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

  const exportPdf = async () => {
    if (!finance || exporting) return;
    if (!(await reauthenticateOwner(ownerPin))) {
      setMessage(t('ownerPinIncorrect'));
      return;
    }
    setExporting(true);
    setMessage('');
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
      setMessage(
        (await shareReportPdf(file, t('exportSummaryPdf')))
          ? t('exportReady')
          : t('exportUnavailable'),
      );
      setOwnerPin('');
    } catch {
      setMessage(t('exportFailed'));
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
      <View style={styles.tabs}>
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
      <View style={[styles.columns, wide && styles.columnsWide]}>
        <SurfaceCard style={[styles.filters, wide && styles.filterPane]}>
          <Text style={styles.title}>{t('reportFilters')}</Text>
          <View style={styles.dateRow}>
            <View style={styles.flex}>
              <AppField
                label={t('fromDate')}
                value={fromDate}
                onChangeText={(value) => setFromDate(value as DateOnly)}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.flex}>
              <AppField
                label={t('toDate')}
                value={toDate}
                onChangeText={(value) => setToDate(value as DateOnly)}
                autoCapitalize="none"
              />
            </View>
          </View>
          {tab === 'members' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.choiceRow}
            >
              {CATEGORIES.map((value) => (
                <View style={styles.choice} key={value}>
                  <AppChoice
                    label={t(CATEGORY_KEYS[value])}
                    selected={category === value}
                    onPress={() => setCategory(value)}
                  />
                </View>
              ))}
            </ScrollView>
          ) : null}
          <Text style={styles.label}>{t('reportPlan')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.choiceRow}
          >
            <View style={styles.choice}>
              <AppChoice label={t('allPlans')} selected={!planId} onPress={() => setPlanId(null)} />
            </View>
            {plans.map((plan) => (
              <View style={styles.choice} key={plan.id}>
                <AppChoice
                  label={plan.name}
                  selected={planId === plan.id}
                  onPress={() => setPlanId(plan.id)}
                />
              </View>
            ))}
          </ScrollView>
          {tab === 'finance' ? (
            <>
              <Text style={styles.label}>{t('paymentMethod')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.choiceRow}
              >
                <View style={styles.choice}>
                  <AppChoice
                    label={t('allPaymentMethods')}
                    selected={!paymentMethod}
                    onPress={() => setPaymentMethod(null)}
                  />
                </View>
                {methods.map((method) => (
                  <View style={styles.choice} key={method.code}>
                    <AppChoice
                      label={method.label}
                      selected={paymentMethod === method.code}
                      onPress={() => setPaymentMethod(method.code)}
                    />
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}
          {tab === 'finance' ? (
            <>
              <Text style={styles.label}>{t('reportStatus')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.choiceRow}
              >
                <View style={styles.choice}>
                  <AppChoice
                    label={t('allStatuses')}
                    selected={!membershipStatus}
                    onPress={() => setMembershipStatus(null)}
                  />
                </View>
                {(['active', 'upcoming', 'expired', 'no-membership'] as const).map((status) => (
                  <View style={styles.choice} key={status}>
                    <AppChoice
                      label={t(CATEGORY_KEYS[status])}
                      selected={membershipStatus === status}
                      onPress={() => setMembershipStatus(status)}
                    />
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}
          <AppButton onPress={() => setRefreshKey((value) => value + 1)}>
            {t('applyFilters')}
          </AppButton>
        </SurfaceCard>
        <View style={styles.results}>
          {loading ? <LoadingState label={t('loading')} /> : null}
          {message ? (
            <Notice
              danger={
                message === t('reportLoadFailed') ||
                message === t('invalidDateRange') ||
                message === t('ownerPinIncorrect') ||
                message === t('exportFailed')
              }
            >
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
      style={[styles.tab, selected && styles.tabSelected]}
    >
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function MemberResults({ rows }: { rows: readonly MemberReportRow[] }) {
  const { t } = useTranslation();
  return (
    <SurfaceCard style={styles.list}>
      <Text style={styles.title}>
        {t('reportResults')} · {rows.length}
      </Text>
      {!rows.length ? (
        <Notice>{t('noReportRecords')}</Notice>
      ) : (
        rows.slice(0, 200).map((row) => (
          <Pressable
            key={row.id}
            onPress={() => router.push(`/member/${row.id}` as Href)}
            style={styles.row}
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
        <Text style={styles.title}>
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
              style={styles.row}
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
  tabSelected: { backgroundColor: colors.surface },
  tabText: { color: colors.textMuted, fontFamily: fonts.medium },
  tabTextSelected: { color: colors.primaryDark, fontFamily: fonts.semibold },
  columns: { gap: spacing.md },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  filterPane: { width: 390 },
  filters: { gap: spacing.md },
  results: { minWidth: 0, flex: 1, gap: spacing.md },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  label: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { minWidth: 150, flex: 1 },
  choiceRow: { gap: spacing.sm },
  choice: { minWidth: 112 },
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
});
