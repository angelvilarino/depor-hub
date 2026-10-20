import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import gl from '@/i18n/locales/gl.json';

type Tree = { [k: string]: string | Tree };
const keys = (o: Tree, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [p + k] : keys(v, `${p}${k}.`)));

describe('traducciones', () => {
  it('EN tiene exactamente las mismas claves que ES', () => {
    expect(keys(en as Tree).sort()).toEqual(keys(es as Tree).sort());
  });
  it('GL no define claves que no existan en ES', () => {
    const esKeys = new Set(keys(es as Tree));
    keys(gl as Tree).forEach((k) => expect(esKeys.has(k)).toBe(true));
  });
});
