import fs from 'fs';
import path from 'path';
import { Club } from '@/data/schemas';
import { DATA_BASE_URL, clubImageUrl } from '@/config';
import {
  anthemShareText,
  capacityShare,
  capacitySum,
  crestYearRange,
  currentCrest,
  decadeLabel,
  decadeOf,
  formatDate,
  formatPrice,
  formatSeats,
  groupSeasonsByDecade,
  mapUrl,
  seasonStart,
  sortSeasons,
  titleTotal,
  webMapUrl,
} from '@/features/club/logic';

const dataDir = path.resolve(__dirname, '../../../../data/public/v1');
const read = (name: string): unknown =>
  JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
const club = Club.parse(read('club.json'));

describe('lógica del Club', () => {
  it('valida el club.json real y sus cifras de aforo', () => {
    expect(club.stadium?.capacity).not.toBeNull();
    const capacity = club.stadium!.capacity!;
    expect(capacity.total).toBe(33225);
    expect(capacitySum(capacity)).toBe(capacity.total);
    expect(capacity.breakdown.map((zone) => zone.zone)).toEqual([
      'Gradas',
      'Palco de honor',
      'Palcos VIP',
      'Área 1906',
      'Medios',
    ]);
  });

  it('calcula el porcentaje de cada zona sin salirse de 0-100', () => {
    expect(capacityShare(32490, 33225)).toBeCloseTo(97.79, 1);
    expect(capacityShare(0, 33225)).toBe(0);
    expect(capacityShare(10, 0)).toBe(0);
    expect(capacityShare(40000, 33225)).toBe(100);
  });

  it('ordena temporadas y agrupa por décadas de la más reciente a la más antigua', () => {
    const ascending = sortSeasons(club.kits, 'asc');
    expect(ascending[0]?.season).toBe('1985-86');
    expect(ascending.at(-1)?.season).toBe('2026-27');

    const groups = groupSeasonsByDecade(club.kits, 'desc');
    expect(groups[0]?.decade).toBe(2020);
    expect(groups.at(-1)?.decade).toBe(1980);
    expect(groups[0]?.seasons[0]?.season).toBe('2026-27');
    expect(groups.flatMap((group) => group.seasons)).toHaveLength(club.kits.length);

    const allSeasons = groups.flatMap((group) => group.seasons.map((season) => season.season));
    expect(new Set(allSeasons).size).toBe(allSeasons.length);
  });

  it('extrae el año y la década de una temporada válida', () => {
    expect(seasonStart('1985-86')).toBe(1985);
    expect(seasonStart('2026-27')).toBe(2026);
    expect(seasonStart('2026-2027')).toBeNull();
    expect(decadeOf('1985-86')).toBe(1980);
    expect(decadeOf('2026-27')).toBe(2020);
    expect(decadeOf('sin temporada')).toBeNull();
    expect(decadeLabel(1980)).toBe('1980s');
  });

  it('elige el escudo vigente y describe los rangos de años', () => {
    const current = currentCrest(club.crests);
    expect(current?.yearFrom).toBe(2026);
    expect(current?.yearTo).toBeNull();
    expect(crestYearRange(current!, 'actualidad')).toBe('2026-actualidad');
    expect(crestYearRange(club.crests[0]!, 'actualidad')).toBe('1906-1908');
  });

  it('construye URLs de mapa nativas y alternativa web', () => {
    expect(mapUrl(43.368667, -8.417372, 'Riazor', 'ios')).toBe(
      'http://maps.apple.com/?ll=43.368667,-8.417372&q=Riazor',
    );
    expect(mapUrl(43.368667, -8.417372, 'Riazor', 'android')).toBe(
      'geo:43.368667,-8.417372?q=43.368667,-8.417372(Riazor)',
    );
    expect(mapUrl(43.368667, -8.417372, 'Riazor', 'web')).toContain(
      'https://www.google.com/maps/search/?api=1&query=43.368667,-8.417372',
    );
    expect(webMapUrl(1, 2)).toBe('https://www.google.com/maps/search/?api=1&query=1,2');
  });

  it('resuelve imágenes locales contra la base de datos y respeta URLs absolutas', () => {
    const relative = clubImageUrl('img/club/escudos/1906.png');
    expect(relative).toBe(
      DATA_BASE_URL ? `${DATA_BASE_URL}/img/club/escudos/1906.png` : null,
    );
    expect(clubImageUrl('https://example.test/crest.png')).toBe(
      'https://example.test/crest.png',
    );
    expect(clubImageUrl(null)).toBeNull();
    expect(clubImageUrl('  ')).toBeNull();
  });

  it('formatea cifras, fechas y precios con el locale indicado', () => {
    expect(formatSeats(33225, 'es')).toBe('33.225');
    expect(formatDate('1944-10-29', 'es')).toContain('1944');
    expect(formatDate(null, 'es')).toBeNull();
    expect(formatPrice(10, 'es')).toContain('€');
  });

  it('calcula el total de títulos y prepara el texto para compartir', () => {
    expect(titleTotal(club.titles)).toBe(
      club.titles.reduce((sum, title) => sum + title.years.length, 0),
    );
    const voa = club.anthems.find((anthem) => anthem.id === 'voa')!;
    const shared = anthemShareText(voa);
    expect(shared).toContain('Voa');
    expect(shared).toContain('Xoel López');
    expect(shared).toContain('Contra o vento');
    expect(shared).not.toContain('Créditos');
  });
});
