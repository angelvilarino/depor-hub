import type { MatchSnapshotT, MatchT } from '@/data/schemas';

/**
 * Adapta un snapshot congelado al mismo tipo que un partido de fixtures.json.
 * Solo cambia el nombre `matchId`; el resto de campos ya comparte contrato.
 */
export function snapshotToMatch(snapshot: MatchSnapshotT): MatchT {
  return {
    id: snapshot.matchId,
    utcDate: snapshot.utcDate,
    status: snapshot.status,
    matchday: snapshot.matchday,
    stage: snapshot.stage,
    home: snapshot.home,
    away: snapshot.away,
    score: snapshot.score,
    deporIsHome: snapshot.deporIsHome,
    venue: snapshot.venue,
    referee: snapshot.referee,
  };
}
