import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CareerTimeline } from '@/components/CareerTimeline';
import { CoachPortrait } from '@/components/CoachPortrait';
import { BodyText, Card, Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { useFixtures, useSquad } from '@/data/queries';
import { countryLabel } from '@/features/squad/labels';
import {
  ageFrom,
  careerByRole,
  coachRecord,
  countryFlag,
  formatPartialDate,
  groupStaff,
} from '@/features/squad/logic';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type CareerRole = 'player' | 'coach';

function SectionTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
      {children}
    </Text>
  );
}

export default function CoachScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const squad = useSquad();
  const fixtures = useFixtures();
  const [now] = useState(() => Date.now()); // fuera del render: regla react-hooks/purity
  const [selectedRole, setSelectedRole] = useState<CareerRole | null>(null);
  const coach = squad.data?.coach ?? null;
  const screenOptions = <Stack.Screen options={{ title: t('coach.title') }} />;

  if (!coach?.name) {
    return (
      <Screen>
        {screenOptions}
        {squad.isPending ? <LoadingState /> : <EmptyState message={t('coach.notFound')} />}
      </Screen>
    );
  }

  const locale = i18n.language;
  const playerCareer = careerByRole(coach.career, 'player');
  const coachCareer = careerByRole(coach.career, 'coach');
  const hasBoth = playerCareer.length > 0 && coachCareer.length > 0;
  const role = selectedRole ?? (coachCareer.length > 0 ? 'coach' : 'player');
  const career = role === 'coach' ? coachCareer : playerCareer;
  const record = coachRecord(fixtures.data, coach.since);
  const staff = coach.staff.filter((member) => member.role !== 'head_coach');
  const staffGroups = groupStaff(staff);
  const flag = countryFlag(coach.nationality);
  const nationality = coach.nationality
    ? [flag, countryLabel(t, coach.nationality)].filter(Boolean).join(' ')
    : null;
  const age = ageFrom(coach.birthDate, now);
  const birth = formatPartialDate(coach.birthDate, locale);
  const since = formatPartialDate(coach.since, locale);
  const contract = formatPartialDate(coach.contractUntil, locale);

  const personal = [
    { key: 'birth', label: t('coach.birth'), value: birth },
    { key: 'birthPlace', label: t('coach.birthPlace'), value: coach.birthPlace },
    { key: 'nationality', label: t('coach.nationality'), value: nationality },
    {
      key: 'age',
      label: t('coach.age'),
      value: age !== null ? t('player.ageValue', { n: age }) : null,
    },
    { key: 'since', label: t('coach.since'), value: since },
    { key: 'contract', label: t('coach.contract'), value: contract },
  ].filter((item) => item.value);

  const recordItems = record
    ? [
        { key: 'played', label: t('coach.record.played'), value: record.played },
        { key: 'won', label: t('coach.record.won'), value: record.won },
        { key: 'drawn', label: t('coach.record.drawn'), value: record.drawn },
        { key: 'lost', label: t('coach.record.lost'), value: record.lost },
        { key: 'goalsFor', label: t('coach.record.goalsFor'), value: record.goalsFor },
        { key: 'goalsAgainst', label: t('coach.record.goalsAgainst'), value: record.goalsAgainst },
        { key: 'points', label: t('coach.record.points'), value: record.points },
      ]
    : [];

  return (
    <Screen>
      {screenOptions}

      <Card>
        <View style={styles.hero}>
          <CoachPortrait name={coach.name} photoUrl={coach.photoUrl} size={96} />
          <View style={styles.heroText}>
            <Text
              accessibilityRole="header"
              style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}
            >
              {coach.name}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('coach.role')}</Text>
            {nationality ? (
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>{nationality}</Text>
            ) : null}
            {since ? (
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                {t('coach.sinceValue', { year: since })}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>

      {personal.length > 0 ? (
        <Card>
          <SectionTitle>{t('coach.personalTitle')}</SectionTitle>
          <View style={styles.personalGrid}>
            {personal.map((item) => (
              <View key={item.key} style={styles.personalItem}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.label}</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {record ? (
        <Card>
          <SectionTitle>{t('coach.recordTitle')}</SectionTitle>
          <View style={styles.recordGrid}>
            {recordItems.map((item) => (
              <View key={item.key} style={styles.recordItem}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
                  {item.value}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
          <BodyText muted>{t('coach.recordNote')}</BodyText>
        </Card>
      ) : null}

      {career.length > 0 ? (
        <Card>
          <SectionTitle>{t('coach.careerTitle')}</SectionTitle>
          {hasBoth ? (
            <SegmentedControl<CareerRole>
              onChange={setSelectedRole}
              options={[
                { value: 'coach', label: t('coach.careerCoach') },
                { value: 'player', label: t('coach.careerPlayer') },
              ]}
              value={role}
            />
          ) : null}
          <CareerTimeline career={career} emptyLabel={t('coach.careerEmpty')} />
        </Card>
      ) : null}

      {staffGroups.length > 0 ? (
        <Card>
          <SectionTitle>{t('coach.staffTitle')}</SectionTitle>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('coach.staffNote')}</Text>
          {staffGroups.map((group) => (
            <View key={group.role} style={styles.staffGroup}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                {t(`coach.staffRole.${group.role}`, { defaultValue: group.role }).toUpperCase()}
              </Text>
              {group.members.map((member, index) => (
                <View key={`${member.name}-${index}`} style={styles.staffRow}>
                  <CoachPortrait name={member.name} photoUrl={member.photoUrl} size={32} />
                  <Text style={{ color: colors.text, fontSize: 15 }}>{member.name}</Text>
                </View>
              ))}
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <View style={styles.sourceRow}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }}>
            {t('coach.sourceNote')}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroText: { flex: 1, gap: 2 },
  personalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  personalItem: { width: '47%', gap: 2 },
  recordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recordItem: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 64,
    alignItems: 'center',
    gap: 1,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  staffGroup: { gap: spacing.xs, marginTop: spacing.sm },
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  sourceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
