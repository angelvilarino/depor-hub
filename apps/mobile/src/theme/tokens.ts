// Design tokens de Depor Hub. Identidad propia: no se usa el escudo del club.
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
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20 } as const;
export const minTouch = 44;
