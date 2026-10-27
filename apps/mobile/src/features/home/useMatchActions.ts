import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MatchT } from '@/data/schemas';
import { useMeta } from '@/data/queries';
import { addMatchToCalendar } from '@/features/calendar/system';
import { teamName } from '@/features/calendar/logic';
import { ensureReminderPermission } from '@/features/reminders/notifications';
import { isRemindable } from '@/features/reminders/plan';
import { useSettings } from '@/store/settings';
import { formatMatchTime } from '@/utils/matchTime';

/**
 * Lógica compartida entre la Home y la ficha de partido: sede, recordatorio y
 * calendario. El permiso se pide solo al pulsar «Recordarme».
 */
export function useMatchActions(match: MatchT) {
  const { t, i18n } = useTranslation();
  const meta = useMeta();
  const [now] = useState(() => Date.now()); // fuera del render: regla react-hooks/purity
  const { remindMatchIds, remindersEnabled, toggleRemind, setRemindersEnabled } = useSettings();

  // `?? null`: la caché persistida anterior al ADR 0006 puede no traer estos campos.
  const venue = match.venue ?? (match.deporIsHome ? (meta.data?.team.venue ?? null) : null);
  const time = formatMatchTime(match.utcDate, match.status, i18n.language);
  const title = `${teamName(match.home)} – ${teamName(match.away)}`;
  const remindable = isRemindable(match, now);
  const reminded = remindersEnabled && remindMatchIds.includes(match.id);

  const toggleReminder = async () => {
    if (reminded) {
      toggleRemind(match.id, false);
      return;
    }
    if (!(await ensureReminderPermission())) {
      Alert.alert(t('match.permissionDenied'));
      return;
    }
    if (!remindersEnabled) setRemindersEnabled(true);
    toggleRemind(match.id, true);
  };

  const addToCalendar = async () => {
    try {
      await addMatchToCalendar(match, {
        title,
        venue,
        notes: time ? undefined : t('calendar.timeTbc'),
      });
    } catch {
      Alert.alert(t('match.addError'));
    }
  };

  return { venue, time, title, remindable, reminded, toggleReminder, addToCalendar };
}
