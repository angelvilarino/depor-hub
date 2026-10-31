import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

/**
 * Abre un enlace externo con el navegador in-app de Expo y cae a `Linking` si falla.
 * Devuelve `false` solo cuando no se ha podido abrir por ninguna de las dos vías.
 */
export async function openExternal(url: string): Promise<boolean> {
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
