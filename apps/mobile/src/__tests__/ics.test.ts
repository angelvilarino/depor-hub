import { buildIcs, escapeText, foldLine } from '@/utils/ics';
import { makeMatch } from '@/test-utils/matches';

const opts = { venue: 'Estadio, Riazor', matchdayLabel: (n: number) => `Jornada ${n}`, tbcLabel: 'Hora por confirmar' };
const NOW = '2026-10-20T10:00:00Z';

describe('ics', () => {
  it('evento con hora: UTC y duración de 2 h', () => {
    const ics = buildIcs([makeMatch()], NOW, opts);
    expect(ics).toContain('DTSTART:20261024T190000Z');
    expect(ics).toContain('DTEND:20261024T210000Z');
    expect(ics).toContain('UID:match-1@deporhub');
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics).toContain('LOCATION:Estadio\\, Riazor');
  });

  it('SCHEDULED es de día completo y avisa de hora pendiente', () => {
    const ics = buildIcs([makeMatch({ id: 2, status: 'SCHEDULED', utcDate: '2026-11-22T00:00:00Z' })], NOW, opts);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261122');
    expect(ics).toContain('DTEND;VALUE=DATE:20261123');
    expect(ics).toContain('Hora por confirmar');
  });

  it('excluye aplazados y no pone sede si juega fuera', () => {
    const ics = buildIcs([makeMatch({ status: 'POSTPONED' }), makeMatch({ id: 9, deporIsHome: false })], NOW, opts);
    expect(ics).not.toContain('match-1@');
    expect(ics).not.toContain('LOCATION');
  });

  it('usa la sede del partido también fuera de casa', () => {
    const ics = buildIcs([makeMatch({ deporIsHome: false, venue: 'Metropolitano' })], NOW, opts);
    expect(ics).toContain('LOCATION:Metropolitano');
  });

  it('escapa y pliega', () => {
    expect(escapeText('a,b;c\nd')).toBe('a\\,b\\;c\\nd');
    expect(foldLine('x'.repeat(100)).split('\r\n')).toHaveLength(2);
  });
});
