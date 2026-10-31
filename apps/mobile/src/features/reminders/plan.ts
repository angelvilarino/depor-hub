import type { TFunction } from 'i18next';
import type { MatchT } from '@/data/schemas';
import { isReminderOffset, REMINDER_OFFSETS, type ReminderMap } from '@/store/settings';

/** iOS admite como máximo 64 notificaciones locales programadas por app. */
export const MAX_SCHEDULED = 64;

export type PlannedReminder = { id: string; match: MatchT; offsetMin: number; fireAt: Date };

/** Solo se puede recordar un partido con hora confirmada (TIMED) y futuro. */
export const isRemindable = (m: MatchT, nowMs: number): boolean =>
  m.status === 'TIMED' && Date.parse(m.utcDate) > nowMs;

export const offsetKey = (offsetMin: number): 'day' | 'hour' | 'minutes' | 'start' =>
  offsetMin >= 1440 ? 'day' : offsetMin >= 60 ? 'hour' : offsetMin > 0 ? 'minutes' : 'start';

export const offsetLabel = (offsetMin: number, t: TFunction): string =>
  t(`reminder.offset.${offsetKey(offsetMin)}`);

/**
 * Calcula qué notificaciones locales deben existir. Pura: reprogramar = cancelar
 * todo y volver a planificar. Se ordena por hora y se recorta a 64 (criterio:
 * los avisos más próximos primero; el resto se descarta hasta que haya hueco).
 */
export function planReminders(
  matches: MatchT[],
  remindMatches: ReminderMap,
  nowMs: number,
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const match of matches) {
    if (!isRemindable(match, nowMs)) continue;
    const offsets = remindMatches[match.id] ?? [];
    const start = Date.parse(match.utcDate);
    for (const offsetMin of offsets) {
      if (!isReminderOffset(offsetMin)) continue;
      const fire = start - offsetMin * 60_000;
      if (fire <= nowMs) continue;
      out.push({ id: `m${match.id}-${offsetMin}`, match, offsetMin, fireAt: new Date(fire) });
    }
  }
  return out
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || a.id.localeCompare(b.id))
    .slice(0, MAX_SCHEDULED);
}

export { REMINDER_OFFSETS };
