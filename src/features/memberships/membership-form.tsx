import { randomUUID } from 'expo-crypto';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MembershipPreview, MembershipRecord } from '@/data/repositories/phase3-repository';
import type { BillingSettings } from '@/data/repositories/phase4-repository';
import type { PaymentMethod } from '@/domain/billing/money';
import { parseDateOnly, renewalStartAfterExpiry, type DateOnly } from '@/domain/dates/date-rules';
import { validateMembershipOverride } from '@/domain/memberships/membership';
import { formatMoneyInput, parseMoneyInput } from '@/domain/plans/plan';
import { useAppSession } from '@/features/session/app-session-context';
import {
  currencySymbol,
  formatDateOnly,
  formatMoneyMinor,
} from '@/i18n/formatters/regional-formatters';
import {
  AppButton,
  AppChoice,
  AppField,
  LoadingState,
  Notice,
} from '@/ui/components/core-controls';
import { AppDateField } from '@/ui/components/date-field';
import {
  AppSegmented,
  AppSwitchRow,
  FormActions,
  FormLabel,
  FormRow,
  FormSection,
} from '@/ui/components/form-layout';
import {
  LocalDataBadge,
  MaterialSymbol,
  StatusChip,
  SurfaceCard,
} from '@/ui/components/operational-shell';
import { colors, fonts, glass, radii, spacing } from '@/ui/theme/tokens';

import { useLocalBusinessDate } from './use-local-business-date';

const DURATION_LABELS = {
  day: 'durationDay',
  week: 'durationWeek',
  month: 'durationMonth',
  year: 'durationYear',
} as const;

const STATUS_LABELS = {
  draft: 'membershipStatusDraft',
  scheduled: 'membershipStatusScheduled',
  active: 'membershipStatusActive',
  expired: 'membershipStatusExpired',
  cancelled: 'membershipStatusCancelled',
} as const;

export function MembershipForm({
  memberId,
  priorMembershipId,
}: {
  memberId: string;
  priorMembershipId?: string;
}) {
  const { state, getPhase2Repository, getPhase3Repository, getPhase4Repository } = useAppSession();
  const { t } = useTranslation();
  const [operationId] = useState(randomUUID);
  const timeZone = state.status === 'unlocked' ? state.deviceLocale.timeZone : 'UTC';
  const today = useLocalBusinessDate(timeZone);
  const [plans, setPlans] = useState<
    Awaited<ReturnType<ReturnType<typeof getPhase2Repository>['listPlans']>>
  >([]);
  const [prior, setPrior] = useState<MembershipRecord | null>(null);
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState<DateOnly>(today);
  const [renewalTiming, setRenewalTiming] = useState<'after-expiry' | 'immediate'>('after-expiry');
  const [customPrice, setCustomPrice] = useState('');
  const [customDiscount, setCustomDiscount] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [dueDate, setDueDate] = useState<DateOnly>(today);
  const [paymentMethods, setPaymentMethods] = useState<BillingSettings['paymentMethods']>([]);
  const [recordInitialPayment, setRecordInitialPayment] = useState(false);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState('');
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<PaymentMethod>('upi');
  const [initialPaymentReference, setInitialPaymentReference] = useState('');
  const [initialPaymentNote, setInitialPaymentNote] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [acknowledgeOverlap, setAcknowledgeOverlap] = useState(false);
  const [preview, setPreview] = useState<MembershipPreview | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [activePlans, memberships, billingSettings] = await Promise.all([
          getPhase2Repository().listPlans(false),
          priorMembershipId
            ? getPhase3Repository().listMemberships(memberId, today)
            : Promise.resolve([]),
          getPhase4Repository().getBillingSettings(),
        ]);
        if (!active) return;
        const renewalSource = memberships.find((item) => item.id === priorMembershipId) ?? null;
        setPlans(activePlans);
        setPaymentMethods(billingSettings.paymentMethods);
        const firstActiveMethod = billingSettings.paymentMethods.find((method) => method.isActive);
        if (firstActiveMethod) setInitialPaymentMethod(firstActiveMethod.code);
        setPrior(renewalSource);
        const initialPlan =
          activePlans.find((item) => item.id === renewalSource?.sourcePlanId) ?? activePlans[0];
        setPlanId(initialPlan?.id ?? '');
        if (renewalSource) setStartDate(renewalStartAfterExpiry(renewalSource.endDate));
      } catch {
        if (active) setErrors({ form: 'load' });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    getPhase2Repository,
    getPhase3Repository,
    getPhase4Repository,
    memberId,
    priorMembershipId,
    today,
  ]);

  useEffect(() => {
    if (!planId || loading) {
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      try {
        parseDateOnly(startDate);
        if (customEndDate) parseDateOnly(customEndDate);
        const priceMinor = customPrice ? parseMoneyInput(customPrice) : undefined;
        const discountMinor = customDiscount ? parseMoneyInput(customDiscount) : undefined;
        if (priceMinor === null || discountMinor === null) throw new Error('INVALID_MONEY');
        void getPhase3Repository()
          .previewMembership(
            {
              operationId,
              memberId,
              planId,
              startDate,
              priorMembershipId,
              priceMinor,
              discountMinor,
              overrideEndDate: customEndDate ? (customEndDate as DateOnly) : undefined,
              overrideReason,
              acknowledgeOverlap,
            },
            today,
          )
          .then((next) => {
            if (active) {
              setPreview(next);
              setErrors((current) => (current.form === 'preview' ? {} : current));
            }
          })
          .catch((error: unknown) => {
            if (active) {
              setPreview(null);
              setErrors((current) => ({
                ...current,
                form: 'preview',
                ...(error instanceof Error &&
                error.message === 'MEMBERSHIP_OVERRIDE_REASON_REQUIRED'
                  ? { overrideReason: 'required' }
                  : {}),
              }));
            }
          });
      } catch {
        setPreview(null);
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    acknowledgeOverlap,
    customDiscount,
    customEndDate,
    customPrice,
    getPhase3Repository,
    loading,
    memberId,
    operationId,
    overrideReason,
    planId,
    priorMembershipId,
    startDate,
    today,
  ]);

  if (state.status !== 'unlocked') return null;
  const settings = {
    language: state.snapshot.settings?.language ?? 'en',
    currencyCode: state.snapshot.settings?.currencyCode ?? 'INR',
    dateFormat: state.snapshot.settings?.dateFormat ?? ('day-month-year' as const),
  };
  const activePaymentMethods = paymentMethods.filter((method) => method.isActive);

  const choosePlan = (nextPlanId: string) => {
    setPlanId(nextPlanId);
    setAcknowledgeOverlap(false);
    if (!prior) return;
    const plan = plans.find((item) => item.id === nextPlanId);
    const timing = plan?.renewalBehavior === 'immediate' ? 'immediate' : 'after-expiry';
    setRenewalTiming(timing);
    setStartDate(timing === 'immediate' ? today : renewalStartAfterExpiry(prior.endDate));
  };

  const chooseTiming = (timing: 'after-expiry' | 'immediate') => {
    setRenewalTiming(timing);
    setAcknowledgeOverlap(false);
    setStartDate(timing === 'immediate' || !prior ? today : renewalStartAfterExpiry(prior.endDate));
  };

  const toggleInitialPayment = (enabled: boolean) => {
    setRecordInitialPayment(enabled);
    setErrors((current) => {
      const { initialPayment: _initialPayment, ...rest } = current;
      return rest;
    });
    if (enabled && preview && !initialPaymentAmount) {
      setInitialPaymentAmount(formatMoneyInput(preview.charges.totalMinor));
    }
  };

  const finalize = async () => {
    if (savingRef.current || !preview) return;
    const priceMinor = customPrice ? parseMoneyInput(customPrice) : undefined;
    const discountMinor = customDiscount ? parseMoneyInput(customDiscount) : undefined;
    const validation = validateMembershipOverride({
      priceMinor: priceMinor ?? undefined,
      discountMinor: discountMinor ?? undefined,
      overrideEndDate: customEndDate || undefined,
      overrideReason,
    });
    if (priceMinor === null) validation.priceMinor = 'invalid';
    if (discountMinor === null) validation.discountMinor = 'invalid';
    try {
      parseDateOnly(dueDate);
    } catch {
      validation.dueDate = 'invalid';
    }
    if (preview.overlaps.length && !acknowledgeOverlap) validation.overlap = 'required';
    const initialPaymentMinor = recordInitialPayment
      ? parseMoneyInput(initialPaymentAmount)
      : undefined;
    const selectedMethod = activePaymentMethods.find(
      (method) => method.code === initialPaymentMethod,
    );
    if (recordInitialPayment) {
      if (!initialPaymentMinor || !selectedMethod) {
        validation.initialPayment = 'invalid';
      } else if (initialPaymentMinor > preview.charges.totalMinor) {
        validation.initialPayment = 'overpayment';
      }
    }
    setErrors(validation);
    if (Object.keys(validation).length) return;
    savingRef.current = true;
    setBusy(true);
    try {
      const result = await getPhase4Repository().finalizeMembershipWithBilling(
        {
          operationId,
          memberId,
          planId,
          startDate,
          priorMembershipId,
          priceMinor: priceMinor ?? undefined,
          discountMinor: discountMinor ?? undefined,
          overrideEndDate: customEndDate ? (customEndDate as DateOnly) : undefined,
          overrideReason,
          acknowledgeOverlap,
        },
        state.ownerId,
        today,
        dueDate,
        recordInitialPayment && initialPaymentMinor && selectedMethod
          ? {
              operationId: `payment:${operationId}`,
              amountMinor: initialPaymentMinor,
              methodCode: selectedMethod.code,
              methodLabel: selectedMethod.label,
              transactionReference: initialPaymentReference,
              note: initialPaymentNote,
              receivedAtUtc: new Date().toISOString(),
              receivedLocalDate: today,
            }
          : undefined,
      );
      router.replace(
        result.payment
          ? (`/invoice/${result.invoice.id}?receipt=${result.payment.id}&issued=1` as Href)
          : (`/member/${memberId}` as Href),
      );
    } catch {
      setErrors({ form: 'save' });
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label={t('loading')} />;

  const symbol = currencySymbol(settings.currencyCode);
  const intro = (
    <>
      <Text style={styles.title}>{t('membershipSetupTitle')}</Text>
      <Text style={styles.subtitle}>{t('membershipSetupSubtitle')}</Text>
    </>
  );

  return (
    <View style={styles.form}>
      <LocalDataBadge />
      <SurfaceCard style={styles.intro}>{intro}</SurfaceCard>
      {errors.form === 'load' ? <Notice danger>{t('memberLoadFailed')}</Notice> : null}
      {errors.form === 'save' ? <Notice danger>{t('membershipSaveFailed')}</Notice> : null}
      {!plans.length ? (
        <SurfaceCard style={styles.empty}>
          <MaterialSymbol color={colors.primaryDark} name="playlist_add" size={36} />
          <Text style={styles.sectionTitle}>{t('noActivePlans')}</Text>
          <AppButton onPress={() => router.push('/plan/new')}>{t('createFirstPlan')}</AppButton>
        </SurfaceCard>
      ) : (
        <>
          <FormSection icon="card_membership" title={t('choosePlan')}>
            <View accessibilityRole="radiogroup" style={styles.planChoices}>
              {plans.map((plan) => (
                <AppChoice
                  description={t('planDurationSummary', {
                    count: plan.durationValue,
                    unit: t(DURATION_LABELS[plan.durationUnit]),
                  })}
                  key={plan.id}
                  label={plan.name}
                  onPress={() => choosePlan(plan.id)}
                  selected={planId === plan.id}
                  trailing={formatMoneyMinor(plan.priceMinor, settings)}
                />
              ))}
            </View>
            {prior ? (
              <AppSegmented
                label={t('renewalTiming')}
                onChange={chooseTiming}
                options={[
                  { value: 'after-expiry', label: t('afterCurrentExpiry') },
                  { value: 'immediate', label: t('startImmediately') },
                ]}
                value={renewalTiming}
              />
            ) : null}
            <FormRow minItemWidth={200}>
              <AppDateField
                error={errors.startDate ? t('fieldInvalid') : undefined}
                label={t('membershipStartDate')}
                onChangeText={(value) => {
                  setStartDate(value as DateOnly);
                  setAcknowledgeOverlap(false);
                }}
                value={startDate}
              />
              <AppDateField
                error={errors.dueDate ? t('fieldInvalid') : undefined}
                hint={t('invoiceDueDateHint')}
                label={t('invoiceDueDate')}
                onChangeText={(value) => setDueDate(value as DateOnly)}
                value={dueDate}
              />
            </FormRow>
          </FormSection>
          <FormSection icon="edit_note" title={t('planTermsSnapshot')}>
            <FormRow>
              <AppField
                error={errors.priceMinor ? t('moneyInvalid') : undefined}
                keyboardType="decimal-pad"
                label={t('customPriceOptional')}
                onChangeText={setCustomPrice}
                placeholder={formatMoneyInput(
                  plans.find((plan) => plan.id === planId)?.priceMinor ?? 0,
                )}
                prefix={symbol}
                value={customPrice}
              />
              <AppField
                error={errors.discountMinor ? t('moneyInvalid') : undefined}
                keyboardType="decimal-pad"
                label={t('customDiscountOptional')}
                onChangeText={setCustomDiscount}
                prefix={symbol}
                value={customDiscount}
              />
            </FormRow>
            <AppDateField
              error={errors.overrideEndDate ? t('fieldInvalid') : undefined}
              label={t('membershipEndDateOptional')}
              minimumDate={startDate}
              onChangeText={setCustomEndDate}
              value={customEndDate}
            />
            <AppField
              error={errors.overrideReason ? t('overrideReasonHint') : undefined}
              hint={t('overrideReasonHint')}
              label={t('overrideReason')}
              multiline
              onChangeText={setOverrideReason}
              value={overrideReason}
            />
          </FormSection>
          {preview ? (
            <SurfaceCard style={styles.preview}>
              <View style={styles.previewHeader}>
                <Text style={styles.sectionTitle}>{t('membershipPreview')}</Text>
                <StatusChip
                  label={t(STATUS_LABELS[preview.status])}
                  tone={preview.status === 'active' ? 'active' : 'warning'}
                />
              </View>
              <Text style={styles.planName}>{preview.plan.name}</Text>
              <Text style={styles.dateRange}>
                {t('membershipDateRange', {
                  start: formatDateOnly(preview.startDate, settings),
                  end: formatDateOnly(preview.endDate, settings),
                })}
              </Text>
              <Text style={styles.breakdownTitle}>{t('projectedCharges')}</Text>
              <ChargeRow
                label={t('basePrice')}
                value={formatMoneyMinor(preview.charges.priceMinor, settings)}
              />
              <ChargeRow
                label={t('admissionFee', { currency: preview.plan.currencyCode })}
                value={formatMoneyMinor(preview.charges.admissionFeeMinor, settings)}
              />
              <ChargeRow
                label={t('discount')}
                value={`− ${formatMoneyMinor(preview.charges.discountMinor, settings)}`}
              />
              <ChargeRow
                label={t('tax')}
                value={formatMoneyMinor(preview.charges.taxMinor, settings)}
              />
              <View style={[styles.totalRow, styles.glassWell]}>
                <Text style={styles.totalLabel}>{t('projectedTotal')}</Text>
                <Text style={styles.totalValue}>
                  {formatMoneyMinor(preview.charges.totalMinor, settings)}
                </Text>
              </View>
              <Notice>{t('invoiceCreatedWithMembershipNotice')}</Notice>
            </SurfaceCard>
          ) : null}
          {preview ? (
            <FormSection icon="payments" title={t('recordPayment')}>
              <AppSwitchRow
                description={t('recordPaymentNowHint')}
                icon="point_of_sale"
                label={t('recordPaymentNow')}
                onValueChange={toggleInitialPayment}
                value={recordInitialPayment}
              >
                <AppField
                  error={
                    errors.initialPayment === 'overpayment'
                      ? t('paymentExceedsOutstanding')
                      : errors.initialPayment
                        ? t('paymentAmountRequired')
                        : undefined
                  }
                  keyboardType="decimal-pad"
                  label={t('initialPaymentAmount')}
                  onChangeText={setInitialPaymentAmount}
                  prefix={symbol}
                  value={initialPaymentAmount}
                />
                <FormLabel>{t('paymentMethod')}</FormLabel>
                <View accessibilityRole="radiogroup" style={styles.methodGrid}>
                  {activePaymentMethods.map((method) => (
                    <View key={method.code} style={styles.methodChoice}>
                      <AppChoice
                        label={method.label}
                        onPress={() => setInitialPaymentMethod(method.code)}
                        selected={initialPaymentMethod === method.code}
                      />
                    </View>
                  ))}
                </View>
                <AppField
                  icon="tag"
                  label={t('transactionReferenceOptional')}
                  onChangeText={setInitialPaymentReference}
                  value={initialPaymentReference}
                />
                <AppField
                  label={t('paymentNoteOptional')}
                  multiline
                  onChangeText={setInitialPaymentNote}
                  value={initialPaymentNote}
                />
                <View style={[styles.paymentBalance, styles.glassWell]}>
                  <Text style={styles.paymentBalanceLabel}>
                    {t('balanceAfterPayment', {
                      amount: formatMoneyMinor(
                        Math.max(
                          0,
                          preview.charges.totalMinor - (parseMoneyInput(initialPaymentAmount) ?? 0),
                        ),
                        settings,
                      ),
                    })}
                  </Text>
                  <Text style={styles.paymentBalanceHint}>{t('recordedPaymentNotice')}</Text>
                </View>
              </AppSwitchRow>
            </FormSection>
          ) : null}
          {preview?.overlaps.length ? (
            <SurfaceCard style={styles.glassOverlapCard}>
              <Text style={styles.overlapTitle}>{t('overlapTitle')}</Text>
              <Text style={styles.overlapText}>
                {t('overlapMessage', { count: preview.overlaps.length })}
              </Text>
              {preview.overlaps.map((item) => (
                <Text key={item.id} style={styles.overlapItem}>
                  {item.planName} • {formatDateOnly(item.startDate, settings)} —{' '}
                  {formatDateOnly(item.endDate, settings)}
                </Text>
              ))}
              <AppSwitchRow
                label={t('acknowledgeOverlap')}
                onValueChange={setAcknowledgeOverlap}
                value={acknowledgeOverlap}
              />
            </SurfaceCard>
          ) : null}
          <FormActions
            onPrimary={() => void finalize()}
            onSecondary={() => router.back()}
            primaryDisabled={
              !preview || busy || Boolean(preview.overlaps.length && !acknowledgeOverlap)
            }
            primaryIcon="how_to_reg"
            primaryLabel={
              busy ? t('saving') : t(priorMembershipId ? 'finalizeRenewal' : 'finalizeEnrollment')
            }
            secondaryLabel={t('cancel')}
          />
        </>
      )}
    </View>
  );
}

function ChargeRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.chargeRow, styles.glassChargeRow]}>
      <Text style={styles.chargeLabel}>{label}</Text>
      <Text style={styles.chargeValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: spacing.md },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 24 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  intro: { gap: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.md },
  sectionTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  planChoices: { gap: spacing.sm },
  preview: { gap: spacing.sm },
  previewHeader: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planName: { color: colors.text, fontFamily: fonts.bold, fontSize: 22 },
  dateRange: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
  breakdownTitle: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  chargeRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chargeLabel: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  chargeValue: {
    flexShrink: 0,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  totalRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
  },
  totalLabel: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  totalValue: {
    flexShrink: 0,
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 22,
  },
  overlapTitle: { color: colors.warningText, fontFamily: fonts.bold, fontSize: 17 },
  overlapText: {
    color: colors.warningText,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  overlapItem: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  methodChoice: { minWidth: 220, flexBasis: '48%', flexGrow: 1 },
  paymentBalance: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
  },
  paymentBalanceLabel: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  paymentBalanceHint: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  glassWell: {
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: radii.lg,
    backgroundColor: glass.fillAccent,
  },
  glassChargeRow: { borderBottomWidth: 1, borderBottomColor: glass.divider },
  glassOverlapCard: {
    gap: spacing.sm,
    borderColor: glass.rimWarning,
    backgroundColor: glass.tintWarning,
  },
});
