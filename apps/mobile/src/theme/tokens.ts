// Tokens de compatibilidad general y del sistema visual Cartel + Prensa.
export type PosterTokens = {
  stops: readonly [string, string, string];
  text: string;
  muted: string;
  accent: string;
  outcome: {
    winBackground: string;
    winText: string;
    drawBackground: string;
    drawText: string;
    lossBackground: string;
    lossText: string;
  };
};

export type PaperTokens = {
  background: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
};

export type NewsTokens = { sourceBadges: readonly string[] };

export type ColorTokens = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  border: string;
  danger: string;
  win: string;
  draw: string;
  loss: string;
  onImage: string;
  rating: string;
  poster: PosterTokens;
  paper: PaperTokens;
  news: NewsTokens;
};

export const lightColors: ColorTokens = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  text: '#0B1B2B',
  textMuted: '#4A5B6C',
  primary: '#00478F',
  onPrimary: '#FFFFFF',
  border: '#D5DDE6',
  danger: '#B3261E',
  win: '#0B6B4F',
  draw: '#8A5A00',
  loss: '#B3261E',
  onImage: '#FFFFFF',
  rating: '#C5A13B',
  poster: {
    stops: ['#003D75', '#00478F', '#075FA3'],
    text: '#FFFFFF',
    muted: '#E3EFFB',
    accent: '#FFD166',
    outcome: {
      winBackground: '#C7F2DD',
      winText: '#07513C',
      drawBackground: '#FFF0BD',
      drawText: '#654A00',
      lossBackground: '#FFDAD7',
      lossText: '#7A1F1A',
    },
  },
  paper: {
    background: '#FFF9ED',
    text: '#18324B',
    muted: '#526273',
    border: '#D8D0C1',
    accent: '#00478F',
  },
  news: { sourceBadges: ['#003D75', '#00478F', '#075FA3', '#123A63', '#2E4263'] },
};

export const darkColors: ColorTokens = {
  background: '#0B1220',
  surface: '#121C2E',
  text: '#EAF0F7',
  textMuted: '#A7B4C4',
  primary: '#6FA8F5',
  onPrimary: '#0B1220',
  border: '#263449',
  danger: '#F2B8B5',
  win: '#5FD3A6',
  draw: '#F2C14E',
  loss: '#F2B8B5',
  onImage: '#FFFFFF',
  rating: '#F4C542',
  poster: {
    stops: ['#003D75', '#00478F', '#075FA3'],
    text: '#FFFFFF',
    muted: '#E3EFFB',
    accent: '#FFD166',
    outcome: {
      winBackground: '#C7F2DD',
      winText: '#07513C',
      drawBackground: '#FFF0BD',
      drawText: '#654A00',
      lossBackground: '#FFDAD7',
      lossText: '#7A1F1A',
    },
  },
  paper: {
    // D-12: el papel oscuro necesita separarse del fondo (1,35:1) para no
    // desaparecer como bloque editorial.
    background: '#202D42',
    text: '#F1F5F9',
    muted: '#B7C4D2',
    border: '#394555',
    accent: '#9FC8FF',
  },
  news: { sourceBadges: ['#003D75', '#00478F', '#075FA3', '#123A63', '#2E4263'] },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
// Paleta de equipaciones y avatares: son colores de dominio, no de interfaz.
export const kitColors = {
  white: '#F8FAFC',
  blue: '#0876BD',
  navy: '#102A43',
  black: '#111827',
  red: '#C62828',
  yellow: '#F4C542',
  orange: '#F97316',
  gray: '#9CA3AF',
  green: '#16804A',
  purple: '#7047A3',
  maroon: '#7F1D35',
  pink: '#DB2777',
  gold: '#C5A13B',
  lightBlue: '#66B8E8',
  teal: '#0F9E9A',
  outline: '#475569',
} as const;
export const avatarPalette = [
  '#00478F',
  '#0B6B4F',
  '#7B3F98',
  '#9A3412',
  '#1F5F8B',
  '#8A2B4A',
] as const;
// D-17: colores de marca de los canales oficiales. Son colores de dominio,
// no de interfaz; viven aquí para no repetir hexadecimales en las pantallas.
export const socialColors = {
  x: '#0F1419',
  instagram: '#E4405F',
  tiktok: '#010101',
  youtube: '#FF0000',
  facebook: '#1877F2',
  twitch: '#9146FF',
  whatsapp: '#25D366',
} as const;
export type SocialColor = keyof typeof socialColors;
export const imageTokens = {
  text: '#FFFFFF',
  muted: '#F1F5F9',
  scrim: 'rgba(0,0,0,0.5)',
  backdrop: 'rgba(0,0,0,0.94)',
  veil: 'rgba(255,255,255,0.16)',
  heroFrom: 'rgba(4,19,36,0.14)',
  heroTo: 'rgba(4,19,36,0.92)',
} as const;
export const radius = { sm: 8, md: 12, lg: 20, poster: 24, pill: 999 } as const;
export const minTouch = 44;
export const elevation = { paper: 1, poster: 4 } as const;
export const motion = { fast: 160, standard: 220, slow: 280, stagger: 60 } as const;
export const typography = {
  display: 'DeporDisplay',
  headline: 'DeporHeadline',
  body: 'DeporBody',
  numeric: 'DeporDisplay',
  displayMaxFontSizeMultiplier: 1.5,
} as const;
// D-04: escala única (8 pasos) con interlineado incluido. Migración por
// pantallas; los literales restantes se sustituyen por estos estilos.
export const text = {
  caption: { fontSize: 12, lineHeight: 16 },
  body: { fontSize: 14, lineHeight: 20 },
  bodyLarge: { fontSize: 16, lineHeight: 22 },
  subtitle: { fontSize: 18, lineHeight: 24 },
  title: { fontSize: 20, lineHeight: 26 },
  heading: { fontSize: 23, lineHeight: 29 },
  display: { fontSize: 32, lineHeight: 38 },
  hero: { fontSize: 40, lineHeight: 44 },
  numeral: { fontSize: 64, lineHeight: 66 },
} as const;
