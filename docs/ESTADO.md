# Estado del proyecto — 30-oct-2026
H0 (andamiaje), H1 (contratos + ingesta + Pages), H2 (capa de datos), H3 (calendario), **H4 (plantilla + ficha enriquecida, rediseño, escudos, entrenador y cuerpo técnico)**, **H5 (inicio + identidad Cartel/Prensa, iteración 3)** y **H6 (noticias, vídeos y redes curadas)** implementados; H4, H5 y H6 pendientes de verificación final en dispositivo (ver «Verificación H4», «Verificación H5» y «Verificación H6»). Siguiente: H7 (club y legal).

## Datos reales (sondeo football-data.org, plan gratuito)
- Acceso a PD (LaLiga) 2026-27; sin Copa del Rey. Depor: id 560, tla DEP.
- Plantilla: posición, nacimiento y nacionalidad 28/28.
- Tras el enriquecimiento (26-oct-2026): dorsal 28/28, contrato 28/28, altura 28/28, peso 25/28, lugar de nacimiento 28/28, pie 28/28, cesión de entrada 3/28, cesión de salida 1/28 (Teun → Al Ain), carrera 28/28, totales 28/28, partidos con el Depor 28/28, redes 27/28 y **fotos 28/28**. Valor de mercado 0/28 (solo manual, siempre «Estimación»). Escudos: **156/156** entradas de carrera (**75/75** clubes) y **1229/1262** partidos (**76/82** rivales distintos; los 20 de LaLiga, al 100 %). Los 6 rivales sin escudo son históricos de Segunda B y quedan en monograma. Entrenador: ficha completa de Antonio Hidalgo con 15 etapas y **21** miembros de cuerpo técnico.
- Fuente del enriquecimiento: BDFutbol (carrera, temporadas, totales, dorsal actual, peso y partidos), Wikipedia ES/GL/EN (contrato, cesión, altura y contraste), Wikidata (lugar, altura, pie, dorsal, redes, alias y sitelinks), ficha oficial del club (altura, pie, foto y redes; autoritativa cuando existe) y overrides manuales para redes y cesión de salida. 37 conflictos visibles en `data/manual/squad_enrich.proposed.yml`: los aplicados llevan `applied` + `resolution`, los no aplicados quedan sin valor.
- Dos fichas de Wikipedia con fecha de nacimiento distinta a la API (Lucas Noubi y Dani Barcia) se descartaron por identidad; su dorsal se recuperó de BDFutbol. No se empareja por nombre si hay fecha y no coincide.
- Estados de partido: TIMED = hora confirmada; SCHEDULED = hora NO fijada (00:00:00Z). Solo fecha en SCHEDULED; hora en Europe/Madrid solo en TIMED. No inventar horas.
- URL de datos: https://angelvilarino.github.io/depor-hub/v1 (meta, standings, fixtures, squad, news y social; los dos últimos opcionales). Contrato v1 en packages/schemas (Pydantic origen, Zod espejo).

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
- **Noticias en Inicio:** una destacada con miniatura del feed o monograma, cuatro filas, fuente y hora relativa; `alsoIn` se despliega y enlaza a los otros medios. No se scrapean páginas ni iconos de medios: `iconUrl` es opcional para futuras URLs verificadas. El algoritmo agrupa nombres de eventos compartidos en títulos/extractos dentro de 48 h; las tres entradas reales de Falas Dépor se publican como una sola historia. El test de Alberto Molina confirma que «Deportivo» y el apellido/homonimia no bastan: se rechaza como irrelevante.
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
- **Workflow:** `news-refresh.yml` cada 6 h (`37 */6 * * *`), `workflow_dispatch` con `force`, `timeout-minutes`, caché `data/raw/news`, `concurrency.group: data-publish` y `cancel-in-progress: false`. Commit solo con cambios, `rebase` antes de publicar y deploy solo si cambió algo. Si no responde ninguna fuente, falla y no despliega.
- **App:** `SectionList` por día en `Europe/Madrid`; cabecera que scrollea con recuento, no leídas y «Marcar leídas»; barra sticky con búsqueda expandible, Todo/Artículos/Vídeos, chips de grupo y filtros; hoja inferior de fuentes y etiquetas; tarjeta con monograma, título a 3 líneas, extracto a 2, miniatura de 72 px, dos etiquetas pulsables y `+N medios` desplegable. Leídos en Zustand con poda, confirmación y deshacer; contador <100 o `99+`; búsqueda con debounce sobre título/medio/etiquetas. Filtros no persistentes.
- **Home:** cinco titulares, resueltos con `sources`, y «Ver todas».
- **i18n:** ES y EN con paridad exacta; GL parcial con caída a ES.
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

## Reglas de trabajo que han evitado errores
- Node 22 (nvm use 22) y venv Python 3.12 (.venv). Aplicar zips con `unzip -o X.zip -d .`, NUNCA reemplazando carpetas en Finder. Commit antes y después de cada hito.
- Instalar dependencias de la app con `npm install -w apps/mobile <pkg>`; módulos nativos con `(cd apps/mobile && npx expo install <pkg>)`. Nunca `npx expo install -- -w ...`.
- Secretos: FOOTBALL_DATA_TOKEN solo en GitHub Secrets y en .env local (ignorado). CONTACT_EMAIL es una variable de Actions. Nada de valores en .env.example.
- tsconfig de la app declara types ["jest","node"]; ESLint con import/no-unresolved desactivado.
- Jest necesita el alias de React en `apps/mobile/package.json` para deduplicar React 19.2.3 (app) y 19.3.x (raíz).
- Datos desconocidos = null. Escudos y fotos solo por URL externa con atribución (ADR 0006, 0009 y 0012); sin binarios de imágenes en el repo. Los hechos de fuentes externas no se inventan ni se completan por deducción. En escudos, una imagen apaisada de `P154` se descarta: es preferible un monograma a una foto pintada como escudo.

## Pendiente
H7 club y legal, H8 pulido (reevaluar FlashList si la lista crece, revisión de los 37 conflictos, más tests de render y ampliar overrides de escudos con fuente real), H9 distribución. Huecos honestos que no se rellenan sin fuente fiable: peso de Ede Bright, Teun Gijselhart y Jonathan Asp-Jensen; redes de Teun Gijselhart (cedido al Al Ain, sin redes públicas aportadas); pie y peso de Teun ya resueltos con override contrastado. Escudos: los 6 rivales históricos de Segunda B (Covadonga, Linares, SD Logroñés, San Fernando CD, UD Logroñés y Zamora) siguen en `null`; no se rellenan sin URL y fuente verificables. El balance del entrenador solo cubre la temporada publicada y el staff depende del HTML oficial; el balance del próximo rival solo cubre la temporada publicada. Noticias: Riazor.org apenas ofrece miniatura en el feed y algunos medios pueden cambiar de WAF; `news audit` lo detecta. `social_pins.yml` no tiene pins verificados todavía y se añadirán por Pull Request con URL y fecha reales. Decisiones abiertas: contactar al club por el uso editorial de las fotos, los escudos y los titulares, nombre definitivo, identificadores com.deporhub.app provisionales y revisión de términos de BDFutbol y de los medios antes de una publicación a gran escala.
