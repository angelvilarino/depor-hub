import { useEffect, useState } from 'react';
import { countdownParts, type CountdownParts } from './logic';

/**
 * Cuenta atrás con un único intervalo. Bajo una hora actualiza cada segundo; por
 * encima, cada minuto. Se limpia al desmontar y no usa animaciones, así que
 * «reducir movimiento» no requiere nada adicional.
 */
export function useCountdown(
  targetMs: number,
  withSeconds: boolean,
  enabled = true,
): CountdownParts {
  const [now, setNow] = useState(() => Date.now());
  const remaining = targetMs - now;
  const secondsPhase = withSeconds && remaining > 0 && remaining < 3_600_000;

  useEffect(() => {
    if (!enabled || targetMs <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), secondsPhase ? 1_000 : 60_000);
    return () => clearInterval(id);
  }, [targetMs, secondsPhase, enabled]);

  return countdownParts(targetMs, now);
}
