import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/** URL del mapa nativo: Apple Maps en iOS, geo: en Android. */
export function mapUrl(venue: string, platform: string = Platform.OS): string {
  const query = encodeURIComponent(venue);
  return platform === 'android'
    ? `geo:0,0?q=${query}`
    : `http://maps.apple.com/?q=${query}`;
}

export async function openVenueInMaps(venue: string): Promise<void> {
  await Linking.openURL(mapUrl(venue));
}
