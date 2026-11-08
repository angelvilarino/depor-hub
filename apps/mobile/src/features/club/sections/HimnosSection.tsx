import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/StateViews';
import type { ClubT } from '@/data/schemas';
import { anthemKindKey } from '@/features/club/logic';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function HimnosSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (club.anthems.length === 0) {
    return <EmptyState message={t('club.himnos.empty')} />;
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {club.anthems.map((anthem) => {
        const lyricsAllowed = Boolean(anthem.lyrics && ['licensed', 'public_domain', 'permission_granted'].includes(anthem.lyricsRights?.status ?? 'unknown'));
        const officialVideo = anthem.media?.kind === 'video' && anthem.media.origin === 'club_official' && anthem.media.status === 'verified';
        const meta = [
          t(anthemKindKey(anthem.kind)),
          anthem.year?.toString(),
          anthem.authors.join(', '),
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            key={anthem.id}
            accessibilityRole="button"
            accessibilityLabel={anthem.title}
            onPress={() => router.push(`/club/himno/${anthem.id}`)}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: colors.background }]}>
              <Ionicons name="musical-notes" size={22} color={colors.primary} />
            </View>
            <View style={styles.text}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                {anthem.title}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{meta}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {lyricsAllowed ? t('club.himnos.hasLyrics') : anthem.lyrics && anthem.lyricsRights?.sourceUrl ? t('club.himnos.rightsPending') : t('club.himnos.noLyricsShort')}
              </Text>
            </View>
            {officialVideo ? <Pressable accessibilityRole="button" accessibilityLabel={t('club.himnos.playOfficial')} onPress={(event) => { event.stopPropagation(); void WebBrowser.openBrowserAsync(anthem.media!.url); }} style={styles.play}><Ionicons name="play-circle-outline" size={30} color={colors.primary} /></Pressable> : null}
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  play: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
