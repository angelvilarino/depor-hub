import { countdownParts, type CountdownParts } from './logic';
import { useNow } from './useNow';
import { nowMs } from '@/utils/clock';

/**
 * Cuenta atrás con un único intervalo. Bajo una hora actualiza cada segundo; por
 * encima, cada minuto. El reloj se pausa en segundo plano (ver `useNow`) y no usa
 * animaciones, así que «reducir movimiento» no requiere nada adicional.
 */
export function useCountdown(
  targetMs: number,
  withSeconds: boolean,
  enabled = true,
): CountdownParts {
  const remaining = targetMs - nowMs();
  const interval = withSeconds && remaining > 0 && remaining < 3_600_000 ? 1_000 : 60_000;
  const now = useNow(interval, enabled && targetMs > nowMs());
  return countdownParts(targetMs, now);
}
