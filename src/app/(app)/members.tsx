import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MemberListItem, MemberRecord } from '@/data/repositories/phase2-repository';
import { MemberCard } from '@/features/members/member-card';
import { MemberProfilePanel } from '@/features/members/member-profile-panel';
import { useAppSession } from '@/features/session/app-session-context';
import { AppButton, LoadingState, Notice } from '@/ui/components/core-controls';
import { LocalDataBadge, OperationalShell, SurfaceCard } from '@/ui/components/operational-shell';
import { colors, fonts, radii, spacing } from '@/ui/theme/tokens';

type Filter = 'active' | 'archived' | 'all';
const FILTER_LABELS = {
  active: 'memberFilterActive',
  archived: 'memberFilterArchived',
  all: 'memberFilterAll',
} as const;

export default function MembersRoute() {
  const { width } = useWindowDimensions();
  const tablet = width >= 760;
  const { state, getPhase2Repository } = useAppSession();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [members, setMembers] = useState<readonly MemberListItem[]>([]);
  const [counts, setCounts] = useState({ active: 0, archived: 0, total: 0 });
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
    void Promise.all([repository.listMembers(query, filter), repository.memberCounts()])
      .then(([rows, nextCounts]) => {
        if (!active) return;
        setMembers(rows);
        setCounts(nextCounts);
        if (tablet && !rows.some((member) => member.id === selectedId)) {
          setSelectedId(rows[0]?.id ?? null);
          if (!rows.length) setSelected(null);
        }
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [filter, getPhase2Repository, query, refreshKey, selectedId, tablet]);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(load, 120);
      return () => clearTimeout(timer);
    }, [load]),
  );

  useEffect(() => {
    if (!selectedId || !tablet) return;
    let active = true;
    void getPhase2Repository()
      .getMember(selectedId)
      .then((member) => active && setSelected(member));
    return () => {
      active = false;
    };
  }, [getPhase2Repository, refreshKey, selectedId, tablet]);

  if (state.status !== 'unlocked') return null;
  const openMember = (member: MemberListItem) => {
    if (tablet) setSelectedId(member.id);
    else router.push(`/member/${member.id}` as Href);
  };

  const directory = (
    <View style={styles.directoryPane}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel={t('searchMembers')}
            onChangeText={setQuery}
            placeholder={t('memberSearchPlaceholder')}
            placeholderTextColor={colors.outline}
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable
              accessibilityLabel={t('clearSearch')}
              onPress={() => setQuery('')}
              style={styles.clear}
            >
              <Text style={styles.clearText}>×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.filterRow}>
        {(['all', 'active', 'archived'] as const).map((value) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: filter === value }}
            key={value}
            onPress={() => setFilter(value)}
            style={[styles.filterChip, filter === value && styles.filterChipSelected]}
          >
            <Text style={[styles.filterText, filter === value && styles.filterTextSelected]}>
              {t(FILTER_LABELS[value])}
            </Text>
            <Text style={[styles.filterCount, filter === value && styles.filterTextSelected]}>
              {value === 'all' ? counts.total : counts[value]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.directoryMeta}>
        <Text style={styles.resultCount}>
          {t('showingMembers', {
            shown: members.length,
            total: filter === 'all' ? counts.total : counts[filter],
          })}
        </Text>
        <LocalDataBadge />
      </View>
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
            member={item}
            onPress={() => openMember(item)}
            selected={tablet && selectedId === item.id}
          />
        )}
      />
      <Pressable
        accessibilityLabel={t('addMember')}
        accessibilityRole="button"
        onPress={() => router.push('/member/new' as Href)}
        style={styles.floatingAdd}
      >
        <Text style={styles.floatingAddText}>＋ {t('member')}</Text>
      </Pressable>
    </View>
  );

  return (
    <OperationalShell
      active="members"
      contentStyle={styles.shellContent}
      scroll={false}
      title={t('members')}
      subtitle={t('memberLedger')}
    >
      {tablet ? (
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
  shellContent: { paddingBottom: spacing.sm },
  splitPane: { flex: 1, flexDirection: 'row', gap: spacing.md },
  directoryPane: { minWidth: 0, flex: 1, gap: spacing.sm },
  detailPane: { flex: 1.45 },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchBox: {
    minHeight: 52,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  searchIcon: { color: colors.outline, fontSize: 24 },
  searchInput: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  clear: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  clearText: { color: colors.outline, fontSize: 22 },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  filterChip: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  filterChipSelected: { backgroundColor: colors.primaryDark },
  filterText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12 },
  filterTextSelected: { color: '#ffffff' },
  filterCount: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  directoryMeta: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  resultCount: { flex: 1, color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11 },
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
    right: spacing.md,
    bottom: spacing.md,
    minHeight: 56,
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
  floatingAddText: { color: '#fff', fontFamily: fonts.bold, fontSize: 15 },
  detailEmpty: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 300 },
});
