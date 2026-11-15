import { queryClient } from './queryClient';
import { persister } from './persister';

/**
 * Borra toda la caché de datos: la persistida en AsyncStorage y la que TanStack
 * Query mantiene en memoria (F3-08). No toca ajustes, recordatorios ni el tema.
 * Las consultas activas volverán a pedir sus documentos en el siguiente render.
 */
export async function clearDataCache(): Promise<void> {
  queryClient.clear();
  await persister.removeClient();
}
