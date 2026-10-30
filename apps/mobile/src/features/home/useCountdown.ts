import { countdownParts, type CountdownParts } from './logic';
import { useNow } from './useNow';
import { nowMs } from '@/utils/clock';

/**
 * Cuenta atrás con un único intervalo. El segundo se actualiza solo en este
 * componente; `useNow` pausa el reloj cuando la app pasa a segundo plano.
 */
export function useCountdown(
  targetMs: number,
  withSeconds: boolean,
  enabled = true,
): CountdownParts {
  const remaining = targetMs - nowMs();
  const interval = withSeconds && remaining > 0 ? 1_000 : 60_000;
  const now = useNow(interval, enabled && targetMs > nowMs());
  return countdownParts(targetMs, now);
}
