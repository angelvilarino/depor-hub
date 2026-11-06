# Depor Hub (no oficial)
Proyecto de aficionados sin vinculación oficial con el Real Club Deportivo de La Coruña, S.A.D.

App Expo (React Native + TypeScript) con datos públicos del Depor: Inicio con identidad Cartel + Prensa, resultado y cuenta atrás, ficha del rival con histórico BDFutbol, temporada interactiva, prensa con noticias agrupadas, calendario, plantilla y fichas enriquecidas, vídeos, redes oficiales y ficha completa del club (historia, himnos, escudo, equipaciones, estadio, museo, junta, palmarés y enlaces). Las estadísticas y fotos individuales de rivales se omiten al no usar una fuente gratuita verificada para 2026/27. Los datos se publican como JSON estático en GitHub Pages; la app no contiene claves.

## Requisitos
- Node >= 22.13 y npm.
- Python 3.12 para los scripts de ingesta.
- git.

Copia `DEPOR_HUB_CONTEXTO.md` a `docs/CONTEXTO.md` si aún no existe.

## Primera vez
```bash
./setup.sh          # crea apps/mobile (Expo SDK estable), superpone la plantilla, instala y ejecuta lint/typecheck/tests
npm run mobile      # sirve data/public en local y arranca Expo
```
`npm run mobile` levanta un servidor estático de solo lectura sobre `data/public` (puerto 8000) y arranca Expo. La app deriva la URL del host de Metro, así que en desarrollo siempre enseña los datos locales; para apuntar a GitHub Pages, define `EXPO_PUBLIC_DATA_BASE_URL` en `apps/mobile/.env` (ver `.env.example`). El marcador en directo es opcional: define `EXPO_PUBLIC_LIVE_BASE_URL` con la URL del Worker de `workers/live-proxy`; sin ella no se hacen peticiones en directo.

El proyecto usa **Expo SDK 58** (React Native 0.88), el SDK que soporta Expo Go actualmente. Para probar en iPhone con un SDK recién salido, Expo Go de la App Store puede ir por detrás: usa un development build (EAS) o `eas go`.

## Scripts de datos
```bash
python -m venv .venv && source .venv/bin/activate
pip install -e "scripts[dev]"

python -m depor_hub.cli probe                       # comprueba la API y la cobertura
python -m depor_hub.cli ingest                      # actualiza data/public/v1
python -m depor_hub.cli ingest --if-due             # refresca solo si toca (10 min en partido, 60 min fuera)
python -m depor_hub.cli schemas                     # regenera packages/schemas
python -m depor_hub.cli enrich                      # propone carrera/estadísticas/escudos (no aplica)
python -m depor_hub.cli enrich --apply              # aplica y actualiza el JSON público
python -m depor_hub.cli enrich --apply --offline    # repite desde data/raw/enrich
python -m depor_hub.cli enrich --apply --no-crests  # sin resolver escudos
python -m depor_hub.cli coach                       # regenera la ficha del entrenador y el staff
python -m depor_hub.cli coach --apply               # aplica entrenador y staff al JSON público
python -m depor_hub.cli news audit                  # prueba los feeds y muestra la tabla
python -m depor_hub.cli news audit --write-docs     # actualiza docs/sources.md y el catálogo
python -m depor_hub.cli news                        # publica news.json
python -m depor_hub.cli news --report               # informe de relevancia y clústeres
python -m depor_hub.cli news --offline              # repite desde data/raw/news sin red
python -m depor_hub.cli social                      # regenera social.json desde social_pins.yml
python -m depor_hub.cli club                        # publica club.json y docs/kits_coverage.md
python -m depor_hub.cli club-images                 # descarga y normaliza las imágenes locales del club
python -m depor_hub.cli club-images --offline       # comprueba las imágenes ya presentes sin red
python -m depor_hub.cli status                      # resume la salud del pipeline (ADR 0027)
python -m depor_hub.cli match-details               # publica alineaciones y eventos de partidos terminados
```

El enriquecimiento usa BDFutbol (carrera, temporadas, totales, peso y partidos), Wikipedia ES/GL/EN (dorsal, contrato, cesión, altura), Wikidata (lugar, altura, pie, dorsal y redes) y la ficha oficial del club (altura, pie, foto y redes; autoritativa cuando existe). Cada dato va con fuente y confianza; los conflictos quedan visibles en `data/manual/squad_enrich.proposed.yml`. La foto de perfil es siempre la que publica el club, enlazada con crédito editorial y sin guardar binarios. Las cesiones de salida (`loanTo`) y las redes que no publica ninguna fuente automática viven en `data/manual/squad_overrides.yml` (`--overrides`).

Los escudos de la trayectoria y de los rivales se resuelven con prioridad football-data.org (fixtures) → Wikidata `P154` + Wikimedia Commons (96 px) → overrides `data/manual/club_crests.yml` → respaldo de Wikipedia. Si no hay una fuente inequívoca, el campo queda en `null` y la app pinta un monograma; no se inventan URLs. Detalles en [`docs/sources.md`](docs/sources.md), [`docs/adr/0008-enriquecimiento-fuentes-libres.md`](docs/adr/0008-enriquecimiento-fuentes-libres.md), [`docs/adr/0009-fotos-y-fuente-oficial.md`](docs/adr/0009-fotos-y-fuente-oficial.md), [`docs/adr/0010-cesion-de-salida.md`](docs/adr/0010-cesion-de-salida.md), [`docs/adr/0011-rediseno-equipo-y-ficha.md`](docs/adr/0011-rediseno-equipo-y-ficha.md), [`docs/adr/0012-escudos-de-clubes.md`](docs/adr/0012-escudos-de-clubes.md), [`docs/adr/0014-entrenador-y-cuerpo-tecnico.md`](docs/adr/0014-entrenador-y-cuerpo-tecnico.md), [`docs/adr/0015-inicio-y-cadencia-adaptativa.md`](docs/adr/0015-inicio-y-cadencia-adaptativa.md), [`docs/adr/0018-noticias-curacion-dedupe-filtros.md`](docs/adr/0018-noticias-curacion-dedupe-filtros.md) y [`docs/adr/0026-club-contrato-imagenes-himnos.md`](docs/adr/0026-club-contrato-imagenes-himnos.md).

La ficha del entrenador (`/coach`) se genera con Wikidata `Q602465`, Wikipedia ES y la web oficial del club: datos personales, trayectoria como jugador y entrenador, foto oficial y cuerpo técnico. El balance se calcula en la app desde `fixtures.json` y solo cuenta partidos terminados. `data/manual/coach.yml` es la salida revisable; no se publica un miembro del staff ni una etapa que no esté en una fuente identificable.

La ficha de un partido terminado usa `fixtures.json` (o el snapshot congelado si el partido ya no está) y, cuando existe, `match-details/<season>/<matchId>.json` (ADR 0031). Ese detalle publica alineaciones, entrenadores, goles, tarjetas y cambios leídos de BDFutbol; no incluye fotos, escudos, textos, estadísticas ni eventos deducidos del marcador. Si la ficha no existe, la app mantiene el aviso honesto. El responsable asumió el riesgo legal el 05-nov-2026 tras el [informe](docs/bdfutbol-legal-risk.md).

Las noticias salen de **cinco fuentes curadas** (`data/manual/news_feeds.yml`): Riazor.org, DXT Campeón, La Voz de Galicia, Marca y el canal oficial de YouTube. Solo se publica lo que entrega el feed: nunca se descarga el cuerpo del artículo ni se rodean bloqueos. El filtro de relevancia descarta otros «Deportivo» y los titulares que solo se apoyan en el extracto; la deduplicación agrupa cada historia entre medios (principal por prioridad y antigüedad, resto en `alsoIn`) y la ventana es de 14 días con un máximo de 150 historias. Las cinco fuentes viajan dentro de `news.json`; `social.json` solo contiene perfiles oficiales verificados y los pins se curan a mano. Detalles en [`docs/adr/0018-noticias-curacion-dedupe-filtros.md`](docs/adr/0018-noticias-curacion-dedupe-filtros.md).

La pestaña **Club** se alimenta de `data/manual/club.yml` y de las letras de `data/manual/himnos/*.txt` (ADR 0026). Cubre identidad, tres himnos con letra y créditos, 14 versiones del escudo, 42 temporadas de equipaciones (44 equipaciones), estadio con aforo desglosado (**33.225**), museo, ciudad deportiva, junta, patrocinadores, palmarés, rivalidades y enlaces. El contrato **no publica fuente, confianza ni estado de verificación**: esos datos viven en los YAML, en los comentarios y en [`docs/sources.md`](docs/sources.md). Lo desconocido es `null`; no se inventan fechas, dorsales, patrocinadores ni equipaciones.

Las imágenes del club son las únicas que se guardan en el repositorio: `data/public/v1/img/club/` tiene **15 ficheros y 2.416.456 bytes (2,30 MiB)**. El JSON solo guarda rutas relativas y la app las resuelve con `clubImageUrl`; si falta una imagen o falla la carga, se pinta un marcador del mismo tamaño. Solo la equipación local 2026-27 tiene foto real; el resto queda pendiente y así se refleja en [`docs/kits_coverage.md`](docs/kits_coverage.md). Las letras y nombres propios no se traducen.

Ajustes añade el borrado de la caché de datos (solo TanStack Query, no ajustes ni recordatorios), la versión de la app, `meta.dataHash`/`updatedAt` y el acceso a **Acerca de**. Acerca de muestra el aviso de proyecto no oficial, el contacto y las licencias de terceros generadas con `npm run licenses` desde `package-lock.json` (1.052 paquetes en 16 grupos). No se lista ninguna fuente de datos.

## Verificación H5.3
Las fuentes libres empaquetadas suman 776.496 bytes. No se midió el arranque en gama media; el splash permanece visible mientras `expo-font` las carga. El escudo remoto solo se usa dentro de Inicio, con aviso no oficial; icono y splash siguen con DH. No se necesita `API_FOOTBALL_KEY`.

## Comprobaciones
```bash
ruff check scripts && pytest scripts
python -m depor_hub.cli schemas && git diff --exit-code packages/schemas
npm run lint && npm run typecheck && npm test
npm run licenses && git diff --exit-code apps/mobile/src/data/licenses.json
python -m depor_hub.cli club                # idempotente: la segunda pasada da changed=false
(cd workers/live-proxy && npm test)         # pruebas del proxy en directo
```

## Secretos
Ver `.env.example`. El token de football-data.org vive solo en GitHub Secrets (`FOOTBALL_DATA_TOKEN`). `CONTACT_EMAIL` se configura como variable de Actions para el User-Agent de las peticiones.

## Estado
H0 (andamiaje), H1 (contratos y datos), H2 (capa de datos), H3 (calendario), H4 (plantilla + ficha enriquecida, rediseño de Equipo/ficha, escudos de clubes, entrenador y cuerpo técnico), H5.3 (Inicio Cartel + Prensa, ficha de rival e historias agrupadas), H6 (noticias, vídeos y redes curadas) y H7 (club, ajustes y acerca de) hechos. Fase 2: H0.1 (sincronización con `main`), H0.2 (salud del pipeline y `status.json`), el Hito 1 visible (ficha de partido con ciclo de vida y degradación honesta), H3.5 (snapshots congelados de partidos terminados), H2 (iconos de fuentes), el detalle de partido con BDFutbol (ADR 0031) y el proxy en directo (Cloudflare Worker + fusión en la app) hechos. Para cerrar el Hito 4 falta desplegar el Worker y definir `EXPO_PUBLIC_LIVE_BASE_URL`; mientras tanto la app funciona con los datos estáticos, los snapshots y el detalle de BDFutbol. Hoja de ruta y cobertura actual en [`docs/ESTADO.md`](docs/ESTADO.md); decisiones en [`docs/adr/`](docs/adr/) y operación en [`docs/operations.md`](docs/operations.md).
