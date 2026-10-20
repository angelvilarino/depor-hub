import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { freshness } from '@/data/freshness';
import { useOnline } from '@/data/useOnline';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { dataUpdatedAt: number; isFetching: boolean; isError: boolean };

/** Muestra cuándo se sincronizó por última vez y avisa si se están viendo datos guardados sin conexión. */
export function FreshnessBanner({ dataUpdatedAt, isFetching, isError }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const online = useOnline();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!dataUpdatedAt) return null;
  const f = freshness(dataUpdatedAt, now);
  const ago = t(`data.ago_${f.unit}`, { n: f.n });
  const offline = !online || isError;
  const text = offline
    ? t('data.offline', { ago })
    : isFetching
      ? t('data.refreshing', { ago })
      : t('data.updated', { ago });

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={{ color: offline ? colors.danger : colors.textMuted, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
