import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BodyText, Card } from '@/components/Screen';
import { Button } from '@/components/Button';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function LoadingState() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View accessibilityLabel={t('data.loading')} style={{ gap: spacing.sm }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[styles.skeleton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        />
      ))}
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Card>
      <BodyText>{t('data.error')}</BodyText>
      <Button label={t('data.retry')} onPress={onRetry} />
    </Card>
  );
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card>
      <BodyText muted>{message}</BodyText>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  skeleton: { height: 72, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});
