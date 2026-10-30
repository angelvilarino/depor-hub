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
});
