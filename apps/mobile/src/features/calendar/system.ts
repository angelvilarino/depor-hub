import * as Calendar from 'expo-calendar';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { MatchT } from '@/data/schemas';
import { hasConfirmedTime } from '@/utils/matchTime';

/** Abre el diálogo del sistema para añadir un evento al calendario del usuario.
 *  API expo-calendar 58: presentPicker() devuelve el calendario elegido por el usuario;
 *  addEventWithForm() abre el formulario nativo del sistema pre-rellenado. */
export async function addMatchToCalendar(
  m: MatchT,
  info: { title: string; venue: string | null; notes?: string },
): Promise<void> {
  const start = new Date(m.utcDate);
  const allDay = !hasConfirmedTime(m.status);
  const end = new Date(start.getTime() + (allDay ? 86_400_000 : 2 * 3_600_000));
  // presentPicker() devuelve null si el usuario cancela la selección de calendario.
  const cal = await Calendar.presentPicker();
  if (!cal) return;
  await cal.addEventWithForm({
    title: info.title,
    startDate: start,
    endDate: end,
    allDay,
    location: info.venue ?? undefined,
    notes: info.notes,
  });
}

/** Escribe el .ics en caché y abre la hoja de compartir del sistema. */
export async function shareIcs(content: string, name = 'depor-hub.ics'): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'com.apple.ical.ics', dialogTitle: name });
}
