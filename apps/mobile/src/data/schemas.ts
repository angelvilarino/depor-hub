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

// Snapshot congelado de un partido terminado (ADR 0028). Se escribe una sola vez y
// solo contiene datos publicados por la fuente: sin eventos, alineaciones ni estadísticas.
export const MatchSnapshot = z.strictObject({
  matchId: z.number().int(),
  season: z.string(),
  capturedAt: iso,
  source: z.string().default('football-data.org'),
  status: z.enum(['FINISHED', 'AWARDED']),
  utcDate: iso,
  matchday: optionalInt(),
  stage: optionalNull(),
  home: TeamRef,
  away: TeamRef,
  score: Score,
  deporIsHome: z.boolean(),
  venue: optionalNull(),
  referee: optionalNull(),
});

// Detalle de partido (ADR 0031). Solo hechos publicados por BDFutbol: alineaciones,
// goles, tarjetas y cambios. Sin estadísticas, fotos ni eventos deducidos.
export const MatchSide = z.enum(['home', 'away']);
export const MatchCardKind = z.enum(['yellow', 'red', 'second_yellow']);

export const MatchDetailTeam = z.strictObject({
  name: z.string(),
  bdfutbolId: z.number().int().positive().nullable().default(null),
});

export const MatchDetailPlayer = z.strictObject({
  name: z.string(),
  shirtNumber: z.number().int().nonnegative().nullable().default(null),
  bdfutbolId: z.number().int().positive().nullable().default(null),
});

export const MatchDetailLineup = z.strictObject({
  coach: optionalNull(),
  starters: z.array(MatchDetailPlayer).default([]),
  substitutes: z.array(MatchDetailPlayer).default([]),
});

export const MatchDetailLineups = z.strictObject({
  home: MatchDetailLineup,
  away: MatchDetailLineup,
});

export const MatchDetailScoreAfter = z.strictObject({
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
});

export const MatchDetailGoal = z.strictObject({
  minute: z.number().int().nonnegative(),
  minuteLabel: z.string(),
  team: MatchSide,
  player: z.string(),
  ownGoal: z.boolean().default(false),
  penalty: z.boolean().default(false),
  scoreAfter: MatchDetailScoreAfter.nullable().default(null),
});

export const MatchDetailCard = z.strictObject({
  minute: z.number().int().nonnegative(),
  minuteLabel: z.string(),
  team: MatchSide,
  player: z.string(),
  kind: MatchCardKind,
});

export const MatchDetailSubstitution = z.strictObject({
  minute: z.number().int().nonnegative(),
  minuteLabel: z.string(),
  team: MatchSide,
  playerOut: optionalNull(),
  playerIn: optionalNull(),
});

export const MatchDetail = z.strictObject({
  matchId: z.number().int(),
  season: z.string(),
  source: z.string().default('BDFutbol'),
  sourceUrl: z.string(),
  bdfutbolId: z.number().int().positive(),
  capturedAt: iso,
  competition: optionalNull(),
  matchday: optionalInt(),
  date: z.string(),
  venue: optionalNull(),
  referee: optionalNull(),
  home: MatchDetailTeam,
  away: MatchDetailTeam,
  deporIsHome: z.boolean(),
  score: Score,
  lineups: MatchDetailLineups,
  goals: z.array(MatchDetailGoal).default([]),
  cards: z.array(MatchDetailCard).default([]),
  substitutions: z.array(MatchDetailSubstitution).default([]),
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

// Club (H7, ADR 0025). El contrato no publica source/confidence/status: la app no
// muestra procedencia. Todos los campos nuevos tienen default para tolerar un
// club.json mínimo o una caché anterior.
export const ClubContact = z.strictObject({
  email: optionalNull(),
  phone: optionalNull(),
  address: optionalNull(),
});

export const ClubIdentity = z.strictObject({
  officialName: z.string(),
  shortName: optionalNull(),
  foundedYear: z.number().int().min(1800).max(2100).nullable().default(null),
  city: optionalNull(),
  country: optionalNull(),
  colors: z.array(z.string()).default([]),
  nicknames: z.array(z.string()).default([]),
  motto: optionalNull(),
  president: optionalNull(),
  entity: optionalNull(),
  headquarters: optionalNull(),
  website: optionalNull(),
  contact: ClubContact.default({ email: null, phone: null, address: null }),
});

export const AnthemKind = z.enum(['oficial', 'no_oficial', 'popular']);

export const MediaKind = z.enum(['photo', 'video', 'audio', 'document']);
export const MediaOrigin = z.enum(['commons', 'club_official', 'press', 'other']);

export const MediaRef = z.strictObject({
  url: z.string(),
  kind: MediaKind.default('photo'),
  width: z.number().int().nonnegative().nullable().default(null),
  height: z.number().int().nonnegative().nullable().default(null),
  license: optionalNull(),
  licenseUrl: optionalNull(),
  author: optionalNull(),
  credit: optionalNull(),
  sourceUrl: optionalNull(),
  origin: MediaOrigin.default('other'),
  verifiedAt: optionalNull(),
});

export const LyricsRightsStatus = z.enum([
  'licensed',
  'public_domain',
  'permission_granted',
  'unknown',
]);

export const AnthemLyricsRights = z.strictObject({
  status: LyricsRightsStatus.default('unknown'),
  holder: optionalNull(),
  license: optionalNull(),
  licenseUrl: optionalNull(),
  sourceUrl: optionalNull(),
  note: optionalNull(),
  verifiedAt: optionalNull(),
});

export const AnthemCredit = z.strictObject({
  role: z.string(),
  names: z.array(z.string()).default([]),
  text: optionalNull(),
});

export const Anthem = z.strictObject({
  id: z.string(),
  title: z.string(),
  kind: AnthemKind.nullable().default(null),
  authors: z.array(z.string()).default([]),
  year: z.number().int().min(1800).max(2100).nullable().default(null),
  description: optionalNull(),
  // Letra completa con saltos de línea. null si el usuario no ha rellenado el .txt.
  lyrics: optionalNull(),
  audioUrl: optionalNull(),
  credits: z.array(AnthemCredit).default([]),
  media: MediaRef.nullable().default(null),
  lyricsRights: AnthemLyricsRights.nullable().default(null),
});

export const CrestVersion = z.strictObject({
  id: z.string(),
  yearFrom: z.number().int().min(1800).max(2100),
  yearTo: z.number().int().min(1800).max(2100).nullable().default(null),
  description: optionalNull(),
  // Ruta relativa a data/public/v1; no es una URL externa.
  image: optionalNull(),
  media: MediaRef.nullable().default(null),
});

export const KitType = z.enum([
  'home',
  'away',
  'third',
  'gk_home',
  'gk_away',
  'gk_third',
  'special',
]);

export const Kit = z.strictObject({
  type: KitType,
  manufacturer: optionalNull(),
  chestSponsor: optionalNull(),
  sleeveSponsor: optionalNull(),
  backSponsor: optionalNull(),
  colors: z.array(z.string()).default([]),
  description: optionalNull(),
  image: optionalNull(),
  media: MediaRef.nullable().default(null),
});

export const SeasonKits = z.strictObject({
  season: z.string().regex(/^\d{4}-\d{2}$/),
  kits: z.array(Kit).default([]),
});

export const StadiumCoordinates = z.strictObject({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const CapacityZone = z.strictObject({
  zone: z.string(),
  seats: z.number().int().nonnegative(),
});

export const CapacityAlternative = z.strictObject({
  label: z.string(),
  total: z.number().int().nonnegative(),
  note: optionalNull(),
  sourceUrl: optionalNull(),
});

export const VenueSchedule = z.strictObject({
  days: optionalNull(),
  hours: optionalNull(),
  note: optionalNull(),
  sourceUrl: optionalNull(),
  verifiedAt: optionalNull(),
});

export const VenueAccess = z.strictObject({
  publicTransport: optionalNull(),
  parking: optionalNull(),
  accessibility: optionalNull(),
  note: optionalNull(),
  sourceUrl: optionalNull(),
});

export const Tenure = z.strictObject({
  club: z.string(),
  fromYear: z.number().int().min(1800).max(2100).nullable().default(null),
  toYear: z.number().int().min(1800).max(2100).nullable().default(null),
  note: optionalNull(),
  sourceUrl: optionalNull(),
});

export const Capacity = z
  .strictObject({
    total: z.number().int().nonnegative(),
    breakdown: z.array(CapacityZone).default([]),
  })
  .refine(
    (value) => value.total === value.breakdown.reduce((sum, zone) => sum + zone.seats, 0),
    'capacity.total debe ser la suma del desglose',
  );

export const Stadium = z.strictObject({
  name: z.string(),
  address: optionalNull(),
  coordinates: StadiumCoordinates.nullable().default(null),
  openedOn: optionalNull(),
  renovations: z.array(z.string()).default([]),
  pitch: optionalNull(),
  dimensions: optionalNull(),
  access: optionalNull(),
  transport: optionalNull(),
  parking: optionalNull(),
  capacity: Capacity.nullable().default(null),
  description: optionalNull(),
  schedule: VenueSchedule.nullable().default(null),
  accessDetails: VenueAccess.nullable().default(null),
  capacityAlternatives: z.array(CapacityAlternative).default([]),
  tenants: z.array(Tenure).default([]),
  media: z.array(MediaRef).default([]),
});

export const Price = z.strictObject({
  label: z.string(),
  priceEur: z.number().nonnegative().nullable().default(null),
  note: optionalNull(),
});

export const Tickets = z.strictObject({
  season: optionalNull(),
  zones: z.array(Price).default([]),
  purchaseUrl: optionalNull(),
  note: optionalNull(),
});

export const ClubLink = z.strictObject({
  id: z.string(),
  label: z.string(),
  url: z.string(),
});

export const Museum = z.strictObject({
  name: optionalNull(),
  location: optionalNull(),
  description: optionalNull(),
  schedule: optionalNull(),
  prices: z.array(Price).default([]),
  links: z.array(ClubLink).default([]),
});

export const TrainingCenter = z.strictObject({
  name: optionalNull(),
  location: optionalNull(),
  description: optionalNull(),
  facilities: z.array(z.string()).default([]),
  coordinates: StadiumCoordinates.nullable().default(null),
});

export const BoardMember = z.strictObject({
  name: z.string(),
  role: optionalNull(),
});

export const Board = z.strictObject({
  president: optionalNull(),
  members: z.array(BoardMember).default([]),
  sportingDirector: optionalNull(),
  note: optionalNull(),
});

export const SponsorRole = z.enum(['principal', 'technical', 'official', 'collaborator', 'other']);

export const Sponsor = z.strictObject({
  name: z.string(),
  role: SponsorRole.default('official'),
  category: optionalNull(),
  sinceYear: z.number().int().min(1800).max(2100).nullable().default(null),
  untilYear: z.number().int().min(1800).max(2100).nullable().default(null),
  url: optionalNull(),
  note: optionalNull(),
  sourceUrl: optionalNull(),
  verifiedAt: optionalNull(),
});

export const Sponsors = z.strictObject({
  principal: optionalNull(),
  technical: optionalNull(),
  official: z.array(z.string()).default([]),
  collaborators: z.array(z.string()).default([]),
  sinceYear: z.number().int().min(1800).max(2100).nullable().default(null),
  details: z.array(Sponsor).default([]),
});

export const Title = z.strictObject({
  competition: z.string(),
  years: z.array(z.number().int()).default([]),
});

export const TitleScope = z.enum(['national', 'regional', 'international', 'other']);

export const GoalScorer = z.strictObject({
  player: z.string(),
  goals: z.number().int().nonnegative(),
  note: optionalNull(),
});

export const FinalMatch = z.strictObject({
  date: optionalNull(),
  competition: optionalNull(),
  round: optionalNull(),
  home: optionalNull(),
  away: optionalNull(),
  homeGoals: z.number().int().nonnegative().nullable().default(null),
  awayGoals: z.number().int().nonnegative().nullable().default(null),
  venue: optionalNull(),
  note: optionalNull(),
  sourceUrl: optionalNull(),
});

export const TitleSquadMember = z.strictObject({
  name: z.string(),
  role: optionalNull(),
  appearances: z.number().int().nonnegative().nullable().default(null),
  goals: z.number().int().nonnegative().nullable().default(null),
});

export const TitleEdition = z.strictObject({
  competition: z.string(),
  year: z.number().int().min(1800).max(2100),
  season: optionalNull(),
  scope: TitleScope.nullable().default(null),
  finalMatch: FinalMatch.nullable().default(null),
  topScorers: z.array(GoalScorer).default([]),
  squad: z.array(TitleSquadMember).default([]),
  note: optionalNull(),
  provenance: Provenance,
});

export const Titles = z.strictObject({
  updatedAt: iso,
  editions: z.array(TitleEdition).default([]),
});

export const Rivalry = z.strictObject({
  rival: z.string(),
  description: optionalNull(),
  sinceYear: z.number().int().min(1800).max(2100).nullable().default(null),
});

export const RivalryMeeting = z.strictObject({
  date: z.string(),
  competition: optionalNull(),
  round: optionalNull(),
  home: z.string(),
  away: z.string(),
  homeGoals: z.number().int().nonnegative(),
  awayGoals: z.number().int().nonnegative(),
  note: optionalNull(),
  sourceUrl: optionalNull(),
});

export const RivalryFact = z.strictObject({
  text: z.string(),
  provenance: Provenance,
});

export const RivalryDetail = z.strictObject({
  rival: z.string(),
  rivalBdfutbolId: optionalNull(),
  description: optionalNull(),
  sinceYear: z.number().int().min(1800).max(2100).nullable().default(null),
  headToHead: HeadToHead.nullable().default(null),
  iconicMatches: z.array(RivalryMeeting).default([]),
  facts: z.array(RivalryFact).default([]),
  media: z.array(MediaRef).default([]),
  provenance: Provenance,
});

export const Rivalries = z.strictObject({
  updatedAt: iso,
  rivalries: z.array(RivalryDetail).default([]),
});

export const ClubLinks = z.strictObject({
  website: optionalNull(),
  app: optionalNull(),
  x: optionalNull(),
  instagram: optionalNull(),
  tiktok: optionalNull(),
  youtube: optionalNull(),
  facebook: optionalNull(),
  twitch: optionalNull(),
  whatsapp: optionalNull(),
  store: optionalNull(),
  tickets: optionalNull(),
  museum: optionalNull(),
  others: z.array(ClubLink).default([]),
});

export const Club = z.strictObject({
  updatedAt: iso,
  identity: ClubIdentity,
  anthems: z.array(Anthem).default([]),
  crests: z.array(CrestVersion).default([]),
  kits: z.array(SeasonKits).default([]),
  stadium: Stadium.nullable().default(null),
  tickets: Tickets.nullable().default(null),
  museum: Museum.nullable().default(null),
  trainingCenter: TrainingCenter.nullable().default(null),
  board: Board.nullable().default(null),
  sponsors: Sponsors.nullable().default(null),
  titles: z.array(Title).default([]),
  rivalries: z.array(Rivalry).default([]),
  facts: z.array(z.string()).default([]),
  links: ClubLinks.default({
    website: null,
    app: null,
    x: null,
    instagram: null,
    tiktok: null,
    youtube: null,
    facebook: null,
    twitch: null,
    whatsapp: null,
    store: null,
    tickets: null,
    museum: null,
    others: [],
  }),
  media: z.array(MediaRef).default([]),
});

export const StaffMember = z.strictObject({
  name: z.string(),
  role: z.string(),
  photoUrl: optionalNull(),
});export const Coach = z
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

export const StatusFile = z.strictObject({
  name: z.string(),
  present: z.boolean(),
  updatedAt: optionalNull(),
  ageMinutes: optionalInt(),
  detail: optionalNull(),
});

export const StatusWorkflow = z.strictObject({
  name: z.string(),
  file: z.string(),
  conclusion: optionalNull(),
  updatedAt: optionalNull(),
  url: optionalNull(),
});

export const Status = z.strictObject({
  updatedAt: iso,
  commit: optionalNull(),
  ok: z.boolean(),
  files: z.array(StatusFile).default([]),
  workflows: z.array(StatusWorkflow).default([]),
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
export type MatchSnapshotT = z.infer<typeof MatchSnapshot>;
export type MatchSideT = z.infer<typeof MatchSide>;
export type MatchCardKindT = z.infer<typeof MatchCardKind>;
export type MatchDetailT = z.infer<typeof MatchDetail>;
export type MatchDetailTeamT = z.infer<typeof MatchDetailTeam>;
export type MatchDetailPlayerT = z.infer<typeof MatchDetailPlayer>;
export type MatchDetailLineupT = z.infer<typeof MatchDetailLineup>;
export type MatchDetailGoalT = z.infer<typeof MatchDetailGoal>;
export type MatchDetailCardT = z.infer<typeof MatchDetailCard>;
export type MatchDetailSubstitutionT = z.infer<typeof MatchDetailSubstitution>;
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
export type ClubT = z.infer<typeof Club>;
export type ClubIdentityT = z.infer<typeof ClubIdentity>;
export type AnthemT = z.infer<typeof Anthem>;
export type AnthemCreditT = z.infer<typeof AnthemCredit>;
export type AnthemLyricsRightsT = z.infer<typeof AnthemLyricsRights>;
export type MediaRefT = z.infer<typeof MediaRef>;
export type MediaKindT = z.infer<typeof MediaKind>;
export type MediaOriginT = z.infer<typeof MediaOrigin>;
export type CrestVersionT = z.infer<typeof CrestVersion>;
export type SeasonKitsT = z.infer<typeof SeasonKits>;
export type KitT = z.infer<typeof Kit>;
export type StadiumT = z.infer<typeof Stadium>;
export type CapacityT = z.infer<typeof Capacity>;
export type CapacityZoneT = z.infer<typeof CapacityZone>;
export type CapacityAlternativeT = z.infer<typeof CapacityAlternative>;
export type VenueScheduleT = z.infer<typeof VenueSchedule>;
export type VenueAccessT = z.infer<typeof VenueAccess>;
export type TenureT = z.infer<typeof Tenure>;
export type TicketsT = z.infer<typeof Tickets>;
export type MuseumT = z.infer<typeof Museum>;
export type TrainingCenterT = z.infer<typeof TrainingCenter>;
export type BoardT = z.infer<typeof Board>;
export type BoardMemberT = z.infer<typeof BoardMember>;
export type SponsorsT = z.infer<typeof Sponsors>;
export type SponsorT = z.infer<typeof Sponsor>;
export type SponsorRoleT = z.infer<typeof SponsorRole>;
export type TitleT = z.infer<typeof Title>;
export type TitleEditionT = z.infer<typeof TitleEdition>;
export type TitlesT = z.infer<typeof Titles>;
export type FinalMatchT = z.infer<typeof FinalMatch>;
export type GoalScorerT = z.infer<typeof GoalScorer>;
export type TitleSquadMemberT = z.infer<typeof TitleSquadMember>;
export type RivalryT = z.infer<typeof Rivalry>;
export type RivalryDetailT = z.infer<typeof RivalryDetail>;
export type RivalriesT = z.infer<typeof Rivalries>;
export type RivalryMeetingT = z.infer<typeof RivalryMeeting>;
export type RivalryFactT = z.infer<typeof RivalryFact>;
export type ClubLinksT = z.infer<typeof ClubLinks>;
export type ClubLinkT = z.infer<typeof ClubLink>;
export type PriceT = z.infer<typeof Price>;
export type StatusFileT = z.infer<typeof StatusFile>;
export type StatusWorkflowT = z.infer<typeof StatusWorkflow>;
export type StatusT = z.infer<typeof Status>;
