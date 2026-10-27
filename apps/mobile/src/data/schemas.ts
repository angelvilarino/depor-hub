// Espejo en Zod de los contratos públicos v1 (origen: scripts/depor_hub/models.py, ADR 0003).
// Si cambias algo aquí, cambia también el modelo Pydantic y los ejemplos en packages/schemas/examples.
import { z } from 'zod';

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'fecha ISO inválida');

// Campos añadidos en ADR 0006 (crestUrl, venue, referee): Python siempre los emite, pero aquí
// toleramos su ausencia (default null) para no romper con un JSON publicado antes del cambio.
const optionalNull = () => z.string().nullable().default(null);
const optionalInt = () => z.number().int().nullable().default(null);

export const Confidence = z.enum(['verified', 'cross_checked', 'single_source', 'estimated']);
export const Provenance = z.strictObject({
  source: z.string(),
  confidence: Confidence.default('single_source'),
  capturedAt: optionalNull(),
});

export const Social = z.strictObject({
  x: optionalNull(),
  instagram: optionalNull(),
  tiktok: optionalNull(),
});

export const PlayerPhoto = z.strictObject({
  url: z.string(),
  role: z.enum(['portrait', 'action', 'other']).default('portrait'),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  license: optionalNull(),
  licenseUrl: optionalNull(),
  author: optionalNull(),
  credit: optionalNull(),
  sourceUrl: optionalNull(),
});

export const CareerSeason = z.strictObject({
  season: z.string(),
  appearances: optionalInt(),
  goals: optionalInt(),
  assists: optionalInt(),
  minutes: optionalInt(),
  yellowCards: optionalInt(),
  redCards: optionalInt(),
});

export const CareerEntry = z.strictObject({
  club: z.string(),
  // ADR 0012: escudo externo del club; tolerado ausente en JSON y caché anteriores.
  crestUrl: optionalNull(),
  // ADR 0014: trayectoria como jugador o entrenador. Default para JSON anteriores.
  role: z.enum(['player', 'coach']).default('player'),
  from: optionalNull(),
  to: optionalNull(),
  appearances: optionalInt(),
  goals: optionalInt(),
  assists: optionalInt(),
  minutes: optionalInt(),
  yellowCards: optionalInt(),
  redCards: optionalInt(),
  seasons: z.array(CareerSeason).default([]),
});

export const CareerTotals = z.strictObject({
  appearances: optionalInt(),
  goals: optionalInt(),
  assists: optionalInt(),
  minutes: optionalInt(),
  yellowCards: optionalInt(),
  redCards: optionalInt(),
});

export const PlayerMatch = z.strictObject({
  date: z.string(),
  opponent: z.string(),
  // ADR 0012: escudo externo del rival; tolerado ausente en JSON y caché anteriores.
  opponentCrestUrl: optionalNull(),
  competition: optionalNull(),
  home: z.boolean(),
  teamGoals: optionalInt(),
  opponentGoals: optionalInt(),
  result: z.enum(['W', 'D', 'L']).nullable().default(null),
  started: z.boolean().nullable().default(null),
  minutes: optionalInt(),
  goals: optionalInt(),
  assists: optionalInt(),
  yellowCards: optionalInt(),
  redCards: optionalInt(),
});

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

// Contrato mínimo de H5 para titulares; H6 añadirá la ingesta RSS. Es aditivo y
// news.json puede no existir: la query lo trata como «sin titulares».
export const NewsItem = z.strictObject({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  sourceName: z.string(),
  publishedAt: iso,
  thumbnailUrl: optionalNull(),
  tags: z.array(z.string()).default([]),
});

export const News = z.strictObject({
  updatedAt: iso,
  items: z.array(NewsItem),
});

export const StaffMember = z.strictObject({
  name: z.string(),
  role: z.string(),
  photoUrl: optionalNull(),
});

export const Coach = z
  .strictObject({
    name: z.string().nullable(),
    nationality: z.string().nullable(),
    birthDate: optionalNull(),
    // ADR 0014: campos aditivos con default para leer JSON y caché anteriores.
    birthPlace: optionalNull(),
    photoUrl: optionalNull(),
    since: optionalNull(),
    contractUntil: optionalNull(),
    career: z.array(CareerEntry).default([]),
    staff: z.array(StaffMember).default([]),
    provenance: z.record(z.string(), Provenance).default({}),
  })
  .default({
    name: null,
    nationality: null,
    birthDate: null,
    birthPlace: null,
    photoUrl: null,
    since: null,
    contractUntil: null,
    career: [],
    staff: [],
    provenance: {},
  });

export const Player = z.strictObject({
  id: z.number().int(),
  name: z.string(),
  position: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  nationality: z.string().nullable(),
  shirtNumber: z.number().int().nullable(),
  contractUntil: z.string().nullable(),
  // ADR 0007: campo añadido; tolerado ausente (default null) para JSON publicado antes del cambio.
  heightCm: z.number().int().nullable().default(null),
  // ADR 0008: ampliación aditiva. Los defaults permiten leer JSON y caché anteriores.
  birthPlace: optionalNull(),
  preferredFoot: z.enum(['left', 'right', 'both']).nullable().default(null),
  loanFrom: optionalNull(),
  // ADR 0010: cesión de salida (el Depor cede al jugador a otro club).
  loanTo: optionalNull(),
  marketValueEur: optionalInt(),
  weightKg: optionalInt(),
  social: Social.default({ x: null, instagram: null, tiktok: null }),
  // ADR 0009: fotos con licencia; tolerado ausente (default []) para JSON y caché anteriores.
  photos: z.array(PlayerPhoto).default([]),
  career: z.array(CareerEntry).default([]),
  careerTotals: CareerTotals.default({
    appearances: null,
    goals: null,
    assists: null,
    minutes: null,
    yellowCards: null,
    redCards: null,
  }),
  deporMatches: z.array(PlayerMatch).default([]),
  provenance: z.record(z.string(), Provenance).default({}),
});

export const Squad = z.strictObject({
  updatedAt: iso,
  coach: Coach.nullable(),
  players: z.array(Player),
});

export type MetaT = z.infer<typeof Meta>;
export type StandingsT = z.infer<typeof Standings>;
export type StandingRowT = z.infer<typeof StandingRow>;
export type FixturesT = z.infer<typeof Fixtures>;
export type NewsT = z.infer<typeof News>;
export type NewsItemT = z.infer<typeof NewsItem>;
export type SquadT = z.infer<typeof Squad>;
export type MatchT = z.infer<typeof Match>;
export type PlayerT = z.infer<typeof Player>;
export type TeamRefT = z.infer<typeof TeamRef>;
export type CoachT = z.infer<typeof Coach>;
export type StaffMemberT = z.infer<typeof StaffMember>;
export type SocialT = z.infer<typeof Social>;
export type PlayerPhotoT = z.infer<typeof PlayerPhoto>;
export type CareerSeasonT = z.infer<typeof CareerSeason>;
export type CareerEntryT = z.infer<typeof CareerEntry>;
export type CareerTotalsT = z.infer<typeof CareerTotals>;
export type PlayerMatchT = z.infer<typeof PlayerMatch>;
export type ProvenanceT = z.infer<typeof Provenance>;
export type ConfidenceT = z.infer<typeof Confidence>;
