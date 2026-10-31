import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import type { SocialFeedT, SocialPinT, SocialPlatformT, SocialProfileT } from '@/data/schemas';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<SocialPlatformT, IconName> = {
  x: 'logo-twitter',
  instagram: 'logo-instagram',
  youtube: 'logo-youtube',
  tiktok: 'logo-tiktok',
  facebook: 'logo-facebook',
  whatsapp: 'logo-whatsapp',
  twitch: 'logo-twitch',
  bluesky: 'cloud-outline',
  threads: 'at-outline',
};

function useOpen() {
  const { t } = useTranslation();
  return async (url: string) => {
    const ok = await openExternal(url);
    if (!ok) Alert.alert(t('news.openError'));
  };
}

function ProfileChip({ profile }: { profile: SocialProfileT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const open = useOpen();
  const label = t('news.platforms.' + profile.platform, { defaultValue: profile.platform });
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('news.openProfile', { name: profile.name, platform: label })}
      onPress={() => void open(profile.url)}
      style={[
        styles.profile,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <Ionicons name={ICONS[profile.platform]} size={18} color={colors.primary} />
      <View>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
        {profile.handle ? (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{profile.handle}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function PinCard({ pin }: { pin: SocialPinT }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const open = useOpen();
  const platform = t('news.platforms.' + pin.platform, { defaultValue: pin.platform });
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('news.openPin', { title: pin.title, platform })}
      onPress={() => void open(pin.url)}
      style={styles.pin}
    >
      {pin.imageUrl ? (
        <Image
          source={{ uri: pin.imageUrl }}
          style={[styles.pinImage, { backgroundColor: colors.background }]}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.pinImage, styles.pinPlaceholder, { backgroundColor: colors.background }]}>
          <Ionicons name={ICONS[pin.platform]} size={26} color={colors.primary} />
        </View>
      )}
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={3}>
        {pin.title}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        {[platform, pin.publishedAt
          ? new Intl.DateTimeFormat(i18n.language, {
              day: 'numeric',
              month: 'short',
              timeZone: 'Europe/Madrid',
            }).format(new Date(pin.publishedAt))
          : null]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </Pressable>
  );
}

/** Redes oficiales y publicaciones curadas. Si no hay datos, no se pinta nada. */
export function SocialBlock({ social }: { social: SocialFeedT | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!social || (social.profiles.length === 0 && social.pins.length === 0)) return null;

  return (
    <Card>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
        {t('news.socialTitle')}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('news.socialNote')}</Text>

      {social.profiles.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {social.profiles.map((profile) => (
            <ProfileChip key={profile.id} profile={profile} />
          ))}
        </ScrollView>
      ) : null}

      {social.pins.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
            {t('news.pinsTitle')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {social.pins.map((pin) => (
              <PinCard key={pin.id} pin={pin} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingRight: spacing.md },
  profile: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pin: { width: 190, gap: spacing.xs, minHeight: minTouch },
  pinImage: { width: '100%', height: 106, borderRadius: radius.md },
  pinPlaceholder: { alignItems: 'center', justifyContent: 'center' },
});
