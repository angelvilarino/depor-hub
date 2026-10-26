import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { FreshnessBanner } from '@/components/FreshnessBanner';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PlayerPortrait } from '@/components/PlayerPortrait';
import { BodyText, Card, Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { useSquad } from '@/data/queries';
import type { PlayerT } from '@/data/schemas';
import { countryLabel } from '@/features/squad/labels';
import {
  ageFrom,
  averageAge,
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

function positionAbbreviation(player: PlayerT, t: TFunction): string {
  const group = positionGroup(player.position);
  if (group === 'OTHER') return player.position ?? t('team.filters.OTHER');
  return t(`team.filters.${group}`);
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
        <PlayerPortrait player={player} size={112} quality="large" />
      </View>
      {player.shirtNumber !== null ? (
        <View style={[styles.numberBadge, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.onPrimary, fontSize: 13, fontWeight: '800' }}>
            {player.shirtNumber}
          </Text>
        </View>
      ) : null}
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
        {player.name}
      </Text>
      {details ? (
        <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13 }}>
          {details}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SquadListRow({ player, now }: { player: PlayerT; now: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const age = ageFrom(player.dateOfBirth, now);
  const flag = countryFlag(player.nationality);
  const position = positionAbbreviation(player, t);
  const subtitle = [flag, player.nationality ? countryLabel(t, player.nationality) : null]
    .filter(Boolean)
    .join(' ');

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
      <PlayerPortrait player={player} size={44} quality="small" />
      <View style={styles.listText}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
          {player.name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.listMeta, { color: colors.textMuted }]}>{position}</Text>
      <Text style={[styles.listMeta, { color: colors.textMuted }]}>
        {age !== null ? age : '—'}
      </Text>
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
  const average = averageAge(visible, now);
  const hasFilters = query.trim().length > 0 || filter !== 'ALL';
  const summary =
    average !== null
      ? t('team.summary', { count: visible.length, age: average })
      : t('team.summaryNoAge', { count: visible.length });
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
      {coach?.name ? (
        <Card>
          <View style={styles.coach}>
            <PlayerAvatar id={0} name={coach.name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('team.coach')}</Text>
              <BodyText>
                {coach.nationality
                  ? `${coach.name} · ${countryLabel(t, coach.nationality)}`
                  : coach.name}
              </BodyText>
            </View>
          </View>
        </Card>
      ) : null}

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
        <Text style={{ color: colors.textMuted, fontSize: 14, flex: 1 }}>{summary}</Text>
        <View style={styles.viewToggle}>
          <SegmentedControl<SquadView>
            onChange={setSquadView}
            options={[
              { value: 'grid', label: t('team.view.grid') },
              { value: 'list', label: t('team.view.list') },
            ]}
            value={squadView}
          />
        </View>
      </View>

      <View style={styles.chips}>
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
      </View>

      {squadView === 'list' ? (
        <View style={[styles.listHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.listNumber, { color: colors.textMuted }]}>
            {t('team.listHeader.number')}
          </Text>
          <View style={styles.listPortraitSpacer} />
          <Text style={[styles.listHeaderPlayer, { color: colors.textMuted }]}>
            {t('team.listHeader.player')}
          </Text>
          <Text style={[styles.listMeta, { color: colors.textMuted }]}>
            {t('team.listHeader.position')}
          </Text>
          <Text style={[styles.listMeta, { color: colors.textMuted }]}>
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
  coach: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  viewToggle: { minWidth: 150 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
    minHeight: 220,
    alignItems: 'center',
    gap: spacing.xs,
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
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  listNumber: { width: 36, textAlign: 'center', fontSize: 15, fontWeight: '700' },
  listPortraitSpacer: { width: 44 },
  listText: { flex: 1, gap: 2 },
  listMeta: { width: 40, textAlign: 'center', fontSize: 13, fontWeight: '600' },
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
