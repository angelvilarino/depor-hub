import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { useSquad } from '@/data/queries';
import type { ClubT } from '@/data/schemas';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { MutedText, SectionTitle } from './ui';

export function JuntaSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const squad = useSquad();
  const coach = squad.data?.coach?.name ?? null;
  const board = club.board;

  if (!board && !coach) {
    return squad.isPending ? <LoadingState /> : <EmptyState message={t('club.junta.empty')} />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      {coach ? (
        <Card>
          <SectionTitle>{t('club.junta.coach')}</SectionTitle>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('club.junta.openCoach', { name: coach })}
            onPress={() => router.push('/coach')}
            style={styles.person}
          >
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', flex: 1 }}>
              {coach}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </Card>
      ) : null}

      {board ? (
        <Card>
          <SectionTitle>{t('club.junta.title')}</SectionTitle>
          {board.president ? (
            <View style={{ gap: 2 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                {t('club.junta.president')}
              </Text>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
                {board.president}
              </Text>
            </View>
          ) : null}
          {board.members.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                {t('club.junta.members')}
              </Text>
              {board.members.map((member) => (
                <View key={`${member.name}-${member.role ?? ''}`} style={styles.member}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                    {member.name}
                  </Text>
                  {member.role ? (
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{member.role}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          {board.sportingDirector ? (
            <View style={{ gap: 2 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                {t('club.junta.sportingDirector')}
              </Text>
              <Text style={{ color: colors.text, fontSize: 15 }}>{board.sportingDirector}</Text>
            </View>
          ) : null}
          {board.note ? <MutedText>{board.note}</MutedText> : null}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  person: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
  member: { gap: 2 },
});
