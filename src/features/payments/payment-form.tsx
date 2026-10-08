import { randomUUID } from 'expo-crypto';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MemberRecord } from '@/data/repositories/phase2-repository';
import type { InvoiceRecord } from '@/data/repositories/phase4-repository';
import type { PaymentMethod } from '@/domain/billing/money';
import { formatMoneyInput, parseMoneyInput } from '@/domain/plans/plan';
import { useLocalBusinessDate } from '@/features/memberships/use-local-business-date';
import { useAppSession } from '@/features/session/app-session-context';
import { formatDateOnly, formatMoneyMinor } from '@/i18n/formatters/regional-formatters';
import {
  AppButton,
  AppChoice,
  AppField,
  LoadingState,
  Notice,
} from '@/ui/components/core-controls';
import {
  LocalDataBadge,
  MaterialSymbol,
  StatusChip,
  SurfaceCard,
} from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

const METHODS: readonly { code: PaymentMethod; icon: string; labelKey: string; hintKey: string }[] =
  [
    {
      code: 'upi',
      icon: 'qr_code_2',
      labelKey: 'paymentMethodUpi',
      hintKey: 'paymentMethodUpiHint',
    },
    {
      code: 'cash',
      icon: 'payments',
      labelKey: 'paymentMethodCash',
      hintKey: 'paymentMethodCashHint',
    },
    {
      code: 'card',
      icon: 'credit_card',
      labelKey: 'paymentMethodCard',
      hintKey: 'paymentMethodCardHint',
    },
    {
      code: 'bank-transfer',
      icon: 'account_balance',
      labelKey: 'paymentMethodBank',
      hintKey: 'paymentMethodBankHint',
    },
    {
      code: 'cheque',
      icon: 'receipt_long',
      labelKey: 'paymentMethodCheque',
      hintKey: 'paymentMethodChequeHint',
    },
    {
      code: 'other',
      icon: 'more_horiz',
      labelKey: 'paymentMethodOther',
      hintKey: 'paymentMethodOtherHint',
    },
  ];

export function PaymentForm({ memberId, invoiceId }: { memberId?: string; invoiceId?: string }) {
  const { width } = useWindowDimensions();
  const tablet = width >= 760;
  const { t } = useTranslation();
  const { state, getPhase2Repository, getPhase4Repository } = useAppSession();
  const today = useLocalBusinessDate(
    state.status === 'unlocked' ? state.deviceLocale.timeZone : 'UTC',
  );
  const [operationId] = useState(randomUUID);
  const [member, setMember] = useState<MemberRecord | null>(null);
  const [invoices, setInvoices] = useState<readonly InvoiceRecord[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoiceId ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [methodOptions, setMethodOptions] = useState<
    Partial<Record<PaymentMethod, { label: string; isActive: boolean }>>
  >({});
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [allInvoices, billingSettings] = await Promise.all([
          memberId
            ? getPhase4Repository().listMemberInvoices(memberId, today)
            : getPhase4Repository().listOutstandingInvoices(today),
          getPhase4Repository().getBillingSettings(),
        ]);
        const outstanding = allInvoices.filter((row) => row.balanceMinor > 0);
        const initial = outstanding.find((row) => row.id === invoiceId) ?? outstanding[0] ?? null;
        const selectedMemberId = memberId ?? initial?.memberId;
        const memberRecord = selectedMemberId
          ? await getPhase2Repository().getMember(selectedMemberId)
          : null;
        if (!active) return;
        setInvoices(outstanding);
        setSelectedInvoiceId(initial?.id ?? '');
        setAmount(initial ? formatMoneyInput(initial.balanceMinor) : '');
        setMember(memberRecord);
        const options = Object.fromEntries(
          billingSettings.paymentMethods.map((item) => [
            item.code,
            { label: item.label, isActive: item.isActive },
          ]),
        );
        setMethodOptions(options);
        const firstActive = billingSettings.paymentMethods.find((item) => item.isActive);
        if (firstActive) setMethod(firstActive.code);
      } catch {
        if (active) setError('load');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [getPhase2Repository, getPhase4Repository, invoiceId, memberId, today]);

  if (state.status !== 'unlocked') return null;
  const settings = {
    language: state.snapshot.settings?.language ?? 'en',
    currencyCode: state.snapshot.settings?.currencyCode ?? 'INR',
    dateFormat: state.snapshot.settings?.dateFormat ?? ('day-month-year' as const),
  };
  const selected = invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;
  const selectedMethod = METHODS.find((item) => item.code === method) ?? METHODS[0]!;
  const availableMethods = METHODS.filter((item) => methodOptions[item.code]?.isActive !== false);

  const chooseInvoice = (next: InvoiceRecord) => {
    setSelectedInvoiceId(next.id);
    setAmount(formatMoneyInput(next.balanceMinor));
    setError('');
    if (next.memberId !== member?.id) {
      void getPhase2Repository().getMember(next.memberId).then(setMember);
    }
  };

  const submit = async () => {
    if (!selected || saving.current) return;
    const amountMinor = parseMoneyInput(amount);
    if (!amountMinor || amountMinor > selected.balanceMinor) {
      setError(amountMinor && amountMinor > selected.balanceMinor ? 'overpayment' : 'amount');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const payment = await getPhase4Repository().recordPayment(
        {
          operationId,
          invoiceId: selected.id,
          amountMinor,
          methodCode: method,
          methodLabel: methodOptions[method]?.label ?? t(selectedMethod.labelKey),
          transactionReference: reference,
          note,
          receivedAtUtc: new Date().toISOString(),
          receivedLocalDate: today,
        },
        state.ownerId,
        today,
      );
      router.replace(`/invoice/${selected.id}?receipt=${payment.id}&issued=1` as Href);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === 'PAYMENT_EXCEEDS_OUTSTANDING'
          ? 'overpayment'
          : 'save',
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label={t('loading')} />;
  if (!invoices.length) return <Notice>{t('noOutstandingInvoices')}</Notice>;

  return (
    <View style={[styles.layout, tablet && styles.layoutTablet]}>
      <View style={[styles.memberPane, tablet && styles.memberPaneTablet]}>
        <LocalDataBadge />
        <SurfaceCard style={styles.memberCard}>
          <View style={styles.memberIdentity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {member?.name.trim().charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.memberCopy}>
              <Text style={styles.memberName}>{member?.name ?? selected?.memberName}</Text>
              <Text style={styles.memberMeta}>{member?.memberCode ?? selected?.memberCode}</Text>
              <Text style={styles.memberMeta}>{member?.phone || selected?.memberPhone}</Text>
            </View>
          </View>
          {selected ? (
            <View style={styles.balanceBanner}>
              <View>
                <Text style={styles.balanceLabel}>{t('outstandingBalance')}</Text>
                <Text style={styles.balanceValue}>
                  {formatMoneyMinor(selected.balanceMinor, settings)}
                </Text>
              </View>
              <StatusChip
                label={selected.dueStatus === 'overdue' ? t('overdue') : t('due')}
                tone={selected.dueStatus === 'overdue' ? 'danger' : 'warning'}
              />
            </View>
          ) : null}
        </SurfaceCard>
      </View>
      <SurfaceCard style={styles.formCard}>
        <View style={styles.formHeading}>
          <View>
            <Text style={styles.eyebrow}>{t('terminalCollections')}</Text>
            <Text style={styles.title}>{t('recordPayment')}</Text>
          </View>
          {selected ? (
            <View style={styles.invoiceMeta}>
              <Text style={styles.invoiceNumber}>{selected.invoiceNumber}</Text>
              <Text style={styles.invoiceDue}>
                {t('unpaidDuesAmount', {
                  amount: formatMoneyMinor(selected.balanceMinor, settings),
                })}
              </Text>
            </View>
          ) : null}
        </View>
        {invoices.length > 1 ? (
          <View accessibilityRole="radiogroup" style={styles.invoiceChoices}>
            {invoices.map((invoice) => (
              <AppChoice
                key={invoice.id}
                label={`${invoice.invoiceNumber} • ${invoice.memberName} • ${formatMoneyMinor(invoice.balanceMinor, settings)}`}
                onPress={() => chooseInvoice(invoice)}
                selected={invoice.id === selectedInvoiceId}
              />
            ))}
          </View>
        ) : null}
        {error === 'load' || error === 'save' ? (
          <Notice danger>{t('paymentSaveFailed')}</Notice>
        ) : null}
        <AppField
          error={
            error === 'amount'
              ? t('paymentAmountRequired')
              : error === 'overpayment'
                ? t('paymentExceedsOutstanding')
                : undefined
          }
          keyboardType="decimal-pad"
          label={t('paymentAmount')}
          onChangeText={setAmount}
          value={amount}
        />
        {selected ? (
          <View style={styles.quickAmounts}>
            <AmountChip
              label={t('fullDueAmount', {
                amount: formatMoneyMinor(selected.balanceMinor, settings),
              })}
              onPress={() => setAmount(formatMoneyInput(selected.balanceMinor))}
              selected={parseMoneyInput(amount) === selected.balanceMinor}
            />
            {[200_000, 150_000]
              .filter((value) => value < selected.balanceMinor)
              .map((value) => (
                <AmountChip
                  key={value}
                  label={formatMoneyMinor(value, settings)}
                  onPress={() => setAmount(formatMoneyInput(value))}
                  selected={parseMoneyInput(amount) === value}
                />
              ))}
          </View>
        ) : null}
        <Text style={styles.sectionLabel}>{t('paymentMethod')}</Text>
        <View accessibilityRole="radiogroup" style={styles.methods}>
          {availableMethods.map((item) => {
            const selectedMethodCard = method === item.code;
            return (
              <Pressable
                accessibilityLabel={t(item.labelKey)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedMethodCard }}
                key={item.code}
                onPress={() => setMethod(item.code)}
                style={({ pressed }) => [
                  styles.method,
                  selectedMethodCard && styles.methodSelected,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialSymbol
                  color={selectedMethodCard ? '#fff' : colors.primaryDark}
                  name={item.icon}
                  size={24}
                />
                <View style={styles.methodCopy}>
                  <Text
                    style={[styles.methodLabel, selectedMethodCard && styles.methodLabelSelected]}
                  >
                    {methodOptions[item.code]?.label ?? t(item.labelKey)}
                  </Text>
                  <Text
                    style={[styles.methodHint, selectedMethodCard && styles.methodHintSelected]}
                  >
                    {t(item.hintKey)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <AppField
          label={t('transactionReferenceOptional')}
          onChangeText={setReference}
          value={reference}
        />
        <AppField label={t('paymentNoteOptional')} multiline onChangeText={setNote} value={note} />
        {selected ? (
          <View style={styles.reconcile}>
            <MaterialSymbol color={colors.primaryDark} name="check_circle" size={24} />
            <View style={styles.reconcileCopy}>
              <Text style={styles.reconcileTitle}>
                {t('balanceAfterPayment', {
                  amount: formatMoneyMinor(
                    Math.max(0, selected.balanceMinor - (parseMoneyInput(amount) ?? 0)),
                    settings,
                  ),
                })}
              </Text>
              <Text style={styles.reconcileMeta}>
                {selected.dueDate
                  ? t('dueDateValue', { date: formatDateOnly(selected.dueDate, settings) })
                  : t('dueDateNotSet')}
              </Text>
            </View>
          </View>
        ) : null}
        <AppButton disabled={busy || !selected} onPress={() => void submit()}>
          {busy ? t('saving') : t('recordAndIssueReceipt')}
        </AppButton>
        <Text style={styles.recordedNotice}>{t('recordedPaymentNotice')}</Text>
      </SurfaceCard>
    </View>
  );
}

function AmountChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress(): void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.amountChip, selected && styles.amountChipSelected]}
    >
      <Text style={[styles.amountChipText, selected && styles.amountChipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layout: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: spacing.md },
  layoutTablet: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  memberPane: { gap: spacing.sm },
  memberPaneTablet: { width: 360 },
  memberCard: { gap: spacing.md },
  memberIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: colors.surfaceHigh,
  },
  avatarText: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 22 },
  memberCopy: { minWidth: 0, flex: 1, gap: 2 },
  memberName: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  memberMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  balanceBanner: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerSurface,
  },
  balanceLabel: {
    color: colors.dangerText,
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  balanceValue: {
    color: colors.danger,
    fontFamily: fonts.bold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  formCard: { minWidth: 0, flex: 1, gap: spacing.md },
  formHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 24 },
  invoiceMeta: { alignItems: 'flex-end' },
  invoiceNumber: { color: colors.text, fontFamily: fonts.semibold, fontSize: 13 },
  invoiceDue: { color: colors.danger, fontFamily: fonts.medium, fontSize: 12 },
  invoiceChoices: { gap: spacing.sm },
  quickAmounts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  amountChip: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
  },
  amountChipSelected: { backgroundColor: colors.primary },
  amountChipText: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  amountChipTextSelected: { color: '#fff', fontFamily: fonts.semibold },
  sectionLabel: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  method: {
    minHeight: 72,
    minWidth: 180,
    flex: 1,
    flexBasis: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
  },
  methodSelected: { backgroundColor: colors.primary },
  methodCopy: { minWidth: 0, flex: 1 },
  methodLabel: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  methodLabelSelected: { color: '#fff' },
  methodHint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  methodHintSelected: { color: '#c9f2e8' },
  pressed: { opacity: 0.82 },
  reconcile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.successSurface,
  },
  reconcileCopy: { minWidth: 0, flex: 1 },
  reconcileTitle: { color: colors.successText, fontFamily: fonts.semibold, fontSize: 15 },
  reconcileMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  recordedNotice: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
