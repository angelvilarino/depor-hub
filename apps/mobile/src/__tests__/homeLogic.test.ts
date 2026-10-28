import type { MatchT, StandingRowT, TeamRefT } from '@/data/schemas';
import {
  countdownParts,
  hasCountdown,
  isRecentResult,
  matchPhase,
  miniTableWindow,
  nextOpponentInfo,
  recentForm,
  seasonSummary,
  selectLastResult,
  selectNextMatch,
  selectPostponedNotice,
  showsSeconds,
  utcDayDiff,
} from '@/features/home/logic';
import { formatMatchTime } from '@/utils/matchTime';

const depor: TeamRefT = {
  id: 560,
  name: 'RC Deportivo La Coruña',
  shortName: 'Deportivo',
  tla: 'DEP',
  crestUrl: null,
};

const osasuna: TeamRefT = {
  id: 79,
  name: 'CA Osasuna',
  shortName: 'Osasuna',
  tla: 'OSA',
  crestUrl: null,
};

function match(
  id: number,
  utcDate: string,
  status: string,
  home = depor,
  away = osasuna,
  score: [number | null, number | null] = [null, null],
): MatchT {
  const [h, a] = score;
  return {
    id,
    utcDate,
    status,
    matchday: 10,
    stage: 'REGULAR_SEASON',
    home,
    away,
    score: {
      home: h,
      away: a,
      halfTimeHome: null,
      halfTimeAway: null,
      winner: h === null || a === null ? null : h > a ? 'HOME_TEAM' : h < a ? 'AWAY_TEAM' : 'DRAW',
    },
    deporIsHome: home.id === depor.id,
    venue: null,
    referee: null,
  };
}

function row(position: number, team: TeamRefT): StandingRowT {
  return {
    position,
    team,
    played: 10,
    won: 2,
    draw: 5,
    lost: 3,
    points: 11,
    goalsFor: 13,
    goalsAgainst: 13,
    goalDifference: 0,
    form: null,
  };
}

const table: StandingRowT[] = [
  row(1, osasuna),
  row(2, { ...osasuna, id: 2, shortName: 'Dos' }),
  row(3, { ...osasuna, id: 3, shortName: 'Tres' }),
  row(4, { ...osasuna, id: 4, shortName: 'Cuatro' }),
  row(5, { ...osasuna, id: 5, shortName: 'Cinco' }),
  row(6, { ...osasuna, id: 6, shortName: 'Seis' }),
  row(7, { ...osasuna, id: 7, shortName: 'Siete' }),
  row(8, { ...osasuna, id: 8, shortName: 'Ocho' }),
  row(9, { ...osasuna, id: 9, shortName: 'Nueve' }),
  row(10, { ...osasuna, id: 10, shortName: 'Diez' }),
  row(11, depor),
  row(12, { ...osasuna, id: 12, shortName: 'Doce' }),
  row(13, { ...osasuna, id: 13, shortName: 'Trece' }),
  row(14, { ...osasuna, id: 14, shortName: 'Catorce' }),
  row(15, { ...osasuna, id: 15, shortName: 'Quince' }),
  row(16, { ...osasuna, id: 16, shortName: 'Dieciséis' }),
  row(17, { ...osasuna, id: 17, shortName: 'Diecisiete' }),
  row(18, { ...osasuna, id: 18, shortName: 'Dieciocho' }),
  row(19, { ...osasuna, id: 19, shortName: 'Diecinueve' }),
  row(20, { ...osasuna, id: 20, shortName: 'Veinte' }),
];

describe('lógica de la Home', () => {
  it('elige el primer próximo partido jugable y descarta aplazados y cancelados', () => {
    const matches = [
      match(1, '2026-11-10T20:00:00Z', 'TIMED'),
      match(2, '2026-11-01T20:00:00Z', 'IN_PLAY'),
      match(3, '2026-11-05T20:00:00Z', 'POSTPONED'),
      match(4, '2026-10-20T20:00:00Z', 'FINISHED', depor, osasuna, [1, 0]),
      match(5, '2026-11-03T20:00:00Z', 'CANCELLED'),
    ];
    expect(selectNextMatch(matches)?.id).toBe(2);
    expect(selectNextMatch([match(3, '2026-11-05T20:00:00Z', 'POSTPONED')])).toBeNull();
    expect(selectNextMatch([])).toBeNull();
  });

  it('avisa del aplazado solo si es anterior al próximo partido jugable', () => {
    const postponed = match(1, '2026-11-03T20:00:00Z', 'POSTPONED');
    expect(selectPostponedNotice([postponed, match(2, '2026-11-10T20:00:00Z', 'TIMED')])?.id).toBe(1);
    expect(selectPostponedNotice([postponed, match(2, '2026-11-01T20:00:00Z', 'TIMED')])).toBeNull();
    expect(selectPostponedNotice([match(2, '2026-11-10T20:00:00Z', 'TIMED')])).toBeNull();
    expect(selectPostponedNotice([postponed])?.id).toBe(1);
  });

  it('elige el resultado más reciente y no confunde un aplazado con un resultado', () => {
    const matches = [
      match(1, '2026-10-20T20:00:00Z', 'FINISHED', depor, osasuna, [1, 0]),
      match(2, '2026-10-24T19:00:00Z', 'FINISHED', osasuna, depor, [2, 2]),
      match(3, '2026-11-05T20:00:00Z', 'POSTPONED'),
    ];
    expect(selectLastResult(matches)?.id).toBe(2);
    expect(selectLastResult([])).toBeNull();
  });

  it('centra la mini tabla en el Depor y la desplaza en los extremos', () => {
    expect(miniTableWindow(table, depor.id).map((r) => r.position)).toEqual([9, 10, 11, 12, 13]);
    expect(miniTableWindow(table, table[0]!.team.id).map((r) => r.position)).toEqual([1, 2, 3, 4, 5]);
    expect(miniTableWindow(table, table[1]!.team.id).map((r) => r.position)).toEqual([1, 2, 3, 4, 5]);
    expect(miniTableWindow(table, table[18]!.team.id).map((r) => r.position)).toEqual([16, 17, 18, 19, 20]);
    expect(miniTableWindow(table, table[19]!.team.id).map((r) => r.position)).toEqual([16, 17, 18, 19, 20]);
    expect(miniTableWindow(table.slice(0, 3), depor.id)).toEqual([]);
    expect(miniTableWindow([], depor.id)).toEqual([]);
    expect(miniTableWindow(table, 999)).toEqual([]);
  });

  it('devuelve los últimos cinco resultados en orden cronológico', () => {
    const matches = [
      match(1, '2026-09-01T20:00:00Z', 'FINISHED', depor, osasuna, [1, 0]),
      match(2, '2026-09-08T20:00:00Z', 'FINISHED', depor, osasuna, [1, 1]),
      match(3, '2026-09-15T20:00:00Z', 'FINISHED', depor, osasuna, [0, 1]),
      match(4, '2026-09-22T20:00:00Z', 'FINISHED', depor, osasuna, [2, 0]),
      match(5, '2026-09-29T20:00:00Z', 'FINISHED', depor, osasuna, [3, 1]),
      match(6, '2026-10-06T20:00:00Z', 'FINISHED', depor, osasuna, [1, 1]),
      match(7, '2026-10-13T20:00:00Z', 'TIMED'),
    ];
    expect(recentForm(matches)).toEqual(['D', 'L', 'W', 'W', 'D']);
    expect(recentForm(matches, 0)).toEqual([]);
  });

  it('resume la temporada desde la clasificación', () => {
    expect(seasonSummary({ updatedAt: '2026-10-25T00:00:00Z', season: '2026-27', matchday: 10, table }, depor.id)).toMatchObject({
      position: 11,
      points: 11,
      played: 10,
      won: 2,
      drawn: 5,
      lost: 3,
      goalsFor: 13,
      goalsAgainst: 13,
      goalDifference: 0,
    });
    expect(seasonSummary(undefined, depor.id)).toBeNull();
  });

  it('calcula el balance contra el próximo rival sin inventar partidos', () => {
    const matches = [
      match(1, '2026-10-01T20:00:00Z', 'FINISHED', depor, osasuna, [2, 1]),
      match(2, '2026-10-08T20:00:00Z', 'FINISHED', osasuna, depor, [0, 0]),
      match(3, '2026-11-02T20:00:00Z', 'TIMED'),
    ];
    const info = nextOpponentInfo(matches, table, depor.id);
    expect(info?.opponent.id).toBe(osasuna.id);
    expect(info?.row?.position).toBe(1);
    expect(info?.balance).toEqual({
      played: 2,
      won: 1,
      drawn: 1,
      lost: 0,
      goalsFor: 2,
      goalsAgainst: 1,
    });
    expect(info?.form).toEqual(['L', 'D']);

    const withoutHistory = nextOpponentInfo([match(3, '2026-11-02T20:00:00Z', 'TIMED')], table, depor.id);
    expect(withoutHistory?.balance).toBeNull();
    expect(withoutHistory?.form).toEqual([]);
    expect(nextOpponentInfo([], table, depor.id)).toBeNull();
  });

  it('traduce el estado de la API a la fase de presentación', () => {
    const now = Date.parse('2026-11-02T20:00:00Z');
    expect(matchPhase(match(1, '2026-11-02T20:00:00Z', 'SCHEDULED'), now)).toBe('tbc');
    expect(matchPhase(match(2, '2026-11-02T21:00:00Z', 'TIMED'), now)).toBe('upcoming');
    expect(matchPhase(match(3, '2026-11-02T19:00:00Z', 'TIMED'), now)).toBe('awaiting_result');
    expect(matchPhase(match(4, '2026-11-02T19:00:00Z', 'IN_PLAY'), now)).toBe('live');
    expect(matchPhase(match(5, '2026-11-02T19:00:00Z', 'PAUSED'), now)).toBe('live');
    expect(
      matchPhase(match(6, '2026-11-02T19:00:00Z', 'FINISHED', depor, osasuna, [2, 1]), now),
    ).toBe('finished');
    expect(matchPhase(match(7, '2026-11-02T19:00:00Z', 'FINISHED'), now)).toBe('awaiting_result');
    expect(matchPhase(match(8, '2026-11-02T19:00:00Z', 'POSTPONED'), now)).toBe('postponed');
    expect(matchPhase(match(9, '2026-11-02T19:00:00Z', 'SUSPENDED'), now)).toBe('suspended');
    expect(matchPhase(match(10, '2026-11-02T19:00:00Z', 'CANCELLED'), now)).toBe('cancelled');
    expect(matchPhase(match(11, '2026-11-02T19:00:00Z', 'OTHER'), now)).toBe('unknown');
  });

  it('destaca el resultado solo durante 24 horas', () => {
    const finished = match(1, '2026-10-24T19:00:00Z', 'FINISHED', depor, osasuna, [1, 0]);
    expect(isRecentResult(finished, Date.parse('2026-10-25T10:00:00Z'))).toBe(true);
    expect(isRecentResult(finished, Date.parse('2026-10-26T10:00:00Z'))).toBe(false);
    expect(isRecentResult(match(2, '2026-10-24T19:00:00Z', 'TIMED'), Date.parse('2026-10-25T10:00:00Z'))).toBe(false);
  });

  it('descompone la cuenta atrás y no baja de cero', () => {
    const now = Date.parse('2026-11-01T00:00:00Z');
    expect(countdownParts(now + 90_061_000, now)).toMatchObject({
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
      expired: false,
    });
    expect(countdownParts(now - 1, now)).toMatchObject({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      expired: true,
    });
  });

  it('solo permite cuenta atrás fiable en TIMED y segundos bajo una hora', () => {
    expect(hasCountdown(match(1, '2026-11-02T20:00:00Z', 'TIMED'))).toBe(true);
    expect(hasCountdown(match(2, '2026-11-02T00:00:00Z', 'SCHEDULED'))).toBe(false);
    expect(hasCountdown(match(3, '2026-11-02T20:00:00Z', 'POSTPONED'))).toBe(false);
    expect(showsSeconds(3_600_000, 0)).toBe(false);
    expect(showsSeconds(3_599_999, 0)).toBe(true);
    expect(showsSeconds(0, 0)).toBe(false);
  });

  it('calcula días UTC y respeta CET/CEST al mostrar la hora de Madrid', () => {
    const now = Date.parse('2026-10-27T10:00:00Z');
    expect(utcDayDiff('2026-11-02T20:00:00Z', now)).toBe(6);
    expect(utcDayDiff('2026-10-27T23:00:00Z', now)).toBe(0);
    // CET (+1) en noviembre y CEST (+2) en agosto.
    expect(formatMatchTime('2026-11-02T20:00:00Z', 'TIMED', 'es-ES')).toBe('21:00');
    expect(formatMatchTime('2026-08-17T19:00:00Z', 'FINISHED', 'es-ES')).toBe('21:00');
  });
});
