import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function Screen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

export function BodyText({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const { colors } = useTheme();
  return <Text style={{ color: muted ? colors.textMuted : colors.text, fontSize: 16 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  card: { padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});
