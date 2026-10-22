import { useEffect } from 'react';
import { useFixtures } from '@/data/queries';
import { useSettings } from '@/store/settings';
import { syncReminders } from './notifications';

/** Sin UI: reprograma los recordatorios cada vez que cambian los datos o los ajustes. */
export function ReminderSync() {
  const fixtures = useFixtures().data;
  const { remindersEnabled, remindMatchIds, language } = useSettings();

  useEffect(() => {
    if (!fixtures) return;
    syncReminders(fixtures.matches, remindersEnabled ? remindMatchIds : []).catch(() => {
      // Sin permisos o sin soporte (p. ej. web): no es crítico.
    });
  }, [fixtures, remindersEnabled, remindMatchIds, language]);

  return null;
}
