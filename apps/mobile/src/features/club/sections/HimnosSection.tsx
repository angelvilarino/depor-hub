import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import { PosterCard } from '@/components/design/DesignSystem';
import type { AnthemT, ClubT } from '@/data/schemas';
import { anthemKindKey } from '@/features/club/logic';
import { radius, spacing, text, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { SectionTitle } from './ui';

function hasOfficialVideo(anthem: AnthemT): boolean {
  return anthem.media?.kind === 'video'
    && anthem.media.origin === 'club_official'
    && anthem.media.status === 'verified';
}

function rightsLabel(anthem: AnthemT, t: (key: string) => string): string {
  const lyricsAllowed = Boolean(
    anthem.lyrics
    && ['licensed', 'public_domain', 'permission_granted'].includes(anthem.lyricsRights?.status ?? 'unknown'),
  );
  if (lyricsAllowed) return t('club.himnos.hasLyrics');
  if (anthem.lyrics && anthem.lyricsRights?.sourceUrl) return t('club.himnos.rightsPending');
  return t('club.himnos.noLyricsShort');
}

export function HimnosSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (club.anthems.length === 0) {
    return <EmptyState message={t('club.himnos.empty')} />;
  }

  // D-16: el himno oficial se presenta como documento editorial; el resto,
  // como índice tipográfico. Sin huecos de reproductor ni tarjetas vacías.
  const featured = club.anthems.find((anthem) => anthem.kind === 'oficial') ?? club.anthems[0]!;
  const rest = club.anthems.filter((anthem) => anthem.id !== featured.id);
  const featuredMeta = [featured.year?.toString(), featured.authors.join(', ')].filter(Boolean).join(' · ');
  const featuredVideo = hasOfficialVideo(featured);

  return (
    <View style={{ gap: spacing.md }}>
      <PosterCard style={styles.featured}>
        <Text style={[styles.eyebrow, { color: colors.poster.accent }]}>{t(anthemKindKey(featured.kind))}</Text>
        <Text accessibilityRole="header" style={[styles.featuredTitle, { color: colors.poster.text }]}>{featured.title}</Text>
        {featuredMeta ? <Text style={[styles.featuredMeta, { color: colors.poster.muted }]}>{featuredMeta}</Text> : null}
        {featured.description ? (
          <Text numberOfLines={3} style={[styles.featuredDescription, { color: colors.poster.muted }]}>{featured.description}</Text>
        ) : null}
        <Text style={[styles.featuredRights, { color: colors.poster.muted }]}>{rightsLabel(featured, t)}</Text>
        <View style={styles.featuredActions}>
          {featuredVideo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('club.himnos.playOfficial')}
              onPress={() => void WebBrowser.openBrowserAsync(featured.media!.url)}
              style={[styles.playButton, { backgroundColor: colors.poster.accent }]}
            >
              <Ionicons name="play" size={16} color={colors.poster.stops[1]} />
              <Text style={[styles.playLabel, { color: colors.poster.stops[1] }]}>{t('club.himnos.playOfficial')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('club.himnos.openDetail')}: ${featured.title}`}
            onPress={() => router.push(`/club/himno/${featured.id}`)}
            style={styles.detailHint}
          >
            <Text style={[styles.detailLabel, { color: colors.poster.accent }]}>{t('club.himnos.openDetail')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.poster.accent} />
          </Pressable>
        </View>
      </PosterCard>

      {rest.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.himnos.other')}</SectionTitle>
          {rest.map((anthem, index) => {
            const meta = [t(anthemKindKey(anthem.kind)), anthem.year?.toString(), anthem.authors.join(', ')]
              .filter(Boolean)
              .join(' · ');
            return (
              <Pressable
                key={anthem.id}
                accessibilityRole="button"
                accessibilityLabel={`${anthem.title} · ${meta}`}
                onPress={() => router.push(`/club/himno/${anthem.id}`)}
                style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              >
                <View style={styles.rowText}>
                  <Text style={{ color: colors.text, ...text.subtitle, fontWeight: '800' }}>{anthem.title}</Text>
                  <Text style={{ color: colors.textMuted, ...text.body }}>{meta}</Text>
                  <Text style={{ color: colors.textMuted, ...text.caption }}>{rightsLabel(anthem, t)}</Text>
                </View>
                {hasOfficialVideo(anthem) ? <Pressable accessibilityRole="button" accessibilityLabel={t('club.himnos.playOfficial')} onPress={(event) => { event.stopPropagation(); void WebBrowser.openBrowserAsync(anthem.media!.url); }} style={styles.playIcon}><Ionicons name="play-circle-outline" size={28} color={colors.primary} /></Pressable> : null}
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  featured: { gap: spacing.sm },
  eyebrow: { ...text.caption, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  featuredTitle: { fontFamily: typography.display, ...text.hero },
  featuredMeta: { ...text.body, fontWeight: '600' },
  featuredDescription: { ...text.body },
  featuredRights: { ...text.caption },
  featuredActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  playButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  playLabel: { ...text.body, fontWeight: '800' },
  detailHint: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  detailLabel: { ...text.body, fontWeight: '700' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  rowText: { flex: 1, gap: spacing.xs },
  playIcon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
