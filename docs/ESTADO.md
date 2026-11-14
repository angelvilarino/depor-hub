# Estado del proyecto — 14-nov-2026
H0 (andamiaje), H1 (contratos + ingesta + Pages), H2 (capa de datos), H3 (calendario), **H4 (plantilla + ficha enriquecida, rediseño, escudos, entrenador y cuerpo técnico)**, **H5 (inicio + identidad Cartel/Prensa, iteración 3)**, **H6 (noticias, vídeos y redes curadas)** y **H7 (club, ajustes y acerca de)** implementados; H4, H5, H6 y H7 pendientes de verificación final en dispositivo (ver «Verificación H4», «Verificación H5», «Verificación H6» y «Verificación H7»). Fase 2 en curso: H0.1 (sincronización con `main`), H0.2 (salud del pipeline + `status.json`), el Hito 1 visible (ficha de partido con ciclo de vida y degradación honesta), H3.5 (snapshots congelados), H2 (iconos de fuentes), el detalle de partido con BDFutbol (ADR 0031), el proxy en directo (Worker + fusión en la app) y **H7.1 (club ampliado, ADR 0032)** hechos. Pendiente para cerrar el Hito 4: desplegar el Worker y definir `EXPO_PUBLIC_LIVE_BASE_URL`.

> **Estado operativo (14-nov-2026).** GitHub Actions está **deshabilitado a nivel de repositorio** desde el 11-nov-2026: los crons no se ejecutan y Pages no recibe despliegues nuevos. El `main` local se ha rebasado sobre `origin/main` y se publica con push directo; la verificación en producción queda pendiente de reactivar Actions al cerrar el Lote 1 de la auditoría. El gallego real medido es **212/713 claves (29,7 %)**, no 162/454; se completa en el Lote 6. Las imágenes del club son **58 ficheros** y los escudos PNG siguen pesando **2,3 MB** hasta el Lote 2.

## Datos reales (sondeo football-data.org, plan gratuito)
- Acceso a PD (LaLiga) 2026-27; sin Copa del Rey. Depor: id 560, tla DEP.
- Plantilla: posición, nacimiento y nacionalidad 28/28.
- Tras el enriquecimiento (26-oct-2026): dorsal 28/28, contrato 28/28, altura 28/28, peso 25/28, lugar de nacimiento 28/28, pie 28/28, cesión de entrada 3/28, cesión de salida 1/28 (Teun → Al Ain), carrera 28/28, totales 28/28, partidos con el Depor 28/28, redes 27/28 y **fotos 28/28**. Valor de mercado 0/28 (solo manual, siempre «Estimación»). Escudos: **156/156** entradas de carrera (**75/75** clubes) y **1229/1262** partidos (**76/82** rivales distintos; los 20 de LaLiga, al 100 %). Los 6 rivales sin escudo son históricos de Segunda B y quedan en monograma. Entrenador: ficha completa de Antonio Hidalgo con 15 etapas y **21** miembros de cuerpo técnico.
- Fuente del enriquecimiento: BDFutbol (carrera, temporadas, totales, dorsal actual, peso y partidos), Wikipedia ES/GL/EN (contrato, cesión, altura y contraste), Wikidata (lugar, altura, pie, dorsal, redes, alias y sitelinks), ficha oficial del club (altura, pie, foto y redes; autoritativa cuando existe) y overrides manuales para redes y cesión de salida. 37 conflictos visibles en `data/manual/squad_enrich.proposed.yml`: los aplicados llevan `applied` + `resolution`, los no aplicados quedan sin valor.
- Dos fichas de Wikipedia con fecha de nacimiento distinta a la API (Lucas Noubi y Dani Barcia) se descartaron por identidad; su dorsal se recuperó de BDFutbol. No se empareja por nombre si hay fecha y no coincide.
- Estados de partido: TIMED = hora confirmada; SCHEDULED = hora NO fijada (00:00:00Z). Solo fecha en SCHEDULED; hora en Europe/Madrid solo en TIMED. No inventar horas.
- URL de datos: https://angelvilarino.github.io/depor-hub/v1 (meta, standings, fixtures, squad, news y social; los dos últimos opcionales). Contrato v1 en packages/schemas (Pydantic origen, Zod espejo).
- Diagnóstico operativo: `https://raw.githubusercontent.com/angelvilarino/depor-hub/status/status.json` (rama `status`, ADR 0027). La app no depende de él.

## H0.1 — Sincronización con `main` (hecho)

- La copia local estaba 38 commits por delante y 263 por detrás. Se creó la rama de respaldo `backup/local-main-2026-11-04` y se integró solo el trabajo único de H7 (himnos, contrato de club y UI) sobre `origin/main`.
- Se resolvieron conflictos en `README.md`, `docs/ESTADO.md` y `docs/sources.md`; la cadencia real de noticias es **30 min**. El ADR de club se renumeró a **0026** para no chocar con el 0025 de publicación.
- Se restauró `rivals.json` con **19/19** históricos de BDFutbol y se añadió una guarda: una pasada con 0 históricos no sobrescribe la publicación anterior.
- Se corrigió Home para no mostrar como resultado un `FINISHED` con hora futura.
- Verificación: `ruff`, **185 pytest**, `typecheck`, `lint`, **268 tests / 31 suites** y esquemas sin diferencias.

## H0.2 — Salud del pipeline y `status.json` (hecho, ADR 0027)

- `health.yml` lee los últimos runs de Data/News/Rivals, resume los JSON publicados y publica `status.json` en la rama `status` cada 30 min. No usa Pages: el diagnóstico sobrevive a un deploy roto.
- `status.json` distingue presencia de ficheros y conclusión de workflows; la antigüedad es informativa, no un veredicto. `cmd_status` sale con código 1 si el estado es rojo y `--soft` permite publicarlo igualmente.
- News tiene su propio grupo de concurrencia (`news-publish`) para no esperar a Data. Los tres deploys comparten `pages-deploy`. El push reintenta 5 veces con `git rebase --abort` ante conflictos transitorios.
- Respaldo de cron externo documentado en [`docs/operations.md`](operations.md); el token vive fuera del repositorio.

## Hito 1 — Ficha de partido y ciclo de vida (hecho, ADR 0028)

- La ficha `/match/[id]` distingue **próximo**, **en juego**, **terminado** y
  **pendiente de actualizar** con `matchPhase`. Solo los partidos futuros ofrecen
  recordatorio y calendario; un `TIMED` ya pasado no se presenta como futuro ni
  como resultado.
- Un partido terminado muestra marcador, descanso, sede, árbitro y jornada, pero
  **no inventa** eventos, alineaciones ni estadísticas: una tarjeta explica que
  la fuente actual solo publica marcador y estado, y atribuye los datos a
  football-data.org. En directo se actualizan marcador y estado, nada más.
- Calendario e Inicio usan el mismo `now` para no mostrar como resultado un
  `FINISHED` con hora futura.

## H3.5 — Snapshots congelados (hecho)

- `python -m depor_hub.cli snapshots` escribe un JSON por partido `FINISHED` o
  `AWARDED` con marcador final en `data/public/v1/snapshots/<season>/<matchId>.json`.
  `data-refresh.yml` lo ejecuta tras la ingesta, antes de validar y publicar.
- El contrato `MatchSnapshot` (Pydantic → JSON Schema → Zod) solo contiene lo que
  publica la fuente: equipos, marcador, fecha, jornada, fase, sede, árbitro y
  `deporIsHome`. Los campos desconocidos quedan en `null`.
- Los snapshots son **inmutables**: una segunda pasada los omite y solo `--force`
  los reescribe. Si el partido ya no está en `fixtures.json`, la app lee el
  snapshot; si el snapshot no existe (404) o no valida, muestra el vacío de
  siempre. La app nunca depende de que el snapshot exista.
- Generados **11 snapshots** de la temporada 2026-27 en la primera pasada.
- Pruebas nuevas: congelación, idempotencia, `--force`, validación del ejemplo,
  snapshots publicados y fallback de la ficha sin partido en `fixtures.json`.
- Verificación: `ruff`, **188 pytest**, `typecheck`, `lint`, **281 tests / 34
  suites** y esquemas regenerados sin diferencias.
- Decisiones en [`docs/adr/0028-snapshots-partidos-terminados.md`](adr/0028-snapshots-partidos-terminados.md).

## Detalle de partido con BDFutbol (hecho, ADR 0031)

- `python -m depor_hub.cli match-details` publica un JSON por partido terminado
  en `data/public/v1/match-details/<season>/<matchId>.json`, con el `id` de
  football-data.org como clave. `data-refresh.yml` lo ejecuta tras los snapshots.
- Incluye alineaciones (titulares, suplentes y entrenador), goles (con penalti,
  propia puerta y marcador posterior), tarjetas y cambios. **No** incluye fotos,
  escudos, textos, estadísticas ni eventos deducidos. Lo desconocido es `null`.
- El emparejamiento con BDFutbol exige los dos equipos y una fecha a menos de
  tres días; si hay empate entre candidatos no se publica detalle. Si el
  marcador de BDFutbol no coincide con el publicado en `fixtures.json`, tampoco
  se publica. Una sustitución solo se empareja cuando hay exactamente un jugador
  que sale y otro que entra en el mismo minuto; si no, se publican las dos
  mitades por separado.
- Escritura única: una segunda pasada omite los ficheros existentes; solo
  `--force` los reescribe. Si BDFutbol no tiene la ficha, el comando avisa pero
  **no bloquea** la publicación de fixtures, snapshots o club.
- La app lee el detalle con `useMatchDetail` y lo pinta solo en partidos
  terminados. Un 404 o un JSON inválido vuelven al aviso honesto de siempre; el
  directo sigue mostrando únicamente marcador y estado.
- Riesgo legal: el responsable asumió el riesgo el 05-nov-2026 (opción C del
  [informe](bdfutbol-legal-risk.md)); se publican solo hechos y se atribuye la
  fuente.
- Generados **11 detalles** de 2026-27. Pruebas en
  `scripts/tests/test_match_details.py` y `matchDetail.test.tsx`.

## H2 — Iconos de las fuentes de noticias (hecho)

- Las cinco fuentes activas declaran en `data/manual/news_feeds.yml` un
  `iconUrl` oficial verificado (favicon o `apple-touch-icon` del propio medio).
  `build_news` lo copia a `news.json`; el contrato no cambia.
- La tarjeta de Noticias y la portada cargan el icono con caché de imagen y
  caen al monograma estable si falta, falla o el medio lo retira. No se rastrean
  portadas ni se descargan logos al repositorio.
- Una prueba exige icono https en las cinco fuentes activas y comprueba que el
  pipeline lo publica. Decisiones en
  [`docs/adr/0029-iconos-fuentes-noticias.md`](adr/0029-iconos-fuentes-noticias.md).

## Hito 4 — Directo (implementado, pendiente de desplegar)

- `workers/live-proxy` es un Cloudflare Worker de solo lectura con una única
  ruta `GET /v1/fixtures.json` que devuelve el mismo contrato que la app, solo
  con los partidos del Depor. El token de football-data.org vive como secreto del
  Worker y nunca en el bundle. Cachea 60 s en el edge; la app refresca cada 60 s.
- La transformación publica equipos, marcador final y de descanso, estado,
  jornada, fase, sede, árbitro y `deporIsHome`. **No publica ni deduce eventos,
  alineaciones o estadísticas.**
- `mergeFixtures` superpone por `id` los partidos del proxy sobre la publicación
  estática. Un fallo, una URL ausente o un proxy más antiguo que la publicación
  se ignoran: la app conserva lo estático y nunca retrocede un resultado.
- Sin `EXPO_PUBLIC_LIVE_BASE_URL` no hay ninguna petición en directo. El modo
  terminado sigue funcionando con snapshots (ADR 0028).
- Pruebas: 4 del Worker (filtro, orden, marcador ausente, árbitro y temporada) y
  4 de fusión en la app. Decisiones en
  [`docs/adr/0030-proxy-directo-worker.md`](adr/0030-proxy-directo-worker.md).
- **Pendiente:** desplegar con `wrangler` y definir la variable en el entorno de
  build. No hay cuenta/token de Cloudflare en esta sesión.


## H3 — Calendario (hecho)
Ver `docs/adr/0005-calendario-y-recordatorios.md` y `0006-escudos-sede-arbitro.md`.

## H4 — Equipo, ficha y entrenador (implementado, ADR 0007 + 0008 + 0009 + 0011 + 0012 + 0014)
- **Pestaña Equipo v2 (ADR 0014):** sin edad media; buscador por nombre o dorsal con botón de borrar y teclado que se oculta al hacer scroll; chips Todos/POR/DEF/MED/DEL en una fila con contador; conmutador **cuadrícula/lista** solo con iconos (`grid-outline`/`list-outline`), 44 pt y preferencia persistida en Zustand. Cabecera de lista `# / Jugador / Edad` sin truncar, tarjetas compactas y etiqueta **Cedido** cuando hay `loanTo`. La tarjeta del entrenador muestra foto, nombre y nacionalidad y navega a `/coach`. El banner de frescura solo aparece si los datos tienen más de 12 h o si hay error/sin conexión. Se usa `FlatList`, no FlashList: 28 jugadores no justifican una dependencia nativa extra.
- **Ficha de jugador v2 (ADR 0014):** hero compacto con retrato de 96 pt y modal con atribución/licencia/enlace, dorsal grande y fila de identidad con escudo del Depor, bandera, nacionalidad, posición y edad. Selector **«Depor 26-27 | Carrera»** para la franja **PJ · G · min · TA · TR** (sin asistencias) y tres pestañas **Resumen/Partidos/Carrera**: bio, redes y pendientes; partidos con escudo, Local/Visitante, marcador, chip G/E/P y enlace a `/match/[id]`; timeline con escudos y periodos unificados. Las filas no se truncan. El botón de volver dice **«Equipo»** y ajustes es un icono neutro de al menos 44 pt.
- **Entrenador y cuerpo técnico (ADR 0014):** ficha `/coach` con foto oficial, datos personales, balance calculado desde `fixtures.json` (`coachRecord`, solo `FINISHED` y desde `since`), selector jugador/entrenador y cuerpo técnico agrupado por rol. Fuentes: Wikidata `Q602465` para datos personales, Wikipedia ES para trayectoria y web oficial para foto y staff. `data/manual/coach.yml` es salida generada (`python -m depor_hub.cli coach`); `ingest` y `enrich --apply` aceptan `--coach`. No se publica un miembro del staff que la web oficial no publique.
- **Accesibilidad:** controles de 44 pt, etiquetas y estados (`selected`/`expanded`), escalado de texto y `useReducedMotion` para desactivar el fundido del modal cuando el sistema lo pide. `win`/`draw`/`loss` tienen contraste AA ≥ 4,5 en claro y oscuro.
- **Fotos:** **solo la foto oficial del club** (ficha del jugador o noticia de presentación), enlazada con crédito editorial y siempre como foto de perfil. No se guardan binarios en el repo. Si no hay foto o falla la carga, se usa el avatar de iniciales.
- **Escudos (ADR 0012):** `CareerEntry.crestUrl` y `PlayerMatch.opponentCrestUrl`, aditivos y con `default(null)`. Prioridad football-data.org (fixtures) → Wikidata `P154` + Commons a 96 px → overrides `data/manual/club_crests.yml`. Filiales/reservas pueden heredar la matriz; un club senior sin `P154` no. Ambigüedad, `P154` ilegible o imagen apaisada ⇒ `null` (monograma). Caché en `data/raw/enrich/crests.json`, invalidada por `mtime` de fixtures/overrides.
- La ficha oficial del club (`/depor` y `/depor-fabril`) es autoritativa para altura, pie y foto cuando existe; los conflictos se registran con el valor aplicado y la resolución.
- Contrato ampliado de forma aditiva: `Player.birthPlace`, `preferredFoot`, `loanFrom`, `loanTo`, `marketValueEur`, `weightKg`, `social`, `photos`, `career`, `careerTotals`, `deporMatches`, `provenance`; `CareerEntry.crestUrl` y `CareerEntry.role`; `PlayerMatch.opponentCrestUrl`; `Coach` gana `birthDate`, `birthPlace`, `photoUrl`, `since`, `contractUntil`, `career`, `staff` y `provenance`; nuevo `StaffMember`. Los esquemas JSON y el espejo Zod se regeneraron con `default(null)`/`default([])`/`default('player')` para tolerar JSON y caché anteriores.
- Cada campo enriquecido lleva `source`, `confidence` (`verified`, `cross_checked`, `single_source`, `estimated`) y `capturedAt`. Los conflictos no se ocultan: los aplicados dejan `applied` y `resolution`; los no aplicados se quedan en `null`.
- `data/manual/squad_extras.yml` es **salida generada**; los datos manuales viven en `data/manual/squad_overrides.yml` (se cargan con `--overrides`). Así una regeneración no pisa correcciones ni fotos puntuales.
- `npm run mobile` sirve `data/public` en local además de arrancar Expo; la URL se deriva del host de Metro (sin IPs fijas). `.env.example` documenta las variables.
- La app está en **Expo SDK 58** (React Native 0.88, React 19.3). `npx expo install --check` valida las dependencias contra el mapa local de SDK 58; en esta sesión la red estuvo deshabilitada. RNGH quedó en `~3.3.0`, la versión que recomienda ese mapa.
- Fuentes y límites detallados en `docs/sources.md`; decisiones en `docs/adr/0008-enriquecimiento-fuentes-libres.md`, `0009-fotos-y-fuente-oficial.md`, `0011-rediseno-equipo-y-ficha.md`, `0012-escudos-de-clubes.md` y `0014-entrenador-y-cuerpo-tecnico.md`.

### Comandos de enriquecimiento
```bash
python -m depor_hub.cli enrich                       # propuesta, no toca datos públicos
python -m depor_hub.cli enrich --min-confidence cross_checked --apply
python -m depor_hub.cli enrich --apply --offline     # repite desde data/raw/enrich
python -m depor_hub.cli enrich --no-photos           # sin ninguna foto
python -m depor_hub.cli enrich --no-crests            # sin resolver escudos
python -m depor_hub.cli enrich --fixtures data/public/v1/fixtures.json
python -m depor_hub.cli enrich --club-crests data/manual/club_crests.yml
python -m depor_hub.cli enrich --overrides data/manual/squad_overrides.yml
python -m depor_hub.cli enrich --export-template data/manual/squad.csv
python -m depor_hub.cli enrich --import-csv data/manual/squad.csv
python -m depor_hub.cli coach                        # regenera data/manual/coach.yml
python -m depor_hub.cli coach --apply                # aplica entrenador y staff a data/public/v1
python -m depor_hub.cli enrich --apply --coach data/manual/coach.yml
```
Antes de una resolución online real de escudos, borra `data/raw/enrich/crests.json` si hiciste una pasada `--offline`: la caché guarda también los `null` y los reutilizaría.
El workflow `Enrich proposal` es manual (`workflow_dispatch`), sube el YAML propuesto como artefacto y **no hace commit**.

### Verificación H4
```bash
source .venv/bin/activate && pip install -e "scripts[dev]"
ruff check scripts && pytest scripts
python -m depor_hub.cli schemas && git diff --exit-code packages/schemas
npm run lint && npm run typecheck && npm test
# idempotencia del enriquecimiento y del entrenador
python -m depor_hub.cli enrich --apply --offline   # segunda pasada: changed=false
python -m depor_hub.cli coach --apply --offline    # segunda pasada: changed=false
```
Probar en iPhone: `npm run mobile` (sirve `data/public` en local), pestaña Equipo (cuadrícula/lista solo con iconos, buscador con borrar, chips en una fila, cabecera `# / Jugador / Edad`, etiqueta «Cedido» y tarjeta del entrenador), tocar un jugador (hero con dorsal grande, selector «Depor 26-27 | Carrera», tres pestañas, partidos con escudo/enlace, trayectoria con escudos y pendientes), abrir la ficha del entrenador (foto, datos personales, balance, selector jugador/entrenador y staff), abrir una red social y la ficha de la foto, activar «Reducir movimiento» en el sistema y comprobar que el modal no anima, cambiar idioma ES/EN/GL, modo oscuro y modo avión (la plantilla sigue visible con el banner solo si procede).

## H5 — Inicio e identidad «Cartel + Prensa» (iteración 3; ADR 0015, 0017, 0019–0024)

- **Orden de Inicio:** marca no oficial → (resultado final si tiene menos de 24 h) → próximo partido → rival → temporada → titulares. El aviso de partido aplazado vive dentro del cartel del próximo partido para no intercalar otra tarjeta.
- **Sistema visual:** `PosterCard` para partido, rival y resultado; `PaperCard` para temporada, tabla y prensa. Tokens de color, tipografía por rol, radios y movimiento en `src/theme/tokens.ts`. Barlow Condensed, Source Serif 4 e Inter se cargan localmente bajo OFL; los tres archivos suman **776.496 bytes**. El splash espera a las fuentes y la app conserva fallback de sistema; el arranque <2,5 s no se ha medido todavía en un móvil de gama media.
- **Marca:** `BrandMark` usa el escudo remoto dentro de Inicio (`SHOW_CLUB_CREST_AS_BRAND=true`) y muestra el aviso de proyecto no oficial. Icono, splash y ficha de tienda conservan el monograma DH. `SHOW_RIVAL_PHOTOS=false`; no se descargan ni muestran fotos de técnicos o jugadores rivales.
- **Próximo partido:** cartel simétrico, casillas de cuenta atrás con segundos en componente aislado, estados en juego/pendiente/final y acciones de recordatorio/calendario. El tiempo previsto se presenta como talón horario con icono SVG, temperatura, barra de lluvia, viento y detalle ±3 h cuando existe; atribución Open-Meteo, datos cacheados con antigüedad y límites de coordenadas/horizonte.
- **Rival:** resumen tocable y ficha `/rival/[teamId]`; enseña entrenador de football-data.org, forma, BDFutbol H2H total con barra G/E/P, confianza y fuente enlazada, y hasta cinco cruces con escudos. No se publican `keyPlayers`: quedan vacíos en el JSON publicado y los clientes viejos siguen pudiendo leer el campo. Se decidió omitir estadísticas y fotos individuales de la plantilla rival porque no se eligió una fuente gratuita fiable que cubra 2026/27.
- **Temporada:** cabecera con temporada/jornada; resumen compacto sin repetir posición y puntos de la mini-tabla; cinco cromos con escudo del rival, resultado en letra y selección por defecto del más reciente. El detalle y punto del gráfico se sincronizan; el gráfico SVG permite arrastrar y ofrece acciones accesibles de jornada anterior/siguiente. La mini-tabla vive en una segunda tarjeta para acortar el bloque. Sin datos opcionales, se ocultan detalle y gráfico y se conserva el resumen derivado de clasificación/fixtures.
- **Noticias en Inicio:** una destacada con miniatura del feed o monograma, cuatro filas, fuente y hora relativa; `alsoIn` se despliega y enlaza a los otros medios. No se scrapean páginas: `iconUrl` usa el favicon oficial verificado (ADR 0029) y cae al monograma si falla. El algoritmo agrupa nombres de eventos compartidos en títulos/extractos dentro de 48 h; las tres entradas reales de Falas Dépor se publican como una sola historia. El test de Alberto Molina confirma que «Deportivo» y el apellido/homonimia no bastan: se rechaza como irrelevante.
- **Contrato y privacidad:** se retira `whatIsAtStake` del modelo, esquema y datos nuevos; Zod y Pydantic ignoran esa clave al leer cachés H5.2 antiguos. No se añadió `API_FOOTBALL_KEY` ni se incorporó una clave al bundle.
- **Pruebas H5:** cobertura añadida de contraste AA por parada de degradado/monograma, selección pura de puntos del gráfico, interacción de racha y marcador, fecha relativa, compatibilidad del contrato, Home y ficha de rival sin estadísticas individuales.

### Verificación H5.3
```bash
source .venv/bin/activate && ruff check scripts && pytest scripts
python -m depor_hub.cli schemas && git diff --exit-code packages/schemas
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run lint
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run typecheck
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test
```

Para revisar en iPhone: claro/oscuro, texto grande, reducir movimiento, resultado final, próximo partido `TIMED`/`SCHEDULED`, error/offline de Open-Meteo, recordatorio/calendario, ficha del rival y gesto del gráfico. La prueba de inicio <2,5 s requiere un móvil de gama media y queda pendiente; las fuentes ocupan 776.496 bytes en el repo. El icono y splash DH se mantienen sin cambios.

## H6 — Noticias curadas, historias y filtros (implementado, ADR 0018)

- **Catálogo:** `data/manual/news_feeds.yml` tiene **5 fuentes activas** (RC Deportivo YouTube, Riazor.org, DXT Campeón, La Voz de Galicia y Marca) y **11 descartadas** con su motivo. Se eliminaron los agregadores de Google News y los feeds generalistas que no aportaban señal real. Detalle y auditoría en `docs/sources.md`.
- **Pipeline:** `scripts/depor_hub/news/` (`fetch`, `normalize`, `relevance`, `tags`, `cluster`, `build`, `ingest`, `audit`, `parse`) con `httpx`, `xml.etree`, User-Agent identificable, 1 s por dominio, `ETag`/`If-Modified-Since` y caché en `data/raw/news/`. Sin dependencias nuevas más allá de las ya presentes.
- **Relevancia:** «Deportivo» a secas no cuenta. Solo suman club, `Dépor`, Fabril, Abegondo, Riazor con contexto, plantilla, entrenador y rivales con contexto. Se excluyen otros «Deportivo», el Riazor de playa/sucesos y los apellidos comunes. Un titular cuyo único apoyo está en el extracto se descarta como `solo_extracto`. Umbral configurable y motivos de descarte en `--report`.
- **Etiquetas:** taxonomía cerrada (`fichajes`, `cantera`, `lesiones`, `partido`, `afición`, `club`, `opinión`), máximo dos, nunca equipos ni jugadores. `lesiones` no se deriva de una muerte; `partido` exige contexto.
- **Clústeres:** misma URL = mismo ítem; ventana ±48 h; similitud base 0,52, entidades 0,44 y solapamiento de palabras ≥ 0,55. Dos piezas distintas del mismo medio o del mismo jugador no se fusionan. Representante por prioridad y antigüedad; `id` estable heredado; resto en `alsoIn`. Calibración real en los tests (pares 0,548 y 0,474 fusionados; mismo jugador ≈0,20 no).
- **Retención y fallos:** 14 días y máximo 150 historias. Si una fuente falla, sus historias anteriores se conservan; si fallan todas, `AllFeedsFailed` hace que el CLI salga con código 1 y no se publica. La escritura es idempotente por hash y por texto exacto.
- **Contrato:** se rompe `/v1/` de forma autorizada. `news.json` pasa a `{ updatedAt, sources, stories }`; `sources.json` desaparece. Pydantic → JSON Schema → Zod con `default`. `social.json` se sigue generando, pero Noticias ya no lo muestra.
- **CLI:** `python -m depor_hub.cli news [--dry-run] [--offline] [--report] [--force] [--threshold N]`; `news audit` y el alias `news ingest` se mantienen.
- **Workflow:** `news-refresh.yml` cada 30 min (`*/30 * * * *`), `workflow_dispatch` con `force`, `timeout-minutes`, caché `data/raw/news`, `concurrency.group: news-publish` y `cancel-in-progress: false`. Commit solo con cambios, `rebase` antes de publicar y deploy solo si cambió algo. Si no responde ninguna fuente, falla y no despliega.
- **App:** `SectionList` por día en `Europe/Madrid`; cabecera que scrollea con recuento, no leídas y «Marcar leídas»; barra sticky con búsqueda expandible, Todo/Artículos/Vídeos, chips de grupo y filtros; hoja inferior de fuentes y etiquetas; tarjeta con monograma, título a 3 líneas, extracto a 2, miniatura de 72 px, dos etiquetas pulsables y `+N medios` desplegable. Leídos en Zustand con poda, confirmación y deshacer; contador <100 o `99+`; búsqueda con debounce sobre título/medio/etiquetas. Filtros no persistentes.
- **Home:** cinco titulares, resueltos con `sources`, y «Ver todas».
- **i18n:** ES y EN con paridad exacta; GL 212/713 (29,7 %) con caída a ES. El Lote 6 lo completa y exige paridad ES=EN=GL.
- **Pruebas:** **154 pytest** y **204 tests / 26 suites** en la app, incluidos contrato compartido, relevancia, etiquetas, clústeres reales, retención, fallo parcial/total, estados de la pestaña, búsqueda, grupos, hoja de filtros, `alsoIn`, leídos con deshacer y apertura externa.

### Verificación H6
```bash
source .venv/bin/activate && ruff check scripts && pytest scripts
python -m depor_hub.cli schemas && git diff --exit-code packages/schemas
npm run lint && npm run typecheck && npm test
python -m depor_hub.cli news audit --write-docs
python -m depor_hub.cli news --interval 1 --report
python -m depor_hub.cli news --offline
```

Probar en iPhone: pestaña Noticias con historias agrupadas por día, búsqueda expandible, segmento Todo/Artículos/Vídeos, chips de grupo, hoja de fuentes y etiquetas, «Limpiar (n)», tarjeta con monograma/miniatura, despliegue de `+N medios`, abrir artículo y vídeo, marcar leídas con confirmación y deshacer, y Home con cinco titulares. Repetir con modo avión (caché visible con banner), con `news.json` ausente y con filtros que no dejen resultados.

## H7 — Club, ajustes y acerca de (implementado, ADR 0026)

- **Contrato `club.json`:** nuevo objeto raíz `{ updatedAt, identity, anthems, crests, kits, stadium, tickets, museum, trainingCenter, board, sponsors, titles, rivalries, facts, links }` (32 KB). Pydantic → JSON Schema → Zod con `default(null)`/`default([])`. Lo desconocido queda en `null`; el aforo publica fuente, confianza y estado, y el museo incluye una galería opcional. `club.json` se valida como el resto de ficheros, pero se excluye del `dataHash` deportivo (`SPORTS_FILES`): un cambio editorial no invalida la caché de clasificación/plantilla/partidos.
- **Aforo coherente:** `Capacity.total` se valida contra la suma de `breakdown` en Pydantic y en la app. Se publica **32.490 localidades sentadas**, según la web oficial y con contraste independiente; las cifras de palco/VIP/Área 1906/medios no se agregan sin confirmar que sean asientos adicionales. El valor alternativo 34.611 sigue fuera por falta de fuente identificada.
- **Imágenes locales:** 58 ficheros en `data/public/v1/img/club/` (14 escudos + 44 equipaciones: 43 vectoriales SVG y la local 2026-27 en JPEG). El contrato guarda rutas relativas (`img/club/escudos/1906.png`, `img/club/equipaciones/1999-00-home.svg`); `clubImageUrl` las resuelve contra la base de datos y `ClubImage` pinta la imagen correspondiente (o un marcador si falla). `docs/kits_coverage.md` registra la cobertura real: 42 temporadas, 44 equipaciones, 44 con imagen.
- **Himnos:** «Voa» (oficial, 2026, Xoel López y créditos), «Fillos de Breogán» (no oficial, 2020, Jesús Suárez / Mar de Fondo) y «El Rock del Deportivo» (popular/histórico, 1987, Gandy Cacahué). Las letras viven en `data/manual/himnos/<id>.txt`; la app solo las muestra si `lyricsRights.status` autoriza su visualización. Las no autorizadas quedan enlazadas a su fuente cuando está declarada. Para «Voa», el botón de reproducir abre la página oficial del videoclip bajo pulsación; no se incorpora WebView (ADR 0033).
- **Pantallas:** pestaña Club con identidad, datos y accesos; ruta dinámica `/club/[section]` para himnos, escudo (línea temporal vertical y modal ampliado), equipaciones (SectionList por década con selector rápido, imagen o marcador, tipo, fabricante y patrocinadores), estadio (aforo total y por zona, mapa nativo con caída a Google Maps), museo, ciudad deportiva, junta (entrenador desde `squad.json`, sin duplicarlo), patrocinadores, títulos, rivalidades y redes/contacto. Todas cubren carga, vacío, error con reintento y offline con `FreshnessBanner`.
- **Ajustes:** «Borrar caché de datos» elimina solo la caché persistida de TanStack Query (`persister.removeClient()` + clave de AsyncStorage), con confirmación, sin tocar ajustes ni recordatorios. Muestra versión de la app, `meta.dataHash`, `updatedAt` y enlace a Acerca de.
- **Acerca de:** nombre y versión, aviso de proyecto no oficial, contacto (incidencias del proyecto) y licencias de terceros agrupadas. `npm run licenses` genera de forma determinista `apps/mobile/src/data/licenses.json` desde `package-lock.json`: **1.052 paquetes de producción en 16 grupos** (~93 KB, sin fecha). No se listan fuentes de datos.
- **i18n:** ES/EN con paridad exacta; GL 212/713 sin claves extra y con caída a ES. Letras y nombres propios no se traducen. El Lote 6 completa las 501 claves restantes.
- **Pruebas:** **225 pytest** y **290 tests / 34 suites** en la app. Cubren suma de aforo, agrupación por década, orden de temporadas, `clubImageUrl`, validación del `club.yml` y las letras reales, contrato compartido, idempotencia, fuentes de imagen y renders de Club, Himnos con y sin letra, Escudo, Equipaciones con imagen/marcador y Estadio.

### H7.1 — Club ampliado: títulos, rivalidades y medios (hecho, ADR 0032)

- **Contrato aditivo:** `Anthem.media`, `Anthem.lyricsRights`, `CrestVersion.media`, `Kit.media`, `Stadium.schedule/accessDetails/capacityAlternatives/tenants/media`, `Sponsors.details` y `Club.media`. `DataStatus` (`verified`/`pending_verification`) y los campos de detalle `coach`, `referee`, `goalScorers`, `tier` y `media` completan títulos y rivalidades. Los campos legados (`image`, `lyrics`, `official`...) no cambian. Pydantic → JSON Schema → Zod con `default(null)`/`default([])`.
- **Derechos de las letras:** las tres letras se mantienen con `lyricsRights.status = unknown`, titular, licencia de uso editorial, nota y `verifiedAt`. No se afirma permiso de reutilización.
- **Ficheros opcionales:** `titles.json` (21 ediciones; detalles de finales, entrenadores y plantillas estacionales cuando están documentados) y `rivalries.json` (6 rivalidades con balance de BDFutbol: Celta 133 partidos, Compostela 11, Oviedo 99, Sporting 96, Racing de Ferrol 41, Lugo 18; Celta `derbi`/`verified`). `validate` los acepta ausentes (404 = sin datos); `useTitles`/`useRivalries` los leen de forma opcional.
- **Pipelines:** `club titles` compara con la tabla «Títulos» de BDFutbol y escribe `data/manual/titles.proposed.yml` sin aplicar. `club titles --details` (manual, fuera del workflow de 10 min) enriquece esa propuesta con finales, goleadores y plantillas estacionales de BDFutbol (`temporada → competición → Final → ficha`), contrasta las finales de Copa con Wikipedia y marca `match`/`match_with_unresolved`/`conflict`/`single_source`; `--max-editions` y `--no-wikipedia` acotan la pasada. Los minutos discrepantes quedan en `null`; el enriquecimiento nunca cambia automáticamente `titles.yml`. Las finales a doble partido se listan como `final_matches` y no se comparan como final única. `club rivalries` rellena `headToHead` con `PoliteClient` y conserva el JSON anterior si no hay ningún balance; `club probe-media` recorre los medios de `club.yml`, `titles.yml`, `rivalries.yml` y `club_images.yml` (HEAD + GET mínimo para dimensiones), comprueba las rutas locales y escribe `club_media.proposed.yml` y la sección de fallos de `docs/sources.md` sin copiar binarios ni sustituir URLs.
- **Ids verificados de BDFutbol:** Compostela `e12`, Oviedo `e28`, Sporting `e34`, Racing de Ferrol `e48`, Lugo `e76`; Celta `e11`. Documentados en `data/manual/bdfutbol_teams.yml`.
- **Pruebas:** pruebas de club para títulos, propuesta, rivalidades, idempotencia, recolección de medios, HEAD/GET, estados `ok`/`local`/`broken`/`blocked`/`missing`, caché offline y actualización idempotente de `docs/sources.md` con `httpx.MockTransport`. H4 añade HTML sintético para enlaces de competición, fila `Final`, ficha de partido, plantilla (porteros sin goles encajados), wikitext de Wikipedia y un `build_title_details` completo que verifica `match`/`conflict` sin modificar `titles.yml`; H5 audita y prueba `club rivalries` con caché offline, campos manuales vacíos (`iconicMatches`, `facts`, `media`), validación de `tier` y justificación de exclusión de Racing de Santander; H6 completa la compatibilidad hacia atrás en Zod para `Titles` y `Rivalries` y verifica la estabilidad del buster `data-v7`; `pytest` completo (225) y `npm test` (290 / 34 suites) en verde. `club` sigue siendo idempotente (`changed=false` en la segunda pasada).

### H7.2 — Revisión editorial inicial del Club (implementado parcialmente, ADR 0033)
- **Base compartida:** nuevos `HeroHeader`, `StatCounter` compatible con Reducir movimiento, `Timeline` filtrable/expandible, `PhotoGallery` con modal, `MediaCredit`, `ConfidenceBadge` y `MapActions`. La portada ahora presenta cabecera editorial, cifras, identidad jerarquizada y mosaico de secciones; incluye siempre el aviso no oficial.
- **Escudo:** 14 versiones con años/contexto, comparación seleccionable antes/después entre versiones adyacentes y visor modal a pantalla completa. Cada versión muestra `MediaCredit`; las 13 fuentes de 1000logos quedan marcadas con licencia no verificada (no se afirma permiso de reutilización).
- **Equipaciones:** filtro por tipo y SectionList por década; las ilustraciones existentes se etiquetan explícitamente «Ilustración». Cobertura regenerada: **3 fotos verificadas** (1987-88 y 1999-00, Wikimedia Commons, CC0; 2026-27, Deportienda, derechos reservados), todas con fuente y crédito visibles; las tres URL responden HTTP 200 `image/jpeg`. Las otras **41 equipaciones** conservan ilustración SVG. No se reasignaron fotos por suposición.
- **Himnos:** «Voa» tiene una acción de reproducción externa a su publicación oficial; se verifica `origin=club_official` y `status=verified`. No se carga WebView. La app oculta letras sin un estado de derechos autorizado.
- **Estadio y museo:** aforo animado con fuente/confianza; capacidad oficial corregida a 32.490, cronología de inauguración/reforma y acceso nativo a mapas. El museo ofrece mapas y galería modal solo para fotos verificadas con crédito; no hay fotos u horarios verificados, así que se ocultan la galería vacía y el estado Abierto/Cerrado.
- **Junta y patrocinadores:** organigrama visual con iniciales, consejo publicado y entrenador enlazado desde `squad.json`; dirección deportiva ausente oculta. Patrocinadores agrupados por papel con monogramas. La cronología solo incluye acuerdos con fechas verificadas (Nike desde 2026); no se inventa la antigüedad de ABANCA.
- **Cronología transversal:** filtros por escudo, estadio, títulos, patrocinadores y junta; usa años explícitos de los datos publicados. Los acuerdos sin tenencia verificada quedan fuera. Los controles de filtro cumplen 44 pt.
- **Validación del rediseño Club:** Node 22 `typecheck`, `lint` y suite móvil (34 suites, 300 pruebas); claves ES/EN en paridad (712/712). El hito de cronología no cambia el contrato.
- **Validación del hito de equipaciones:** `.venv/bin/ruff check scripts` y `.venv/bin/pytest scripts/tests` (230 passed); Node 22 `typecheck`, `lint` y `npm test -w apps/mobile -- --ci` (35 suites, 302 passed). La prueba de render comprueba crédito visible y fallback desde foto remota a SVG local.
- **Validación del escudo:** render de comparación, años y créditos; visor modal; Node 22 `typecheck`, `lint`, tests (34 suites / 294 passed) y 17 pruebas Python del publicador.
- **Pendiente para los siguientes hitos:** fotos históricas fiables, fotos verificadas del museo, completar atributos/galerías de venues y probar visualmente ajustes y el conjunto en iPhone. H7.4 no cierra toda la especificación editorial.

### H7.3 — Procedencia y conflictos en títulos (hecho, ADR 0035)

- BDFutbol publica 24 integrantes de la plantilla de temporada 1994-95 y 31 de
  2001-02; se presentan como plantillas estacionales, no como alineaciones de las
  finales. Entrenadores y plantillas muestran fuente y confianza por campo.
- La final de 1995 figura con fecha de inicio 24-jun-1995 y nota de reanudación
  el 27. Minutos discrepantes de Manjarín, Mijatović, Alfredo y Tristán quedan
  en `null`; el generador diferencia conflicto de goleador/minuto y no aplica
  propuestas.
- Contrato aditivo: `coachProvenance` y `squadProvenance`, `null` por defecto.
  Se regeneró `titles.schema.json` y `titles.json`; la compatibilidad con
  payloads anteriores está cubierta en Python y Zod.
- Verificación: Ruff, **229 pytest**, Node 22 `typecheck`, `lint` y
  **300 tests / 34 suites** pasan. `python -m depor_hub.cli schemas` se repite
  sin cambios adicionales; ES/EN conservan las mismas claves.

### H7.4 — Rivalidades y acción de Ajustes (implementado)

- Las seis rivalidades publicadas incluyen al Celta y el balance enlazado a
  BDFutbol; cada una muestra una cronología con sus cinco cruces más recientes.
  `iconicMatches` y `facts` no tienen contenido en el YAML manual, por lo que
  no se muestran bloques vacíos ni se inventan curiosidades.
- La acción de Ajustes del encabezado dejó de usar `Link` como wrapper: ahora es
  un `Pressable` explícito, transparente, de 44 × 44 pt, con icono neutro de
  22 pt y separación derecha para evitar recorte/solape. Un test verifica el
  tamaño, el rol y la etiqueta accesible; falta comprobar la apariencia en un
  iPhone físico.
- Verificación actual: Node 22 `typecheck`, `lint` y **302 tests / 35 suites**
  pasan; la suite Python no tuvo cambios desde los **229 pytest** verdes de H7.3.

### Verificación H7
```bash
source .venv/bin/activate && ruff check scripts && pytest scripts
python -m depor_hub.cli schemas && git diff --exit-code packages/schemas
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run lint
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run typecheck
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test -- --ci
python -m depor_hub.cli club                # segunda pasada: changed=false
python -m depor_hub.cli club-images --offline
npm run licenses                            # segunda pasada: sin cambios
```

Probar en iPhone: Club y todas sus secciones en modo claro y oscuro; texto grande y Reducir movimiento; selector de década y crédito de foto en Equipaciones; modal/comparador del escudo; cómo llegar; museo con horarios ausentes; junta y patrocinadores; títulos y rivalidades; ajustes sin solape; Acerca de; modo avión, datos ausentes e imágenes bloqueadas. Comprobar contraste AA sobre fotos, etiquetas y objetivos táctiles de al menos 44 pt.

## Reglas de trabajo que han evitado errores
- Node 22 (nvm use 22) y venv Python 3.12 (.venv). Aplicar zips con `unzip -o X.zip -d .`, NUNCA reemplazando carpetas en Finder. Commit antes y después de cada hito.
- Instalar dependencias de la app con `npm install -w apps/mobile <pkg>`; módulos nativos con `(cd apps/mobile && npx expo install <pkg>)`. Nunca `npx expo install -- -w ...`.
- Secretos: FOOTBALL_DATA_TOKEN solo en GitHub Secrets y en .env local (ignorado). CONTACT_EMAIL es una variable de Actions. Nada de valores en .env.example.
- tsconfig de la app declara types ["jest","node"]; ESLint con import/no-unresolved desactivado.
- Jest necesita el alias de React en `apps/mobile/package.json` para deduplicar React 19.2.3 (app) y 19.3.x (raíz).
- Datos desconocidos = null. Escudos y fotos solo por URL externa con atribución (ADR 0006, 0009 y 0012); sin binarios de imágenes en el repo. Los hechos de fuentes externas no se inventan ni se completan por deducción. En escudos, una imagen apaisada de `P154` se descarta: es preferible un monograma a una foto pintada como escudo.
- El árbol de imágenes del club ya estaba versionado y contiene 14 PNG/JPEG rasterizados; este hito no añadió binarios. Su sustitución por fuentes externas necesita una migración específica para no romper las rutas de publicación existentes.

## Pendiente
H8 pulido (reevaluar FlashList si la lista crece, revisión de los 37 conflictos, más tests de render y ampliar overrides de escudos con fuente real) y H9 distribución; H7 queda pendiente de la verificación manual en dispositivo descrita arriba. Pendiente técnico de la fase actual: serializar `syncReminders`, completar gallego **212/713 → 713/713**, plegado ICS por octetos, permiso de calendario, `eas.json` y `EXPO_PUBLIC_DATA_BASE_URL` de producción; revisar `status.json` cuando `ok=false`. No hay cron externo implementado: `docs/operations.md` ya no promete uno. Huecos honestos que no se rellenan sin fuente fiable: peso de Ede Bright, Teun Gijselhart y Jonathan Asp-Jensen; redes de Teun Gijselhart (cedido al Al Ain, sin redes públicas aportadas); pie y peso de Teun ya resueltos con override contrastado. Escudos: los 6 rivales históricos de Segunda B (Covadonga, Linares, SD Logroñés, San Fernando CD, UD Logroñés y Zamora) siguen en `null`; no se rellenan sin URL y fuente verificables. El balance del entrenador solo cubre la temporada publicada y el staff depende del HTML oficial; el balance del próximo rival solo cubre la temporada publicada. Noticias: Riazor.org apenas ofrece miniatura en el feed y algunos medios pueden cambiar de WAF; `news audit` lo detecta. `social_pins.yml` no tiene pins verificados todavía y se añadirán por Pull Request con URL y fecha reales. Decisiones abiertas: contactar al club por el uso editorial de las fotos, los escudos y los titulares, nombre definitivo, identificadores com.deporhub.app provisionales y revisión de términos de BDFutbol y de los medios antes de una publicación a gran escala. **BDFutbol:** informe de riesgo en [`docs/bdfutbol-legal-risk.md`](bdfutbol-legal-risk.md); no se implementan eventos, alineaciones ni estadísticas por scraping sin autorización escrita o licencia. El enriquecimiento actual queda señalado como uso de riesgo medio-alto pendiente de respuesta.
