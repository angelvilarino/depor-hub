import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { nowMs } from '@/utils/clock';

/**
 * Devuelve el instante actual y lo refresca cada `intervalMs`.
 *
 * - Se pausa cuando la app deja de estar activa y se reanuda al volver, sin acumular
 *   intervalos ni renders en segundo plano.
 * - Cada componente que lo usa mantiene su propio reloj: la cuenta atrás puede latir
 *   cada segundo sin volver a pintar el resto de la tarjeta.
 */
export function useNow(intervalMs = 60_000, enabled = true): number {
  const [now, setNow] = useState(nowMs);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    function stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      stop();
      setNow(nowMs());
      timer = setInterval(() => setNow(nowMs()), intervalMs);
    }

    start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, [intervalMs, enabled]);

  return now;
}
