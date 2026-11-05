/**
 * Transforma la respuesta de football-data.org al contrato `fixtures.json`.
 * Solo se publica lo que entrega la API: marcador, estado, equipos, sede y árbitro.
 * No se inventan eventos, alineaciones ni estadísticas.
 */

export const DEPOR_ID = 560;

export function seasonLabel(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const next = String((year + 1) % 100).padStart(2, '0');
  return `${year}-${next}`;
}

function team(value) {
  if (!value) return null;
  return {
    id: value.id ?? 0,
    name: value.name ?? '',
    shortName: value.shortName ?? null,
    tla: value.tla ?? null,
    crestUrl: value.crest ?? null,
  };
}

function score(value) {
  const fullTime = value?.fullTime ?? {};
  const halfTime = value?.halfTime ?? {};
  return {
    home: Number.isInteger(fullTime.home) ? fullTime.home : null,
    away: Number.isInteger(fullTime.away) ? fullTime.away : null,
    halfTimeHome: Number.isInteger(halfTime.home) ? halfTime.home : null,
    halfTimeAway: Number.isInteger(halfTime.away) ? halfTime.away : null,
    winner: value?.winner ?? null,
  };
}

export function refereeName(match) {
  const referees = Array.isArray(match.referees) ? match.referees : [];
  const main = referees.find((item) => item?.type === 'REFEREE') ?? referees[0];
  return main?.name ?? null;
}

export function toMatch(match) {
  const home = team(match.homeTeam);
  const away = team(match.awayTeam);
  if (!home || !away) return null;
  return {
    id: match.id,
    utcDate: match.utcDate,
    status: match.status ?? 'SCHEDULED',
    matchday: Number.isInteger(match.matchday) ? match.matchday : null,
    stage: match.stage ?? null,
    home,
    away,
    score: score(match.score),
    deporIsHome: home.id === DEPOR_ID,
    venue: match.venue ?? null,
    referee: refereeName(match),
  };
}

export function transformFixtures(payload, now = new Date()) {
  const all = Array.isArray(payload?.matches) ? payload.matches : [];
  const matches = all
    .filter(
      (match) => match?.homeTeam?.id === DEPOR_ID || match?.awayTeam?.id === DEPOR_ID,
    )
    .map(toMatch)
    .filter(Boolean)
    .sort((a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate));

  const sample = matches[0]?.utcDate ?? all[0]?.utcDate ?? now.toISOString();
  return {
    updatedAt: now.toISOString(),
    season: seasonLabel(sample),
    matches,
  };
}
