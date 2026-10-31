/**
 * Coordenadas de estadios verificadas. Solo se añade una sede cuando la coordenada
 * se puede contrastar con una fuente pública; si falta, la app oculta el tiempo en
 * vez de inventarlo. No se usa la ubicación del usuario.
 */
export type VenueCoords = {
  latitude: number;
  longitude: number;
  sourceUrl: string;
};

export const VENUE_COORDS: Record<string, VenueCoords> = {
  'Estadio Abanca-Riazor': {
    latitude: 43.3686,
    longitude: -8.4175,
    sourceUrl: 'https://www.openstreetmap.org/?mlat=43.3686&mlon=-8.4175#map=17/43.3686/-8.4175',
  },
};

export function venueCoords(venue: string | null | undefined): VenueCoords | null {
  if (!venue) return null;
  return VENUE_COORDS[venue] ?? null;
}
