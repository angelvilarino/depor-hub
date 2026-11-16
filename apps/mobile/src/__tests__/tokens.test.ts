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
    ['win/surface', c.win, c.surface],
    ['draw/surface', c.draw, c.surface],
    ['loss/surface', c.loss, c.surface],
    ['paper/text', c.paper.text, c.paper.background],
    ['paper/muted', c.paper.muted, c.paper.background],
    ['paper/accent', c.paper.accent, c.paper.background],
  ])('%s >= 4.5', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });

  it.each(c.poster.stops.map((stop, index) => [`poster stop ${index + 1}`, c.poster.text, stop]))(
    '%s has readable poster text', (_label, fg, bg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
    },
  );

  it.each(c.news.sourceBadges.map((badge, index) => [`news source ${index + 1}`, c.poster.text, badge]))(
    '%s has readable monogram text', (_label, fg, bg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
    },
  );

  it.each([
    ['win', c.poster.outcome.winText, c.poster.outcome.winBackground],
    ['draw', c.poster.outcome.drawText, c.poster.outcome.drawBackground],
    ['loss', c.poster.outcome.lossText, c.poster.outcome.lossBackground],
  ])('poster outcome %s >= 4.5', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });

  // D-12: el papel debe leerse como una superficie; el borde lo separa del
  // fondo cuando el contraste de relleno no llega.
  it('paper border is visible against paper (>= 1.3)', () => {
    expect(contrastRatio(c.paper.border, c.paper.background)).toBeGreaterThanOrEqual(1.3);
  });
});

describe('separación de superficies (D-12)', () => {
  it('el papel oscuro se separa del fondo >= 1.3:1', () => {
    expect(contrastRatio(darkColors.paper.background, darkColors.background)).toBeGreaterThanOrEqual(1.3);
  });
});
