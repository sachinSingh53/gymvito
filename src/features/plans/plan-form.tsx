import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
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
import {
  AppButton,
  AppChoice,
  AppField,
  LoadingState,
  Notice,
} from '@/ui/components/core-controls';
import { LocalDataBadge, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, spacing } from '@/ui/theme/tokens';

const PLAN_COLORS = ['#0D6659', '#156A5D', '#7C5300', '#A92E2E', '#49432D'] as const;
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
  const [colorHex, setColorHex] = useState<string>('#0D6659');
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

  return (
    <View style={styles.form}>
      <LocalDataBadge />
      {errors.form ? (
        <Notice danger>
          {errors.form === 'duplicate' ? t('planNameDuplicate') : t('saveFailed')}
        </Notice>
      ) : null}
      <SurfaceCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t('planBasics')}</Text>
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
        <Text style={styles.label}>{t('planColor')}</Text>
        <View style={styles.colorRow}>
          {PLAN_COLORS.map((color) => (
            <Pressable
              accessibilityLabel={color}
              accessibilityRole="radio"
              accessibilityState={{ selected: colorHex === color }}
              key={color}
              onPress={() => setColorHex(color)}
              style={[
                styles.colorChoice,
                { backgroundColor: color },
                colorHex === color && styles.colorSelected,
              ]}
            />
          ))}
        </View>
      </SurfaceCard>
      <SurfaceCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t('durationAndPrice')}</Text>
        <AppField
          error={errors.durationValue ? t('fieldInvalid') : undefined}
          keyboardType="number-pad"
          label={t('durationValue')}
          onChangeText={setDurationValue}
          value={durationValue}
        />
        <View accessibilityRole="radiogroup" style={styles.choiceGrid}>
          {(['day', 'week', 'month', 'year'] as const).map((unit) => (
            <AppChoice
              key={unit}
              label={t(DURATION_LABELS[unit])}
              onPress={() => setDurationUnit(unit)}
              selected={durationUnit === unit}
            />
          ))}
        </View>
        <AppField
          error={errors.priceMinor ? t('moneyInvalid') : undefined}
          keyboardType="decimal-pad"
          label={t('planPrice', { currency })}
          onChangeText={setPrice}
          value={price}
        />
        <AppField
          error={errors.admissionFeeMinor ? t('moneyInvalid') : undefined}
          keyboardType="decimal-pad"
          label={t('admissionFee', { currency })}
          onChangeText={setAdmissionFee}
          value={admissionFee}
        />
      </SurfaceCard>
      <SurfaceCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t('taxAndDiscount')}</Text>
        <AppField label={t('taxLabel')} onChangeText={setTaxLabel} value={taxLabel} />
        <AppField
          error={errors.taxRateBasisPoints ? t('fieldInvalid') : undefined}
          keyboardType="decimal-pad"
          label={t('taxRatePercent')}
          onChangeText={setTaxRate}
          value={taxRate}
        />
        <Text style={styles.label}>{t('discountPolicy')}</Text>
        <View accessibilityRole="radiogroup" style={styles.choiceGrid}>
          {(['none', 'fixed', 'percentage'] as const).map((type) => (
            <AppChoice
              key={type}
              label={t(DISCOUNT_LABELS[type])}
              onPress={() => setDiscountType(type)}
              selected={discountType === type}
            />
          ))}
        </View>
        {discountType !== 'none' ? (
          <AppField
            error={errors.discountValue ? t('fieldInvalid') : undefined}
            keyboardType="decimal-pad"
            label={discountType === 'fixed' ? t('discountAmount') : t('discountPercent')}
            onChangeText={setDiscountValue}
            value={discountValue}
          />
        ) : null}
      </SurfaceCard>
      <SurfaceCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t('futurePolicies')}</Text>
        <ToggleRow
          label={t('allowFreeze')}
          onValueChange={setFreezeAllowed}
          value={freezeAllowed}
        />
        {freezeAllowed ? (
          <>
            <AppField
              error={errors.maxFreezeDays ? t('fieldInvalid') : undefined}
              keyboardType="number-pad"
              label={t('maxFreezeDays')}
              onChangeText={setMaxFreezeDays}
              value={maxFreezeDays}
            />
            <ToggleRow
              label={t('freezeExtendsEnd')}
              onValueChange={setFreezeExtends}
              value={freezeExtends}
            />
          </>
        ) : null}
        <Text style={styles.label}>{t('renewalBehavior')}</Text>
        <View accessibilityRole="radiogroup" style={styles.choiceGrid}>
          {(['immediate', 'after-expiry', 'ask'] as const).map((behavior) => (
            <AppChoice
              key={behavior}
              label={t(RENEWAL_LABELS[behavior])}
              onPress={() => setRenewalBehavior(behavior)}
              selected={renewalBehavior === behavior}
            />
          ))}
        </View>
      </SurfaceCard>
      {existing ? <Notice>{t('planHistoryNotice')}</Notice> : null}
      <View style={styles.actions}>
        <AppButton disabled={busy} onPress={() => void save()}>
          {busy ? t('saving') : t('savePlan')}
        </AppButton>
        <AppButton onPress={() => router.back()} variant="secondary">
          {t('cancel')}
        </AppButton>
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange(value: boolean): void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: spacing.md },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  label: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorChoice: { width: 48, height: 48, borderRadius: 24 },
  colorSelected: { borderWidth: 4, borderColor: colors.brandHeader },
  choiceGrid: { gap: spacing.sm },
  toggleRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleLabel: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  actions: { gap: spacing.sm },
});
