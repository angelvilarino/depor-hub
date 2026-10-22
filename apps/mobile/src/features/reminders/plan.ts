import type { MatchT } from '@/data/schemas';

/** 24 h y 1 h antes del inicio. */
export const REMINDER_OFFSETS_MIN = [1440, 60] as const;

export type PlannedReminder = { id: string; match: MatchT; offsetMin: number; fireAt: Date };

/** Solo se puede recordar un partido con hora confirmada (TIMED) y futuro. */
export const isRemindable = (m: MatchT, nowMs: number): boolean =>
  m.status === 'TIMED' && Date.parse(m.utcDate) > nowMs;

/** Calcula qué notificaciones locales deben existir. Pura: reprogramar = cancelar todo y volver a planificar. */
export function planReminders(matches: MatchT[], remindIds: number[], nowMs: number): PlannedReminder[] {
  const wanted = new Set(remindIds);
  const out: PlannedReminder[] = [];
  for (const match of matches) {
    if (!wanted.has(match.id) || !isRemindable(match, nowMs)) continue;
    const start = Date.parse(match.utcDate);
    for (const offsetMin of REMINDER_OFFSETS_MIN) {
      const fire = start - offsetMin * 60_000;
      if (fire > nowMs) out.push({ id: `m${match.id}-${offsetMin}`, match, offsetMin, fireAt: new Date(fire) });
    }
  }
  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
