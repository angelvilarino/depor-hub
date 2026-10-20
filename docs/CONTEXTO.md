# DEPOR HUB — Documento de contexto del proyecto

> **Cómo usar este documento:** es el contexto base del Proyecto de Claude. Claude debe leerlo entero antes de responder, tratarlo como fuente de verdad y proponer actualizaciones cuando algo cambie. Las secciones marcadas con **[VERIFICAR]** contienen datos que cambian con el tiempo (planes de APIs, límites, categoría del equipo, precios) y **deben comprobarse con búsqueda web antes de darse por buenos**.

---

## 0. Instrucciones para Claude en este proyecto

### 0.1 Rol
Eres el copiloto técnico y de producto de "Depor Hub": arquitecto de software, ingeniero de datos, diseñador de producto y revisor legal básico. Ayudas al responsable del proyecto (aficionado del Real Club Deportivo de La Coruña, con base en Galicia) a diseñarlo, construirlo y mantenerlo.

### 0.2 Reglas de trabajo
1. **Idioma:** responde en español (de España) salvo que se pida otro. Código, nombres de variables, tablas y commits en inglés.
2. **Coste cero primero:** toda propuesta debe funcionar en capas gratuitas. Si algo requiere pago, dilo explícitamente y ofrece alternativa gratuita.
3. **Estático primero:** prioriza generar datos con scripts + web estática antes que servidores y bases de datos propias.
4. **Verifica lo volátil:** límites de APIs, precios, términos de servicio, categoría actual del club, plantilla y calendario se buscan en la web antes de afirmarlos. Nunca los des de memoria.
5. **Cero invención de datos:** no inventes resultados, alineaciones, espectadores, sueldos ni fechas. Si no hay dato, el campo queda `null` con `source: null` y se marca como pendiente.
6. **Trazabilidad:** todo dato histórico guardado lleva fuente, fecha de captura y nivel de confianza (ver 6.3).
7. **Legalidad y ética:** respeta términos de servicio, `robots.txt`, derechos de imagen y RGPD. Si una petición implica scraping dudoso o uso de material protegido, avisa y propón alternativa (embed oficial, enlace, licencia libre, permiso del club).
8. **Entrega concreta:** prefiere código ejecutable, esquemas SQL, estructuras de carpetas y checklists a explicaciones genéricas. Cuando generes código, que sea completo y con comentarios útiles.
9. **Honestidad sobre viabilidad:** si algo es inviable gratis o legalmente arriesgado, dilo claro y sin suavizar.
10. **Una decisión a la vez:** cuando haya varias opciones, recomienda una con motivo y menciona alternativas brevemente.

### 0.3 Tono del producto (para textos, UI y copy)
Cercano, orgulloso, con humor gallego y respeto a la historia del club. Evitar insultos a rivales y cualquier contenido que fomente violencia o mensajes ofensivos. Lenguaje inclusivo no forzado.

---

## 1. Visión

**Depor Hub** es la plataforma de fans "no oficial" más completa sobre el Real Club Deportivo de La Coruña: información del club, plantilla y competición en vivo, historia exhaustiva desde 1906, analítica y predicción, noticias y redes sociales agregadas, minijuegos diarios y comunidad.

**Propuesta de valor diferencial ("lo que nadie más junta"):**
- Archivo histórico completo y buscable (partidos, plantillas, onces, espectadores, equipaciones, escudos, estadio).
- Un único lugar con noticias + redes + resultados + análisis.
- Hábito diario mediante minijuegos con rachas.
- Datos propios curados que sirvan como pilar de SEO.

**Público objetivo:** abonados y aficionados de Galicia, diáspora gallega (ES/GL/EN), periodistas aficionados, peñas, aficionados jóvenes que consumen formato corto (TikTok/Instagram).

**Éxito (métricas orientativas):**
- Fase MVP: 1.000 visitas/mes, instalación como PWA, 100 usuarios recurrentes.
- Fase madura: 20-50k visitas/mes, 30% de usuarios volviendo semanalmente, presencia en búsquedas del tipo "historial Depor vs [rival]", "once Depor 2000".

---

## 2. Principios de diseño

1. **Datos como producto:** el valor está en el dataset limpio y versionado.
2. **Mobile first**: el 80% del tráfico deportivo es móvil.
3. **Rápido y ligero:** páginas estáticas generadas (SSG/ISR), imágenes optimizadas, CDN.
4. **Actualización automática:** pipelines programados (cron) tras cada jornada; intervención manual mínima.
5. **Atribución siempre:** cada dato y cada contenido externo cita su fuente.
6. **"No oficial" explícito:** aviso visible en el footer y en la página "Acerca de".
7. **Accesible:** contraste, navegación por teclado, textos alternativos, soporte a `prefers-reduced-motion`.
8. **Privacidad por defecto:** analítica sin cookies, sin trackers de terceros salvo embeds con consentimiento.

---

## 3. Alcance funcional completo

### 3.1 Módulo CLUB (información general)
| Sección | Contenido | Notas |
|---|---|---|
| Ficha del club | Nombre oficial, fundación (1906), colores, apodos (Superdépor, Blanquiazul, Los Dépor, Los Turcos…), himno, lema, presidente, entidad (SAD) | Datos básicos en Wikidata/Wikipedia |
| Escudo | Línea temporal de todas las versiones del escudo desde 1906 con años de uso y contexto | Derecho de marca: ver sección 12 |
| Equipaciones | 1ª, 2ª, 3ª, porteros de la temporada actual + históricas desde la más antigua documentada, por temporada, con fabricante y patrocinador de pecho/manga/espalda | Fuentes: web del club, tiendas oficiales, archivos de camisetas, Commons |
| Estadio | Estadio Municipal de Riazor: ubicación en mapa, capacidad por año, remodelaciones, gradas y zonas, aspecto a lo largo del tiempo, conciertos y otros eventos, precios de abonos por temporada y por zona, afluencia (por partido, media por temporada, histórico, récords) | |
| Títulos | Colectivos (Liga 1999-00, Copa del Rey 1995, 2002, Supercopa de España 1991, 2000, 2002, ascensos, etc.) e individuales (Pichichi, Zamora, Bota, premios, Balón, selecciones) | **[VERIFICAR]** lista exacta contra fuentes antes de publicar |
| Museo | Qué incluye, horarios, precios, cómo llegar | Web oficial, actualización manual semestral |
| Otros servicios | Tienda, abonos, carnet, escuela, Fundación Deportivo, tour del estadio, hospitality | |
| Depor Training Center (Abegondo) | Ubicación, campos, instalaciones, historia, fotos con licencia | Antigua Ciudad Deportiva de Abegondo; verificar denominación vigente |
| Junta directiva y organigrama | Presidente, consejeros, director deportivo, entrenador, cuerpo técnico, directivos | Actualizar cada temporada |
| Patrocinadores | Principal, técnico, oficiales, colaboradores, históricos | Con años y logos (permiso o enlaces) |
| Economía | Presupuesto, límite de coste de plantilla (LaLiga), cuentas anuales, deuda, accionariado, ingresos por tipos | Solo datos oficiales/auditados con fuente |
| Salarios | **Estimados**, nunca presentados como oficiales | Fuentes: prensa, Capology; etiqueta "estimación" |
| Redes y enlaces | Web oficial, app, X, Instagram, TikTok, YouTube, Facebook, Twitch, canal de WhatsApp, etc. | |

### 3.2 Módulo PLANTILLA Y COMPETICIÓN
- **Plantilla actual:** ficha por jugador (foto con licencia o silueta, dorsal, posición, nacionalidad, fecha y lugar de nacimiento, altura, pie, contrato, cedido/cedente, valor de mercado, trayectoria completa con clubes y fechas, estadísticas de temporada, enlaces a redes).
- **Cuerpo técnico** y staff.
- **Calendario/Resultados:** próximos partidos con hora local (Europe/Madrid), TV/streaming, árbitro, estadio; resultados con goles, tarjetas, cambios, alineaciones, crónica enlazada.
- **Clasificación**, goleadores, asistentes, tarjetas, minutos.
- **Partido en directo:** marcador, eventos, alineaciones (limitado por capa gratuita).
- **Comparador de jugadores.**
- **Mercado:** altas, bajas, cesiones, renovaciones, rumores (solo con fuente citada y etiquetados "rumor").
- **Cantera y filial:** Fabril, juveniles, jugadores que han dado el salto.
- **Exportar calendario** (.ics) y suscripción por URL.

### 3.3 Módulo HISTORIA
- **Archivo por temporada** (1906 → actual): competición, clasificación final, plantilla, entrenadores, goleadores, once tipo, resultados partido a partido.
- **Buscador de partidos:** por rival, año, competición, resultado, estadio, árbitro.
- **Ficha de rival** con balance histórico (PJ, G, E, P, GF, GC), mayores victorias/derrotas, partidos míticos.
- **Europa:** todos los partidos europeos (Copa de Europa/Champions, Copa de la UEFA, Recopa, Intertoto), con especial foco en Champions 1999-2004.
- **Hall of fame:** mejores onces por década, ranking histórico (partidos, goles, minutos, títulos), votación de la afición.
- **Momentos:** mejores y peores en línea temporal narrada (Maratón 1994 y Penalti de Djukic, Liga 1999-00, Copa 1995 "Copa del Rey de la Lluvia", Centenariazo 2004, Orzán, Superdépor, remontada al Milan 2004, descensos de 2011, 2020, ascensos, etc.). **[VERIFICAR]** cada dato y fecha.
- **Efemérides:** "Un día como hoy en la historia del Depor" (generación automática desde la BD).
- **Rivalidades:** Celta (derbi gallego), Racing de Ferrol, Compostela, Lugo, Sporting, Racing de Santander, Oviedo, etc.
- **Biblioteca de recursos:** libros, documentales, hemeroteca enlazada, himnos, cánticos.

### 3.4 Módulo ANÁLISIS Y PREDICCIÓN
- **Dashboard de temporada:** puntos, posición, forma (últimos 5/10), local/visitante, goles por tramos de 15 minutos, tiros, posesión, xG si hay datos, rendimiento por jugador, alineaciones y sistemas usados, rendimiento por rival.
- **Predicción de partido:** modelo Poisson/Dixon-Coles + Elo → probabilidades 1X2, marcadores probables, over/under, ambos marcan.
- **Simulador de temporada (Monte Carlo):** probabilidad de ascenso directo, playoff, permanencia, descenso, posición esperada.
- **Afluencia a Riazor:** por partido, media por temporada, comparativa con la categoría.
- **"Si el Depor fuera…":** compara la temporada actual con las históricas a igual número de jornadas.
- **Transparencia del modelo:** página que explica metodología, backtesting (Brier score, log-loss) y límites.

### 3.5 Módulo NOTICIAS Y REDES (nuevo)
Objetivo: que la home sea el "punto de partida del día" del aficionado.

**Noticias**
- Agregador de titulares vía **RSS** de medios: La Voz de Galicia, Marca, AS, Mundo Deportivo, El Español, Diario Sport, Cadena SER, COPE, Radio Coruña, Deportivo.es (si ofrece), Galiciapress, etc. **[VERIFICAR]** que cada medio ofrezca RSS vigente.
- Mostrar solo: título, fuente, fecha, miniatura permitida y enlace. **No reproducir el cuerpo.**
- Filtros: oficial del club, prensa local, nacional, fichajes, cantera, internacional.
- Clasificación automática por etiquetas (jugador, tema, rival) mediante reglas o un clasificador ligero.
- Deduplicación de noticias iguales entre medios (similitud de títulos).
- Resumen diario opcional redactado por IA, claramente etiquetado, con enlaces a fuentes. **[VERIFICAR]** costes de IA si se usa (alternativa: plantilla sin IA).

**Redes sociales (X, Instagram, TikTok, YouTube)**
Prioridad: **embeds oficiales y enlaces**, no scraping.
| Plataforma | Vía recomendada | Limitaciones conocidas **[VERIFICAR]** |
|---|---|---|
| X | Widgets/embeds oficiales (`publish.twitter.com`, oEmbed) para posts concretos; la API v2 en plan gratuito es muy limitada | La lectura masiva de timeline requiere plan de pago; no scrapear |
| Instagram | oEmbed/embeds de publicaciones concretas; Graph API solo para cuentas propias de negocio/creador | No hay API pública para leer cuentas ajenas |
| TikTok | Embed oficial por URL de vídeo (oEmbed); Display API solo para cuentas que autoricen la app | Sin API pública para listar vídeos de cuentas ajenas |
| YouTube | **RSS de canal** (gratis) y YouTube Data API v3 (cuota diaria gratuita) | Es la plataforma más fácil de integrar |
| Facebook/Threads/Bluesky | Embeds o RSS-bridge según disponibilidad | Valorar si merece la pena |

**Estrategia práctica para el feed social (sin pagar ni scrapear):**
1. Curar manualmente una lista de URLs de posts destacados (panel de admin simple o fichero `social_pins.json` que se actualiza por Pull Request).
2. Opcional: usar un servicio puente gratuito/limitado tipo RSS-Bridge propio, Nitter (inestable, no depender de ello) o webhooks de IFTTT/Zapier (capa gratuita) cuando el club publique. **[VERIFICAR]** viabilidad y términos.
3. Mostrar embeds **solo tras consentimiento** (los embeds cargan scripts y cookies de terceros: RGPD).
4. Alternativa de "tarjeta de enlace" (título + miniatura + enlace) que no carga scripts de terceros.
5. Pestaña "Jugadores en redes": enlaces a los perfiles oficiales de cada jugador y último contenido destacado curado.

**Boletín/Alertas:** resumen semanal por email (Buttondown/Brevo capa gratuita) y notificaciones push para "gol", "once confirmado", "fichaje oficial". **[VERIFICAR]** límites.

### 3.6 Módulo MINIJUEGOS (diarios)
Todos con reto determinista por fecha (semilla = `YYYY-MM-DD` hasheada), rachas en `localStorage` y ranking opcional con login.

| # | Juego | Mecánica |
|---|---|---|
| 1 | **Wordle del Depor** | Adivinar un jugador histórico en 6 intentos; pistas: posición, nacionalidad, años en el club, dorsal, edad |
| 2 | **Adivina el once** | Partido histórico con once tapado; revelar posiciones/dorsales progresivamente |
| 3 | **¿Quién es?** | Trayectoria (clubes por los que pasó) o silueta |
| 4 | **Más o menos (Higher/Lower)** | ¿Más espectadores, goles, puntos? entre dos temporadas o partidos |
| 5 | **Grid** (tipo Immaculate Grid) | Celdas "jugó en X" × "marcó a Y" |
| 6 | **Adivina el partido** | Por marcador, año y rival con pistas |
| 7 | **¿De qué año es?** | Camiseta/escudo/estadio |
| 8 | **Trivia diaria** | 5 preguntas con dificultad creciente |
| 9 | **Cronología** | Ordenar 5 hitos del club |
| 10 | **Porra de la jornada** | Predecir marcador, ranking entre amigos |

Reglas: sin anuncios intrusivos, compartir resultado como emojis (sin spoilers), versión accesible, textos ES/GL/EN.

### 3.7 Módulo COMUNIDAD Y UTILIDAD
- Porra/quiniela anual, MVP del partido y notas, foros moderados o "preguntas al archivo".
- Álbum de cromos digital (desbloqueo jugando).
- Mapa de peñas del mundo.
- Guía del aficionado local (cómo llegar a Riazor, aparcar, comer, alojamiento) y guía de desplazamientos a campos rivales.
- Contribuciones de usuarios: sugerir correcciones de datos con moderación.
- PWA instalable, modo oscuro/claro, multi-idioma (ES/GL/EN).
- Página de datos curiosos aleatorios.

---

## 4. Arquitectura propuesta

```
FUENTES                    INGESTA (GitHub Actions + Python)           DATOS                 PRESENTACIÓN
────────                   ────────────────────────────────           ─────                 ────────────
APIs fútbol           →    scripts/ingest_*.py                    →   data/raw/*.json   →   Web estática
CSV históricos        →    scripts/clean_*.py                     →   data/clean/*.json →   (Astro/Next)
Wikipedia/Wikidata    →    scripts/enrich_*.py                    →   SQLite/Parquet    →   + Edge Functions
RSS de medios         →    scripts/news_*.py                      →   data/news.json    →   + Supabase (solo
YouTube RSS           →    scripts/social_*.py                    →   social_pins.json      usuarios/votos)
Curación manual       →    PR a ficheros YAML/JSON                →   data/manual/*.yml
Modelos               →    scripts/model_*.py                     →   data/predictions/ →   Dashboard/gráficos
```

**Principios arquitectónicos**
- El repositorio es la fuente de verdad de los datos "públicos" (versionados, revisables por PR).
- Supabase/Postgres solo para datos de usuario (cuentas, votos, rankings, porras).
- Todo script debe ser **idempotente** y re-ejecutable.
- Caché en disco y `ETag/If-Modified-Since` para ahorrar peticiones.
- Datos con **esquema validado** (Pydantic/JSON Schema) en CI: si falla, el build falla.

---

## 5. Stack tecnológico

| Capa | Tecnología | Alternativa | Motivo |
|---|---|---|---|
| Frontend | **Astro** (contenido, historia, SEO) + islas React; o Next.js si se prefiere un único framework | SvelteKit | Astro genera HTML estático ligero con islas interactivas |
| Estilos | Tailwind CSS + shadcn/ui | — | Rapidez, consistencia |
| Gráficos | Observable Plot / Recharts / D3 | ECharts | Dashboards y líneas temporales |
| Mapas | MapLibre + OpenStreetMap | Leaflet | Gratis, sin clave obligatoria |
| i18n | `astro-i18next` o `next-intl` | — | ES/GL/EN |
| Hosting | **Cloudflare Pages** | Vercel (hobby: no comercial), Netlify | CDN global, ancho de banda generoso |
| Funciones | Cloudflare Workers / Pages Functions | Vercel Functions | Votos, proxy de APIs con caché |
| BD usuarios | **Supabase** (Postgres + Auth + RLS) | Neon, Turso, Cloudflare D1 | Auth incluido |
| Imágenes | Cloudflare R2 (10 GB) + Cloudflare Images/Astro Image | Supabase Storage | Egress gratuito en R2 |
| Datos | JSON/YAML/Parquet + SQLite (`better-sqlite3`/`sql.js`) | DuckDB-WASM | Consulta en cliente sin servidor |
| ETL | Python 3.12: `requests`, `httpx`, `beautifulsoup4`, `selectolax`, `playwright`, `pandas`, `polars`, `pydantic` | — | Ecosistema de datos |
| Modelos | `scikit-learn`, `statsmodels`, `scipy`, `numpy` | — | Poisson/Dixon-Coles, Elo, Monte Carlo |
| Automatización | **GitHub Actions** (cron, workflows) | Cloudflare Cron Triggers | Gratis para repos públicos |
| Notificaciones | Web Push (VAPID) + service worker | OneSignal (capa gratuita) | PWA |
| Email | Buttondown/Brevo (capa gratuita) **[VERIFICAR]** | Resend | Boletín semanal |
| Analítica | Cloudflare Web Analytics / Umami / Plausible CE | — | Sin cookies |
| Calidad | ESLint, Prettier, Vitest, Playwright, pytest, ruff, pre-commit | — | CI en Actions |
| Monitorización | UptimeRobot (gratis), Sentry (capa gratuita) | — | Alertas |
| IA (opcional) | Claude API para resúmenes/clasificación | Modelos locales/HF | **[VERIFICAR]** coste; opcional y acotado |

**Estructura de repositorio sugerida (monorepo)**
```
depor-hub/
├─ apps/
│  └─ web/                  # Astro/Next
├─ data/
│  ├─ raw/                  # volcados sin tocar (cacheados)
│  ├─ clean/                # JSON normalizados validados
│  ├─ manual/               # YAML curado a mano (club, junta, museo...)
│  ├─ media/                # índice de imágenes + licencias
│  └─ predictions/
├─ scripts/
│  ├─ ingest/
│  ├─ clean/
│  ├─ enrich/
│  ├─ models/
│  └─ news_social/
├─ packages/
│  └─ schemas/              # JSON Schema / Pydantic compartidos
├─ .github/workflows/       # cron jobs, CI, deploy
├─ docs/                    # decisiones (ADR), fuentes, licencias
└─ README.md
```

---

## 6. Modelo de datos

### 6.1 Entidades principales (resumen)
`club`, `season`, `competition`, `competition_season`, `match`, `match_event`, `lineup_entry`, `player`, `player_season`, `staff`, `staff_tenure`, `stadium`, `stadium_phase`, `attendance`, `kit`, `crest`, `title`, `award_individual`, `sponsor`, `sponsor_tenure`, `board_member`, `finance_record`, `transfer`, `news_item`, `social_post`, `source`, `media_asset`, `minigame_item`, `user_profile`, `vote`, `prediction`, `ranking_entry`.

### 6.2 Esquema SQL base (PostgreSQL/SQLite compatible)
```sql
CREATE TABLE source (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  url           TEXT,
  license       TEXT,            -- CC BY-SA, propietaria, uso legítimo...
  terms_notes   TEXT,
  last_checked  DATE
);

CREATE TABLE club (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  short_name    TEXT,
  founded_on    DATE,
  city          TEXT,
  country       TEXT,
  wikidata_id   TEXT,
  is_rival_of_depor BOOLEAN DEFAULT FALSE
);

CREATE TABLE season (
  id            INTEGER PRIMARY KEY,
  label         TEXT NOT NULL UNIQUE,   -- '1999-00'
  start_year    INTEGER NOT NULL,
  end_year      INTEGER NOT NULL
);

CREATE TABLE competition (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,          -- 'Primera División', 'Copa del Rey'...
  type          TEXT CHECK (type IN ('league','cup','supercup','europe','friendly','playoff')),
  tier          INTEGER,
  country       TEXT
);

CREATE TABLE stadium (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  city          TEXT,
  lat           REAL, lon REAL,
  opened_on     DATE
);

CREATE TABLE match (
  id               INTEGER PRIMARY KEY,
  season_id        INTEGER REFERENCES season(id),
  competition_id   INTEGER REFERENCES competition(id),
  round            TEXT,
  matchday         INTEGER,
  kickoff_utc      TIMESTAMP,
  home_club_id     INTEGER REFERENCES club(id),
  away_club_id     INTEGER REFERENCES club(id),
  home_goals       INTEGER,
  away_goals       INTEGER,
  home_goals_ht    INTEGER,
  away_goals_ht    INTEGER,
  extra_time       BOOLEAN,
  penalties_home   INTEGER,
  penalties_away   INTEGER,
  stadium_id       INTEGER REFERENCES stadium(id),
  attendance       INTEGER,
  referee          TEXT,
  status           TEXT,    -- scheduled, live, finished, postponed
  source_id        INTEGER REFERENCES source(id),
  confidence       TEXT CHECK (confidence IN ('verified','cross_checked','single_source','estimated'))
);

CREATE TABLE player (
  id            INTEGER PRIMARY KEY,
  full_name     TEXT NOT NULL,
  known_as      TEXT,
  birth_date    DATE,
  birth_place   TEXT,
  nationality   TEXT[],
  position      TEXT,
  height_cm     INTEGER,
  preferred_foot TEXT,
  wikidata_id   TEXT,
  tm_id         TEXT,
  photo_asset_id INTEGER
);

CREATE TABLE player_season (
  player_id     INTEGER REFERENCES player(id),
  season_id     INTEGER REFERENCES season(id),
  shirt_number  INTEGER,
  contract_until DATE,
  loan_from     TEXT,
  loan_to       TEXT,
  PRIMARY KEY (player_id, season_id)
);

CREATE TABLE lineup_entry (
  match_id      INTEGER REFERENCES match(id),
  player_id     INTEGER REFERENCES player(id),
  is_starter    BOOLEAN,
  position      TEXT,
  shirt_number  INTEGER,
  minute_in     INTEGER,
  minute_out    INTEGER,
  is_depor      BOOLEAN,
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE match_event (
  id            INTEGER PRIMARY KEY,
  match_id      INTEGER REFERENCES match(id),
  minute        INTEGER,
  added_time    INTEGER,
  type          TEXT,    -- goal, own_goal, penalty_goal, penalty_miss, yellow, red, sub_in, sub_out, var
  player_id     INTEGER,
  related_player_id INTEGER,
  club_id       INTEGER
);

CREATE TABLE kit (
  id            INTEGER PRIMARY KEY,
  season_id     INTEGER REFERENCES season(id),
  type          TEXT CHECK (type IN ('home','away','third','gk_home','gk_away','gk_third','special')),
  manufacturer  TEXT,
  main_sponsor  TEXT,
  sleeve_sponsor TEXT,
  description   TEXT,
  media_asset_id INTEGER,
  source_id     INTEGER REFERENCES source(id)
);

CREATE TABLE crest (
  id            INTEGER PRIMARY KEY,
  year_from     INTEGER,
  year_to       INTEGER,
  description   TEXT,
  media_asset_id INTEGER,
  source_id     INTEGER REFERENCES source(id)
);

CREATE TABLE attendance (
  match_id      INTEGER PRIMARY KEY REFERENCES match(id),
  attendance    INTEGER,
  capacity      INTEGER,
  season_ticket_holders INTEGER,
  source_id     INTEGER REFERENCES source(id),
  confidence    TEXT
);

CREATE TABLE news_item (
  id            INTEGER PRIMARY KEY,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL UNIQUE,
  source_name   TEXT,
  published_at  TIMESTAMP,
  tags          TEXT[],
  thumbnail_url TEXT,
  hash_title    TEXT,        -- deduplicación
  fetched_at    TIMESTAMP
);

CREATE TABLE social_post (
  id            INTEGER PRIMARY KEY,
  platform      TEXT CHECK (platform IN ('x','instagram','tiktok','youtube','facebook','other')),
  account_handle TEXT,
  account_type  TEXT CHECK (account_type IN ('club','player','staff','media','fan')),
  player_id     INTEGER,
  post_url      TEXT NOT NULL UNIQUE,
  published_at  TIMESTAMP,
  pinned        BOOLEAN DEFAULT FALSE,
  curated_by    TEXT,
  embed_allowed BOOLEAN DEFAULT TRUE
);

CREATE TABLE media_asset (
  id            INTEGER PRIMARY KEY,
  kind          TEXT,           -- crest, kit, photo, stadium, document
  storage_url   TEXT,
  origin_url    TEXT,
  license       TEXT,
  attribution   TEXT,
  permission_status TEXT CHECK (permission_status IN ('free_license','permission_granted','fair_use_risk','hotlink_only','pending'))
);
```
Tablas de usuario (solo en Supabase, con **Row Level Security**): `user_profile`, `vote`, `prediction_entry`, `game_result`, `streak`, `ranking_entry`.

### 6.3 Niveles de confianza de datos
- `verified`: coincide en ≥2 fuentes fiables o fuente oficial.
- `cross_checked`: coincide parcialmente con una segunda fuente.
- `single_source`: una sola fuente.
- `estimated`: calculado o estimado (p. ej., sueldos).
La UI muestra un icono de confianza y la fuente.

### 6.4 Convenciones
- Fechas en ISO-8601 UTC en BD; mostrar en `Europe/Madrid`.
- IDs estables y nunca reutilizados.
- Nombres de clubes normalizados con tabla de alias (`club_alias`), imprescindible por los cambios de denominación históricos.
- Nombres de jugadores con tabla de alias (apodos, grafías antiguas, transliteraciones).

---

## 7. Fuentes de datos y APIs **[VERIFICAR todo antes de implementar]**

| Dato | Fuente candidata | Tipo | Notas y riesgos |
|---|---|---|---|
| Resultados históricos | football-data.co.uk | CSV | Cubre muchas temporadas de Primera y Segunda en España; comprobar cobertura exacta |
| Historia del fútbol español | BDFutbol | Web (sin API) | Muy completa (plantillas, alineaciones, goleadores); revisar términos y no automatizar a ritmo agresivo; contactar con el autor para colaboración |
| Calendario/resultados actuales | football-data.org, API-Football, TheSportsDB | API REST | Cada plan gratuito cubre competiciones distintas; **comprobar si cubre la categoría actual del Depor** |
| Datos básicos, historia, estadio | Wikipedia, Wikidata | API/SPARQL | Licencia CC BY-SA: atribuir |
| Imágenes libres | Wikimedia Commons | API | Revisar licencia de cada archivo |
| Valor de mercado, traspasos | Transfermarkt | Web | Sus términos restringen el scraping; preferir datasets abiertos derivados o entrada manual limitada |
| Stats avanzadas | FBref, Understat, SofaScore | Web | Cobertura de Segunda limitada y cambiante; FBref restringió datos avanzados |
| Espectadores | Resultados-fútbol, Wikipedia, prensa, BDFutbol | Mixta | Cruce manual; marcar confianza |
| Límite de coste de plantilla | LaLiga (comunicados oficiales) | Documentos | Público; actualizar cada ventana |
| Cuentas anuales | Registro Mercantil, CSD, web del club | PDF | Entrada manual |
| Sueldos | Capology, prensa | Web | **Estimaciones**, etiquetar siempre |
| Noticias | RSS de medios | RSS/Atom | Solo titular + enlace |
| Vídeos | YouTube RSS / Data API v3 | RSS/API | Cuota diaria gratuita |
| Redes | Embeds oficiales | oEmbed | Ver 3.5 |
| Geolocalización | OpenStreetMap/Nominatim | API | Respetar uso justo |
| Meteorología (opcional) | Open-Meteo | API | Gratis, sin clave |
| Hemeroteca | Biblioteca Virtual de Prensa Histórica, Hemeroteca de La Vanguardia/ABC | Web | Para investigar eventos; no reproducir artículos |

**Reglas de ingesta**
1. Leer `robots.txt` y términos; guardar la decisión en `docs/sources.md`.
2. User-Agent identificable con contacto.
3. Máx. 1 petición/segundo por dominio, con backoff y caché.
4. No saltarse paywalls, captchas ni medidas anti-bot.
5. Guardar la respuesta cruda en `data/raw/` con fecha para reproducibilidad.

---

## 8. Modelos de predicción y analítica

### 8.1 Elo
- K ≈ 20-30, ventaja de local ≈ 60-100 puntos (calibrar con datos).
- Re-escalado entre temporadas (regresión a la media por cambio de plantilla/categoría).
- Salida: rating del Depor y rivales; probabilidades base.

### 8.2 Poisson / Dixon-Coles
- Parámetros de ataque y defensa por equipo, ventaja local, corrección de baja puntuación y decaimiento temporal.
- Ajuste por máxima verosimilitud con `scipy.optimize` o GLM Poisson en `statsmodels`.
- Salida: matriz de marcadores → P(1), P(X), P(2), over/under, BTTS.

### 8.3 Simulador de temporada
- 10.000+ simulaciones Monte Carlo con los partidos restantes.
- Reglas de desempate de la categoría (**[VERIFICAR]** reglamento vigente) y de playoffs.
- Salida: histograma de posición final y probabilidades de ascenso/playoff/descenso.

### 8.4 Evaluación
- Backtesting temporada a temporada.
- Métricas: log-loss, Brier score, calibración.
- Publicar métricas en la web; no prometer acierto.

### 8.5 Descargo
"Las predicciones son estadísticas con fines de entretenimiento. No son asesoramiento ni pretenden fomentar el juego con dinero." No incluir cuotas ni enlaces a casas de apuestas.

---

## 9. Plan de fases (roadmap)

### Fase 0 — Cimientos (1-2 semanas)
- Nombre, dominio, identidad visual propia (no usar el escudo como logo).
- Repo, convenciones, CI, esquema de datos, `docs/sources.md`.
- Decisión de idiomas y de framework.
- Aviso legal y de privacidad base.
- **Hito:** repo con esquema validado y despliegue "Hello World" en Cloudflare Pages.

### Fase 1 — MVP "Fan Hub" (3-5 semanas)
- Home: próximo partido, último resultado, clasificación, titulares de noticias.
- Plantilla actual con fichas básicas.
- Calendario/resultados + exportación `.ics`.
- Páginas estáticas del club (info, estadio, museo, junta, patrocinadores, enlaces).
- Agregador de noticias por RSS (cron cada 30-60 min).
- PWA instalable.
- **Hito:** web pública con datos actualizándose solos.

### Fase 2 — Redes y vídeos (1-2 semanas)
- Bloque de redes con embeds bajo consentimiento y posts curados.
- Feed de YouTube vía RSS.
- Página "Jugadores en redes".

### Fase 3 — Historia (4-8 semanas)
- Importación de todas las temporadas y partidos.
- Fichas de temporada, jugador histórico, rival.
- Buscador de partidos.
- Líneas temporales de escudo, equipaciones, estadio.
- Títulos, Europa, efemérides, momentos.
- **Hito:** archivo navegable con ≥ 90% de partidos oficiales desde 1939 (a definir) y cobertura creciente anterior.

### Fase 4 — Minijuegos y retención (3-4 semanas)
- Wordle, Higher/Lower, trivia, adivina el once.
- Rachas locales, login opcional, ranking.
- Compartir resultados, notificaciones diarias.

### Fase 5 — Analítica y predicción (4-6 semanas)
- Dashboard de temporada, Elo, Poisson, simulador, afluencia.
- Comparativa histórica.
- Página de metodología.

### Fase 6 — Comunidad y extras (continuo)
- Porras, MVP, cromos, guías, mapa de peñas, multi-idioma completo, directo, contribuciones.
- Boletín semanal.

### Fase 7 — Consolidación
- Contacto con el club/medios/peñas para colaboración o permisos.
- Mejora de SEO, rendimiento, accesibilidad.
- Evaluar monetización ética (donaciones, tienda de merchandising propio no oficial sin escudo, patrocinios locales) y migración a planes de pago si procede.

---

## 10. Viabilidad en coste cero

| Área | Veredicto | Comentario |
|---|---|---|
| Hosting + CDN + dominio .pages.dev | 🟢 | Dominio propio ~10 €/año (único gasto casi inevitable) |
| Datos del club, historia | 🟢/🟡 | Trabajo manual alto, sin coste monetario |
| APIs de resultados | 🟡 | Límite de peticiones; cachear y actualizar solo en ventanas de partido |
| Directo | 🟡 | Posible con polling prudente en horas de partido |
| Stats avanzadas | 🔴/🟡 | Dependen de acceso a datos; plan B = métricas básicas |
| Redes sociales | 🟡 | Solo embeds/curación; la lectura automática masiva suele ser de pago |
| Noticias | 🟢 | RSS gratuito |
| Predicción | 🟢 | Corre en Actions |
| Usuarios y rankings | 🟢 | Supabase gratis con tráfico moderado; atención a pausas por inactividad |
| Notificaciones | 🟢/🟡 | Web Push gratis; iOS exige PWA instalada |
| IA | 🟡 | Opcional; cuesta dinero |

**Vigilar:** pausa de proyectos Supabase inactivos, límites de minutos de GitHub Actions en repos privados (usar repo público), cuotas de APIs, cambios de términos de plataformas sociales, tope de uso no comercial en Vercel hobby.

---

## 11. Requisitos no funcionales

- **Rendimiento:** LCP < 2,5 s en 4G; Lighthouse ≥ 90.
- **SEO:** URLs limpias y estables (`/historia/temporada/1999-00`, `/rivales/celta`, `/partidos/2004-04-07-deportivo-milan`), datos estructurados Schema.org (`SportsEvent`, `SportsTeam`, `Person`), sitemap, Open Graph.
- **Accesibilidad:** WCAG 2.2 AA.
- **Seguridad:** RLS en Supabase, validación de entradas, rate limiting en funciones, secretos solo en variables de entorno/GitHub Secrets, dependabot.
- **Disponibilidad:** al ser estático, tolerar fallos de APIs mostrando última caché con marca de "actualizado el...".
- **Observabilidad:** logs de ETL con resumen en cada ejecución; alerta si un job falla.
- **Datos abiertos:** valorar publicar el dataset limpio bajo licencia abierta compatible con las fuentes (ODbL/CC BY-SA), cuando proceda.

---

## 12. Aspectos legales y éticos

1. **Marca y propiedad intelectual:** escudo, nombre, himno y equipaciones pertenecen al club. Aviso: *"Proyecto de aficionados sin vinculación oficial con el Real Club Deportivo de La Coruña, S.A.D."* No usar el escudo como logo de la web, no vender productos con él, no sugerir afiliación. Plan: escribir al club solicitando permiso o colaboración.
2. **Imágenes:** fotos de jugadores y partidos pertenecen a agencias/fotógrafos. Usar solo licencias libres, permiso expreso, ilustraciones propias o siluetas. Para históricas, registrar `permission_status` en `media_asset`.
3. **Noticias:** titular + enlace + fuente; sin copiar texto completo ni imágenes sin permiso.
4. **Redes:** usar embeds oficiales (cumplen términos de cada red); no almacenar contenido ni datos personales de terceros.
5. **Scraping:** cumplir términos, `robots.txt` y límites; si un sitio lo prohíbe, no hacerlo y buscar alternativa o pedir permiso.
6. **Datos económicos:** solo oficiales/auditados; sueldos como estimación con fuente.
7. **Datos personales de jugadores:** limitar a información profesional pública; nada de vida privada.
8. **RGPD y LSSI:** política de privacidad, aviso legal, banner de consentimiento para embeds, derecho de acceso/borrado, minimización, base legal; mayores de 14 años para cuentas (España).
9. **Juego y apuestas:** sin cuotas ni publicidad de apuestas; porras sin dinero.
10. **Contenido generado por usuarios:** moderación, normas de convivencia, canal de denuncia (DSA).
11. **Entidad responsable:** definir si es persona física o asociación; incluir contacto.

*Nota: Claude no es abogado; para decisiones de riesgo real (marca, licencias, monetización) conviene consulta profesional.*

---

## 13. Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Cambio/cierre de APIs gratuitas | Alta | Alto | Capa de abstracción, caché, múltiples proveedores |
| Reclamación por uso de marca/imágenes | Media | Alto | Aviso, evitar usos problemáticos, pedir permiso |
| Bloqueo por scraping | Media | Medio | Límites suaves, caché, alternativas, no depender de una fuente |
| Datos históricos incompletos | Alta | Medio | Niveles de confianza, crowdsourcing moderado |
| Cambios en redes (embeds) | Media | Medio | Tarjetas de enlace como respaldo |
| Burnout del equipo | Alta | Alto | Alcance por fases, automatizar, MVP pequeño |
| Costes imprevistos al crecer | Media | Medio | Presupuesto, monitorizar cuotas, plan de migración |
| Abuso en rankings/votos | Media | Bajo | Rate limiting, captcha ligero (Turnstile), RLS |

---

## 14. Decisiones pendientes (para resolver con Claude)

1. Nombre definitivo, dominio y marca visual.
2. Framework: Astro vs Next.js.
3. Idiomas en lanzamiento (ES solo o ES+GL).
4. Proveedor de resultados principal (según cobertura de la categoría actual).
5. Política exacta de imágenes (qué se aloja, qué se enlaza).
6. Entidad legal responsable.
7. Alcance de IA (¿resúmenes de noticias? ¿asistente?).
8. Estrategia para el feed social (curación manual vs automatización parcial).
9. Estructura de comunidad (¿solo juegos y porras, o foros?).
10. ¿Se contacta al club antes del lanzamiento público?

---

## 15. Estado actual del proyecto

- Fase: **0 (planificación)**.
- Hecho: esqueleto funcional, alcance ampliado, stack propuesto, fases.
- Pendiente inmediato: fijar modelo de datos; elegir framework; crear repositorio.
- Fecha del documento: 19 de octubre de 2026.

### 15.1 Hechos verificados (19-oct-2026)
- **Categoría:** el Depor juega la temporada 2026-27 en **Primera División (LaLiga)**, tras ascender en 2025-26 con Antonio Hidalgo como entrenador. Es su primera temporada en Primera desde 2017-18. (Fuentes con datos parcialmente contradictorios sobre la clasificación puntual: obtenerla siempre de la API, no de webs de terceros.)
- **Estadio:** denominación actual "Estadio Abanca-Riazor". La capacidad aparece con valores distintos según fuente (≈32.490 vs 34.611): ejemplo de dato a cruzar con fuente oficial y marcar con nivel de confianza.
- **football-data.org (plan gratuito):** 12 competiciones incluida La Liga (`PD`), 10 peticiones/minuto, marcadores con retraso, sin alineaciones/tarjetas/estadísticas de partido en el plan gratuito. Cubre calendario, resultados y clasificación; **no vale para directo ni para stats por jugador**.
- **API-Football (plan gratuito):** 100 peticiones/día, 10/min, todos los endpoints pero con **temporadas disponibles limitadas** (comprobar con una clave real si incluye 2026-27 antes de depender de ella).
- **Decisión provisional:** football-data.org como fuente principal de calendario/resultados/clasificación (cron, cacheado); API-Football como complemento puntual (alineaciones, eventos de partidos recientes) con presupuesto diario de peticiones; histórico vía CSV/BDFutbol/Wikipedia.
- **Consecuencia de producto:** al estar en Primera, hay más cobertura de datos avanzados y de prensa que en Segunda; revisar de nuevo la viabilidad de xG (FBref/Understat) en LaLiga.

---

## 16. Primeras tareas sugeridas para Claude

1. **Comparativa verificada de APIs** (límites gratuitos, cobertura de la categoría actual del Depor, términos).
2. **Auditoría de feeds RSS** de medios gallegos y nacionales: cuáles existen y funcionan.
3. **Modelo de datos definitivo** con migraciones y validadores Pydantic.
4. **Prototipo de la home** con próximo partido, resultados, noticias y bloque social.
5. **Scripts de ingesta** de resultados históricos (football-data.co.uk) y ETL base.
6. **Prototipo del Wordle del Depor** con dataset mínimo.
7. **Plantilla de GitHub Actions** (cron de noticias y resultados, CI de validación).
8. **Borrador de aviso legal, política de privacidad y texto "no oficial".**
9. **Plan de curación histórica:** lista priorizada de temporadas y fuentes por década.
10. **Guía de estilo visual** (paleta azul y blanco, tipografías, componentes).

---

## 17. Glosario

- **SAD:** Sociedad Anónima Deportiva.
- **SSG/ISR:** generación estática / regeneración incremental.
- **ETL:** extraer, transformar, cargar.
- **RLS:** Row Level Security (seguridad por filas en Postgres).
- **oEmbed:** estándar para incrustar contenido de terceros por URL.
- **xG:** goles esperados.
- **Dixon-Coles:** modelo Poisson con corrección para marcadores bajos y decaimiento temporal.
- **PWA:** aplicación web progresiva instalable.
- **ADR:** Architecture Decision Record.

---

## 18. Fuentes y referencias a documentar durante el proyecto

Mantener `docs/sources.md` con, por cada fuente: URL, qué dato aporta, licencia/términos, fecha de revisión, frecuencia de ingesta y responsable. Esta tabla es obligatoria antes de automatizar cualquier ingesta.
