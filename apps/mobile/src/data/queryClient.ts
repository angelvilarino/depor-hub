import { QueryClient } from '@tanstack/react-query';
import { GC_TIME } from './queries';

/**
 * Cliente único de TanStack Query. Vive fuera de React para que «Borrar caché»
 * pueda vaciar también la memoria (F3-08), no solo AsyncStorage.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: GC_TIME,
      // F3-03: sin red se intenta una vez y se muestra la caché; nunca se queda
      // en `paused` esperando indefinidamente a que vuelva la conexión.
      networkMode: 'offlineFirst',
    },
  },
});
