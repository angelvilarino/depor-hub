import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CrestBadge, PosterCard, SectionHeader } from '@/components/design/DesignSystem';
import { HeadToHeadBar } from '@/components/rival/HeadToHeadBar';
import { FormChips } from '@/components/home/FormChips';
import type { RivalT } from '@/data/schemas';
import { teamName } from '@/features/calendar/logic';
import type { FormResult, OpponentInfo } from '@/features/home/logic';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function parseForm(value: string | null): FormResult[] {
  if (!value) return [];
  return value.split(/[^WDL]/).filter((part): part is FormResult => part === 'W' || part === 'D' || part === 'L');
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function OpponentCard({ info, rival }: { info: OpponentInfo; rival: RivalT | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const form = info.form.length > 0 ? info.form : parseForm(info.row?.form ?? null);
  const head = rival?.headToHead ?? null;
  const label = [
    t('home.opponent'), teamName(info.opponent),
    info.row ? t('home.rival.position', { position: info.row.position, points: info.row.points }) : null,
    rival?.coach ? `${t('home.rival.coach')}: ${rival.coach}` : null,
    form.map((item) => t(`calendar.outcomeLong.${item}`)).join(', '),
  ].filter(Boolean).join('. ');

  return (
    <PosterCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('home.rival.openProfile')}
        onPress={() => router.push(`/rival/${info.opponent.id}`)}
        style={styles.pressable}
      >
        <SectionHeader title={t('home.opponent')} variant="poster" />
        <View style={styles.teamBlock}>
          <CrestBadge team={info.opponent} size={84} />
          <View style={styles.teamText}>
            <Text adjustsFontSizeToFit style={[styles.teamName, { color: colors.poster.text }]}>
              {teamName(info.opponent)}
            </Text>
            {info.row ? (
              <View style={styles.rankRow}>
                <Text style={[styles.rank, { color: colors.poster.accent }]}>{info.row.position}º</Text>
                <Text style={[styles.points, { color: colors.poster.text }]}>
                  {t('home.rival.points', { points: info.row.points })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {form.length > 0 ? (
          <View style={styles.block}>
            <Text style={[styles.label, { color: colors.poster.muted }]}>{t('home.rival.form')}</Text>
            <FormChips results={form} variant="poster" />
          </View>
        ) : null}

        {rival?.coach ? (
          <View style={[styles.coachCard, { borderColor: colors.poster.muted }]}>
            <View style={[styles.coachInitials, { backgroundColor: colors.poster.text }]}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '900' }}>{initials(rival.coach)}</Text>
            </View>
            <View style={styles.coachText}>
              <Text style={[styles.label, { color: colors.poster.muted }]}>{t('home.rival.coach')}</Text>
              <Text style={[styles.coachName, { color: colors.poster.text }]}>{rival.coach}</Text>
            </View>
          </View>
        ) : null}

        {head ? (
          <View style={styles.block}>
            <Text style={[styles.label, { color: colors.poster.muted }]}>{t('home.rival.headToHead')}</Text>
            <HeadToHeadBar head={head} variant="poster" />
          </View>
        ) : null}

        <Text style={[styles.openLink, { color: colors.poster.accent }]}>
          {t('home.rival.openProfile')} →
        </Text>
      </Pressable>
    </PosterCard>
  );
}

const styles = StyleSheet.create({
  pressable: { gap: spacing.md, minHeight: 44 },
  teamBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  teamText: { flex: 1, minWidth: 0, gap: spacing.xs },
  teamName: { fontFamily: typography.display, fontSize: 30, lineHeight: 34 },
  rankRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  rank: { fontFamily: typography.numeric, fontSize: 32, lineHeight: 36 },
  points: { fontSize: 15, fontWeight: '700' },
  block: { gap: spacing.xs },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  coachCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  coachInitials: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  coachText: { gap: 2 },
  coachName: { fontFamily: typography.headline, fontSize: 17 },
  openLink: { fontSize: 13, fontWeight: '800', alignSelf: 'flex-end' },
});
