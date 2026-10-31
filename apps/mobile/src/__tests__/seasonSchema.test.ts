import { Season, NewsSource } from '@/data/schemas';

describe('compatibilidad de contratos H5.3', () => {
  it('lee caché antigua de season.json y descarta el campo retirado', () => {
    const previous = {
      updatedAt: '2026-10-28T09:29:14Z',
      season: '2026-27',
      team: { id: 560, name: 'RC Deportivo La Coruña', shortName: 'Deportivo', tla: 'DEP' },
      summary: {
        position: 11, points: 11, played: 10, won: 2, drawn: 5, lost: 3,
        goalsFor: 13, goalsAgainst: 13, goalDifference: 0,
      },
      whatIsAtStake: { position: 11, points: 11, scenarios: [], assumption: 'other_results_unchanged' },
    };
    const parsed = Season.parse(previous);
    expect(parsed.season).toBe('2026-27');
    expect(parsed).not.toHaveProperty('whatIsAtStake');
  });

  it('acepta fuentes de noticias antiguas y el icono opcional', () => {
    const source = {
      id: 'medio', name: 'Medio', group: 'galicia', homepage: 'https://example.test',
    };
    expect(NewsSource.parse(source).iconUrl).toBeUndefined();
    expect(NewsSource.parse({ ...source, iconUrl: 'https://example.test/icon.png' }).iconUrl)
      .toBe('https://example.test/icon.png');
  });
});
