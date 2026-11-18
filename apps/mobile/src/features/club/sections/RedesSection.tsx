import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { ClubLinksT, ClubT } from '@/data/schemas';
import { linkHandle } from '@/features/club/logic';
import { imageTokens, radius, socialColors, spacing, text, type SocialColor } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';
import { InfoRow, SectionTitle } from './ui';

type LinkKey = Exclude<keyof ClubLinksT, 'others'>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

type LinkItem = {
  key: LinkKey;
  label: string;
  icon: IconName;
  tint?: SocialColor;
  /** Un enlace interno se rotula con su ruta, no con la marca. */
  handle?: boolean;
};

const LINKS: LinkItem[] = [
  { key: 'website', label: 'club.redes.website', icon: 'globe-outline', handle: true },
  { key: 'app', label: 'club.redes.app', icon: 'phone-portrait-outline' },
  { key: 'x', label: 'X', icon: 'logo-x', tint: 'x', handle: true },
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', tint: 'instagram', handle: true },
  { key: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', tint: 'tiktok', handle: true },
  { key: 'youtube', label: 'YouTube', icon: 'logo-youtube', tint: 'youtube', handle: true },
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', tint: 'facebook', handle: true },
  { key: 'twitch', label: 'Twitch', icon: 'logo-twitch', tint: 'twitch', handle: true },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', tint: 'whatsapp', handle: true },
  { key: 'store', label: 'club.redes.store', icon: 'cart-outline' },
  { key: 'tickets', label: 'club.redes.tickets', icon: 'ticket-outline' },
  { key: 'museum', label: 'club.redes.museum', icon: 'business-outline' },
];

function BrandMark({ icon, tint }: { icon: IconName; tint?: SocialColor }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.mark,
        { backgroundColor: tint ? socialColors[tint] : colors.primary, borderColor: colors.border },
      ]}
    >
      <Ionicons name={icon} size={18} color={tint ? imageTokens.text : colors.onPrimary} />
    </View>
  );
}

function LinkRow({
  label,
  url,
  icon,
  tint,
  handle = false,
}: {
  label: string;
  url: string;
  icon: IconName;
  tint?: SocialColor;
  handle?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void openExternal(url)}
      style={styles.row}
    >
      <BrandMark icon={icon} tint={tint} />
      <View style={styles.rowText}>
        <Text style={{ color: colors.text, ...text.bodyLarge, fontWeight: '700' }}>{label}</Text>
        {handle ? (
          <Text numberOfLines={1} style={{ color: colors.textMuted, ...text.caption }}>
            {linkHandle(url)}
          </Text>
        ) : null}
      </View>
      <Ionicons name="open-outline" size={18} color={colors.primary} />
    </Pressable>
  );
}

export function RedesSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const links = club.links;
  const visible = LINKS.filter((item) => Boolean(links[item.key]));
  const contact = club.identity.contact;
  const email = contact.email;
  const phone = contact.phone;
  const hasContact = Boolean(email || phone || contact.address);

  if (visible.length === 0 && links.others.length === 0 && !hasContact) {
    return <EmptyState message={t('club.redes.empty')} />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      {visible.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.redes.title')}</SectionTitle>
          {visible.map((item) => {
            const url = links[item.key];
            if (!url) return null;
            const label = item.label.startsWith('club.') ? t(item.label) : item.label;
            return (
              <LinkRow
                key={item.key}
                label={label}
                url={url}
                icon={item.icon}
                tint={item.tint}
                handle={item.handle}
              />
            );
          })}
        </Card>
      ) : null}

      {links.others.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.redes.other')}</SectionTitle>
          {links.others.map((link) => (
            <LinkRow key={link.id} label={link.label} url={link.url} icon="link-outline" handle />
          ))}
        </Card>
      ) : null}

      {hasContact ? (
        <Card>
          <SectionTitle>{t('club.redes.contact')}</SectionTitle>
          {email ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('club.redes.email')}
              onPress={() => void Linking.openURL(`mailto:${email}`)}
              style={styles.row}
            >
              <BrandMark icon="mail-outline" />
              <Text selectable style={{ color: colors.text, ...text.bodyLarge, flex: 1 }}>
                {email}
              </Text>
            </Pressable>
          ) : null}
          {phone ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('club.redes.phone')}
              onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)}
              style={styles.row}
            >
              <BrandMark icon="call-outline" />
              <Text selectable style={{ color: colors.text, ...text.bodyLarge, flex: 1 }}>
                {phone}
              </Text>
            </Pressable>
          ) : null}
          <InfoRow label={t('club.redes.address')} value={contact.address} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
  rowText: { flex: 1, gap: spacing.xs },
  mark: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
