import { groupByMonth, outcome, splitMatches } from '@/features/calendar/logic';
import { makeMatch } from '@/test-utils/matches';

describe('calendar logic', () => {
  const fin = makeMatch({ id: 1, utcDate: '2026-10-16T19:00:00Z', status: 'FINISHED', score: { home: 1, away: 1, halfTimeHome: 0, halfTimeAway: 0, winner: 'DRAW' } });
  const fin2 = makeMatch({ id: 2, utcDate: '2026-10-11T14:15:00Z', status: 'FINISHED', deporIsHome: false, score: { home: 3, away: 2, halfTimeHome: 2, halfTimeAway: 0, winner: 'HOME_TEAM' } });
  const next = makeMatch({ id: 3, utcDate: '2026-10-24T19:00:00Z' });
  const later = makeMatch({ id: 4, utcDate: '2026-11-22T00:00:00Z', status: 'SCHEDULED' });
  const cancelled = makeMatch({ id: 5, status: 'CANCELLED' });

  it('separa próximos (asc) y resultados (desc) y oculta cancelados', () => {
    const { upcoming, results } = splitMatches([later, fin2, next, fin, cancelled]);
    expect(upcoming.map((m) => m.id)).toEqual([3, 4]);
    expect(results.map((m) => m.id)).toEqual([1, 2]);
  });

  it('agrupa por mes manteniendo el orden', () => {
    const groups = groupByMonth([next, later]);
    expect(groups.map((g) => g.key)).toEqual(['2026-10', '2026-11']);
  });

  it('resultado desde el punto de vista del Depor', () => {
    expect(outcome(fin)).toBe('D');
    expect(outcome(fin2)).toBe('L'); // visitante, pierde 3-2
    expect(outcome(next)).toBeNull();
  });
});
