/**
 * Reloj de la app. `EXPO_PUBLIC_DEV_NOW` permite congelar el instante de referencia
 * para probar estados (cuenta atrás, en juego, resultado reciente), pero SOLO en
 * desarrollo: en una build de producción se ignora por completo.
 *
 * El valor de `.env` es el instante inicial; el reloj sigue avanzando en tiempo real
 * desde que arranca el módulo, para que la cuenta atrás no se quede parada.
 */
const rawDevNow = process.env.EXPO_PUBLIC_DEV_NOW;
const parsedDevNow = rawDevNow ? Date.parse(rawDevNow) : Number.NaN;
const devBase = __DEV__ && !Number.isNaN(parsedDevNow) ? parsedDevNow : null;
const devStartedAt = Date.now();

export function nowMs(): number {
  return devBase === null ? Date.now() : devBase + (Date.now() - devStartedAt);
}

/** Expuesto para pruebas y para el banner de desarrollo. */
export const hasDevClock = devBase !== null;
