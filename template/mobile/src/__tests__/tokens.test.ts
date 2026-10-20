import { darkColors, lightColors } from '@/theme/tokens';
import { contrastRatio } from '@/utils/contrast';

const AA = 4.5;

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
])('contraste AA (%s)', (_name, c) => {
  it.each([
    ['text/background', c.text, c.background],
    ['text/surface', c.text, c.surface],
    ['textMuted/background', c.textMuted, c.background],
    ['textMuted/surface', c.textMuted, c.surface],
    ['onPrimary/primary', c.onPrimary, c.primary],
    ['primary/surface', c.primary, c.surface],
    ['danger/surface', c.danger, c.surface],
  ])('%s >= 4.5', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });
});
