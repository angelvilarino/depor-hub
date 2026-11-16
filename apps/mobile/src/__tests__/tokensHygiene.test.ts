import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const sources = ['src', 'app'];
const allowed = new Set([path.join(root, 'src/theme/tokens.ts')]);
const hex = /#[0-9a-f]{3,8}\b/i;
const fontSize = /fontSize:\s*\d/;
const fontFamily = /fontFamily:\s*['"]/;
// D-26: el espaciado sale de `spacing` (rejilla 4/8). Un 0 explícito es válido.
const spacingProps = 'padding|margin|gap|rowGap|columnGap';
const literalSpacing = new RegExp(
  `\\b(?:${spacingProps})(?:Top|Bottom|Left|Right|Horizontal|Vertical)?\\s*:\\s*[1-9]\\d*\\b`,
);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function offenders(pattern: RegExp): string[] {
  return sources
    .flatMap((dir) => walk(path.join(root, dir)))
    .filter((file) => !allowed.has(file))
    .flatMap((file) =>
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ file, index, line }))
        .filter(({ line }) => pattern.test(line)),
    )
    .map(({ file, index }) => `${path.relative(root, file)}:${index + 1}`);
}

describe('higiene de tokens (D-04, D-26)', () => {
  // D-26: el color vive en tokens.ts; fuera solo se admiten nombres de kit.
  it('no hay colores hexadecimales fuera de tokens.ts', () => {
    expect(offenders(hex)).toEqual([]);
  });

  // D-04: toda medida tipográfica sale de la escala `text`.
  it('no hay tamaños de fuente literales fuera de tokens.ts', () => {
    expect(offenders(fontSize)).toEqual([]);
  });

  it('no hay familias tipográficas literales fuera de tokens.ts', () => {
    expect(offenders(fontFamily)).toEqual([]);
  });

  it('no hay espaciados literales fuera de tokens.ts', () => {
    expect(offenders(literalSpacing)).toEqual([]);
  });
});
