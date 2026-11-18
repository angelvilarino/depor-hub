import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

const WEB_URL = /^https?:\/\/[^\s/]+(\/[^\s]*)?$/i;

/** Solo se abren enlaces web: nada de `javascript:`, `file:` ni esquemas de app. */
export function isSafeExternalUrl(url: string): boolean {
  return WEB_URL.test(url.trim());
}

/**
 * Abre un enlace externo con el navegador in-app de Expo y cae a `Linking` si falla.
 * Devuelve `false` cuando la URL no es http(s) o no se ha podido abrir por ninguna vía.
 */
export async function openExternal(url: string): Promise<boolean> {
  if (!isSafeExternalUrl(url)) return false;
  try {
    await WebBrowser.openBrowserAsync(url);
    return true;
  } catch {
    // Algunos entornos (tests, web o un WebBrowser no disponible) no exponen el módulo.
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
