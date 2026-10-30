import type { NewsSourceT, NewsStoryT } from '@/data/schemas';
import {
  activeFilterCount,
  countLabel,
  EMPTY_FILTERS,
  filterNews,
  groupByDay,
  hasActiveFilters,
  newsAge,
  relativePublishedAt,
  sourceBadgeIndex,
  sourceGroup,
  sourceMonogram,
  sourceName,
  sourceOptions,
  tagOptions,
  todayKey,
  topHeadlines,
  unreadCount,
} from '@/features/news/logic';

const NOW = Date.parse('2026-10-27T12:00:00Z');

const sources: NewsSourceT[] = [
  { id: 'medio-a', name: 'Medio A', group: 'galicia', kind: 'article', homepage: 'https://a.test' },
  { id: 'medio-b', name: 'Medio B', group: 'nacional', kind: 'article', homepage: 'https://b.test' },
  { id: 'youtube', name: 'RC Deportivo', group: 'club', kind: 'video', homepage: 'https://yt.test' },
];

function story(overrides: Partial<NewsStoryT> = {}): NewsStoryT {
  return {
    id: 'n1',
    title: 'El Dépor ficha a un delantero',
    url: 'https://example.test/1',
    sourceId: 'medio-a',
    publishedAt: '2026-10-27T10:00:00Z',
    kind: 'article',
    summary: 'Refuerzo para la delantera',
    thumbnailUrl: null,
    tags: ['fichajes'],
    alsoIn: [],
    ...overrides,
  };
}

describe('lógica de noticias', () => {
  it('filtra por texto sin acentos y por tipo, grupo, fuente y etiqueta', () => {
    const stories = [
      story(),
      story({
        id: 'n2',
        title: 'Riazor estrena césped',
        url: 'https://example.test/2',
        sourceId: 'medio-b',
        tags: ['partido'],
        summary: null,
      }),
      story({
        id: 'n3',
        title: 'Resumen en vídeo del partido',
        url: 'https://example.test/3',
        kind: 'video',
        sourceId: 'youtube',
        tags: ['partido'],
      }),
    ];
    expect(filterNews(stories, { ...EMPTY_FILTERS, text: 'ficha' }, sources)).toHaveLength(1);
    expect(filterNews(stories, { ...EMPTY_FILTERS, text: 'FICHA' }, sources)).toHaveLength(1);
    expect(filterNews(stories, { ...EMPTY_FILTERS, text: 'medio b' }, sources)).toHaveLength(1);
    expect(filterNews(stories, { ...EMPTY_FILTERS, text: 'partido' }, sources)).toHaveLength(2);
    expect(filterNews(stories, { ...EMPTY_FILTERS, kind: 'video' }, sources)).toHaveLength(1);
    expect(filterNews(stories, { ...EMPTY_FILTERS, groups: ['nacional'] }, sources)).toHaveLength(1);
    expect(
      filterNews(stories, { ...EMPTY_FILTERS, groups: ['club', 'galicia'] }, sources),
    ).toHaveLength(2);
    expect(filterNews(stories, { ...EMPTY_FILTERS, sourceIds: ['medio-b'] }, sources)).toHaveLength(
      1,
    );
    expect(filterNews(stories, { ...EMPTY_FILTERS, tags: ['partido'] }, sources)).toHaveLength(2);
    expect(
      filterNews(stories, { ...EMPTY_FILTERS, tags: ['fichajes', 'partido'] }, sources),
    ).toHaveLength(3);
    expect(filterNews(stories, { ...EMPTY_FILTERS, text: 'no existe' }, sources)).toHaveLength(0);
  });

  it('cuenta decisiones activas sin contar cada letra buscada', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(activeFilterCount({ ...EMPTY_FILTERS, text: '  ' })).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, text: 'dépor' })).toBe(1);
    expect(activeFilterCount({ ...EMPTY_FILTERS, kind: 'video' })).toBe(1);
    expect(activeFilterCount({ ...EMPTY_FILTERS, groups: ['club', 'nacional'] })).toBe(2);
    expect(
      activeFilterCount({
        text: 'x',
        kind: 'article',
        groups: ['club'],
        sourceIds: ['medio-a'],
        tags: ['partido'],
      }),
    ).toBe(5);
  });

  it('agrupa por día natural de Madrid, más reciente primero', () => {
    const sections = groupByDay([
      story({ id: 'a', publishedAt: '2026-10-26T10:00:00Z' }),
      // 23:30 UTC del 27 son las 00:30 del 28 en Madrid (CET, tras el cambio de hora).
      story({ id: 'b', publishedAt: '2026-10-27T23:30:00Z' }),
      story({ id: 'c', publishedAt: '2026-10-27T08:00:00Z' }),
    ]);
    expect(sections.map((section) => section.key)).toEqual(['2026-10-28', '2026-10-27', '2026-10-26']);
    expect(sections[1]!.data.map((entry) => entry.id)).toEqual(['c']);
    expect(todayKey(Date.parse('2026-10-27T23:30:00Z'))).toBe('2026-10-28');
  });

  it('la Home se queda en cinco titulares sin repetir título ni URL', () => {
    const stories = [
      story({ id: 'a', title: 'Titular uno', url: 'https://e.test/1' }),
      story({ id: 'b', title: 'Titular uno', url: 'https://e.test/2' }),
      story({ id: 'c', title: 'Titular dos', url: 'https://e.test/1?utm=x' }),
      story({ id: 'd', title: 'Titular tres', url: 'https://e.test/3' }),
      story({ id: 'e', title: 'Titular cuatro', url: 'https://e.test/4' }),
      story({ id: 'f', title: 'Titular cinco', url: 'https://e.test/5' }),
      story({ id: 'g', title: 'Titular seis', url: 'https://e.test/6' }),
    ];
    expect(topHeadlines(stories).map((entry) => entry.id)).toEqual(['a', 'd', 'e', 'f', 'g']);
    expect(topHeadlines(stories, 2)).toHaveLength(2);
  });

  it('lista solo las fuentes y etiquetas presentes, por volumen', () => {
    const stories = [
      story({ id: 'a', sourceId: 'medio-a', tags: ['fichajes', 'cantera'] }),
      story({ id: 'b', url: 'https://e.test/2', sourceId: 'medio-a', tags: ['partido'] }),
      story({ id: 'c', url: 'https://e.test/3', sourceId: 'youtube', tags: [] }),
    ];
    expect(sourceOptions(stories, sources)).toEqual([
      { id: 'medio-a', name: 'Medio A', group: 'galicia', kind: 'article', items: 2 },
      { id: 'youtube', name: 'RC Deportivo', group: 'club', kind: 'video', items: 1 },
    ]);
    expect(tagOptions(stories)).toEqual([
      { tag: 'cantera', items: 1 },
      { tag: 'fichajes', items: 1 },
      { tag: 'partido', items: 1 },
    ]);
  });

  it('resuelve nombre y grupo, y genera un monograma estable', () => {
    expect(sourceName(story(), sources)).toBe('Medio A');
    expect(sourceGroup(story(), sources)).toBe('galicia');
    expect(sourceName(story({ sourceId: 'desconocido' }), sources)).toBe('desconocido');
    expect(sourceGroup(story({ sourceId: 'desconocido' }), sources)).toBe('galicia');
    expect(sourceMonogram('DXT Campeón')).toBe('DC');
    expect(sourceMonogram('La Voz de Galicia')).toBe('VG');
    expect(sourceMonogram('Marca')).toBe('MA');
    expect(sourceMonogram('Riazor.org')).toBe('RO');
    expect(sourceBadgeIndex('riazor', 5)).toBe(sourceBadgeIndex('riazor', 5));
    expect(sourceBadgeIndex('riazor', 5)).not.toBe(sourceBadgeIndex('la-voz', 5));
  });

  it('formatea fechas relativas en el idioma activo', () => {
    expect(relativePublishedAt('2026-10-27T10:00:00Z', 'es', NOW)).toBe('hace 2 horas');
    expect(relativePublishedAt('2026-10-27T10:00:00Z', 'en', NOW)).toBe('2 hours ago');
    expect(relativePublishedAt('no-es-fecha', 'es', NOW)).toBe('');
  });

  it('calcula la antigüedad, los no leídos y el contador topado', () => {
    expect(newsAge('2026-10-27T11:59:30Z', NOW)).toEqual({ unit: 'now', n: 0 });
    expect(newsAge('2026-10-27T11:50:00Z', NOW)).toEqual({ unit: 'minutes', n: 10 });
    expect(newsAge('2026-10-27T09:00:00Z', NOW)).toEqual({ unit: 'hours', n: 3 });
    expect(newsAge('2026-10-20T12:00:00Z', NOW)).toEqual({ unit: 'days', n: 7 });
    expect(newsAge('no-es-fecha', NOW)).toEqual({ unit: 'now', n: 0 });
    const stories = [story({ id: 'a' }), story({ id: 'b' }), story({ id: 'c' })];
    expect(unreadCount(stories, ['b'])).toBe(2);
    expect(unreadCount(stories, [])).toBe(3);
    expect(countLabel(0)).toBe('0');
    expect(countLabel(99)).toBe('99');
    expect(countLabel(100)).toBe('99+');
  });
});
