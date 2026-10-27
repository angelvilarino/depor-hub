# Depor Hub (no oficial)
Proyecto de aficionados sin vinculación oficial con el Real Club Deportivo de La Coruña, S.A.D.

App Expo (React Native + TypeScript) con datos públicos del Depor: inicio con próximo partido, último resultado, temporada y clasificación, calendario, plantilla y ficha de jugador enriquecida, con foto y atribución. Los datos se publican como JSON estático en GitHub Pages; la app no contiene claves.

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
`npm run mobile` levanta un servidor estático de solo lectura sobre `data/public` (puerto 8000) y arranca Expo. La app deriva la URL del host de Metro, así que en desarrollo siempre enseña los datos locales; para apuntar a GitHub Pages, define `EXPO_PUBLIC_DATA_BASE_URL` en `apps/mobile/.env` (ver `.env.example`).

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
```

El enriquecimiento usa BDFutbol (carrera, temporadas, totales, peso y partidos), Wikipedia ES/GL/EN (dorsal, contrato, cesión, altura), Wikidata (lugar, altura, pie, dorsal y redes) y la ficha oficial del club (altura, pie, foto y redes; autoritativa cuando existe). Cada dato va con fuente y confianza; los conflictos quedan visibles en `data/manual/squad_enrich.proposed.yml`. La foto de perfil es siempre la que publica el club, enlazada con crédito editorial y sin guardar binarios. Las cesiones de salida (`loanTo`) y las redes que no publica ninguna fuente automática viven en `data/manual/squad_overrides.yml` (`--overrides`).

Los escudos de la trayectoria y de los rivales se resuelven con prioridad football-data.org (fixtures) → Wikidata `P154` + Wikimedia Commons (96 px) → overrides `data/manual/club_crests.yml` → respaldo de Wikipedia. Si no hay una fuente inequívoca, el campo queda en `null` y la app pinta un monograma; no se inventan URLs. Detalles en [`docs/sources.md`](docs/sources.md), [`docs/adr/0008-enriquecimiento-fuentes-libres.md`](docs/adr/0008-enriquecimiento-fuentes-libres.md), [`docs/adr/0009-fotos-y-fuente-oficial.md`](docs/adr/0009-fotos-y-fuente-oficial.md), [`docs/adr/0010-cesion-de-salida.md`](docs/adr/0010-cesion-de-salida.md), [`docs/adr/0011-rediseno-equipo-y-ficha.md`](docs/adr/0011-rediseno-equipo-y-ficha.md), [`docs/adr/0012-escudos-de-clubes.md`](docs/adr/0012-escudos-de-clubes.md), [`docs/adr/0014-entrenador-y-cuerpo-tecnico.md`](docs/adr/0014-entrenador-y-cuerpo-tecnico.md) y [`docs/adr/0015-inicio-y-cadencia-adaptativa.md`](docs/adr/0015-inicio-y-cadencia-adaptativa.md).

La ficha del entrenador (`/coach`) se genera con Wikidata `Q602465`, Wikipedia ES y la web oficial del club: datos personales, trayectoria como jugador y entrenador, foto oficial y cuerpo técnico. El balance se calcula en la app desde `fixtures.json` y solo cuenta partidos terminados. `data/manual/coach.yml` es la salida revisable; no se publica un miembro del staff ni una etapa que no esté en una fuente identificable.

## Comprobaciones
```bash
ruff check scripts && pytest scripts
python -m depor_hub.cli schemas && git diff --exit-code packages/schemas
npm run lint && npm run typecheck && npm test
```

## Secretos
Ver `.env.example`. El token de football-data.org vive solo en GitHub Secrets (`FOOTBALL_DATA_TOKEN`). `CONTACT_EMAIL` se configura como variable de Actions para el User-Agent de las peticiones.

## Estado
H0 (andamiaje), H1 (contratos y datos), H2 (capa de datos), H3 (calendario), H4 (plantilla + ficha enriquecida, rediseño de Equipo/ficha, escudos de clubes, entrenador y cuerpo técnico) y H5 (inicio real + cadencia adaptativa) hechos. Siguiente: H6 (noticias). Hoja de ruta y cobertura actual en [`docs/ESTADO.md`](docs/ESTADO.md); decisiones en [`docs/adr/`](docs/adr/).
