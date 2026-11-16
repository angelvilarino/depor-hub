import { logStartup, markStartup, startupMarks } from '@/perf/startup';

describe('marcas de arranque (F3-14)', () => {
  it('guarda cada fase una sola vez y en orden creciente', () => {
    const layout = markStartup('layout');
    const fonts = markStartup('fonts');
    expect(markStartup('fonts')).toBe(fonts);

    const cache = markStartup('cache');
    const splash = markStartup('splash');
    const home = markStartup('home');

    expect(startupMarks()).toEqual({ layout, fonts, cache, splash, home });
    expect(fonts).toBeGreaterThanOrEqual(layout);
    expect(cache).toBeGreaterThanOrEqual(fonts);
    expect(splash).toBeGreaterThanOrEqual(cache);
    expect(home).toBeGreaterThanOrEqual(splash);
  });

  it('imprime una sola línea por arranque con las marcas tomadas', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});

    logStartup();
    logStartup();

    expect(info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(info.mock.calls[0]![1] as string)).toMatchObject({
      home: expect.any(Number),
    });
    info.mockRestore();
  });
});
