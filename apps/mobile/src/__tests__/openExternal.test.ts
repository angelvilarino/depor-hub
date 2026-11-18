import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { isSafeExternalUrl, openExternal } from '@/utils/openExternal';

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

  it.each([
    'javascript:alert(1)',
    'file:///etc/passwd',
    'data:text/html,hola',
    'intent://scan/#Intent;scheme=zxing;end',
    'no-es-una-url',
  ])('rechaza el esquema inseguro %s', async (url) => {
    await expect(openExternal(url)).resolves.toBe(false);
    expect(browser).not.toHaveBeenCalled();
    expect(isSafeExternalUrl(url)).toBe(false);
  });

  it('acepta http y https', () => {
    expect(isSafeExternalUrl('https://example.test/a?b=1')).toBe(true);
    expect(isSafeExternalUrl('http://example.test')).toBe(true);
  });
});
