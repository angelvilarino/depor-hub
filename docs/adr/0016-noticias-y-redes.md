# ADR 0016 — Noticias, vídeos y redes curadas

- **Estado:** aceptada (27-oct-2026).
- **Alcance:** ingesta real de RSS/Atom y YouTube, filtro de relevancia, deduplicación entre medios, contrato público `news.json`/`sources.json`/`social.json`, workflow cada 30 minutos y pestaña Noticias.
- **Regla base:** se publica solo lo que entrega el feed (titular, enlace, fecha, miniatura y resumen). No se descarga ni se scrapea el cuerpo del artículo, no se rodean muros de pago ni bloqueos y no se inventan publicaciones sociales.

## Contexto

H5 dejó `news.json` como contrato mínimo opcional y un `HeadlinesBlock` que se oculta si no hay datos. Faltaba la fuente real de titulares, la pestaña completa, los vídeos del club y un lugar honesto para las redes oficiales. También había que evitar dos problemas típicos de un agregador: publicar noticias que no son del Depor y repetir el mismo artículo varias veces.

El repositorio no tiene backend ni claves en la app. Todo se resuelve con un pipeline de Python que escribe JSON estático en `data/public/v1` y con la app consumiéndolo como datos opcionales.

## Decisiones

### 1. Catálogo manual y auditado de feeds

`data/manual/news_feeds.yml` es la única lista de medios. Cada entrada declara `id`, `name`, `kind` (`club`, `local`, `nacional`, `radio`, `agregador` o `video`), `url`, `media_url`, idioma, peso, `keyword_filter` y `enabled`. La auditoría puede deshabilitar un feed, pero el motivo queda escrito en `note` y en `docs/sources.md`; nunca se reintenta a ciegas un 403, 406 o 429.

Situación del catálogo (27-oct-2026): **30 entradas, 21 activas y 9 descartadas**. Las descartadas son la web del club sin RSS propio, AS (403), Sport (406), Cadena SER (403), Radio Coruña (sin RSS y dominio bloqueado), Faro de Vigo, La Opinión A Coruña y Superdeporte (406 de su WAF) y Deportivo Hoy (DNS inexistente). Para los medios bloqueados se usa una consulta `site:` en Google News; el club se cubre con su canal de YouTube y con `site:rcdeportivo.es`.

`keyword_filter: true` marca los feeds generales: su contenido pasa por el filtro de relevancia. Se reserva `false` para feeds que ya son del club.

### 2. Cliente HTTP educado

`scripts/depor_hub/news/http.py` usa `httpx` con:

- User-Agent identificable con `CONTACT_EMAIL`, el mismo criterio que el resto del proyecto.
- Timeout de 25 s, redirecciones seguidas y `Accept` de RSS/Atom.
- **Al menos 1 s entre peticiones al mismo dominio** (`--interval`), también cuando se recorren varios feeds del mismo medio.
- `ETag` e `If-Modified-Since`: un 304 reutiliza el cuerpo anterior y actualiza `lastSuccessAt`.
- Caché de cuerpo y metadatos en `data/raw/news/` (ignorada por git). En Actions se restaura con `actions/cache`; el `state.json` de la rotación de jugadores vive ahí.
- Un 403/429/captcha lanza `FeedBlocked` y no se reintenta. Los errores de red y los 5xx se toleran por feed: la ingesta termina con el resto de fuentes y deja el error en `meta.sources`.

### 3. Normalización y contrato aditivo

El contrato v1 crece sin romper a los clientes anteriores:

- `NewsItem` gana `sourceId`, `sourceKind`, `kind`, `publishedEstimated`, `summary`, `players`, `alsoIn`, `durationSeconds` y `videoId`, todos con valor por defecto.
- `news.json` añade `meta` con el diagnóstico por feed y un `dataHash` propio.
- `sources.json` publica las fuentes reales para filtros y créditos (`id`, `name`, `url`, `kind`, `items`).
- `social.json` publica perfiles y pins curados (`profiles`, `pins`).

Los esquemas JSON se regeneran con `python -m depor_hub.cli schemas` y el espejo Zod de la app usa `default(...)` para aceptar JSON y caché anteriores. `meta.json.dataHash` sigue cubriendo solo los cuatro ficheros deportivos; noticias y redes tienen su propio hash porque se refrescan con otra cadencia. El hash de noticias y redes ignora `updatedAt`, `dataHash` y `meta`: un refresco sin cambios no genera commit.

Los ejemplos sintéticos (`packages/schemas/examples/news.json`, `sources.json` y `social.json`) mantienen el test de compatibilidad sin depender de datos reales.

### 4. Normalización, relevancia y etiquetas

Cada entrada del feed se limpia y canonicaliza:

- Se eliminan scripts y HTML del resumen; se recorta a 240 caracteres en límite de palabra.
- La URL pierde parámetros de seguimiento (`utm_*`, `fbclid`, etc.), se ordena la query y se descarta el fragmento.
- El `id` es estable: `sha256` corto de la URL canónica.
- Si el feed no trae fecha, se reutiliza la del mismo ítem en la publicación anterior; si tampoco existe, se usa el momento de captura y se marca `publishedEstimated: true`. Nunca se inventa una hora de publicación.
- Los feeds de YouTube se identifican por `videoId`, se enlazan al `watch?v=` canónico y se marcan `kind: 'video'`.

El filtro de relevancia puntúa el título y el resumen con señales del Depor (nombre del club, `Dépor`, Fabril, Abegondo, blanquiazul, Riazor), jugadores y rivales. Se aplica cuando el feed es general y exige **3 puntos**. Para reducir falsos positivos:

- No cuentan solos apellidos comunes (`Herrera`, `Navarro`, `Bustos`, `Seoane`, `Pardo`, etc.).
- Se excluyen otros «Deportivo» (Alavés, Cali, Saprissa, etc.).
- `Riazor` no puntúa si el texto es de playa, sucesos o meteorología y no hay otra señal deportiva.
- El nombre completo de un jugador puntúa más que el apellido suelto.

Las etiquetas son un vocabulario cerrado (`fichajes`, `cantera`, `partido`, `rueda-de-prensa`, `lesiones`, `entrenador`, `aficion`, `resultados`) más `player:<id>` y `rival:<slug>`, con un máximo de 12. Se evitan etiquetas genéricas que generaban ruido (`orzan` en cantera, `riazor` en afición, `pena` suelta o `hidalgo` como entrenador).

### 5. Deduplicación conservadora

- La misma URL canónica es el mismo ítem.
- Entre medios distintos se agrupan titulares con **similitud ≥ 0,82** dentro de una ventana de **7 días**.
- Dos noticias del **mismo medio** solo se fusionan si el titular normalizado es idéntico. Así se corrigen las varias URLs que Google News devuelve para un mismo artículo sin mezclar dos noticias parecidas del mismo medio.
- El ítem principal se elige por peso del medio y, a igualdad, por el más antiguo. Los demás medios se guardan en `alsoIn` con su nombre y URL.
- La miniatura y el resumen se completan desde los secundarios si el principal no los trae.

La fusión con la publicación anterior es idempotente: un ítem que sigue en el feed conserva su fecha estimada y sus etiquetas, y no se duplica al cambiar de ejecución.

### 6. Ventana y publicación

`news ingest`:

1. Carga el catálogo, la plantilla, el entrenador y los rivales de `fixtures.json`.
2. Añade las consultas de jugador de Google News de forma **rotativa**: `--player-queries` (6 por defecto) y un `playerOffset` persistido en `data/raw/news/state.json`. Así se cubre toda la plantilla sin castigar el dominio ni multiplicar peticiones.
3. Normaliza, filtra y deduplica.
4. Conserva lo anterior dentro de una **ventana móvil de 14 días** y publica como máximo **400 ítems**.
5. Escribe `news.json` y `sources.json` solo si cambia el hash; además regenera `social.json` desde `data/manual/social_pins.yml` con `--social`.

Los vídeos del club viven dentro de `news.json` con `kind: 'video'` y `videoId`, no en un fichero aparte: comparten filtros, fecha, leídos y paginación con los artículos, y la app los abre igual. `sources.json` se separa para que los filtros y créditos no engorden cada ítem.

### 7. Redes curadas, sin scraping

`data/manual/social_pins.yml` solo contiene perfiles oficiales verificados (X, Instagram y YouTube del club). `pins` está vacío a propósito: no hay publicaciones destacadas con URL y fecha estables que se puedan verificar. No se inventan posts, miniaturas ni métricas y no se scrapea ninguna red. El comando `social` regenera `social.json`; la app lo trata como opcional y oculta el bloque si no hay datos.

### 8. Workflows y publicación

`.github/workflows/news-refresh.yml` se ejecuta cada **30 minutos** y comparte con `data-refresh.yml`:

- `concurrency.group: data-publish` y `cancel-in-progress: false`: los dos escriben en `main` y despliegan Pages, así que nunca se pisan ni se cancelan.
- `git pull --rebase --autostash origin main` antes de `git push`.
- Despliegue desde un **checkout fresco de `main`** con `data/public` completo, no desde el árbol que acaba de commitear.
- Caché de `data/raw/news` para conservar ETag, cuerpos y rotación.

La ingesta es idempotente: si no cambia el hash, el workflow termina con `changed=false` sin commit. Un test de humo comprueba el grupo compartido, el cron, el rebase, el checkout de despliegue y la caché.

### 9. App

- `useNews`, `useSources` y `useSocial` comparten `staleTime` de **10 minutos** y tratan el **404 como «sin datos»**. La app sigue funcionando si falta cualquiera de los tres ficheros.
- La pestaña **Noticias** usa `FlatList` con miniaturas (o monograma si el feed no las da), hora relativa, etiquetas, `alsoIn`, filtros por tipo, fuente y etiqueta, búsqueda sin acentos, paginación de **30**, pull-to-refresh y leídos persistidos en el dispositivo.
- Los enlaces se abren con `expo-web-browser` y, si no está disponible, con `Linking`. Un fallo se avisa y no rompe la lista.
- Los vídeos muestran icono y duración cuando el feed la ofrece; los artículos y vídeos comparten el mismo flujo.
- La Home muestra como máximo **cinco titulares**, sin repetir título ni URL, y «Ver todas» navega a Noticias.
- ES y EN mantienen paridad exacta de claves; GL es parcial y cae a ES.

## Consecuencias

- La app gana una pestaña completa sin backend ni claves y sin copiar contenido de los medios.
- El contrato sigue siendo aditivo: un cliente antiguo ignora los campos nuevos y la app tolera JSON anterior.
- La calidad depende de los feeds: Google News no entrega miniaturas y algunos medios solo ofrecen resúmenes cortos. Se muestra lo que hay; no se completa con scraping.
- Los bloqueos no se rodean. Si un medio cambia su WAF o su RSS, la auditoría lo detecta, se documenta y se busca un respaldo en Google News.
- El coste de red está acotado por el ritmo por dominio, la caché condicional y la rotación de consultas de jugador.

## Verificación

```bash
source .venv/bin/activate && ruff check scripts && pytest scripts
python -m depor_hub.cli schemas && git diff --exit-code packages/schemas
npm run lint && npm run typecheck && npm test
python -m depor_hub.cli news audit --write-docs
python -m depor_hub.cli news ingest --interval 1 --player-queries 6
python -m depor_hub.cli social
```

La auditoría del 27-oct-2026 devolvió **21 feeds activos y 0 errores**. La ingesta real publicó **184 ítems de 56 fuentes** (15 vídeos y 7 con `alsoIn`), sin duplicados exactos de titular, y `social.json` con 3 perfiles y 0 pins. Los tests cubren parseo RSS/Atom/YouTube, HTML ilegible, canonicalización, relevancia, etiquetas, dedupe entre medios y del mismo medio, ventana, idempotencia, tolerancia a un feed roto, auditoría, redes, workflows y render de la pantalla con 0/1/muchos/error/offline.
