import {
  formatMatchDate,
  formatMatchDateShort,
  formatMatchTime,
  hasConfirmedTime,
  monthKey,
} from '@/utils/matchTime';

describe('matchTime', () => {
  it('SCHEDULED no tiene hora; el resto sí', () => {
    expect(hasConfirmedTime('SCHEDULED')).toBe(false);
    expect(hasConfirmedTime('TIMED')).toBe(true);
    expect(hasConfirmedTime('FINISHED')).toBe(true);
  });

  it('muestra la hora en Europe/Madrid (verano e invierno)', () => {
    expect(formatMatchTime('2026-10-24T19:00:00Z', 'TIMED', 'es')).toBe('21:00'); // CEST
    expect(formatMatchTime('2026-11-02T20:00:00Z', 'TIMED', 'es')).toBe('21:00'); // CET
  });

  it('no inventa hora en SCHEDULED', () => {
    expect(formatMatchTime('2026-11-22T00:00:00Z', 'SCHEDULED', 'es')).toBeNull();
  });

  it('la fecha de un SCHEDULED no cambia de día', () => {
    expect(formatMatchDate('2026-11-22T00:00:00Z', 'SCHEDULED', 'en', 'long')).toContain('22');
  });

  it('forma corta capitalizada para el hero', () => {
    expect(formatMatchDateShort('2026-11-02T20:00:00Z', 'TIMED', 'es')).toBe('Lunes 2 nov');
    expect(formatMatchDateShort('2026-11-02T20:00:00Z', 'TIMED', 'en')).toBe('Monday 2 Nov');
  });

  it('agrupa por mes en la zona mostrada', () => {
    expect(monthKey('2026-11-22T00:00:00Z', 'SCHEDULED')).toBe('2026-11');
    expect(monthKey('2026-11-30T23:30:00Z', 'TIMED')).toBe('2026-12'); // ya es 1-dic en Madrid
  });
});
