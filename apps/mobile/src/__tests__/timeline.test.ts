import type { MatchDetailT } from '@/data/schemas';
import { buildTimeline } from '@/features/match/timeline';

const detail = (over: Partial<MatchDetailT>): MatchDetailT =>
  ({
    goals: [],
    cards: [],
    substitutions: [],
    ...over,
  }) as MatchDetailT;

describe('buildTimeline', () => {
  it('funde goles, tarjetas y cambios en una sola secuencia por minuto', () => {
    const entries = buildTimeline(
      detail({
        goals: [
          {
            minute: 21,
            minuteLabel: '21',
            team: 'home',
            player: 'Aubameyang',
            ownGoal: false,
            penalty: true,
            scoreAfter: { home: 1, away: 0 },
          },
          {
            minute: 88,
            minuteLabel: '88',
            team: 'away',
            player: 'Redondo',
            ownGoal: false,
            penalty: false,
            scoreAfter: null,
          },
        ],
        cards: [{ minute: 65, minuteLabel: '65', team: 'away', player: 'Aguado', kind: 'yellow' }],
        substitutions: [
          {
            minute: 60,
            minuteLabel: '60',
            team: 'home',
            playerOut: 'Jensen',
            playerIn: 'Eddahchouri',
          },
        ],
      }),
    );

    expect(entries.map((entry) => entry.minute)).toEqual([21, 60, 65, 88]);
    expect(entries.map((entry) => entry.kind)).toEqual(['goal', 'substitution', 'card', 'goal']);
  });

  it('a igual minuto ordena gol, tarjeta y cambio', () => {
    const entries = buildTimeline(
      detail({
        substitutions: [
          { minute: 45, minuteLabel: '45', team: 'home', playerOut: 'A', playerIn: 'B' },
        ],
        cards: [{ minute: 45, minuteLabel: '45', team: 'home', player: 'C', kind: 'red' }],
        goals: [
          {
            minute: 45,
            minuteLabel: '45',
            team: 'home',
            player: 'D',
            ownGoal: true,
            penalty: false,
            scoreAfter: { home: 2, away: 0 },
          },
        ],
      }),
    );

    expect(entries.map((entry) => entry.kind)).toEqual(['goal', 'card', 'substitution']);
  });

  it('formatea el marcador posterior sin inventar el que falta', () => {
    const entries = buildTimeline(
      detail({
        goals: [
          {
            minute: 10,
            minuteLabel: '10',
            team: 'home',
            player: 'Uno',
            ownGoal: false,
            penalty: false,
            scoreAfter: { home: 1, away: 0 },
          },
          {
            minute: 20,
            minuteLabel: '20',
            team: 'away',
            player: 'Dos',
            ownGoal: false,
            penalty: false,
            scoreAfter: null,
          },
        ],
      }),
    );

    expect(entries[0]).toMatchObject({ kind: 'goal', scoreAfter: '1–0' });
    expect(entries[1]).toMatchObject({ kind: 'goal', scoreAfter: null });
  });

  it('sin eventos devuelve una lista vacía', () => {
    expect(buildTimeline(detail({}))).toEqual([]);
  });
});
