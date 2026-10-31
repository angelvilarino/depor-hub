import { isRemindable, MAX_SCHEDULED, planReminders } from '@/features/reminders/plan';
import { makeMatch } from '@/test-utils/matches';

const m = makeMatch({ id: 564724 }); // 2026-10-24T19:00Z, TIMED

describe('planReminders', () => {
  it('programa 1 día y 1 h antes por defecto', () => {
    const plan = planReminders([m], { 564724: [1440, 60] }, Date.parse('2026-10-20T12:00:00Z'));
    expect(plan.map((p) => p.fireAt.toISOString())).toEqual([
      '2026-10-23T19:00:00.000Z',
      '2026-10-24T18:00:00.000Z',
    ]);
    expect(plan.map((p) => p.offsetMin)).toEqual([1440, 60]);
  });

  it('admite 15 min y el inicio del partido', () => {
    const plan = planReminders([m], { 564724: [15, 0] }, Date.parse('2026-10-20T12:00:00Z'));
    expect(plan.map((p) => p.fireAt.toISOString())).toEqual([
      '2026-10-24T18:45:00.000Z',
      '2026-10-24T19:00:00.000Z',
    ]);
  });

  it('descarta avisos ya pasados', () => {
    const plan = planReminders([m], { 564724: [1440, 60] }, Date.parse('2026-10-24T00:00:00Z'));
    expect(plan.map((p) => p.offsetMin)).toEqual([60]);
  });

  it('solo partidos pedidos y con hora confirmada', () => {
    const now = Date.parse('2026-10-20T12:00:00Z');
    expect(planReminders([m], {}, now)).toEqual([]);
    const tbc = makeMatch({ id: 7, status: 'SCHEDULED', utcDate: '2026-11-22T00:00:00Z' });
    expect(planReminders([tbc], { 7: [1440, 60] }, now)).toEqual([]);
    expect(isRemindable(tbc, now)).toBe(false);
  });

  it('un aplazamiento deja de programar', () => {
    const postponed = { ...m, status: 'POSTPONED' };
    expect(planReminders([postponed], { 564724: [1440, 60] }, Date.parse('2026-10-20T12:00:00Z'))).toEqual([]);
  });

  it('recorta a 64 notificaciones (límite de iOS)', () => {
    const now = Date.parse('2026-10-20T12:00:00Z');
    const matches = Array.from({ length: 40 }, (_, i) =>
      makeMatch({
        id: 1000 + i,
        utcDate: new Date(now + (i + 1) * 3 * 3_600_000).toISOString(),
      }),
    );
    const map = Object.fromEntries(matches.map((match) => [match.id, [1440, 60]]));
    const plan = planReminders(matches, map, now);
    expect(plan).toHaveLength(MAX_SCHEDULED);
    // Se conservan los avisos más próximos en el tiempo.
    const fireTimes = plan.map((p) => p.fireAt.getTime());
    expect(fireTimes).toEqual([...fireTimes].sort((a, b) => a - b));
  });
});
