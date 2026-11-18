// D1-07: el contrato vive en tres sitios (Pydantic, JSON Schema y Zod). Pydantic y
// JSON Schema ya están atados por `cli schemas`; esta prueba ata el espejo Zod para
// que un campo nuevo en el servidor no se quede sin validar (o al revés).
import fs from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import * as schemas from '@/data/schemas';

const dir = path.resolve(__dirname, '../../../../packages/schemas');

const ROOTS = [
  ['club', schemas.Club],
  ['fixtures', schemas.Fixtures],
  ['match-detail', schemas.MatchDetail],
  ['meta', schemas.Meta],
  ['news-home', schemas.NewsHome],
  ['news', schemas.News],
  ['player', schemas.Player],
  ['rivalries', schemas.Rivalries],
  ['rivals', schemas.Rivals],
  ['season', schemas.Season],
  ['snapshot', schemas.MatchSnapshot],
  ['squad', schemas.Squad],
  ['standings', schemas.Standings],
  ['status', schemas.Status],
  ['titles', schemas.Titles],
] as const;

// `$defs` reutiliza el nombre de la clase Pydantic. Estos dos son el modelo raíz
// del propio documento (`News` y `Fixtures`), ya cubiertos por la comparación raíz.
const ROOT_ALIASES = new Set(['Source', 'TeamInfo']);

const files = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith('.schema.json'))
  .map((name) => [name, JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))] as const);

type JsonObject = { properties?: Record<string, unknown>; $defs?: Record<string, JsonObject> };

type AnySchema = z.ZodType & {
  shape?: z.ZodRawShape;
  unwrap?: () => AnySchema;
  _def?: { innerType?: AnySchema };
};

/** Los esquemas con `.default()` envuelven al objeto: se desenvolvería una o más veces. */
function objectOf(schema: AnySchema | undefined): z.ZodObject<z.ZodRawShape> | null {
  if (!schema) return null;
  if (schema.shape) return schema as z.ZodObject<z.ZodRawShape>;
  const inner = schema.unwrap?.() ?? schema._def?.innerType;
  return inner ? objectOf(inner) : null;
}

const shapeKeys = (schema: AnySchema): string[] =>
  Object.keys(objectOf(schema)?.shape ?? {}).sort();

describe('paridad JSON Schema ↔ Zod (D1-07)', () => {
  it.each(ROOTS)('%s.schema.json declara los mismos campos que Zod', (name, schema) => {
    const file = files.find(([candidate]) => candidate === `${name}.schema.json`);
    const properties = (file?.[1] as JsonObject | undefined)?.properties ?? {};

    expect(shapeKeys(schema)).toEqual(Object.keys(properties).sort());
  });

  it('todos los objetos anidados de los esquemas existen en Zod con los mismos campos', () => {
    const diffs: string[] = [];
    for (const [, json] of files) {
      for (const [name, def] of Object.entries((json as JsonObject).$defs ?? {})) {
        if (ROOT_ALIASES.has(name)) continue;
        const schema = (schemas as unknown as Record<string, AnySchema>)[name];
        if (!schema) {
          diffs.push(`${name}: falta en Zod`);
          continue;
        }
        const expected = Object.keys(def.properties ?? {}).sort();
        const actual = shapeKeys(schema);
        if (actual.join(',') !== expected.join(',')) {
          diffs.push(`${name}: Zod=${actual.join(',')} JSON=${expected.join(',')}`);
        }
      }
    }

    expect(diffs).toEqual([]);
  });
});
