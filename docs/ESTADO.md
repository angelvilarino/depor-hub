# Estado del proyecto — 25-oct-2026
H0 (andamiaje), H1 (contratos + ingesta + Pages), H2 (capa de datos), H3 (calendario) y **H4 (plantilla + ficha enriquecida) implementados**; H4 pendiente de verificación final en dispositivo (ver «Verificación H4»). Siguiente: H5 (inicio).

## Datos reales (sondeo football-data.org, plan gratuito)
- Acceso a PD (LaLiga) 2026-27; sin Copa del Rey. Depor: id 560, tla DEP.
- Plantilla: posición, nacimiento y nacionalidad 28/28.
- Tras el enriquecimiento (25-oct-2026): dorsal 28/28, contrato 28/28, altura 28/28, peso 25/28, lugar de nacimiento 28/28, pie 28/28, cesión de entrada 3/28, cesión de salida 1/28 (Teun → Al Ain), carrera 28/28, totales 28/28, partidos con el Depor 28/28, redes 27/28 y **fotos 28/28**. Valor de mercado 0/28 (solo manual, siempre «Estimación»).
- Fuente del enriquecimiento: BDFutbol (carrera, temporadas, totales, dorsal actual, peso y partidos), Wikipedia ES/GL/EN (contrato, cesión, altura y contraste), Wikidata (lugar, altura, pie, dorsal, redes, alias y sitelinks), ficha oficial del club (altura, pie, foto y redes; autoritativa cuando existe) y overrides manuales para redes y cesión de salida. 37 conflictos visibles en `data/manual/squad_enrich.proposed.yml`: los aplicados llevan `applied` + `resolution`, los no aplicados quedan sin valor.
- Dos fichas de Wikipedia con fecha de nacimiento distinta a la API (Lucas Noubi y Dani Barcia) se descartaron por identidad; su dorsal se recuperó de BDFutbol. No se empareja por nombre si hay fecha y no coincide.
- Estados de partido: TIMED = hora confirmada; SCHEDULED = hora NO fijada (00:00:00Z). Solo fecha en SCHEDULED; hora en Europe/Madrid solo en TIMED. No inventar horas.
- URL de datos: https://angelvilarino.github.io/depor-hub/v1 (meta, standings, fixtures, squad). Contrato v1 en packages/schemas (Pydantic origen, Zod espejo).

## H3 — Calendario (hecho)
Ver `docs/adr/0005-calendario-y-recordatorios.md` y `0006-escudos-sede-arbitro.md`.

## H4 — Equipo y ficha enriquecida (implementado, ADR 0007 + 0008 + 0009)
- Pestaña Equipo: entrenador + plantilla agrupada por posición; ficha con retrato, edad calculada y bloque «Datos pendientes».
- Ficha ampliada: lugar de nacimiento, peso, pie, cesión de entrada y de salida, valor de mercado como **estimación**, redes con `expo-linking`, totales de carrera, trayectoria cronológica con filas por temporada, partidos con el Depor (marcador, minutos, goles, tarjetas) y **galería de fotos con atribución, licencia y enlace a la fuente**.
- Fotos: **solo la foto oficial del club** (ficha del jugador o noticia de presentación), enlazada con crédito editorial y siempre como foto de perfil. No se guardan binarios en el repo. Si no hay foto o falla la carga, se usa el avatar de iniciales.
- La ficha oficial del club (`/depor` y `/depor-fabril`) es autoritativa para altura, pie y foto cuando existe; los conflictos se registran con el valor aplicado y la resolución.
- Contrato ampliado de forma aditiva: `Player.birthPlace`, `preferredFoot`, `loanFrom`, `loanTo`, `marketValueEur`, `weightKg`, `social`, `photos`, `career`, `careerTotals`, `deporMatches`, `provenance`; `Coach` gana `birthDate`, `since`, `contractUntil` y `provenance`. Los esquemas JSON y el espejo Zod se regeneraron con `default(null)`/`default([])` para tolerar JSON y caché anteriores.
- Cada campo enriquecido lleva `source`, `confidence` (`verified`, `cross_checked`, `single_source`, `estimated`) y `capturedAt`. Los conflictos no se ocultan: los aplicados dejan `applied` y `resolution`; los no aplicados se quedan en `null`.
- `data/manual/squad_extras.yml` es **salida generada**; los datos manuales viven en `data/manual/squad_overrides.yml` (se cargan con `--overrides`). Así una regeneración no pisa correcciones ni fotos puntuales.
- `npm run mobile` sirve `data/public` en local además de arrancar Expo; la URL se deriva del host de Metro (sin IPs fijas). `.env.example` documenta las variables.
- Fuentes y límites detallados en `docs/sources.md`; decisiones en `docs/adr/0008-enriquecimiento-fuentes-libres.md` y `docs/adr/0009-fotos-y-fuente-oficial.md`.

### Comandos de enriquecimiento
```bash
python -m depor_hub.cli enrich                       # propuesta, no toca datos públicos
python -m depor_hub.cli enrich --min-confidence cross_checked --apply
python -m depor_hub.cli enrich --apply --offline     # repite desde data/raw/enrich
python -m depor_hub.cli enrich --no-photos           # sin ninguna foto
python -m depor_hub.cli enrich --overrides data/manual/squad_overrides.yml
python -m depor_hub.cli enrich --export-template data/manual/squad.csv
python -m depor_hub.cli enrich --import-csv data/manual/squad.csv
```
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
Probar en iPhone: `npm run mobile` (sirve `data/public` en local), pestaña Equipo (secciones, contador y retratos), tocar un jugador (foto con atribución, bio, carrera, totales, partidos, «Fuente/confianza»), abrir una red social y la ficha de la foto, cambiar idioma ES/EN/GL, modo oscuro y modo avión (la plantilla sigue visible con el banner).

## Reglas de trabajo que han evitado errores
- Node 22 (nvm use 22) y venv Python 3.12 (.venv). Aplicar zips con `unzip -o X.zip -d .`, NUNCA reemplazando carpetas en Finder. Commit antes y después de cada hito.
- Instalar dependencias de la app con `npm install -w apps/mobile <pkg>`; módulos nativos con `(cd apps/mobile && npx expo install <pkg>)`. Nunca `npx expo install -- -w ...`.
- Secretos: FOOTBALL_DATA_TOKEN solo en GitHub Secrets y en .env local (ignorado). CONTACT_EMAIL es una variable de Actions. Nada de valores en .env.example.
- tsconfig de la app declara types ["jest","node"]; ESLint con import/no-unresolved desactivado.
- Jest necesita el alias de React en `apps/mobile/package.json` para deduplicar React 19.2.3 (app) y 19.3.x (raíz).
- Datos desconocidos = null. Escudos y fotos solo por URL externa con atribución (ADR 0006 y 0009); sin binarios de imágenes en el repo. Los hechos de fuentes externas no se inventan ni se completan por deducción.

## Pendiente
H5 inicio, H6 noticias, H7 club y legal, H8 pulido (FlashList, revisión de los 37 conflictos, más tests de render), H9 distribución. Huecos honestos que no se rellenan sin fuente fiable: peso de Ede Bright, Teun Gijselhart y Jonathan Asp-Jensen; redes de Teun Gijselhart (cedido al Al Ain, sin redes públicas aportadas); pie y peso de Teun ya resueltos con override contrastado. Decisiones abiertas: contactar al club por el uso editorial de las fotos, nombre definitivo, identificadores com.deporhub.app provisionales y revisión de términos de BDFutbol antes de una publicación a gran escala.
