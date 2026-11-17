import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useTranslation } from 'react-i18next';
import { Timeline } from '@/components/club/Editorial';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { ClubT, SponsorT } from '@/data/schemas';
import { radius, spacing, text } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';
import { SectionTitle } from './ui';

type SponsorRole = 'principal' | 'technical' | 'official' | 'collaborator' | 'other';

function keyFor(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function SponsorRow({ name, role, detail }: { name: string; role: string; detail?: SponsorT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const url = detail?.url ?? null;
  // D-15: sin logo no hay tarjeta ni monograma; la fila es tipográfica y el
  // enlace, cuando existe, es la única acción.
  const secondary = detail?.note ?? detail?.category ?? null;
  const content = (
    <>
      <View style={styles.rowText}>
        <Text style={{ color: colors.text, ...text.bodyLarge, fontWeight: '700' }}>{name}</Text>
        {secondary ? <Text style={{ color: colors.textMuted, ...text.caption }}>{secondary}</Text> : null}
      </View>
      {url ? <Ionicons name="open-outline" size={18} color={colors.primary} /> : null}
    </>
  );

  return url ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('club.patrocinadores.openSite', { name })}
      onPress={() => void openExternal(url)}
      style={[styles.row, { borderTopColor: colors.border }]}
    >
      {content}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={`${role}: ${name}`} style={[styles.row, { borderTopColor: colors.border }]}>
      {content}
    </View>
  );
}

export function PatrocinadoresSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sponsors = club.sponsors;

  if (!sponsors) return <EmptyState message={t('club.patrocinadores.empty')} />;

  const verifiedDetails = sponsors.details.filter((sponsor) => sponsor.status === 'verified');
  const detailsByName = new Map(verifiedDetails.map((sponsor) => [keyFor(sponsor.name), sponsor]));
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
      const key = keyFor(name);
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
      const detail = [role, sponsor.category, sponsor.note].filter(Boolean).join(' · ');
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
                <Text accessibilityRole="header" style={{ color: colors.textMuted, ...text.caption, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                  {group.label}
                </Text>
                {group.names.map((name) => (
                  <SponsorRow key={`${group.role}-${name}`} name={name} role={group.label} detail={detailsByName.get(keyFor(name))} />
                ))}
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
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
  },
  rowText: { flex: 1, gap: spacing.xs },
});
