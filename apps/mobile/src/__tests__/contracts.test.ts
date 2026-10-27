import fs from 'fs';
import path from 'path';
import { Fixtures, Meta, News, NewsSources, SocialFeed, Squad, Standings } from '@/data/schemas';

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
    ['news.json', News],
    ['sources.json', NewsSources],
    ['social.json', SocialFeed],
  ] as const)('%s valida', (file, schema) => {
    expect(schema.safeParse(load(file)).success).toBe(true);
  });

  it('rechaza campos desconocidos (strict)', () => {
    const bad = { ...(load('squad.json') as object), extra: 1 };
    expect(Squad.safeParse(bad).success).toBe(false);
  });

  it.each([
    ['news.json', News],
    ['sources.json', NewsSources],
    ['social.json', SocialFeed],
  ] as const)('el publicado %s valida', (file, schema) => {
    expect(schema.safeParse(published(file)).success).toBe(true);
  });
});
