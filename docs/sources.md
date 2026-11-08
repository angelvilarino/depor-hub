# Fuentes de datos (obligatorio antes de automatizar ingestas)

Regla general: solo datos públicos, con User-Agent identificable y contacto (`CONTACT_EMAIL`), respeto de `robots.txt`, ritmo entre peticiones, caché local en `data/raw/` y **ningún intento de saltar 403, 429, captchas o muros de pago**. Si una fuente bloquea, se documenta y se sigue sin ella.

## Fuentes en uso

| Fuente | Aporta | Términos / robots | Frecuencia | Estado |
|---|---|---|---|---|
| **football-data.org** (plan gratuito) | Clasificación, partidos, plantilla y entrenador (PD) | Pendiente de revisar términos y atribución | Adaptativa: cada 10 min entre −30 min y +3 h del kickoff; cada 60 min fuera (ADR 0015). Escribe solo si cambia el contenido | En uso. Cobertura 2026-27 en «Sondeo» |
| **BDFutbol** (`bdfutbol.com`) | Trayectoria por club y temporada, totales, dorsal de la temporada actual, partidos con el Depor (minutos, goles, tarjetas, marcador), detalle de partidos terminados (alineaciones, entrenadores, goles, tarjetas y cambios) y, con `club titles --details`, finales, plantillas y goleadores de las temporadas con título | `robots.txt` permite `/es/`; HTML público. Solo se guardan hechos, no se redistribuye HTML, fotos ni escudos. **Riesgo alto asumido por el responsable el 05-nov-2026 para el detalle de partido; ver [informe legal](bdfutbol-legal-risk.md) y [ADR 0031](adr/0031-detalle-partido-bdfutbol.md)** | Manual / `enrich` / `match-details`; caché en `data/raw/enrich/` | En uso. HTTP 200 en las pruebas del 05-nov-2026 |
| **Wikipedia ES/EN** (`es.wikipedia.org`, `en.wikipedia.org`) | Dorsal, contrato, procedencia, cesión, altura, peso y lugar de nacimiento; trayectoria del entrenador como jugador y como entrenador; ficha de la final de Copa para contrastar fecha, marcador, sede, árbitro y goleadores | CC BY-SA; se extraen hechos, no texto | Manual / `enrich` / `club titles --details` | En uso. Se recorren los sitelinks ES/GL/EN de Wikidata; la fecha de nacimiento desambigua |
| **Wikidata** (`www.wikidata.org`, API de entidades) | Lugar de nacimiento, altura, pie (`P8006`), dorsal con `P54=Q8760`, redes, alias, imagen (`P18`) y sitelinks; entrenador `Q602465` (`P569`, `P19`, `P27`) | CC0 | Manual / `enrich` | En uso |
| **Wikimedia Commons** (`commons.wikimedia.org`, API `imageinfo`) | Miniaturas de escudos de club a 96 px y metadatos de imágenes | CC BY-SA / CC0 según la ficha; solo se enlaza, no se copia | Manual / `enrich` | En uso para escudos (ADR 0012). **No se usa para fotos de jugador**: solo la foto oficial del club (ADR 0009) |
| **Web oficial del club** (`rcdeportivo.es/es/depor`, `/depor-fabril` y ficha del entrenador) | Altura, fecha de nacimiento, pie, foto, redes y ficha autoritativa; foto oficial del entrenador y cuerpo técnico | HTML público; solo se guardan hechos y URLs | Manual / `enrich` | En uso por defecto. `--no-official`, `--no-fabril` |
| `data/manual/squad_overrides.yml` | Redes aportadas por el usuario, cesión de salida y contratos publicados en notas del club | Solo enlaces/handles públicos aportados; sin scrapeo de perfiles privados | Manual | En uso (12 jugadores) |
| `data/manual/club_crests.yml` | Escudos que no resuelven fixtures ni Wikidata | Solo URL y fuente reales; nunca se inventa ni se deduce un id | Manual | En uso (RB Leipzig, escudo apaisado) |
| `data/manual/coach.yml` | Salida generada de la ficha del entrenador y del cuerpo técnico | Se revisa antes de aplicar; no se inventan etapas ni miembros | Manual / `coach` | En uso (Antonio Hidalgo, 15 etapas, 21 miembros) |
| **RSS/Atom de medios y YouTube** | Titular, fuente, fecha, miniatura y resumen tal como los publica el feed; nunca el cuerpo del artículo | Solo lo que el feed entrega; User-Agent identificable, 1 s por dominio y `ETag`/`If-Modified-Since`. Los 403/406/429 se documentan y no se rodean | Cada 30 min; 14 días de ventana | En uso: 5 fuentes curadas y 0 errores en la calibración del 29-oct-2026 (tabla en «Noticias») |
| `data/manual/club.yml` | Identidad, himnos (metadatos y créditos), escudos, equipaciones, estadio y aforo, museo, ciudad deportiva, junta, patrocinadores, títulos, rivalidades, hechos y enlaces | Elaboración propia con fuente en cada bloque; el contrato público no expone procedencia | Manual / `club` | En uso (H7). 42 temporadas, 44 equipaciones, 14 escudos |
| `data/manual/himnos/*.txt` | Letras de los himnos tal como las publica el club; solo se publica el bloque posterior a `Letra` | Texto público; los créditos se modelan en `club.yml`, no se mezclan con la letra | Manual / `club` | En uso (H7). «Voa», «Fillos de Breogán» y «El Rock del Deportivo» |
| `data/manual/club_images.yml` | URLs y fuente de los 14 escudos históricos y de la equipación local 2026-27 | Solo para imágenes de consulta pública; se normalizan y se guardan en local con la ruta relativa | Manual / `club-images` | En uso (H7). 15 ficheros, 2.416.456 bytes |

### Fuentes descartadas para el enriquecimiento (H4)

| Fuente | Motivo |
|---|---|
| **Transfermarkt** | Devuelve 202/bloqueo; no se intenta rodear |
| **FBref** | 403 de Cloudflare |
| **LaLiga** | `Crawl-delay: 30`; no se usa como dependencia |

## Noticias (ADR 0018)

Catálogo curado de cinco fuentes. La calibración del 29-oct-2026 midió cada feed con el filtro real; el detalle y las once fuentes descartadas viven en `data/manual/news_feeds.yml` y en el [ADR 0018](adr/0018-noticias-curacion-dedupe-filtros.md).

<!-- news-audit:start -->
Auditoría de referencia: **29-Oct-2026 10:00 UTC**. `Relevantes` aplica el filtro del Depor de ADR 0018; es una foto de calibración, no un refresco en vivo.

| Fuente | Grupo | Feed | Estado | Ítems | Relevantes | Más reciente | Imagen | Resumen | Nota |
|---|---|---|---|---:|---:|---|---:|---:|---|
| RC Deportivo (YouTube) | club | https://www.youtube.com/feeds/videos.xml?channel_id=UCY2s1XaPzO60Hu6M_YZCTgA | ok | 15 | 15 | 2026-10-28 09:18Z | 15/15 | 2/15 | Canal oficial. Excepción expresa al RSS de YouTube (ADR 0018). |
| Riazor.org | galicia | https://www.riazor.org/feed/ | ok | 25 | 14 | 2026-10-29 08:00Z | 5/25 | 25/25 | Medio independiente centrado en el Depor; `robots.txt` permite `/feed/$`. |
| DXT Campeón | galicia | https://dxtcampeon.elidealgallego.com/rss | ok | 33 | 13 | 2026-10-29 04:00Z | 33/33 | 33/33 | Sección deportiva del Ideal Gallego; el filtro descarta el deporte local no-Depor. |
| La Voz de Galicia | galicia | https://www.lavozdegalicia.es/temas/deportivo/index.xml | ok | 19 | 8 | 2026-10-29 04:00Z | 19/19 | 16/19 | Feed de tema Deportivo, no la portada de Deportes. |
| Marca | nacional | https://www.marca.com/rss/googlenews/futbol/deportivo.xml | ok | 50 | 14 | 2026-10-29 09:52Z | 48/50 | 50/50 | Único nacional con feed directo del Depor; mezcla otros equipos y no es `depor_specific`. |

Los feeds con error se deshabilitan en `data/manual/news_feeds.yml`. No se intenta saltar 403/429/captchas ni muros de pago.
<!-- news-audit:end -->

### Fuentes descartadas

| Fuente | Motivo | Respaldo |
|---|---|---|
| **Web oficial del club** | Sin RSS/Atom propio (`/feed`, `/rss` y `/rss.xml` dan 404); no se hace scraping HTML | Canal de YouTube |
| **Diario AS** | HTTP 403 para el User-Agent identificable | Ninguno: no se rodea |
| **Sport** | HTTP 406 (WAF) | Ninguno |
| **Cadena SER** | HTTP 403 para el User-Agent identificable | Ninguno |
| **COPE** | Feed de portada: 0/20 relevantes en la muestra de 7 días | Ninguno |
| **Galiciapress** | Feed general: 0/50 relevantes | Ninguno |
| **El Ideal Gallego (Deportes)** | Portada de deportes: 2/61 relevantes; DXT ya cubre la sección del Depor | DXT Campeón |
| **Diario de Ferrol** | Feed local: 1/38 relevantes | Ninguno |
| **Relevo** | El tag «deportivo» mezcla director deportivo, Betis Deportivo y otros usos | Ninguno |
| **Mundo Deportivo** | La sección del Depor devuelve 410; la portada está desactualizada y es generalista | Ninguno |
| **El Desmarque** | La sección del Depor devuelve 404; el feed general no aporta historias del club | Ninguno |

### Cómo se ingiere

`python -m depor_hub.cli news` lee los cinco feeds, normaliza cada entrada y publica solo lo que el feed entrega. No descarga el cuerpo del artículo ni intenta saltar muros de pago.

- **Ritmo:** al menos 1 s entre peticiones al mismo dominio, `ETag`/`If-Modified-Since` y caché de cuerpos en `data/raw/news/`.
- **Ventana y retención:** 14 días y un máximo de 150 historias. Si una fuente falla, sus historias anteriores se conservan; si fallan todas, el comando sale con código 1 y no publica.
- **Fechas:** si el feed no trae fecha se reutiliza la del mismo ítem y, si no existe, se usa el momento de captura. Nunca se inventa una hora.
- **Idempotencia:** si el contenido no cambia, no se escribe ni se despliega.

### Relevancia, etiquetas y clústeres

«Deportivo» a secas no cuenta: solo suman las señales del club de A Coruña, su entorno y su plantilla. Se excluyen otros «Deportivo» (Alavés, Cali, Saprissa, Tenerife, Betis Deportivo…), el `Riazor` de playa o sucesos y los apellidos comunes sueltos. Un titular que solo se apoya en el extracto se descarta como `solo_extracto`. El umbral es configurable con `--threshold` y `--report` muestra los descartes por motivo.

Las etiquetas son cerradas (`fichajes`, `cantera`, `lesiones`, `partido`, `afición`, `club`, `opinión`), máximo dos, nunca equipos ni jugadores. `lesiones` no se deriva de una muerte y `partido` exige contexto.

La deduplicación agrupa la misma historia entre medios (±48 h, similitud base 0,52, entidades 0,44), y comparte entidades de evento reconocibles entre títulos y extractos. Dos piezas distintas del mismo medio o del mismo jugador no se fusionan. La prueba con los titulares reales de Falas Dépor agrupa sus tres versiones; la prueba del titular de Alberto Molina verifica que el apellido no activa relevancia. El representante se elige por prioridad y antigüedad, el `id` se hereda cuando la historia ya existía y las demás versiones quedan en `alsoIn`.

### Contrato

`news.json` pasa a `{ updatedAt, sources, stories }`. Cada historia incluye `id`, `title`, `url`, `sourceId`, `publishedAt`, `kind`, `summary`, `thumbnailUrl`, `tags` y `alsoIn`. Las fuentes incluyen `iconUrl` opcional; el catálogo declara el favicon o `apple-touch-icon` oficial ya verificado, sin rastrear la portada (ADR 0029). Si el icono falta o falla, se genera un monograma con color estable. `sources.json` desaparece: las fuentes viajan dentro de `news.json` para resolver nombre, grupo y monograma. Pydantic genera el JSON Schema y el espejo Zod de la app.

`social.json` sigue publicándose desde `data/manual/social_pins.yml`, pero la pestaña Noticias ya no lo muestra: los perfiles verificados quedan para una futura sección social.

### Cadencia

`news-refresh.yml` corre cada 30 minutos (`*/30 * * * *`) y también por `workflow_dispatch` con `force`. Tiene su propio grupo `news-publish` para no esperar a un refresco de datos lento, hace `rebase` antes de publicar con cinco reintentos y despliega Pages solo si hay cambios (los deploys se serializan en `pages-deploy`). Si ninguna fuente responde, el workflow falla y no pisa el `news.json` anterior.

### Límites

YouTube es la única fuente sin miniaturas propias en todos los ítems (solo algunos vídeos traen `media:thumbnail`); la app pinta un monograma cuando falta. Riazor.org apenas ofrece `enclosure` (5/25) y el resumen se toma del feed, nunca del artículo. Algunos medios cambian de WAF o de URL sin aviso: `news audit` lo detecta y actualiza la tabla y el catálogo. Todo el contenido enlaza al medio original; el proyecto no redistribuye el artículo.

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

## Contexto de temporada y rivales (H5.3)

| Dato | Fuente | Cómo se obtiene | Límite |
|---|---|---|---|
| Resumen, racha y evolución de la posición | football-data.org (`standings`, `matches`) | Cálculo propio por jornada con los partidos terminados; se marca `estimated` | La evolución es una reconstrucción, no una tabla publicada |
| Balance histórico y últimos 5 cruces | BDFutbol `https://www.bdfutbol.com/es/p/vs.php?e1=13&e2=<id>` | HTML público; se leen los totales (`valorpj`, `valorpg`, `valorpp`, `valorpe`, `valorgf`, `valorgc`) y las filas de partidos | Alcance `all_official_matches`; se cita fuente y enlace. `robots.txt` permite `/es/` |
| Entrenador del rival | football-data.org (`competitions/PD/teams`) | Campo `coach.name` | Si la API no lo da, `null` |
| Estadísticas individuales del rival | No se publican | No se verificó una fuente gratuita suficientemente fiable para la temporada 2026/27; no se llama a `/scorers` ni a API-Football | Campo `keyPlayers` vacío por compatibilidad; sin fotografías rivales |

BDFutbol se usa para el historial oficial y los cruces Depor–rival, no como sustituto automático de datos actuales de plantilla: su cobertura para esta temporada no se considera comprobada para este uso. No se añadió `API_FOOTBALL_KEY`; no se requiere una clave para mostrar la ficha básica del rival. El mapa football-data → BDFutbol es manual y verificado en `data/manual/bdfutbol_teams.yml`. No se resuelve por búsqueda automática: un homónimo (filial, club histórico) produciría un balance equivocado. Depor = `13`. Los 19 rivales de la temporada tienen histórico; si una consulta falla, ese rival queda con `headToHead: null` y el resto se publica.

`rivals` se ejecuta a diario (`rivals-refresh.yml`) y no en `ingest`: BDFutbol es más lento y no debe bloquear la cadencia de 10 minutos. La caché vive en `data/raw/enrich/h2h/`.

## Tiempo en la sede (H5.2)

| Dato | Fuente | Cómo se obtiene | Límite |
|---|---|---|---|
| Temperatura, cielo, lluvia y viento | **Open-Meteo** (`api.open-meteo.com/v1/forecast`) | Previsión horaria por coordenadas del estadio, zona `Europe/Madrid` | Solo con hora confirmada, coordenadas verificadas y ≤ 16 días. Sin ubicación del usuario |

Solo Riazor tiene coordenadas verificadas (`43.3686, -8.4175`). Las demás sedes ocultan el tiempo hasta que exista una coordenada contrastada. Open-Meteo se usa bajo **CC BY 4.0** y la app muestra «Datos: Open-Meteo». Un fallo de la API no rompe la Home.

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

## Club (H7, ADR 0025)

La ficha del club se cura a mano en `data/manual/club.yml`; cada bloque lleva su fuente en comentarios y en esta tabla. El contrato no expone procedencia general, pero los `MediaRef` sí publican crédito, URL de origen y licencia cuando existen. Lo que no está documentado queda en `null`; no se completan fechas, dorsales, patrocinadores ni equipaciones por deducción.

| Bloque | Fuente | Límite |
|---|---|---|
| Identidad, fundación, colores, apodos, presidencia, sede y contacto | Web oficial del club y datos societarios publicados | Sin lema documentado: `motto: null`. El contacto es el publicado por el club |
| Himnos y créditos | Páginas oficiales del club y notas de estreno; créditos de «Voa» revisados en el YAML | La letra se lee de `data/manual/himnos/<id>.txt`; solo se publica el bloque posterior a `Letra`. Sin audio |
| Escudos históricos | 1000logos para 13 versiones y la web de identidad corporativa para el vigente (SVG) | Las 14 versiones enlazan su fuente en `MediaCredit`; la licencia de reutilización de 1000logos y la de la imagen oficial no están verificadas |
| Equipaciones | Recopilación de temporadas publicadas (fabricante, patrocinador y colores); foto de producto de la tienda oficial para la local 2026-27 | 42 temporadas y 44 equipaciones: 1 foto con URL verificada y crédito visible (Deportienda; derechos reservados) y 43 ilustraciones SVG; no se asignan fotos históricas sin temporada comprobada |
| Estadio y aforo | Datos públicos de Riazor y del club | Total **33.225** = 32.490 gradas + 141 palco de honor + 385 palcos VIP + 113 Área 1906 + 96 medios; la suma se valida en el contrato |
| Museo, visitas y entradas | `ticketing.museo.rcdeportivo.es` y `rcdeportivo.es/es/museo-and-tour` | Precios y horarios pueden cambiar; la app enlaza a la fuente |
| Ciudad deportiva | Proyecto y datos publicados del Dépor Training Center en Abegondo | 140.000 m², 8 campos de tamaño Riazor y 3 de calentamiento, diseño Populous. Sin coordenadas verificadas: `coordinates: null` |
| Junta y organigrama | Comunicaciones oficiales del club | El entrenador **no se duplica**: la app lo lee de `squad.json` y enlaza a `/coach` |
| Patrocinadores | Web y camisetas oficiales de la temporada | ABANCA principal, Nike técnico y lista de patrocinadores oficiales; no se incluyen acuerdos no publicados |
| Títulos y rivalidades | Palmarés y hechos publicados por el club y prensa | Se agrupan por competición y año; no se añaden títulos no documentados |
| Enlaces y redes | Canales oficiales verificados | WhatsApp y twitch solo si el club los publica; el resto queda `null` |

Reglas:

- `data/manual/club_images.yml` es la lista revisable de imágenes descargables; las atribuciones se publican en el `MediaRef` correspondiente. La foto de producto 2026-27 responde HTTP 200 con `image/jpeg` (verificada el 08-nov-2026); su ficha declara «Derechos reservados». No se añade ningún binario nuevo en este hito.
- `docs/kits_coverage.md` se regenera con `python -m depor_hub.cli club` y distingue foto verificada, ilustración SVG y falta de imagen. Cobertura actual: 1 foto y 43 ilustraciones SVG (44/44 con soporte visual).
- El árbol ya versionado `data/public/v1/img/club/` contiene 58 ficheros, incluidos 14 PNG/JPEG rasterizados preexistentes. No se añadieron archivos de imagen; eliminar o sustituir esos ficheros requiere una migración separada porque las rutas del contrato y de la app los usan.
- `club.json` no entra en el `dataHash` deportivo; se valida como los demás ficheros y se escribe de forma idempotente (sin cambios, conserva `updatedAt`).
- Las licencias de terceros de la app se generan con `npm run licenses` desde `package-lock.json` (1.052 paquetes de producción en 16 grupos) y se muestran en Acerca de. No se publica un listado de fuentes de datos en la app.

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

## Club: títulos, rivalidades y medios (ADR 0032)

- **Palmarés**: `data/manual/club.yml` (lista breve) y `data/manual/titles.yml`
  (21 ediciones). Las Copas de 1995 y 2002 y la Liga 2000 quedan `verified` con
  goleadores, minuto, árbitro y entrenador contrastados; el resto conserva el
  palmarés curado con `pending_verification`. `club titles` compara con la tabla
  «Títulos» de BDFutbol (`https://www.bdfutbol.com/es/e/e13.html`) y escribe
  `data/manual/titles.proposed.yml`; nunca aplica cambios sola.
- **Rivalidades**: `data/manual/rivalries.yml` con seis rivales. El balance se
  obtiene de `https://www.bdfutbol.com/es/p/vs.php?e1=13&e2=<id>` con
  `PoliteClient` (caché, robots.txt, 1 s/host) y se publica en
  `rivalries.json`. Ids verificados: Celta 11, Compostela 12, Oviedo 28,
  Sporting 34, Racing de Ferrol 48, Lugo 76. El Celta queda `verified`; el resto
  de narrativa conserva `pending_verification`.
- **Medios**: `club probe-media` recorre todas las URLs de imagen/vídeo de
  `club.yml`, `titles.yml`, `rivalries.yml` y las fuentes externas de
  `club_images.yml`, además de las rutas locales de `data/public/v1`. Hace HEAD
  (estado, MIME y tamaño) y un GET mínimo para las imágenes (dimensiones); nunca
  descarga binarios al repositorio. El informe `data/manual/club_media.proposed.yml`
  distingue `ok`/`local`/`broken`/`blocked`/`missing` con origen y contexto, y
  esta página registra las URLs rotas o bloqueadas. Una URL rota se queda en
  `null`: no se sustituye ni se inventa otra; solo se aplica a mano con licencia
  y crédito revisados.
- **Letras**: se mantienen las tres letras actuales con
  `lyricsRights.status = unknown`, titular, nota de uso editorial y fecha de
  comprobación. No se afirma permiso de reutilización.

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
python -m depor_hub.cli news audit                   # prueba los feeds y muestra la tabla
python -m depor_hub.cli news audit --write-docs      # además actualiza docs/sources.md y el catálogo
python -m depor_hub.cli news                         # publica news.json
python -m depor_hub.cli news --report                # informe de relevancia y clústeres
python -m depor_hub.cli news --offline               # repite desde data/raw/news sin red
python -m depor_hub.cli social                       # regenera social.json desde social_pins.yml
python -m depor_hub.cli club                         # publica club.json y docs/kits_coverage.md
python -m depor_hub.cli club-images                  # descarga y normaliza las imágenes locales del club
python -m depor_hub.cli club-images --offline        # comprueba las imágenes presentes sin red
python -m depor_hub.cli club titles                  # publica titles.json y propone diferencias desde BDFutbol
python -m depor_hub.cli club titles --offline        # compara con la caché de BDFutbol, sin red
python -m depor_hub.cli club rivalries               # publica rivalries.json con el balance de BDFutbol
python -m depor_hub.cli club probe-media             # sondea todos los medios y registra fallos en docs/sources.md
```

El workflow `News refresh` (`.github/workflows/news-refresh.yml`) ejecuta la ingesta cada 30 minutos y usa el grupo `news-publish`, separado de `data-publish`. Todos hacen rebase antes de empujar, reintentan cinco veces y despliegan Pages solo cuando hay cambios; los deploys se serializan en `pages-deploy`.

El workflow `Enrich proposal` (`.github/workflows/enrich.yml`) es manual y solo sube el informe como artefacto. No hace commit.

## Previsualización local de la app

```bash
npm run mobile
```

Arranca Expo y un servidor estático de solo lectura sobre `data/public` (puerto 8000). La app deriva la URL del host de Metro; no hay IPs fijas. Para usar los datos publicados, define `EXPO_PUBLIC_DATA_BASE_URL` en `apps/mobile/.env`. Detalles en `docs/adr/0009-fotos-y-fuente-oficial.md`.

<!-- club-media:start -->
### Sondeo de medios del club — 2026-11-08T16:49:44Z

Generado por `python -m depor_hub.cli club probe-media`. No sustituye ninguna URL: las rotas quedan en `null` y se listan aquí.

OK: **58** · locales: **0** · rotas: **0** · bloqueadas: **0** · ausentes: **0**

Sin URLs rotas, bloqueadas ni ficheros locales ausentes en el último sondeo.
<!-- club-media:end -->
