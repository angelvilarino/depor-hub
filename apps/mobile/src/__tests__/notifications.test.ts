import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { makeMatch } from '@/test-utils/matches';
import i18n from '@/i18n';
import { ensureReminderPermission, syncReminders } from '@/features/reminders/notifications';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  getExactAlarmPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestExactAlarmPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('expo-notifications/build/NotificationChannelManager.types', () => ({
  AndroidImportance: { DEFAULT: 3 },
}));

const mocked = Notifications as jest.Mocked<typeof Notifications>;
const future = Date.parse('2027-05-01T18:00:00Z');
const match = makeMatch({ id: 1, utcDate: new Date(future).toISOString(), status: 'TIMED' });

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getAllScheduledNotificationsAsync.mockResolvedValue([]);
});

describe('serialización de recordatorios (F3-16)', () => {
  it('no solapa dos sincronizaciones: la segunda espera a la primera', async () => {
    // La primera lectura queda retenida hasta que el test la libera.
    let releaseFirst: (value: never[]) => void = () => {};
    const firstRead = new Promise<never[]>((resolve) => {
      releaseFirst = resolve;
    });
    mocked.getAllScheduledNotificationsAsync
      .mockReturnValueOnce(firstRead)
      .mockResolvedValueOnce([]);

    const inputs = { 1: [60] };
    const first = syncReminders([match], inputs);
    const second = syncReminders([match], inputs);

    // Sin cola, la segunda ya habría leído mientras la primera seguía esperando.
    await Promise.resolve();
    await Promise.resolve();
    expect(mocked.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);

    releaseFirst([]);
    await Promise.all([first, second]);

    expect(mocked.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    // Cada pasada programa su propio aviso, en serie.
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('un fallo no bloquea la sincronización siguiente', async () => {
    mocked.getAllScheduledNotificationsAsync
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([]);

    await expect(syncReminders([match], { 1: [60] })).rejects.toThrow('boom');
    await expect(syncReminders([match], { 1: [60] })).resolves.toBeUndefined();

    expect(mocked.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
  });
});

describe('alarmas exactas en Android 12+ (F3-15)', () => {
  const permission = (granted: boolean, canAskAgain = true) =>
    ({ granted, canAskAgain, status: granted ? 'granted' : 'denied', expires: 'never' }) as never;

  it('en iOS no se pide el permiso de alarmas exactas', async () => {
    await expect(ensureReminderPermission()).resolves.toBe('granted');
    expect(mocked.getExactAlarmPermissionsAsync).not.toHaveBeenCalled();
  });

  it('en Android 12+ pide la alarma exacta y guarda el aviso', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
    mocked.getExactAlarmPermissionsAsync.mockResolvedValue(permission(false));
    mocked.requestExactAlarmPermissionsAsync.mockResolvedValue(permission(true));

    await expect(ensureReminderPermission()).resolves.toBe('granted');
    expect(mocked.requestExactAlarmPermissionsAsync).toHaveBeenCalled();
  });

  it('si el usuario la deniega, informa sin bloquear el recordatorio', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
    mocked.getExactAlarmPermissionsAsync.mockResolvedValue(permission(false, false));

    await expect(ensureReminderPermission()).resolves.toBe('exact_alarm_denied');
    expect(mocked.requestExactAlarmPermissionsAsync).not.toHaveBeenCalled();
  });
});
