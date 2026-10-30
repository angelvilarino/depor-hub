import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SHOW_CLUB_CREST_AS_BRAND } from '@/config';
import type { TeamRefT } from '@/data/schemas';
import { minTouch, radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function PosterCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[...colors.poster.stops]}
      locations={[0, 0.56, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.poster, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function PaperCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const paper = colors.paper;
  return (
    <View style={[styles.paper, { backgroundColor: paper.background, borderColor: paper.border }, style]}>
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  variant = 'paper',
  trailing,
}: {
  title: string;
  subtitle?: string;
  variant?: 'poster' | 'paper';
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  const paper = colors.paper;
  const isPoster = variant === 'poster';
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionText}>
        {subtitle ? (
          <Text
            style={{
              color: isPoster ? colors.poster.muted : paper.muted,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              fontFamily: typography.body,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          style={{
            color: isPoster ? colors.poster.text : paper.text,
            fontFamily: typography.headline,
            fontSize: 23,
            lineHeight: 29,
          }}
        >
          {title}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const paper = colors.paper;
  const content = (
    <Text style={{ color: selected ? colors.onPrimary : paper.accent, fontSize: 13, fontWeight: '700' }}>
      {label}
    </Text>
  );
  const style = [
    styles.chip,
    { backgroundColor: selected ? paper.accent : 'transparent', borderColor: paper.accent },
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={style}
    >
      {content}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={accessibilityLabel ?? label} style={style}>
      {content}
    </View>
  );
}

export function StatTile({ label, value }: { label: string; value: string | number }) {
  const { colors } = useTheme();
  const paper = colors.paper;
  return (
    <View style={styles.statTile}>
      <Text style={{ color: paper.muted, fontSize: 12 }}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        maxFontSizeMultiplier={typography.displayMaxFontSizeMultiplier}
        style={{ color: paper.text, fontFamily: typography.numeric, fontSize: 23 }}
      >
        {value}
      </Text>
    </View>
  );
}

export function CrestBadge({ team, size = 52 }: { team: TeamRefT; size?: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = failed ? null : team.crestUrl;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.crestBadge, { width: size, height: size, borderColor: colors.border, backgroundColor: colors.paper.background }]}
    >
      {uri ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="contain"
          onError={() => setFailed(true)}
          recyclingKey={`${team.id}-${size}`}
          source={{ uri }}
          style={{ width: size * 0.82, height: size * 0.82 }}
        />
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: Math.max(10, size * 0.25), fontWeight: '800' }}>
          {(team.tla ?? team.name.slice(0, 3)).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

export function BrandMark({ team }: { team: TeamRefT | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = SHOW_CLUB_CREST_AS_BRAND && !failed ? team?.crestUrl : null;
  return (
    <View style={styles.brand}>
      <View style={[styles.brandMark, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {uri ? (
          <Image
            accessibilityIgnoresInvertColors
            cachePolicy="memory-disk"
            contentFit="contain"
            onError={() => setFailed(true)}
            source={{ uri }}
            style={styles.brandImage}
          />
        ) : (
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '900' }}>DH</Text>
        )}
      </View>
      <View style={styles.brandCopy}>
        <Text style={{ color: colors.text, fontFamily: typography.headline, fontSize: 20 }}>
          Depor Hub
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t('common.unofficial')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    borderRadius: radius.poster,
    padding: spacing.md,
    gap: spacing.md,
    overflow: 'hidden',
    elevation: 4,
  },
  paper: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionText: { flex: 1, gap: 2 },
  chip: { minHeight: minTouch, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  statTile: { gap: 3, minWidth: 68 },
  crestBadge: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill },
  brand: { minHeight: minTouch, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandMark: { width: 38, height: 38, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandImage: { width: 30, height: 30 },
  brandCopy: { flex: 1, gap: 1 },
});
