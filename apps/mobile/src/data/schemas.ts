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

// Temporada y contexto (H5.2, ADR 0017). Aditivo y opcional: la Home funciona con 404.
export const SeasonSummary = z.strictObject({
  position: z.number().int().positive(),
  points: z.number().int().nonnegative(),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  goalsFor: z.number().int().nonnegative(),
  goalsAgainst: z.number().int().nonnegative(),
  goalDifference: z.number().int(),
});

export const SeasonFormMatch = z.strictObject({
  matchId: z.number().int(),
  matchday: optionalInt(),
  date: z.string(),
  opponent: TeamRef,
  home: z.boolean(),
  scoreFor: z.number().int().nonnegative(),
  scoreAgainst: z.number().int().nonnegative(),
  result: z.enum(['W', 'D', 'L']),
});

export const PositionPoint = z.strictObject({
  matchday: z.number().int().nonnegative(),
  position: z.number().int().positive(),
  points: z.number().int().nonnegative(),
});

// z.object strips the retired whatIsAtStake field from older persisted caches.
export const Season = z.object({
  updatedAt: iso,
  season: z.string(),
  matchday: optionalInt(),
  team: TeamRef,
  summary: SeasonSummary,
  form: z.array(SeasonFormMatch).default([]),
  positionEvolution: z.array(PositionPoint).default([]),
  provenance: z.record(z.string(), Provenance).default({}),
});

export const HeadToHeadMeeting = z.strictObject({
  date: z.string(),
  competition: z.string(),
  round: optionalNull(),
  home: z.string(),
  away: z.string(),
  homeGoals: z.number().int().nonnegative(),
  awayGoals: z.number().int().nonnegative(),
  deporResult: z.enum(['W', 'D', 'L']),
});

export const HeadToHead = z.strictObject({
  scope: z.literal('all_official_matches').default('all_official_matches'),
  source: z.string().default('BDFutbol'),
  confidence: z.enum(['verified', 'cross_checked', 'single_source', 'estimated']).default('single_source'),
  sourceUrl: z.string(),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  goalsFor: z.number().int().nonnegative(),
  goalsAgainst: z.number().int().nonnegative(),
  meetings: z.array(HeadToHeadMeeting).default([]),
});

export const KeyPlayer = z.strictObject({
  id: z.number().int(),
  name: z.string(),
  goals: z.number().int().nonnegative(),
  assists: optionalInt(),
  playedMatches: optionalInt(),
});

export const Rival = z.strictObject({
  team: TeamRef,
  bdfutbolId: optionalNull(),
  coach: optionalNull(),
  keyPlayers: z.array(KeyPlayer).default([]),
  headToHead: HeadToHead.nullable().default(null),
});

export const Rivals = z.strictObject({
  updatedAt: iso,
  season: z.string(),
  rivals: z.array(Rival).default([]),
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

// Noticias (ADR 0018): una historia puede tener versiones en varios medios. El contrato
// rompe el anterior `items`/`meta`; la app se actualiza al mismo tiempo que el JSON.
export const NewsGroup = z.enum(['club', 'galicia', 'nacional']);

export const NewsSource = z.strictObject({
  id: z.string(),
  name: z.string(),
  group: NewsGroup,
  kind: z.enum(['article', 'video']).default('article'),
  homepage: z.string(),
  iconUrl: z.string().nullable().optional(),
});

export const NewsAlsoIn = z.strictObject({
  sourceId: z.string(),
  title: z.string(),
  url: z.string(),
  publishedAt: iso,
});

export const NewsStory = z.strictObject({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  sourceId: z.string(),
  publishedAt: iso,
  kind: z.enum(['article', 'video']).default('article'),
  summary: optionalNull(),
  thumbnailUrl: optionalNull(),
  tags: z.array(z.string()).default([]),
  alsoIn: z.array(NewsAlsoIn).default([]),
});

export const News = z.strictObject({
  updatedAt: iso,
  sources: z.array(NewsSource).default([]),
  stories: z.array(NewsStory).default([]),
});

// Redes (H6): solo perfiles y publicaciones curadas a mano. social.json es opcional.
export const SocialPlatform = z.enum([
  'x',
  'instagram',
  'youtube',
  'tiktok',
  'facebook',
  'whatsapp',
  'twitch',
  'bluesky',
  'threads',
]);

export const SocialProfile = z.strictObject({
  id: z.string(),
  platform: SocialPlatform,
  name: z.string(),
  url: z.string(),
  handle: optionalNull(),
});

export const SocialPin = z.strictObject({
  id: z.string(),
  platform: SocialPlatform,
  url: z.string(),
  title: z.string(),
  publishedAt: optionalNull(),
  imageUrl: optionalNull(),
  source: optionalNull(),
});

export const SocialFeed = z.strictObject({
  updatedAt: iso,
  dataHash: z.string().default(''),
  profiles: z.array(SocialProfile).default([]),
  pins: z.array(SocialPin).default([]),
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
export type SeasonT = z.infer<typeof Season>;
export type SeasonSummaryT = z.infer<typeof SeasonSummary>;
export type SeasonFormMatchT = z.infer<typeof SeasonFormMatch>;
export type PositionPointT = z.infer<typeof PositionPoint>;
export type RivalsT = z.infer<typeof Rivals>;
export type RivalT = z.infer<typeof Rival>;
export type HeadToHeadT = z.infer<typeof HeadToHead>;
export type HeadToHeadMeetingT = z.infer<typeof HeadToHeadMeeting>;
export type KeyPlayerT = z.infer<typeof KeyPlayer>;
export type FixturesT = z.infer<typeof Fixtures>;
export type NewsT = z.infer<typeof News>;
export type NewsStoryT = z.infer<typeof NewsStory>;
export type NewsAlsoInT = z.infer<typeof NewsAlsoIn>;
export type NewsGroupT = z.infer<typeof NewsGroup>;
export type NewsSourceT = z.infer<typeof NewsSource>;
export type SocialPlatformT = z.infer<typeof SocialPlatform>;
export type SocialProfileT = z.infer<typeof SocialProfile>;
export type SocialPinT = z.infer<typeof SocialPin>;
export type SocialFeedT = z.infer<typeof SocialFeed>;
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
