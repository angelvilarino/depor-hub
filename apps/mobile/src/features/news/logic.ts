import type { NewsItemT, NewsSourceKindT, NewsSourceT } from '@/data/schemas';
import { freshness, type Freshness } from '@/data/freshness';

export const NEWS_PAGE_SIZE = 30;
export const HOME_HEADLINES = 5;

export type NewsKindFilter = 'all' | 'article' | 'video';

export type NewsFilters = {
  text: string;
  kind: NewsKindFilter;
  sourceId: string | null;
  tag: string | null;
};

export const EMPTY_FILTERS: NewsFilters = {
  text: '',
  kind: 'all',
  sourceId: null,
  tag: null,
};

export type SourceOption = {
  id: string;
  name: string;
  kind: NewsSourceKindT;
  items: number;
};

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function hasActiveFilters(filters: NewsFilters): boolean {
  return (
    filters.text.trim().length > 0 ||
    filters.kind !== 'all' ||
    filters.sourceId !== null ||
    filters.tag !== null
  );
}

export function newsSourceKey(item: NewsItemT): string {
  return item.sourceId ?? item.sourceName;
}

export function filterNews(items: NewsItemT[], filters: NewsFilters): NewsItemT[] {
  const text = fold(filters.text);
  return items.filter((item) => {
    if (filters.kind !== 'all' && item.kind !== filters.kind) return false;
    if (filters.sourceId && newsSourceKey(item) !== filters.sourceId) return false;
    if (filters.tag && !item.tags.includes(filters.tag)) return false;
    if (!text) return true;
    const haystack = fold(
      [item.title, item.sourceName, item.summary ?? '', ...item.tags].join(' '),
    );
    return haystack.includes(text);
  });
}

export function paginate<T>(items: T[], page: number, size = NEWS_PAGE_SIZE): {
  visible: T[];
  hasMore: boolean;
  remaining: number;
} {
  const limit = Math.max(size, page * size);
  return {
    visible: items.slice(0, limit),
    hasMore: items.length > limit,
    remaining: Math.max(0, items.length - limit),
  };
}

/**
 * Home: cinco titulares como máximo, sin repetir el mismo titular aunque llegue de
 * medios distintos. La deduplicación de la ingesta ya hace el trabajo; esto es una
 * segunda barrera barata para que la Home nunca muestre dos veces la misma frase.
 */
export function topHeadlines(items: NewsItemT[], limit = HOME_HEADLINES): NewsItemT[] {
  const seenTitles = new Set<string>();
  const seenUrls = new Set<string>();
  const out: NewsItemT[] = [];
  for (const item of items) {
    const title = fold(item.title).replace(/\s+/g, ' ');
    const url = item.url.split('?')[0] ?? item.url;
    if (!title || seenTitles.has(title) || seenUrls.has(url)) continue;
    seenTitles.add(title);
    seenUrls.add(url);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

export function sourceOptions(items: NewsItemT[]): SourceOption[] {
  const map = new Map<string, SourceOption>();
  for (const item of items) {
    const id = newsSourceKey(item);
    const current = map.get(id);
    if (current) current.items += 1;
    else map.set(id, { id, name: item.sourceName, kind: item.sourceKind, items: 1 });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Etiquetas para los chips: se ocultan las de jugador (su etiqueta es un id). */
export function tagOptions(items: NewsItemT[]): { tag: string; items: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags) {
      if (tag.startsWith('player:')) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, items_]) => ({ tag, items: items_ }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

export function newsAge(publishedAt: string, now: number = Date.now()): Freshness {
  const timestamp = Date.parse(publishedAt);
  if (Number.isNaN(timestamp)) return { unit: 'now', n: 0 };
  return freshness(timestamp, now);
}

export function durationLabel(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes}`;
}

/** Los tipos de fuente que la app puede mostrar en el selector (los reales del contrato). */
export function sourceKindLabelKey(kind: NewsSourceKindT): string {
  return `news.sourceKind.${kind}`;
}

/** Fuentes que ya no aparecen en la lista actual no se ofrecen como filtro vacío. */
export function availableSources(items: NewsItemT[], catalog: NewsSourceT[] | null): SourceOption[] {
  const fromItems = sourceOptions(items);
  if (!catalog || catalog.length === 0) return fromItems;
  const counts = new Map(fromItems.map((source) => [source.id, source.items]));
  return catalog
    .filter((source) => counts.has(source.id))
    .map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.kind,
      items: counts.get(source.id) ?? 0,
    }))
    .sort((a, b) => b.items - a.items || a.name.localeCompare(b.name));
}
