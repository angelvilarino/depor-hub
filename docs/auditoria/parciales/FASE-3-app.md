# FASE 3 — Auditoría de la app móvil (Expo / React Native)

> Auditoría de **solo lectura** sobre el árbol local. No se ha modificado nada fuera de `docs/auditoria/`.
> Fecha de cierre: **2026-11-11**. HEAD auditado: `5759480` (`feat(club): add verified historical kit photos`, 2026-11-08).
>
> **Caveat de línea base:** FASE 5 documenta que `main` local está desfasado respecto a `origin/main` (`75ebe6e`, 2026-11-10): 23 commits locales por delante y 159 por detrás. Las cifras de este informe son del árbol local; no se ha hecho `fetch`, `pull` ni `checkout`.
>
> **Convenciones de evidencia**
> - **[MEDIDO]**: comando ejecutado en esta máquina; se indica si es escritorio o dispositivo.
> - **[CONFIRMADO]**: lectura directa de código, configuración o respuesta HTTP.
> - **[CALCULADO]**: aritmética sobre cifras medidas.
> - **[HIPÓTESIS]**: inferencia razonada, pendiente de validar en dispositivo o en producción.
>
> No se han usado ni impreso secretos. No se han instalado dependencias ni se han generado builds dentro del repo. Las únicas escrituras han sido en `docs/auditoria/` y en `/tmp`.

---

## 1. Resumen ejecutivo

### 1.1 Veredicto

La app está **bien estructurada para el tamaño del proyecto**: Expo SDK 58 + Expo Router, capa de datos centralizada con TanStack Query y Zod, estados de carga/error/vacío en la mayoría de pantallas, i18n con paridad ES/EN y un sistema visual propio. `lint`, `typecheck` y los 302 tests pasan.

Ahora bien, **no está lista para distribuirse** y tiene tres frentes de rendimiento sin cerrar:

1. **Arranque en frío sin red**: las consultas se pausan (`networkMode: 'online'`) y las pantallas quedan en skeleton indefinidamente. Con red pero sin respuesta, los reintentos y el timeout de 15 s pueden alargar el skeleton hasta ~48 s.
2. **Peso de datos e imágenes**: `squad.json` son 950.390 B para 28 jugadores (el 78,4 % es historial de 1.262 partidos); la cuadrícula de Equipo pide retratos `-large` de 1.168.147 B cada uno (≈32,7 MB si se ven los 28).
3. **Presupuesto de arranque sin medir**: el objetivo <2,5 s sigue sin instrumentación ni medición en dispositivo. El bundle Hermes es de 6.009.226 B y los assets de 4,8 MB, de los que 4.076.840 B son 19 fuentes de iconos de las que solo se usa Ionicons.

Además hay dos bloqueantes de entrega: **no existe `eas.json` ni `versionCode`/`buildNumber`** y **los esquemas Zod son `strictObject`**, lo que rompe la compatibilidad aditiva que el propio contrato promete.

### 1.2 Los tres riesgos principales de rendimiento

| # | Riesgo | Evidencia | Impacto |
|---|---|---|---|
| 1 | Arranque/offline sin estado utilizable | `DataProvider.tsx:10-12`, `queries.ts:40-52`, `_layout.tsx:26-28`, `index.tsx:78-102` | Skeletons permanentes sin red; hasta ~48 s con red cautiva **[HIPÓTESIS]** |
| 2 | Retratos de 1,17 MB en una cuadrícula de 88 pt | `team.tsx:80`, `PlayerPortrait.tsx:17-21`, medición HTTP | ≈32,7 MB de descarga y caché de disco para 28 jugadores **[CALCULADO]** |
| 3 | Peso del paquete y del JSON de plantilla | `dist` HBC 6.009.226 B; `squad.json` 950.390 B; 19 TTF 4.076.840 B | Más parseo, más memoria y más bytes iniciales; arranque sin presupuesto |

### 1.3 Estado de dependencias (resumen)

33 dependencias directas + 4 de desarrollo en `apps/mobile`. Las librerías nativas del bundle están incluidas en Expo Go SDK 58; las limitaciones son funcionales: el editor nativo de `expo-calendar` no está, las notificaciones remotas de `expo-notifications` no funcionan en Expo Go Android (las locales sí) y las alarmas exactas o el arranque real no son representativos. Hay actualizaciones menores disponibles en Expo/RN/React/TanStack; los saltos mayores (`i18next` 27, `@react-native-async-storage/async-storage` 3, TypeScript 7) **no** deben aplicarse a ciegas porque el mapa de SDK 58 fija versiones. No hay React/RN duplicados en el bundle; sí `react-is` 16/18/19 en tooling y `zod` 3.25.76 bajo `@expo/cli` (no entra en la app). FASE 5 midió 36 avisos de `npm audit` (3 high).

---

## 2. Estructura y arquitectura

### 2.1 Contexto del monorepo

| Zona | Función | Relación con la app |
|---|---|---|
| `apps/mobile/` | App Expo/React Native | Objeto de esta fase |
| `packages/schemas/` | Contrato JSON + espejo Zod/Pydantic | La app consume `src/data/schemas.ts`, mantenido a mano |
| `data/public/v1/` | JSON publicados | Origen estático de la app |
| `scripts/depor_hub/` | Ingesta y publicación | Fuera de alcance |
| `workers/live-proxy/` | Proxy de directo | No desplegado; `LIVE_BASE_URL` vacío |
| `.github/workflows/` | Refresco de datos | Fuera de alcance |

### 2.2 Capas de la app

| Carpeta | Ficheros | Líneas | Responsabilidad |
|---|---:|---:|---|
| `app/` | 15 | 3.412 | Rutas Expo Router y composición de pantalla |
| `src/components/` | 32 | 3.660 | Presentación reutilizable (Home, Club, noticias, estados) |
| `src/features/` | 36 | 4.001 | Lógica de dominio: home, calendario, plantilla, club, recordatorios |
| `src/data/` | 9 | 1.366 | `queries`, `schemas`, `api`, `persister`, `live`, `weather`, `freshness` |
| `src/store/` | 2 | 142 | Zustand persistido: ajustes y noticias leídas |
| `src/theme/` | 3 | 159 | Tokens y tema claro/oscuro |
| `src/i18n/` | 1 (+3 JSON) | 27 | i18next, recursos ES/EN/GL |
| `src/utils/` | 6 | 208 | Fechas, ICS, reloj, match time |
| `src/__tests__/` | 35 | 4.425 | Jest + Testing Library |
| **Total** | **141** | **17.472** | ~13,0k de app + 4,4k de tests **[MEDIDO]** |

### 2.3 Flujo de datos

```
Pantalla (app/*)
   │  hooks useMeta/useSquad/useNews/useClub/...
   ▼
src/data/queries.ts  ── TanStack Query (staleTime 5 min / noticias 10 min)
   │                         │
   │                         ├── PersistQueryClientProvider (AsyncStorage, 1 clave, maxAge 7 días)
   │                         └── onlineManager (NetInfo isConnected)
   ▼
fetchData() ──► HTTPS JSON estático (GitHub Pages / servidor local en dev)
   │               │
   │               └── timeout 15 s, Accept: application/json, reintentos 2
   ▼
Zod safeParse (178 constructores, 86 strictObject)
   │
   ├── OK → datos tipados → caché en memoria → dehydrate → AsyncStorage
   └── Error → DataError {not_configured|network|http|invalid}
                 ├── 404 en opcional → null (vacío legítimo)
                 ├── invalid en opcional → console.error + null (vacío silencioso)
                 └── resto → estado de error de la pantalla
```

Lectura adicional: `useFixtures` fusiona `fixtures.json` con el proxy de directo (`mergeFixtures`), y la Home añade una consulta externa a Open-Meteo (`useWeather`) cuando el próximo partido está a ≤16 días y la sede tiene coordenadas.

### 2.4 Decisiones estructurales observadas

- **Contrato validado en cliente**: nunca se renderiza JSON sin pasar por Zod. Es una buena decisión de seguridad de datos.
- **Una URL en la queryKey**: evita mezclar caché local y publicada.
- **Caché persistida de 7 días** con `buster` versionado (`data-v7`).
- **Zustand solo para preferencias**, no para datos de servidor. Correcto.
- **Tema y tipografía por tokens**, no estilos ad hoc. Coherente.
- **Sin `expo-updates`, sin `expo-dev-client`, sin `eas.json`**: el proyecto se ejecuta en Expo Go o con `expo run:*`, pero no tiene canal de distribución reproducible.

### 2.5 Deuda estructural

| Patrón | Dónde | Consecuencia |
|---|---|---|
| Lógica de estado duplicada por pantalla | `index.tsx`, `team.tsx`, `calendar.tsx`, `news.tsx`, `ClubGate` | Cada pantalla decide `isPending/isError/empty` a su manera; hay inconsistencias (§8) |
| `useData` y `useOptionalData` casi idénticos | `queries.ts:40-73` | Dos políticas de reintento que se desincronizan |
| Esquemas monolíticos | `schemas.ts` 1.029 líneas | Un cambio de contrato obliga a tocar un fichero grande y compartido |
| `squad.json` como documento único | `data/public/v1/squad.json` | La lista de 28 jugadores arrastra el historial de 1.262 partidos |
| `strictObject` en todo | `schemas.ts` (86) | Rompe la compatibilidad aditiva del contrato |
| Sin capa de telemetría | `console.error` en `queries.ts:33` | Los fallos de contrato en producción son invisibles |

### 2.6 Código muerto

| Elemento | Fichero | Evidencia | Tamaño |
|---|---|---|---:|
| `PlaceholderScreen` | `src/components/PlaceholderScreen.tsx` | Solo se define; ningún import | 16 líneas |
| `PlayerRow` | `src/components/PlayerRow.tsx` | Solo se define; la app usa `SquadCard`/`SquadListRow` | 62 líneas |
| `SocialBlock` | `src/components/news/SocialBlock.tsx` | Solo se define; ninguna pantalla lo importa | 154 líneas |
| `useSocial` | `src/data/queries.ts:103` | Solo lo consume `SocialBlock` (muerto) | — |
| `social.json` | `data/public/v1/social.json` | 645 B; nunca se pide | 645 B |
| `Chip` | `src/components/design/DesignSystem.tsx:96` | Ningún import de `Chip` | ~20 líneas |
| `openVenueInMaps` | `src/features/home/maps.ts:12` | Ningún import; la app usa `Linking` en Club | 13 líneas |
| `USING_LOCAL_DATA` | `src/config.ts:28` | Solo se define; ningún uso | — |
| `SHOW_RIVAL_PHOTOS` | `src/config.ts:52` | Solo se define; ningún uso | — |
| Claves i18n sin referencia | `locales/es.json` | `home.howToGetThere`, `home.mapError`, `data.notConfigured`, `home.lastResult`, `common.confidenceLevel.*`… | ~56–68 **[HIPÓTESIS]** |

**Impacto conjunto:** ~265 líneas de código mantenido sin uso, más 645 B de dato y decenas de claves. No es un problema de rendimiento (Metro elimina parte del código no importado), pero sí de mantenimiento y de señal: hay funciones que parecen parte del producto y ya no se usan.

> Nota: `TrainingSection`, `MatchCard` y `WeatherLine` **sí** se usan. No incluirlos en la limpieza sin comprobar el registro de secciones (`CLUB_SECTION_COMPONENTS`) y `NextMatchCard`.

---

## 3. Navegación y rutas

### 3.1 Árbol

```
app/
├── _layout.tsx                 Stack raíz + fuentes + i18n + DataProvider + ReminderSync
├── (tabs)/
│   ├── _layout.tsx             Tabs: Inicio, Equipo, Calendario, Noticias, Club + ajustes
│   ├── index.tsx               /
│   ├── team.tsx                /team
│   ├── calendar.tsx            /calendar?tab=...
│   ├── news.tsx                /news
│   └── club.tsx                /club
├── club/
│   ├── [section].tsx           /club/:section
│   └── himno/[id].tsx          /club/himno/:id
├── match/[id].tsx              /match/:id
├── player/[id].tsx             /player/:id
├── coach.tsx                   /coach
├── rival/[teamId].tsx          /rival/:teamId
├── settings.tsx                /settings (modal)
└── about.tsx                   /about (modal)
```

No existe `+not-found.tsx`, ni `ErrorBoundary`, ni `unstable_settings.initialRouteName`.

### 3.2 Tabla de rutas

| Ruta | Fichero | Tipo | Parámetros | Deep link (scheme `deporhub`) | Título | Estados |
|---|---|---|---|---|---|---|
| `/` | `app/(tabs)/index.tsx` | tab | — | `deporhub:///` | `tabs.home` | Skeleton / error / vacío de próximo partido |
| `/team` | `app/(tabs)/team.tsx` | tab | — | `deporhub://team` | `tabs.team` | Carga / error / vacío filtrado; 2 vistas |
| `/calendar` | `app/(tabs)/calendar.tsx` | tab | `tab` (`upcoming`/`results`/`standings`) | `deporhub://calendar?tab=standings` | `tabs.calendar` | Carga / error / vacío por pestaña |
| `/news` | `app/(tabs)/news.tsx` | tab | — | `deporhub://news` | `tabs.news` | Carga / error / vacío; filtros y búsqueda |
| `/club` | `app/(tabs)/club.tsx` | tab | — | `deporhub://club` | `tabs.club` | `ClubGate`: carga / error / vacío |
| `/club/:section` | `app/club/[section].tsx` | stack | `section` | `deporhub://club/equipaciones` | `club.sections.*.title` | Sección desconocida → vacío; resto `ClubGate` |
| `/club/himno/:id` | `app/club/himno/[id].tsx` | stack | `id` | `deporhub://club/himno/<id>` | Título del himno | `ClubGate` + himno no encontrado |
| `/match/:id` | `app/match/[id].tsx` | stack | `id` | `deporhub://match/123` | `match.title` | Carga o «no encontrado»; sin error propio |
| `/player/:id` | `app/player/[id].tsx` | stack | `id` | `deporhub://player/123` | `player.title` | Carga o «no encontrado»; sin error propio |
| `/coach` | `app/coach.tsx` | stack | — | `deporhub://coach` | `coach.title` | Carga o «no encontrado»; sin error propio |
| `/rival/:teamId` | `app/rival/[teamId].tsx` | stack | `teamId` | `deporhub://rival/123` | `home.rivalProfile` | Carga / error / vacío |
| `/settings` | `app/settings.tsx` | modal | — | `deporhub://settings` | `settings.title` | Sin estado bloqueante; `meta` opcional |
| `/about` | `app/about.tsx` | modal | — | `deporhub://about` | `about.title` | Estático; licencias importadas en JS |

### 3.3 Deep links

- **Scheme custom**: `app.json:26` define `"scheme": "deporhub"`. Funciona en build nativa y en development build.
- **Sin universal links**: no hay `ios.associatedDomains` ni `android.intentFilters`. No se puede abrir `https://depor-hub…/player/123` directamente.
- **En Expo Go**: el scheme custom no aplica; se usa `exp://<host>:8081/--/player/123`. Los enlaces internos (`router.push`) sí funcionan.
- **Sin `initialRouteName`**: un deep link en frío a `/player/123` no garantiza una pila con las tabs detrás; el botón atrás puede salir de la app en vez de volver a Equipo. **[HIPÓTESIS]** pendiente de probar en dispositivo.
- **Sin `+not-found`**: una URL desconocida cae en la pantalla por defecto de Expo Router, no en una pantalla propia con enlace a Inicio.

### 3.4 Robustez de navegación

| Caso | Comportamiento actual | Riesgo |
|---|---|---|
| Deep link a ruta inexistente | Pantalla por defecto de Expo Router | Marca y salida pobres |
| Deep link en frío a ficha | Sin pila de tabs garantizada | Atrás sale de la app |
| Error de render en una pantalla | Sin `ErrorBoundary` | Pantalla roja en dev; cierre en release |
| `id` no encontrado | `EmptyState` con «no encontrado» | Correcto, salvo que el error de red se confunde con 404 |
| Sección de club desconocida | `EmptyState` `club.sections.unknown` | Correcto |

---

## 4. Capa de datos: bytes de arranque y refresco

### 4.1 Componentes

| Fichero | Papel | Observaciones |
|---|---|---|
| `data/api.ts` | `fetchData`, timeout 15 s, Zod | `not_configured` si no hay base URL; reintentos en `queries.ts` |
| `data/queries.ts` | Definición de consultas | `staleTime` 5 min; noticias/temporada/rivales 10 min; `gcTime` 7 días |
| `data/DataProvider.tsx` | `QueryClient`, persistencia, red, foco | `PersistQueryClientProvider`; `onlineManager` con `isConnected` |
| `data/persister.ts` | Persistencia AsyncStorage | **Una sola clave** `deporhub-query-cache`, `throttleTime` 1.000 ms |
| `data/live.ts` | Fusión de directo | Sin `LIVE_BASE_URL` no hay datos live; coste despreciable |
| `data/schemas.ts` | 178 constructores Zod | 1.029 líneas; 86 `strictObject` |
| `data/weather.ts` | Open-Meteo | Consulta externa opcional, sin persistencia específica |
| `data/freshness.ts` | Antigüedad de datos | Banner a partir de 12 h o sin red |
| `data/useOnline.ts` | NetInfo | Estado de red para el banner |

### 4.2 Inventario de consultas

| Consulta | Documento | Obligatoria | `staleTime` | Se persiste | Consumidores |
|---|---|---|---:|---|---|
| `useMeta` | `meta.json` | Sí | 5 min | Sí | Home, Calendar, Settings, Match, Rival |
| `useStandings` | `standings.json` | Sí | 5 min | Sí | Home, Calendar, Rival |
| `useFixtures` | `fixtures.json` + live | Sí | 5 min / 30 s | Sí | Home, Calendar, Match, ReminderSync |
| `useSquad` | `squad.json` | Sí | 5 min | Sí | Team, Player, Coach |
| `useNews` | `news.json` | No (404 = vacío) | 10 min | Sí | Home, News |
| `useSeason` | `season.json` | No | 10 min | Sí | Home |
| `useRivals` | `rivals.json` | No | 10 min | Sí | Home, Rival |
| `useClub` | `club.json` | No | 5 min | Sí | Club, secciones, himnos |
| `useRivalries` | `rivalries.json` | No | 5 min | Sí | Club |
| `useTitles` | `titles.json` | No | 5 min | Sí | Club |
| `useMatchSnapshot` | `snapshots/<season>/<id>.json` | No | 10 min | Sí | Match |
| `useMatchDetail` | `match-details/<season>/<id>.json` | No | 10 min | Sí | Match |
| `useSocial` | `social.json` | No | 10 min | **Muerto** | Nadie |
| `useWeather` | Open-Meteo (externo) | No | 30 min | Sí (misma caché) | NextMatchCard |
| `useLiveFixtures` | Proxy (vacío) | No | 30 s | Sí si hubiera URL | `useFixtures` |

### 4.3 Bytes de arranque

Primera apertura de la Home. Los seis documentos se piden en paralelo (HTTP/2), más el tiempo si procede.

| Documento | Bytes sin comprimir | gzip | Cuándo | Nota |
|---|---:|---:|---|---|
| `meta.json` | 594 | 365 | Home | Siempre |
| `standings.json` | 8.425 | 1.228 | Home | Siempre |
| `fixtures.json` | 30.697 | 2.266 | Home | Siempre |
| `news.json` | 107.828 | 24.660 | Home | Opcional |
| `season.json` | 3.655 | 838 | Home | Opcional |
| `rivals.json` | 42.244 | 3.640 | Home | Opcional |
| **Total Home (6)** | **193.443** | **32.997** | | **[MEDIDO]** |
| Open-Meteo (si procede) | 2.825 | 835 | Home | Medido el 2026-11-10 para Riazor **[MEDIDO]** |
| **Total Home con tiempo** | **196.268** | **33.832** | | **[CALCULADO]** |

Otras pantallas:

| Pantalla | Documentos nuevos | Bytes | gzip |
|---|---|---:|---:|
| Equipo | `squad.json` | **950.390** | **54.982** |
| Calendario (sin pasar por Home) | `meta` + `standings` + `fixtures` | 39.716 | 3.859 |
| Noticias (sin pasar por Home) | `news.json` | 107.828 | 24.660 |
| Club | `club.json` + `rivalries.json` | 61.936 | 9.029 |
| Club → Títulos | `titles.json` | 21.446 | 2.124 |
| Ficha de partido | snapshot + detalle | variable (11 ficheros: 8.631 B + 101.087 B en total) | — |

**Lectura correcta de los bytes:** las cifras sin comprimir son el tamaño del fichero publicado y lo que el parser recibe en memoria. Si el CDN sirve gzip/Brotli (GitHub Pages lo hace para JSON), la **transferencia real** baja a la columna gzip. El coste de CPU de `JSON.parse` y Zod no baja. **[HIPÓTESIS]** para la configuración exacta del CDN de producción, no verificada porque la URL está en `.env`.

### 4.4 Bytes de refresco

| Acción | Consultas | Bytes sin comprimir | gzip |
|---|---|---:|---:|
| Pull-to-refresh Home | `meta` + `standings` + `fixtures` | 39.716 | 3.859 |
| Pull-to-refresh Equipo | `squad` | 950.390 | 54.982 |
| Pull-to-refresh Calendario | `fixtures` + `standings` + `meta` | 39.716 | 3.859 |
| Pull-to-refresh Noticias | `news` | 107.828 | 24.660 |
| Pull-to-refresh Club | `club` | 47.411 | 7.354 |
| Reintento tras error Home | 3 consultas × 3 intentos | hasta 119.148 | hasta 11.577 |
| Enfoque de app (foreground) | solo consultas caducadas | variable | variable |

**Hallazgo asociado:** el refresco manual de la Home **no** recarga `news`, `season` ni `rivals` (`index.tsx:49-53`). Si el usuario tira para refrescar, los titulares y la temporada pueden seguir con datos de hasta 10 minutos (o de la caché persistida de 7 días si no hay red).

### 4.5 Caché persistida

| Aspecto | Dato |
|---|---|
| Clave | `deporhub-query-cache` (una sola entrada) |
| Motor | `@react-native-async-storage/async-storage` |
| `throttleTime` | 1.000 ms |
| `maxAge` | 7 días (`GC_TIME`) |
| `buster` | `data-v7` |
| Solo éxito | `shouldDehydrateQuery: status === 'success'` |
| Suma de JSON publicados | **1.227.860 B** (11 documentos) **[MEDIDO]** |
| Serialización compacta de esos datos | **819.747 B** **[MEDIDO]** (escritorio, `JSON.stringify` del estado validado) |
| Snapshots + fichas (11 + 11) | 8.631 B + 101.087 B sin comprimir; ~70–90 KB compactos **[HIPÓTESIS]** |
| Tamaño esperado de la entrada | **~0,85–1,0 MB** con todo visitado **[CALCULADO]** |
| Límite Android por entrada | ~2 MB de `CursorWindow`; algunas fuentes/equipos lo dejan en ~1 MB **[CONFIRMADO, doc oficial]** |
| Límite total Android | 6 MB de base de datos por defecto **[CONFIRMADO, doc oficial]** |

Fuente oficial de límites: <https://react-native-async-storage.github.io/2.0/advanced/Limits/> (consultada el 2026-11-11). La documentación indica 6 MB totales y ~2 MB por lectura de `CursorWindow`, con variación por dispositivo.

**Riesgo real:** hoy la entrada cabe en 2 MB, pero está a ~0,85–1,0 MB y crece con cada temporada, snapshot y ficha de partido. En dispositivos con ventana de ~1 MB puede fallar antes. Además, cada persistencia reescribe **toda** la entrada, no solo la consulta que cambió. `throttleTime` limita la frecuencia, no el tamaño.

### 4.6 Flujo offline

| Situación | `onlineManager` | Consulta | UI |
|---|---|---|---|
| Modo avión, caché vacía | `isConnected=false` → offline | `fetchStatus='paused'`, `isPending=true`, `isError=false` | Skeleton **indefinido** en Home, Team, Calendar, News, Club, Player, Coach, Match |
| Modo avión, caché caliente | offline | Datos restaurados; consultas pausadas | Contenido + `FreshnessBanner` offline |
| Red cautiva / sin salida | `isConnected=true` → online | Timeout 15 s × 3 intentos + backoff | Skeleton hasta ~48 s **[HIPÓTESIS]** y luego `ErrorState` |
| 404 en opcional | online | `optionalDocument` → `null` | Vacío legítimo |
| JSON inválido en opcional | online | `optionalDocument` → `console.error` + `null` | Vacío **silencioso** |
| JSON inválido en obligatorio | online | `DataError('invalid')` | `ErrorState` |

### 4.7 Contrato y compatibilidad

- `schemas.ts` tiene **178 constructores** y **86 `strictObject`** **[MEDIDO]**.
- `z.strictObject` rechaza claves desconocidas. Si el backend publica un campo aditivo (que el contrato permite), una app antigua **invalida el documento entero**.
- En documentos obligatorios (`meta`, `standings`, `fixtures`, `squad`) el usuario ve `ErrorState`; en opcionales (`news`, `season`, `rivals`, `club`) ve un vacío sin explicación.
- No hay telemetría: `console.error` no sale del dispositivo en release.

---

## 5. Rendimiento

### 5.1 Bundle y assets

| Artefacto | Tamaño | Evidencia |
|---|---:|---|
| Bundle Hermes Android (`entry-*.hbc`) | **6.009.226 B** | `apps/mobile/dist/_expo/static/js/android/` (31-oct-2026) **[MEDIDO]** |
| Assets del build | **4,8 MB**, 48 ficheros | `dist/assets` **[MEDIDO]** |
| Fuentes de la app (3 TTF) | **776.496 B** | Barlow 103.856 + Source Serif 342.408 + Inter 330.232 **[MEDIDO]** |
| Fuentes de iconos (19 TTF) | **4.076.840 B** | `@expo/vector-icons` **[MEDIDO]** |
| Fuentes totales en `dist` | **4.853.336 B** | Suma exacta de las dos anteriores **[MEDIDO]** |
| `licenses.json` | **95.701 B**, 1.052 paquetes | Importado en `about.tsx`; entra en el bundle JS **[MEDIDO]** |
| Icono de app | 393.493 B | Asset nativo, no runtime **[MEDIDO]** |
| `node_modules/@expo-google-fonts/*` | **18 MB**, extraneous | No declarado ni usado; no entra en el bundle **[MEDIDO]** |

**Fuentes de iconos:** solo se importa `Ionicons` (389.724 B), pero el barrel `import { Ionicons } from '@expo/vector-icons'` hace que Metro incluya las 19 familias. Cambiar a `import Ionicons from '@expo/vector-icons/Ionicons'` (o al subpath equivalente) debería eliminar ~3,7 MB de assets. **[HIPÓTESIS]** de tree-shaking, verificable con un build de comparación.

**Bundle:** 6,0 MB de bytecode Hermes es un tamaño medio para RN 0.88 + Expo Router + Zod. No es un problema por sí solo, pero no hay análisis de qué módulos sobran. `licenses.json` (95,7 KB) se puede cargar bajo demanda o mover a un JSON de assets en lugar de importarlo en JS.

### 5.2 JSON y Zod (mediciones de escritorio)

| Medición | Resultado | Método |
|---|---:|---|
| `JSON.parse(squad.json)` | **1,08 ms** [MEDIDO] | Node en escritorio, 10 pasadas |
| `Squad.safeParse` mediana | **2,18 ms** [MEDIDO] | 20 pasadas; mín 1,23 / máx 9,67 |
| `require` de `zod` + 178 esquemas | **28,45 ms** [MEDIDO] | Arranque en frío de módulo |
| Blob de 11 documentos compactos | 819.747 B | `JSON.stringify` del estado **[MEDIDO]** |
| `JSON.parse` de ese blob | **1,16 ms** mediana | 20 pasadas **[MEDIDO]** |

**Interpretación:** en escritorio, Zod no es el cuello de botella. En un móvil de gama media, multiplicar por 5–10 sigue siendo decenas de milisegundos, no segundos. El coste grande es **esperar la red** y **restaurar la caché antes de pintar**, no validar 28 jugadores. No se ha medido en dispositivo; cualquier cifra móvil sería inventada.

### 5.3 Imágenes

| Medición | `-large` | `-small` | Ratio |
|---|---:|---:|---:|
| Retrato de Álvaro Fernández | **1.168.147 B** (`image/heic`) | **42.870 B** (`image/heic`) | 27,2× |
| 28 jugadores en cuadrícula | **32.708.116 B** ≈ 32,7 MB **[CALCULADO]** | 1.200.360 B ≈ 1,2 MB | 27,2× |

- La cuadrícula de Equipo usa `quality="large"` en `team.tsx:80`, con `size={88}`.
- La lista usa `quality="small"` (`team.tsx:131`).
- La ficha de jugador vuelve a pedir `large` para el hero de 96 pt (`player/[id].tsx:460,466`).
- `expo-image` cachea en memoria y disco; no se libera al cambiar de pestaña.
- El CDN devuelve HEIC. En Android, la decodificación HEIC depende del dispositivo; si falla, `PlayerPortrait` cae al avatar de iniciales (`onError`). **[HIPÓTESIS]** para equipos sin decodificador HEIC.

### 5.4 Listas, render y timers

| Elemento | Implementación | Observación |
|---|---|---|
| Equipo | `FlatList` con `numColumns` 1/2 | 28 ítems; sin `getItemLayout` (altura variable), sin `React.memo` en filas |
| Noticias | `SectionList` | 150 historias; sin `initialNumToRender`/`windowSize` explícitos |
| Calendario | `SectionList` | 38 partidos; correcto |
| About | `SectionList` | 1.052 licencias; `initialNumToRender={20}` |
| Home | `ScrollView` + memoización de lógica | Correcto; no hay listas largas |
| Timers Home | `useNow(60_000)` + `NextMatchCard` `useNow(60_000)` + `Countdown` `useNow(1_000)` + `FreshnessBanner` `setInterval(60_000)` | 4 intervalos simultáneos |
| `Countdown` | `useCountdown(targetMs, true)` | Fuerza segundos siempre; ignora `showsSeconds` |

`useNow` pausa el reloj en segundo plano (`AppState`), lo cual es correcto. El problema no es la fuga, es la **cadencia**: mientras la pantalla está abierta, un intervalo de 1 s repinta el componente cada segundo; a 10 días vista, esos repintados muestran los mismos minutos durante horas.

### 5.5 Protocolo medible para el objetivo <2,5 s

No existe hoy una medición válida. El objetivo de `docs/ESTADO.md` («arranque <2,5 s en móvil de gama media») sigue pendiente. Propuesta operativa:

#### Definiciones

- **T_content**: desde el inicio del proceso hasta el primer frame con **contenido real** de la Home (datos o estado vacío/error explícito), excluyendo splash y skeleton.
- **T_splash**: hasta `SplashScreen.hideAsync()`.
- **T_interactive**: hasta que el primer toque en una tarjeta produce navegación.
- **Arranque en frío**: proceso terminado (`force-stop` / kill) antes de cada pasada.

#### Escenarios (release build, no Expo Go, no dev mode)

| ID | Red | Caché | Objetivo |
|---|---|---|---|
| A | 4G/Wi-Fi | Vacía (primera instalación) | Medir el peor caso real |
| B | 4G/Wi-Fi | Caliente (segunda apertura) | Caso normal |
| C | Modo avión | Caliente | Debe pintar contenido y banner offline |
| D | Modo avión | Vacía | Debe pintar estado offline explícito, nunca skeleton infinito |
| E | 4G con latencia alta (p. ej. 500 ms, 1 % pérdida) | Caliente | Resistencia a red lenta |

#### Dispositivos

- Android de gama media (Pixel 6a, Galaxy A54 o equivalente), Android 14+.
- iPhone 12/13 o SE 3.ª generación, iOS 17+.
- Un dispositivo de gama baja si el objetivo es «gama media» real (p. ej. Redmi Note 12).

#### Instrumentación mínima (S)

1. En `app/_layout.tsx`, marcar `performance.mark('app:module')` al importar el módulo, `app:fonts` al resolver `useFonts`, `app:cache` en `onSuccess` de `PersistQueryClientProvider` y `home:content` en un `useEffect` de la Home cuando `pending` y `failed` son falsos.
2. Exponer los marks en release con `console.info` (capturable con `adb logcat`) o con `@shopify/react-native-performance` si se quiere histórico.
3. En Android, además: `adb shell am start -W -n com.deporhub.app/.MainActivity` (TotalTime/WaitTime) y `adb shell dumpsys gfxinfo com.deporhub.app framestats`.
4. En iOS: plantilla **App Launch** de Instruments y `MXAppLaunchMetric` de MetricKit para p50/p90 reales de usuarios.

#### Ejecución

- 10 arranques en frío por escenario y dispositivo; descartar el primero (caché de sistema de ficheros/JIT).
- Reportar **p50 y p90**, no la media.
- Registrar también: bytes de red en los primeros 10 s, memoria RSS, y bloqueos del hilo JS >100 ms.
- Guardar resultados en `docs/auditoria/rendimiento/` (fuera de este informe).

#### Criterios de aceptación

| Métrica | Objetivo | Umbral de rechazo |
|---|---|---|
| T_content, escenario B (caché caliente, 4G) | **p50 < 2.500 ms** | p90 > 3.000 ms |
| T_content, escenario A (caché vacía, 4G) | p50 < 3.500 ms | p90 > 4.500 ms |
| T_content, escenario C (offline con caché) | p50 < 1.500 ms | p90 > 2.000 ms |
| T_content, escenario D (offline sin caché) | Estado offline explícito < 1.500 ms | Skeleton > 2.000 ms |
| T_splash | < 1.000 ms | > 1.500 ms |
| Skeleton tras splash | 0 ms si hay caché | > 300 ms |
| Bloqueo JS en arranque | < 100 ms | > 250 ms |

#### Presupuesto teórico (para comparar con la medición)

| Partida | Coste esperado | Base |
|---|---:|---|
| Evaluación del bundle Hermes | 300–800 ms | 6,0 MB; depende del dispositivo **[HIPÓTESIS]** |
| Carga de 3 fuentes | 100–300 ms | 776.496 B **[HIPÓTESIS]** |
| Restauración de caché (~0,9 MB) | 30–100 ms | JSON.parse + AsyncStorage **[HIPÓTESIS]** |
| Zod de documentos de Home | 10–40 ms | 2,18 ms en escritorio × factor móvil **[HIPÓTESIS]** |
| Red Home (gzip) | 100–800 ms | 33 KB + latencia **[HIPÓTESIS]** |
| Primer render Home | 50–150 ms | 6 tarjetas + gráfico **[HIPÓTESIS]** |

La suma no debe presentarse como medición. Sirve para saber dónde mirar cuando se ejecute el protocolo.

### 5.6 Diagnóstico de arranque actual

| Paso | Qué pasa | Problema |
|---|---|---|
| 1 | `preventAutoHideAsync()` en módulo | Correcto |
| 2 | `useFonts` carga 3 TTF | Bloquea el primer render; 776 KB |
| 3 | `hideAsync()` en cuanto las fuentes están | El splash se oculta **antes** de restaurar la caché |
| 4 | `DataProvider` monta `PersistQueryClientProvider` | La restauración es asíncrona; las queries se pausan |
| 5 | Home pinta `HomeSkeleton` | Hueco visible entre splash y contenido |
| 6 | Llegan los JSON y Zod valida | El contenido aparece; si no hay red, el hueco se queda |

**Recomendación principal:** mover `hideAsync()` a `onSuccess` de `PersistQueryClientProvider` (con un timeout de seguridad de ~1 s) o mantener el splash hasta que la Home tenga su primer estado resuelto. Es un cambio pequeño con impacto directo en la percepción de arranque.

---

## 6. Dependencias y compatibilidad Expo Go

### 6.1 Dependencias directas

`apps/mobile/package.json`: 33 dependencias + 4 de desarrollo. «Última» es la última publicada en npm el 2026-11-11; **no** implica que sea la recomendada por SDK 58.

| Paquete | Declarado | Instalado | Última | Estado |
|---|---|---|---|---|
| `expo` | `~58.0.19` | 58.0.19 | 58.0.23 | Actualizable dentro de 58 |
| `react` | `19.3.0` | 19.3.0 | 19.3.1 | Parche disponible; override fija 19.3.0 |
| `react-native` | `0.88.0` | 0.88.0 | 0.88.1 | Parche disponible |
| `expo-router` | `~58.0.25` | 58.0.26 | 58.0.30 | Actualizable |
| `expo-calendar` | `~58.0.6` | 58.0.6 | 58.0.6 | Al día |
| `expo-constants` | `~58.0.13` | 58.0.13 | 58.0.15 | Actualizable |
| `expo-file-system` | `~58.0.10` | 58.0.11 | 58.0.13 | Actualizable |
| `expo-font` | `~58.0.10` | 58.0.10 | 58.0.11 | Actualizable |
| `expo-image` | `~58.0.16` | 58.0.17 | 58.0.18 | Actualizable |
| `expo-linear-gradient` | `~58.0.3` | 58.0.3 | 58.0.3 | Al día |
| `expo-linking` | `~58.0.14` | 58.0.14 | 58.0.16 | Actualizable |
| `expo-localization` | `~58.0.5` | 58.0.5 | 58.0.5 | Al día |
| `expo-notifications` | `~58.1.6` | 58.1.6 | 58.1.8 | Actualizable |
| `expo-sharing` | `~58.0.20` | 58.0.20 | 58.0.22 | Actualizable |
| `expo-splash-screen` | `~58.0.11` | 58.0.12 | 58.0.13 | Actualizable |
| `expo-status-bar` | `~58.0.4` | 58.0.4 | 58.0.4 | Al día |
| `expo-web-browser` | `~58.0.6` | 58.0.7 | 58.0.7 | Al día |
| `@expo/vector-icons` | `^15.0.2` | 15.1.1 | 15.1.1 | Al día |
| `@react-native-async-storage/async-storage` | `2.2.0` | 2.2.0 | 3.1.1 | **Mayor nueva**; SDK 58 fija 2.2.0 |
| `@react-native-community/netinfo` | `12.0.1` | 12.0.1 | 12.0.1 | Al día |
| `@tanstack/react-query` | `^5.104.5` | 5.104.5 | 5.107.1 | Actualizable |
| `@tanstack/query-async-storage-persister` | `^5.104.5` | 5.104.5 | 5.107.1 | Actualizable |
| `@tanstack/react-query-persist-client` | `^5.104.5` | 5.104.5 | 5.107.1 | Actualizable |
| `i18next` | `^26.5.3` | 26.5.10 | 27.1.1 | **Mayor nueva**; 26.7.2 dentro de 26 |
| `react-i18next` | `^17.1.0` | 17.1.8 | 18.0.1 | **Mayor nueva** |
| `react-native-gesture-handler` | `~3.3.0` | 3.3.0 | 3.5.0 | SDK 58 fija `~3.3.0` |
| `react-native-reanimated` | `4.7.1` | 4.7.1 | 4.7.1 | Al día |
| `react-native-safe-area-context` | `~5.10.1` | 5.10.1 | 5.11.1 | Actualizable |
| `react-native-screens` | `~4.30.0` | 4.30.0 | 4.30.1 | Parche |
| `react-native-svg` | `15.16.0` | 15.16.0 | 15.16.1 | Parche |
| `react-native-worklets` | `0.13.0` | 0.13.0 | 0.13.1 | Parche |
| `zod` | `^4.6.7` | 4.6.7 | 4.6.7 | Al día |
| `zustand` | `^5.0.15` | 5.0.16 | 5.1.0 | Actualizable |

### 6.2 Desarrollo y raíz

| Paquete | Declarado | Instalado | Última | Nota |
|---|---|---|---|---|
| `typescript` | `~6.0.3` | 6.0.3 | 7.0.2 | **Mayor nueva**; no saltar sin revisar SDK 58 |
| `@types/jest` | `^30.0.0` | 30.0.0 | — | — |
| `@types/node` | `^26.6.5` | 26.6.5 | — | — |
| `@types/react` | `~19.3.0` | 19.3.0 | — | — |
| `@testing-library/react-native` | `^14.1.0` | 14.1.0 | — | Raíz |
| `eslint` | `^9.39.5` | 9.39.5 | — | Raíz |
| `eslint-config-expo` | `~58.0.4` | 58.0.4 | — | Raíz |
| `jest` | `~30.5.2` | 30.5.2 | — | Raíz |
| `jest-expo` | `~58.0.12` | 58.0.12 | — | Raíz |
| `prettier` | `^3.3.0` | 3.3.0 | — | Raíz |

### 6.3 Duplicados y árbol

| Paquete | Versiones | Ámbito | ¿Entra en el bundle? |
|---|---|---|---|
| `react` | 19.3.0 (deduplicado) | App | Sí, una sola |
| `react-native` | 0.88.0 (deduplicado) | App | Sí, una sola |
| `react-is` | 19.3.1 raíz; 18.3.1 en RN/Expo/Jest; 16.13.1 en `prop-types` | Tooling y RN | Solo la que importe RN; no es duplicado de app |
| `zod` | 4.6.7 app; 3.25.76 bajo `@expo/cli` | App vs CLI | La 3.x **no** entra en el bundle |
| `@expo-google-fonts/*` | 3 paquetes **extraneous** (18 MB) | Raíz | No; no están declarados |

`package-lock.json` tiene 1.418 entradas (incluidas las workspaces). No hay `pnpm`/`yarn`; el repo usa npm workspaces. `npm ci` es reproducible, pero los paquetes extraneous indican que el `node_modules` local no está limpio.

### 6.4 Compatibilidad con Expo Go

**Versión:** el proyecto declara SDK 58 (`expo ~58.0.19`). Expo Go solo soporta una SDK por build; la build de SDK 58 es la que hace falta. `expo.dev/go` ya ofrece **SDK 58 (latest)** con instaladores para Android, iOS, emulador y simulador **[CONFIRMADO, consultado 2026-11-11]**. La disponibilidad exacta en App Store/Google Play no se pudo verificar desde una fuente oficial; si la tienda aún sirve SDK 57, usar el instalador de `expo.dev/go`.

| Dependencia | ¿En Expo Go? | Matiz |
|---|---|---|
| `expo`, `react`, `react-native` | ✅ | Base |
| `expo-router` | ✅ | `react-native-screens` incluido |
| `expo-calendar` | ⚠️ | El **editor nativo** no está incluido; la app cae a `.ics` (ADR 0017). El permiso/selector no se puede validar en Expo Go |
| `expo-notifications` | ⚠️ | **Locales**: sí. **Push remoto** en Android: no desde SDK 53. La app solo usa `DATE` local, así que el caso principal es válido; los permisos y alarmas exactas no son representativos |
| `expo-image` | ✅ | Incluido |
| `expo-file-system` | ✅ | Incluido |
| `expo-font` / `expo-splash-screen` | ✅ | Incluido |
| `expo-linking` | ✅ | Incluido; el scheme custom no aplica en Expo Go |
| `expo-localization` | ✅ | Incluido |
| `expo-sharing` | ✅ | Incluido |
| `expo-web-browser` | ✅ | Incluido |
| `expo-linear-gradient` | ✅ | Incluido |
| `expo-constants` / `expo-status-bar` | ✅ | Incluido |
| `@expo/vector-icons` | ✅ | Incluido |
| `@react-native-async-storage/async-storage` | ✅ | Incluido |
| `@react-native-community/netinfo` | ✅ | Incluido |
| `react-native-gesture-handler` | ✅ | Incluido |
| `react-native-reanimated` + `worklets` | ✅ | Incluido; requiere New Architecture (por defecto en SDK 58) |
| `react-native-safe-area-context` | ✅ | Incluido |
| `react-native-screens` | ✅ | Incluido |
| `react-native-svg` | ✅ | Incluido en Expo Go; el ADR 0017 dice que requiere development build, conviene contrastarlo |
| TanStack Query / Zustand / Zod / i18next / react-i18next | ✅ | JavaScript puro |

**Lo que Expo Go no permite validar:**

- Arranque real (<2,5 s): Expo Go ejecuta un bundle de desarrollo, sin bytecode Hermes de release ni los mismos tiempos.
- Alarmas exactas de Android 12+ y canal de notificaciones definitivo.
- Editor nativo de calendario y permisos write-only.
- Deep links con scheme `deporhub://`.
- Splash nativo y tamaño final de assets.
- Comportamiento de HEIC en Android de gama baja.

**Conclusión:** Expo Go es válido para desarrollo de UI, i18n, navegación interna y lógica. Para cerrar rendimiento, notificaciones y distribución hace falta un **development build** (`expo-dev-client` + `eas.json`) o un build local `expo run:*`.

### 6.5 Seguridad y tooling

- FASE 5 midió `npm audit --omit=dev`: **3 high, 32 moderate, 1 low** (36 avisos). No se re-ejecutó aquí para no duplicar trabajo; se toma como referencia.
- `node_modules` local: la sesión arrancó con **Node 20.20.2**, por debajo de `engines.node >=22.13`; `expo lint` avisa «outdated and unsupported». La máquina tiene 22.23.3 y 24.18.0, pero el PATH mínimo del shell no siempre resuelve `node`. El mínimo no está garantizado.
- No hay `eas.json`, `expo-dev-client`, `expo-updates`, `owner` ni `projectId`. `versionCode`/`buildNumber` no están definidos en `app.json`.
- `com.deporhub.app` sigue siendo un identificador provisional (documentado en `docs/ESTADO.md`).

---

## 7. i18n ES/EN/GL

### 7.1 Cobertura

| Idioma | Claves | % sobre ES | Fichero | Estado |
|---|---:|---:|---:|---|
| ES | **713** | 100 % | 30.562 B | Base |
| EN | **713** | 100 % | 28.898 B | Paridad exacta **[MEDIDO]** |
| GL | **212** | **29,7 %** | 8.232 B | **501 claves ausentes** **[MEDIDO]** |

- `fallbackLng: { gl: ['es'], default: ['es'] }` (`src/i18n/index.ts`): el gallego cae a español, así que no hay claves rotas, pero tampoco hay una experiencia GL completa.
- Los tres recursos se importan de forma estática: ~68 KB de JSON en el bundle. No es un problema de peso; sí lo sería si se añadieran más idiomas.
- `resolveLanguage('system')` usa `getLocales()[0].languageCode`; si el dispositivo está en `gl-ES`, `languageCode` es `gl` y entra. Si está en `es-GL`, entra `es`. Correcto.
- El cambio de idioma se aplica con `i18n.changeLanguage` en un efecto; no reinicia la app.

### 7.2 Deriva documental

`docs/ESTADO.md:308` dice «revisar gallego **162/454**». La medición actual es **212/713**. La documentación está desactualizada; no es un fallo de código, pero impide saber si la cobertura GL mejora o empeora entre hitos. Recomendación: generar la tabla de cobertura con un script y publicarla en CI o en `docs/ESTADO.md`.

### 7.3 Textos hardcodeados

| Texto | Dónde | Problema |
|---|---|---|
| `Ilustración de equipación` | `src/components/club/ClubImage.tsx:128` | `accessibilityLabel` solo en español |
| `PRODID:-//Depor Hub//Calendario (no oficial)//ES` | `src/utils/ics.ts:35` | El `.ics` se genera siempre en ES |
| `X-WR-CALNAME:Depor Hub` | `src/utils/ics.ts:37` | Nombre de calendario fijo |
| `Depor Hub añade los partidos que tú elijas a tu calendario.` | `app.json:37` | Permiso nativo solo en español; no hay `InfoPlist.strings` por idioma |
| `—` como fallback | `settings.tsx:46` | Aceptable como símbolo, no como texto |

No se han encontrado más cadenas visibles en español fuera de los recursos. Los nombres propios (equipos, jugadores, competiciones) no se traducen, que es lo correcto.

### 7.4 Claves sin uso

Una búsqueda literal detecta decenas de claves sin referencia. Tras descontar las que se construyen con plantilla (`tabs.${key}`, `home.countdown.*`, `club.sections.*`), quedan **~56–68 claves** potencialmente muertas **[HIPÓTESIS]**; la cifra exacta requiere un analizador de plantillas. Ejemplos confirmados:

- `home.howToGetThere`
- `home.mapError`
- `data.notConfigured`
- `home.lastResult`
- `common.confidenceLevel.verified` y variantes

Esto conecta con el código muerto de §2.6: la función «Cómo llegar» de la Home desapareció, pero sus textos siguen en los tres idiomas.

### 7.5 Formato

- Fechas y horas con `Intl.DateTimeFormat` y zona `Europe/Madrid`; correcto para CET/CEST.
- Números con `Intl.NumberFormat` en el club (`formatSeats`); correcto.
- El ICS usa UTC (`Z`) y `DTSTART;VALUE=DATE` para partidos sin hora; correcto.
- El plegado de líneas ICS es por caracteres, no por octetos UTF-8 (`ics.ts:16-22`). Un `DESCRIPTION` con acentos puede superar los 75 octetos de RFC 5545. Afecta a clientes estrictos.

---

## 8. Navegación y estados por pantalla

### 8.1 Matriz de estados

| Pantalla | Carga | Error | Vacío | Offline sin caché | Observaciones |
|---|---|---|---|---|---|
| **Home** | `HomeSkeleton` | `ErrorState` + reintento de 3 consultas | `EmptyState` si no hay próximo partido | Skeleton indefinido | Solo `meta`/`standings`/`fixtures` bloquean; `news`/`season`/`rivals` son opcionales |
| **Equipo** | `LoadingState` | `ErrorState` + `refetch` | `EmptyState` con/sin filtros | `LoadingState` indefinido | `squad.data` ausente decide; 2 vistas |
| **Calendario** | `LoadingState` | `ErrorState` + `refetch` | `EmptyState` por pestaña | `LoadingState` indefinido | 3 pestañas; `?tab=standings` |
| **Noticias** | `LoadingState` | `ErrorState` + `refresh` | `EmptyState` | `LoadingState` indefinido | `news` es opcional; 150 historias |
| **Club** | `ClubGate` → `LoadingState` | `ClubGate` → `ErrorState` | `ClubGate` → `EmptyState` | `LoadingState` indefinido | `club` opcional |
| **Club sección** | `ClubGate` o estado propio de Equipaciones | `ClubGate` / `ErrorState` | Sección desconocida → `EmptyState` | `LoadingState` indefinido | Equipaciones tiene su propio gate |
| **Himno** | `ClubGate` | `ClubGate` | `EmptyState` si no existe el id | `LoadingState` indefinido | Título dinámico |
| **Partido** | `LoadingState` mientras `waiting` | **No hay `ErrorState`** | `EmptyState` «no encontrado» | `LoadingState` indefinido | Un error de red se pinta como 404 |
| **Jugador** | `LoadingState` | **No hay `ErrorState`** | `EmptyState` «no encontrado» | `LoadingState` indefinido | Un error de red se pinta como 404 |
| **Entrenador** | `LoadingState` | **No hay `ErrorState`** | `EmptyState` «no encontrado» | `LoadingState` indefinido | Un error de red se pinta como 404 |
| **Rival** | `LoadingState` | `ErrorState` + `refresh` | `EmptyState` + volver | `LoadingState` indefinido | Sí distingue error |
| **Ajustes** | No bloquea | No muestra error | `—` en datos de `meta` | Funciona | `meta` solo para hash/fecha |
| **Acerca de** | No aplica | No aplica | No aplica | Funciona | Licencias en JS |

### 8.2 Patrones y problemas

1. **Home, Equipo y Calendario** deciden el estado con `pending`/`isPending` y, si no hay datos, muestran carga antes de error. Si la consulta está pausada por offline, `isPending` es `true` para siempre y nunca se llega al `ErrorState`.
2. **Noticias** usa `!data && isPending` y `!data && isError`; mismo problema offline.
3. **Partido, Jugador y Entrenador** no tienen `ErrorState`: cualquier fallo que no sea «id inexistente» se presenta como «no encontrado». Es engañoso y dificulta el soporte.
4. **Rival** es la única pantalla de detalle que distingue carga, error y vacío.
5. **ClubGate** centraliza bien los tres estados; el resto debería adoptar el mismo patrón.
6. **`FreshnessBanner`** solo aparece si `dataUpdatedAt > 0`; en el primer arranque sin caché no hay banner, solo skeleton.

### 8.3 Matriz offline (caché vacía)

| Pantalla | ¿Skeleton eterno? | ¿Hay banner? | ¿Hay reintento? |
|---|---|---|---|
| Home | Sí | No (sin `dataUpdatedAt`) | No |
| Equipo | Sí | No | No |
| Calendario | Sí | No | No |
| Noticias | Sí | No | No |
| Club | Sí | No | No |
| Club sección | Sí | No | No |
| Himno | Sí | No | No |
| Partido | Sí | No | No |
| Jugador | Sí | No | No |
| Entrenador | Sí | No | No |
| Rival | Sí | No | No |
| Ajustes | No | No | No |
| Acerca de | No | No | No |

**Conclusión:** el primer arranque sin red no tiene una salida de UI. Es el hallazgo más grave de experiencia de usuario de esta fase.

---

## 9. Hallazgos

> Severidades: **Crítica** (bloquea release o deja la app inutilizable), **Alta** (impacto directo y frecuente), **Media** (impacto real pero acotado), **Baja** (deuda o caso límite).
> Cada ficha incluye el template solicitado. Las cifras sin etiqueta de dispositivo son de escritorio o cálculo.

---

### F3-01 — No hay pipeline de distribución ni versionado de build

- **Área:** release / configuración
- **Severidad:** **Crítica**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** no existe `eas.json` en el repo; `apps/mobile/app.json:1-46` no define `android.versionCode`, `ios.buildNumber`, `owner` ni `extra.eas.projectId`; no hay `expo-dev-client` ni `expo-updates`. Los scripts de `apps/mobile/package.json` son `start`, `android`, `ios`, `lint`, `typecheck` y `test`; no hay script de build o entrega.
- **Qué ocurre:** el proyecto se puede ejecutar en Expo Go o con `expo run:*`, pero no hay un perfil reproducible de build, firma, versionado ni entrega.
- **Causa raíz:** la fase de distribución (H9) no se ha abordado; el identificador `com.deporhub.app` sigue siendo provisional.
- **Impacto:** no se puede publicar en tiendas de forma repetible; el primer `versionCode`/`buildNumber` queda en valores por defecto y el segundo envío puede ser rechazado. Sin `projectId`, EAS pedirá crear el proyecto en cada máquina.
- **Recomendación:** crear `eas.json` con perfiles `development`, `preview` y `production`; definir `android.versionCode` e `ios.buildNumber` (o `autoIncrement`); fijar `owner`/`projectId`; decidir si se usa `expo-updates` (y documentarlo si no). Validar el identificador definitivo antes de la primera subida.
- **Alternativas:** build local con `expo run:android --variant release` y firma manual; no resuelve la reproducibilidad ni el OTA, pero desbloquea una entrega puntual.
- **Esfuerzo:** M
- **Riesgo:** bajo técnico, alto de calendario (requiere cuenta de desarrollador y revisión de tienda).
- **Dependencias:** nombre/identificadores definitivos; cuenta de Expo/Apple/Google; decisión sobre OTA.

---

### F3-02 — Navegación sin `+not-found`, sin `initialRouteName` y sin `ErrorBoundary`

- **Área:** navegación / robustez
- **Severidad:** **Alta**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `find apps/mobile/app -name '+not-found*'` no devuelve nada; no hay `unstable_settings` ni `export function ErrorBoundary` en `app/`; `app/_layout.tsx:36-70` solo declara `Stack.Screen`.
- **Qué ocurre:** una URL desconocida usa la pantalla por defecto de Expo Router; un deep link en frío a `/player/123` no garantiza una pila con las tabs detrás; un error de render no tiene contención.
- **Causa raíz:** no se ha añadido la capa de rutas de error de Expo Router.
- **Impacto:** mala experiencia en enlaces externos, posibilidad de que «atrás» cierre la app y pantalla roja/cierre ante un error de render.
- **Recomendación:** añadir `app/+not-found.tsx` con enlace a Inicio; exportar `ErrorBoundary` en `app/_layout.tsx`; declarar `export const unstable_settings = { initialRouteName: '(tabs)' }` en el layout raíz o en `(tabs)/_layout.tsx`.
- **Alternativas:** redirigir rutas desconocidas a `/` desde un guard; menos informativo para el usuario.
- **Esfuerzo:** S
- **Riesgo:** bajo; probar deep links en frío en Android e iOS.
- **Dependencias:** F3-01 para probar en build real.

---

### F3-03 — Primer arranque sin red: skeletons indefinidos en toda la app

- **Área:** datos / offline / arranque
- **Severidad:** **Crítica**
- **Tipo de evidencia:** CONFIRMADO (estático) + HIPÓTESIS (tiempo)
- **Evidencia:** `DataProvider.tsx:10-12` marca online solo con `isConnected`; las consultas usan el `networkMode` por defecto (`'online'`); `queries.ts:40-52` no lo cambia; `index.tsx:78-102` pinta `HomeSkeleton` si `isPending`; `team.tsx:335`, `calendar.tsx:77`, `news.tsx:202-211`, `ClubGate.tsx:29` y `player/[id].tsx:294` repiten el patrón. `_layout.tsx:26-28` oculta el splash al cargar fuentes, antes de restaurar la caché.
- **Qué ocurre:** con el móvil en modo avión y sin caché, las consultas quedan `paused` (`fetchStatus='paused'`, `isPending=true`, `isError=false`). Ninguna pantalla llega al estado de error. El usuario ve skeletons para siempre. Con red cautiva (conectado pero sin salida), el timeout de 15 s y 2 reintentos pueden mantener el skeleton ~48 s antes de mostrar error.
- **Causa raíz:** se confía en `isPending` como «cargando» sin distinguir `isPaused`/`fetchStatus`; no hay un estado offline explícito; el splash se oculta antes de que la caché esté restaurada.
- **Impacto:** la app parece rota en el escenario más común de un aficionado sin datos (metro, estadio, avión). Es el hallazgo de mayor impacto de usuario.
- **Recomendación:** (1) añadir un estado `isPaused`/`!online` que pinte un `EmptyState` offline con reintento; (2) definir `networkMode: 'always'` en las consultas para que al menos fallen y muestren error, o mantener `online` pero mapear `isPaused` a UI; (3) mover `hideAsync()` a `onSuccess` de `PersistQueryClientProvider` con timeout de ~1 s; (4) añadir un botón «Reintentar» que llame a `refetch()`.
- **Alternativas:** usar `onlineManager` con `isInternetReachable` y un mensaje global; no elimina el problema de la caché vacía.
- **Esfuerzo:** M
- **Riesgo:** medio; hay que probar los cinco escenarios del §5.5.
- **Dependencias:** F3-04 (restauración de caché), F3-14 (protocolo de arranque).

---

### F3-04 — Caché persistida en una sola entrada, cerca del límite de Android, reescrita completa

- **Área:** datos / almacenamiento
- **Severidad:** **Media**
- **Tipo de evidencia:** MEDIDO + CONFIRMADO
- **Evidencia:** `persister.ts:4-10` usa una única clave `deporhub-query-cache` con `throttleTime: 1000`; `DataProvider.tsx:26-33` persiste todas las consultas con éxito; suma de JSON publicados 1.227.860 B, serialización compacta 819.747 B; snapshots 8.631 B + fichas 101.087 B. Límites oficiales: 6 MB total y ~2 MB por `CursorWindow` en Android.
- **Qué ocurre:** toda la caché vive en una fila de AsyncStorage. Cada evento de persistencia serializa y reescribe ~0,85–1,0 MB. Al crecer con fichas de partido y temporadas, se acerca al límite de 2 MB (y al de ~1 MB de algunos dispositivos).
- **Causa raíz:** el persister de TanStack usa una clave única por defecto; no se ha troceado por consulta ni se ha movido el histórico grande a ficheros.
- **Impacto:** riesgo de `Row too big to fit into CursorWindow` y de corrupción/borrado de la caché; escrituras de ~1 MB en cada ráfaga de consultas; arranque más lento al restaurar.
- **Recomendación:** persistir solo el «hot set» pequeño (`meta`, `standings`, `fixtures`, `squad` resumido) y dejar snapshots/fichas en `expo-file-system` o en claves separadas; subir `throttleTime` a 2–5 s; limitar `shouldDehydrateQuery` por tamaño; instrumentar el tamaño serializado y avisar en desarrollo si supera 1,5 MB.
- **Alternativas:** usar `createAsyncStoragePersister` con `serialize`/`deserialize` por consulta y `multiSet`; o migrar a MMKV/SQLite si el volumen crece.
- **Esfuerzo:** M
- **Riesgo:** medio; una migración de caché mal hecha pierde datos offline (aceptable: se re-descargan).
- **Dependencias:** F3-06 (reducir `squad.json`), F3-03.

---

### F3-05 — `strictObject` rompe la compatibilidad aditiva y los documentos inválidos se ocultan

- **Área:** contrato / datos
- **Severidad:** **Alta**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `schemas.ts` tiene 86 `strictObject` (p. ej. `Squad` en :911, `Club` en :813, `News` en :380, `Player` en :877); `queries.ts:27-38` devuelve `null` ante `DataError('invalid')` y solo hace `console.error`.
- **Qué ocurre:** si el backend añade un campo aditivo (algo que el contrato permite y que ya obligó a añadir compatibilidad en `Titles`/`Rivalries`), una app antigua rechaza el documento completo. En opcionales, la pantalla muestra vacío; en obligatorios, error. No hay traza en producción.
- **Causa raíz:** se eligió `strictObject` para detectar errores de contrato, pero se aplicó también a documentos que deben evolucionar; no hay telemetría ni fallback de compatibilidad.
- **Impacto:** una actualización del backend puede dejar sin noticias, temporada, rivales o club a versiones antiguas de la app, sin explicación. Es un fallo silencioso y difícil de diagnosticar.
- **Recomendación:** usar `z.object` (que descarta claves desconocidas) para documentos consumidos por la app; reservar `strictObject` para configuración interna y tests de contrato. Añadir un test que inyecte una clave desconocida en cada ejemplo y espere éxito. Para `invalid` en opcionales, exponer un aviso no bloqueante y enviar telemetría.
- **Alternativas:** `.passthrough()` para conservar claves; útil si se re-publican datos, pero no es necesario en cliente.
- **Esfuerzo:** S–M (mecánico, con test de contrato)
- **Riesgo:** bajo; el cambio es más permisivo, no menos.
- **Dependencias:** `packages/schemas` y sus tests de compatibilidad.

---

### F3-06 — `squad.json` de 950 KB para 28 jugadores; el 78 % es historial de partidos

- **Área:** datos / payload
- **Severidad:** **Alta**
- **Tipo de evidencia:** MEDIDO
- **Evidencia:** `data/public/v1/squad.json` = 950.390 B (gzip 54.982 B); 28 jugadores, 1.262 entradas en `deporMatches`, 156 entradas de carrera y 28 fotos. `JSON.stringify` del documento = 619.108 caracteres; `deporMatches` = 485.084 (78,4 %), `career` = 72.483 (11,7 %). Solo `player/[id].tsx:310` consume `deporMatches`.
- **Qué ocurre:** la pestaña Equipo descarga y valida todo el historial de partidos de los 28 jugadores para pintar una lista/cuadrícula que solo usa nombre, dorsal, posición, edad, nacionalidad y foto.
- **Causa raíz:** un único contrato `squad.json` mezcla «plantilla» y «ficha detallada»; no hay endpoint por jugador ni documento resumido.
- **Impacto:** ~950 KB de parseo y validación en cada carga fría de Equipo; ~485 KB de datos que la lista no usa; más presión de caché (F3-04) y más tiempo de CPU en gama baja.
- **Recomendación:** publicar `squad.json` con el resumen (sin `deporMatches`/`career`) y un `players/<id>.json` (o `squad-details.json` cargado bajo demanda) para la ficha. Como paso intermedio, añadir un selector `useSquadSummary` que valide solo los campos de lista con un esquema reducido.
- **Alternativas:** mantener el contrato y dividir en `squad.json` + `squad-history.json`; menos cambios de pipeline, pero sigue habiendo dos descargas.
- **Esfuerzo:** M
- **Riesgo:** medio; toca pipeline, contrato y app a la vez. Se puede hacer aditivo para no romper versiones antiguas.
- **Dependencias:** F3-04, `packages/schemas`, pipeline de publicación.

---

### F3-07 — El refresco manual de la Home solo recarga 3 de 6 consultas

- **Área:** datos / UX
- **Severidad:** **Media**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `app/(tabs)/index.tsx:49-53` llama a `meta.refetch()`, `standings.refetch()` y `fixtures.refetch()`; no incluye `news`, `season` ni `rivals`.
- **Qué ocurre:** el usuario tira para refrescar y los titulares, la temporada y los rivales siguen con los datos anteriores (hasta 10 minutos de `staleTime`, o 7 días de caché si no hay red).
- **Causa raíz:** la Home se diseñó con tres consultas «obligatorias» y las opcionales quedaron fuera del gesto.
- **Impacto:** expectativa incumplida; noticias viejas tras un refresco aparentemente correcto.
- **Recomendación:** incluir las seis consultas en `refresh` (con `Promise.allSettled`) o etiquetar el gesto como «actualizar datos del partido» si se quiere mantener el coste bajo.
- **Alternativas:** un botón «Actualizar todo» separado; más explícito pero más UI.
- **Esfuerzo:** S
- **Riesgo:** bajo; el refresco de noticias añade ~108 KB.
- **Dependencias:** ninguna.

---

### F3-08 — «Borrar caché» no limpia la caché en memoria

- **Área:** ajustes / datos
- **Severidad:** **Media**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `settings.tsx:62-72` llama a `clearPersistedDataCache()`; `persister.ts:16-19` solo hace `persister.removeClient()` y `AsyncStorage.removeItem`; no hay `useQueryClient()` ni `queryClient.clear()` en `settings.tsx`.
- **Qué ocurre:** se borra la copia persistida, pero el `QueryClient` en memoria conserva los datos. La UI sigue mostrando la plantilla, las noticias y el club; al volver a persistir, la caché reaparece.
- **Causa raíz:** la función se diseñó como «borrar lo persistido», no como «borrar la caché de la app».
- **Impacto:** el usuario cree que ha liberado datos y no es así; si el objetivo era forzar una recarga, tampoco funciona hasta reiniciar.
- **Recomendación:** obtener `queryClient` y llamar a `queryClient.clear()` (o `removeQueries`) después de borrar AsyncStorage; confirmar al usuario que se han borrado los datos y que se re-descargarán.
- **Alternativas:** renombrar la acción a «Borrar caché de disco» y documentar que no afecta a la sesión; menos útil.
- **Esfuerzo:** S
- **Riesgo:** bajo; probar que no borra ajustes ni recordatorios.
- **Dependencias:** ninguna.

---

### F3-09 — `refetch()` del directo ejecuta una consulta deshabilitada

- **Área:** datos / directo
- **Severidad:** **Baja**
- **Tipo de evidencia:** CONFIRMADO (código) + HIPÓTESIS (comportamiento de React Query)
- **Evidencia:** `queries.ts:80-90` define `enabled: Boolean(LIVE_BASE_URL)`; `queries.ts:96-98` hace `live.refetch()` sin comprobar `LIVE_BASE_URL`.
- **Qué ocurre:** con `LIVE_BASE_URL` vacío, cada refresco de fixtures lanza un `refetch` de una consulta deshabilitada. React Query ejecuta el `queryFn` al llamar a `refetch()` explícitamente; `fetchData` con base vacía lanza `not_configured`, que `Promise.allSettled` absorbe.
- **Causa raíz:** el `refetch` combinado no distingue si el directo está configurado.
- **Impacto:** trabajo y error innecesarios en cada pull-to-refresh; ruido en logs; no rompe la UI.
- **Recomendación:** `if (LIVE_BASE_URL) await live.refetch()` o exponer `refetchLive` separado.
- **Alternativas:** dejar que React Query ignore el refetch si `enabled` es false (verificar la versión); no es necesario si se añade el guard.
- **Esfuerzo:** S
- **Riesgo:** bajo.
- **Dependencias:** ninguna.

---

### F3-10 — Retratos `-large` de 1,17 MB en la cuadrícula de 88 pt

- **Área:** rendimiento / imágenes
- **Severidad:** **Alta**
- **Tipo de evidencia:** MEDIDO + CALCULADO
- **Evidencia:** `team.tsx:80` usa `<PlayerPortrait player={player} size={88} quality="large" />`; `PlayerPortrait.tsx:17-21` sustituye `-large`/`-small`; medición HTTP del retrato de Álvaro Fernández: `-large` 1.168.147 B, `-small` 42.870 B, ambos `image/heic`.
- **Qué ocurre:** la cuadrícula pide la imagen de detalle para un círculo de 88 pt. Con 28 jugadores son ~32,7 MB de descarga y de caché de disco; en la lista se usa `small`, pero al cambiar de vista se vuelven a pedir.
- **Causa raíz:** se priorizó la calidad visual sobre el tamaño; no hay `srcSet`/thumbnail por densidad.
- **Impacto:** consumo de datos y batería, caché de disco grande, riesgo de decodificación HEIC en Android de gama baja, primer render más lento.
- **Recomendación:** usar `quality="small"` en la cuadrícula y reservar `large` para la ficha y el modal; si se quiere más nitidez, generar un `-medium` (~200–300 px) en el CDN. Aprovechar `expo-image` `placeholder`/`blurhash` si existe.
- **Alternativas:** cargar `large` solo al hacer zoom o al abrir la ficha; no cambia el contrato.
- **Esfuerzo:** S
- **Riesgo:** bajo; revisar que el retrato de 88 pt no se vea borroso.
- **Dependencias:** CDN del club (disponibilidad de `-small`).

---

### F3-11 — 4,08 MB de fuentes de iconos y 4,8 MB de assets; `licenses.json` en el bundle

- **Área:** rendimiento / bundle
- **Severidad:** **Media**
- **Tipo de evidencia:** MEDIDO
- **Evidencia:** `apps/mobile/dist/assets` = 4,8 MB / 48 ficheros; 19 TTF de `@expo/vector-icons` = 4.076.840 B; solo se usa Ionicons (389.724 B); los tres TTF propios suman 776.496 B; `licenses.json` = 95.701 B / 1.052 paquetes, importado en `about.tsx:5`; todas las pantallas importan `{ Ionicons } from '@expo/vector-icons'`.
- **Qué ocurre:** el barrel de `@expo/vector-icons` incluye las 19 familias; se empaquetan ~3,7 MB de fuentes que nunca se renderizan. Las licencias entran en el bundle JS aunque solo se usen en un modal.
- **Causa raíz:** imports de barrel y un JSON grande importado estáticamente.
- **Impacto:** instalación más pesada, más assets que copiar/verificar y más memoria de fuentes; el bundle JS carga 95,7 KB de licencias en el arranque.
- **Recomendación:** importar `Ionicons` desde su subpath; medir el bundle antes/después. Mover `licenses.json` a un asset cargado bajo demanda o a una pantalla web. Verificar con `expo export --dump-sourcemap` / `source-map-explorer`.
- **Alternativas:** usar `@expo/vector-icons/Ionicons` y eliminar el resto; o migrar a SVGs propios si el conjunto es pequeño.
- **Esfuerzo:** S
- **Riesgo:** bajo; comprobar que no hay imports dinámicos de otras familias.
- **Dependencias:** build de comparación (no ejecutado en esta auditoría).

---

### F3-12 — La cuenta atrás repinta cada segundo siempre y hay cuatro timers en la Home

- **Área:** rendimiento / render
- **Severidad:** **Media**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `Countdown.tsx:64` llama a `useCountdown(targetMs, true)`; `useCountdown.ts:15` fija `interval = withSeconds && remaining > 0 ? 1_000 : 60_000`; existe `showsSeconds` en `logic.ts:303` pero no se usa. En la Home conviven `useNow(60_000)` (`index.tsx:46`), `useNow(60_000)` en `NextMatchCard.tsx:100`, `useNow(1_000)` del countdown y el `setInterval(60_000)` de `FreshnessBanner.tsx:24`.
- **Qué ocurre:** a 10 días del partido, el componente se repinta cada segundo para mostrar los mismos minutos; el resto de la Home no se repinta, pero el timer y el trabajo de render existen. El ADR 0015 dice «cada segundo bajo una hora y cada minuto por encima».
- **Causa raíz:** se pasó `true` fijo en lugar de `showsSeconds(targetMs, now)`; el test de `useCountdown` solo comprueba que hay un intervalo, no la cadencia.
- **Impacto:** batería y CPU innecesarios en una pantalla que puede estar abierta mucho tiempo; contradice una decisión documentada.
- **Recomendación:** `const withSeconds = showsSeconds(targetMs, nowMs());` y `useCountdown(targetMs, withSeconds)`. Añadir un test que verifique 1.000 ms bajo una hora y 60.000 ms por encima. Unificar los `useNow` de la Home en un solo contexto/reloj si se quiere afinar.
- **Alternativas:** dejar el intervalo de 1 s solo cuando la pantalla está enfocada y el partido es hoy; más complejo.
- **Esfuerzo:** S
- **Riesgo:** bajo; el test existente sigue pasando.
- **Dependencias:** ADR 0015.

---

### F3-13 — Listas sin memoización ni ajustes de virtualización

- **Área:** rendimiento / listas
- **Severidad:** **Baja**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `team.tsx:341-373` (`FlatList`, sin `getItemLayout`, sin `React.memo` en `SquadCard`/`SquadListRow`); `news.tsx:245-...` (`SectionList` de 150 historias, sin `initialNumToRender`/`windowSize`); `calendar.tsx:97` (`SectionList` de 38 partidos).
- **Qué ocurre:** cada cambio de `now`, filtro o búsqueda vuelve a renderizar las filas visibles; no hay `memo` ni `useCallback` en `renderItem`.
- **Causa raíz:** el volumen actual (28/150) no obligó a optimizar; el ADR 0011 descartó FlashList conscientemente.
- **Impacto:** en gama baja, el cambio de vista o el tick de `now` puede producir jank; con 150 noticias, el coste de sección es mayor.
- **Recomendación:** `React.memo` en filas, `useCallback` para `renderItem`/`keyExtractor`, `initialNumToRender` ajustado y `windowSize` explícito; no hace falta `getItemLayout` con altura variable.
- **Alternativas:** FlashList cuando la lista crezca; implica dependencia nativa y development build.
- **Esfuerzo:** S
- **Riesgo:** bajo; medir con el monitor de rendimiento de Expo.
- **Dependencias:** ninguna.

---

### F3-14 — El objetivo de arranque <2,5 s no está instrumentado ni medido

- **Área:** rendimiento / proceso
- **Severidad:** **Media**
- **Tipo de evidencia:** CONFIRMADO (ausencia) + HIPÓTESIS (cifras)
- **Evidencia:** `docs/ESTADO.md:172,190` reconoce que «el arranque <2,5 s no se ha medido todavía en un móvil de gama media»; no hay `performance.mark`, `react-native-performance`, `MetricKit` ni script de medición en el repo; `_layout.tsx` solo oculta el splash al cargar fuentes.
- **Qué ocurre:** no se puede saber si el objetivo se cumple ni si una regresión lo rompe. Las cifras de este informe son de escritorio.
- **Causa raíz:** la medición se dejó para H9; no hay presupuesto de rendimiento en CI.
- **Impacto:** decisiones de optimización a ciegas; riesgo de que el primer build de release sorprenda.
- **Recomendación:** implementar el protocolo del §5.5 (marks + `adb am start -W` + Instruments/MetricKit), registrar p50/p90 en cada release y añadir un umbral de CI o de revisión manual.
- **Alternativas:** usar el monitor de rendimiento de Expo en development build; sirve para orientar, no para aceptar.
- **Esfuerzo:** M
- **Riesgo:** bajo; requiere dispositivos y disciplina de registro.
- **Dependencias:** F3-01 (release build), F3-03 (splash/caché).

---

### F3-15 — Falta el permiso de alarmas exactas en Android 12+

- **Área:** recordatorios / Android
- **Severidad:** **Alta**
- **Tipo de evidencia:** CONFIRMADO (config) + HIPÓTESIS (efecto en dispositivo)
- **Evidencia:** `app.json:13-22` no declara `android.permissions` ni `SCHEDULE_EXACT_ALARM`; `notifications.ts:62` usa `SchedulableTriggerInputTypes.DATE` (AlarmManager); no se comprueba `canScheduleExactAlarms`.
- **Qué ocurre:** en Android 12+ las alarmas exactas requieren un permiso especial. Sin él, el sistema puede agrupar/retrasar el aviso o no programarlo con la precisión esperada. La app no avisa al usuario ni ofrece abrir los ajustes.
- **Causa raíz:** el permiso se añadió tarde en Android y Expo no lo incluye por defecto en el manifest de la app.
- **Impacto:** un recordatorio de «15 minutos antes» puede llegar tarde; es una función de confianza y el fallo es silencioso.
- **Recomendación:** añadir `android.permissions: ["SCHEDULE_EXACT_ALARM"]` (o `USE_EXACT_ALARM` si la política de la tienda lo permite) y comprobar `canScheduleExactAlarms()` antes de programar; si no está concedido, degradar a aviso inexacto y explicarlo. Probar en Android 12, 13 y 14.
- **Alternativas:** usar solo notificaciones locales inmediatas o recordatorios por calendario; pierde la función.
- **Esfuerzo:** S–M
- **Riesgo:** medio; el permiso es sensible y la política de Google Play lo revisa.
- **Dependencias:** F3-16, development build.

---

### F3-16 — `syncReminders` no está serializado: cancelaciones y programaciones concurrentes

- **Área:** recordatorios / concurrencia
- **Severidad:** **Media**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `ReminderSync.tsx:11-16` lanza `syncReminders(...)` en un efecto que depende de `fixtures`, `remindersEnabled`, `remindMatches` y `language`; `notifications.ts:41-64` hace `getAllScheduledNotificationsAsync` → cancela todas → programa en bucle, sin mutex ni cola.
- **Qué ocurre:** dos ejecuciones solapadas (cambio de ajuste + llegada de fixtures) pueden cancelar avisos que la otra acaba de programar, duplicarlos o dejar el estado inconsistente.
- **Causa raíz:** no hay serialización de una operación con efectos secundarios en el dispositivo.
- **Impacto:** recordatorios perdidos o duplicados; difícil de reproducir y de diagnosticar.
- **Recomendación:** encolar con una promesa compartida (`let pending = Promise.resolve(); pending = pending.then(...)`) o un mutex; cancelar solo los identificadores propios; programar por `identifier` idempotente y verificar el resultado. Añadir un test de integración con el módulo mockeado.
- **Alternativas:** mover la programación a un único efecto con debounce de 300 ms; reduce la ventana, no la elimina.
- **Esfuerzo:** S
- **Riesgo:** bajo.
- **Dependencias:** F3-15.

---

### F3-17 — El plegado de ICS cuenta caracteres, no octetos UTF-8

- **Área:** calendario / formato
- **Severidad:** **Baja**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `src/utils/ics.ts:16-22`: `line.length <= 75`, `slice(0, 75)`, `slice(i, i + 74)`; el propio comentario reconoce «aproxima por caracteres, no por octetos».
- **Qué ocurre:** `DESCRIPTION`/`LOCATION` con acentos, ñ o emoji pueden superar los 75 octetos que fija RFC 5545. Algunos clientes estrictos pueden rechazar o mostrar mal la línea.
- **Causa raíz:** se usa `String.length` en lugar de `Buffer.byteLength(line, 'utf8')`.
- **Impacto:** casos límite al exportar el calendario; la mayoría de clientes lo toleran, pero no todos.
- **Recomendación:** plegar por octetos UTF-8 sin cortar un carácter multibyte; añadir tests con `á`, `ñ`, `€` y emoji.
- **Alternativas:** usar una librería ICS; añade dependencia para un caso pequeño.
- **Esfuerzo:** S
- **Riesgo:** bajo.
- **Dependencias:** ninguna.

---

### F3-18 — Gallego al 29,7 % y documentación desactualizada

- **Área:** i18n
- **Severidad:** **Media**
- **Tipo de evidencia:** MEDIDO
- **Evidencia:** `es.json` 713 claves, `en.json` 713, `gl.json` 212; 501 claves ausentes (70,3 %); `docs/ESTADO.md:308` dice «162/454».
- **Qué ocurre:** el gallego cae a español en la mayor parte de la app. La documentación no refleja la cobertura real, así que no se puede saber si mejora.
- **Causa raíz:** traducción GL parcial y falta de un script de cobertura en CI.
- **Impacto:** un usuario gallegohablante ve una mezcla de GL/ES; la promesa de «GL parcial» es honesta, pero la experiencia es inconsistente.
- **Recomendación:** decidir el nivel objetivo (p. ej. 100 % de las pantallas principales), generar la tabla de cobertura con un script y publicarla; marcar las claves pendientes con un test que falle si baja el porcentaje.
- **Alternativas:** retirar GL de la UI hasta que esté completo; menos confuso que una mezcla.
- **Esfuerzo:** M (traducción) / S (script)
- **Riesgo:** bajo.
- **Dependencias:** revisión de textos por un hablante nativo.

---

### F3-19 — Textos hardcodeados y metadatos ICS solo en español

- **Área:** i18n / accesibilidad
- **Severidad:** **Baja**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `ClubImage.tsx:128` `accessibilityLabel="Ilustración de equipación"`; `ics.ts:35,37` `PRODID` y `X-WR-CALNAME` fijos; `app.json:37` permiso de calendario solo en español.
- **Qué ocurre:** usuarios GL/EN ven o escuchan español en esos puntos; el permiso nativo no se localiza.
- **Causa raíz:** cadenas fuera de `t()` y falta de `InfoPlist.strings`/`strings.xml` localizados.
- **Impacto:** inconsistencia de idioma y accesibilidad; bajo volumen, pero visible.
- **Recomendación:** mover la etiqueta a `t('club.kitIllustration')`; parametrizar `PRODID`/`X-WR-CALNAME` o dejarlos neutros; añadir cadenas nativas localizadas para el permiso de calendario.
- **Alternativas:** dejar el ICS en ES y documentarlo; el permiso nativo sigue siendo el caso más visible.
- **Esfuerzo:** S
- **Riesgo:** bajo.
- **Dependencias:** F3-18.

---

### F3-20 — Código y claves i18n muertos

- **Área:** mantenimiento
- **Severidad:** **Baja**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** §2.6: `PlaceholderScreen` (16 líneas), `PlayerRow` (62), `SocialBlock` (154), `Chip`, `useSocial`, `social.json` (645 B), `openVenueInMaps`, `USING_LOCAL_DATA`, `SHOW_RIVAL_PHOTOS`; claves `home.howToGetThere`, `home.mapError`, `data.notConfigured`, `home.lastResult`, `common.confidenceLevel.*`.
- **Qué ocurre:** hay piezas que parecen parte del producto pero ya no se usan; la función «Cómo llegar» desapareció de la Home y sus textos siguen ahí.
- **Causa raíz:** evolución por hitos sin limpieza posterior.
- **Impacto:** confusión en el mantenimiento, tests que cubren código muerto y falsas expectativas sobre funcionalidad existente.
- **Recomendación:** eliminar en un PR de limpieza con `knip`/búsqueda manual; borrar `social.json` y `useSocial` si no hay plan de H6; retirar las claves i18n muertas de los tres idiomas.
- **Alternativas:** dejar el código marcado como `@deprecated`; no reduce el ruido.
- **Esfuerzo:** S
- **Riesgo:** bajo; revisar imports dinámicos de secciones de club.
- **Dependencias:** ninguna.

---

### F3-21 — Higiene de dependencias: extraneous, Node y duplicados de tooling

- **Área:** dependencias / entorno
- **Severidad:** **Baja**
- **Tipo de evidencia:** MEDIDO
- **Evidencia:** `node_modules/@expo-google-fonts/*` = 18 MB, 3 paquetes no declarados; `npm ls` los marca `extraneous`; `engines.node >=22.13` pero la sesión arrancó con Node 20.20.2 y `expo lint` avisa; `react-is` 19.3.1/18.3.1/16.13.1; `zod` 3.25.76 bajo `@expo/cli`.
- **Qué ocurre:** el `node_modules` local no coincide con el lock; el entorno de desarrollo puede usar una versión de Node no soportada; hay duplicados de tooling.
- **Causa raíz:** instalaciones manuales de fuentes y falta de `.nvmrc`/`volta`/CI que fije Node.
- **Impacto:** builds locales no reproducibles, avisos de Expo y posibles diferencias con CI. Los duplicados de `react-is`/`zod` no entran en el bundle de la app.
- **Recomendación:** `npm prune` + `npm ci`; añadir `.nvmrc` (22.23.3) y `engines` coherente; documentar la versión en README; no perseguir los duplicados de tooling salvo que `npm dedupe` los elimine sin romper.
- **Alternativas:** usar Volta/Corepack para fijar Node y npm.
- **Esfuerzo:** S
- **Riesgo:** bajo.
- **Dependencias:** CI.

---

### F3-22 — Error de red presentado como «no encontrado» en Partido, Jugador y Entrenador

- **Área:** estados / UX
- **Severidad:** **Media**
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `match/[id].tsx:43-51` (`waiting ? Loading : EmptyState('match.notFound')`); `player/[id].tsx:290-295` (`squad.isPending ? Loading : EmptyState('player.notFound')`); `coach.tsx:45-50` (mismo patrón). Ninguno comprueba `isError`.
- **Qué ocurre:** si la consulta falla por red o por contrato inválido, la pantalla dice «no encontrado» en lugar de «no se pudo cargar». El usuario no sabe si el dato no existe o si debe reintentar.
- **Causa raíz:** el estado vacío se usó como catch-all del estado no-cargado.
- **Impacto:** soporte engañoso, reintentos imposibles, percepción de que la ficha no existe.
- **Recomendación:** añadir `ErrorState` con `refetch` cuando `isError` y no haya datos; reservar `EmptyState` para el caso en que la consulta terminó con éxito y el id no está. Reutilizar `ClubGate` o un `QueryGate` común.
- **Alternativas:** un mensaje único «No se pudo cargar; reintentar» que cubra ambos; menos preciso.
- **Esfuerzo:** S
- **Riesgo:** bajo.
- **Dependencias:** F3-03.

---

## 10. Plan de acción priorizado

### 10.1 Antes de publicar (P0)

| ID | Acción | Esfuerzo |
|---|---|---|
| F3-01 | `eas.json`, perfiles, `versionCode`/`buildNumber`, `owner`/`projectId` | M |
| F3-03 | Estado offline explícito + splash hasta restaurar caché | M |
| F3-05 | `z.object` en documentos + test de campo aditivo + telemetría de inválidos | S–M |
| F3-10 | `quality="small"` en cuadrícula | S |
| F3-15 | Permiso de alarmas exactas + degradación | S–M |

### 10.2 Rendimiento (P1)

| ID | Acción | Esfuerzo |
|---|---|---|
| F3-04 | Trocear/limitar la caché; subir `throttleTime` | M |
| F3-06 | Separar resumen de plantilla e historial | M |
| F3-11 | Importar solo Ionicons; sacar `licenses.json` del bundle | S |
| F3-12 | `showsSeconds` real; unificar timers | S |
| F3-14 | Protocolo de arranque y registro p50/p90 | M |

### 10.3 Calidad y deuda (P2)

| ID | Acción | Esfuerzo |
|---|---|---|
| F3-02 | `+not-found`, `ErrorBoundary`, `initialRouteName` | S |
| F3-07 | Refresco completo de Home | S |
| F3-08 | `queryClient.clear()` al borrar caché | S |
| F3-16 | Serializar `syncReminders` | S |
| F3-18 | Cobertura GL y script de medición | M |
| F3-22 | `ErrorState` en Partido/Jugador/Entrenador | S |

### 10.4 Higiene (P3)

| ID | Acción | Esfuerzo |
|---|---|---|
| F3-09 | Guard de `LIVE_BASE_URL` en `refetch` | S |
| F3-13 | `memo`/`useCallback`/virtualización | S |
| F3-17 | Plegado ICS por octetos | S |
| F3-19 | Textos hardcodeados y permiso localizado | S |
| F3-20 | Limpieza de código y claves muertas | S |
| F3-21 | `npm ci`, `.nvmrc`, limpieza de extraneous | S |

### 10.5 Checklist de release

- [ ] `eas.json` con perfiles y versionado.
- [ ] `versionCode`/`buildNumber` incrementados.
- [ ] Build release en Android e iOS, no Expo Go.
- [ ] Escenarios A–E del §5.5 medidos y registrados.
- [ ] Modo avión sin caché: estado offline explícito en <1,5 s.
- [ ] Notificaciones locales y alarmas exactas probadas en Android 12/13/14.
- [ ] Calendario nativo y fallback `.ics` probados.
- [ ] Deep links `deporhub://` probados en frío.
- [ ] i18n ES/EN/GL revisada en las pantallas principales.
- [ ] `npm audit` revisado y aceptado.
- [ ] Identificadores y nombre definitivos.

---

## 11. Anexo: comandos y mediciones

### 11.1 Comandos ejecutados

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ exit 0 **[MEDIDO]** |
| `npm run lint` | ✅ exit 0; aviso de Node 20.20.2 no soportado **[MEDIDO]** |
| `npx jest --runInBand --watchman=false` (en `apps/mobile`) | ✅ 35 suites, 302 tests, 4,478 s **[MEDIDO]** |
| `wc -c data/public/v1/*.json` | tamaños de §4.3 **[MEDIDO]** |
| `gzip -c` sobre los JSON | gzip de §4.3 **[MEDIDO]** |
| `curl -sIL` a `cdn.bff.rcdeportivo.app/...` | 1.168.147 B vs 42.870 B **[MEDIDO]** |
| `curl` a Open-Meteo (Riazor) | 2.825 B / 835 B gzip **[MEDIDO]** |
| `find node_modules/@expo/vector-icons -name '*.ttf'` + `wc -c` | 19 TTF, 4.076.840 B **[MEDIDO]** |
| `du -sh apps/mobile/dist/assets` | 4,8 MB, 48 ficheros **[MEDIDO]** |
| `wc -c dist/.../*.hbc` | 6.009.226 B **[MEDIDO]** |
| `node` con `JSON.parse`/`safeParse` | 1,08 ms / 2,18 ms mediana **[MEDIDO, escritorio]** |
| `node` con blob compacto de 11 documentos | 819.747 B; parse 1,16 ms **[MEDIDO, escritorio]** |
| `npm ls --depth=0` | 33 deps + 4 dev; 3 extraneous **[MEDIDO]** |
| `npm view <paquete> version` | últimas de §6.1 **[MEDIDO]** |
| `du -sh node_modules/@expo-google-fonts` | 18 MB **[MEDIDO]** |

### 11.2 Lo que no se ha ejecutado

- Ningún build de release ni `expo export` nuevo. Las cifras de `dist` son del artefacto del **31-oct-2026**, anterior a los últimos commits; sirven de orden de magnitud, no de medición del HEAD.
- Ninguna medición en dispositivo (Android/iOS). Todo lo que dependa de hardware está marcado **[HIPÓTESIS]**.
- Ninguna prueba en Expo Go ni en development build.
- Ninguna comprobación de la URL de producción ni de las cabeceras de caché del CDN; `.env` no se ha leído.
- Ninguna prueba de accesibilidad con lector de pantalla ni de texto grande.

### 11.3 Referencias internas

- `docs/auditoria/parciales/FASE-0-linea-base.md` — línea base y entorno.
- `docs/auditoria/parciales/FASE-5-calidad.md` — tests, cobertura, `npm audit`, Node.
- `docs/ESTADO.md` — estado de hitos y pendientes declarados.
- `docs/adr/0011-rediseno-equipo-y-ficha.md` — decisión FlatList vs FlashList.
- `docs/adr/0015-inicio-real-y-cadencia-adaptativa.md` — cuenta atrás y refresco de Home.
- `docs/adr/0017-inicio-v2-temporada-rivales-y-tiempo.md` — calendario, ICS y limitaciones de Expo Go.
- `docs/adr/0019-*`, `0025-*`, `0030-*` — rendimiento, cadencia y distribución.
- `docs/adr/0032-*`, `0033-*` — club ampliado e himnos.

### 11.4 Fuentes externas consultadas

- AsyncStorage, límites de Android: <https://react-native-async-storage.github.io/2.0/advanced/Limits/> (2026-11-11).
- Expo SDK 58: <https://expo.dev/changelog/sdk-58> (15-oct-2026).
- Expo Go: <https://expo.dev/go> (SDK 58 latest, 2026-11-11).
- npm registry para versiones publicadas (2026-11-11).

---

**Fin del informe.**
