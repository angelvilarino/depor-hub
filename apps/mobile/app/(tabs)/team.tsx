import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { CoachPortrait } from '@/components/CoachPortrait';
import { FreshnessBanner } from '@/components/FreshnessBanner';
import { PlayerPortrait } from '@/components/PlayerPortrait';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { useSquad } from '@/data/queries';
import type { CoachT, PlayerT } from '@/data/schemas';
import { countryLabel } from '@/features/squad/labels';
import {
  ageFrom,
  countryFlag,
  filterSquad,
  positionGroup,
  squadCounts,
  type PositionGroup,
} from '@/features/squad/logic';
import { useSettings, type SquadView } from '@/store/settings';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Filter = PositionGroup | 'ALL';
const FILTERS: Filter[] = ['ALL', 'GK', 'DF', 'MF', 'FW'];

const VIEWS: { value: SquadView; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'grid', icon: 'grid-outline' },
  { value: 'list', icon: 'list-outline' },
];

function positionAbbreviation(player: PlayerT, t: TFunction): string {
  const group = positionGroup(player.position);
  if (group === 'OTHER') return player.position ?? t('team.filters.OTHER');
  return t(`team.filters.${group}`);
}

function LoanChip() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.loanChip, { borderColor: colors.primary }]}>
      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
        {t('team.loaned')}
      </Text>
    </View>
  );
}

function SquadCard({ player, now }: { player: PlayerT; now: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const age = ageFrom(player.dateOfBirth, now);
  const flag = countryFlag(player.nationality);
  const position = positionAbbreviation(player, t);
  const details = [flag, position, age !== null ? String(age) : null].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[player.name, position, age !== null ? t('player.ageValue', { n: age }) : null]
        .filter(Boolean)
        .join('. ')}
      onPress={() => router.push(`/player/${player.id}`)}
      style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.portraitWrap}>
        <PlayerPortrait player={player} size={88} quality="large" />
      </View>
      {player.shirtNumber !== null ? (
        <View style={[styles.numberBadge, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '800' }}>
            {player.shirtNumber}
          </Text>
        </View>
      ) : null}
      <Text
        numberOfLines={2}
        style={{ color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' }}
      >
        {player.name}
      </Text>
      {details ? (
        <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>
          {details}
        </Text>
      ) : null}
      {player.loanTo ? <LoanChip /> : null}
    </Pressable>
  );
}

function SquadListRow({ player, now }: { player: PlayerT; now: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const age = ageFrom(player.dateOfBirth, now);
  const flag = countryFlag(player.nationality);
  const position = positionAbbreviation(player, t);
  const subtitle = [
    position,
    flag,
    player.nationality ? countryLabel(t, player.nationality) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[player.name, position, age !== null ? t('player.ageValue', { n: age }) : null]
        .filter(Boolean)
        .join('. ')}
      onPress={() => router.push(`/player/${player.id}`)}
      style={[styles.listRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.listNumber, { color: colors.textMuted }]}>
        {player.shirtNumber ?? '—'}
      </Text>
      <PlayerPortrait player={player} size={40} quality="small" />
      <View style={styles.listText}>
        <Text numberOfLines={2} style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
          {player.name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: 12 }}>
            {subtitle}
          </Text>
        ) : null}
        {player.loanTo ? <LoanChip /> : null}
      </View>
      <Text style={[styles.listAge, { color: colors.textMuted }]}>
        {age !== null ? age : '—'}
      </Text>
    </Pressable>
  );
}

function CoachCard({ coach }: { coach: CoachT | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!coach?.name) return null;
  const flag = countryFlag(coach.nationality);
  const nationality = coach.nationality
    ? [flag, countryLabel(t, coach.nationality)].filter(Boolean).join(' ')
    : null;

  return (
    <Pressable
      accessibilityHint={t('team.openCoach')}
      accessibilityLabel={[coach.name, t('team.coach'), nationality].filter(Boolean).join('. ')}
      accessibilityRole="button"
      onPress={() => router.push('/coach')}
      style={[styles.coachCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <CoachPortrait name={coach.name} photoUrl={coach.photoUrl} size={48} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
          {t('team.coach').toUpperCase()}
        </Text>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{coach.name}</Text>
        {nationality ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{nationality}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function TeamScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const squad = useSquad();
  const squadView = useSettings((state) => state.squadView);
  const setSquadView = useSettings((state) => state.setSquadView);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [now] = useState(() => Date.now()); // fuera del render: regla react-hooks/purity

  const players = useMemo(() => squad.data?.players ?? [], [squad.data]);
  const searched = useMemo(() => filterSquad(players, query, 'ALL'), [players, query]);
  const counts = useMemo(() => squadCounts(searched), [searched]);
  const visible = useMemo(() => filterSquad(players, query, filter), [players, query, filter]);
  const hasFilters = query.trim().length > 0 || filter !== 'ALL';
  const coach = squad.data?.coach ?? null;

  const clearFilters = () => {
    setQuery('');
    setFilter('ALL');
  };

  const header = (
    <View style={styles.header}>
      <FreshnessBanner
        dataUpdatedAt={squad.dataUpdatedAt}
        isFetching={squad.isFetching}
        isError={squad.isError}
      />
      <CoachCard coach={coach} />

      <View
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          accessibilityLabel={t('team.searchPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder={t('team.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.text }]}
          value={query}
        />
        {query ? (
          <Pressable
            accessibilityLabel={t('team.searchClear')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setQuery('')}
            style={styles.iconButton}
          >
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.toolbar}>
        <Text style={{ color: colors.textMuted, fontSize: 14, flex: 1 }}>
          {t('team.summary', { count: visible.length })}
        </Text>
        <View
          style={[styles.viewToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {VIEWS.map(({ value, icon }) => {
            const selected = value === squadView;
            return (
              <Pressable
                key={value}
                accessibilityLabel={t(`team.view.${value}`)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSquadView(value)}
                style={[
                  styles.viewButton,
                  selected ? { backgroundColor: colors.primary } : null,
                ]}
              >
                <Ionicons
                  name={icon}
                  size={20}
                  color={selected ? colors.onPrimary : colors.text}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.chips}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {FILTERS.map((item) => {
          const selected = item === filter;
          const label = t(item === 'ALL' ? 'team.filters.all' : `team.filters.${item}`);
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(item)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.onPrimary : colors.text,
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                {label} {counts[item]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {squadView === 'list' ? (
        <View style={[styles.listHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.listNumber, { color: colors.textMuted }]}>
            {t('team.listHeader.number')}
          </Text>
          <View style={styles.listPortraitSpacer} />
          <Text style={[styles.listHeaderPlayer, { color: colors.textMuted }]}>
            {t('team.listHeader.player')}
          </Text>
          <Text style={[styles.listAge, { color: colors.textMuted }]}>
            {t('team.listHeader.age')}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (!squad.data) {
    return (
      <Screen refreshing={squad.isRefetching} onRefresh={() => void squad.refetch()}>
        <FreshnessBanner
          dataUpdatedAt={squad.dataUpdatedAt}
          isFetching={squad.isFetching}
          isError={squad.isError}
        />
        {squad.isPending ? <LoadingState /> : <ErrorState onRetry={() => void squad.refetch()} />}
      </Screen>
    );
  }

  return (
    <FlatList<PlayerT>
      key={`squad-${squadView}`}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={visible}
      keyExtractor={(player) => String(player.id)}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState
          actionLabel={hasFilters ? t('team.clearFilters') : undefined}
          message={hasFilters ? t('team.emptyFiltered') : t('team.empty')}
          onAction={hasFilters ? clearFilters : undefined}
        />
      }
      numColumns={squadView === 'grid' ? 2 : 1}
      columnWrapperStyle={squadView === 'grid' ? styles.gridRow : undefined}
      ItemSeparatorComponent={
        squadView === 'list' ? () => <View style={{ height: spacing.xs }} /> : undefined
      }
      refreshControl={
        <RefreshControl
          refreshing={squad.isRefetching}
          onRefresh={() => void squad.refetch()}
          tintColor={colors.primary}
        />
      }
      renderItem={({ item }) =>
        squadView === 'grid' ? (
          <SquadCard now={now} player={item} />
        ) : (
          <SquadListRow now={now} player={item} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.md, marginBottom: spacing.md },
  coachCard: {
    minHeight: minTouch + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  search: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, minHeight: minTouch, fontSize: 16, paddingVertical: spacing.sm },
  iconButton: { minHeight: minTouch, minWidth: minTouch, alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
  },
  viewButton: {
    minWidth: minTouch,
    minHeight: minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.md },
  chip: {
    minHeight: minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  gridRow: { justifyContent: 'space-between' },
  gridCard: {
    width: '48%',
    minHeight: 168,
    alignItems: 'center',
    gap: 2,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  portraitWrap: { marginTop: spacing.xs, marginBottom: spacing.xs },
  numberBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 5,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanChip: {
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listRow: {
    minHeight: minTouch + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listNumber: { width: 32, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  listPortraitSpacer: { width: 40 },
  listText: { flex: 1, gap: 1 },
  listAge: { width: 34, textAlign: 'center', fontSize: 13, fontWeight: '600' },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listHeaderPlayer: { flex: 1, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
});
