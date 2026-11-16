import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const sources = ['src', 'app'];
const allowed = new Set([path.join(root, 'src/theme/tokens.ts')]);
const hex = /#[0-9a-f]{3,8}\b/i;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('higiene de tokens (D-26)', () => {
  // D-26: el color vive en tokens.ts; fuera solo se admiten nombres de kit.
  it('no hay colores hexadecimales fuera de tokens.ts', () => {
    const offenders = sources
      .flatMap((dir) => walk(path.join(root, dir)))
      .filter((file) => !allowed.has(file))
      .flatMap((file) =>
        fs
          .readFileSync(file, 'utf8')
          .split('\n')
          .map((line, index) => ({ file, index, line }))
          .filter(({ line }) => hex.test(line)),
      )
      .map(({ file, index }) => `${path.relative(root, file)}:${index + 1}`);

    expect(offenders).toEqual([]);
  });
});
