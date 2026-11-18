import type { MatchCardKindT, MatchDetailT, MatchSideT } from '@/data/schemas';

/**
 * D-05: los eventos de la ficha llegan en tres listas separadas (goles, tarjetas y
 * cambios). La línea temporal las funde en una sola secuencia ordenada por minuto
 * sin inventar datos: solo cambia el orden de lo publicado.
 */
export type TimelineEntry =
  | {
      kind: 'goal';
      key: string;
      minute: number;
      minuteLabel: string;
      side: MatchSideT;
      player: string;
      ownGoal: boolean;
      penalty: boolean;
      scoreAfter: string | null;
    }
  | {
      kind: 'card';
      key: string;
      minute: number;
      minuteLabel: string;
      side: MatchSideT;
      player: string;
      card: MatchCardKindT;
    }
  | {
      kind: 'substitution';
      key: string;
      minute: number;
      minuteLabel: string;
      side: MatchSideT;
      playerOut: string | null;
      playerIn: string | null;
    };

const KIND_ORDER: Record<TimelineEntry['kind'], number> = {
  goal: 0,
  card: 1,
  substitution: 2,
};

export function buildTimeline(detail: MatchDetailT): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...detail.goals.map((goal, index) => ({
      kind: 'goal' as const,
      key: `goal-${index}`,
      minute: goal.minute,
      minuteLabel: goal.minuteLabel,
      side: goal.team,
      player: goal.player,
      ownGoal: goal.ownGoal,
      penalty: goal.penalty,
      scoreAfter: goal.scoreAfter ? `${goal.scoreAfter.home}–${goal.scoreAfter.away}` : null,
    })),
    ...detail.cards.map((card, index) => ({
      kind: 'card' as const,
      key: `card-${index}`,
      minute: card.minute,
      minuteLabel: card.minuteLabel,
      side: card.team,
      player: card.player,
      card: card.kind,
    })),
    ...detail.substitutions.map((substitution, index) => ({
      kind: 'substitution' as const,
      key: `sub-${index}`,
      minute: substitution.minute,
      minuteLabel: substitution.minuteLabel,
      side: substitution.team,
      playerOut: substitution.playerOut,
      playerIn: substitution.playerIn,
    })),
  ];

  return entries.sort((a, b) => a.minute - b.minute || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}
