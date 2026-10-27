import type { NewsItemT } from '@/data/schemas';
import {
  availableSources,
  EMPTY_FILTERS,
  filterNews,
  hasActiveFilters,
  NEWS_PAGE_SIZE,
  newsAge,
  newsSourceKey,
  paginate,
  sourceOptions,
  tagOptions,
  topHeadlines,
  durationLabel,
} from '@/features/news/logic';

const NOW = Date.parse('2026-10-27T12:00:00Z');

function item(overrides: Partial<NewsItemT> = {}): NewsItemT {
  return {
    id: 'n1',
    title: 'El Dépor ficha a un delantero',
    url: 'https://example.test/1',
    sourceId: 'medio-a',
    sourceName: 'Medio A',
    sourceKind: 'local',
    kind: 'article',
    publishedAt: '2026-10-27T10:00:00Z',
    publishedEstimated: false,
    thumbnailUrl: null,
    summary: 'Refuerzo para la delantera',
    tags: ['fichajes', 'player:7'],
    players: [7],
    alsoIn: [],
    durationSeconds: null,
    videoId: null,
    ...overrides,
  };
}

describe('lógica de noticias', () => {
  it('filtra por texto sin acentos y por fuente, tipo y etiqueta', () => {
    const items = [
      item(),
      item({
        id: 'n2',
        title: 'Riazor estrena césped',
        url: 'https://example.test/2',
        sourceId: 'medio-b',
        sourceName: 'Medio B',
        tags: ['partido'],
        summary: null,
      }),
      item({
        id: 'n3',
        title: 'Resumen en vídeo del partido',
        url: 'https://example.test/3',
        kind: 'video',
        sourceId: 'youtube',
        sourceName: 'RC Deportivo',
        sourceKind: 'video',
        tags: ['partido'],
      }),
    ];
    expect(filterNews(items, { ...EMPTY_FILTERS, text: 'ficha' })).toHaveLength(1);
    expect(filterNews(items, { ...EMPTY_FILTERS, text: 'FICHA' })).toHaveLength(1);
    expect(filterNews(items, { ...EMPTY_FILTERS, kind: 'video' })).toHaveLength(1);
    expect(filterNews(items, { ...EMPTY_FILTERS, sourceId: 'medio-b' })).toHaveLength(1);
    expect(filterNews(items, { ...EMPTY_FILTERS, tag: 'partido' })).toHaveLength(2);
    expect(filterNews(items, { ...EMPTY_FILTERS, tag: 'fichajes' })).toHaveLength(1);
    expect(filterNews(items, { ...EMPTY_FILTERS, text: 'no existe' })).toHaveLength(0);
  });

  it('sabe cuándo hay filtros activos', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, text: '  ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, kind: 'video' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, sourceId: 'x' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, tag: 'x' })).toBe(true);
  });

  it('pagina de 30 en 30 sin perder elementos', () => {
    const items = Array.from({ length: 71 }, (_, i) => item({ id: `n${i}`, url: `https://e.test/${i}` }));
    const first = paginate(items, 1);
    expect(first.visible).toHaveLength(NEWS_PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    expect(first.remaining).toBe(41);
    const second = paginate(items, 2);
    expect(second.visible).toHaveLength(60);
    expect(second.remaining).toBe(11);
    const last = paginate(items, 3);
    expect(last.visible).toHaveLength(71);
    expect(last.hasMore).toBe(false);
    expect(last.remaining).toBe(0);
    expect(paginate([], 1).visible).toHaveLength(0);
  });

  it('la Home se queda en cinco titulares sin repetir título ni URL', () => {
    const items = [
      item({ id: 'a', title: 'Titular uno', url: 'https://e.test/1' }),
      item({ id: 'b', title: 'Titular uno', url: 'https://e.test/2' }),
      item({ id: 'c', title: 'Titular dos', url: 'https://e.test/1?utm=x' }),
      item({ id: 'd', title: 'Titular tres', url: 'https://e.test/3' }),
      item({ id: 'e', title: 'Titular cuatro', url: 'https://e.test/4' }),
      item({ id: 'f', title: 'Titular cinco', url: 'https://e.test/5' }),
      item({ id: 'g', title: 'Titular seis', url: 'https://e.test/6' }),
    ];
    const top = topHeadlines(items);
    expect(top.map((entry) => entry.id)).toEqual(['a', 'd', 'e', 'f', 'g']);
    expect(topHeadlines(items, 2)).toHaveLength(2);
  });

  it('agrupa fuentes y etiquetas, y oculta las de jugador', () => {
    const items = [
      item(),
      item({ id: 'n2', url: 'https://e.test/2', tags: ['partido', 'player:7'] }),
      item({
        id: 'n3',
        url: 'https://e.test/3',
        sourceId: null,
        sourceName: 'Sin id',
        tags: [],
      }),
    ];
    expect(newsSourceKey(items[2]!)).toBe('Sin id');
    expect(sourceOptions(items).map((source) => [source.id, source.items])).toEqual([
      ['medio-a', 2],
      ['Sin id', 1],
    ]);
    expect(tagOptions(items)).toEqual([
      { tag: 'fichajes', items: 1 },
      { tag: 'partido', items: 1 },
    ]);
    expect(availableSources(items, null)).toHaveLength(2);
    expect(
      availableSources(items, [
        { id: 'medio-a', name: 'Medio A', url: null, kind: 'local', items: 99 },
        { id: 'fuera', name: 'Fuera', url: null, kind: 'local', items: 3 },
      ]),
    ).toEqual([{ id: 'medio-a', name: 'Medio A', kind: 'local', items: 2 }]);
  });

  it('calcula la antigüedad y la duración', () => {
    expect(newsAge('2026-10-27T11:59:30Z', NOW)).toEqual({ unit: 'now', n: 0 });
    expect(newsAge('2026-10-27T11:50:00Z', NOW)).toEqual({ unit: 'minutes', n: 10 });
    expect(newsAge('2026-10-27T09:00:00Z', NOW)).toEqual({ unit: 'hours', n: 3 });
    expect(newsAge('2026-10-20T12:00:00Z', NOW)).toEqual({ unit: 'days', n: 7 });
    expect(newsAge('no-es-fecha', NOW)).toEqual({ unit: 'now', n: 0 });
    expect(durationLabel(null)).toBeNull();
    expect(durationLabel(0)).toBeNull();
    expect(durationLabel(90)).toBe('2');
  });
});
