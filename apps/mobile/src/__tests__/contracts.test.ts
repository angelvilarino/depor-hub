import fs from 'fs';
import path from 'path';
import {
  Club,
  Fixtures,
  MatchSnapshot,
  Meta,
  News,
  NewsHome,
  Player,
  Rivals,
  Rivalries,
  Season,
  Squad,
  Standings,
  Titles,
} from '@/data/schemas';

// Los MISMOS ejemplos los valida Pydantic en scripts/tests: si divergen, falla uno de los dos CI.
const dir = path.resolve(__dirname, '../../../../packages/schemas/examples');
const load = (n: string): unknown => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));

// Los JSON reales que publica la ingesta también deben validar con el mismo espejo.
const publishedDir = path.resolve(__dirname, '../../../../data/public/v1');
const published = (n: string): unknown =>
  JSON.parse(fs.readFileSync(path.join(publishedDir, n), 'utf8'));

describe('contratos públicos v1 (Zod espejo de Pydantic)', () => {
  it.each([
    ['meta.json', Meta],
    ['standings.json', Standings],
    ['fixtures.json', Fixtures],
    ['squad.json', Squad],
    ['player.json', Player],
    ['news.json', News],
    ['news-home.json', NewsHome],
    ['season.json', Season],
    ['rivals.json', Rivals],
    ['club.json', Club],
    ['titles.json', Titles],
    ['rivalries.json', Rivalries],
    ['snapshot.json', MatchSnapshot],
  ] as const)('%s valida', (file, schema) => {
    expect(schema.safeParse(load(file)).success).toBe(true);
  });

  it('tolera campos desconocidos en la raíz y los descarta (F3-05)', () => {
    const withExtra = { ...(load('squad.json') as object), extra: 1 };
    const parsed = Squad.safeParse(withExtra);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.players.length).toBeGreaterThan(0);
      expect('extra' in parsed.data).toBe(false);
    }
  });

  it('tolera un campo desconocido dentro de un objeto anidado (F3-05)', () => {
    const fixtures = load('fixtures.json') as { matches: Record<string, unknown>[] };
    const withExtra = {
      ...(fixtures as object),
      matches: fixtures.matches.map((match) => ({ ...match, shotMap: [] })),
    };
    const parsed = Fixtures.safeParse(withExtra);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.matches.length).toBe(fixtures.matches.length);
      expect('shotMap' in parsed.data.matches[0]!).toBe(false);
    }
  });

  it.each([
    ['meta.json', Meta],
    ['standings.json', Standings],
    ['fixtures.json', Fixtures],
    ['squad.json', Squad],
    ['news.json', News],
    ['news-home.json', NewsHome],
    ['season.json', Season],
    ['rivals.json', Rivals],
    ['club.json', Club],
    ['titles.json', Titles],
    ['rivalries.json', Rivalries],
  ] as const)('el publicado %s valida', (file, schema) => {
    expect(schema.safeParse(published(file)).success).toBe(true);
  });

  it('los detalles de jugador publicados validan', () => {
    const playersDir = path.resolve(publishedDir, 'players');
    const files = fs.readdirSync(playersDir).filter((name) => name.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(Player.safeParse(JSON.parse(fs.readFileSync(path.join(playersDir, file), 'utf8'))).success).toBe(true);
    }
  });

  it('los snapshots publicados validan', () => {
    const snapshotsDir = path.resolve(publishedDir, 'snapshots/2026-27');
    const files = fs.readdirSync(snapshotsDir).filter((name) => name.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const body = JSON.parse(fs.readFileSync(path.join(snapshotsDir, file), 'utf8'));
      expect(MatchSnapshot.safeParse(body).success).toBe(true);
    }
  });

  it('un campo aditivo en un documento publicado no rompe la pantalla (F3-05)', () => {
    const withExtra = { ...(published('news.json') as object), extraField: true };
    const parsed = News.safeParse(withExtra);

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.stories.length).toBeGreaterThan(0);
  });
});
