import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { InvoiceRecord, PaymentRecord } from '@/data/repositories/phase4-repository';
import { useLocalBusinessDate } from '@/features/memberships/use-local-business-date';
import { useAppSession } from '@/features/session/app-session-context';
import { formatDateOnly, formatMoneyMinor } from '@/i18n/formatters/regional-formatters';
import { AppButton, LoadingState, Notice } from '@/ui/components/core-controls';
import {
  LocalDataBadge,
  MaterialSymbol,
  OperationalShell,
  StatusChip,
  SurfaceCard,
} from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

export default function PaymentsRoute() {
  const { t } = useTranslation();
  const { state, getPhase4Repository } = useAppSession();
  const today = useLocalBusinessDate(
    state.status === 'unlocked' ? state.deviceLocale.timeZone : 'UTC',
  );
  const [tab, setTab] = useState<'dues' | 'payments'>('dues');
  const [invoices, setInvoices] = useState<readonly InvoiceRecord[]>([]);
  const [payments, setPayments] = useState<readonly PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void Promise.all([
        getPhase4Repository().listOutstandingInvoices(today),
        getPhase4Repository().listRecentPayments(),
      ])
        .then(([nextInvoices, nextPayments]) => {
          if (!active) return;
          setInvoices(nextInvoices);
          setPayments(nextPayments);
          setFailed(false);
        })
        .catch(() => active && setFailed(true))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [getPhase4Repository, today]),
  );
  if (state.status !== 'unlocked') return null;
  const settings = {
    language: state.snapshot.settings?.language ?? 'en',
    currencyCode: state.snapshot.settings?.currencyCode ?? 'INR',
    dateFormat: state.snapshot.settings?.dateFormat ?? ('day-month-year' as const),
  };
  const outstandingTotal = invoices.reduce((sum, invoice) => sum + invoice.balanceMinor, 0);
  const overdueCount = invoices.filter((invoice) => invoice.dueStatus === 'overdue').length;

  return (
    <OperationalShell active="payments" title={t('payments')} subtitle={t('localFinancialLedger')}>
      <View style={styles.headingRow}>
        <View>
          <LocalDataBadge />
          <Text style={styles.subtitle}>{t('recordedPaymentsOnly')}</Text>
        </View>
        <AppButton onPress={() => router.push('/members' as Href)}>{t('recordPayment')}</AppButton>
      </View>
      <View style={styles.metrics}>
        <SurfaceCard style={styles.metric}>
          <Text style={styles.metricLabel}>{t('outstandingDues')}</Text>
          <Text style={styles.metricDanger}>{formatMoneyMinor(outstandingTotal, settings)}</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.metric}>
          <Text style={styles.metricLabel}>{t('overdueInvoices')}</Text>
          <Text style={styles.metricValue}>{overdueCount}</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.metric}>
          <Text style={styles.metricLabel}>{t('recordedPayments')}</Text>
          <Text style={styles.metricValue}>{payments.length}</Text>
        </SurfaceCard>
      </View>
      <View style={styles.tabs}>
        <Tab
          label={`${t('dues')} (${invoices.length})`}
          onPress={() => setTab('dues')}
          selected={tab === 'dues'}
        />
        <Tab
          label={`${t('paymentHistory')} (${payments.length})`}
          onPress={() => setTab('payments')}
          selected={tab === 'payments'}
        />
      </View>
      {loading ? <LoadingState label={t('loading')} /> : null}
      {failed ? <Notice danger>{t('paymentsLoadFailed')}</Notice> : null}
      {!loading && !failed && tab === 'dues' ? (
        <View style={styles.list}>
          {!invoices.length ? (
            <Notice>{t('noOutstandingInvoices')}</Notice>
          ) : (
            invoices.map((invoice) => (
              <Pressable
                accessibilityRole="button"
                key={invoice.id}
                onPress={() => router.push(`/invoice/${invoice.id}` as Href)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowIcon}>
                  <MaterialSymbol
                    color={invoice.dueStatus === 'overdue' ? colors.danger : colors.primaryDark}
                    name="receipt_long"
                    size={22}
                  />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{invoice.memberName}</Text>
                  <Text style={styles.rowMeta}>
                    {invoice.invoiceNumber} • {invoice.planName}
                    {invoice.dueDate
                      ? ` • ${t('dueDateValue', { date: formatDateOnly(invoice.dueDate, settings) })}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.rowTrailing}>
                  <Text style={styles.rowAmount}>
                    {formatMoneyMinor(invoice.balanceMinor, settings)}
                  </Text>
                  <StatusChip
                    label={invoice.dueStatus === 'overdue' ? t('overdue') : t('due')}
                    tone={invoice.dueStatus === 'overdue' ? 'danger' : 'warning'}
                  />
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
      {!loading && !failed && tab === 'payments' ? (
        <View style={styles.list}>
          {!payments.length ? (
            <Notice>{t('noPaymentsRecorded')}</Notice>
          ) : (
            payments.map((payment) => (
              <Pressable
                accessibilityRole="button"
                key={payment.id}
                onPress={() =>
                  router.push(`/invoice/${payment.invoiceId}?receipt=${payment.id}` as Href)
                }
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowIcon}>
                  <MaterialSymbol color={colors.primaryDark} name="payments" size={22} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{payment.memberName}</Text>
                  <Text style={styles.rowMeta}>
                    {payment.receiptNumber} • {payment.methodLabel} •{' '}
                    {formatDateOnly(payment.receivedLocalDate, settings)}
                  </Text>
                </View>
                <View style={styles.rowTrailing}>
                  <Text style={styles.rowAmount}>
                    {formatMoneyMinor(payment.amountMinor, settings)}
                  </Text>
                  <StatusChip
                    label={payment.state === 'corrected' ? t('corrected') : t('recorded')}
                    tone={payment.state === 'corrected' ? 'danger' : 'active'}
                  />
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
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

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { minWidth: 180, flex: 1, gap: spacing.xs },
  metricLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  metricDanger: {
    color: colors.danger,
    fontFamily: fonts.bold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  tabs: {
    minHeight: 52,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  tabSelected: { backgroundColor: colors.surface },
  tabText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  tabTextSelected: { color: colors.primaryDark, fontFamily: fonts.semibold },
  list: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.surfaceHigh,
  },
  rowCopy: { minWidth: 0, flex: 1, gap: spacing.xs },
  rowTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  rowMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  rowTrailing: { alignItems: 'flex-end', gap: spacing.xs },
  rowAmount: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  pressed: { opacity: 0.75 },
});
