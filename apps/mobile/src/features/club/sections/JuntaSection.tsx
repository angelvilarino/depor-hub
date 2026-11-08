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

function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => Array.from(word)[0] ?? '').join('').toLocaleUpperCase();
}

function PersonNode({
  name,
  role,
  onPress,
}: {
  name: string;
  role: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.avatar, { backgroundColor: colors.primary }]}
      >
        <Text style={{ color: colors.onPrimary, fontSize: 14, fontWeight: '800' }}>
          {initialsFor(name)}
        </Text>
      </View>
      <View style={styles.personText}>
        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>{role}</Text>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{name}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${role}: ${name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.personNode, pressed && { opacity: 0.7 }]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View accessible accessibilityLabel={`${role}: ${name}`} style={styles.personNode}>
      {content}
    </View>
  );
}

function Connector() {
  const { colors } = useTheme();
  return <View accessibilityElementsHidden style={[styles.connector, { backgroundColor: colors.border }]} />;
}

export function JuntaSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const squad = useSquad();
  const coach = squad.data?.coach?.name ?? null;
  const board = club.board;
  const hasPresident = Boolean(board?.president);
  const hasMembers = Boolean(board?.members.length);
  const hasDirector = Boolean(board?.sportingDirector);
  const hasBoard = hasPresident || hasMembers || hasDirector;

  if (!hasBoard && !coach) {
    return squad.isPending ? <LoadingState /> : <EmptyState message={t('club.junta.empty')} />;
  }

  return (
    <Card>
      <SectionTitle>{t('club.junta.title')}</SectionTitle>
      <View style={styles.orgChart}>
        {board?.president ? <PersonNode name={board.president} role={t('club.junta.president')} /> : null}
        {hasPresident && (hasMembers || hasDirector || coach) ? <Connector /> : null}
        {hasMembers ? (
          <>
            <Text accessibilityRole="header" style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              {t('club.junta.members')}
            </Text>
            <View style={[styles.members, { borderLeftColor: colors.border }]}>
              {(board?.members ?? []).map((member) => (
                <PersonNode
                  key={`${member.name}-${member.role ?? ''}`}
                  name={member.name}
                  role={member.role ?? t('club.junta.member')}
                />
              ))}
            </View>
          </>
        ) : null}
        {hasMembers && (hasDirector || coach) ? <Connector /> : null}
        {board?.sportingDirector ? (
          <PersonNode name={board.sportingDirector} role={t('club.junta.sportingDirector')} />
        ) : null}
        {hasDirector && coach ? <Connector /> : null}
        {coach ? (
          <PersonNode
            name={coach}
            role={t('club.junta.coach')}
            onPress={() => router.push('/coach')}
          />
        ) : null}
      </View>
      {board?.note ? <MutedText>{board.note}</MutedText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  orgChart: { gap: spacing.sm },
  connector: { width: 2, height: spacing.md, marginLeft: 19 },
  members: {
    gap: spacing.xs,
    borderLeftWidth: 2,
    borderRadius: radius.sm,
    paddingLeft: spacing.md,
  },
  personNode: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
  personText: { flex: 1, gap: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
