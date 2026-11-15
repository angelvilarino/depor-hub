import * as Notifications from 'expo-notifications';
// AndroidImportance se importa directamente porque ESLint/import-namespace no resuelve export*
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import type { MatchT } from '@/data/schemas';
import type { ReminderMap } from '@/store/settings';
import { formatMatchTime } from '@/utils/matchTime';
import { offsetKey, planReminders } from './plan';

const CHANNEL = 'matches';
const KIND = 'match-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: i18n.t('reminder.channel'),
    importance: AndroidImportance.DEFAULT,
  });
}

export type ReminderPermission = 'granted' | 'notifications_denied' | 'exact_alarm_denied';

const needsExactAlarm = (): boolean =>
  Platform.OS === 'android' && Number(Platform.Version) >= 31;

/**
 * Comprueba el permiso de alarmas exactas (Android 12+, F3-15). Sin él el
 * sistema puede retrasar el aviso; no se bloquea el recordatorio.
 */
export async function requestExactAlarmPermission(): Promise<boolean> {
  if (!needsExactAlarm()) return true;
  const current = await Notifications.getExactAlarmPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
}

/** Permiso contextual: solo se llama al pulsar "Recordarme". */
export async function ensureReminderPermission(): Promise<ReminderPermission> {
  await ensureChannel(); // en Android 13+ el canal debe existir antes de pedir permiso
  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
  if (!granted) return 'notifications_denied';
  // F3-15: en Android 12+ se pide además la alarma exacta; si se deniega, se avisa.
  return (await requestExactAlarmPermission()) ? 'granted' : 'exact_alarm_denied';
}

/**
 * Cola de sincronización (F3-16 / F5-05): dos efectos pueden pedir un refresco a
 * la vez y cancelar lo que el otro acaba de programar. Las llamadas se ejecutan
 * en serie, en orden de llegada; un fallo no bloquea las siguientes.
 */
let pending: Promise<void> = Promise.resolve();

export function syncReminders(matches: MatchT[], remindMatches: ReminderMap): Promise<void> {
  const next = pending.catch(() => undefined).then(() => applyReminders(matches, remindMatches));
  pending = next;
  return next;
}

/** Cancela los recordatorios propios y vuelve a programar según los datos actuales (cubre cambios de hora y aplazamientos). */
async function applyReminders(matches: MatchT[], remindMatches: ReminderMap): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  const plan = planReminders(matches, remindMatches, Date.now());
  if (plan.length === 0) return;
  await ensureChannel();
  const locale = i18n.language;
  const name = (t: { name: string; shortName: string | null }) => t.shortName ?? t.name;
  for (const p of plan) {
    const time = formatMatchTime(p.match.utcDate, p.match.status, locale) ?? '';
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: {
        title: `${name(p.match.home)} – ${name(p.match.away)}`,
        body: i18n.t(`reminder.body.${offsetKey(p.offsetMin)}`, { time }),
        data: { kind: KIND, matchId: p.match.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.fireAt, channelId: CHANNEL },
    });
  }
}
