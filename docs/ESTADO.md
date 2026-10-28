# Estado del proyecto — 28-oct-2026
H0 (andamiaje), H1 (contratos + ingesta + Pages), H2 (capa de datos), H3 (calendario), **H4 (plantilla + ficha enriquecida, rediseño, escudos, entrenador y cuerpo técnico)**, **H5 (inicio real + cadencia adaptativa)** y **H6 (noticias, vídeos y redes curadas)** implementados; H4, H5 y H6 pendientes de verificación final en dispositivo (ver «Verificación H4», «Verificación H5» y «Verificación H6»). Siguiente: H7 (club y legal).

## Datos reales (sondeo football-data.org, plan gratuito)
- Acceso a PD (LaLiga) 2026-27; sin Copa del Rey. Depor: id 560, tla DEP.
- Plantilla: posición, nacimiento y nacionalidad 28/28.
- Tras el enriquecimiento (26-oct-2026): dorsal 28/28, contrato 28/28, altura 28/28, peso 25/28, lugar de nacimiento 28/28, pie 28/28, cesión de entrada 3/28, cesión de salida 1/28 (Teun → Al Ain), carrera 28/28, totales 28/28, partidos con el Depor 28/28, redes 27/28 y **fotos 28/28**. Valor de mercado 0/28 (solo manual, siempre «Estimación»). Escudos: **156/156** entradas de carrera (**75/75** clubes) y **1229/1262** partidos (**76/82** rivales distintos; los 20 de LaLiga, al 100 %). Los 6 rivales sin escudo son históricos de Segunda B y quedan en monograma. Entrenador: ficha completa de Antonio Hidalgo con 15 etapas y **21** miembros de cuerpo técnico.
- Fuente del enriquecimiento: BDFutbol (carrera, temporadas, totales, dorsal actual, peso y partidos), Wikipedia ES/GL/EN (contrato, cesión, altura y contraste), Wikidata (lugar, altura, pie, dorsal, redes, alias y sitelinks), ficha oficial del club (altura, pie, foto y redes; autoritativa cuando existe) y overrides manuales para redes y cesión de salida. 37 conflictos visibles en `data/manual/squad_enrich.proposed.yml`: los aplicados llevan `applied` + `resolution`, los no aplicados quedan sin valor.
- Dos fichas de Wikipedia con fecha de nacimiento distinta a la API (Lucas Noubi y Dani Barcia) se descartaron por identidad; su dorsal se recuperó de BDFutbol. No se empareja por nombre si hay fecha y no coincide.
- Estados de partido: TIMED = hora confirmada; SCHEDULED = hora NO fijada (00:00:00Z). Solo fecha en SCHEDULED; hora en Europe/Madrid solo en TIMED. No inventar horas.
- URL de datos: https://angelvilarino.github.io/depor-hub/v1 (meta, standings, fixtures, squad, news, sources y social; los tres últimos opcionales). Contrato v1 en packages/schemas (Pydantic origen, Zod espejo).

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
- La app está en **Expo SDK 58** (React Native 0.88, React 19.3), que es el SDK que soporta Expo Go actualmente. `npx expo install --check` y `npx expo-doctor` pasan sin avisos.
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

## H5 — Inicio y cadencia adaptativa (implementado, ADR 0015 + 0017)
- **Home v2 (ADR 0017):** `FreshnessBanner` → **Resultado final** (solo 24 h) → **Próximo partido** → aviso de aplazado → **El rival** → **Qué se juega** → **La temporada** (fusionada) → **Titulares** opcional → pie `data.seasonLine`. Refresco manual de `meta`, `standings` y `fixtures`; las noticias nunca convierten la Home en un error global.
- **Próximo partido:** `selectNextMatch` descarta `POSTPONED` y `CANCELLED`; el hero es simétrico (Local/Visitante en ambos lados), con competición traducida por código y fecha capitalizada. Sin «Cómo llegar». `matchPhase` distingue `tbc`, `upcoming`, `live`, `awaiting_result`, `finished`, `postponed`, `suspended`, `cancelled` y `unknown`; un `TIMED` vencido dice «Pendiente de actualizar», nunca un resultado inventado.
- **Cuenta atrás real:** `Countdown` aislado, intervalo de 1 s bajo una hora y 60 s por encima, pausa con `AppState`, `EXPO_PUBLIC_DEV_NOW` solo en desarrollo. La etiqueta accesible se actualiza como mucho una vez por minuto; el pulso se desactiva con «Reducir movimiento». `SCHEDULED` muestra solo días.
- **Resultado final:** marcador, chip G/E/P, jornada y enlace a `/match/[id]` durante 24 h desde el inicio; después desaparece.
- **El rival:** posición y puntos, racha, balance de la temporada, entrenador y hasta 3 goleadores (football-data) y balance histórico completo con alcance, fuente, enlace y últimos 5 cruces (BDFutbol `vs.php`). Las partes sin dato se ocultan.
- **Qué se juega:** `whatIsAtStake` simula solo los puntos del Depor (V/E/D) con rangos de posición bajo empates y el texto fijo `other_results_unchanged`. Si falta la clasificación o el próximo partido, el bloque no se pinta.
- **La temporada (fusionada):** un único resumen (posición, puntos, PJ, G-E-P, GF-GC, DG), racha con leyenda y detalle de los cinco partidos, gráfica SVG de evolución de la posición y mini-clasificación de 5 filas con «Ver tabla completa». Se elimina la tarjeta `MiniTable` duplicada.
- **Tiempo en la sede:** Open-Meteo por coordenadas verificadas, solo con hora confirmada y ≤ 16 días; atribución visible. Solo Riazor tiene coordenadas; el resto oculta el tiempo.
- **Contratos opcionales:** `season.json` (resumen, racha, evolución `estimated`, qué se juega) y `rivals.json` (19 rivales, histórico BDFutbol, entrenador y goleadores). La Home funciona con 404 o caché anterior usando `standings` y `fixtures`.
- **Calendario:** el editor nativo (`presentPicker` + `addEventWithForm`) va primero en iOS; `.ics` como respaldo; error específico solo si ambos fallan. `createEventInCalendarAsync` ya no existe en `expo-calendar` 58 (ADR 0005 corregido). En Expo Go el editor nativo no está disponible: requiere development build; el `.ics` sí se puede probar.
- **Recordatorios:** hoja inferior con 1 día, 1 h, 15 min y al inicio; permiso contextual y estado visible. `remindMatchIds` migra a `remindMatches`; la planificación se recorta a 64 notificaciones (límite de iOS).
- **Lógica pura:** `selectNextMatch`, `selectPostponedNotice`, `selectLastResult`, `matchPhase`, `isRecentResult`, `miniTableWindow`, `recentForm`, `seasonSummary`, `nextOpponentInfo`, `countdownParts` y utilidades de estado en `apps/mobile/src/features/home/logic.ts`.
- **Cadencia:** `ingest --if-due` refresca cada 10 min entre −30 min y +3 h del kickoff (`TIMED`/`IN_PLAY`/`PAUSED`) y cada 60 min fuera; sin fixtures o sin estado, refresca. El estado vive en `data/raw/ingest_state.json` y el workflow lo persiste con `actions/cache`; cron cada 10 min y `workflow_dispatch` con `force`. `rivals-refresh.yml` publica `rivals.json` a diario.
- **Pruebas:** lógica de Home con datos reales, vacíos, error, `SCHEDULED`, aplazados, fases y ventana de 24 h; render de Home con y sin `season.json`/`rivals.json`; tiempo elegible y no elegible; limpieza de la cuenta atrás; mapas; cadencia con reloj inyectado; workflows.

### Verificación H5
```bash
source .venv/bin/activate && ruff check scripts && pytest scripts
python -m depor_hub.cli schemas && git diff --exit-code packages/schemas
npm run lint && npm run typecheck && npm test
python -m depor_hub.cli ingest --if-due --state /tmp/ingest_state.json  # sin red si no toca
python -m depor_hub.cli rivals --offline                                # idempotente desde caché
```
Probar en iPhone: Home con datos reales (resultado final si hace menos de 24 h, hero con cuenta atrás, rival con histórico, qué se juega, temporada con gráfica y mini tabla, pie), pulsar «Recordarme» y «Añadir al calendario» (editor nativo en development build; `.ics` en Expo Go), abrir un partido y volver, entrar en «Ver tabla completa» y comprobar que Calendario abre en Clasificación, y repetir con modo avión, con datos vacíos y con `season.json`/`rivals.json` ausentes.

## H6 — Noticias, vídeos y redes curadas (implementado, ADR 0016)
- **Catálogo real:** `data/manual/news_feeds.yml` tiene 30 entradas, **21 activas y 9 descartadas** con su motivo. Los descartes no se reintentan: AS (403), Sport (406), Cadena SER (403), Radio Coruña, Faro de Vigo, La Opinión A Coruña y Superdeporte (406), la web del club sin RSS y Deportivo Hoy (DNS inexistente). Los medios bloqueados se cubren con consultas `site:` de Google News; el club, con su canal de YouTube y `site:rcdeportivo.es`.
- **Pipeline** en `scripts/depor_hub/news/`: `httpx` con User-Agent identificable, timeout, **1 s por dominio**, `ETag`/`If-Modified-Since` y caché en `data/raw/news/`. Normaliza HTML y URLs, descarta `utm_*`, calcula un `id` estable desde la URL canónica, recorta el resumen a 240 caracteres y marca `publishedEstimated` solo cuando el feed no da fecha y no hay una anterior reutilizable. Tolerancia por feed: un medio caído no tumba la ingesta.
- **Filtro de relevancia:** exige 3 puntos; descarta otros «Deportivo», apellidos comunes sueltos y el `Riazor` de playa/sucesos. Etiquetas cerradas (`fichajes`, `cantera`, `partido`, `rueda-de-prensa`, `lesiones`, `entrenador`, `aficion`, `resultados`) más `player:<id>` y `rival:<slug>`, máximo 12.
- **Deduplicación:** entre medios distintos, similitud ≥ 0,82 en 7 días; el principal se elige por peso y antigüedad y los demás van a `alsoIn`. Dos entradas del mismo medio solo se fusionan si el titular normalizado es idéntico, para corregir las URLs repetidas de Google News sin mezclar noticias parecidas.
- **Ventana y rotación:** 14 días y máximo 400 ítems. Las consultas de jugador de Google News rotan de 6 en 6 con un offset en `data/raw/news/state.json`. La ingesta es idempotente: si no cambia el hash, no escribe.
- **Contrato aditivo:** `NewsItem` gana `sourceId`, `sourceKind`, `kind`, `publishedEstimated`, `summary`, `players`, `alsoIn`, `durationSeconds` y `videoId`; `news.json` añade `meta` y hash propio. `sources.json` publica las fuentes reales para filtros y créditos; `social.json`, los perfiles y pins curados. `meta.json.dataHash` sigue cubriendo solo los cuatro ficheros deportivos.
- **Vídeos:** el canal oficial del club se publica dentro de `news.json` con `kind: 'video'` y `videoId`; comparten filtros, leídos y paginación con los artículos.
- **Redes:** `data/manual/social_pins.yml` solo contiene perfiles oficiales verificados (X, Instagram y YouTube). `pins` está vacío a propósito: no se inventan publicaciones ni se scrapea ninguna red.
- **Workflow:** `news-refresh.yml` cada 30 minutos, con `concurrency.group: data-publish` y `cancel-in-progress: false` compartido con `data-refresh.yml`. Ambos hacen `git pull --rebase` y despliegan Pages desde un checkout fresco de `main`; un test de humo lo comprueba.
- **App:** `useNews`, `useSources` y `useSocial` con 10 minutos de `staleTime` y **404 opcional**. Pestaña Noticias con miniaturas o monograma, hora relativa, etiquetas, `alsoIn`, filtros por tipo/fuente/etiqueta, búsqueda sin acentos, paginación de 30, pull-to-refresh y leídos persistidos. Enlaces con `expo-web-browser` y respaldo a `Linking`. Home con **5 titulares** sin repetir y «Ver todas».
- **i18n:** ES y EN con paridad exacta; GL parcial con caída a ES.
- **Pruebas:** **136 pytest** (33 de noticias, 5 de redes y 4 de workflows) y **172 tests / 22 suites** en la app, incluidos render con 0/1/muchos/error/offline y la lógica de filtros, paginación, top 5, edad y apertura de enlaces.

### Verificación H6
```bash
source .venv/bin/activate && ruff check scripts && pytest scripts
python -m depor_hub.cli schemas && git diff --exit-code packages/schemas
npm run lint && npm run typecheck && npm test
python -m depor_hub.cli news audit --write-docs
python -m depor_hub.cli news ingest --interval 1 --player-queries 6
python -m depor_hub.cli social
```
Probar en iPhone: pestaña Noticias con miniaturas y monogramas, filtros por tipo/fuente/etiqueta, búsqueda, «Cargar más», pull-to-refresh, abrir un artículo y un vídeo, marcar leídos, sección Redes, y Home con cinco titulares y «Ver todas». Repetir con modo avión (la caché sigue visible con el banner) y con `news.json` ausente (la app no debe romperse).

## Reglas de trabajo que han evitado errores
- Node 22 (nvm use 22) y venv Python 3.12 (.venv). Aplicar zips con `unzip -o X.zip -d .`, NUNCA reemplazando carpetas en Finder. Commit antes y después de cada hito.
- Instalar dependencias de la app con `npm install -w apps/mobile <pkg>`; módulos nativos con `(cd apps/mobile && npx expo install <pkg>)`. Nunca `npx expo install -- -w ...`.
- Secretos: FOOTBALL_DATA_TOKEN solo en GitHub Secrets y en .env local (ignorado). CONTACT_EMAIL es una variable de Actions. Nada de valores en .env.example.
- tsconfig de la app declara types ["jest","node"]; ESLint con import/no-unresolved desactivado.
- Jest necesita el alias de React en `apps/mobile/package.json` para deduplicar React 19.2.3 (app) y 19.3.x (raíz).
- Datos desconocidos = null. Escudos y fotos solo por URL externa con atribución (ADR 0006, 0009 y 0012); sin binarios de imágenes en el repo. Los hechos de fuentes externas no se inventan ni se completan por deducción. En escudos, una imagen apaisada de `P154` se descarta: es preferible un monograma a una foto pintada como escudo.

## Pendiente
H7 club y legal, H8 pulido (reevaluar FlashList si la lista crece, revisión de los 37 conflictos, más tests de render y ampliar overrides de escudos con fuente real), H9 distribución. Huecos honestos que no se rellenan sin fuente fiable: peso de Ede Bright, Teun Gijselhart y Jonathan Asp-Jensen; redes de Teun Gijselhart (cedido al Al Ain, sin redes públicas aportadas); pie y peso de Teun ya resueltos con override contrastado. Escudos: los 6 rivales históricos de Segunda B (Covadonga, Linares, SD Logroñés, San Fernando CD, UD Logroñés y Zamora) siguen en `null`; no se rellenan sin URL y fuente verificables. El balance del entrenador solo cubre la temporada publicada y el staff depende del HTML oficial; el balance del próximo rival solo cubre la temporada publicada. Noticias: Google News no da miniaturas y `social_pins.yml` no tiene pins verificados todavía; se añadirán por Pull Request con URL y fecha reales. Decisiones abiertas: contactar al club por el uso editorial de las fotos, los escudos y los titulares, nombre definitivo, identificadores com.deporhub.app provisionales y revisión de términos de BDFutbol y de los medios antes de una publicación a gran escala.
