import { freshness } from '@/data/freshness';

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const ago = (ms: number) => NOW - ms;
const MIN = 60_000;
const HOUR = 60 * MIN;

describe('freshness', () => {
  it.each([
    [30_000, { unit: 'now', n: 0 }],
    [5 * MIN, { unit: 'minutes', n: 5 }],
    [59 * MIN, { unit: 'minutes', n: 59 }],
    [60 * MIN, { unit: 'hours', n: 1 }],
    [47 * HOUR, { unit: 'hours', n: 47 }],
    [48 * HOUR, { unit: 'days', n: 2 }],
    [5 * 24 * HOUR, { unit: 'days', n: 5 }],
  ])('hace %i ms', (ms, expected) => {
    expect(freshness(ago(ms), NOW)).toEqual(expected);
  });

  it('un reloj adelantado no da valores negativos', () => {
    expect(freshness(NOW + HOUR, NOW)).toEqual({ unit: 'now', n: 0 });
  });
});
