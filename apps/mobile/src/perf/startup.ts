/**
 * Marcas de arranque (F3-14). Miden el camino crítico de un arranque en frío:
 * evaluación del layout, fuentes, caché hidratada, splash oculto y primer render
 * de Inicio. No se envía nada a ningún sitio: en `__DEV__` se imprime una línea
 * `[startup]` que se lee con `adb logcat`; en release el protocolo mide el
 * arranque completo con `adb shell am start -W` (docs/auditoria/ARRANQUE.md).
 */
export type StartupMark = 'layout' | 'fonts' | 'cache' | 'splash' | 'home';

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const origin = now();
const marks = new Map<StartupMark, number>();
let reported = false;

function elapsed(): number {
  return Math.round(now() - origin);
}

/** Registra una fase una sola vez y devuelve los ms desde el inicio del módulo. */
export function markStartup(name: StartupMark): number {
  const known = marks.get(name);
  if (known !== undefined) return known;
  const at = elapsed();
  marks.set(name, at);
  try {
    // Hermes y el navegador lo soportan; si no, la marca local sigue valiendo.
    performance.mark(`startup:${name}`, { startTime: at });
  } catch {
    // Sin `performance.mark` no hay marca para el profiler; el mapa ya la guarda.
  }
  return at;
}

/** Copia de las marcas tomadas hasta ahora (ms desde el inicio del módulo). */
export function startupMarks(): Partial<Record<StartupMark, number>> {
  return Object.fromEntries(marks) as Partial<Record<StartupMark, number>>;
}

/** Imprime una sola línea por arranque, solo en desarrollo. */
export function logStartup(): void {
  if (!__DEV__ || reported) return;
  reported = true;
  console.info('[startup]', JSON.stringify(startupMarks()));
}
