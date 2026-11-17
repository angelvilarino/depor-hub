# Correcciones de la auditoría

Registro de lo corregido, con el ID del informe, la evidencia y el estado. Los
lotes siguen el orden de `INFORME.md` §8. La fuente de verdad de cada hallazgo es
`docs/auditoria/INFORME.md`; aquí solo se anota qué se ha hecho y cómo se
comprueba.

## Lote 0 — Verdad operativa

Estado: **cerrado en local**. La verificación en producción queda pendiente de
reactivar Actions al cerrar el Lote 1 (decisión del propietario: no reactivar
todavía).

| ID | Estado | Qué se ha corregido | Evidencia |
|---|---|---|---|
| D1-01 / F5-01 | Hecho en local; pendiente de producción | `main` rebasado sobre `origin/main` y publicado con push directo. Se añade un smoke test que comprueba los documentos del contrato, los valida con Pydantic y compara `meta.dataHash`. | `scripts/depor_hub/smoke.py`, `scripts/tests/test_smoke.py`, `.github/workflows/smoke.yml`; `python -m depor_hub.cli smoke --data data/public/v1` → `smoke ok: 11 documentos válidos` |
| D1-09 | Hecho | `club.json` deja de mantener listas paralelas: `titles` se deriva de `titles.json` y `rivalries` de `rivalries.json`. `club.yml` queda como respaldo si los documentos no existen. | `scripts/depor_hub/club.py` (`derive_titles`, `derive_rivalries`), `scripts/tests/test_club.py`; `club.json` pasa de 1 a 6 rivalidades y conserva los 9 grupos de títulos |
| PIPE-01 | Decidido y documentado | Actions sigue **deshabilitado** a nivel de repositorio desde el 11-nov-2026. No se reactiva en el Lote 0. README, `docs/ESTADO.md`, `docs/sources.md` y `docs/operations.md` lo dicen de forma explícita y remiten al cierre del Lote 1. | Búsqueda de «Actions» en README y docs; no se ha usado ningún token ni se ha lanzado un workflow real |
| PIPE-04 | Hecho | `match-details` distingue «no había partido pendiente» de «había partido y BDFutbol falló / no lo emparejó / el marcador no coincide». Emite anotaciones `::error::`; con `--strict` sale 2. El workflow usa `continue-on-error` y un job `bdfutbol-alert` deja el run en rojo al final, después de publicar fixtures, snapshots y club. | `scripts/depor_hub/cli.py`, `.github/workflows/data-refresh.yml`, `scripts/tests/test_match_details.py`, `scripts/tests/test_workflows.py`; 403 simulado ⇒ código 2; día sin pendientes ⇒ 0 |
| PIPE-05 / F5-02 | Hecho | `status.json` se calcula por workflow, con `lastSuccessAt`, `expectedWithinHours` y `stale`. `health.yml` pide una ventana por workflow en vez de 50 runs globales; Rivals ya no queda fuera. | `scripts/depor_hub/models.py`, `scripts/depor_hub/cli.py`, `.github/workflows/health.yml`, `scripts/tests/test_status.py`, `scripts/tests/test_workflows.py`; Data 36 h, News 6 h, Rivals 8 días, Health 8 h, CI sin caducidad |
| PIPE-14 | Hecho | Se elimina de `docs/operations.md` el cron externo que nunca se implementó y se sustituye por disparo manual con `gh workflow run` (solo cuando Actions esté activo). | `docs/operations.md` |
| F5-06 | Hecho | El test de la Home usa fixtures JSON congelados en `apps/mobile/src/test-utils/fixtures/home/`; un refresco del bot ya no cambia la jornada publicada ni rompe Jest. | `apps/mobile/src/__tests__/home.test.tsx`; 302 tests verdes |
| F5-08 | Hecho (Lote 0) | README, `docs/ESTADO.md`, `docs/sources.md`, `docs/operations.md` y ADR 0015–0018 y 0025 alineados con la realidad: cadencia efectiva 10/60 min, noticias 30 min, rivales diario, 58 imágenes, GL 212/713, Actions pausado, 11 documentos raíz + snapshots. | Diff documental de este lote; `python -m depor_hub.cli validate` y `smoke` en verde |
| D1-02 | No, va al Lote 1 | `content_hash` sigue ignorando solo `updatedAt`/`dataHash` en la raíz. Se ha comprobado que `f8b…` no cambia con los nuevos campos de `status.json` porque ese fichero no alimenta el hash deportivo. | `scripts/depor_hub/transform.py`; pendiente el hash normalizado a cualquier profundidad en el Lote 1 |
| PIPE-02 / PIPE-11 | No, van al Lote 1 | La cadencia sigue igual a propósito: primero se publica y se observa. El informe lo pide explícitamente («No hacer todavía: cambiar la cadencia»). | `.github/workflows/data-refresh.yml` sin cambios de cron |

### Medición antes / después

| Métrica | Antes | Después |
|---|---:|---:|
| Divergencia `main...origin/main` | `23 159` | `0 0` tras el push |
| Documentos raíz validados | 11 (sin smoke reproducible) | 11 + smoke con `dataHash` |
| Workflows en `status.json` | 3, con ventana global | 5, con ventana y `lastSuccessAt` por workflow |
| Rivalidades en `club.json` | 1 (Celta) | 6 (las de `rivalries.json`) |
| Tests Python | 230 | 241 |
| Tests Jest | 301/302 (1 rojo por datos) | 302/302 |
| Cron externo documentado | Sí, sin implementar | Eliminado; disparo manual explícito |

### Interpretación de los «13 documentos»

El informe cuenta **13 documentos a 200**: los 11 ficheros raíz del contrato
(`meta`, `standings`, `fixtures`, `squad`, `season`, `club`, `news`, `rivals`,
`social`, `titles`, `rivalries`) más los árboles `snapshots/<season>/<id>.json` y
`match-details/<season>/<id>.json`, que no son documentos raíz sino colecciones.
El smoke comprueba los 11 raíz; `validate` comprueba además los 24 ficheros de
snapshot/detalle. La comprobación HTTP de los 13 sigue bloqueada por Actions.

### Comandos de verificación ejecutados

```bash
ruff check scripts
pytest scripts -q                       # 241 passed
python -m depor_hub.cli schemas
python -m depor_hub.cli validate --data data/public/v1
python -m depor_hub.cli smoke --data data/public/v1
npm run lint
npm run typecheck
npm test                                # 302 passed
cd workers/live-proxy && npm test       # 4 passed
```

## Lote 1 — Idempotencia y cadencia

Estado: **cerrado en local**. Actions sigue deshabilitado hasta que el propietario
ejecute las instrucciones de reactivación de `docs/operations.md`; por eso las
métricas de runs y minutos son una estimación de diseño, no una medición de 30
días todavía.

| ID | Estado | Qué se ha corregido | Evidencia |
|---|---|---|---|
| D1-02 / PIPE-03 | Hecho | `content_hash` elimina `updatedAt`, `dataHash`, `capturedAt` y `generatedAt` a cualquier profundidad, no solo en la raíz. Dos ingestas idénticas con timestamps distintos producen el mismo hash y la segunda no escribe. | `scripts/depor_hub/transform.py` (`_canonical`, `_VOLATILE_KEYS`), `scripts/tests/test_depor_hub.py`; test de doble pasada con `write_if_changed` |
| PIPE-02 | Hecho | Data pasa a **una pasada diaria** (`0 6 * * *`) que borra el estado para consultar la red; fuera de ventana, `--if-due` mantiene **55 min**. En días de partido, `data-matchday.yml` revisa cada 2 h y lanza `data-refresh.yml` cada 10 min dentro de [−30, +150] min del kickoff. | `.github/workflows/data-refresh.yml`, `.github/workflows/data-matchday.yml`, `scripts/depor_hub/cadence.py`, `scripts/tests/test_cadence.py`, `scripts/tests/test_workflows.py` |
| PIPE-06 | Hecho | Data, News y Rivals comparten `concurrency.group: main-write`; Pages se serializa en `pages-deploy`. Se mantiene el rebase de 5 intentos como red de seguridad. | Los tres workflows + `.github/workflows/publish.yml`; `scripts/tests/test_workflows.py` |
| PIPE-07 | Hecho | Se detectan degradaciones parciales de BDFutbol: calendario con 0 filas, ficha sin alineaciones ni eventos y balance con partidos pero sin cruces lanzan `SourceError`. Los workflows dejan el run en rojo con anotación sin impedir la publicación del resto. Fixtures HTML actualizados para que un cambio de estructura rompa un test. | `scripts/depor_hub/enrich/bdfutbol.py`, `scripts/depor_hub/rivals.py`, `scripts/tests/test_match_details.py`, `scripts/tests/test_season_rivals.py`, `scripts/tests/test_club_extra.py` |
| PIPE-08 | Hecho | `data-refresh.yml` no ejecuta `club`, `club titles`, `club rivalries` ni `club-images`. El club es **estático**: se elimina `club-refresh.yml` y sus documentos se regeneran a mano cuando cambian los YAML curados. | `.github/workflows/data-refresh.yml`, `docs/operations.md` (Club manual), `scripts/tests/test_workflows.py` |
| PIPE-11 | Hecho | `snapshots` y `match-details` solo corren si `ingest` hizo una pasada real (`refreshed=true`). La validación completa y el commit solo si hay cambios (`dirty=true`). Un run vacío no instala trabajo de datos ni despliega. | `.github/workflows/data-refresh.yml`; `scripts/tests/test_workflows.py` |
| PIPE-12 | Hecho | Health pasa a **una vez al día** (`0 7 * * *`), consulta Data/News/Rivals/Health/CI y **pone el run en rojo** si `status.json` queda en `ok=false`, después de publicarlo. Su propio run no cuenta para `ok`, para no crear un bucle rojo. Umbrales: Data 36 h, News 6 h, Rivals 8 días, Health 30 h; el Club ya no tiene workflow. | `.github/workflows/health.yml`, `scripts/depor_hub/cli.py` (`_STATUS_WORKFLOWS`, `_workflow_ok`), `scripts/tests/test_status.py`, `scripts/tests/test_workflows.py` |
| PIPE-16 | Hecho | Un único `publish.yml` (`workflow_call`) contiene el deploy de Pages. Data, News y Rivals lo llaman solo si su commit cambió algo; se eliminan las copias duplicadas. | `.github/workflows/publish.yml`; los tres workflows ya solo tienen `uses: ./.github/workflows/publish.yml` |

### Medición antes / después

| Métrica | Antes | Después |
|---|---:|---:|
| Triggers de Data al mes | 4.320 (`*/10` todo el día) | ~30/mes de Data + ~210/mes de checkpoints (7/día) + dispatches solo en días de partido |
| Runs de Data que solo comprueban | 1.398/1.672 (84 %) | Los runs vacíos dejan de ejecutar snapshots, match-details, validación completa y deploy |
| Commits que solo mueven timestamps | 179/233 (76,8 %) | 0 por diseño: dos ingestas idénticas no vuelven a escribir |
| Ventana fuera de partido | 60 min | 55 min |
| Grupos de escritura de `main` | `data-publish` + `news-publish` | Un solo `main-write` |
| Workflows que desplegaban Pages | 3 copias | 1 reusable (`publish.yml`) |
| Cadencia de Rivals | Diaria (`17 6 * * *`) | Semanal (`0 22 * * 1`) |
| Cadencia de Health | Cada 4 h (`0 */4 * * *`) | Diaria (`0 7 * * *`) |
| Workflows que mantenían el club | `club-refresh` semanal | Ninguno: publicación manual |
| Workflows de estado | 6 workflows, Health 8 h sin alerta | 5 workflows, Health 30 h, run rojo visible |

La estimación de runs queda por debajo de los criterios del informe (< 2.500
runs/mes y < 1.500 min/mes). La confirmación real exige 30 días con Actions
activo; hasta entonces se marca como **estimación**, no como medición.

### Decisión del propietario (14-nov-2026)

El informe de auditoría proponía un cron híbrido con banda densa de fin de semana.
El propietario decidió **bajar aún más el coste** antes de empezar el Lote 2:

| Pipeline | Antes (Lote 1) | Ahora | Motivo |
|---|---|---|---|
| Data | `0 * * * *` + `*/10 12-23 * * 6,0` | `0 6 * * *` + `data-matchday.yml` en días de partido | Fuera de un partido los datos apenas cambian; en el partido sí importa la inmediatez |
| Rivals | Diario `17 6 * * *` | Lunes `0 22 * * 1` | BDFutbol solo mueve el histórico al terminar la jornada |
| Club | `club-refresh` semanal | Sin workflow | Es estático; se publica a mano cuando cambian los YAML |
| Health | Cada 4 h `0 */4 * * *` | Diario `0 7 * * *` | El diagnóstico no cambia cada 4 h; el run rojo sigue avisando |

El supervisor de partido no recoge datos: solo ejecuta
`gh workflow run data-refresh.yml --ref main` cada 10 minutos dentro de la
ventana, de modo que cada pasada conserva su propio `publish.yml` y el lock
`main-write`. Los checkpoints cada 2 h cubren cualquier kickoff entre ~09:30 y
~23:30 UTC sin mantener un runner toda la noche. Coste estimado: ~30 runs/mes
de Data, ~7 checkpoints/día, dispatches solo en días de partido, ~4 runs/mes de
Rivals y ~30/mes de Health; el club, 0 automáticos.

### Comandos de verificación ejecutados

```bash
ruff check scripts
pytest scripts -q                       # 256 passed
python -m depor_hub.cli schemas
git diff --exit-code packages/schemas   # sin diferencias
python -m depor_hub.cli validate --data data/public/v1
python -m depor_hub.cli smoke --data data/public/v1
npm run lint
npm run typecheck
npm test
cd workers/live-proxy && npm test
```

## Lote 4 — Sistema de diseño y navegación

Estado: **aplicado (17-nov-2026)**. Cerrados D-01, D-02, D-03, D-04, D-08,
D-12, D-24 y D-26; D-22 queda hecho en código y pendiente solo de la auditoría
en un dispositivo real.

| ID | Estado | Qué se ha corregido | Evidencia |
|---|---|---|---|
| D-01 | Hecho | El `Stack` raíz usa `headerBackButtonDisplayMode: 'minimal'` y se retiran los `headerBackTitle` que filtraban `(tabs)`/«Equipo» al botón atrás. Las fichas de jugador, entrenador, club e himno vuelven solo con la flecha. | `apps/mobile/app/_layout.tsx`, `app/club/[section].tsx`, `app/club/himno/[id].tsx` |
| D-02 | Hecho | En la variante `poster` de `HeadToHeadBar`, las etiquetas G/E/P pasan a una pastilla clara (`winBackground`/`drawBackground`/`lossBackground`) con texto oscuro; el color semántico ya no se usa como texto sobre azul (1,02–1,58:1). | `src/components/rival/HeadToHeadBar.tsx`; `src/__tests__/headToHeadBar.test.tsx` |
| D-12 | Hecho | El papel oscuro sube de `#151D2A` a `#202D42`: 1,35:1 contra el fondo `#0B1220` y borde visible (1,42:1). En claro se mantiene el borde como separador (1,46:1). | `src/theme/tokens.ts`, `src/__tests__/tokens.test.ts` |
| D-04 | Hecho | Escala tipográfica de 8 pasos (`caption`, `body`, `bodyLarge`, `subtitle`, `title`, `heading`, `display`, `hero`, `numeral`) con interlineado. Se sustituyen los 323 `fontSize` literales por spreads de `text.*`; un test falla si vuelve un literal. | `src/theme/tokens.ts`; `src/__tests__/tokensHygiene.test.ts`; migración en Inicio, Noticias, Club, Partido, Jugador, Entrenador, Rival, Ajustes y componentes compartidos |
| D-08 | Hecho | `Pressable` propio inyecta el estado `pressed` global (opacidad 0,68) y `hitSlop` 8; `PosterCard`, `PaperCard` y `Card` entran con Reanimated (`FadeInDown`, `FadeInUp`, `FadeIn`) respetando «reducir movimiento» del sistema. | `src/components/Pressable.tsx`, `src/components/design/DesignSystem.tsx`, `src/components/Screen.tsx`; `src/__tests__/pressable.test.tsx` |
| D-26 | Hecho | Cero hex fuera de `tokens.ts`: se añaden `onImage`, `rating`, `kitColors`, `avatarPalette` e `imageTokens` (scrim, degradado, velo). Las familias literales (`SourceSerif4`, `BarlowCondensed`) pasan a `typography`. El espaciado de la app (399 declaraciones de padding/margin/gap) ya no tiene ningún literal fuera de la rejilla 4/8: todo sale de `spacing` y un test impide volver a introducirlos. | `src/theme/tokens.ts`; `src/__tests__/tokensHygiene.test.ts`; `ClubImage`, `Editorial`, `PlayerAvatar`, `SeasonCard`, `(tabs)/club` |
| D-22 | Hecho en código; auditoría en dispositivo pendiente | Se eliminan los textos de 9–11 pt (mínimo 12) y el `Pressable` propio aplica `hitSlop` 8 por defecto a toda superficie tocable (test incluido); los botones de icono declaran `accessibilityLabel`. Falta pasar la auditoría de accesibilidad real en un dispositivo. | `src/components/Pressable.tsx`; `src/__tests__/pressable.test.tsx`; `TeamCrest`, `PlayerAvatar`, `PositionChart` |
| D-24 | Hecho | La píldora duplicada desaparece con D-01. La rejilla de secciones de Club ya no vive dentro de una tarjeta: cada baldosa es una superficie plana sobre el fondo, sin `Card` dentro de `Card` ni superficies de otro color anidadas. | `apps/mobile/app/(tabs)/club.tsx` |
| D-03 | Hecho | Un único `SectionHeader` con tres variantes (`poster`, `paper`, `flat`), usado por Inicio, Noticias, Club, Jugador, Entrenador y Rival; los wrappers de Club (`Editorial` y `sections/ui`) y las fichas de jugador y entrenador delegan en él. Inventario: 43 usos en 25 archivos; 9 de las 10 pantallas con secciones lo usan (Calendario conserva encabezados de grupo de fecha, deliberadamente compactos). | `src/components/design/DesignSystem.tsx`, `src/components/club/Editorial.tsx`, `src/features/club/sections/ui.tsx`, `app/player/[id].tsx`, `app/coach.tsx`, `app/(tabs)/club.tsx` |

### Verificación del Lote 4

```bash
npm run lint
npm run typecheck
npm test                                 # 342 passed / 44 suites
```

### Lo que sigue

- **Reactivación pendiente:** ejecutar las instrucciones de
  `docs/operations.md#reactivar-actions` y verificar los 13 documentos en
  producción. Es el único paso que no se puede hacer con Actions pausado.
- **Lote 2:** cerrado en local (ver más abajo).
- **Lote 3 en adelante:** release, offline, rediseño, gallego y cierre.

## Lote 5 — Fichas como interfaces

Estado: **aplicado (17-nov-2026)**. Cerrados D-05, D-06, D-07, D-09, D-10,
D-11 y D-20; D-21 y D-23 se dan por cubiertos en lo que afecta a estas fichas
(fechas con `Intl`, orden G/E/P global y capitalización con locale). El gallego
sigue parcial (212/713) con caída a ES: la decisión de completarlo o retirarlo
queda para el Lote 6.

| ID | Estado | Qué se ha corregido | Evidencia |
|---|---|---|---|
| D-05 | Hecho | La ficha de partido deja de ser un documento: cartel con marcador grande y estado, una sola cabecera de contexto (competición y jornada), sede y árbitro en una tarjeta de dos filas, alineaciones en dos columnas con dorsal y línea temporal única que funde goles, tarjetas y cambios por minuto. Los equipos ya no se repiten por bloque y las fuentes quedan al pie. **Límite honesto:** BDFutbol no publica posición ni formación, así que no se dibuja un campo táctico; se listan los once reales y los suplentes se colapsan. | `app/match/[id].tsx`; `src/components/match/MatchScoreboard.tsx`, `MatchLineups.tsx`, `MatchTimeline.tsx`; `src/features/match/timeline.ts`; `src/__tests__/matchDetail.test.tsx`, `timeline.test.ts` |
| D-06 | Hecho | Un solo encabezado por pantalla y el nombre del equipo una vez por contexto: Equipo abre con un cartel «Plantilla» que integra al entrenador (sin tarjeta aparte), la ficha de jugador pierde el escudo duplicado del hero y la de partido usa los equipos solo en el marcador y en las alineaciones. | `app/(tabs)/team.tsx`; `app/player/[id].tsx`; `app/match/[id].tsx` |
| D-07 | Hecho | Se elimina la prosa que explicaba la UI: `player.pendingBody`, `match.detailUnavailableHint` y `match.liveUnavailable` desaparecen. Los vacíos usan `EmptyState` o una línea corta; los datos pendientes son pastillas con el nombre del campo. | `app/player/[id].tsx`; `app/match/[id].tsx`; `src/i18n/locales/*.json` |
| D-09 | Hecho | La ficha de jugador es un cromo: retrato y dorsal en el cartel, estadísticas de temporada con número grande, un único segmentado (Resumen/Partidos/Carrera) y los datos biográficos como filas con icono. La trayectoria va en el raíl de Carrera con sus totales. Los partidos históricos se separan de la temporada publicada en un desplegable. | `app/player/[id].tsx`; `src/__tests__/playerDetail.test.tsx` |
| D-10 | Hecho | Cada fila del calendario muestra competición y jornada; el próximo partido lleva borde primario, pastilla `PRÓXIMO` y su hora. Los meses se agrupan con cabecera sticky. | `src/components/MatchCard.tsx`; `app/(tabs)/calendar.tsx` |
| D-11 | Hecho | El mes se capitaliza con `capitalizeFirst` y el locale, no con `textTransform: 'capitalize'`: «Noviembre de 2026», no «Noviembre De 2026». | `app/(tabs)/calendar.tsx`; `src/utils/text.ts` |
| D-20 | Hecho | Noticias deja un solo truncado (titular a 3 líneas, sin resumen) y un único acceso a filtros: tipo y secciones se mueven a la hoja inferior junto a fuentes y etiquetas. La barra queda en título, búsqueda y filtros con contador. | `src/components/news/NewsToolbar.tsx`, `NewsStoryCard.tsx`, `NewsFiltersSheet.tsx`; `app/(tabs)/news.tsx`; `src/__tests__/news.test.tsx` |
| D-21 / D-23 | Hecho en estas fichas | Fechas con `Intl.DateTimeFormat` en el locale, sin ISO; mismo orden G/E/P en toda la app; miles y euros con `Intl.NumberFormat`. | `app/rival/[teamId].tsx`; `src/features/squad/logic.ts`; `src/features/calendar/logic.ts` |

### Verificación del Lote 5

```bash
npm run lint
npm run typecheck
npm test                                 # 346 passed / 45 suites
```

Sin cambios en Python, Worker ni esquemas: el lote es solo de interfaz y claves
de traducción.

## Lote 6 — Club con criterio editorial

Estado: **aplicado (17-nov-2026)**. Cerrados D-13, D-14, D-15, D-16, D-17,
D-18 y D-19. El criterio de aceptación era que ninguna sección de Club quedara
por debajo de 2,5; la revisión visual final sigue pendiente de un dispositivo
real. El gallego mantiene la caída a ES: sus claves nuevas se resuelven por
`fallbackLng`.

| ID | Estado | Qué se ha corregido | Evidencia |
|---|---|---|---|
| D-13 | Hecho | La rejilla de «Explorar el club» deja de romperse: cada baldosa separa el icono y el contador en una cabecera propia (el badge ya no tapa el icono), la miniatura es cuadrada (`aspectRatio: 1`), el título se trunca a dos líneas y la altura mínima es estable. | `apps/mobile/app/(tabs)/club.tsx` |
| D-14 | Hecho | Los filtros de la cronología dejan de ocupar una fila permanente: un único control «Filtrar» de 44 pt despliega los chips a demanda y se cierra al elegir. El contenido domina el viewport. | `apps/mobile/src/components/club/Editorial.tsx`; `src/__tests__/club.test.tsx` |
| D-15 | Hecho | Los patrocinadores abandonan las cajas con monograma: pasan a ser una lista tipográfica por papel, con la nota o categoría verificada como segunda línea y el enlace oficial como única acción. ABANCA y Nike ya publican `url`. | `apps/mobile/src/features/club/sections/PatrocinadoresSection.tsx`; `data/public/v1/club.json`; `src/__tests__/club.test.tsx` |
| D-16 | Hecho | Los himnos dejan de ser una lista de tarjetas con hueco de reproductor: el oficial abre como cartel editorial (tipo, título, autoría, descripción y acción de vídeo oficial) y el resto se lee como índice tipográfico. Ambas vías llevan a la ficha con letra y créditos. | `apps/mobile/src/features/club/sections/HimnosSection.tsx`; `src/__tests__/club.test.tsx` |
| D-17 | Hecho | Cada red usa su icono y color de marca (incluido el logotipo actual de X, `logo-x`), las filas tienen 48 pt y muestran la ruta pública como contexto. Los colores de marca viven en `socialColors`, fuera de las pantallas. | `apps/mobile/src/features/club/sections/RedesSection.tsx`; `src/theme/tokens.ts`; `src/__tests__/club.test.tsx` |
| D-18 | Hecho | El museo pasa a visitante guiado: la descripción abre «La visita», la cifra de piezas publicada (250) se extrae del copy verificado y se muestra como dato, el horario ausente se declara pendiente en la web oficial, el mapa sigue disponible y la entrada se separa del resto de enlaces. Se elimina la ubicación duplicada y el enlace repetido. | `apps/mobile/src/features/club/sections/MuseoSection.tsx`; `src/features/club/logic.ts`; `src/__tests__/clubLogic.test.ts`, `club.test.tsx` |
| D-19 | Hecho | La ciudad deportiva deja de ser una lista de bullets: 140.000 m² abre como cifra protagonista, los 8 campos y los 3 campos de calentamiento se leen como estadísticas y solo las notas cualitativas (Populous, renovables) quedan como lista. La extracción es una función pura probada. **Límite honesto:** el contrato no publica coordenadas de Abegondo, así que no se dibuja un plano; la jerarquía recae en la cifra y las instalaciones. | `apps/mobile/src/features/club/sections/TrainingSection.tsx`; `src/features/club/logic.ts`; `src/__tests__/clubLogic.test.ts`, `club.test.tsx` |

### Verificación del Lote 6

```bash
npm run lint
npm run typecheck
npm test                                 # 350 passed / 45 suites
```

Sin cambios en Python, Worker ni esquemas: el lote es solo de interfaz y claves
de traducción ES/EN (GL cae a ES).

### Lo que sigue

- Revisar visualmente Club y sus secciones en un dispositivo real, en claro y
  oscuro, con texto grande y «Reducir movimiento».
- Decidir si el gallego se completa o se retira; hoy las claves nuevas caen a
  ES y el resto de la app mantiene la misma proporción.
- Cerrar la medición de arranque y la auditoría de accesibilidad (Lote 3/4), que
  siguen bloqueadas por la falta de hardware.


## Lote 2 — Peso de datos e imágenes

Estado: **cerrado** y verificado en producción. El smoke contra Pages valida los
12 documentos raíz y los documentos por jugador/escudo; News y Health quedaron
verdes tras los runs `43712616467` y `43712932558`.

| ID | Estado | Qué se ha corregido | Evidencia |
|---|---|---|---|
| D1-03 / F3-06 | Hecho | `squad.json` deja de ser un documento de 950 KB: se publica un resumen con id, nombre, posición, dorsal, foto y cesión, y un `players/{id}.json` por jugador con historial, carrera y procedencia. La ficha pide solo su detalle; el equipo pinta el resumen. `smoke` incluye `players/` en el hash deportivo y `validate` exige un detalle por fila. | `scripts/depor_hub/cli.py` (`_squad_payload`, `_remove_stale_players`), `scripts/depor_hub/transform.py` (`build_squad_summary`), `scripts/depor_hub/smoke.py`, `apps/mobile/src/data/queries.ts` (`usePlayer`), `apps/mobile/app/player/[id].tsx`; `squad.json` 30.225 B / 3.302 B gzip + 28 detalles (868 KB) |
| D1-05 | Hecho | Inicio deja de descargar 150 historias y sus miniaturas externas: `news-home.json` publica 5–6 historias y solo las fuentes usadas; las imágenes se reducen a WebP de ~480 px (≤40 KB) en `img/news/`. `news.json` completo solo se pide al abrir Noticias. Si la portada aún no existe, la app cae al feed completo una vez. | `scripts/depor_hub/news/build.py` (`select_home_stories`, `build_home`, `optimize_thumbnail`, `write_home`), `scripts/depor_hub/news/http.py` (`fetch_image`), `apps/mobile/src/data/queries.ts` (`useHomeNews`), `apps/mobile/src/components/home/HeadlinesBlock.tsx`; portada 4.331 B / 1.499 B gzip + 4 WebP (47,6 KB) |
| D1-04 | Hecho | La línea de tiempo de escudos usa una miniatura WebP de 232 px (≤20 KB) generada junto al PNG original; el modal sigue abriendo el PNG de 512 px. El contrato `CrestVersion` gana `thumbnail` y `ClubImage` encadena medio verificado → miniatura → original. | `scripts/depor_hub/club.py` (`thumbnail_image`, `crest_thumbnail_path`, `attach_crest_thumbnails`, `download_images`), `scripts/depor_hub/models.py`, `apps/mobile/src/components/club/ClubImage.tsx`, `apps/mobile/src/features/club/sections/EscudoSection.tsx`; 13 miniaturas (154 KB) + SVG actual (55 KB) |
| D1-12 / F3-10 | Hecho | La cuadrícula de Equipo pide el retrato `-small` (~43 KB) y la ficha conserva `-large` en la cabecera. Se añade un test que comprueba la variante pedida por la cuadrícula. | `apps/mobile/app/(tabs)/team.tsx`, `apps/mobile/src/__tests__/team.test.tsx`; 28 retratos ≈ 1,2 MB |
| F3-04 / D1-15 | Hecho | La caché persistida deja de ser una única entrada `deporhub-query-cache`: cada consulta vive en `deporhub-query:<hash>` y solo se reescribe cuando cambia su contenido. Metadatos (`timestamp`, `buster`) en una entrada pequeña; migración que descarta la caché monolítica anterior y `buster` a `data-v9`. | `apps/mobile/src/data/persister.ts`, `apps/mobile/src/data/DataProvider.tsx`, `apps/mobile/src/__tests__/persister.test.ts` |

### Medición antes / después

| Métrica | Antes | Después |
|---|---:|---:|
| `squad.json` | 950 KB (~60 KB gzip) | 30,2 KB (3,3 KB gzip) |
| Equipo en frío | ~60 KB gzip + retratos `-large` | 3,3 KB gzip + 28 retratos `-small` (~1,2 MB) |
| Home en frío | ~34 KB JSON + hasta 578 KB de miniaturas | 9,3 KB gzip JSON + 47,6 KB de WebP (**~57 KB**) |
| Sección de escudos | 2,3 MB de PNG | 210 KB (154 KB de miniaturas + 55 KB del SVG actual) |
| Miniatura de escudo | — | ≤ 20 KB (13/13) |
| Retratos de la cuadrícula (28) | hasta 32,7 MB con `-large` | ~1,2 MB con `-small` |
| Caché persistida | una entrada, reescritura completa | una clave por consulta; solo se reescribe lo que cambia |
| Ficha de partido | — | snapshot ≤ 0,8 KB + detalle ≤ 9,8 KB (< 60 KB) |

### Comandos de verificación ejecutados

```bash
ruff check scripts
pytest scripts -q                       # 272 passed
python -m depor_hub.cli schemas
git diff --exit-code packages/schemas   # sin diferencias
python -m depor_hub.cli validate --data data/public/v1
python -m depor_hub.cli smoke --data data/public/v1
npm run lint
npm run typecheck
npm test                                # 312 passed / 36 suites
cd workers/live-proxy && npm test       # 4 passed
```

### Verificación en producción

- News manual tras D1-05: run `43712616467`, **verde**. Publicó
  `news-home.json` (4.331 B), `img/news/*.webp` y desplegó Pages; el smoke
  contra `https://angelvilarino.github.io/depor-hub` devuelve
  `smoke ok: 12 documentos válidos` y `players/114100.json` y
  `escudos/1906-thumb.webp` responden 200.
- Health: run `43712725602` salió **rojo** por un deadlock propio (PIPE-12): tras
  una parada de cinco días, `status.json` marcaba Health `stale=true` y el run no
  podía observarse a sí mismo para recuperar el verde. Corregido con
  `--current-workflow health.yml`: el run `43712932558` queda **verde** y
  `status.json` publica `ok=true` con Data, News, Rivals y CI verdes.
- Data ya ejecutó el pipeline dividido en producción (`8ff9617`): conserva los
  28 detalles y `squad.json` valida.

## Lote 3 — Release y resiliencia

Estado: **aplicado**. El APK de `preview` está compilado (build
`8df81fb4-6a02-48aa-adca-55735f3df414`, `versionCode 1`); falta instalarlo en un
dispositivo y cerrar la medición real de arranque (F3-14), que necesita hardware
de gama media. El resto de criterios se comprueba con tests.

| ID | Estado | Qué se ha corregido | Evidencia |
|---|---|---|---|
| F3-01 / F5-11 | Hecho; APK compilado | Se añade `eas.json` con `appVersionSource: local`, perfil `base` (Node 22.23.3 y `EXPO_PUBLIC_DATA_BASE_URL` de producción), `preview` (APK de distribución interna) y `production` (incremento automático). `app.json` fija versión `1.0.0`, `android.versionCode: 1` e `ios.buildNumber: "1"`; el proyecto queda vinculado a `@vilaa_7/depor-hub` (`69d22d01-8a14-4773-9328-8ae9213e9ef1`) y EAS crea el keystore remoto. | `apps/mobile/eas.json`, `apps/mobile/app.json`; build `8df81fb4-6a02-48aa-adca-55735f3df414` (`preview`, Android, **FINISHED**, `versionCode 1`); APK en `https://expo.dev/artifacts/eas/Tfsrnz1mNNBxiSILIhf2CgSsEaigo8H8mhVzRxqpMqY.apk` |
| F3-03 | Hecho | La app es offline-first de verdad: `networkMode: 'offlineFirst'`, timeout de 8 s y un solo reintento (el peor caso baja de ~45 s a ~16 s). El splash no se oculta hasta que las fuentes y la caché persistida están listas, así que el primer frame ya muestra datos guardados. Sin red y sin caché, `ErrorState` dice que no hay datos guardados y ofrece reintentar en vez de dejar un esqueleto. | `apps/mobile/src/data/queryClient.ts`, `api.ts`, `queries.ts`, `DataProvider.tsx`, `app/_layout.tsx`, `StateViews.tsx`; `src/__tests__/offline.test.tsx` |
| F3-02 | Hecho | Cualquier ruta desconocida cae en `+not-found` con salida al inicio; un error de render en cualquier pantalla lo captura `RouteErrorBoundary` exportado como `ErrorBoundary` del layout raíz; `unstable_settings.initialRouteName` devuelve los enlaces profundos a una ruta real. | `apps/mobile/app/+not-found.tsx`, `src/components/RouteErrorBoundary.tsx`, `app/_layout.tsx`; `src/__tests__/navigation.test.tsx` |
| F3-05 | Hecho | Los 85 `z.strictObject` del espejo Zod pasan a `z.object`: un campo nuevo publicado antes de que la app lo conozca se descarta y el resto del documento sigue validando. La validación estricta se queda en CI (Pydantic + JSON Schema). | `apps/mobile/src/data/schemas.ts`; tests de campo desconocido en raíz, anidado y documento inválido en `contracts.test.ts` y `api.test.ts` |
| F3-15 | Hecho | `SCHEDULE_EXACT_ALARM` queda declarado y, en Android 12+, se pide aparte de las notificaciones. Si se deniega, el recordatorio **se guarda igual** y la hoja avisa de que Android puede retrasarlo, con un botón para volver a pedirlo. | `apps/mobile/src/features/reminders/notifications.ts` (`requestExactAlarmPermission`, `ReminderPermission`), `ReminderSheet.tsx`, `useMatchActions.ts`; `src/__tests__/notifications.test.ts` (iOS, Android 12+ concedido y denegado) |
| F3-16 / F5-05 | Hecho | `syncReminders` pasa a una cola de promesas: dos efectos ya no cancelan lo que el otro acaba de programar y un fallo no bloquea la pasada siguiente. | `apps/mobile/src/features/reminders/notifications.ts`; test de concurrencia y de fallo aislado en `src/__tests__/notifications.test.ts` |
| F3-14 | Parcial: instrumentación y protocolo, sin medidas reales | Cinco marcas de arranque (`layout`, `fonts`, `cache`, `splash`, `home`) con `performance.mark`, una línea `[startup]` por arranque en desarrollo y un comando reproducible que calcula p50/p95 de diez arranques en frío (`adb shell am start -W` + `scripts/startup-report.mjs`). Falta la tanda en un dispositivo de gama media: este entorno no lo tiene y un emulador no representa el objetivo. | `apps/mobile/src/perf/startup.ts`, `app/_layout.tsx`, `app/(tabs)/index.tsx`, `scripts/startup-report.mjs`, `docs/auditoria/ARRANQUE.md`; `src/__tests__/startup.test.ts` |
| F3-07 | Hecho | El refresco de la portada deja de recargar 3 de 6 consultas: invalida meta, clasificación, partidos, noticias, temporada y rivales; `useHomeNews` refresca portada y respaldo como una sola sección. | `apps/mobile/app/(tabs)/index.tsx`, `src/data/queries.ts`; `src/__tests__/home.test.tsx` comprueba las seis |
| F3-08 | Hecho | «Borrar caché» vacía la caché en memoria y la persistida: el `QueryClient` vive fuera de React (`data/queryClient.ts`) y `clearDataCache()` limpia ambas. No toca ajustes, tema ni recordatorios. | `apps/mobile/src/data/queryClient.ts`, `src/data/cache.ts`, `app/settings.tsx`; `src/__tests__/cache.test.ts` |
| F3-22 | Hecho | Partido, Jugador y Entrenador distinguen un fallo de red de un registro inexistente: muestran `ErrorState` con reintento en lugar de «no encontrado». | `apps/mobile/app/match/[id].tsx`, `app/player/[id].tsx`, `app/coach.tsx`; tests en `matchDetail.test.tsx`, `playerDetail.test.tsx` y `coach.test.tsx` |

### Medición antes / después

| Métrica | Antes | Después |
|---|---:|---:|
| Peor caso de carga sin red | 3 intentos × 15 s = 45 s | 1 reintento × 8 s ≈ 16 s, con caché al instante |
| Consultas que refresca la portada | 3 de 6 | 6 de 6 |
| Objetos Zod estrictos en el borde | 85 | 0 (la estricta queda en CI) |
| `syncReminders` concurrentes | podían cancelarse entre sí | cola en serie, con test |
| Alarmas exactas Android 12+ | sin permiso declarado | permiso declarado, pedido aparte y degradado con aviso |
| Rutas desconocidas o error de render | pantalla en blanco | `+not-found` / `ErrorBoundary` con reintento e inicio |
| Caché borrada | solo AsyncStorage | memoria + AsyncStorage |
| Tests Jest | 312 / 36 suites | **331 / 41 suites** |

### Comandos de verificación ejecutados

```bash
.venv/bin/ruff check scripts
.venv/bin/pytest scripts -q              # 272 passed
.venv/bin/python -m depor_hub.cli schemas
git diff --exit-code packages/schemas     # sin diferencias
npm run lint
npm run typecheck
npm test                                 # 331 passed / 41 suites
cd workers/live-proxy && npm test        # 4 passed
node scripts/startup-report.mjs < arranque.txt   # p50/p95, pendiente de dispositivo
```

### Nota operativa

Al empujar el Lote 3, GitHub tenía Actions **desactivado a nivel de repositorio**
(`enabled=false`): los push no generaron CI y el dispatch de News quedó en cola.
Se reactivó el 16-nov-2026, se relanzó News (run `43916776317`, **verde**, publicó
`e0e2ab5`) y se forzó CI sobre `main` con un commit vacío (`28de34d`).

### Lo que sigue

- Instalar el APK de `preview` en un Android real y rellenar la tabla de
  `docs/auditoria/ARRANQUE.md` con diez arranques en frío (p50/p95).
- Verificar en ese dispositivo el modo avión (datos con antigüedad, sin
  esqueletos) y el recordatorio con ±1 min de precisión.
- Lote 4 en adelante: sistema de diseño, navegación y chrome.
