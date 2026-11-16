import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { HeadToHeadBar } from '@/components/rival/HeadToHeadBar';
import type { HeadToHeadT } from '@/data/schemas';
import i18n from '@/i18n';

jest.mock('@/theme/useTheme', () => {
  const { darkColors } = jest.requireActual('@/theme/tokens');
  return {
    useTheme: () => ({ scheme: 'dark', colors: darkColors, paper: darkColors.paper, poster: darkColors.poster }),
  };
});

jest.mock('@/theme/useReducedMotion', () => ({ useReducedMotion: () => true }));

const head: HeadToHeadT = {
  scope: 'all_official_matches',
  source: 'BDFutbol',
  confidence: 'single_source',
  sourceUrl: 'https://example.com',
  played: 6,
  won: 3,
  drawn: 2,
  lost: 1,
  goalsFor: 9,
  goalsAgainst: 4,
  meetings: [],
};

const { darkColors } = jest.requireActual('@/theme/tokens');
const outcome = darkColors.poster.outcome;

describe('HeadToHeadBar', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
  });

  // D-02: sobre el cartel el color semántico no puede ser texto sobre azul;
  // cada etiqueta G/E/P va en su pastilla clara con texto oscuro.
  it('usa pastillas claras y texto oscuro en la variante poster', async () => {
    const view = await render(<HeadToHeadBar head={head} variant="poster" />);

    const expected = [
      { label: 'G 3', background: outcome.winBackground, text: outcome.winText },
      { label: 'E 2', background: outcome.drawBackground, text: outcome.drawText },
      { label: 'P 1', background: outcome.lossBackground, text: outcome.lossText },
    ];

    for (const item of expected) {
      const label = view.getByText(item.label);
      expect(StyleSheet.flatten(label.props.style)).toMatchObject({ color: item.text });
      expect(StyleSheet.flatten(label.parent?.props.style)).toMatchObject({
        backgroundColor: item.background,
      });
    }
  });

  it('mantiene el color semántico directo en papel', async () => {
    const view = await render(<HeadToHeadBar head={head} />);

    expect(StyleSheet.flatten(view.getByText('G 3').props.style)).toMatchObject({
      color: darkColors.win,
    });
    expect(StyleSheet.flatten(view.getByText('G 3').parent?.props.style)?.backgroundColor).toBeUndefined();
  });
});
