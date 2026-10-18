import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PlanRecord } from '@/data/repositories/phase2-repository';
import {
  formatMoneyInput,
  parseMoneyInput,
  validatePlan,
  type DiscountType,
  type PlanDurationUnit,
  type PlanInput,
  type RenewalBehavior,
} from '@/domain/plans/plan';
import { useAppSession } from '@/features/session/app-session-context';
import { currencySymbol } from '@/i18n/formatters/regional-formatters';
import { AppButton, AppField, LoadingState, Notice } from '@/ui/components/core-controls';
import {
  AppSegmented,
  AppSwitchRow,
  FormActions,
  FormLabel,
  FormRow,
  FormSection,
} from '@/ui/components/form-layout';
import { LocalDataBadge, MaterialSymbol } from '@/ui/components/operational-shell';
import { actionPressed, colors, glass, planColors, spacing } from '@/ui/theme/tokens';

const DURATION_LABELS = {
  day: 'durationDay',
  week: 'durationWeek',
  month: 'durationMonth',
  year: 'durationYear',
} as const;
const DISCOUNT_LABELS = {
  none: 'discountNone',
  fixed: 'discountFixed',
  percentage: 'discountPercentage',
} as const;
const RENEWAL_LABELS = {
  immediate: 'renewalImmediate',
  'after-expiry': 'renewalAfterExpiry',
  ask: 'renewalAsk',
} as const;

export function PlanForm({ planId }: { planId?: string }) {
  const { state, getPhase2Repository } = useAppSession();
  const { t } = useTranslation();
  const currency =
    state.status === 'unlocked' ? (state.snapshot.settings?.currencyCode ?? 'INR') : 'INR';
  const [existing, setExisting] = useState<PlanRecord | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationValue, setDurationValue] = useState('1');
  const [durationUnit, setDurationUnit] = useState<PlanDurationUnit>('month');
  const [price, setPrice] = useState('0.00');
  const [admissionFee, setAdmissionFee] = useState('0.00');
  const [taxLabel, setTaxLabel] = useState('GST');
  const [taxRate, setTaxRate] = useState('0');
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [colorHex, setColorHex] = useState<string>(planColors[0]);
  const [freezeAllowed, setFreezeAllowed] = useState(false);
  const [maxFreezeDays, setMaxFreezeDays] = useState('30');
  const [freezeExtends, setFreezeExtends] = useState(true);
  const [renewalBehavior, setRenewalBehavior] = useState<RenewalBehavior>('ask');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(planId));
  const [loadError, setLoadError] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!planId) return;
    let active = true;
    void getPhase2Repository()
      .getPlan(planId)
      .then((plan) => {
        if (!active) return;
        if (!plan) {
          setLoadError(true);
          return;
        }
        setExisting(plan);
        setName(plan.name);
        setDescription(plan.description);
        setDurationValue(String(plan.durationValue));
        setDurationUnit(plan.durationUnit);
        setPrice(formatMoneyInput(plan.priceMinor));
        setAdmissionFee(formatMoneyInput(plan.admissionFeeMinor));
        setTaxLabel(plan.taxLabel);
        setTaxRate(String(plan.taxRateBasisPoints / 100));
        setDiscountType(plan.discountType);
        setDiscountValue(
          plan.discountType === 'fixed'
            ? formatMoneyInput(plan.discountValue)
            : String(plan.discountValue / 100),
        );
        setColorHex(plan.colorHex);
        setFreezeAllowed(plan.freezeAllowed);
        setMaxFreezeDays(String(plan.maxFreezeDays ?? 30));
        setFreezeExtends(plan.freezeExtendsEndDate);
        setRenewalBehavior(plan.renewalBehavior);
      })
      .catch(() => active && setLoadError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [getPhase2Repository, planId]);

  if (state.status !== 'unlocked') return null;

  const buildInput = (): PlanInput | null => {
    const priceMinor = parseMoneyInput(price);
    const admissionFeeMinor = parseMoneyInput(admissionFee);
    const discountParsed =
      discountType === 'fixed'
        ? parseMoneyInput(discountValue)
        : Math.round(Number(discountValue) * 100);
    if (priceMinor === null || admissionFeeMinor === null || discountParsed === null) return null;
    return {
      name,
      description,
      durationValue: Number(durationValue),
      durationUnit,
      priceMinor,
      admissionFeeMinor,
      currencyCode: currency,
      taxLabel,
      taxRateBasisPoints: Math.round(Number(taxRate) * 100),
      discountType,
      discountValue: discountType === 'none' ? 0 : discountParsed,
      colorHex,
      freezeAllowed,
      maxFreezeDays: freezeAllowed ? Number(maxFreezeDays) : null,
      freezeExtendsEndDate: freezeAllowed && freezeExtends,
      renewalBehavior,
    };
  };

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    const input = buildInput();
    const nextErrors = input ? validatePlan(input) : { priceMinor: 'invalid' };
    setErrors(nextErrors);
    if (!input || Object.keys(nextErrors).length) {
      savingRef.current = false;
      return;
    }
    setBusy(true);
    try {
      await getPhase2Repository().savePlan(input, state.ownerId, planId);
      router.back();
    } catch (error) {
      setErrors({
        form: error instanceof Error && error.message.includes('UNIQUE') ? 'duplicate' : 'save',
      });
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label={t('loading')} />;
  if (loadError) {
    return (
      <View style={styles.form}>
        <Notice danger>{t('planLoadFailed')}</Notice>
        <AppButton onPress={() => router.back()} variant="secondary">
          {t('back')}
        </AppButton>
      </View>
    );
  }

  const symbol = currencySymbol(currency);
  const segments = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
    values.map((value) => ({ value, label: t(labels[value]) }));

  return (
    <View style={styles.form}>
      <LocalDataBadge />
      {errors.form ? (
        <Notice danger>
          {errors.form === 'duplicate' ? t('planNameDuplicate') : t('saveFailed')}
        </Notice>
      ) : null}
      <FormSection icon="sell" title={t('planBasics')}>
        <AppField
          error={errors.name ? t('fieldInvalid') : undefined}
          label={t('planName')}
          onChangeText={setName}
          value={name}
        />
        <AppField
          label={t('descriptionOptional')}
          multiline
          onChangeText={setDescription}
          value={description}
        />
        <View style={styles.colorGroup}>
          <FormLabel>{t('planColor')}</FormLabel>
          <View accessibilityRole="radiogroup" style={styles.colorRow}>
            {planColors.map((color) => {
              const selected = colorHex === color;
              return (
                <Pressable
                  accessibilityLabel={color}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={color}
                  onPress={() => setColorHex(color)}
                  style={({ pressed }) => [
                    styles.colorRing,
                    selected && { borderColor: color },
                    pressed && actionPressed,
                  ]}
                >
                  <View style={[styles.colorChoice, { backgroundColor: color }]}>
                    {selected ? (
                      <MaterialSymbol color={colors.onPrimary} name="check" size={20} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </FormSection>
      <FormSection icon="schedule" title={t('durationAndPrice')}>
        <AppField
          error={errors.durationValue ? t('fieldInvalid') : undefined}
          keyboardType="number-pad"
          label={t('durationValue')}
          onChangeText={setDurationValue}
          suffix={t(DURATION_LABELS[durationUnit])}
          value={durationValue}
        />
        <AppSegmented
          onChange={setDurationUnit}
          options={segments(['day', 'week', 'month', 'year'] as const, DURATION_LABELS)}
          value={durationUnit}
        />
        <FormRow>
          <AppField
            error={errors.priceMinor ? t('moneyInvalid') : undefined}
            keyboardType="decimal-pad"
            label={t('planPrice', { currency })}
            onChangeText={setPrice}
            prefix={symbol}
            value={price}
          />
          <AppField
            error={errors.admissionFeeMinor ? t('moneyInvalid') : undefined}
            keyboardType="decimal-pad"
            label={t('admissionFee', { currency })}
            onChangeText={setAdmissionFee}
            prefix={symbol}
            value={admissionFee}
          />
        </FormRow>
      </FormSection>
      <FormSection icon="percent" title={t('taxAndDiscount')}>
        <FormRow minItemWidth={130}>
          <AppField label={t('taxLabel')} onChangeText={setTaxLabel} value={taxLabel} />
          <AppField
            error={errors.taxRateBasisPoints ? t('fieldInvalid') : undefined}
            keyboardType="decimal-pad"
            label={t('taxRatePercent')}
            onChangeText={setTaxRate}
            suffix="%"
            value={taxRate}
          />
        </FormRow>
        <AppSegmented
          label={t('discountPolicy')}
          onChange={setDiscountType}
          options={segments(['none', 'fixed', 'percentage'] as const, DISCOUNT_LABELS)}
          value={discountType}
        />
        {discountType !== 'none' ? (
          <AppField
            error={errors.discountValue ? t('fieldInvalid') : undefined}
            keyboardType="decimal-pad"
            label={discountType === 'fixed' ? t('discountAmount') : t('discountPercent')}
            onChangeText={setDiscountValue}
            prefix={discountType === 'fixed' ? symbol : undefined}
            suffix={discountType === 'percentage' ? '%' : undefined}
            value={discountValue}
          />
        ) : null}
      </FormSection>
      <FormSection icon="tune" title={t('futurePolicies')}>
        <AppSwitchRow
          icon="ac_unit"
          label={t('allowFreeze')}
          onValueChange={setFreezeAllowed}
          value={freezeAllowed}
        >
          <AppField
            error={errors.maxFreezeDays ? t('fieldInvalid') : undefined}
            keyboardType="number-pad"
            label={t('maxFreezeDays')}
            onChangeText={setMaxFreezeDays}
            value={maxFreezeDays}
          />
          <AppSwitchRow
            label={t('freezeExtendsEnd')}
            onValueChange={setFreezeExtends}
            value={freezeExtends}
          />
        </AppSwitchRow>
        <AppSegmented
          label={t('renewalBehavior')}
          onChange={setRenewalBehavior}
          options={segments(['immediate', 'after-expiry', 'ask'] as const, RENEWAL_LABELS)}
          value={renewalBehavior}
        />
      </FormSection>
      {existing ? <Notice>{t('planHistoryNotice')}</Notice> : null}
      <FormActions
        onPrimary={() => void save()}
        onSecondary={() => router.back()}
        primaryDisabled={busy}
        primaryLabel={busy ? t('saving') : t('savePlan')}
        secondaryLabel={t('cancel')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: spacing.md },
  colorGroup: { gap: 6 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorRing: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 26,
  },
  colorChoice: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.rimSoft,
    borderRadius: 20,
  },
});
