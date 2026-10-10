import { randomUUID } from 'expo-crypto';
import { router, type Href, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { InvoiceDetail, PaymentRecord } from '@/data/repositories/phase4-repository';
import { useLocalBusinessDate } from '@/features/memberships/use-local-business-date';
import { useAppSession } from '@/features/session/app-session-context';
import {
  formatDateOnly,
  formatInstant,
  formatMoneyMinor,
} from '@/i18n/formatters/regional-formatters';
import {
  createPaymentReceiptPdf,
  deletePaymentReceipt,
  paymentReceiptShareFailureCode,
  printPaymentReceipt,
  sharePaymentReceipt,
} from '@/platform/printing/payment-receipt';
import { logLocalDiagnostic } from '@/platform/diagnostics/local-diagnostic-logger';
import { AppButton, AppField, LoadingState, Notice } from '@/ui/components/core-controls';
import {
  LocalDataBadge,
  MaterialSymbol,
  OperationalShell,
  StatusChip,
  SurfaceCard,
} from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

export default function InvoiceDetailRoute() {
  const { invoiceId, receipt, issued } = useLocalSearchParams<{
    invoiceId: string;
    receipt?: string;
    issued?: string;
  }>();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const phone = width < 600;
  const { state, getPhase4Repository } = useAppSession();
  const today = useLocalBusinessDate(
    state.status === 'unlocked' ? state.deviceLocale.timeZone : 'UTC',
  );
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageDanger, setMessageDanger] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [correctionPaymentId, setCorrectionPaymentId] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  useFocusEffect(
    useCallback(() => {
      void refreshKey;
      let active = true;
      void getPhase4Repository()
        .getInvoice(invoiceId, today)
        .then((next) => active && setDetail(next))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [getPhase4Repository, invoiceId, refreshKey, today]),
  );
  if (state.status !== 'unlocked') return null;
  const settings = {
    language: state.snapshot.settings?.language ?? 'en',
    currencyCode: state.snapshot.settings?.currencyCode ?? 'INR',
    dateFormat: state.snapshot.settings?.dateFormat ?? ('day-month-year' as const),
    timeFormat: state.snapshot.settings?.timeFormat ?? ('12-hour' as const),
  };
  const invoice = detail?.invoice;
  const selectedPayment = receipt
    ? (detail?.payments.find((payment) => payment.id === receipt) ?? null)
    : null;

  const receiptAction = async (payment: PaymentRecord, action: 'print' | 'share') => {
    if (!invoice || !state.snapshot.gym || receiptBusy) return;
    setReceiptBusy(true);
    setMessage('');
    setMessageDanger(false);
    const pdf = await createPaymentReceiptPdf({
      language: settings.language,
      currencyCode: invoice.currencyCode,
      gymName: state.snapshot.gym.name,
      gymAddress: state.snapshot.gym.address,
      gymPhone: state.snapshot.gym.phone,
      receiptFooter: state.snapshot.gym.receiptFooter,
      receiptNumber: payment.receiptNumber,
      invoiceNumber: invoice.invoiceNumber,
      memberName: invoice.memberName,
      memberCode: invoice.memberCode,
      planName: invoice.planName,
      amountMinor: payment.amountMinor,
      methodLabel: payment.methodLabel,
      transactionReference: payment.transactionReference,
      receivedAtLabel: formatInstant(
        new Date(payment.receivedAtUtc),
        settings,
        state.deviceLocale.timeZone,
      ),
      invoiceTotalMinor: invoice.totalMinor,
      paidTotalMinor: invoice.paidMinor + invoice.adjustmentMinor,
      balanceMinor: invoice.balanceMinor,
      duplicate: issued !== '1' || payment.id !== receipt,
    }).catch(() => {
      logLocalDiagnostic('error', 'RECEIPT.PDF_CREATE_FAILED');
      setMessage(t('receiptPdfCreationFailed'));
      setMessageDanger(true);
      return null;
    });
    if (!pdf) {
      setReceiptBusy(false);
      return;
    }
    try {
      if (action === 'print') {
        await printPaymentReceipt(pdf);
        setMessage(t('printDialogOpened'));
      } else {
        const shared = await sharePaymentReceipt(pdf, t('shareReceipt'), payment.receiptNumber);
        setMessage(
          shared === 'shared'
            ? t('shareDialogOpened')
            : shared === 'opened'
              ? t('receiptOpenedForSharing')
              : shared === 'saved'
                ? t('receiptSavedForSharing')
                : t('sharingUnavailable'),
        );
      }
    } catch (error) {
      logLocalDiagnostic(
        'error',
        action === 'share' ? 'RECEIPT.SHARE_FAILED' : 'RECEIPT.PRINT_FAILED',
      );
      setMessage(
        action === 'share'
          ? t('receiptShareFailedWithCode', { code: paymentReceiptShareFailureCode(error) })
          : t('receiptPrintFailed'),
      );
      setMessageDanger(true);
    } finally {
      deletePaymentReceipt(pdf);
      setReceiptBusy(false);
    }
  };

  const correctPayment = async (paymentId: string) => {
    if (!correctionReason.trim() || receiptBusy) return;
    setReceiptBusy(true);
    setMessage('');
    setMessageDanger(false);
    try {
      await getPhase4Repository().correctPayment(
        randomUUID(),
        paymentId,
        correctionReason,
        state.ownerId,
      );
      setCorrectionPaymentId('');
      setCorrectionReason('');
      setMessage(t('paymentCorrectionSaved'));
      setRefreshKey((value) => value + 1);
    } catch {
      setMessage(t('paymentCorrectionFailed'));
      setMessageDanger(true);
    } finally {
      setReceiptBusy(false);
    }
  };

  return (
    <OperationalShell active="payments" backHref="/payments" canGoBack title={t('invoiceDetail')}>
      {loading ? <LoadingState label={t('loading')} /> : null}
      {!loading && !detail ? <Notice danger>{t('invoiceLoadFailed')}</Notice> : null}
      {detail && invoice ? (
        <View style={styles.page}>
          <View style={styles.ribbon}>
            <LocalDataBadge />
            <StatusChip
              label={t(`invoiceStatus_${invoice.status}`)}
              tone={
                invoice.status === 'paid'
                  ? 'active'
                  : invoice.dueStatus === 'overdue'
                    ? 'danger'
                    : 'warning'
              }
            />
          </View>
          <SurfaceCard style={styles.summary}>
            <View style={[styles.heading, phone && styles.phoneHeading]}>
              <View>
                <Text style={styles.eyebrow}>{invoice.invoiceNumber}</Text>
                <Text style={styles.title}>{invoice.memberName}</Text>
                <Text style={styles.meta}>
                  {invoice.memberCode} • {invoice.planName}
                </Text>
              </View>
              <View style={[styles.totalBlock, phone && styles.phoneTotalBlock]}>
                <Text style={styles.totalLabel}>{t('invoiceTotal')}</Text>
                <Text style={styles.total}>{formatMoneyMinor(invoice.totalMinor, settings)}</Text>
              </View>
            </View>
            {invoice.dueDate ? (
              <Text
                style={[styles.dueDate, invoice.dueStatus === 'overdue' && styles.dueDateOverdue]}
              >
                {t('dueDateValue', { date: formatDateOnly(invoice.dueDate, settings) })}
              </Text>
            ) : null}
            <View style={styles.financialGrid}>
              <Metric
                label={t('invoiceTotal')}
                value={formatMoneyMinor(invoice.totalMinor, settings)}
              />
              <Metric
                label={t('recordedPaid')}
                value={formatMoneyMinor(invoice.paidMinor + invoice.adjustmentMinor, settings)}
              />
              <Metric
                danger={invoice.balanceMinor > 0}
                label={t('balanceDue')}
                value={formatMoneyMinor(invoice.balanceMinor, settings)}
              />
            </View>
            {invoice.balanceMinor > 0 ? (
              <AppButton
                onPress={() =>
                  router.push(`/member/${invoice.memberId}/payment?invoiceId=${invoice.id}` as Href)
                }
              >
                {t('collectAmount', { amount: formatMoneyMinor(invoice.balanceMinor, settings) })}
              </AppButton>
            ) : null}
          </SurfaceCard>
          <View style={styles.columns}>
            <SurfaceCard style={[styles.column, phone && styles.phoneColumn]}>
              <Text style={styles.sectionTitle}>{t('chargeBreakdown')}</Text>
              {detail.lines.map((line) => (
                <Line
                  key={line.id}
                  label={line.description}
                  value={formatMoneyMinor(line.lineTotalMinor, settings)}
                />
              ))}
              <Line
                emphasized
                label={t('invoiceTotal')}
                value={formatMoneyMinor(invoice.totalMinor, settings)}
              />
            </SurfaceCard>
            <SurfaceCard style={[styles.column, phone && styles.phoneColumn]}>
              <Text style={styles.sectionTitle}>{t('paymentHistory')}</Text>
              {!detail.payments.length ? (
                <Text style={styles.empty}>{t('noPaymentsRecorded')}</Text>
              ) : (
                detail.payments.map((payment) => (
                  <View
                    key={payment.id}
                    style={[
                      styles.payment,
                      selectedPayment?.id === payment.id && styles.paymentSelected,
                    ]}
                  >
                    <View style={styles.paymentTop}>
                      <View>
                        <Text style={styles.paymentAmount}>
                          {formatMoneyMinor(payment.amountMinor, settings)}
                        </Text>
                        <Text style={styles.meta}>
                          {payment.receiptNumber} • {payment.methodLabel}
                        </Text>
                      </View>
                      <StatusChip
                        label={payment.state === 'corrected' ? t('corrected') : t('recorded')}
                        tone={payment.state === 'corrected' ? 'danger' : 'active'}
                      />
                    </View>
                    <Text style={styles.meta}>
                      {formatInstant(
                        new Date(payment.receivedAtUtc),
                        settings,
                        state.deviceLocale.timeZone,
                      )}
                    </Text>
                    <View style={styles.actions}>
                      <View style={styles.receiptActions}>
                        <AppButton
                          accessibilityLabel={t('printReceipt')}
                          disabled={receiptBusy}
                          icon={<MaterialSymbol color={colors.primary} name="print" size={22} />}
                          iconOnly
                          onPress={() => void receiptAction(payment, 'print')}
                          variant="secondary"
                        />
                        <AppButton
                          accessibilityLabel={t('saveOrSharePdf')}
                          disabled={receiptBusy}
                          icon={
                            <MaterialSymbol
                              color={colors.primary}
                              name="picture_as_pdf"
                              size={22}
                            />
                          }
                          iconOnly
                          onPress={() => void receiptAction(payment, 'share')}
                          variant="secondary"
                        />
                      </View>
                      {payment.state === 'recorded' ? (
                        <AppButton
                          accessibilityLabel={t('correctPayment')}
                          disabled={receiptBusy}
                          icon={<MaterialSymbol color={colors.onDark} name="edit_note" size={19} />}
                          iconOnly
                          onPress={() => {
                            setCorrectionPaymentId(payment.id);
                            setCorrectionReason('');
                          }}
                          variant="danger"
                        />
                      ) : null}
                    </View>
                    {correctionPaymentId === payment.id ? (
                      <View style={styles.correction}>
                        <Notice danger>{t('correctionAppendsEvent')}</Notice>
                        <AppField
                          label={t('correctionReason')}
                          multiline
                          onChangeText={setCorrectionReason}
                          value={correctionReason}
                        />
                        <View style={[styles.actions, phone && styles.phoneActions]}>
                          <AppButton
                            disabled={!correctionReason.trim() || receiptBusy}
                            onPress={() => void correctPayment(payment.id)}
                            style={phone ? styles.phoneAction : undefined}
                            variant="danger"
                          >
                            {t('confirmCorrection')}
                          </AppButton>
                          <AppButton
                            onPress={() => setCorrectionPaymentId('')}
                            style={phone ? styles.phoneAction : undefined}
                            variant="secondary"
                          >
                            {t('cancel')}
                          </AppButton>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
              {message ? <Notice danger={messageDanger}>{message}</Notice> : null}
            </SurfaceCard>
          </View>
          <Notice>{t('financialHistoryImmutable')}</Notice>
        </View>
      ) : null}
    </OperationalShell>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <View style={[styles.metric, danger && styles.metricDanger]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, danger && styles.metricValueDanger]}>{value}</Text>
    </View>
  );
}
function Line({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View style={[styles.line, emphasized && styles.lineEmphasized]}>
      <Text style={[styles.lineText, emphasized && styles.lineStrong]}>{label}</Text>
      <Text style={[styles.lineValue, emphasized && styles.lineStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 1060, alignSelf: 'center', gap: spacing.md },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  summary: { gap: spacing.md },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  phoneHeading: { flexDirection: 'column' },
  eyebrow: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1 },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 24 },
  meta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  totalBlock: { alignItems: 'flex-end' },
  phoneTotalBlock: { alignItems: 'flex-start' },
  totalLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  total: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  dueDate: { color: colors.warningText, fontFamily: fonts.medium, fontSize: 12 },
  dueDateOverdue: { color: colors.danger },
  financialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: {
    minWidth: 150,
    flex: 1,
    gap: spacing.xs,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceContainer,
  },
  metricDanger: { backgroundColor: colors.dangerSurface },
  metricLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  metricValueDanger: { color: colors.danger },
  columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.md },
  column: { minWidth: 0, flexGrow: 1, flexBasis: 420, gap: spacing.sm },
  phoneColumn: { width: '100%', flexBasis: 'auto', flexGrow: 0 },
  sectionTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineEmphasized: { borderBottomWidth: 0, paddingTop: spacing.md },
  lineText: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  lineValue: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  lineStrong: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 15 },
  payment: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
  },
  paymentSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.successSurface,
  },
  paymentTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  paymentAmount: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.xs },
  receiptActions: { flexDirection: 'row', gap: spacing.sm },
  phoneActions: { flexDirection: 'column', flexWrap: 'nowrap' },
  phoneAction: { width: '100%' },
  correction: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  empty: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
});
