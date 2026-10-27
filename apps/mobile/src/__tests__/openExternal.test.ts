import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { openExternal } from '@/utils/openExternal';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const browser = WebBrowser.openBrowserAsync as jest.Mock;

beforeEach(() => {
  jest.restoreAllMocks();
  browser.mockReset();
});

describe('openExternal', () => {
  it('usa el navegador de la app cuando está disponible', async () => {
    browser.mockResolvedValueOnce(undefined);
    const linking = jest.spyOn(Linking, 'openURL');
    await expect(openExternal('https://example.test/a')).resolves.toBe(true);
    expect(browser).toHaveBeenCalledWith('https://example.test/a');
    expect(linking).not.toHaveBeenCalled();
  });

  it('cae a Linking si el navegador in-app falla', async () => {
    browser.mockRejectedValueOnce(new Error('no disponible'));
    const linking = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined);
    await expect(openExternal('https://example.test/b')).resolves.toBe(true);
    expect(linking).toHaveBeenCalledWith('https://example.test/b');
  });

  it('devuelve false si tampoco se puede abrir con Linking', async () => {
    browser.mockRejectedValueOnce(new Error('no disponible'));
    jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('sin app'));
    await expect(openExternal('https://example.test/c')).resolves.toBe(false);
  });
});
