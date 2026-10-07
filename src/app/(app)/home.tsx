import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppSession } from '@/features/session/app-session-context';
import { useLocalBusinessDate } from '@/features/memberships/use-local-business-date';
import { AppButton } from '@/ui/components/core-controls';
import {
  LocalDataBadge,
  MaterialSymbol,
  OperationalShell,
  SurfaceCard,
} from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

export default function HomeRoute() {
  const { state, getPhase2Repository, getPhase3Repository, lock } = useAppSession();
  const { t } = useTranslation();
  const today = useLocalBusinessDate(
    state.status === 'unlocked' ? state.deviceLocale.timeZone : 'UTC',
  );
  const [counts, setCounts] = useState({
    active: 0,
    upcoming: 0,
    expired: 0,
    noMembership: 0,
    archived: 0,
    expiringSoon: 0,
  });
  const [planCount, setPlanCount] = useState<number | null>(null);
  const [showSensitive, setShowSensitive] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const repository = getPhase2Repository();
      void Promise.all([
        getPhase3Repository().dashboardCounts(today),
        repository.listPlans(false),
      ]).then(([membershipCounts, plans]) => {
        if (active) {
          setCounts(membershipCounts);
          setPlanCount(plans.length);
        }
      });
      return () => {
        active = false;
      };
    }, [getPhase2Repository, getPhase3Repository, today]),
  );
  if (state.status !== 'unlocked') return null;
  const gym = state.snapshot.gym;

  return (
    <OperationalShell active="home" title={t('dashboard')} subtitle={gym?.name ?? t('appName')}>
      <SurfaceCard style={styles.welcomeCard}>
        <View style={styles.welcomeTop}>
          <View style={styles.welcomeCopy}>
            <Text style={styles.welcome}>{t('welcomeOwner', { name: state.ownerName })}</Text>
            <Text style={styles.gym}>{gym?.name}</Text>
          </View>
          <View style={styles.welcomeActions}>
            <Pressable
              accessibilityLabel={showSensitive ? t('hideAmounts') : t('showAmounts')}
              accessibilityRole="button"
              onPress={() => setShowSensitive((visible) => !visible)}
              style={styles.iconButton}
            >
              <MaterialSymbol
                color={colors.textMuted}
                name={showSensitive ? 'visibility' : 'visibility_off'}
                size={24}
              />
            </Pressable>
            <Pressable
              accessibilityLabel={t('lockNow')}
              accessibilityRole="button"
              onPress={() => void lock('manual')}
              style={styles.iconButton}
            >
              <MaterialSymbol color={colors.textMuted} name="lock" size={24} />
            </Pressable>
          </View>
        </View>
        <View style={styles.localRow}>
          <LocalDataBadge />
          <Text style={styles.device}>{state.deviceLocale.timeZone}</Text>
        </View>
      </SurfaceCard>
      <View style={styles.actionDeck}>
        <CounterAction
          icon="person_add"
          label={t('addMember')}
          onPress={() => router.push('/member/new' as Href)}
          primary
        />
        <CounterAction
          icon="autorenew"
          label={t('plans')}
          onPress={() => router.push('/plans' as Href)}
        />
        <CounterAction
          icon="payments"
          label={t('recordPay')}
          onPress={() => Alert.alert(t('payments'), t('availablePhase4'))}
        />
      </View>
      {planCount === 0 ? (
        <SurfaceCard style={styles.firstPlanCard}>
          <View style={styles.firstPlanCopy}>
            <Text style={styles.firstPlanTitle}>{t('noPlansTitle')}</Text>
            <Text style={styles.firstPlanText}>{t('createFirstPlanPrompt')}</Text>
          </View>
          <AppButton onPress={() => router.push('/plan/new' as Href)}>
            {t('createFirstPlan')}
          </AppButton>
        </SurfaceCard>
      ) : null}
      <Text style={styles.sectionTitle}>{t('operationsSnapshot')}</Text>
      <View style={styles.metricGrid}>
        <MetricCard
          detail={t('expiringSoonCount', { count: counts.expiringSoon })}
          label={t('activeMembers')}
          tone="active"
          value={String(counts.active)}
        />
        <MetricCard
          detail={t('activePlans')}
          label={t('upcomingMembers')}
          tone="neutral"
          value={String(counts.upcoming)}
        />
        <MetricCard
          detail={t('historyPreserved')}
          label={t('expiredMembers')}
          tone="danger"
          value={String(counts.expired)}
        />
        <MetricCard
          detail={t('savedOnDevice')}
          label={t('memberStatusNoMembership')}
          tone="neutral"
          value={String(counts.noMembership)}
        />
      </View>
      <SurfaceCard style={styles.nextPhaseCard}>
        <Text style={styles.nextPhaseTitle}>{t('phase3ComingTitle')}</Text>
        <Text style={styles.nextPhaseText}>{t('phase3ComingMessage')}</Text>
      </SurfaceCard>
    </OperationalShell>
  );
}

function CounterAction({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: string;
  label: string;
  onPress(): void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.counterAction,
        primary && styles.counterActionPrimary,
        pressed && styles.actionPressed,
      ]}
    >
      <MaterialSymbol color={primary ? '#fff' : colors.primaryDark} name={icon} size={21} />
      <Text
        numberOfLines={1}
        style={[styles.counterActionText, primary && styles.counterActionTextPrimary]}
      >
        {primary ? '+ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'active' | 'danger' | 'neutral';
}) {
  return (
    <SurfaceCard style={styles.metricCard}>
      <View style={styles.metricLabelRow}>
        <Text style={styles.metricLabel}>{label}</Text>
        <View
          style={[
            styles.metricDot,
            tone === 'active' && styles.metricDotActive,
            tone === 'danger' && styles.metricDotDanger,
          ]}
        />
      </View>
      <Text style={[styles.metricValue, tone === 'danger' && styles.metricValueDanger]}>
        {value}
      </Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  welcomeCard: { gap: spacing.md },
  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  welcomeCopy: { minWidth: 0, flex: 1 },
  welcome: { color: colors.text, fontFamily: fonts.bold, fontSize: 24 },
  gym: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 15 },
  welcomeActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  localRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  device: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
  },
  actionDeck: { width: '100%', flexDirection: 'row', gap: spacing.sm },
  counterAction: {
    minWidth: 0,
    minHeight: 56,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: '#bec9c5',
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  counterActionPrimary: { borderColor: colors.primary, backgroundColor: colors.primary },
  counterActionText: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  counterActionTextPrimary: { color: '#fff' },
  actionPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  firstPlanCard: {
    gap: spacing.md,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceLow,
  },
  firstPlanCopy: { gap: spacing.xs },
  firstPlanTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  firstPlanText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { minWidth: 150, flex: 1, gap: spacing.xs },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metricLabel: {
    minWidth: 0,
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  metricDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.outline },
  metricDotActive: { backgroundColor: colors.primary },
  metricDotDanger: { backgroundColor: colors.danger },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 30,
    fontVariant: ['tabular-nums'],
  },
  metricValueDanger: { color: colors.danger },
  metricDetail: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  nextPhaseCard: { gap: spacing.xs, backgroundColor: colors.surfaceLow },
  nextPhaseTitle: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 16 },
  nextPhaseText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
});
