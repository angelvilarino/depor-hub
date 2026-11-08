import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, Share } from 'react-native';
import ClubScreen from '../../app/(tabs)/club';
import ClubSectionScreen from '../../app/club/[section]';
import AnthemScreen from '../../app/club/himno/[id]';
import { Club } from '@/data/schemas';
import i18n from '@/i18n';

const dataDir = path.resolve(__dirname, '../../../../data/public/v1');
const clubData = Club.parse(
  JSON.parse(fs.readFileSync(path.join(dataDir, 'club.json'), 'utf8')),
);
const titlesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'titles.json'), 'utf8'));
const rivalriesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'rivalries.json'), 'utf8'));

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockUseClub = jest.fn();
const mockUseSquad = jest.fn();
const mockUseTitles = jest.fn();
const mockUseRivalries = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock('@/config', () => {
  const actual = jest.requireActual('@/config');
  return {
    ...actual,
    DATA_BASE_URL: 'https://data.test/v1',
    clubImageUrl: (path: string | null | undefined) =>
      path && path.trim() ? `https://data.test/v1/${path.replace(/^\//, '')}` : null,
  };
});
jest.mock('@/data/queries', () => ({
  useClub: () => mockUseClub(),
  useSquad: () => mockUseSquad(),
  useTitles: () => mockUseTitles(),
  useRivalries: () => mockUseRivalries(),
}));
jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
});

const query = (data: unknown) => ({
  data,
  dataUpdatedAt: Date.parse('2026-11-01T10:14:07Z'),
  isPending: false,
  isFetching: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
});

const squad = {
  updatedAt: '2026-10-25T10:00:00Z',
  coach: { name: 'Antonio Hidalgo', nationality: 'Spain' },
  players: [],
};

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

beforeEach(() => {
  mockParams = {};
  mockPush.mockReset();
  mockUseClub.mockReset();
  mockUseSquad.mockReset();
  mockUseTitles.mockReset();
  mockUseRivalries.mockReset();
  mockUseClub.mockReturnValue(query(clubData));
  mockUseSquad.mockReturnValue(query(squad));
  mockUseTitles.mockReturnValue(query(titlesData));
  mockUseRivalries.mockReturnValue(query(rivalriesData));
});

describe('pestaña Club', () => {
  it('muestra identidad, datos y accesos a todas las secciones', async () => {
    await render(<ClubScreen />);

    expect(screen.getByText(clubData.identity.officialName)).toBeTruthy();
    expect(screen.getByText('Fundado en 1906 · A Coruña, España')).toBeTruthy();
    expect(screen.getByText('Explorar el club')).toBeTruthy();
    expect(screen.getByText('Himnos')).toBeTruthy();
    expect(screen.getByText('Equipaciones')).toBeTruthy();
    expect(screen.getByText('Estadio')).toBeTruthy();

    fireEvent.press(screen.getByText('Himnos'));
    expect(mockPush).toHaveBeenCalledWith('/club/himnos');
  });

  it('cubre las 42 temporadas y las 44 equipaciones con imagen o patrón de respaldo', () => {
    const kits = clubData.kits.flatMap((season) => season.kits);
    expect(clubData.kits).toHaveLength(42);
    expect(kits).toHaveLength(44);
    expect(kits.every((kit) => Boolean(kit.image) || kit.colors.length > 0)).toBe(true);
  });

  it('pinta estado vacío sin contrato y error con reintento', async () => {
    mockUseClub.mockReturnValueOnce(query(null));
    const first = await render(<ClubScreen />);
    expect(screen.getByText('Todavía no hay datos del club publicados.')).toBeTruthy();
    await first.unmount();

    const refetch = jest.fn();
    mockUseClub.mockReturnValueOnce({
      ...query(null),
      isError: true,
      refetch,
    });
    await render(<ClubScreen />);
    expect(screen.getByText('No se han podido cargar los datos.')).toBeTruthy();
    fireEvent.press(screen.getByText('Reintentar'));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('secciones del Club', () => {
  it('lista los himnos y enlaza al detalle', async () => {
    mockParams = { section: 'himnos' };
    await render(<ClubSectionScreen />);

    expect(screen.getByText('Voa')).toBeTruthy();
    expect(screen.getByText('Fillos de Breogán')).toBeTruthy();
    expect(screen.getByText('El Rock del Deportivo')).toBeTruthy();
    expect(screen.getAllByText('Letra pendiente')).toHaveLength(2);
    expect(screen.getAllByText('Letra disponible en la fuente')).toHaveLength(1);

    fireEvent.press(screen.getByText('Voa'));
    expect(mockPush).toHaveBeenCalledWith('/club/himno/voa');
  });

  it('muestra la línea temporal del escudo y lo amplía en un modal', async () => {
    mockParams = { section: 'escudo' };
    await render(<ClubSectionScreen />);

    expect(screen.getByText('1906-1908')).toBeTruthy();
    expect(screen.getByText('2026-actualidad')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Ver imagen ampliada de Escudo de 1906-1908'));
    await waitFor(() => {
      expect(screen.getAllByText('1906-1908').length).toBeGreaterThan(1);
    });
    expect(screen.getByText('Cerrar')).toBeTruthy();
  });

  it('agrupa equipaciones por década y muestra sus imágenes', async () => {
    mockParams = { section: 'equipaciones' };
    await render(<ClubSectionScreen />);

    expect(screen.getAllByText('2020s').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1980s').length).toBeGreaterThan(0);
    expect(screen.getByText('2026-27')).toBeTruthy();
    expect(screen.getByTestId('kit-2026-27-home-image')).toBeTruthy();
    expect(screen.getByTestId('kit-2026-27-away-image')).toBeTruthy();
    expect(screen.getByLabelText('Crédito de imagen: Foto de producto: Deportienda · Derechos reservados')).toBeTruthy();
    expect(screen.getAllByText('Ilustración').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByLabelText('Ir a la década de 1980s'));
  });

  it('muestra marcador de sustitución cuando una equipación no tiene imagen', async () => {
    mockParams = { section: 'equipaciones' };
    mockUseClub.mockReturnValueOnce(
      query({
        ...clubData,
        kits: [
          {
            season: '1906-07',
            kits: [{ type: 'home', colors: ['blanco'], image: null }],
          },
        ],
      }),
    );
    await render(<ClubSectionScreen />);
    expect(
      screen.getByTestId('kit-1906-07-home-placeholder', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getAllByText('Ilustración', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  });

  it('muestra el aforo desglosado y abre el mapa nativo', async () => {
    mockParams = { section: 'estadio' };
    const linking = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<ClubSectionScreen />);

    expect(screen.getByText('33.225')).toBeTruthy();
    expect(screen.getByText('Gradas')).toBeTruthy();
    expect(screen.getByText('Palco de honor')).toBeTruthy();

    fireEvent.press(screen.getByText('Abrir en el mapa'));
    await waitFor(() => expect(linking).toHaveBeenCalled());
    expect(String(linking.mock.calls[0]?.[0])).toContain('maps.apple.com');
    linking.mockRestore();
  });

  it('toma el entrenador de squad.json en la junta directiva', async () => {
    mockParams = { section: 'junta' };
    await render(<ClubSectionScreen />);

    expect(screen.getByText('Antonio Hidalgo')).toBeTruthy();
    fireEvent.press(screen.getByText('Antonio Hidalgo'));
    expect(mockPush).toHaveBeenCalledWith('/coach');
  });

  it('muestra detalles de finales verificadas cuando están publicados', async () => {
    mockParams = { section: 'titulos' };
    await render(<ClubSectionScreen />);
    expect(screen.getByText('Final ante Valencia CF')).toBeTruthy();
    expect(screen.getByText('2–1')).toBeTruthy();
    expect(screen.getByText('Entrenador: Arsenio Iglesias')).toBeTruthy();
    expect(screen.getAllByText('Entrenador: Javier Irureta')).toHaveLength(2);
  });

  it('muestra el balance enlazado del derbi gallego', async () => {
    mockParams = { section: 'rivalidades' };
    await render(<ClubSectionScreen />);
    expect(screen.getByText('RC Celta de Vigo')).toBeTruthy();
    expect(screen.getAllByText('Balance en BDFutbol').length).toBeGreaterThan(0);
    expect(screen.getByText('Goles: 194 a favor · 202 en contra · BDFutbol')).toBeTruthy();
  });
});

describe('detalle de himno', () => {
  it('muestra la letra completa, los créditos y permite compartir', async () => {
    mockParams = { id: 'voa' };
    mockUseClub.mockReturnValue(query({
      ...clubData,
      anthems: clubData.anthems.map((anthem) => anthem.id === 'voa'
        ? { ...anthem, lyricsRights: { ...anthem.lyricsRights!, status: 'permission_granted' as const } }
        : anthem),
    }));
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await render(<AnthemScreen />);

    expect(screen.getByText(clubData.anthems[0]!.lyrics!)).toBeTruthy();
    expect(screen.getByText('Músicos')).toBeTruthy();
    expect(screen.getByText('Xoel López: voz principal, coros, guitarras eléctricas y sintes')).toBeTruthy();

    fireEvent.press(screen.getByText('Compartir letra'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(String(share.mock.calls[0]?.[0]?.message)).toContain('Contra o vento');
    share.mockRestore();
  });

  it('muestra el aviso de letra pendiente cuando no hay texto', async () => {
    mockParams = { id: 'voa' };
    mockUseClub.mockReturnValue(
      query({
        ...clubData,
        anthems: clubData.anthems.map((anthem) =>
          anthem.id === 'voa' ? { ...anthem, lyrics: null } : anthem,
        ),
      }),
    );
    await render(<AnthemScreen />);

    expect(screen.getByText('Letra disponible en la fuente')).toBeTruthy();
    expect(screen.getByText('Ver letra en la fuente')).toBeTruthy();
    expect(screen.queryByText('Compartir letra')).toBeNull();
  });

  it('avisa cuando el id no existe', async () => {
    mockParams = { id: 'no-existe' };
    await render(<AnthemScreen />);
    expect(screen.getByText('No se ha encontrado este himno.')).toBeTruthy();
  });
});
