import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ClubImage } from '@/components/club/ClubImage';
import { EmptyState } from '@/components/StateViews';
import type { ClubT, KitT, SeasonKitsT } from '@/data/schemas';
import { decadeLabel, groupSeasonsByDecade, kitTypeKey } from '@/features/club/logic';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type DecadeSection = { title: string; decade: number; data: SeasonKitsT[] };

function KitRow({ season, kit }: { season: string; kit: KitT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const type = t(kitTypeKey(kit.type));
  const details = [kit.manufacturer, kit.chestSponsor].filter(Boolean).join(' · ');
  const extraSponsors = [
    kit.sleeveSponsor ? t('club.equipaciones.sleeveSponsorValue', { name: kit.sleeveSponsor }) : null,
    kit.backSponsor ? t('club.equipaciones.backSponsorValue', { name: kit.backSponsor }) : null,
  ].filter(Boolean);
  const colorsText = kit.colors.length > 0 ? kit.colors.join(' / ') : null;

  return (
    <View style={styles.kitRow}>
      <ClubImage
        path={kit.image}
        label={`${season} · ${type}`}
        width={78}
        height={98}
        placeholderLabel={t('club.noImage')}
        testID={`kit-${season}-${kit.type}`}
      />
      <View style={styles.kitText}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{type}</Text>
        {details ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>{details}</Text> : null}
        {extraSponsors.map((line) => (
          <Text key={line} style={{ color: colors.textMuted, fontSize: 13 }}>
            {line}
          </Text>
        ))}
        {colorsText ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {t('club.equipaciones.colorsValue', { colors: colorsText })}
          </Text>
        ) : null}
        {kit.description ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{kit.description}</Text>
        ) : null}
      </View>
    </View>
  );
}

function SeasonCard({ season }: { season: SeasonKitsT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View
      style={[styles.seasonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.seasonHeader}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{season.season}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {t('club.equipaciones.kitCount', { count: season.kits.length })}
        </Text>
      </View>
      {season.kits.map((kit, index) => (
        <View key={`${season.season}-${kit.type}-${index}`}>
          {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
          <KitRow season={season.season} kit={kit} />
        </View>
      ))}
    </View>
  );
}

export function EquipacionesSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const listRef = useRef<SectionList<SeasonKitsT, DecadeSection>>(null);
  const groups = useMemo(() => groupSeasonsByDecade(club.kits, 'desc'), [club.kits]);
  const sections = useMemo<DecadeSection[]>(
    () =>
      groups.map((group) => ({
        title: decadeLabel(group.decade),
        decade: group.decade,
        data: group.seasons,
      })),
    [groups],
  );
  const [activeDecade, setActiveDecade] = useState<number | null>(
    sections[0]?.decade ?? null,
  );

  if (sections.length === 0) {
    return <EmptyState message={t('club.equipaciones.empty')} />;
  }

  const jumpTo = (decade: number) => {
    const index = sections.findIndex((section) => section.decade === decade);
    if (index < 0) return;
    setActiveDecade(decade);
    try {
      listRef.current?.scrollToLocation({
        sectionIndex: index,
        itemIndex: 0,
        viewOffset: spacing.sm,
        animated: true,
      });
    } catch {
      // En tests o antes del primer layout el scroll puede no estar disponible.
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.selector, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorContent}
        >
          {sections.map((section) => {
            const selected = section.decade === activeDecade;
            return (
              <Pressable
                key={section.decade}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t('club.equipaciones.jump', { decade: section.title })}
                onPress={() => jumpTo(section.decade)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '700' }}>
                  {section.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item) => item.season}
        stickySectionHeadersEnabled={false}
        initialNumToRender={6}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
            {t('club.equipaciones.intro')}
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <Text
            accessibilityRole="header"
            style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: spacing.sm }}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => <SeasonCard season={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  selector: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  selectorContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  seasonCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  seasonHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  kitRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  kitText: { flex: 1, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.sm },
});
