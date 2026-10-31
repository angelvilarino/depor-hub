import * as Calendar from 'expo-calendar';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { addMatchToCalendar } from '@/features/calendar/system';
import { makeMatch } from '@/test-utils/matches';

jest.mock('expo-calendar', () => ({
  presentPicker: jest.fn(),
}));

jest.mock('expo-file-system', () => {
  class File {
    uri = 'file:///cache/depor-hub-1.ics';
    exists = false;
    delete = jest.fn();
    create = jest.fn();
    write = jest.fn();
    constructor(_base: string, name: string) {
      this.uri = `file:///cache/${name}`;
    }
  }
  return { File, Paths: { cache: '/cache' } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

const presentPicker = Calendar.presentPicker as jest.Mock;
const isAvailable = Sharing.isAvailableAsync as jest.Mock;
const shareAsync = Sharing.shareAsync as jest.Mock;
const match = makeMatch({ id: 1 });
const info = { title: 'Deportivo – Atleti', venue: 'Riazor', ics: 'BEGIN:VCALENDAR' };

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { value: os, writable: true, configurable: true });
};

beforeEach(() => {
  jest.clearAllMocks();
  isAvailable.mockResolvedValue(true);
  setPlatform('ios');
});

describe('addMatchToCalendar', () => {
  it('iOS: guarda con el editor nativo sin compartir nada', async () => {
    const addEventWithForm = jest.fn(async () => ({ action: 'saved', id: 'e1' }));
    presentPicker.mockResolvedValue({ addEventWithForm });

    await expect(addMatchToCalendar(match, info)).resolves.toBe('saved');
    expect(addEventWithForm).toHaveBeenCalledWith(
      expect.objectContaining({ title: info.title, location: 'Riazor', allDay: false }),
    );
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('iOS: cancelar el editor no es un error ni comparte', async () => {
    presentPicker.mockResolvedValue({
      addEventWithForm: jest.fn(async () => ({ action: 'canceled', id: null })),
    });
    await expect(addMatchToCalendar(match, info)).resolves.toBe('cancelled');
    expect(shareAsync).not.toHaveBeenCalled();

    presentPicker.mockResolvedValue(null);
    await expect(addMatchToCalendar(match, info)).resolves.toBe('cancelled');
  });

  it('iOS: si el editor nativo falla, comparte el .ics', async () => {
    presentPicker.mockRejectedValue(new Error('Calendar@next unavailable'));
    await expect(addMatchToCalendar(match, info)).resolves.toBe('shared');
    expect(shareAsync).toHaveBeenCalledWith(
      'file:///cache/depor-hub-1.ics',
      expect.objectContaining({ mimeType: 'text/calendar' }),
    );
  });

  it('Android: usa directamente el .ics', async () => {
    setPlatform('android');
    await expect(addMatchToCalendar(match, info)).resolves.toBe('shared');
    expect(presentPicker).not.toHaveBeenCalled();
    expect(shareAsync).toHaveBeenCalled();
  });

  it('si tampoco se puede compartir, propaga el error', async () => {
    isAvailable.mockResolvedValue(false);
    await expect(addMatchToCalendar(match, info)).rejects.toThrow('sharing unavailable');
  });

  it('un partido sin hora se añade como día completo', async () => {
    const addEventWithForm = jest.fn(async () => ({ action: 'saved', id: 'e1' }));
    presentPicker.mockResolvedValue({ addEventWithForm });
    const tbc = makeMatch({ status: 'SCHEDULED', utcDate: '2026-11-22T00:00:00Z' });

    await addMatchToCalendar(tbc, info);
    expect(addEventWithForm).toHaveBeenCalledWith(expect.objectContaining({ allDay: true }));
  });
});
