import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { PlayerPortrait, portraitUrl } from '@/components/PlayerPortrait';
import { BodyText, Card, Screen } from '@/components/Screen';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { TeamCrest } from '@/components/TeamCrest';
import { useFixtures, useSquad } from '@/data/queries';
import type { CareerEntryT, PlayerMatchT, PlayerPhotoT, PlayerT } from '@/data/schemas';
import { countryLabel } from '@/features/squad/labels';
import {
  ageFrom,
  careerChronological,
  countryFlag,
  fixtureForMatch,
  formatEuro,
  formatPartialDate,
  matchScore,
  pendingFields,
  positionGroup,
  seasonRange,
  socialLinks,
  summarizeMatches,
  type SocialLink,
} from '@/features/squad/logic';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useReducedMotion } from '@/theme/useReducedMotion';
import { useTheme } from '@/theme/useTheme';

type Stat = { key: string; label: string; value: number | null };

const SOCIAL_ICON: Record<SocialLink['network'], keyof typeof Ionicons.glyphMap> = {
  x: 'logo-x',
  instagram: 'logo-instagram',
  tiktok: 'logo-tiktok',
};

function positionLabel(player: PlayerT, t: TFunction): string | null {
  const group = positionGroup(player.position);
  if (group === 'OTHER') return player.position;
  return t(`player.positionName.${group}`);
}

function resultColor(result: PlayerMatchT['result'], colors: ReturnType<typeof useTheme>['colors']) {
  if (result === 'W') return colors.win;
  if (result === 'D') return colors.draw;
  if (result === 'L') return colors.loss;
  return null;
}

function StatStrip({ values }: { values: Stat[] }) {
  const { colors } = useTheme();
  const present = values.filter((item) => item.value !== null);
  if (present.length === 0) return null;
  return (
    <View
      accessible
      accessibilityLabel={present.map((item) => `${item.label}: ${item.value}`).join('. ')}
      style={[styles.statsStrip, { borderTopColor: colors.border }]}
    >
      {present.map((item) => (
        <View key={item.key} style={styles.stat}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{item.value}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function PhotoModal({
  photo,
  playerName,
  visible,
  onClose,
}: {
  photo: PlayerPhotoT | null;
  playerName: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  // Gesto de bajar para cerrar: solo se activa con un arrastre vertical claro.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 80 || gesture.vy > 1.2) onClose();
        },
      }),
    [onClose],
  );

  if (!photo) return null;

  const author = photo.author && photo.author !== photo.credit ? photo.author : null;

  return (
    <Modal
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      testID="photo-modal"
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessible={false}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.72)' }]}
        />
        <View
          accessibilityLabel={`${t('player.photoTitle')} · ${playerName}`}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={[styles.modalCard, { backgroundColor: colors.surface }]}
          {...pan.panHandlers}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Pressable
            accessibilityLabel={t('player.photoClose')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.modalClose}
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Image
            accessible
            accessibilityLabel={`${playerName} · ${t('player.photoTitle')}`}
            cachePolicy="memory-disk"
            contentFit="contain"
            source={{ uri: portraitUrl(photo.url, 'large') }}
            style={[styles.modalImage, { backgroundColor: colors.background }]}
            transition={reducedMotion ? 0 : 150}
          />
          <View style={styles.attribution}>
            {photo.credit ? (
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{photo.credit}</Text>
            ) : null}
            {author ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {t('player.photoAuthor', { author })}
              </Text>
            ) : null}
            {photo.license ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {t('player.photoLicense', { license: photo.license })}
              </Text>
            ) : null}
            {photo.sourceUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(photo.sourceUrl as string)}
                style={styles.sourceLink}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                  {t('player.photoSource')}
                </Text>
              </Pressable>
            ) : null}
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('player.photoNote')}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SectionToggle({
  title,
  expanded,
  onPress,
  count,
}: {
  title: string;
  expanded: boolean;
  onPress: () => void;
  count?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={styles.sectionToggle}
    >
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>
        {title}
        {count !== undefined ? ` · ${count}` : ''}
      </Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
    </Pressable>
  );
}

function CareerTimeline({ career, t }: { career: CareerEntryT[]; t: TFunction }) {
  const { colors } = useTheme();
  return (
    <View style={styles.timeline}>
      {career.map((entry, index) => {
        const range = seasonRange(entry.from, entry.to);
        const stats = [
          entry.appearances !== null
            ? `${entry.appearances} ${t('player.stats.appearancesShort')}`
            : null,
          entry.goals !== null ? `${entry.goals} ${t('player.stats.goalsShort')}` : null,
          entry.assists !== null ? `${entry.assists} ${t('player.stats.assistsShort')}` : null,
          entry.minutes !== null ? `${entry.minutes} ${t('player.stats.minutesShort')}` : null,
        ].filter(Boolean);
        return (
          <View key={`${entry.club}-${entry.from ?? index}`} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
              {index < career.length - 1 ? (
                <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
              ) : null}
            </View>
            <View style={[styles.timelineBody, index > 0 ? { borderTopColor: colors.border } : null]}>
              <View style={styles.careerHead}>
                {entry.crestUrl ? (
                  <TeamCrest
                    size={24}
                    team={{ name: entry.club, tla: null, crestUrl: entry.crestUrl }}
                  />
                ) : null}
                <Text
                  numberOfLines={2}
                  style={{ color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}
                >
                  {entry.club}
                </Text>
                {range ? (
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{range}</Text>
                ) : null}
              </View>
              {stats.length > 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{stats.join(' · ')}</Text>
              ) : null}
              {entry.seasons.map((season) => {
                const parts = [
                  season.appearances !== null
                    ? `${season.appearances} ${t('player.stats.appearancesShort')}`
                    : null,
                  season.goals !== null ? `${season.goals} ${t('player.stats.goalsShort')}` : null,
                  season.assists !== null ? `${season.assists} ${t('player.stats.assistsShort')}` : null,
                  season.minutes !== null
                    ? `${season.minutes} ${t('player.stats.minutesShort')}`
                    : null,
                ].filter(Boolean);
                return (
                  <Text
                    key={season.season}
                    style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}
                  >
                    {parts.length > 0 ? `${season.season} · ${parts.join(' · ')}` : season.season}
                  </Text>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MatchRow({
  match,
  fixtureId,
  locale,
}: {
  match: PlayerMatchT;
  fixtureId: number | null;
  locale: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const score = matchScore(match);
  const side = match.home ? t('player.matchHome') : t('player.matchAway');
  const result = match.result;
  const color = resultColor(result, colors);
  const date = formatPartialDate(match.date, locale);
  const subtitle = [date, side, match.competition].filter(Boolean).join(' · ');
  const resultLong = result ? t(`calendar.outcomeLong.${result}`) : null;
  const label = [match.opponent, side, score, resultLong].filter(Boolean).join('. ');

  const content = (
    <>
      <TeamCrest
        size={28}
        team={{ name: match.opponent, tla: null, crestUrl: match.opponentCrestUrl }}
      />
      <View style={styles.matchText}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
          {match.opponent}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {score ? (
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{score}</Text>
      ) : null}
      {result && color ? (
        <View
          accessible
          accessibilityLabel={resultLong ?? undefined}
          style={[styles.resultChip, { borderColor: color }]}
        >
          <Text style={{ color, fontSize: 12, fontWeight: '800' }}>
            {t(`calendar.outcome.${result}`)}
          </Text>
        </View>
      ) : null}
      {fixtureId !== null ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </>
  );

  if (fixtureId !== null) {
    return (
      <Pressable
        accessibilityHint={t('player.viewMatch')}
        accessibilityLabel={label}
        accessibilityRole="link"
        onPress={() => router.push(`/match/${fixtureId}`)}
        style={[styles.matchRow, { borderTopColor: colors.border }]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.matchRow, { borderTopColor: colors.border }]}
    >
      {content}
    </View>
  );
}

export default function PlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const squad = useSquad();
  const fixtures = useFixtures();
  const [now] = useState(() => Date.now()); // fuera del render: regla react-hooks/purity
  const [photoOpen, setPhotoOpen] = useState(false);
  const [careerOpen, setCareerOpen] = useState(true);
  const [pendingOpen, setPendingOpen] = useState(false);
  const player = squad.data?.players.find((p) => String(p.id) === id);

  if (!player) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('player.title') }} />
        {squad.isPending ? <LoadingState /> : <EmptyState message={t('player.notFound')} />}
      </Screen>
    );
  }

  const locale = i18n.language;
  const position = positionLabel(player, t);
  const age = ageFrom(player.dateOfBirth, now);
  const birth = formatPartialDate(player.dateOfBirth, locale);
  const flag = countryFlag(player.nationality);
  const height = player.heightCm ?? null; // la caché anterior al ADR 0007 no trae el campo
  const pending = pendingFields(player);
  const career = careerChronological(player.career);
  const totals = player.careerTotals;
  const matches = player.deporMatches;
  const matchSummary = summarizeMatches(matches);
  const social = socialLinks(player.social);
  const marketValue = formatEuro(player.marketValueEur, locale);
  const photo =
    player.photos?.find((item) => item.role === 'portrait') ?? player.photos?.[0] ?? null;

  const totalValues: Stat[] = [
    { key: 'appearances', label: t('player.stats.appearancesShort'), value: totals.appearances },
    { key: 'goals', label: t('player.stats.goalsShort'), value: totals.goals },
    { key: 'minutes', label: t('player.stats.minutesShort'), value: totals.minutes },
    { key: 'yellowCards', label: t('player.stats.yellowCardsShort'), value: totals.yellowCards },
    { key: 'redCards', label: t('player.stats.redCardsShort'), value: totals.redCards },
  ];
  const matchValues: Stat[] = matchSummary
    ? [
        { key: 'appearances', label: t('player.stats.appearancesShort'), value: matchSummary.appearances },
        { key: 'goals', label: t('player.stats.goalsShort'), value: matchSummary.goals },
        { key: 'minutes', label: t('player.stats.minutesShort'), value: matchSummary.minutes },
        { key: 'yellowCards', label: t('player.stats.yellowCardsShort'), value: matchSummary.yellowCards },
        { key: 'redCards', label: t('player.stats.redCardsShort'), value: matchSummary.redCards },
      ]
    : [];
  const hasTotal = totalValues.some((item) => item.value !== null);
  const stats = hasTotal ? totalValues : matchValues;

  const bio = [
    { key: 'position', label: t('player.position'), value: position },
    {
      key: 'nationality',
      label: t('player.nationality'),
      value: player.nationality
        ? [flag, countryLabel(t, player.nationality)].filter(Boolean).join(' ')
        : null,
    },
    { key: 'birth', label: t('player.birth'), value: birth },
    { key: 'birthPlace', label: t('player.birthPlace'), value: player.birthPlace },
    {
      key: 'age',
      label: t('player.age'),
      value: age !== null ? t('player.ageValue', { n: age }) : null,
    },
    {
      key: 'height',
      label: t('player.height'),
      value: height !== null ? t('player.heightValue', { n: height }) : null,
    },
    {
      key: 'weight',
      label: t('player.weight'),
      value: player.weightKg !== null ? t('player.weightValue', { n: player.weightKg }) : null,
    },
    {
      key: 'preferredFoot',
      label: t('player.preferredFoot'),
      value: player.preferredFoot ? t(`player.foot.${player.preferredFoot}`) : null,
    },
    {
      key: 'contract',
      label: t('player.contract'),
      value: formatPartialDate(player.contractUntil, locale),
    },
    { key: 'loanFrom', label: t('player.loanFrom'), value: player.loanFrom },
    { key: 'loanTo', label: t('player.loanTo'), value: player.loanTo },
    {
      key: 'marketValue',
      label: t('player.marketValue'),
      value: marketValue ? `${marketValue} · ${t('player.estimated')}` : null,
    },
  ].filter((item) => item.value);

  const heroMeta = [position, age !== null ? t('player.ageValue', { n: age }) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />

      <Card>
        <View style={styles.hero}>
          {photo ? (
            <Pressable
              accessibilityLabel={t('player.photoOpen')}
              accessibilityRole="button"
              onPress={() => setPhotoOpen(true)}
              style={styles.portraitButton}
            >
              <PlayerPortrait player={player} quality="large" size={88} />
              <View style={[styles.zoomBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="expand" size={12} color={colors.onPrimary} />
              </View>
            </Pressable>
          ) : (
            <PlayerPortrait player={player} quality="large" size={88} />
          )}
          <View style={styles.heroText}>
            <Text
              accessibilityRole="header"
              numberOfLines={2}
              style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}
            >
              {player.name}
            </Text>
            {heroMeta ? (
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>{heroMeta}</Text>
            ) : null}
            {player.nationality ? (
              <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 14 }}>
                {[flag, countryLabel(t, player.nationality)].filter(Boolean).join(' ')}
              </Text>
            ) : null}
          </View>
          {player.shirtNumber !== null ? (
            <Text
              accessibilityLabel={`${t('player.shirtNumber')} ${player.shirtNumber}`}
              style={{ color: colors.primary, fontSize: 30, fontWeight: '800' }}
            >
              {player.shirtNumber}
            </Text>
          ) : null}
        </View>
        <StatStrip values={stats} />
      </Card>

      {bio.length > 0 ? (
        <Card>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {t('player.bioTitle')}
          </Text>
          <View style={styles.bioGrid}>
            {bio.map((item) => (
              <View key={item.key} style={styles.bioItem}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.label}</Text>
                <Text numberOfLines={2} style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {social.length > 0 ? (
        <Card>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {t('player.socialTitle')}
          </Text>
          <View style={styles.socialRow}>
            {social.map((link) => (
              <Pressable
                key={link.network}
                accessibilityLabel={`${t(`player.social.${link.network}`)} @${link.handle}`}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(link.url)}
                style={[styles.socialButton, { borderColor: colors.border }]}
              >
                <Ionicons name={SOCIAL_ICON[link.network]} size={20} color={colors.primary} />
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                  {t(`player.social.${link.network}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      {matches.length > 0 ? (
        <Card>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {t('player.deporMatchesTitle')}
          </Text>
          {matchSummary ? (
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {[
                `${matchSummary.appearances} ${t('player.stats.appearancesShort')}`,
                matchSummary.goals !== null
                  ? `${matchSummary.goals} ${t('player.stats.goalsShort')}`
                  : null,
                matchSummary.minutes !== null
                  ? `${matchSummary.minutes} ${t('player.stats.minutesShort')}`
                  : null,
                matchSummary.yellowCards !== null
                  ? `${matchSummary.yellowCards} ${t('player.stats.yellowCardsShort')}`
                  : null,
                matchSummary.redCards !== null
                  ? `${matchSummary.redCards} ${t('player.stats.redCardsShort')}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
          {matches.map((match) => (
            <MatchRow
              key={`${match.date}-${match.opponent}`}
              fixtureId={fixtureForMatch(match, fixtures.data)?.id ?? null}
              locale={locale}
              match={match}
            />
          ))}
        </Card>
      ) : null}

      {career.length > 0 ? (
        <Card>
          <SectionToggle
            expanded={careerOpen}
            onPress={() => setCareerOpen((open) => !open)}
            title={t('player.careerTitle')}
          />
          {careerOpen ? <CareerTimeline career={career} t={t} /> : null}
        </Card>
      ) : null}

      {pending.length > 0 ? (
        <Card>
          <SectionToggle
            count={pending.length}
            expanded={pendingOpen}
            onPress={() => setPendingOpen((open) => !open)}
            title={t('player.pendingTitle')}
          />
          {pendingOpen ? (
            <>
              <BodyText muted>{t('player.pendingBody')}</BodyText>
              <View style={styles.pendingRow}>
                {pending.map((field) => (
                  <Text
                    key={field}
                    style={[styles.pendingChip, { color: colors.textMuted, borderColor: colors.border }]}
                  >
                    {t(`player.field.${field}`)}
                  </Text>
                ))}
              </View>
            </>
          ) : null}
        </Card>
      ) : null}

      <PhotoModal
        onClose={() => setPhotoOpen(false)}
        photo={photo}
        playerName={player.name}
        visible={photoOpen}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  portraitButton: { width: 88, height: 88 },
  zoomBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 2 },
  statsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: { flexGrow: 1, minWidth: 48, alignItems: 'center', gap: 1 },
  bioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  bioItem: { width: '47%', gap: 2 },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  socialButton: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  matchRow: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  matchText: { flex: 1, gap: 1 },
  resultChip: {
    minWidth: 24,
    minHeight: 24,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  sectionToggle: { minHeight: minTouch, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: spacing.sm },
  timelineRail: { width: 16, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  timelineLine: { flex: 1, width: 2, marginVertical: 2 },
  timelineBody: { flex: 1, gap: 2, paddingBottom: spacing.md, paddingTop: 2 },
  careerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pendingChip: {
    fontSize: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    padding: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  grabber: { position: 'absolute', top: 8, alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  modalClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
    minWidth: minTouch,
    minHeight: minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md, marginTop: spacing.sm },
  attribution: { gap: 2 },
  sourceLink: { minHeight: minTouch, justifyContent: 'center' },
});
