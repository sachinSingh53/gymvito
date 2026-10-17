import { router, type Href, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MemberPhotoInput, MemberRecord } from '@/data/repositories/phase2-repository';
import type { MembershipDirectoryItem } from '@/data/repositories/phase3-repository';
import type { MemberFinanceSummary } from '@/data/repositories/phase4-repository';
import { addDays } from '@/domain/dates/date-rules';
import { MemberCard } from '@/features/members/member-card';
import { MemberProfilePanel } from '@/features/members/member-profile-panel';
import { useLocalBusinessDate } from '@/features/memberships/use-local-business-date';
import { useAppSession } from '@/features/session/app-session-context';
import { AppButton, LoadingState, Notice } from '@/ui/components/core-controls';
import { GlassSurface } from '@/ui/components/glass-surface';
import { MaterialSymbol, OperationalShell, SurfaceCard } from '@/ui/components/operational-shell';
import {
  actionPressed,
  CARD_RADIUS,
  colors,
  fonts,
  GLASS_UI,
  glass,
  radii,
  spacing,
} from '@/ui/theme/tokens';

type Filter =
  'all' | 'active' | 'expiring' | 'overdue' | 'expired' | 'upcoming' | 'no-membership' | 'archived';
const FILTERS: readonly Filter[] = [
  'all',
  'active',
  'expiring',
  'overdue',
  'expired',
  'upcoming',
  'no-membership',
  'archived',
];
const FILTER_ICONS: Partial<Record<Filter, { name: string; color: string }>> = {
  expiring: { name: 'history_toggle_off', color: colors.warningText },
  overdue: { name: 'priority_high', color: colors.danger },
};
const EXPIRING_WINDOW_DAYS = 30;
const FILTER_LABELS = {
  all: 'memberFilterAll',
  active: 'memberFilterActive',
  expiring: 'memberFilterExpiring',
  overdue: 'memberFilterOverdue',
  upcoming: 'memberFilterUpcoming',
  expired: 'memberFilterExpired',
  'no-membership': 'memberFilterNoMembership',
  archived: 'memberFilterArchived',
} as const;

export default function MembersRoute() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const { width } = useWindowDimensions();
  const splitView = width >= 960;
  const { state, getPhase2Repository, getPhase3Repository, getPhase4Repository } = useAppSession();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const requestedFilter = FILTERS.includes(params.filter as Filter)
    ? (params.filter as Filter)
    : 'all';
  const [filter, setFilter] = useState<Filter>(requestedFilter);
  const today = useLocalBusinessDate(
    state.status === 'unlocked' ? state.deviceLocale.timeZone : 'UTC',
  );
  const [members, setMembers] = useState<readonly MembershipDirectoryItem[]>([]);
  const [financeByMember, setFinanceByMember] = useState<ReadonlyMap<string, MemberFinanceSummary>>(
    new Map(),
  );
  const [photoByMember, setPhotoByMember] = useState<ReadonlyMap<string, MemberPhotoInput>>(
    new Map(),
  );
  const [counts, setCounts] = useState({
    all: 0,
    active: 0,
    expiring: 0,
    overdue: 0,
    upcoming: 0,
    expired: 0,
    'no-membership': 0,
    archived: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<MemberRecord | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    void refreshKey;
    let active = true;
    setLoading(true);
    setError(false);
    const repository = getPhase2Repository();
    const archiveFilter = filter === 'archived' ? 'archived' : filter === 'all' ? 'all' : 'active';
    void Promise.all([
      getPhase3Repository().listMembers(today, query, archiveFilter),
      repository.memberCounts(),
      getPhase3Repository().dashboardCounts(today),
      getPhase4Repository().listOutstandingInvoices(today),
    ])
      .then(async ([rows, memberCounts, statusCounts, outstanding]) => {
        const overdueMembers = new Set(
          outstanding
            .filter((invoice) => invoice.dueStatus === 'overdue')
            .map((invoice) => invoice.memberId),
        );
        const expiryEnd = addDays(today, EXPIRING_WINDOW_DAYS);
        const filteredRows =
          filter === 'all' || filter === 'archived'
            ? rows
            : filter === 'overdue'
              ? rows.filter((member) => overdueMembers.has(member.id))
              : filter === 'expiring'
                ? rows.filter(
                    (member) =>
                      member.status === 'active' &&
                      !!member.current &&
                      member.current.endDate >= today &&
                      member.current.endDate <= expiryEnd,
                  )
                : rows.filter((member) => member.status === filter);
        const memberIds = filteredRows.map((member) => member.id);
        const [finance, photos] = await Promise.all([
          getPhase4Repository().listMemberFinanceSummaries(memberIds, today),
          repository.listMemberPhotos(
            filteredRows.filter((member) => member.hasPhoto).map((member) => member.id),
          ),
        ]);
        if (!active) return;
        setMembers(filteredRows);
        setFinanceByMember(finance);
        setPhotoByMember(photos);
        setCounts({
          all: memberCounts.total,
          active: statusCounts.active,
          expiring: statusCounts.expiringSoon,
          overdue: overdueMembers.size,
          upcoming: statusCounts.upcoming,
          expired: statusCounts.expired,
          'no-membership': statusCounts.noMembership,
          archived: statusCounts.archived,
        });
        if (splitView && !filteredRows.some((member) => member.id === selectedId)) {
          setSelectedId(filteredRows[0]?.id ?? null);
          if (!filteredRows.length) setSelected(null);
        }
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [
    filter,
    getPhase2Repository,
    getPhase3Repository,
    getPhase4Repository,
    query,
    refreshKey,
    selectedId,
    splitView,
    today,
  ]);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(load, 120);
      return () => clearTimeout(timer);
    }, [load]),
  );

  useEffect(() => {
    if (!selectedId || !splitView) return;
    let active = true;
    void getPhase2Repository()
      .getMember(selectedId)
      .then((member) => active && setSelected(member));
    return () => {
      active = false;
    };
  }, [getPhase2Repository, refreshKey, selectedId, splitView]);

  if (state.status !== 'unlocked') return null;
  const regionalSettings = {
    language: state.snapshot.settings?.language ?? 'en',
    currencyCode: state.snapshot.settings?.currencyCode ?? 'INR',
    dateFormat: state.snapshot.settings?.dateFormat ?? ('day-month-year' as const),
  };
  const openMember = (member: MembershipDirectoryItem) => {
    if (splitView) setSelectedId(member.id);
    else router.push(`/member/${member.id}` as Href);
  };

  const toolbar = (
    <>
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBox,
            GLASS_UI && styles.glassSearchBox,
            GLASS_UI && searchFocused && styles.glassSearchBoxFocused,
          ]}
        >
          <MaterialSymbol
            color={GLASS_UI ? colors.textMuted : colors.outline}
            name="search"
            size={22}
          />
          <TextInput
            accessibilityLabel={t('searchMembers')}
            onBlur={() => setSearchFocused(false)}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            placeholder={t('memberSearchPlaceholder')}
            placeholderTextColor={GLASS_UI ? colors.textMuted : colors.outline}
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable
              accessibilityLabel={t('clearSearch')}
              onPress={() => setQuery('')}
              style={styles.clear}
            >
              <Text style={[styles.clearText, GLASS_UI && styles.glassClearText]}>×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.filterRow}
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
      >
        {FILTERS.map((value) => {
          const icon = FILTER_ICONS[value];
          const isSelected = filter === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              key={value}
              onPress={() => setFilter(value)}
              style={({ pressed }) =>
                GLASS_UI
                  ? [
                      styles.filterChip,
                      styles.glassFilterChip,
                      isSelected && styles.glassFilterChipSelected,
                      pressed && actionPressed,
                    ]
                  : [styles.filterChip, isSelected && styles.filterChipSelected]
              }
            >
              {icon ? (
                <MaterialSymbol
                  color={isSelected ? colors.onPrimary : icon.color}
                  name={icon.name}
                  size={16}
                />
              ) : null}
              <Text
                style={[
                  styles.filterText,
                  GLASS_UI && styles.glassFilterText,
                  isSelected && styles.filterTextSelected,
                ]}
              >
                {t(FILTER_LABELS[value])}
              </Text>
              <Text
                style={[
                  styles.filterCount,
                  GLASS_UI && styles.glassFilterCount,
                  isSelected && styles.filterCountSelected,
                ]}
              >
                {counts[value]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.directoryMeta}>
        <View style={styles.rosterState}>
          <Text numberOfLines={1} style={styles.resultCount}>
            {t('showingMembers', {
              shown: members.length,
              total: counts[filter],
            })}
          </Text>
          <View style={styles.localDot} />
          <Text
            numberOfLines={1}
            style={[styles.localStateText, GLASS_UI && styles.glassLocalStateText]}
          >
            {t('offlineCached')}
          </Text>
        </View>
        <View accessibilityLabel={t('sortedByRecent')} style={styles.sortState}>
          <MaterialSymbol color={colors.primaryDark} name="swap_vert" size={18} />
          <Text style={styles.sortText}>{t('recent')}</Text>
        </View>
      </View>
    </>
  );

  const directory = (
    <View style={styles.directoryPane}>
      {GLASS_UI ? (
        <GlassSurface radius={CARD_RADIUS} style={styles.glassToolbar}>
          {toolbar}
        </GlassSurface>
      ) : (
        toolbar
      )}
      {error ? <Notice danger>{t('membersLoadFailed')}</Notice> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={members}
        keyExtractor={(member) => member.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <LoadingState label={t('loading')} />
          ) : (
            <SurfaceCard style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {query ? t('noMembersFound') : t('noMembersTitle')}
              </Text>
              <Text style={styles.emptyText}>
                {query ? t('noMembersSearchMessage') : t('noMembersMessage')}
              </Text>
              <AppButton onPress={() => router.push('/member/new' as Href)}>
                {t('addMember')}
              </AppButton>
              <AppButton disabled onPress={() => undefined} variant="secondary">
                {t('importAvailablePhase7')}
              </AppButton>
            </SurfaceCard>
          )
        }
        renderItem={({ item }) => (
          <MemberCard
            finance={financeByMember.get(item.id)}
            member={item}
            onPress={() => openMember(item)}
            photo={photoByMember.get(item.id)}
            regionalSettings={regionalSettings}
            selected={splitView && selectedId === item.id}
            today={today}
          />
        )}
      />
      <Pressable
        accessibilityLabel={t('addMember')}
        accessibilityRole="button"
        onPress={() => router.push('/member/new' as Href)}
        style={({ pressed }) =>
          GLASS_UI
            ? [styles.floatingAdd, styles.glassFloatingAdd, pressed && actionPressed]
            : styles.floatingAdd
        }
      >
        <MaterialSymbol color={colors.onPrimary} name="person_add" size={22} />
        <Text style={styles.floatingAddText}>+ {t('member')}</Text>
      </Pressable>
    </View>
  );

  return (
    <OperationalShell
      active="members"
      contentStyle={styles.shellContent}
      headerAction={
        <View accessibilityLabel={t('offlineCached')} style={styles.headerLocalState}>
          <MaterialSymbol color={colors.primary} name="cloud_done" size={22} />
        </View>
      }
      scroll={false}
      title={t('members')}
      subtitle={t('memberLedger')}
    >
      {splitView ? (
        <View style={styles.splitPane}>
          {directory}
          <View style={styles.detailPane}>
            {selected ? (
              <FlatList
                data={[selected]}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <MemberProfilePanel
                    compact
                    member={item}
                    onChanged={() => setRefreshKey((key) => key + 1)}
                  />
                )}
              />
            ) : (
              <SurfaceCard style={styles.detailEmpty}>
                <Text style={styles.emptyTitle}>{t('selectMember')}</Text>
                <Text style={styles.emptyText}>{t('selectMemberMessage')}</Text>
              </SurfaceCard>
            )}
          </View>
        </View>
      ) : (
        directory
      )}
    </OperationalShell>
  );
}

const styles = StyleSheet.create({
  shellContent: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  splitPane: { flex: 1, flexDirection: 'row', gap: spacing.md },
  directoryPane: { minWidth: 0, flex: 1, gap: spacing.sm },
  detailPane: { minWidth: 0, flex: 1.45 },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchBox: {
    minHeight: 52,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: colors.brandHeader,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchInput: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  clear: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  clearText: { color: colors.outline, fontSize: 22 },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingVertical: 2,
    paddingRight: spacing.md,
  },
  filterChip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  filterChipSelected: { backgroundColor: colors.primaryDark },
  filterText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
  filterTextSelected: { color: colors.onPrimary },
  filterCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  filterCountSelected: {
    color: colors.onPrimary,
    backgroundColor: glass.fillOnPrimary,
  },
  directoryMeta: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rosterState: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultCount: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
  localDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  localStateText: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.outline,
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 14,
  },
  sortState: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  sortText: { color: colors.primaryDark, fontFamily: fonts.semibold, fontSize: 12 },
  list: { gap: 12, paddingBottom: 86 },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.xl,
  },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, textAlign: 'center' },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  floatingAdd: {
    position: 'absolute',
    right: 0,
    bottom: spacing.md,
    minHeight: 56,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryDark,
    shadowColor: colors.brandHeader,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  floatingAddText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 15 },
  headerLocalState: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailEmpty: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 300 },
  glassToolbar: { gap: spacing.sm, padding: 12 },
  glassSearchBox: {
    borderWidth: 1,
    borderColor: glass.rimAccent,
    borderRadius: radii.pill,
    backgroundColor: glass.fillOpaque,
    shadowOpacity: 0,
    elevation: 0,
  },
  glassSearchBoxFocused: { borderWidth: 2, borderColor: colors.focus, paddingHorizontal: 11 },
  glassClearText: { color: colors.textMuted },
  glassFilterChip: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: glass.rimAccent,
    backgroundColor: glass.fillAccent,
  },
  glassFilterChipSelected: { borderColor: colors.primaryDark, backgroundColor: colors.primary },
  glassFilterText: { color: colors.text },
  glassFilterCount: { overflow: 'hidden', backgroundColor: glass.fillOpaque },
  glassLocalStateText: { color: colors.textMuted },
  glassFloatingAdd: { backgroundColor: colors.primary },
});
