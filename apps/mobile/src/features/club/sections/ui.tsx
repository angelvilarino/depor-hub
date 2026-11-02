import { StyleSheet, Text, View } from 'react-native';
import { BodyText } from '@/components/Screen';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function SectionTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
      {children}
    </Text>
  );
}

export function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <Text selectable style={{ color: colors.text, fontSize: 15 }}>
        {value}
      </Text>
    </View>
  );
}

export function Tag({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={{ color: colors.text, fontSize: 13 }}>{children}</Text>
    </View>
  );
}

export function TagList({ items }: { items: string[] }) {
  return (
    <View style={styles.tags}>
      {items.map((item) => (
        <Tag key={item}>{item}</Tag>
      ))}
    </View>
  );
}

export function Bullets({ items }: { items: string[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {items.map((item) => (
        <View key={item} style={styles.bullet}>
          <Text style={{ color: colors.primary, fontSize: 15 }}>•</Text>
          <BodyText>{item}</BodyText>
        </View>
      ))}
    </View>
  );
}

export function MutedText({ children }: { children: string }) {
  return <BodyText muted>{children}</BodyText>;
}

const styles = StyleSheet.create({
  infoRow: { gap: 2 },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  bullet: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
