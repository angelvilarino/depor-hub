import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Timeline } from '@/components/club/Editorial';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { ClubT } from '@/data/schemas';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { SectionTitle } from './ui';

type SponsorRole = 'principal' | 'technical' | 'official' | 'collaborator' | 'other';

function monogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length > 1
    ? words.slice(0, 2).map((word) => Array.from(word)[0] ?? '').join('').toLocaleUpperCase()
    : Array.from(name).slice(0, 2).join('').toLocaleUpperCase();
}

export function PatrocinadoresSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sponsors = club.sponsors;

  if (!sponsors) return <EmptyState message={t('club.patrocinadores.empty')} />;

  const verifiedDetails = sponsors.details.filter((sponsor) => sponsor.status === 'verified');
  const baseNames: Record<SponsorRole, string[]> = {
    principal: sponsors.principal ? [sponsors.principal] : [],
    technical: sponsors.technical ? [sponsors.technical] : [],
    official: sponsors.official,
    collaborator: sponsors.collaborators,
    other: [],
  };
  for (const sponsor of verifiedDetails) {
    baseNames[sponsor.role].push(sponsor.name);
  }

  const categories: { role: SponsorRole; label: string }[] = [
    { role: 'principal', label: t('club.patrocinadores.principal') },
    { role: 'technical', label: t('club.patrocinadores.technical') },
    { role: 'official', label: t('club.patrocinadores.official') },
    { role: 'collaborator', label: t('club.patrocinadores.collaborators') },
    { role: 'other', label: t('club.patrocinadores.other') },
  ];
  const groups = categories.flatMap(({ role, label }) => {
    const seen = new Set<string>();
    const names = baseNames[role].filter((name) => {
      const key = name.trim().toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return names.length ? [{ role, label, names }] : [];
  });
  const hasSponsors = groups.length > 0;
  const timelineEntries = verifiedDetails
    .filter((sponsor) => sponsor.sinceYear !== null || sponsor.untilYear !== null)
    .map((sponsor) => {
      const year = sponsor.sinceYear && sponsor.untilYear
        ? `${sponsor.sinceYear}–${sponsor.untilYear}`
        : sponsor.sinceYear
          ? `${sponsor.sinceYear}–${t('club.present')}`
          : t('club.patrocinadores.until', { year: sponsor.untilYear });
      const role = t(`club.patrocinadores.roles.${sponsor.role}`);
      const detail = [
        role,
        sponsor.category,
        sponsor.note,
      ].filter(Boolean).join(' · ');
      return { year, title: sponsor.name, detail };
    });

  if (!hasSponsors && timelineEntries.length === 0) {
    return <EmptyState message={t('club.patrocinadores.empty')} />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      {hasSponsors ? (
        <Card>
          <SectionTitle>{t('club.patrocinadores.title')}</SectionTitle>
          <View style={styles.groups}>
            {groups.map((group) => (
              <View key={group.role} style={styles.group}>
                <Text accessibilityRole="header" style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                  {group.label}
                </Text>
                <View style={styles.grid}>
                  {group.names.map((name) => {
                    const detail = verifiedDetails.find((sponsor) => sponsor.name === name);
                    return (
                      <View
                        key={name}
                        accessible
                        accessibilityLabel={`${group.label}: ${name}`}
                        style={[styles.tile, { backgroundColor: colors.background, borderColor: colors.border }]}
                      >
                        <View style={[styles.monogram, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                            {monogram(name)}
                          </Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 }}>
                          {name}
                        </Text>
                        {detail?.category ? (
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{detail.category}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {timelineEntries.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.patrocinadores.timeline')}</SectionTitle>
          <Timeline entries={timelineEntries} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing.md },
  group: { gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    maxWidth: '49%',
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  monogram: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
