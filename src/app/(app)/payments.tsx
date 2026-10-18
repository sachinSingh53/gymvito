import { router, type Href, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  InvoiceRecord,
  PaymentCursor,
  PaymentRecord,
  PaymentSummary,
} from '@/data/repositories/phase4-repository';
import { addDays, type DateOnly } from '@/domain/dates/date-rules';
import { useLocalBusinessDate } from '@/features/memberships/use-local-business-date';
import { useAppSession } from '@/features/session/app-session-context';
import { formatDateOnly, formatMoneyMinor } from '@/i18n/formatters/regional-formatters';
import { AppButton, LoadingState, Notice } from '@/ui/components/core-controls';
import { FilterBar, FilterChip } from '@/ui/components/filter-controls';
import { GlassSurface } from '@/ui/components/glass-surface';
import { MaterialSymbol, OperationalShell, StatusChip } from '@/ui/components/operational-shell';
import {
  actionPressed,
  CARD_RADIUS,
  colors,
  fonts,
  glass,
  radii,
  spacing,
} from '@/ui/theme/tokens';

/** Payments read per page of the history; more load as the list nears its end. */
export const PAYMENT_PAGE_SIZE = 25;

type Tab = 'dues' | 'payments';
type DuesFilter = 'all' | 'overdue';
type HistoryFilter = 'all' | 'today';
type RegionalSettings = Parameters<typeof formatMoneyMinor>[1] &
  Parameters<typeof formatDateOnly>[1];

/** A titled panel of rows: one per due status, or one per day of payments. */
type Group =
  | {
      kind: 'invoices';
      key: string;
      title: string;
      tone: 'danger' | 'warning' | 'neutral';
      rows: InvoiceRecord[];
    }
  | { kind: 'payments'; key: string; title: string; rows: PaymentRecord[] };

const EMPTY_SUMMARY: PaymentSummary = { totalCount: 0, todayCount: 0, todayRecordedMinor: 0 };

export default function PaymentsRoute() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const { t } = useTranslation();
  const { state, getPhase4Repository } = useAppSession();
  const today = useLocalBusinessDate(
    state.status === 'unlocked' ? state.deviceLocale.timeZone : 'UTC',
  );
  const [tab, setTab] = useState<Tab>(
    params.filter === 'payments' || params.filter === 'today' ? 'payments' : 'dues',
  );
  const [duesFilter, setDuesFilter] = useState<DuesFilter>(
    params.filter === 'overdue' ? 'overdue' : 'all',
  );
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>(
    params.filter === 'today' ? 'today' : 'all',
  );
  const [invoices, setInvoices] = useState<readonly InvoiceRecord[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>(EMPTY_SUMMARY);
  const [payments, setPayments] = useState<readonly PaymentRecord[]>([]);
  const [cursor, setCursor] = useState<PaymentCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  /** Bumped on every reload so pages requested for an older list are dropped. */
  const generation = useRef(0);
  const loadingMoreRef = useRef(false);
  const loadedHistoryKey = useRef<string | null>(null);
  const historyDate = historyFilter === 'today' ? today : undefined;

  useFocusEffect(
    useCallback(() => {
      const run = ++generation.current;
      const historyKey = `${historyFilter}:${today}`;
      if (loadedHistoryKey.current !== historyKey) {
        setPayments([]);
        setCursor(null);
      }
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setLoadMoreFailed(false);
      setLoading(true);
      const repository = getPhase4Repository();
      void Promise.all([
        repository.listOutstandingInvoices(today),
        repository.getPaymentSummary(today),
        repository.listPaymentsPage({ limit: PAYMENT_PAGE_SIZE, receivedLocalDate: historyDate }),
      ])
        .then(([nextInvoices, nextSummary, page]) => {
          if (run !== generation.current) return;
          loadedHistoryKey.current = historyKey;
          setInvoices(nextInvoices);
          setSummary(nextSummary);
          setPayments(page.payments);
          setCursor(page.nextCursor);
          setFailed(false);
        })
        .catch(() => run === generation.current && setFailed(true))
        .finally(() => run === generation.current && setLoading(false));
      return () => {
        generation.current += 1;
      };
    }, [getPhase4Repository, historyDate, historyFilter, today]),
  );

  const loadMore = useCallback(() => {
    if (!cursor || loading || loadingMoreRef.current) return;
    const run = generation.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    void getPhase4Repository()
      .listPaymentsPage({ limit: PAYMENT_PAGE_SIZE, after: cursor, receivedLocalDate: historyDate })
      .then((page) => {
        if (run !== generation.current) return;
        setPayments((current) => [...current, ...page.payments]);
        setCursor(page.nextCursor);
      })
      .catch(() => run === generation.current && setLoadMoreFailed(true))
      .finally(() => {
        if (run !== generation.current) return;
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [cursor, getPhase4Repository, historyDate, loading]);

  if (state.status !== 'unlocked') return null;
  const settings: RegionalSettings = {
    language: state.snapshot.settings?.language ?? 'en',
    currencyCode: state.snapshot.settings?.currencyCode ?? 'INR',
    dateFormat: state.snapshot.settings?.dateFormat ?? ('day-month-year' as const),
  };
  const outstandingTotal = invoices.reduce((sum, invoice) => sum + invoice.balanceMinor, 0);
  const overdueInvoices = invoices.filter((invoice) => invoice.dueStatus === 'overdue');
  const historyCount = historyFilter === 'today' ? summary.todayCount : summary.totalCount;

  const groups: Group[] =
    tab === 'dues'
      ? invoiceGroups(duesFilter === 'overdue' ? overdueInvoices : invoices, t)
      : paymentGroups(payments, today, settings, t);

  const header = (
    <View style={styles.header}>
      <GlassSurface radius={CARD_RADIUS} style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.eyebrow}>{t('outstandingDues')}</Text>
          <View accessibilityLabel={t('savedOnDevice')} style={styles.localPill}>
            <MaterialSymbol color={colors.primary} name="cloud_done" size={14} />
            <Text style={styles.localPillText}>{t('savedOnDevice')}</Text>
          </View>
        </View>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          numberOfLines={1}
          style={[styles.heroAmount, outstandingTotal > 0 && styles.heroAmountDanger]}
        >
          {formatMoneyMinor(outstandingTotal, settings)}
        </Text>
        <Text style={styles.heroMeta}>
          {t('openInvoicesValue', { count: invoices.length })}
          {overdueInvoices.length
            ? ` • ${t('overdueInvoicesValue', { count: overdueInvoices.length })}`
            : ''}
        </Text>
        <View style={styles.statRow}>
          <Stat
            icon="point_of_sale"
            label={t('collectedToday')}
            value={formatMoneyMinor(summary.todayRecordedMinor, settings)}
          />
          <View style={styles.statDivider} />
          <Stat
            icon="receipt_long"
            label={t('recordedPayments')}
            value={String(summary.totalCount)}
          />
        </View>
        <AppButton
          icon={<MaterialSymbol color={colors.onPrimary} name="add_card" size={20} />}
          onPress={() => router.push('/members' as Href)}
          style={styles.recordButton}
        >
          {t('recordPayment')}
        </AppButton>
        <View style={styles.footnote}>
          <MaterialSymbol color={colors.textMuted} name="info" size={14} />
          <Text style={styles.footnoteText}>{t('recordedPaymentsOnly')}</Text>
        </View>
      </GlassSurface>

      <View accessibilityRole="tablist" style={styles.tabs}>
        <TabButton
          count={invoices.length}
          label={t('dues')}
          onPress={() => setTab('dues')}
          selected={tab === 'dues'}
        />
        <TabButton
          count={summary.totalCount}
          label={t('historyTab')}
          onPress={() => setTab('payments')}
          selected={tab === 'payments'}
        />
      </View>

      {tab === 'dues' ? (
        <FilterBar>
          <FilterChip
            count={invoices.length}
            label={t('memberFilterAll')}
            onPress={() => setDuesFilter('all')}
            selected={duesFilter === 'all'}
          />
          <FilterChip
            count={overdueInvoices.length}
            icon={{ name: 'priority_high', color: colors.danger }}
            label={t('overdue')}
            onPress={() => setDuesFilter('overdue')}
            selected={duesFilter === 'overdue'}
          />
        </FilterBar>
      ) : (
        <FilterBar>
          <FilterChip
            count={summary.totalCount}
            label={t('memberFilterAll')}
            onPress={() => setHistoryFilter('all')}
            selected={historyFilter === 'all'}
          />
          <FilterChip
            count={summary.todayCount}
            icon={{ name: 'today' }}
            label={t('today')}
            onPress={() => setHistoryFilter('today')}
            selected={historyFilter === 'today'}
          />
        </FilterBar>
      )}
      {failed ? <Notice danger>{t('paymentsLoadFailed')}</Notice> : null}
    </View>
  );

  const empty = loading ? (
    <LoadingState label={t('loading')} />
  ) : failed ? null : (
    <EmptyState
      icon={tab === 'dues' ? 'task_alt' : 'payments'}
      message={
        tab === 'dues'
          ? duesFilter === 'overdue'
            ? t('noOverdueInvoices')
            : t('noOutstandingInvoices')
          : historyFilter === 'today'
            ? t('noPaymentsToday')
            : t('noPaymentsRecorded')
      }
    />
  );

  const footer =
    tab !== 'payments' || !payments.length ? null : loadingMore ? (
      <View accessibilityLiveRegion="polite" style={styles.listFooter}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.listFooterText}>{t('loadingMorePayments')}</Text>
      </View>
    ) : loadMoreFailed ? (
      <View style={styles.listFooter}>
        <Text style={styles.listFooterText}>{t('loadMorePaymentsFailed')}</Text>
        <AppButton onPress={loadMore} variant="secondary">
          {t('retry')}
        </AppButton>
      </View>
    ) : !cursor ? (
      <Text style={[styles.listFooter, styles.listFooterText]}>
        {t('paymentHistoryEnd', { count: historyCount })}
      </Text>
    ) : null;

  return (
    <OperationalShell
      active="payments"
      scroll={false}
      subtitle={t('localFinancialLedger')}
      title={t('payments')}
    >
      <FlatList
        contentContainerStyle={styles.list}
        data={groups}
        keyExtractor={(group) => group.key}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        ListHeaderComponent={header}
        onEndReached={() => tab === 'payments' && !loadMoreFailed && loadMore()}
        onEndReachedThreshold={0.6}
        renderItem={({ item }) => <GroupPanel group={item} settings={settings} />}
        showsVerticalScrollIndicator={false}
      />
    </OperationalShell>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

function invoiceGroups(invoices: readonly InvoiceRecord[], t: Translate): Group[] {
  const overdue = invoices.filter((invoice) => invoice.dueStatus === 'overdue');
  const due = invoices.filter((invoice) => invoice.dueStatus === 'due');
  const upcoming = invoices.filter(
    (invoice) => invoice.dueStatus !== 'overdue' && invoice.dueStatus !== 'due',
  );
  const groups: Group[] = [];
  if (overdue.length)
    groups.push({
      kind: 'invoices',
      key: 'overdue',
      title: t('overdue'),
      tone: 'danger',
      rows: overdue,
    });
  if (due.length)
    groups.push({ kind: 'invoices', key: 'due', title: t('due'), tone: 'warning', rows: due });
  if (upcoming.length)
    groups.push({
      kind: 'invoices',
      key: 'upcoming',
      title: t('notDueYet'),
      tone: 'neutral',
      rows: upcoming,
    });
  return groups;
}

/** Payments arrive newest first, so each day's rows are already contiguous. */
function paymentGroups(
  payments: readonly PaymentRecord[],
  today: DateOnly,
  settings: RegionalSettings,
  t: Translate,
): Group[] {
  const yesterday = addDays(today, -1);
  const groups: Extract<Group, { kind: 'payments' }>[] = [];
  for (const payment of payments) {
    const date = payment.receivedLocalDate;
    const last = groups[groups.length - 1];
    if (last?.key === date) {
      last.rows.push(payment);
      continue;
    }
    groups.push({
      kind: 'payments',
      key: date,
      title:
        date === today
          ? t('today')
          : date === yesterday
            ? t('yesterday')
            : formatDateOnly(date, settings),
      rows: [payment],
    });
  }
  return groups;
}

function GroupPanel({ group, settings }: { group: Group; settings: RegionalSettings }) {
  const { t } = useTranslation();
  const total =
    group.kind === 'invoices'
      ? group.rows.reduce((sum, invoice) => sum + invoice.balanceMinor, 0)
      : group.rows
          .filter((payment) => payment.state === 'recorded')
          .reduce((sum, payment) => sum + payment.amountMinor, 0);
  const count =
    group.kind === 'invoices'
      ? t('invoicesCount', { count: group.rows.length })
      : t('paymentsCount', { count: group.rows.length });
  return (
    <View style={styles.group}>
      <View accessibilityRole="header" accessible style={styles.groupHeading}>
        <View style={styles.groupTitleLine}>
          {group.kind === 'invoices' && group.tone !== 'neutral' ? (
            <View
              style={[
                styles.groupDot,
                { backgroundColor: group.tone === 'danger' ? colors.danger : colors.warningText },
              ]}
            />
          ) : null}
          <Text style={styles.groupTitle}>{group.title}</Text>
          <Text style={styles.groupCount}>{count}</Text>
        </View>
        <Text style={styles.groupTotal}>{formatMoneyMinor(total, settings)}</Text>
      </View>
      <GlassSurface radius={CARD_RADIUS}>
        {group.kind === 'invoices'
          ? group.rows.map((invoice, index) => (
              <InvoiceRow
                invoice={invoice}
                key={invoice.id}
                last={index === group.rows.length - 1}
                settings={settings}
              />
            ))
          : group.rows.map((payment, index) => (
              <PaymentRow
                key={payment.id}
                last={index === group.rows.length - 1}
                payment={payment}
                settings={settings}
              />
            ))}
      </GlassSurface>
    </View>
  );
}

function InvoiceRow({
  invoice,
  last,
  settings,
}: {
  invoice: InvoiceRecord;
  last: boolean;
  settings: RegionalSettings;
}) {
  const { t } = useTranslation();
  const overdue = invoice.dueStatus === 'overdue';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/invoice/${invoice.id}` as Href)}
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && actionPressed]}
    >
      <View style={[styles.avatar, overdue && styles.avatarDanger]}>
        <Text style={[styles.avatarText, overdue && styles.avatarTextDanger]}>
          {initials(invoice.memberName)}
        </Text>
      </View>
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {invoice.memberName}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {invoice.planName} • {invoice.invoiceNumber}
        </Text>
        {invoice.dueDate ? (
          <Text style={[styles.rowMeta, overdue && styles.rowMetaDanger]}>
            {t('dueDateValue', { date: formatDateOnly(invoice.dueDate, settings) })}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowTrailing}>
        <Text style={[styles.rowAmount, overdue && styles.rowAmountDanger]}>
          {formatMoneyMinor(invoice.balanceMinor, settings)}
        </Text>
        <MaterialSymbol color={colors.outline} name="chevron_right" size={20} />
      </View>
    </Pressable>
  );
}

const METHOD_ICONS: Record<string, string> = {
  upi: 'qr_code_2',
  cash: 'payments',
  card: 'credit_card',
  'bank-transfer': 'account_balance',
  cheque: 'receipt',
  other: 'wallet',
};

function PaymentRow({
  payment,
  last,
  settings,
}: {
  payment: PaymentRecord;
  last: boolean;
  settings: RegionalSettings;
}) {
  const { t } = useTranslation();
  const corrected = payment.state === 'corrected';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/invoice/${payment.invoiceId}?receipt=${payment.id}` as Href)}
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && actionPressed]}
    >
      <View style={styles.methodIcon}>
        <MaterialSymbol
          color={colors.primaryDark}
          name={METHOD_ICONS[payment.methodCode] ?? 'payments'}
          size={22}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {payment.memberName}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {payment.methodLabel} • {payment.receiptNumber}
        </Text>
      </View>
      <View style={styles.paymentTrailing}>
        <Text style={[styles.rowAmount, corrected && styles.rowAmountCorrected]}>
          {formatMoneyMinor(payment.amountMinor, settings)}
        </Text>
        {corrected ? <StatusChip label={t('corrected')} tone="danger" /> : null}
      </View>
    </Pressable>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
  ).toUpperCase();
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statLabelLine}>
        <MaterialSymbol color={colors.primary} name={icon} size={16} />
        <Text numberOfLines={1} style={styles.statLabel}>
          {label}
        </Text>
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <GlassSurface radius={CARD_RADIUS} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialSymbol color={colors.primary} name={icon} size={28} />
      </View>
      <Text style={styles.emptyText}>{message}</Text>
    </GlassSurface>
  );
}

function TabButton({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        selected && styles.tabSelected,
        pressed && actionPressed,
      ]}
    >
      <Text numberOfLines={1} style={[styles.tabText, selected && styles.tabTextSelected]}>
        {label}
      </Text>
      <View style={[styles.tabCount, selected && styles.tabCountSelected]}>
        <Text style={[styles.tabCountText, selected && styles.tabCountTextSelected]}>{count}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing.lg },
  header: { gap: spacing.md },
  hero: { gap: spacing.sm, padding: spacing.md },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eyebrow: {
    flexShrink: 1,
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  localPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: radii.pill,
    backgroundColor: glass.fillAccent,
  },
  localPillText: { color: colors.primaryDark, fontFamily: fonts.medium, fontSize: 11 },
  heroAmount: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 36,
    fontVariant: ['tabular-nums'],
  },
  heroAmountDanger: { color: colors.danger },
  heroMeta: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: glass.divider,
  },
  stat: { minWidth: 0, flex: 1, gap: spacing.xs },
  statDivider: { width: 1, marginHorizontal: spacing.md, backgroundColor: glass.divider },
  statLabelLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { flexShrink: 1, color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12 },
  statValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  recordButton: { alignSelf: 'stretch' },
  footnote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  footnoteText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  tabs: {
    minHeight: 56,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: radii.pill,
    backgroundColor: glass.fillNeutral,
  },
  tab: {
    minWidth: 0,
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  tabSelected: { backgroundColor: colors.primary },
  tabText: { flexShrink: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  tabTextSelected: { color: colors.onPrimary, fontFamily: fonts.semibold },
  tabCount: {
    minWidth: 24,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: glass.fillAccent,
  },
  tabCountSelected: { backgroundColor: glass.fillOnPrimary },
  tabCountText: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  tabCountTextSelected: { color: colors.onPrimary },
  group: { gap: spacing.sm },
  groupHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  groupTitleLine: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  groupCount: { flexShrink: 1, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  groupTotal: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: glass.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: glass.rimWarning,
    backgroundColor: glass.fillWarning,
  },
  avatarDanger: { borderColor: glass.rimDanger, backgroundColor: glass.fillDanger },
  avatarText: { color: colors.warningText, fontFamily: fonts.bold, fontSize: 15 },
  avatarTextDanger: { color: colors.danger },
  methodIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    backgroundColor: glass.fillAccent,
  },
  rowCopy: { minWidth: 0, flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  rowMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  rowMetaDanger: { color: colors.danger, fontFamily: fonts.medium },
  rowTrailing: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  paymentTrailing: { alignItems: 'flex-end', gap: spacing.xs },
  rowAmount: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  rowAmountDanger: { color: colors.danger },
  rowAmountCorrected: { color: colors.textMuted, textDecorationLine: 'line-through' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: glass.fillAccent,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: 'center',
  },
  listFooter: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  listFooterText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
  },
});
