import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Pressable } from '@/components/Pressable';
import { SectionHeader as BaseSectionHeader } from '@/components/design/DesignSystem';
import { useTranslation } from 'react-i18next';
import type { MediaRefT } from '@/data/schemas';
import { useReducedMotion } from '@/theme/useReducedMotion';
import { mapUrl, webMapUrl } from '@/features/club/logic';
import { imageTokens, radius, spacing, text, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function HeroHeader({
  title,
  subtitle,
  image,
  icon = 'shield-outline',
  chips = [],
  credit,
  emblem,
}: {
  title: string;
  subtitle?: string | null;
  image?: string | null;
  icon?: IconName;
  chips?: string[];
  credit?: MediaRefT | null;
  emblem?: string | null;
}) {
  const { colors } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const imageUri = imageFailed ? null : image;
  return (
    <View style={[styles.hero, { backgroundColor: colors.primary }]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          onError={() => setImageFailed(true)}
          contentFit="cover"
          transition={160}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <LinearGradient
        colors={[imageTokens.heroFrom, imageTokens.heroTo]}
        style={StyleSheet.absoluteFill}
      />
      {!imageUri ? (
        <Ionicons name={icon} size={92} color={imageTokens.veil} style={styles.heroMark} />
      ) : null}
      {emblem ? (
        <Image source={{ uri: emblem }} contentFit="contain" style={styles.emblem} />
      ) : null}
      <View style={styles.heroCopy}>
        <Text accessibilityRole="header" style={styles.heroTitle}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
        {chips.length > 0 ? (
          <View style={styles.chips}>
            {chips.map((chip) => (
              <View key={chip} style={styles.heroChip}>
                <Text style={styles.heroChipText}>{chip}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {imageUri && credit ? <MediaCredit media={credit} /> : null}
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
}) {
  // D-03: el chrome de Club usa el mismo encabezado que el resto de la app.
  return <BaseSectionHeader title={title} subtitle={subtitle} icon={icon} variant="flat" />;
}

export function StatCounter({
  value,
  label,
  suffix,
  locale,
}: {
  value: number;
  label: string;
  suffix?: string;
  locale?: string;
}) {
  const reduceMotion = useReducedMotion();
  const animated = useMemo(() => new Animated.Value(0), []);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduceMotion) {
      animated.stopAnimation();
      return;
    }
    animated.setValue(0);
    const listener = animated.addListener(({ value: n }) => setShown(Math.round(n)));
    Animated.timing(animated, { toValue: value, duration: 850, useNativeDriver: false }).start();
    return () => {
      animated.removeListener(listener);
      animated.stopAnimation();
    };
  }, [animated, reduceMotion, value]);
  const { colors } = useTheme();
  const displayed = reduceMotion ? value : shown;
  const formatter = new Intl.NumberFormat(locale);
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text
        accessibilityLabel={`${formatter.format(value)}${suffix ?? ''} ${label}`}
        style={{ color: colors.primary, ...text.heading, fontWeight: '900' }}
      >
        {formatter.format(displayed)}
        {suffix ?? ''}
      </Text>
      <Text style={{ color: colors.textMuted, ...text.caption, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export type TimelineEntry = {
  year: string;
  title: string;
  detail?: string | null;
  category?: string;
};
export function Timeline({
  entries,
  filters = false,
}: {
  entries: TimelineEntry[];
  filters?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [category, setCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // D-14: los filtros no ocupan una fila permanente; se despliegan a demanda.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = [
    ...new Set(entries.map((entry) => entry.category).filter((x): x is string => Boolean(x))),
  ];
  const visible = entries.filter((entry) => !category || entry.category === category);
  return (
    <View style={{ gap: spacing.sm }}>
      {filters && categories.length ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('club.timelineFilterOpen')}
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => setFiltersOpen((open) => !open)}
            style={[
              styles.filterToggle,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="funnel-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.text, ...text.body, fontWeight: '700', flex: 1 }}>
              {category ?? t('club.titulos.all')}
            </Text>
            <Text style={{ color: colors.textMuted, ...text.caption }}>
              {t('club.timelineFilterToggle')}
            </Text>
            <Ionicons
              name={filtersOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>
          {filtersOpen ? (
            <View style={styles.chips}>
              {[null, ...categories].map((item) => (
                <Pressable
                  key={item ?? 'all'}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item
                      ? t('club.timelineFilterCategory', { category: item })
                      : t('club.timelineFilterAll')
                  }
                  accessibilityState={{ selected: category === item }}
                  onPress={() => {
                    setCategory(item);
                    setFiltersOpen(false);
                  }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: category === item ? colors.primary : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: category === item ? colors.onPrimary : colors.text }}>
                    {item ?? t('club.titulos.all')}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      {visible.map((entry, index) => {
        const key = `${entry.year}-${entry.title}`;
        const isOpen = expanded === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            onPress={() => setExpanded(isOpen ? null : key)}
            style={styles.timelineRow}
          >
            <View style={styles.timelineAxis}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              {index < visible.length - 1 ? (
                <View style={[styles.line, { backgroundColor: colors.border }]} />
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: spacing.md }}>
              <Text style={{ color: colors.primary, fontWeight: '800', ...text.body }}>
                {entry.year}
              </Text>
              <Text style={{ color: colors.text, ...text.bodyLarge, fontWeight: '700' }}>
                {entry.title}
              </Text>
              {isOpen && entry.detail ? (
                <Text style={{ color: colors.textMuted, lineHeight: 20 }}>{entry.detail}</Text>
              ) : null}
            </View>
            <Ionicons
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export function MediaCredit({ media, inline = false }: { media: MediaRefT; inline?: boolean }) {
  const { t } = useTranslation();
  const label =
    [media.credit, media.author, media.license].filter(Boolean).join(' · ') ||
    media.sourceUrl ||
    media.url;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('club.mediaCredit')}: ${label}`}
      onPress={() =>
        Alert.alert(
          t('club.mediaCredit'),
          label,
          media.sourceUrl
            ? [
                { text: t('common.close'), style: 'cancel' },
                {
                  text: t('club.openSource'),
                  onPress: () => void Linking.openURL(media.sourceUrl!),
                },
              ]
            : [{ text: t('common.close') }],
        )
      }
      style={[styles.credit, inline && styles.inlineCredit]}
    >
      <Ionicons name="information-circle-outline" size={18} color={imageTokens.text} />
      <Text numberOfLines={1} style={styles.creditText}>
        {t('club.mediaCredit')}
      </Text>
    </Pressable>
  );
}

export function PhotoGallery({ photos }: { photos: MediaRefT[] }) {
  const [selected, setSelected] = useState<MediaRefT | null>(null);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const usable = photos.filter((photo) => photo.kind === 'photo');
  if (usable.length === 0) return null;
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {usable.map((photo, index) => (
          <GalleryThumb
            key={`${photo.url}-${index}`}
            photo={photo}
            label={t('club.viewImage', { name: photo.credit ?? photo.author ?? `${index + 1}` })}
            borderColor={colors.border}
            onPress={() => setSelected(photo)}
          />
        ))}
      </ScrollView>
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.galleryBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            testID="club-photo-fullscreen-close"
            onPress={() => setSelected(null)}
            style={StyleSheet.absoluteFill}
          />
          {selected ? (
            <View
              accessibilityViewIsModal
              testID="club-photo-fullscreen-viewer"
              style={{
                width,
                height: height * 0.85,
                justifyContent: 'center',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <ModalPhoto
                key={selected.url}
                photo={selected}
                width={width - spacing.lg * 2}
                height={height * 0.68}
              />
              <MediaCredit media={selected} />
              <Pressable
                accessibilityRole="button"
                testID="club-photo-fullscreen-close-action"
                onPress={() => setSelected(null)}
                style={styles.galleryClose}
              >
                <Ionicons name="close" size={24} color={imageTokens.text} />
                <Text style={{ color: imageTokens.text, fontWeight: '700' }}>
                  {t('common.close')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function GalleryThumb({
  photo,
  label,
  borderColor,
  onPress,
}: {
  photo: MediaRefT;
  label: string;
  borderColor: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.galleryPhoto, { borderColor, backgroundColor: colors.background }]}
    >
      {!failed ? (
        <Image
          source={{ uri: photo.url }}
          onError={() => setFailed(true)}
          contentFit="cover"
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.photoFallback}>
          <Ionicons name="image-outline" size={32} color={imageTokens.text} />
          <Text style={{ color: imageTokens.text, ...text.caption }}>—</Text>
        </View>
      )}
      <MediaCredit media={photo} />
    </Pressable>
  );
}

function ModalPhoto({ photo, width, height }: { photo: MediaRefT; width: number; height: number }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <View style={[styles.modalPhotoFallback, { width, height }]}>
      <Ionicons name="image-outline" size={44} color={imageTokens.text} />
    </View>
  ) : (
    <Image
      source={{ uri: photo.url }}
      onError={() => setFailed(true)}
      contentFit="contain"
      cachePolicy="memory-disk"
      style={{ width, height }}
    />
  );
}

export function ConfidenceBadge({ label, status }: { label: string; status: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return status === 'verified' ? null : (
    <View
      accessibilityLabel={`${label}: ${t(`club.status.${status}`, { defaultValue: status })}`}
      style={[styles.confidence, { borderColor: colors.border }]}
    >
      <Ionicons name="alert-circle-outline" size={14} color={colors.textMuted} />
      <Text style={{ color: colors.textMuted, ...text.caption }}>
        {label} · {t(`club.status.${status}`, { defaultValue: status })}
      </Text>
    </View>
  );
}

export function MapActions({
  latitude,
  longitude,
  label,
}: {
  latitude: number;
  longitude: number;
  label: string;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const open = async () => {
    try {
      await Linking.openURL(mapUrl(latitude, longitude, label, Platform.OS));
    } catch {
      try {
        await Linking.openURL(webMapUrl(latitude, longitude));
      } catch {
        Alert.alert(t('club.mapError'));
      }
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('club.mapActions')}
      onPress={() => void open()}
      style={[styles.mapAction, { backgroundColor: colors.primary }]}
    >
      <Ionicons name="navigate-outline" size={18} color={colors.onPrimary} />
      <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{t('club.mapActions')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 242, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: radius.md },
  heroMark: { position: 'absolute', right: 20, top: 26 },
  heroCopy: { padding: spacing.lg, gap: spacing.xs },
  emblem: { position: 'absolute', top: spacing.md, left: spacing.md, width: 70, height: 70 },
  heroTitle: { color: imageTokens.text, fontFamily: typography.display, ...text.hero },
  heroSubtitle: { color: imageTokens.muted, fontFamily: typography.headline, ...text.bodyLarge },
  chips: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  heroChip: {
    backgroundColor: imageTokens.veil,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  heroChipText: { color: imageTokens.text, ...text.caption, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stat: {
    minWidth: 94,
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  filterToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timelineRow: { minHeight: 44, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  timelineAxis: { width: 16, alignItems: 'center', alignSelf: 'stretch' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: spacing.xs },
  line: { width: 2, flex: 1, marginTop: spacing.xs },
  credit: {
    position: 'absolute',
    top: 8,
    right: 8,
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: imageTokens.scrim,
    borderRadius: radius.pill,
  },
  creditText: { color: imageTokens.text, ...text.caption },
  inlineCredit: {
    position: 'relative',
    top: 0,
    right: 0,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  galleryPhoto: {
    width: 228,
    height: 156,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  photoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  modalPhotoFallback: { alignItems: 'center', justifyContent: 'center' },
  galleryBackdrop: {
    flex: 1,
    backgroundColor: imageTokens.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryClose: {
    minWidth: 44,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  confidence: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  mapAction: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
