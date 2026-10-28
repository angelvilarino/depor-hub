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

/** Permiso contextual: solo se llama al pulsar "Recordarme". */
export async function ensureReminderPermission(): Promise<boolean> {
  await ensureChannel(); // en Android 13+ el canal debe existir antes de pedir permiso
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Cancela los recordatorios propios y vuelve a programar según los datos actuales (cubre cambios de hora y aplazamientos). */
export async function syncReminders(matches: MatchT[], remindMatches: ReminderMap): Promise<void> {
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
