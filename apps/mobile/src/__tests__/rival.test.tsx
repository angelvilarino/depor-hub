import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react-native';
import RivalScreen from '../../app/rival/[teamId]';
import { Meta, Rivals, Standings } from '@/data/schemas';
import { SHOW_RIVAL_PHOTOS } from '@/config';
import i18n from '@/i18n';

const dataDir = path.resolve(__dirname, '../../../../data/public/v1');
const read = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
const metaData = Meta.parse(read('meta.json'));
const standingsData = Standings.parse(read('standings.json'));
const baseRivals = Rivals.parse(read('rivals.json'));
let mockTeamId = String(baseRivals.rivals[0]!.team.id);
let mockMeta: unknown;
let mockRivals: unknown;
let mockStandings: unknown;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ teamId: mockTeamId }),
  router: { back: jest.fn() },
}));

jest.mock('@/data/queries', () => ({
  useMeta: () => mockMeta,
  useRivals: () => mockRivals,
  useStandings: () => mockStandings,
}));

jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors, paper: lightColors.paper }) };
});

const query = (data: unknown) => ({
  data,
  dataUpdatedAt: 0,
  isPending: false,
  isFetching: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
});

beforeAll(async () => { await i18n.changeLanguage('es'); });
beforeEach(() => {
  mockMeta = query(metaData);
  mockStandings = query(standingsData);
  mockRivals = query({
    ...baseRivals,
    rivals: baseRivals.rivals.map((rival, index) => index === 0 ? {
      ...rival,
      coach: 'Entrenador de prueba',
      keyPlayers: [{ id: 99, name: 'Jugador individual oculto', goals: 99, assists: 20, playedMatches: 30 }],
    } : rival),
  });
});

describe('Ficha del rival', () => {
  it('muestra entrenador e histórico y omite estadísticas de jugadores rivales', async () => {
    expect(SHOW_RIVAL_PHOTOS).toBe(false);
    await render(<RivalScreen />);
    expect(screen.getByText('Entrenador de prueba')).toBeTruthy();
    expect(screen.getByText('Histórico')).toBeTruthy();
    expect(screen.queryByText('Jugador individual oculto')).toBeNull();
    expect(screen.queryByText('ASISTENCIAS')).toBeNull();
  });
});
