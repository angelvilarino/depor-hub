import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { ClubT } from '@/data/schemas';
import { titleTotal } from '@/features/club/logic';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { SectionTitle, TagList } from './ui';

export function TitulosSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (club.titles.length === 0) {
    return <EmptyState message={t('club.titulos.empty')} />;
  }

  const total = titleTotal(club.titles);

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <SectionTitle>{t('club.titulos.title')}</SectionTitle>
        <Text style={{ color: colors.text, fontSize: 15 }}>
          {t('club.titulos.total', {
            total,
            competitions: club.titles.length,
          })}
        </Text>
      </Card>

      {club.titles.map((title) => {
        const years = [...title.years].sort((a, b) => b - a).map(String);
        return (
          <View
            key={title.competition}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.header}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>
                {title.competition}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {t('club.titulos.count', { count: title.years.length })}
              </Text>
            </View>
            <TagList items={years} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
