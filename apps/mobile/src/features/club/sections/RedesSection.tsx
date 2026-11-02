import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { ClubLinksT, ClubT } from '@/data/schemas';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';
import { InfoRow, SectionTitle } from './ui';

type LinkKey = Exclude<keyof ClubLinksT, 'others'>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const LINKS: { key: LinkKey; label: string; icon: IconName }[] = [
  { key: 'website', label: 'club.redes.website', icon: 'globe-outline' },
  { key: 'app', label: 'club.redes.app', icon: 'phone-portrait-outline' },
  { key: 'x', label: 'X', icon: 'logo-twitter' },
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
  { key: 'tiktok', label: 'TikTok', icon: 'logo-tiktok' },
  { key: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook' },
  { key: 'twitch', label: 'Twitch', icon: 'logo-twitch' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { key: 'store', label: 'club.redes.store', icon: 'cart-outline' },
  { key: 'tickets', label: 'club.redes.tickets', icon: 'ticket-outline' },
  { key: 'museum', label: 'club.redes.museum', icon: 'business-outline' },
];

function LinkRow({
  label,
  url,
  icon,
}: {
  label: string;
  url: string;
  icon: IconName;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void openExternal(url)}
      style={styles.row}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600', flex: 1 }}>
        {label}
      </Text>
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
            return <LinkRow key={item.key} label={label} url={url} icon={item.icon} />;
          })}
        </Card>
      ) : null}

      {links.others.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.redes.other')}</SectionTitle>
          {links.others.map((link) => (
            <LinkRow key={link.id} label={link.label} url={link.url} icon="link-outline" />
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
              <Ionicons name="mail-outline" size={20} color={colors.primary} />
              <Text selectable style={{ color: colors.primary, fontSize: 16, flex: 1 }}>
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
              <Ionicons name="call-outline" size={20} color={colors.primary} />
              <Text selectable style={{ color: colors.primary, fontSize: 16, flex: 1 }}>
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
});
