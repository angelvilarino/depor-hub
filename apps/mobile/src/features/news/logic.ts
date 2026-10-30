import type { NewsGroupT, NewsSourceT, NewsStoryT } from '@/data/schemas';
import { freshness, type Freshness } from '@/data/freshness';

export const HOME_HEADLINES = 5;
export const MADRID_TZ = 'Europe/Madrid';
export const GROUP_ORDER: NewsGroupT[] = ['club', 'galicia', 'nacional'];

export type NewsKindFilter = 'all' | 'article' | 'video';

export type NewsFilters = {
  text: string;
  kind: NewsKindFilter;
  groups: NewsGroupT[];
  sourceIds: string[];
  tags: string[];
};

export const EMPTY_FILTERS: NewsFilters = {
  text: '',
  kind: 'all',
  groups: [],
  sourceIds: [],
  tags: [],
};

export type SourceOption = {
  id: string;
  name: string;
  group: NewsGroupT;
  kind: 'article' | 'video';
  items: number;
};

export type NewsSection = {
  key: string;
  /** Fecha ISO de la historia más reciente del día, para formatear en la zona local. */
  date: string;
  /** `data` es el nombre que espera SectionList para pintar los elementos. */
  data: NewsStoryT[];
};

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function hasActiveFilters(filters: NewsFilters): boolean {
  return activeFilterCount(filters) > 0;
}

/** Número de decisiones activas: «Limpiar (n)» no cuenta cada letra buscada. */
export function activeFilterCount(filters: NewsFilters): number {
  return (
    (filters.text.trim() ? 1 : 0) +
    (filters.kind !== 'all' ? 1 : 0) +
    filters.groups.length +
    filters.sourceIds.length +
    filters.tags.length
  );
}

export function sourceById(
  sources: NewsSourceT[],
  sourceId: string,
): NewsSourceT | undefined {
  return sources.find((source) => source.id === sourceId);
}

export function sourceName(story: NewsStoryT, sources: NewsSourceT[]): string {
  return sourceById(sources, story.sourceId)?.name ?? story.sourceId;
}

export function sourceGroup(story: NewsStoryT, sources: NewsSourceT[]): NewsGroupT {
  return sourceById(sources, story.sourceId)?.group ?? 'galicia';
}

export function sourceMonogram(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, '')
    .split(/[\s.-]+/)
    .filter((word) => word.length > 0 && !['de', 'del', 'la', 'el', 'los', 'las'].includes(fold(word)));
  if (words.length === 0) return '·';
  if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toLocaleUpperCase();
}

/** Fecha relativa localizada para el titular destacado y su lista. */
export function relativePublishedAt(iso: string, locale: string, now = Date.now()): string {
  const published = Date.parse(iso);
  if (!Number.isFinite(published)) return '';
  const seconds = Math.round((published - now) / 1000);
  const absolute = Math.abs(seconds);
  const [unit, divisor] = absolute < 60
    ? ['second', 1]
    : absolute < 3600
      ? ['minute', 60]
      : absolute < 86_400
        ? ['hour', 3600]
        : ['day', 86_400];
  const value = Math.round(seconds / divisor);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    value,
    unit as Intl.RelativeTimeFormatUnit,
  );
}

export function sourceBadgeIndex(sourceId: string, count: number): number {
  if (count <= 0) return 0;
  let hash = 0;
  for (const char of sourceId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % count;
}

export function filterNews(
  stories: NewsStoryT[],
  filters: NewsFilters,
  sources: NewsSourceT[],
): NewsStoryT[] {
  const text = fold(filters.text);
  const byId = new Map(sources.map((source) => [source.id, source]));
  return stories.filter((story) => {
    if (filters.kind !== 'all' && story.kind !== filters.kind) return false;
    if (filters.groups.length > 0) {
      const group = byId.get(story.sourceId)?.group;
      if (!group || !filters.groups.includes(group)) return false;
    }
    if (filters.sourceIds.length > 0 && !filters.sourceIds.includes(story.sourceId)) {
      return false;
    }
    if (filters.tags.length > 0 && !filters.tags.some((tag) => story.tags.includes(tag))) {
      return false;
    }
    if (!text) return true;
    const name = byId.get(story.sourceId)?.name ?? story.sourceId;
    return fold([story.title, name, ...story.tags].join(' ')).includes(text);
  });
}

function dayKey(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/**
 * Agrupa por día natural en Madrid. La SectionList pinta una cabecera por grupo y el
 * orden ya viene del JSON (más reciente primero); aquí solo se refuerza.
 */
export function groupByDay(
  stories: NewsStoryT[],
  timeZone: string = MADRID_TZ,
): NewsSection[] {
  const sections: NewsSection[] = [];
  const index = new Map<string, NewsSection>();
  const ordered = [...stories].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  for (const story of ordered) {
    const key = dayKey(story.publishedAt, timeZone);
    let section = index.get(key);
    if (!section) {
      section = { key, date: story.publishedAt, data: [] };
      index.set(key, section);
      sections.push(section);
    }
    section.data.push(story);
  }
  return sections;
}

export function todayKey(now: number = Date.now(), timeZone: string = MADRID_TZ): string {
  return dayKey(new Date(now).toISOString(), timeZone);
}

/** Home: cinco titulares como máximo, sin repetir la misma frase ni la misma URL. */
export function topHeadlines(
  stories: NewsStoryT[],
  limit = HOME_HEADLINES,
): NewsStoryT[] {
  const seenTitles = new Set<string>();
  const seenUrls = new Set<string>();
  const out: NewsStoryT[] = [];
  for (const story of stories) {
    const title = fold(story.title).replace(/\s+/g, ' ');
    const url = story.url.split('?')[0] ?? story.url;
    if (!title || seenTitles.has(title) || seenUrls.has(url)) continue;
    seenTitles.add(title);
    seenUrls.add(url);
    out.push(story);
    if (out.length >= limit) break;
  }
  return out;
}

export function sourceOptions(
  stories: NewsStoryT[],
  sources: NewsSourceT[],
): SourceOption[] {
  const counts = new Map<string, number>();
  for (const story of stories) {
    counts.set(story.sourceId, (counts.get(story.sourceId) ?? 0) + 1);
  }
  return sources
    .filter((source) => counts.has(source.id))
    .map((source) => ({
      id: source.id,
      name: source.name,
      group: source.group,
      kind: source.kind,
      items: counts.get(source.id) ?? 0,
    }))
    .sort((a, b) => b.items - a.items || a.name.localeCompare(b.name));
}

export function tagOptions(
  stories: NewsStoryT[],
): { tag: string; items: number }[] {
  const counts = new Map<string, number>();
  for (const story of stories) {
    for (const tag of story.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, items]) => ({ tag, items }))
    .sort((a, b) => b.items - a.items || a.tag.localeCompare(b.tag));
}

export function newsAge(publishedAt: string, now: number = Date.now()): Freshness {
  const timestamp = Date.parse(publishedAt);
  if (Number.isNaN(timestamp)) return { unit: 'now', n: 0 };
  return freshness(timestamp, now);
}

export function unreadCount(stories: NewsStoryT[], readIds: string[]): number {
  const read = new Set(readIds);
  return stories.reduce((count, story) => (read.has(story.id) ? count : count + 1), 0);
}

export function countLabel(count: number): string {
  return count < 100 ? String(count) : '99+';
}
