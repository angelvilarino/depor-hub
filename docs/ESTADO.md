# Estado del proyecto — 26-oct-2026
H0 (andamiaje), H1 (contratos + ingesta + Pages), H2 (capa de datos), H3 (calendario) y **H4 (plantilla + ficha enriquecida, rediseño y escudos) implementados**; H4 pendiente de verificación final en dispositivo (ver «Verificación H4»). Siguiente: H5 (inicio).

## Datos reales (sondeo football-data.org, plan gratuito)
- Acceso a PD (LaLiga) 2026-27; sin Copa del Rey. Depor: id 560, tla DEP.
- Plantilla: posición, nacimiento y nacionalidad 28/28.
- Tras el enriquecimiento (26-oct-2026): dorsal 28/28, contrato 28/28, altura 28/28, peso 25/28, lugar de nacimiento 28/28, pie 28/28, cesión de entrada 3/28, cesión de salida 1/28 (Teun → Al Ain), carrera 28/28, totales 28/28, partidos con el Depor 28/28, redes 27/28 y **fotos 28/28**. Valor de mercado 0/28 (solo manual, siempre «Estimación»). Escudos: **97/156** entradas de carrera y **320/1262** partidos; **31/75** clubes de carrera y **19/82** rivales (**40/132** distintos). El resto queda en `null` y la app pinta un monograma.
- Fuente del enriquecimiento: BDFutbol (carrera, temporadas, totales, dorsal actual, peso y partidos), Wikipedia ES/GL/EN (contrato, cesión, altura y contraste), Wikidata (lugar, altura, pie, dorsal, redes, alias y sitelinks), ficha oficial del club (altura, pie, foto y redes; autoritativa cuando existe) y overrides manuales para redes y cesión de salida. 37 conflictos visibles en `data/manual/squad_enrich.proposed.yml`: los aplicados llevan `applied` + `resolution`, los no aplicados quedan sin valor.
- Dos fichas de Wikipedia con fecha de nacimiento distinta a la API (Lucas Noubi y Dani Barcia) se descartaron por identidad; su dorsal se recuperó de BDFutbol. No se empareja por nombre si hay fecha y no coincide.
- Estados de partido: TIMED = hora confirmada; SCHEDULED = hora NO fijada (00:00:00Z). Solo fecha en SCHEDULED; hora en Europe/Madrid solo en TIMED. No inventar horas.
- URL de datos: https://angelvilarino.github.io/depor-hub/v1 (meta, standings, fixtures, squad). Contrato v1 en packages/schemas (Pydantic origen, Zod espejo).

## H3 — Calendario (hecho)
Ver `docs/adr/0005-calendario-y-recordatorios.md` y `0006-escudos-sede-arbitro.md`.

## H4 — Equipo y ficha enriquecida (implementado, ADR 0007 + 0008 + 0009 + 0011 + 0012)
- **Pestaña Equipo (rediseño, ADR 0011):** entrenador, buscador por nombre o dorsal (sin mayúsculas ni tildes), chips Todos/POR/DEF/MED/DEL con contador, resumen real (jugadores y edad media) y conmutador **cuadrícula/lista** persistido en Zustand (`squadView`, por defecto `grid`). La cuadrícula usa retrato de 112 pt y la lista filas de 44 pt con retrato `-small`; si no hay resultados, `EmptyState` ofrece «Limpiar filtros». Se usa `FlatList`, no FlashList: 28 jugadores no justifican una dependencia nativa extra.
- **Ficha (rediseño, ADR 0011):** cabecera de navegación vacía, hero con retrato circular de 88 pt pulsable, modal con atribución/licencia/enlace y cierre accesible (botón, fondo, `onAccessibilityEscape` o arrastre), franja **PJ · G · min · TA · TR** (totales de carrera; si faltan, resumen de partidos), bio en dos columnas, redes con Ionicons, partidos con escudo, Local/Visitante, marcador y chip G/E/P con color y letra. La trayectoria es una línea vertical plegable (abierta) y los pendientes van al final, plegados. Se eliminó `SourceNote` y las claves i18n sin uso.
- **Accesibilidad:** controles de 44 pt, etiquetas y estados (`selected`/`expanded`), escalado de texto y `useReducedMotion` para desactivar el fundido del modal cuando el sistema lo pide. `win`/`draw`/`loss` tienen contraste AA ≥ 4,5 en claro y oscuro.
- **Fotos:** **solo la foto oficial del club** (ficha del jugador o noticia de presentación), enlazada con crédito editorial y siempre como foto de perfil. No se guardan binarios en el repo. Si no hay foto o falla la carga, se usa el avatar de iniciales.
- **Escudos (ADR 0012):** `CareerEntry.crestUrl` y `PlayerMatch.opponentCrestUrl`, aditivos y con `default(null)`. Prioridad football-data.org (fixtures) → Wikidata `P154` + Commons a 96 px → overrides `data/manual/club_crests.yml`. Filiales/reservas pueden heredar la matriz; un club senior sin `P154` no. Ambigüedad, `P154` ilegible o imagen apaisada ⇒ `null` (monograma). Caché en `data/raw/enrich/crests.json`, invalidada por `mtime` de fixtures/overrides.
- La ficha oficial del club (`/depor` y `/depor-fabril`) es autoritativa para altura, pie y foto cuando existe; los conflictos se registran con el valor aplicado y la resolución.
- Contrato ampliado de forma aditiva: `Player.birthPlace`, `preferredFoot`, `loanFrom`, `loanTo`, `marketValueEur`, `weightKg`, `social`, `photos`, `career`, `careerTotals`, `deporMatches`, `provenance`; `CareerEntry.crestUrl`; `PlayerMatch.opponentCrestUrl`; `Coach` gana `birthDate`, `since`, `contractUntil` y `provenance`. Los esquemas JSON y el espejo Zod se regeneraron con `default(null)`/`default([])` para tolerar JSON y caché anteriores.
- Cada campo enriquecido lleva `source`, `confidence` (`verified`, `cross_checked`, `single_source`, `estimated`) y `capturedAt`. Los conflictos no se ocultan: los aplicados dejan `applied` y `resolution`; los no aplicados se quedan en `null`.
- `data/manual/squad_extras.yml` es **salida generada**; los datos manuales viven en `data/manual/squad_overrides.yml` (se cargan con `--overrides`). Así una regeneración no pisa correcciones ni fotos puntuales.
- `npm run mobile` sirve `data/public` en local además de arrancar Expo; la URL se deriva del host de Metro (sin IPs fijas). `.env.example` documenta las variables.
- La app está en **Expo SDK 58** (React Native 0.88, React 19.3), que es el SDK que soporta Expo Go actualmente. `npx expo install --check` y `npx expo-doctor` pasan sin avisos.
- Fuentes y límites detallados en `docs/sources.md`; decisiones en `docs/adr/0008-enriquecimiento-fuentes-libres.md`, `0009-fotos-y-fuente-oficial.md`, `0011-rediseno-equipo-y-ficha.md` y `0012-escudos-de-clubes.md`.

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
```
Antes de una resolución online real de escudos, borra `data/raw/enrich/crests.json` si hiciste una pasada `--offline`: la caché guarda también los `null` y los reutilizaría.
El workflow `Enrich proposal` es manual (`workflow_dispatch`), sube el YAML propuesto como artefacto y **no hace commit**.

### Verificación H4
```bash
source .venv/bin/activate && pip install -e "scripts[dev]"
ruff check scripts && pytest scripts
python -m depor_hub.cli schemas && git diff --exit-code packages/schemas
npm run lint && npm run typecheck && npm test
# idempotencia del enriquecimiento
python -m depor_hub.cli enrich --apply --offline   # segunda pasada: changed=false
```
Probar en iPhone: `npm run mobile` (sirve `data/public` en local), pestaña Equipo (cuadrícula/lista, buscador por nombre y dorsal, chips con contador, resumen y «Limpiar filtros»), tocar un jugador (foto 88 pt y modal con atribución, franja de stats, bio en dos columnas, partidos con escudo/chip/enlace, trayectoria plegable y pendientes), abrir una red social y la ficha de la foto, activar «Reducir movimiento» en el sistema y comprobar que el modal no anima, cambiar idioma ES/EN/GL, modo oscuro y modo avión (la plantilla sigue visible con el banner).

## Reglas de trabajo que han evitado errores
- Node 22 (nvm use 22) y venv Python 3.12 (.venv). Aplicar zips con `unzip -o X.zip -d .`, NUNCA reemplazando carpetas en Finder. Commit antes y después de cada hito.
- Instalar dependencias de la app con `npm install -w apps/mobile <pkg>`; módulos nativos con `(cd apps/mobile && npx expo install <pkg>)`. Nunca `npx expo install -- -w ...`.
- Secretos: FOOTBALL_DATA_TOKEN solo en GitHub Secrets y en .env local (ignorado). CONTACT_EMAIL es una variable de Actions. Nada de valores en .env.example.
- tsconfig de la app declara types ["jest","node"]; ESLint con import/no-unresolved desactivado.
- Jest necesita el alias de React en `apps/mobile/package.json` para deduplicar React 19.2.3 (app) y 19.3.x (raíz).
- Datos desconocidos = null. Escudos y fotos solo por URL externa con atribución (ADR 0006, 0009 y 0012); sin binarios de imágenes en el repo. Los hechos de fuentes externas no se inventan ni se completan por deducción. En escudos, una imagen apaisada de `P154` se descarta: es preferible un monograma a una foto pintada como escudo.

## Pendiente
H5 inicio, H6 noticias, H7 club y legal, H8 pulido (reevaluar FlashList si la lista crece, revisión de los 37 conflictos, más tests de render y ampliar overrides de escudos con fuente real), H9 distribución. Huecos honestos que no se rellenan sin fuente fiable: peso de Ede Bright, Teun Gijselhart y Jonathan Asp-Jensen; redes de Teun Gijselhart (cedido al Al Ain, sin redes públicas aportadas); pie y peso de Teun ya resueltos con override contrastado. Escudos: 44 clubes de la trayectoria siguen en `null` (sin `P154`, entidades ambiguas o imágenes descartadas); no se rellenan sin URL y fuente verificables. Decisiones abiertas: contactar al club por el uso editorial de las fotos y los escudos, nombre definitivo, identificadores com.deporhub.app provisionales y revisión de términos de BDFutbol antes de una publicación a gran escala.
