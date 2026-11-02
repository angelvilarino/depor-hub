import { Linking, Platform } from 'react-native';
import { mapUrl, webMapUrl } from './logic';

/**
 * Abre una ubicación en el mapa nativo (Apple Maps en iOS, `geo:` en Android) y
 * cae a Google Maps por HTTPS si el esquema no está disponible. Devuelve `false`
 * solo cuando no se ha podido abrir ninguna de las dos vías.
 */
export async function openMapLocation(
  latitude: number,
  longitude: number,
  label: string,
): Promise<boolean> {
  try {
    await Linking.openURL(mapUrl(latitude, longitude, label, Platform.OS));
    return true;
  } catch {
    // El esquema nativo puede no existir en simuladores o en web.
  }
  try {
    await Linking.openURL(webMapUrl(latitude, longitude));
    return true;
  } catch {
    return false;
  }
}
