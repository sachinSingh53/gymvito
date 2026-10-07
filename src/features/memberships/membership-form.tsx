import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MembershipPreview, MembershipRecord } from '@/data/repositories/phase3-repository';
import { parseDateOnly, renewalStartAfterExpiry, type DateOnly } from '@/domain/dates/date-rules';
import { validateMembershipOverride } from '@/domain/memberships/membership';
import { formatMoneyInput, parseMoneyInput } from '@/domain/plans/plan';
import { useAppSession } from '@/features/session/app-session-context';
import { formatDateOnly, formatMoneyMinor } from '@/i18n/formatters/regional-formatters';
import {
  AppButton,
  AppChoice,
  AppField,
  LoadingState,
  Notice,
} from '@/ui/components/core-controls';
import { LocalDataBadge, StatusChip, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

import { useLocalBusinessDate } from './use-local-business-date';

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
  const { state, getPhase2Repository, getPhase3Repository } = useAppSession();
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
        const activePlans = await getPhase2Repository().listPlans(false);
        const memberships = priorMembershipId
          ? await getPhase3Repository().listMemberships(memberId, today)
          : [];
        if (!active) return;
        const renewalSource = memberships.find((item) => item.id === priorMembershipId) ?? null;
        setPlans(activePlans);
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
  }, [getPhase2Repository, getPhase3Repository, memberId, priorMembershipId, today]);

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
    if (preview.overlaps.length && !acknowledgeOverlap) validation.overlap = 'required';
    setErrors(validation);
    if (Object.keys(validation).length) return;
    savingRef.current = true;
    setBusy(true);
    try {
      await getPhase3Repository().finalizeMembership(
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
      );
      router.replace(`/member/${memberId}`);
    } catch {
      setErrors({ form: 'save' });
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label={t('loading')} />;

  return (
    <View style={styles.form}>
      <LocalDataBadge />
      <View>
        <Text style={styles.title}>{t('membershipSetupTitle')}</Text>
        <Text style={styles.subtitle}>{t('membershipSetupSubtitle')}</Text>
      </View>
      {errors.form === 'load' ? <Notice danger>{t('memberLoadFailed')}</Notice> : null}
      {errors.form === 'save' ? <Notice danger>{t('membershipSaveFailed')}</Notice> : null}
      {!plans.length ? (
        <SurfaceCard style={styles.empty}>
          <Text style={styles.sectionTitle}>{t('noActivePlans')}</Text>
          <AppButton onPress={() => router.push('/plan/new')}>{t('createFirstPlan')}</AppButton>
        </SurfaceCard>
      ) : (
        <>
          <SurfaceCard style={styles.section}>
            <Text style={styles.sectionTitle}>{t('choosePlan')}</Text>
            <View accessibilityRole="radiogroup" style={styles.planChoices}>
              {plans.map((plan) => (
                <AppChoice
                  key={plan.id}
                  label={`${plan.name} • ${formatMoneyMinor(plan.priceMinor, settings)}`}
                  onPress={() => choosePlan(plan.id)}
                  selected={planId === plan.id}
                />
              ))}
            </View>
            {prior ? (
              <>
                <Text style={styles.label}>{t('renewalTiming')}</Text>
                <View accessibilityRole="radiogroup" style={styles.timingRow}>
                  <View style={styles.timingChoice}>
                    <AppChoice
                      label={t('afterCurrentExpiry')}
                      onPress={() => chooseTiming('after-expiry')}
                      selected={renewalTiming === 'after-expiry'}
                    />
                  </View>
                  <View style={styles.timingChoice}>
                    <AppChoice
                      label={t('startImmediately')}
                      onPress={() => chooseTiming('immediate')}
                      selected={renewalTiming === 'immediate'}
                    />
                  </View>
                </View>
              </>
            ) : null}
            <AppField
              error={errors.startDate ? t('fieldInvalid') : undefined}
              label={t('membershipStartDate')}
              onChangeText={(value) => {
                setStartDate(value as DateOnly);
                setAcknowledgeOverlap(false);
              }}
              value={startDate}
            />
          </SurfaceCard>
          <SurfaceCard style={styles.section}>
            <Text style={styles.sectionTitle}>{t('planTermsSnapshot')}</Text>
            <AppField
              error={errors.priceMinor ? t('moneyInvalid') : undefined}
              keyboardType="decimal-pad"
              label={t('customPriceOptional')}
              onChangeText={setCustomPrice}
              placeholder={formatMoneyInput(
                plans.find((plan) => plan.id === planId)?.priceMinor ?? 0,
              )}
              value={customPrice}
            />
            <AppField
              error={errors.discountMinor ? t('moneyInvalid') : undefined}
              keyboardType="decimal-pad"
              label={t('customDiscountOptional')}
              onChangeText={setCustomDiscount}
              value={customDiscount}
            />
            <AppField
              error={errors.overrideEndDate ? t('fieldInvalid') : undefined}
              label={t('membershipEndDateOptional')}
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
          </SurfaceCard>
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
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('projectedTotal')}</Text>
                <Text style={styles.totalValue}>
                  {formatMoneyMinor(preview.charges.totalMinor, settings)}
                </Text>
              </View>
              <Notice>{t('paymentPhase4Notice')}</Notice>
            </SurfaceCard>
          ) : null}
          {preview?.overlaps.length ? (
            <SurfaceCard style={styles.overlapCard}>
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
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('acknowledgeOverlap')}</Text>
                <Switch
                  accessibilityLabel={t('acknowledgeOverlap')}
                  onValueChange={setAcknowledgeOverlap}
                  trackColor={{ true: colors.primary }}
                  value={acknowledgeOverlap}
                />
              </View>
            </SurfaceCard>
          ) : null}
          <View style={styles.actions}>
            <AppButton
              disabled={!preview || busy || Boolean(preview.overlaps.length && !acknowledgeOverlap)}
              onPress={() => void finalize()}
            >
              {busy ? t('saving') : t(priorMembershipId ? 'finalizeRenewal' : 'finalizeEnrollment')}
            </AppButton>
            <AppButton onPress={() => router.back()} variant="secondary">
              {t('cancel')}
            </AppButton>
          </View>
        </>
      )}
    </View>
  );
}

function ChargeRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chargeRow}>
      <Text style={styles.chargeLabel}>{label}</Text>
      <Text style={styles.chargeValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: spacing.md },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 24 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  section: { gap: spacing.md },
  empty: { alignItems: 'center', gap: spacing.md },
  sectionTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  label: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  planChoices: { gap: spacing.sm },
  timingRow: { flexDirection: 'row', gap: spacing.sm },
  timingChoice: { minWidth: 0, flex: 1 },
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
  overlapCard: {
    gap: spacing.sm,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSurface,
  },
  overlapTitle: { color: colors.warningText, fontFamily: fonts.bold, fontSize: 17 },
  overlapText: {
    color: colors.warningText,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  overlapItem: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  switchRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchLabel: { flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  actions: { gap: spacing.sm },
});
