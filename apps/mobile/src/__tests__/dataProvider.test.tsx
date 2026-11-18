import { act, render, screen } from '@testing-library/react-native';
import { focusManager } from '@tanstack/react-query';
import { AppState, Text } from 'react-native';

import { DataProvider } from '@/data/DataProvider';

let mockMode: 'success' | 'error' = 'success';
let mockShouldDehydrate: ((query: { state: { status: string } }) => boolean) | undefined;

type NetListener = (state: { isConnected: boolean }) => void;

// El listener se registra al importar DataProvider, antes de que corra el cuerpo
// del test; `globalThis` es lo único disponible sin TDZ dentro de la factoría.
const readNetListener = (): NetListener | undefined =>
  (globalThis as typeof globalThis & { netListener?: NetListener }).netListener;

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (listener: NetListener) => {
      (globalThis as typeof globalThis & { netListener?: NetListener }).netListener = listener;
      return () => {
        (globalThis as typeof globalThis & { netListener?: NetListener }).netListener = undefined;
      };
    },
  },
}));

jest.mock('@tanstack/react-query-persist-client', () => {
  const React = require('react');
  return {
    PersistQueryClientProvider: ({
      children,
      onSuccess,
      onError,
      persistOptions,
    }: {
      children?: React.ReactNode;
      onSuccess?: () => void;
      onError?: () => void;
      persistOptions?: {
        dehydrateOptions?: { shouldDehydrateQuery?: (query: unknown) => boolean };
      };
    }) => {
      mockShouldDehydrate = persistOptions?.dehydrateOptions
        ?.shouldDehydrateQuery as typeof mockShouldDehydrate;
      React.useEffect(() => {
        if (mockMode === 'success') onSuccess?.();
        else onError?.();
      }, [onSuccess, onError]);
      return children;
    },
  };
});

describe('DataProvider (F3-03, F5-07)', () => {
  beforeEach(() => {
    mockMode = 'success';
  });

  it('pinta los hijos y avisa cuando la caché está lista', async () => {
    const onHydrated = jest.fn();

    await render(
      <DataProvider onHydrated={onHydrated}>
        <Text>contenido</Text>
      </DataProvider>,
    );

    expect(screen.getByText('contenido')).toBeTruthy();
    expect(onHydrated).toHaveBeenCalledTimes(1);

    // Solo se guarda lo que ya cargó: ni errores ni consultas a medias.
    expect(mockShouldDehydrate?.({ state: { status: 'success' } })).toBe(true);
    expect(mockShouldDehydrate?.({ state: { status: 'error' } })).toBe(false);
  });

  it('también avisa si la caché no se puede restaurar', async () => {
    mockMode = 'error';
    const onHydrated = jest.fn();

    await render(
      <DataProvider onHydrated={onHydrated}>
        <Text>contenido</Text>
      </DataProvider>,
    );

    expect(onHydrated).toHaveBeenCalledTimes(1);
  });

  it('escucha la red real y el primer plano', async () => {
    const listener = jest.spyOn(AppState, 'addEventListener');

    await render(
      <DataProvider>
        <Text>contenido</Text>
      </DataProvider>,
    );

    // La red se sigue con NetInfo, no con el valor por defecto de React Query.
    expect(readNetListener()).toEqual(expect.any(Function));

    const handler = listener.mock.calls.find(([event]) => event === 'change')?.[1];
    expect(handler).toBeDefined();

    act(() => handler?.('active'));
    expect(focusManager.isFocused()).toBe(true);
    act(() => handler?.('background'));
  });
});
