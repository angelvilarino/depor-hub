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
  poster: {
    stops: ['#003D75', '#00478F', '#075FA3'],
    text: '#FFFFFF',
    muted: '#E3EFFB',
    accent: '#FFD166',
    outcome: {
      winBackground: '#C7F2DD', winText: '#07513C',
      drawBackground: '#FFF0BD', drawText: '#654A00',
      lossBackground: '#FFDAD7', lossText: '#7A1F1A',
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
  poster: {
    stops: ['#003D75', '#00478F', '#075FA3'],
    text: '#FFFFFF',
    muted: '#E3EFFB',
    accent: '#FFD166',
    outcome: {
      winBackground: '#C7F2DD', winText: '#07513C',
      drawBackground: '#FFF0BD', drawText: '#654A00',
      lossBackground: '#FFDAD7', lossText: '#7A1F1A',
    },
  },
  paper: {
    background: '#151D2A',
    text: '#F1F5F9',
    muted: '#B7C4D2',
    border: '#394555',
    accent: '#9FC8FF',
  },
  news: { sourceBadges: ['#003D75', '#00478F', '#075FA3', '#123A63', '#2E4263'] },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
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
