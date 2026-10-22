// Espejo en Zod de los contratos públicos v1 (origen: scripts/depor_hub/models.py, ADR 0003).
// Si cambias algo aquí, cambia también el modelo Pydantic y los ejemplos en packages/schemas/examples.
import { z } from 'zod';

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'fecha ISO inválida');

// Campos añadidos en ADR 0006 (crestUrl, venue, referee): Python siempre los emite, pero aquí
// toleramos su ausencia (default null) para no romper con un JSON publicado antes del cambio.
const optionalNull = () => z.string().nullable().default(null);

export const TeamRef = z.strictObject({
  id: z.number().int(),
  name: z.string(),
  shortName: z.string().nullable(),
  tla: z.string().nullable(),
  crestUrl: optionalNull(),
});

export const Meta = z.strictObject({
  schemaVersion: z.literal(1),
  season: z.string(),
  competitionCode: z.string(),
  competitionName: z.string(),
  team: TeamRef.extend({ venue: z.string().nullable() }).strict(),
  updatedAt: iso,
  dataHash: z.string(),
  source: z.strictObject({ name: z.string(), url: z.string().nullable(), note: z.string().nullable() }),
});

export const StandingRow = z.strictObject({
  position: z.number().int(),
  team: TeamRef,
  played: z.number().int(),
  won: z.number().int(),
  draw: z.number().int(),
  lost: z.number().int(),
  points: z.number().int(),
  goalsFor: z.number().int(),
  goalsAgainst: z.number().int(),
  goalDifference: z.number().int(),
  form: z.string().nullable(),
});

export const Standings = z.strictObject({
  updatedAt: iso,
  season: z.string(),
  matchday: z.number().int().nullable(),
  table: z.array(StandingRow),
});

export const Score = z.strictObject({
  home: z.number().int().nullable(),
  away: z.number().int().nullable(),
  halfTimeHome: z.number().int().nullable(),
  halfTimeAway: z.number().int().nullable(),
  winner: z.string().nullable(),
});

export const Match = z.strictObject({
  id: z.number().int(),
  utcDate: iso,
  status: z.string(), // la app mapea estados conocidos; los desconocidos no deben romper el parseo
  matchday: z.number().int().nullable(),
  stage: z.string().nullable(),
  home: TeamRef,
  away: TeamRef,
  score: Score,
  deporIsHome: z.boolean(),
  venue: optionalNull(),
  referee: optionalNull(),
});

export const Fixtures = z.strictObject({
  updatedAt: iso,
  season: z.string(),
  matches: z.array(Match),
});

export const Player = z.strictObject({
  id: z.number().int(),
  name: z.string(),
  position: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  nationality: z.string().nullable(),
  shirtNumber: z.number().int().nullable(),
  contractUntil: z.string().nullable(),
});

export const Squad = z.strictObject({
  updatedAt: iso,
  coach: z.strictObject({ name: z.string().nullable(), nationality: z.string().nullable() }).nullable(),
  players: z.array(Player),
});

export type MetaT = z.infer<typeof Meta>;
export type StandingsT = z.infer<typeof Standings>;
export type FixturesT = z.infer<typeof Fixtures>;
export type SquadT = z.infer<typeof Squad>;
export type MatchT = z.infer<typeof Match>;
export type PlayerT = z.infer<typeof Player>;
export type TeamRefT = z.infer<typeof TeamRef>;
