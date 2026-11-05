import assert from 'node:assert/strict';
import test from 'node:test';
import { seasonLabel, toMatch, transformFixtures } from '../src/transform.js';

const depor = { id: 560, name: 'RC Deportivo', shortName: 'Deportivo', tla: 'DEP', crest: 'https://x/560.png' };
const rival = { id: 78, name: 'Atleti', shortName: 'Atleti', tla: 'ATL', crest: null };

function match(overrides = {}) {
  return {
    id: 1,
    utcDate: '2026-11-07T15:15:00Z',
    status: 'TIMED',
    matchday: 12,
    stage: 'REGULAR_SEASON',
    homeTeam: depor,
    awayTeam: rival,
    score: { winner: null, fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
    venue: 'Riazor',
    referees: [{ name: 'Árbitro Dos', type: 'ASSISTANT_REFEREE_N1' }, { name: 'Árbitro Uno', type: 'REFEREE' }],
    ...overrides,
  };
}

test('seasonLabel cruza julio y calcula el año corto', () => {
  assert.equal(seasonLabel('2026-08-01T00:00:00Z'), '2026-27');
  assert.equal(seasonLabel('2027-05-01T00:00:00Z'), '2026-27');
  assert.equal(seasonLabel('2026-06-30T00:00:00Z'), '2025-26');
});

test('toMatch publica solo los campos del contrato', () => {
  const out = toMatch(match());
  assert.deepEqual(out, {
    id: 1,
    utcDate: '2026-11-07T15:15:00Z',
    status: 'TIMED',
    matchday: 12,
    stage: 'REGULAR_SEASON',
    home: { id: 560, name: 'RC Deportivo', shortName: 'Deportivo', tla: 'DEP', crestUrl: 'https://x/560.png' },
    away: { id: 78, name: 'Atleti', shortName: 'Atleti', tla: 'ATL', crestUrl: null },
    score: { home: null, away: null, halfTimeHome: null, halfTimeAway: null, winner: null },
    deporIsHome: true,
    venue: 'Riazor',
    referee: 'Árbitro Uno',
  });
});

test('transformFixtures filtra al Depor, ordena y no inventa marcador', () => {
  const later = match({ id: 2, utcDate: '2026-12-01T18:00:00Z', homeTeam: rival, awayTeam: depor });
  const earlier = match({
    id: 3,
    utcDate: '2026-11-02T20:00:00Z',
    status: 'FINISHED',
    score: { winner: 'HOME_TEAM', fullTime: { home: 2, away: 1 }, halfTime: { home: 0, away: 1 } },
  });
  const other = match({ id: 4, homeTeam: rival, awayTeam: { ...rival, id: 90 } });

  const body = transformFixtures({ matches: [later, other, earlier] }, new Date('2026-11-05T10:00:00Z'));

  assert.equal(body.updatedAt, '2026-11-05T10:00:00.000Z');
  assert.equal(body.season, '2026-27');
  assert.deepEqual(body.matches.map((item) => item.id), [3, 2]);
  assert.equal(body.matches[0].score.home, 2);
  assert.equal(body.matches[1].deporIsHome, false);
});

test('transformFixtures tolera una respuesta vacía', () => {
  const body = transformFixtures({ matches: [] }, new Date('2026-11-05T10:00:00Z'));
  assert.equal(body.season, '2026-27');
  assert.deepEqual(body.matches, []);
});
