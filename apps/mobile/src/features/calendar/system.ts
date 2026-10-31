import * as Calendar from 'expo-calendar';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { MatchT } from '@/data/schemas';
import { hasConfirmedTime } from '@/utils/matchTime';

export type CalendarResult = 'saved' | 'cancelled' | 'shared';

/** Escribe el .ics en caché y abre la hoja de compartir del sistema. */
export async function shareIcs(content: string, name = 'depor-hub.ics'): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/calendar',
    UTI: 'com.apple.ical.ics',
    dialogTitle: name,
  });
}

/**
 * Añade un partido al calendario con el editor del sistema (sin pedir permiso de lectura).
 *
 * Cadena de respaldo (ADR 0017):
 * 1. iOS: `presentPicker()` + `addEventWithForm()`, el editor nativo de Calendar.
 * 2. Si la API no está disponible (Expo Go, Android, error nativo) o falla, se comparte
 *    un `.ics` de ese partido.
 * 3. Si también falla el `.ics`, se propaga el error para que la UI muestre un mensaje.
 *
 * Cancelar el picker o el formulario NO es un error: no se comparte nada.
 */
export async function addMatchToCalendar(
  m: MatchT,
  info: { title: string; venue: string | null; notes?: string; ics: string; icsName?: string },
): Promise<CalendarResult> {
  const start = new Date(m.utcDate);
  const allDay = !hasConfirmedTime(m.status);
  const end = new Date(start.getTime() + (allDay ? 86_400_000 : 2 * 3_600_000));

  if (Platform.OS === 'ios') {
    try {
      const cal = await Calendar.presentPicker();
      if (!cal) return 'cancelled';
      const result = await cal.addEventWithForm({
        title: info.title,
        startDate: start,
        endDate: end,
        allDay,
        location: info.venue ?? undefined,
        notes: info.notes,
      });
      return result.action === 'canceled' ? 'cancelled' : 'saved';
    } catch (error) {
      // En Expo Go el stub de Calendar@next lanza; también puede fallar en un build
      // antiguo o si el usuario no tiene calendarios. Se degrada al .ics.
      if (__DEV__) console.warn('[calendar] native editor unavailable; sharing .ics', error);
    }
  }

  try {
    await shareIcs(info.ics, info.icsName ?? `depor-hub-${m.id}.ics`);
    return 'shared';
  } catch (error) {
    if (__DEV__) console.warn('[calendar] .ics fallback failed', error);
    throw error;
  }
}
