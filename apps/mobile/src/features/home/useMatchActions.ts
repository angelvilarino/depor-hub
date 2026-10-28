import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MatchT } from '@/data/schemas';
import { useMeta } from '@/data/queries';
import { addMatchToCalendar } from '@/features/calendar/system';
import { teamName } from '@/features/calendar/logic';
import { ensureReminderPermission } from '@/features/reminders/notifications';
import { isRemindable, offsetLabel } from '@/features/reminders/plan';
import { useSettings } from '@/store/settings';
import { buildIcs } from '@/utils/ics';
import { formatMatchTime } from '@/utils/matchTime';

export type SaveReminderResult = 'saved' | 'denied';

/**
 * Lógica compartida entre la Home y la ficha de partido: sede, recordatorio y
 * calendario. El permiso se pide solo al confirmar en la hoja de recordatorios.
 */
export function useMatchActions(match: MatchT) {
  const { t, i18n } = useTranslation();
  const meta = useMeta();
  const [now] = useState(() => Date.now()); // fuera del render: regla react-hooks/purity
  const {
    remindMatches,
    remindersEnabled,
    defaultReminderOffsets,
    setRemindersEnabled,
    setReminderOffsets,
    removeReminder: removeStoredReminder,
  } = useSettings();

  // `?? null`: la caché persistida anterior al ADR 0006 puede no traer estos campos.
  const venue = match.venue ?? (match.deporIsHome ? (meta.data?.team.venue ?? null) : null);
  const time = formatMatchTime(match.utcDate, match.status, i18n.language);
  const title = `${teamName(match.home)} – ${teamName(match.away)}`;
  const remindable = isRemindable(match, now);
  const offsets = remindMatches[match.id] ?? defaultReminderOffsets;
  const reminded = remindersEnabled && (remindMatches[match.id]?.length ?? 0) > 0;
  const reminderSummary = offsets.map((offset) => offsetLabel(offset, t)).join(' · ');

  const saveReminder = async (nextOffsets: number[]): Promise<SaveReminderResult> => {
    if (nextOffsets.length === 0) {
      removeStoredReminder(match.id);
      return 'saved';
    }
    if (!(await ensureReminderPermission())) return 'denied';
    if (!remindersEnabled) setRemindersEnabled(true);
    setReminderOffsets(match.id, nextOffsets);
    return 'saved';
  };

  const removeReminder = () => removeStoredReminder(match.id);

  const addToCalendar = async () => {
    const ics = buildIcs([match], new Date().toISOString(), {
      venue,
      matchdayLabel: (n) => t('calendar.matchday', { n }),
      tbcLabel: t('calendar.timeTbc'),
    });
    try {
      await addMatchToCalendar(match, {
        title,
        venue,
        notes: time ? undefined : t('calendar.timeTbc'),
        ics,
        icsName: `depor-hub-${match.id}.ics`,
      });
    } catch (error) {
      if (__DEV__) console.warn('[calendar] add to calendar failed', error);
      Alert.alert(t('match.addError'), t('match.addErrorHint'));
    }
  };

  return {
    venue,
    time,
    title,
    remindable,
    reminded,
    reminderOffsets: offsets,
    reminderSummary,
    remindersEnabled,
    setRemindersEnabled,
    saveReminder,
    removeReminder,
    addToCalendar,
    openSystemSettings: () => void Linking.openSettings(),
  };
}
