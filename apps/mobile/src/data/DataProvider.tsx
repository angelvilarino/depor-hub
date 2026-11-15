import NetInfo from '@react-native-community/netinfo';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { type ReactNode, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { persister } from './persister';
import { GC_TIME } from './queries';

// Estado de red real (por defecto React Query asume "online" en móvil).
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
);

export function DataProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { gcTime: GC_TIME } } }),
  );

  // Al volver a primer plano, refrescar los datos que estén caducados.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
    return () => sub.remove();
  }, []);

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: GC_TIME,
        buster: 'data-v9', // v9: caché por consulta (F3-04); v8: plantilla resumen + detalle por jugador (D1-03); v7: club ampliado (ADR 0032)
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
