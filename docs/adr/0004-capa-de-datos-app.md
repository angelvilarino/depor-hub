# ADR 0004 — Capa de datos de la app (H2)
- **Estado:** aceptada
- **Decisión:** `fetchData` (fetch + timeout + validación Zod, nunca datos sin validar) → TanStack Query con caché persistida en AsyncStorage (7 días), estado de red real con NetInfo y revalidación al volver a primer plano.
- **Offline:** si falla la red o el contrato cambia, la app sigue mostrando el último dato válido guardado y lo indica en el banner («Sin conexión · último dato hace X»).
- **Frescura:** el banner muestra la última sincronización CORRECTA de la app (`dataUpdatedAt`), no el `updatedAt` del JSON, porque este solo cambia cuando cambian los datos.
- **Invalidación:** `buster: 'data-v1'` en el persister; súbelo si se publica un contrato incompatible (`/v2/`).
- **Caché HTTP:** GitHub Pages sirve con caché de unos minutos; es aceptable para datos que se refrescan cada hora.
