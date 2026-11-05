import type { FixturesT, MatchT } from './schemas';

/**
 * Superpone los partidos del proxy en directo sobre la publicación estática.
 *
 * Reglas:
 * - Si no hay datos en directo, se devuelve la publicación tal cual.
 * - Si la temporada no coincide (cambio de temporada), manda el proxy.
 * - Si el proxy es más antiguo que la publicación (caché vieja u offline), se
 *   ignora: nunca se retrocede un resultado ya publicado.
 * - Los partidos nuevos del proxy se añaden; los existentes se reemplazan por id.
 */
export function mergeFixtures(
  base: FixturesT | undefined,
  live: FixturesT | null | undefined,
): FixturesT | undefined {
  if (!live) return base;
  if (!base) return live;
  const baseTime = Date.parse(base.updatedAt);
  const liveTime = Date.parse(live.updatedAt);
  if (Number.isFinite(baseTime) && (!Number.isFinite(liveTime) || liveTime < baseTime)) {
    return base;
  }
  if (base.season !== live.season) return live;

  const byId = new Map<number, MatchT>(base.matches.map((match) => [match.id, match]));
  for (const match of live.matches) byId.set(match.id, match);
  const matches = Array.from(byId.values()).sort(
    (a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate),
  );
  return { updatedAt: live.updatedAt, season: base.season, matches };
}
