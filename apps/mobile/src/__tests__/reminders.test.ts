import { isRemindable, planReminders } from '@/features/reminders/plan';
import { makeMatch } from '@/test-utils/matches';

const m = makeMatch({ id: 564724 }); // 2026-10-24T19:00Z, TIMED

describe('planReminders', () => {
  it('programa 24 h y 1 h antes', () => {
    const plan = planReminders([m], [564724], Date.parse('2026-10-20T12:00:00Z'));
    expect(plan.map((p) => p.fireAt.toISOString())).toEqual(['2026-10-23T19:00:00.000Z', '2026-10-24T18:00:00.000Z']);
  });

  it('descarta avisos ya pasados', () => {
    const plan = planReminders([m], [564724], Date.parse('2026-10-24T00:00:00Z'));
    expect(plan.map((p) => p.offsetMin)).toEqual([60]);
  });

  it('solo partidos pedidos y con hora confirmada', () => {
    const now = Date.parse('2026-10-20T12:00:00Z');
    expect(planReminders([m], [], now)).toEqual([]);
    const tbc = makeMatch({ id: 7, status: 'SCHEDULED', utcDate: '2026-11-22T00:00:00Z' });
    expect(planReminders([tbc], [7], now)).toEqual([]);
    expect(isRemindable(tbc, now)).toBe(false);
  });

  it('un aplazamiento deja de programar', () => {
    const postponed = { ...m, status: 'POSTPONED' };
    expect(planReminders([postponed], [564724], Date.parse('2026-10-20T12:00:00Z'))).toEqual([]);
  });
});
