import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PlanRecord } from '@/data/repositories/phase2-repository';
import { useAppSession } from '@/features/session/app-session-context';
import { formatMoneyMinor } from '@/i18n/formatters/regional-formatters';
import { AppButton, LoadingState, Notice } from '@/ui/components/core-controls';
import {
  LocalDataBadge,
  OperationalShell,
  StatusChip,
  SurfaceCard,
} from '@/ui/components/operational-shell';
import { colors, fonts, spacing } from '@/ui/theme/tokens';

const DURATION_LABELS = {
  day: 'durationDay',
  week: 'durationWeek',
  month: 'durationMonth',
  year: 'durationYear',
} as const;

export default function PlansRoute() {
  const { state, getPhase2Repository } = useAppSession();
  const { t } = useTranslation();
  const [plans, setPlans] = useState<readonly PlanRecord[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void getPhase2Repository()
      .listPlans()
      .then((rows) => active && setPlans(rows))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [getPhase2Repository]);
  useFocusEffect(load);
  if (state.status !== 'unlocked') return null;
  const settings = state.snapshot.settings;

  const toggle = (plan: PlanRecord) => {
    Alert.alert(
      plan.isActive ? t('deactivatePlan') : t('activatePlan'),
      plan.isActive ? t('deactivatePlanMessage') : t('activatePlanMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: plan.isActive ? t('deactivate') : t('activate'),
          style: plan.isActive ? 'destructive' : 'default',
          onPress: () =>
            void getPhase2Repository()
              .setPlanActive(plan.id, !plan.isActive, state.ownerId)
              .then(() => load()),
        },
      ],
    );
  };

  return (
    <OperationalShell active="more" title={t('membershipPlans')} subtitle={t('plansSubtitle')}>
      <View style={styles.topRow}>
        <LocalDataBadge />
        <AppButton onPress={() => router.push('/plan/new' as Href)}>{t('newPlan')}</AppButton>
      </View>
      {error ? <Notice danger>{t('plansLoadFailed')}</Notice> : null}
      {loading && !plans.length ? (
        <LoadingState label={t('loading')} />
      ) : !plans.length ? (
        <SurfaceCard style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('noPlansTitle')}</Text>
          <Text style={styles.emptyText}>{t('noPlansMessage')}</Text>
          <AppButton onPress={() => router.push('/plan/new' as Href)}>
            {t('createFirstPlan')}
          </AppButton>
        </SurfaceCard>
      ) : (
        plans.map((plan) => (
          <SurfaceCard key={plan.id} style={[styles.planCard, { borderLeftColor: plan.colorHex }]}>
            <View style={styles.planHeader}>
              <View style={styles.planTitleBlock}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDuration}>
                  {t('planDurationSummary', {
                    count: plan.durationValue,
                    unit: t(DURATION_LABELS[plan.durationUnit]),
                  })}
                </Text>
              </View>
              <StatusChip
                label={plan.isActive ? t('active') : t('inactive')}
                tone={plan.isActive ? 'active' : 'neutral'}
              />
            </View>
            <Text style={styles.price}>
              {formatMoneyMinor(plan.priceMinor, {
                language: settings?.language ?? 'en',
                currencyCode: plan.currencyCode,
              })}
            </Text>
            {plan.description ? <Text style={styles.description}>{plan.description}</Text> : null}
            <View style={styles.planActions}>
              <AppButton
                onPress={() => router.push(`/plan/${plan.id}` as Href)}
                variant="secondary"
              >
                {t('edit')}
              </AppButton>
              <AppButton
                onPress={() => toggle(plan)}
                variant={plan.isActive ? 'danger' : 'secondary'}
              >
                {plan.isActive ? t('deactivate') : t('activate')}
              </AppButton>
            </View>
          </SurfaceCard>
        ))
      )}
      <Notice>{t('planSnapshotNotice')}</Notice>
    </OperationalShell>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  planCard: { gap: spacing.sm, borderLeftWidth: 6 },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planTitleBlock: { minWidth: 0, flex: 1 },
  planName: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  planDuration: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  price: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  description: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  planActions: { flexDirection: 'row', gap: spacing.sm },
});
