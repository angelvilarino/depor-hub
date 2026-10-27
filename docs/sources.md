# Fuentes de datos (obligatorio antes de automatizar ingestas)

Regla general: solo datos públicos, con User-Agent identificable y contacto (`CONTACT_EMAIL`), respeto de `robots.txt`, ritmo entre peticiones, caché local en `data/raw/` y **ningún intento de saltar 403, 429, captchas o muros de pago**. Si una fuente bloquea, se documenta y se sigue sin ella.

## Fuentes en uso

| Fuente | Aporta | Términos / robots | Frecuencia | Estado |
|---|---|---|---|---|
| **football-data.org** (plan gratuito) | Clasificación, partidos, plantilla y entrenador (PD) | Pendiente de revisar términos y atribución | Adaptativa: cada 10 min entre −30 min y +3 h del kickoff; cada 60 min fuera (ADR 0015). Escribe solo si cambia el contenido | En uso. Cobertura 2026-27 en «Sondeo» |
| **BDFutbol** (`bdfutbol.com`) | Trayectoria por club y temporada, totales, dorsal de la temporada actual, partidos con el Depor (minutos, goles, tarjetas, marcador) | `robots.txt` permite `/es/`; HTML público. Reutilización pendiente de revisión; solo se guardan hechos, no se redistribuye HTML | Manual / `enrich`; caché en `data/raw/enrich/` | En uso. HTTP 200 en las pruebas del 25-oct-2026 |
| **Wikipedia ES/EN** (`es.wikipedia.org`, `en.wikipedia.org`) | Dorsal, contrato, procedencia, cesión, altura, peso y lugar de nacimiento; trayectoria del entrenador como jugador y como entrenador | CC BY-SA; se extraen hechos, no texto | Manual / `enrich` | En uso. Se recorren los sitelinks ES/GL/EN de Wikidata; la fecha de nacimiento desambigua |
| **Wikidata** (`www.wikidata.org`, API de entidades) | Lugar de nacimiento, altura, pie (`P8006`), dorsal con `P54=Q8760`, redes, alias, imagen (`P18`) y sitelinks; entrenador `Q602465` (`P569`, `P19`, `P27`) | CC0 | Manual / `enrich` | En uso |
| **Wikimedia Commons** (`commons.wikimedia.org`, API `imageinfo`) | Miniaturas de escudos de club a 96 px y metadatos de imágenes | CC BY-SA / CC0 según la ficha; solo se enlaza, no se copia | Manual / `enrich` | En uso para escudos (ADR 0012). **No se usa para fotos de jugador**: solo la foto oficial del club (ADR 0009) |
| **Web oficial del club** (`rcdeportivo.es/es/depor`, `/depor-fabril` y ficha del entrenador) | Altura, fecha de nacimiento, pie, foto, redes y ficha autoritativa; foto oficial del entrenador y cuerpo técnico | HTML público; solo se guardan hechos y URLs | Manual / `enrich` | En uso por defecto. `--no-official`, `--no-fabril` |
| `data/manual/squad_overrides.yml` | Redes aportadas por el usuario, cesión de salida y contratos publicados en notas del club | Solo enlaces/handles públicos aportados; sin scrapeo de perfiles privados | Manual | En uso (12 jugadores) |
| `data/manual/club_crests.yml` | Escudos que no resuelven fixtures ni Wikidata | Solo URL y fuente reales; nunca se inventa ni se deduce un id | Manual | En uso (RB Leipzig, escudo apaisado) |
| `data/manual/coach.yml` | Salida generada de la ficha del entrenador y del cuerpo técnico | Se revisa antes de aplicar; no se inventan etapas ni miembros | Manual / `coach` | En uso (Antonio Hidalgo, 15 etapas, 21 miembros) |
| **RSS de medios** | Titular, fuente, fecha, enlace | Pendiente por medio | 30-60 min | Auditoría en H6 |
| `data/manual/club.yml` | Datos del club | Elaboración propia con fuente | Manual | H7 |

### Fuentes descartadas para el enriquecimiento (H4)

| Fuente | Motivo |
|---|---|
| **Transfermarkt** | Devuelve 202/bloqueo; no se intenta rodear |
| **FBref** | 403 de Cloudflare |
| **LaLiga** | `Crawl-delay: 30`; no se usa como dependencia |

## Cadencia de la ingesta

`python -m depor_hub.cli ingest --if-due` decide antes de tocar la red:

- **Ventana de partido:** desde 30 min antes del kickoff hasta 3 h después, para `TIMED`, `IN_PLAY` y `PAUSED`. Refresco cada 10 min.
- **Fuera de la ventana:** refresco cada 60 min.
- **Sin fixtures o sin estado previo:** refresca.
- **Si no toca:** termina con `changed=false due=false` y no hace peticiones.

El último refresco se guarda en `data/raw/ingest_state.json` (no se deduce de `updatedAt`, que solo cambia cuando cambia el contenido). El workflow `Data refresh` se ejecuta cada 10 min, restaura y guarda ese fichero con `actions/cache` y respeta el límite de 10 peticiones/minuto porque hace una sola pasada por ejecución. `workflow_dispatch` permite forzar con `force`.

## Etiqueta y límites aplicados

- User-Agent: `DeporHubBot/0.1 (+https://github.com/angelvilarino/depor-hub; contacto: …)`.
- Al menos 1 s entre peticiones al mismo host (`--interval`); por defecto en `enrich`.
- `robots.txt` se consulta antes de cada GET HTML.
- 403, 429, 202 (captcha) o `robots.txt` denegando ⇒ se aborta esa fuente con `SourceBlocked` y se registra el motivo.
- Reintentos solo para red y 5xx, con espera creciente. Nunca para bloqueos.
- Caché: `data/raw/enrich/` (ignorada por git). `--offline` solo lee caché.

## Emparejamiento

La clave es la **fecha de nacimiento** de football-data.org + nombre normalizado:

- BDFutbol: búsqueda por nombre y fecha exacta, también en la ficha; si la fecha no coincide no se cae al nombre. 0 o varias coincidencias ⇒ no se asigna.
- Wikipedia: fecha exacta; si no coincide, no se usa aunque el nombre sea único. Se prueban ES, GL y EN.
- Wikidata: búsqueda + fecha exacta; si hay varias, descripción de fútbol. Sin coincidencia única, no se usa.
- Web oficial: fecha exacta y, si hay varias fichas con la misma fecha, coincidencia de algún token del nombre. Se deduplica por `(fecha, foto)` porque el mismo jugador aparece en `/depor` y `/depor-fabril`.

## Fotos y licencias

- Solo se usa **la foto que publica el club** en la ficha oficial del jugador (o en la noticia oficial de presentación si no tiene ficha). Es la foto de perfil y la única que se aplica.
- Se marca con `Uso editorial del club (sin licencia de reutilización)` y `© RC Deportivo de La Coruña`; no se relicencia.
- La app muestra siempre la atribución y un enlace a `sourceUrl`. Si la URL falla o el formato no se decodifica, se usa el avatar de iniciales.
- El CDN oficial sirve HEIF aunque la URL acabe en `.jpg`; `expo-image` lo soporta en iOS y Android modernos.
- Las imágenes **no** se guardan en el repositorio: solo la URL y sus metadatos.

## Escudos de clubes

Los escudos de la trayectoria (`CareerEntry.crestUrl`) y de los partidos (`PlayerMatch.opponentCrestUrl`) se resuelven en este orden:

1. **football-data.org**: equipos de `data/public/v1/fixtures.json` por nombre o nombre corto. Es la misma fuente que usa el calendario.
2. **Wikidata + Wikimedia Commons**: búsqueda en ES/EN, entidad inequívoca con `P31` de club/equipo de fútbol (`Q476028`, `Q15944511` o `Q103229495`), `P154` (logo) y miniatura de Commons a **96 px**. Se descartan entidades femeninas, de otros deportes, desaparecidas (`P576`) y filiales/reservas cuando se busca al primer equipo.
3. **`data/manual/club_crests.yml`**: overrides manuales, solo con URL y fuente reales. Se aplican después de `P154` y antes del respaldo de Wikipedia para corregir falsos positivos (por ejemplo, RB Leipzig, cuyo escudo es apaisado).
4. **Respaldo de Wikipedia**: si `P154` no da una imagen válida, se usa la imagen del infobox del artículo como señal principal; el respaldo puntuado por imágenes del artículo solo acepta candidatos con identidad de club y forma de escudo. Los ficheros locales no libres se enlazan con `Special:FilePath/<fichero>?width=96`.

Reglas conservadoras:

- Un club senior sin `P154` no hereda el escudo de una matriz; un filial/reserva sí puede heredarlo. Los patrones de filial están centralizados en `_RESERVE_PATTERNS`.
- Si `P154` existe pero Commons no da una URL legible, no se usa el escudo de la matriz.
- Se rechazan imágenes con relación de aspecto fuera de 0,4–1,4: `P154` puede contener por error una foto de partido o de aficionados. Es preferible un monograma.
- La caché `data/raw/enrich/crests.json` guarda también los `null` y se invalida por `mtime` de fixtures/overrides. Antes de una pasada online real hay que borrarla si se hicieron pasadas `--offline`.
- Los escudos son **marcas de sus clubes**. El usuario asume el riesgo de usarlos como ilustración editorial; no se usa el escudo del Depor como logo de la app. Si Wikimedia limita el hotlinking o cambia sus términos, se deja de usar esa vía y se avisa.
- No se guardan binarios: solo URLs externas y, si aplica, su atribución.

## Entrenador y cuerpo técnico

La ficha `/coach` se alimenta de tres fuentes y cada dato conserva su procedencia:

1. **Wikidata `Q602465`** (Antonio Hidalgo): fecha de nacimiento (`P569`), lugar (`P19`) y nacionalidad (`P27`). La nacionalidad estructurada tiene prioridad; el lugar de Wikipedia manda sobre el de Wikidata porque la ficha oficial y la wikipedia local son más precisas.
2. **Wikipedia ES** (`Antonio Hidalgo Morilla`): datos del infobox y tablas de «Como jugador» y «Como entrenador». Cada etapa lleva `role` (`player`/`coach`), club, años, partidos y goles. Las filas contiguas del mismo club y rol se unifican al parsear y otra vez en la app (`mergeCareerPeriods`).
3. **Web oficial** (`https://www.rcdeportivo.es/es/depor` y la ficha del entrenador): foto oficial y cuerpo técnico. La foto sale de `og:image` y se le quita el recorte social (`?rect=…&w=…`). El staff solo se publica si aparece en la web oficial; las claves son estables (`head_coach`, `assistant_coach`, `goalkeeping_coach`, `fitness_coach`, `rehab_coach`, `physiotherapist`, `doctor`, `nutritionist`, `psychologist`, `podiatrist`, `analyst`, `delegate`, `kit_manager`).

Reglas:

- El nombre y la nacionalidad de football-data.org no se pisan.
- El balance del entrenador **no se guarda**: la app lo calcula con `coachRecord` desde `fixtures.json`, solo con partidos `FINISHED` y, si hay `since`, desde ese año. No se presenta como histórico completo.
- `data/manual/coach.yml` es la salida generada y revisable de `python -m depor_hub.cli coach`; `--apply` la lleva a `data/public/v1`, y `ingest`/`enrich --apply` la aplican con `--coach`.
- `apply_coach` rellena solo huecos y `reset_coach` retira solo lo que puso el enriquecimiento. La segunda pasada es idempotente (`changed=false`).
- Si la web oficial cambia el HTML, el parser devuelve una lista vacía y la app no muestra la sección: no se rellena con terceros.
- La foto es del club y se enlaza con atribución editorial, igual que las de los jugadores (ADR 0009). No se guardan binarios.

## Cobertura del enriquecimiento — 26-oct-2026

Ejecución `enrich --apply --offline` sobre 28 jugadores: **0 errores, 37 conflictos** (no aplicados o aplicados con la resolución visible en `data/manual/squad_enrich.proposed.yml`).

| Campo | Cobertura |
|---|---|
| Dorsal | 28/28 |
| Contrato | 28/28 (24 generadas + 4 overrides) |
| Altura | 28/28 |
| Peso | 25/28 |
| Lugar de nacimiento | 28/28 |
| Pie preferido | 28/28 (27 generadas + 1 override) |
| Fotos | 28/28 (solo la oficial del club) |
| Cesión (`loanFrom`) | 3/28 |
| Cesión de salida (`loanTo`) | 1/28 (Teun → Al Ain, nota oficial) |
| Carrera | 28/28 |
| Totales de carrera | 28/28 |
| Partidos con el Depor | 28/28 |
| Escudos de carrera | 156/156 entradas (75/75 clubes distintos) |
| Escudos de rivales | 1229/1262 partidos (76/82 rivales distintos; los 20 de LaLiga, al 100 %) |
| Entrenador | Ficha completa (nombre, nacimiento, lugar, nacionalidad, foto, `since`) |
| Trayectoria del entrenador | 15 etapas (jugador y entrenador) con escudo |
| Cuerpo técnico | 21 miembros publicados por la web oficial |
| Redes sociales | 27/28 (19 generadas + 8 aportadas por el usuario) |
| Valor de mercado | 0/28 (solo manual; siempre «Estimación») |

Los 6 rivales sin escudo son históricos de Segunda B (Covadonga, Linares, SD Logroñés, San Fernando CD, UD Logroñés y Zamora); se quedan en `null` y la app pinta un monograma. No se completan con una URL sin fuente. Los huecos no se rellenan sin fuente. Los conflictos se revisan a mano y se documentan en el YAML de propuesta. Los datos manuales que deben sobrevivir a una regeneración viven en `data/manual/squad_overrides.yml` (no en `squad_extras.yml`, que es salida generada).

La salida de `enrich` cuenta solo lo generado: los overrides se suman al aplicar (`--apply`). Por eso el comando muestra 24/28 contratos, 27/28 pies, 27/28 fotos y 19/28 redes, mientras el JSON final tiene 28/28 en los tres primeros campos y 27/28 redes (las 8 que faltaban vienen de overrides). La cesión de salida (`loanTo`) también es manual y no aparece en el recuento generado.

## Sondeo football-data.org — 20-oct-2026

- Plan gratuito con acceso a PD (LaLiga) 2026-27; **sin Copa del Rey (CDR)**.
- Depor: id 560, tla DEP. Plantilla 28 jugadores: posición, nacimiento y nacionalidad 28/28; dorsal y contrato 0/28 en la API.
- 38 partidos del Depor en la respuesta (9 terminados al ingerir), jornada actual 9. Fechas futuras pueden venir a las 00:00 UTC (hora sin confirmar).

## Sondeo football-data.org — 22-oct-2026

- Escudo 20/20 equipos; estadio 20/20 equipos; sede por partido 0/380 (se usa el estadio del local); árbitro 73/380 partidos.

## Comandos

```bash
python -m depor_hub.cli enrich                       # propuesta, sin aplicar
python -m depor_hub.cli enrich --apply               # aplica y actualiza data/public/v1
python -m depor_hub.cli enrich --apply --offline     # repite desde data/raw/enrich
python -m depor_hub.cli enrich --no-photos           # sin ninguna foto
python -m depor_hub.cli enrich --no-official         # sin web oficial
python -m depor_hub.cli enrich --no-fabril           # sin la plantilla del filial
python -m depor_hub.cli enrich --overrides RUTA      # overrides manuales (por defecto data/manual/squad_overrides.yml)
python -m depor_hub.cli coach                        # regenera data/manual/coach.yml
python -m depor_hub.cli coach --apply                # aplica entrenador y staff
python -m depor_hub.cli enrich --apply --coach data/manual/coach.yml
```

El workflow `Enrich proposal` (`.github/workflows/enrich.yml`) es manual y solo sube el informe como artefacto. No hace commit.

## Previsualización local de la app

```bash
npm run mobile
```

Arranca Expo y un servidor estático de solo lectura sobre `data/public` (puerto 8000). La app deriva la URL del host de Metro; no hay IPs fijas. Para usar los datos publicados, define `EXPO_PUBLIC_DATA_BASE_URL` en `apps/mobile/.env`. Detalles en `docs/adr/0009-fotos-y-fuente-oficial.md`.
