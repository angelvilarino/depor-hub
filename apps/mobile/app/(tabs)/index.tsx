import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BodyText, Card, Screen } from '@/components/Screen';
import { FreshnessBanner } from '@/components/FreshnessBanner';
import { DataError } from '@/data/api';
import { useMeta, useStandings } from '@/data/queries';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// Pantalla provisional de H2: demuestra la capa de datos. La Home real llega en H5.
export default function Home() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const meta = useMeta();
  const standings = useStandings();

  const refresh = () => {
    void meta.refetch();
    void standings.refetch();
  };

  return (
    <Screen refreshing={meta.isRefetching || standings.isRefetching} onRefresh={refresh}>
      <FreshnessBanner
        dataUpdatedAt={meta.dataUpdatedAt}
        isFetching={meta.isFetching}
        isError={meta.isError}
      />
      <Card>
        {meta.data ? (
          <>
            <BodyText>{meta.data.team.name}</BodyText>
            <BodyText muted>
              {t('data.seasonLine', {
                season: meta.data.season,
                matchday: standings.data?.matchday ?? '—',
              })}
            </BodyText>
          </>
        ) : meta.isPending ? (
          <BodyText muted>{t('data.loading')}</BodyText>
        ) : (
          <>
            <BodyText>
              {meta.error instanceof DataError && meta.error.kind === 'not_configured'
                ? t('data.notConfigured')
                : t('data.error')}
            </BodyText>
            <Pressable
              accessibilityRole="button"
              onPress={refresh}
              style={[styles.button, { backgroundColor: colors.primary }]}
            >
              <Text style={{ color: colors.onPrimary }}>{t('data.retry')}</Text>
            </Pressable>
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
