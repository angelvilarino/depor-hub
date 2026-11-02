import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { ClubT } from '@/data/schemas';
import { formatPrice } from '@/features/club/logic';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';
import { InfoRow, MutedText, SectionTitle } from './ui';

export function MuseoSection({ club }: { club: ClubT }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const museum = club.museum;

  if (!museum) return <EmptyState message={t('club.museo.empty')} />;

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <SectionTitle>{museum.name ?? t('club.sections.museo.title')}</SectionTitle>
        {museum.description ? (
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
            {museum.description}
          </Text>
        ) : null}
        <InfoRow label={t('club.museo.location')} value={museum.location} />
        <InfoRow label={t('club.museo.schedule')} value={museum.schedule} />
      </Card>

      {museum.prices.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.museo.prices')}</SectionTitle>
          {museum.prices.map((price) => (
            <View key={price.label} style={{ gap: 2 }}>
              <View style={styles.row}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                  {price.label}
                </Text>
                {price.priceEur !== null ? (
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                    {formatPrice(price.priceEur, i18n.language)}
                  </Text>
                ) : null}
              </View>
              {price.note ? <MutedText>{price.note}</MutedText> : null}
            </View>
          ))}
        </Card>
      ) : null}

      {museum.links.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.museo.links')}</SectionTitle>
          {museum.links.map((link) => (
            <Pressable
              key={link.id}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              onPress={() => void openExternal(link.url)}
              style={styles.link}
            >
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600', flex: 1 }}>
                {link.label}
              </Text>
              <Ionicons name="open-outline" size={18} color={colors.primary} />
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  link: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
});
