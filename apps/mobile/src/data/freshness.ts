export type Freshness = { unit: 'now' | 'minutes' | 'hours' | 'days'; n: number };

/** Antigüedad de la última sincronización correcta (ms epoch), en la unidad más natural. */
export function freshness(timestampMs: number, now: number = Date.now()): Freshness {
  const minutes = Math.max(0, Math.floor((now - timestampMs) / 60_000));
  if (minutes < 1) return { unit: 'now', n: 0 };
  if (minutes < 60) return { unit: 'minutes', n: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return { unit: 'hours', n: hours };
  return { unit: 'days', n: Math.floor(hours / 24) };
}
