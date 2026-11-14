# FASE 2 — Pipelines, cadencia y fiabilidad

> Auditoría de solo lectura realizada el **2026-11-11** sobre el estado desplegado en `origin/main` (`75ebe6e`, 2026-11-10 15:04 UTC). No se ha modificado ningún workflow, script ni dato publicado; los únicos comandos de escritura se han dirigido a `/tmp` y a este documento. `git status` solo muestra `docs/auditoria/` como no versionado.
>
> **Caveat de línea base:** el `main` local (`5759480`) está **23 commits por delante y 159 por detrás** de `origin/main`. Los 23 commits locales añaden los pasos `club titles` y `club rivalries` al workflow de datos, pero **no están desplegados**. Todas las mediciones de runs y commits se refieren a `origin/main`; las diferencias locales se señalan explícitamente.
>
> **Corrección a la FASE 0:** desde el 2026-10-19 hay **273 commits `data: refresh`**, **206 `data(news)`** y **8 `data(rivals)`** (556 commits en total), no 177/146/5. Además, desde el 2026-10-31, **179 de los 233 commits de datos (76,8 %) solo cambian timestamps**. La FASE 0 también afirmaba que las Actions seguían activas; el estado actual es el contrario (ver §2.5).

---

## Resumen ejecutivo

1. **La cadencia de 10 minutos no es la que se ejecuta de verdad.** El cron `*/10` lanza unos 138 runs/día, pero `--if-due` solo deja tocar la red cada 60 minutos fuera de ventana. El 84 % de los runs de datos termina sin commit y un run típico sin trabajo dura **13 segundos**: se paga el arranque de un runner para decidir que no había nada que hacer.
2. **El problema grave no es el número de runs, sino los commits vacíos.** `content_hash()` ignora `updatedAt` y `dataHash` de primer nivel, pero no `season.provenance.*.capturedAt`. Cada pasada real de datos reescribe cinco ficheros y crea un commit aunque no cambie ningún dato: **179 de 233 commits desde el 31-oct son solo timestamps**.
3. **El coste en Actions es irrelevante en dinero y alto en ruido.** El repo es público y los runners estándar son gratuitos. En un hipotético repo privado, la cadencia actual consumiría del orden de **8.600 minutos facturables/mes** (~45 USD/mes por encima de un plan Pro); el 55-60 % sería trabajo sin commit.
4. **Una sola pasada diaria no basta para el producto, pero 144 pasadas diarias son excesivas.** Los datos de clasificación/calendario cambian sobre todo los días de partido; las noticias sí necesitan una cadencia horaria. La recomendación es **base horaria + ventana densa de partido**, no `*/10` permanente.
5. **La fiabilidad está dominada por el deploy y por BDFutbol.** Data ha fallado 9 veces de 1.672; Rivals, **2 de 10 (20 %)**, por 403 de BDFutbol. El deploy de Pages acumula `configure-pages Not Found`, fallos de ID token y timeouts de 10 minutos; además, tres workflows publican el mismo Pages y compiten por el límite de 10 builds/hora.
6. **Hay fallos silenciosos.** `match-details` captura el error de BDFutbol, imprime un aviso y **devuelve 0**: el workflow sale verde sin alineaciones ni eventos. `rivals` solo conserva el fichero anterior si *ningún* rival tiene histórico; una degradación parcial (1 de 19) sobrescribe los otros 18 con `null`.
7. **El health check no sirve como semáforo.** Consulta los últimos 50 runs globales; el run diario de Rivals nunca entra en esa ventana, su `conclusion` queda `null` y `status.json` publica `ok:false` de forma casi permanente. Además, solo vigila Data/News/Rivals, no Health ni CI, y no alerta a nadie.
8. **Estado actual confirmado:** `actions/permissions.enabled=false` desde después de las 15:32 UTC del 10-nov; los siete workflows siguen figurando `state:active`. “Activo” es el estado del workflow, no el permiso efectivo del repositorio. La premisa de “Actions pausadas” es cierta **ahora**, no cuando se midió la FASE 0.

---

## 1. Mapa de pipelines

### 1.1 Workflow → cron → pasos → llamadas → ficheros → duración → cambios

Medición sobre 22 días (2026-10-20 10:06 → 2026-11-10 15:32 UTC). Duraciones en minutos, calculadas como `updated_at − run_started_at` del run completo.

| Workflow | Cron / disparo | Pasos principales | Llamadas externas por ejecución | Ficheros que puede escribir | Duración media / mediana / p90 / máx | Runs | Commits atribuibles |
|---|---|---|---|---|---:|---:|---:|
| **Data refresh** (`data-refresh.yml`) | `*/10 * * * *` + `workflow_dispatch(force)` | checkout → setup-python → `pip install -e scripts` → restore `ingest-state` → `ingest --if-due` → `snapshots` → `match-details` → `club` → `club-images` → save state → `validate` → commit con rebase (5 intentos) → deploy Pages si `changed` | **4-5** a football-data.org si toca refresco (`/competitions/PD`, `/standings`, `/matches`, `/teams`, `/teams/{id}` opcional); **1** a BDFutbol (`schedule`) + **1 por partido terminado pendiente**; 0 llamadas de red si `due=false` | `standings.json`, `fixtures.json`, `squad.json`, `meta.json`, `season.json`; `snapshots/{season}/{id}.json`; `match-details/{season}/{id}.json`; `club.json`; `img/club/**` | **0,62 / 0,35 / 1,07 / 24,02** | 1.672 | **273** (16,3 %) |
| **News refresh** (`news-refresh.yml`) | `*/30 * * * *` + `workflow_dispatch(force)` | checkout → setup-python → `pip install` → restore `news-cache` → `news` → `validate` → save cache (`always`) → commit → deploy si `changed` | **5 feeds** RSS/Atom con `ETag`/`If-Modified-Since` (YouTube del club, Riazor.org, DXT Campeón, La Voz de Galicia, Marca); no descarga páginas de artículo | `news.json`, `social.json`; caché `data/raw/news` | **0,79 / 0,47 / 1,17 / 19,63** | 488 | **206** (42,2 %) |
| **Health** (`health.yml`) | `*/30 * * * *` + `workflow_dispatch` | checkout → setup-python → `pip install` → `curl /actions/runs?per_page=50` → `status --soft` → checkout huérfano `status-publish` → commit → `git push --force` | **1** a la API de GitHub | `status.json` en la rama `status` (no Pages) | **0,32 / 0,32 / 0,37 / 0,93** | 251 | 251 escrituras de status (force-push, sin historial) |
| **Rivals refresh** (`rivals-refresh.yml`) | `17 6 * * *` + `workflow_dispatch(force)` | checkout → setup-python → `pip install` → restore `h2h-cache` → `rivals --interval 1` → `validate` → save cache → commit → deploy si `changed` | **1** a football-data.org (`/teams`) + **19** a BDFutbol (una ficha h2h por rival) | `rivals.json`; caché `data/raw/enrich/h2h` | **0,97 / 0,96 / 1,33 / 1,35** | 10 | **8** (80 %) |
| **CI** (`ci.yml`) | `pull_request` + `push` a `main` | 3 jobs: `mobile` (npm ci, lint, typecheck, jest, expo-doctor informativo), `python` (ruff, pytest, pip-audit, validate, schemas + `git diff`), `secrets` (gitleaks) | npm registry, PyPI, GitHub; ninguna fuente de datos | Ninguno (valida `data/public/v1` y `packages/schemas`) | **0,91 / 0,85 / 1,63 / 1,92** | 45 | 0 |
| *Enrich proposal* (`enrich.yml`) | Solo `workflow_dispatch` | Proponer enriquecimiento, artefacto 14 días | BDFutbol / fuentes de enriquecimiento | Propuesta fuera de `data/public` | No medido (manual) | — | — |

**Lectura de la tabla:**

- Data es el único workflow que se ejecuta cada 10 minutos. News y Health van cada 30; Rivals, una vez al día.
- En un run de Data sin refresco, `ingest` sale en **0 s**; el resto de pasos locales (snapshots, match-details, club, club-images, validate, commit) también en 0-1 s. El coste real es el arranque: **13 s** medidos de principio a fin (run `42843650039`: 15:22:33 → 15:22:46 UTC).
- En un run con commit, el deploy añade entre **6 s y 3 min**. El deploy de `42840496473` (News) tardó **3 min 04 s** (15:04:40 → 15:07:48); en los fallos por timeout el job de deploy agota los **10 min**.
- Health no publica en Pages: fuerza un commit huérfano en la rama `status` en cada pasada, así que no deja historial.
- Rivals con caché caliente tarda ~1 s en la fase de datos; el riesgo no es la duración, es el 403 de BDFutbol.

### 1.2 Qué recupera cada pipeline (y qué no)

| Pipeline | Qué recupera de verdad | Qué no recupera |
|---|---|---|
| **Data** | Clasificación, calendario, plantilla, resumen de temporada y metadatos de football-data.org. Snapshot y detalle de partidos terminados que aún no estén congelados. Ficha de club desde YAML curado. | No recupera noticias, ni rivales, ni títulos/rivalidades en `origin/main`. Tampoco vuelve a escribir un snapshot o detalle ya existente (salvo `--force`). |
| **News** | Titulares, vídeos y metadatos de 5 feeds; deduplicación, relevancia y rotación. Regenera `social.json` aunque la app no lo consuma. | No descarga el cuerpo de los artículos ni las imágenes: solo lo que publica el feed. |
| **Health** | Un resumen de presencia/frescura de ficheros y del último run de Data/News/Rivals. | No mide duración, no-op rate, retardos de cron, colas ni fallos de deploy. No vigila Health ni CI. |
| **Rivals** | Histórico BDFutbol de los 19 rivales de la temporada, contexto y goleadores. | No actualiza si no hay caché y BDFutbol bloquea; no recupera rivales que no estén en `fixtures`. |

### 1.3 Discrepancia local vs `origin/main`

| Elemento | `origin/main` (auditado) | `main` local (`5759480`) |
|---|---|---|
| Pasos de Data | Hasta `club-images`; después `validate` y commit | Añade **`club titles --proposal`** y **`club rivalries`** antes de `validate` (líneas 65-72 del fichero local) |
| `titles.json` / `rivalries.json` | **404** en Pages | Existen en el árbol local, no publicados |
| Riesgo | — | Si se fusiona tal cual, `club rivalries` se ejecutaría **cada 10 minutos** y haría hasta 19 peticiones a BDFutbol por run (~2.700/día, ~82.000/mes) |

La rama local no es el objeto de esta auditoría, pero es un riesgo latente de primer orden: convertiría un workflow de datos ya ruidoso en un scraper de BDFutbol cada 10 minutos.

---

## 2. Medición de Actions

### 2.1 Runs, éxito y duración

Ventana: 2026-10-20 10:06 → 2026-11-10 15:32 UTC (22 días). Fuente: `GET /repos/angelvilarino/depor-hub/actions/runs?per_page=100` paginado (2.487 runs, de los que 21 son runs dinámicos de Dependabot/actualizaciones de actions y no se incluyen en la tabla).

| Workflow | Runs | OK | Fallos | Cancelados | Media | Mediana | p90 | Máx | Minutos totales | Retardo cron mediana / p90 / máx | Runs/día desde 31-oct |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Data refresh | 1.672 | 1.663 | 9 | 0 | 0,62 | 0,35 | 1,07 | 24,02 | **1.040** | **139 s / 375 s / 599 s** | **~138** |
| News refresh | 488 | 482 | 2 | 4 | 0,79 | 0,47 | 1,17 | 19,63 | **387** | **230 s / 380 s / 1.262 s** | **48** |
| Health | 251 | 250 | 1 | 0 | 0,32 | 0,32 | 0,37 | 0,93 | **80** | **128 s / 204 s / 1.026 s** | **48** (desde 5-nov) |
| Rivals refresh | 10 | 8 | 2 | 0 | 0,97 | 0,96 | 1,33 | 1,35 | **10** | — (diario) | **1** |
| CI | 45 | 35 | 10 | 0 | 0,91 | 0,85 | 1,63 | 1,92 | **41** | — | — |
| **Total** | **2.466** | **2.438** | **24** | **4** | — | — | — | — | **1.558** | — | — |

- La tasa de éxito es alta en Data (99,5 %), News (98,8 %) y Health (99,6 %), pero **Rivals falla 2 de cada 10** y CI, 10 de 45 (22,2 %).
- Los minutos totales medidos (1.558) no equivalen a minutos facturables: GitHub redondea cada job al minuto y los runs con commit tienen dos jobs (refresh + deploy). La proyección facturable se hace en §2.4.
- Health solo lleva 251 runs porque se incorporó el 5-nov; su media diaria de 48 es la de los días completos (6-9 nov).
- La proyección mensual de §2.4 y §4 usa la cadencia vigente desde el 31-oct (138 runs/día de Data, 48 de News/Health, 1 de Rivals), no el promedio de los 22 días: antes del 31-oct Data era horaria y por eso el total medido es menor.

### 2.2 El cron no entrega la cadencia que promete

Desde el 31-oct, con el cron `*/10` ya activo:

| Workflow | Intervalo mediano entre runs | p90 | p99 | Máximo | Huecos > 15 min | Huecos > 30 min |
|---|---:|---:|---:|---:|---:|---:|
| Data refresh | **9,9 min** | **13,0 min** | **32,2 min** | **71,8 min** | 72 | **17** |
| News refresh | 29,7 min | 32,9 min | 38,7 min | 91,8 min | 483 | 238 |
| Health | 30,0 min | 31,2 min | 40,3 min | 41,8 min | 250 | 117 |

- El retardo respecto al slot teórico es de **2 min 19 s de mediana** y **6 min 15 s en p90** para Data; el máximo medido es **9 min 59 s**, justo antes del siguiente slot.
- En 11 días hay **17 huecos de más de 30 minutos** y uno de **71,8 minutos**. GitHub no garantiza puntualidad y, en repos con poca actividad, puede saltarse ejecuciones. La promesa de “datos cada 10 minutos” no se cumple de forma estricta ni siquiera con el cron denso.
- News tiene un máximo de **91,8 minutos** entre pasadas: más de tres slots perdidos. Health llega a **41,8 minutos**.
- Conclusión: si se necesita una frescura de 10 minutos, no basta con un cron; hace falta un disparador externo o aceptar que la frescura real es “10 minutos nominales, 13-30 minutos habituales, con huecos de hasta 72 minutos”.

### 2.3 Commits y trabajo vacío

#### Commits por tipo (desde 2026-10-19)

| Prefijo | Commits | % del total | Desde 31-oct |
|---|---:|---:|---:|
| `data: refresh` | **273** | 49,1 % | 233 |
| `data(news)` | **206** | 37,1 % | 206 |
| `data(rivals)` | **8** | 1,4 % | 8 |
| Otros (merge, docs, código) | 69 | 12,4 % | 58 |
| **Total** | **556** | 100 % | 505 |

#### Clasificación de los commits de datos desde 2026-10-31

Se descargó el parche de cada commit y se ignoraron las líneas que solo contenían `updatedAt`, `capturedAt`, `dataHash` o llaves de cierre.

| Fecha | Solo timestamps | Cambio real | Total |
|---|---:|---:|---:|
| 2026-10-31 | 2 | 10 | 12 |
| 2026-11-01 | 14 | 7 | 21 |
| 2026-11-02 | 20 | 9 | 29 |
| 2026-11-03 | 21 | 0 | 21 |
| 2026-11-04 | 21 | 0 | 21 |
| 2026-11-05 | 20 | 1 | 21 |
| 2026-11-06 | 20 | 1 | 21 |
| 2026-11-07 | 16 | 14 | 30 |
| 2026-11-08 | 13 | 9 | 22 |
| 2026-11-09 | 21 | 1 | 22 |
| 2026-11-10 | 11 | 2 | 13 |
| **Total** | **179 (76,8 %)** | **54 (23,2 %)** | **233** |

Ejemplo confirmado (`aed883f`, 2026-11-10 14:32 UTC): cinco ficheros, `+1/-1` en `fixtures.json`, `squad.json` y `standings.json`; `+4/-4` en `season.json` por tres `capturedAt` anidados; `meta.json` cambia `updatedAt` y `dataHash`. Ningún dato deportivo cambia.

#### Runs sin commit

| Workflow | Runs sin commit | % de sus runs | Minutos de runner sin commit | % de sus minutos |
|---|---:|---:|---:|---:|
| Data refresh | **1.398** | **84,0 %** | **665** | **63,9 %** |
| News refresh | **282** | **57,9 %** | **158** | **40,8 %** |
| Rivals refresh | 2 | 20,0 % | 1 | 10,0 % |
| **Total** | **1.682** | **78,0 %** | **824** | **54,3 %** (sin CI) |

- “Sin commit” no siempre significa “sin red”: un run de Data puede refrescar de verdad y no cambiar el contenido. Pero **~120 de los 138 runs diarios salen antes de tocar la red** porque `--if-due` decide que no toca.
- El run vacío no es gratis: instala el paquete, restaura caché, arranca Python cinco veces y valida. Son ~13 s de trabajo útil cero, pero **1 minuto facturable** por job si el repo fuera privado.

#### Coste del trabajo vacío (proyección a 30 días con la cadencia actual)

| Concepto | Medido en 22 días | Proyección 30 días |
|---|---:|---:|
| Runs de Data sin commit | 1.398 | **~3.684** |
| Minutos de runner de esos runs | 665 | **~1.768 min (29,5 h)** |
| Runs de News sin commit | 282 | **~879** |
| Minutos de runner de esos runs | 158 | **~492 min (8,2 h)** |
| Commits de datos solo timestamp | 179 (11 días) | **~489** |
| Deploys provocados por esos commits | 179 (11 días) | **~489** |
| Minutos de deploy de esos commits | ~90 (11 días) | **~245 min (4,1 h)** |
| **Total low-value** | — | **~2.500 min/mes (~42 h)** |

Ese total es el **58-60 %** de los ~4.250 minutos/mes que consumiría la cadencia actual. En dinero, con repo público: **0 €**. En un repo privado: ~4.500 minutos facturables de trabajo low-value al mes, ~36 USD/mes solo en ruido.

### 2.4 Coste de las cadencias

Supuestos: 30 días/mes; duración media medida por workflow; cada job se redondea al minuto; repo público = runners estándar gratuitos. La tarifa privada de referencia es la de GitHub para Linux 2-core (~0,008 USD/min) y se usa solo como orden de magnitud.

| Escenario | Runs/mes | Minutos de runner/mes | Minutos facturables/mes (privado) | Sobre 3.000 min de Pro | Coste extra aprox. |
|---|---:|---:|---:|---:|---:|
| **Actual** (`*/10` + `*/30`) | **~7.230** | **~4.250** | **~8.600** | +5.600 | **~45 USD/mes** |
| Solo corregir `content_hash` | ~7.230 | ~4.250 | ~8.100 | +5.100 | ~41 USD/mes |
| **Híbrida recomendada** | **~2.100** | **~1.300** | **~2.000** | 0 | **0 USD/mes** |
| Una diaria | ~120 | ~65 | ~200 | 0 | 0 USD/mes |
| Manual + diaria | ~140 | ~80 | ~230 | 0 | 0 USD/mes |

> En repo público, **todas** las opciones cuestan 0 €. El argumento para cambiar no es el dinero: es el ruido de commits, la carga sobre BDFutbol, la fragilidad del deploy y la calidad de la señal de salud.

### 2.5 Estado actual: Actions deshabilitadas, workflows “active”

| Comprobación | Resultado | Fecha/hora |
|---|---|---|
| `GET /repos/angelvilarino/depor-hub/actions/permissions` | `{"enabled": false, "sha_pinning_required": false}` | 2026-11-11 08:37 UTC |
| Último run | `42845450576` News refresh, 2026-11-10 15:32:48 UTC | — |
| Runs posteriores | **Ninguno** en ~17 h | — |
| `GET /actions/workflows` | 7 workflows, todos `state: active` | 2026-11-11 08:37 UTC |
| `status.json` | `updatedAt: 2026-11-10T15:32:24Z`, `ok: false` | — |

**No hay contradicción, hay dos niveles distintos:**

- `state: active` es el estado **del workflow** (no está deshabilitado manualmente en su página).
- `actions/permissions.enabled=false` es el permiso **del repositorio**: aunque el workflow esté “active”, GitHub no lo ejecutará.

La FASE 0 midió runs hasta el 10-nov 15:32 y concluyó que las Actions seguían activas. La comprobación de hoy confirma que se deshabilitaron **después** de esa medición. Para la auditoría, el estado vigente es: **pipelines parados, datos congelados a 10-nov 15:32, workflows nominalmente activos**. Si se reactivan sin corregir la cadencia, se recupera el problema descrito en esta fase.

---

## 3. ¿Bastaría un refresco al día?

**Para los datos de clasificación, calendario y plantilla, sí en la mayoría de los días; para el producto completo, no.**

- La clasificación y el calendario solo cambian cuando se juega un partido. Un refresco diario a primera hora recupera todo lo del día anterior. En un día sin partido, 143 de los 144 runs de Data no aportan nada.
- En día de partido, un refresco diario dejaría la clasificación y el calendario **hasta 24 horas desactualizados** justo cuando el usuario abre la app. Los detalles de alineaciones/eventos necesitan una pasada después del partido, no 10 minutos antes.
- Las noticias sí cambian a lo largo del día; un refresco diario es claramente insuficiente para una pestaña de noticias.
- La app ya tolera datos de hasta 24 horas (React Query `staleTime` 5-10 min y caché de 7 días), pero la experiencia de un partido en directo depende de que el pipeline haya corrido en la ventana.

**Respuesta corta:** un único refresco diario **no basta** para días de partido ni para noticias; un único refresco **cada hora** sí basta para el 90 % del tiempo, con una ventana densa alrededor del partido. No hace falta un `*/10` permanente.

---

## 4. Comparativa de cadencias

### 4.1 Tabla comparativa

| Opción | Data | News | Health | Rivals | Runs/mes | Min runner/mes | Deploys/mes | Frescura de datos | Complejidad | Veredicto |
|---|---|---|---:|---:|---:|---:|---:|---|---|---|
| **Actual** | `*/10` (144/día) | `*/30` (48/día) | `*/30` (48/día) | 1/día | **~7.230** | **~4.250** | **~1.220** | 10 min nominal; p90 13 min; huecos de hasta 72 min | Baja (ya está) | **No**: 84 % de runs sin commit y 77 % de commits vacíos |
| **Una diaria** | 1/día | 1/día | 1/día | 1/día | ~120 | ~65 | ~60 | 24 h | Baja | **No**: rompe días de partido y noticias |
| **Diaria + ventana de partido (estricta)** | 1/día + `*/10` solo en ventana (4 partidos/mes ≈ 72 runs) | 1/hora | 4/día | 1/semana | **~950** | **~600** | **~350** | 24 h base; 10 min en ventana | Media: requiere disparador externo o `workflow_dispatch` | **Buena** si se acepta el cron externo ya documentado |
| **Base horaria + banda densa de fin de semana** | 1/hora + `*/10` sáb/dom 12-23 UTC (~626 runs extra) | 1/hora | 4/día | 1/semana | **~2.100-2.250** | **~1.300-1.380** | **~450-550** | 60 min base; 10 min en ventana | Baja-media: solo cron de GitHub | **Recomendada** |
| **Manual + diaria** | 1/día + `workflow_dispatch` antes/después de partido | 2/día | 1/día | 1/semana | ~140 | ~80 | ~90 | 24 h o manual | Baja | **No**: depende de que alguien se acuerde |

> “Deploys/mes” incluye los deploys de datos, noticias y rivales. Con la corrección de `content_hash`, la opción híbrida baja a **~450-550 deploys/mes** (frente a ~1.220): los commits de datos pasan de ~21/día a ~5/día, y News hourly reduce sus commits, pero sigue siendo la fuente principal de publicaciones.

### 4.2 Cálculo de la opción recomendada

- **Data:** cron horario `0 * * * *` = 24 runs/día → 720/mes. Banda densa sábado y domingo 12-23 UTC, `*/10` = 12 h × 2 días × 4,33 semanas × 6 = **~626 runs/mes**. Total ~1.346. En la banda densa, `--if-due` sigue decidiendo: solo refresca cada 10 min si hay partido en ventana; si no, sale en 13 s.
- **News:** `0 * * * *` = 720/mes. Si el producto exige más inmediatez, `*/30` = 1.440/mes; sigue siendo menos que la mitad del total actual.
- **Health:** `0 */4 * * *` = 180/mes. Con `*/6`, 120/mes.
- **Rivals:** `0 6 * * 1` = 4/mes. Si se quiere actualizar tras cada jornada, añadir un `workflow_dispatch` manual o un cron los lunes y jueves.
- **Total:** 1.346 + 720 + 180 + 4 ≈ **2.250 runs/mes**; ~1.350 minutos de runner; ~2.000 minutos facturables en un repo privado (dentro de los 3.000 de Pro).

### 4.3 Recomendación final inequívoca

**Recomiendo la opción “base horaria + banda densa de fin de semana”, precedida por la corrección de `content_hash` y seguida de la consolidación del deploy.**

En concreto:

1. **Data:** `0 * * * *` como base y `*/10 12-23 * * 6,0` como ventana densa. Mantener `--if-due`; añadir `workflow_dispatch` para partidos entre semana. No volver a poner `*/10` permanente.
2. **News:** `0 * * * *`. Si el producto necesita 30 minutos, mantener `*/30` solo para News; el ahorro de Data sigue siendo el 80 %.
3. **Health:** `0 */4 * * *`. El estado no cambia cada 30 minutos y el force-push cada 30 minutos no aporta historial.
4. **Rivals:** `0 6 * * 1` (semanal) y un dispatch manual tras jornadas con cruces relevantes.
5. **Antes de aplicar la cadencia:** corregir `content_hash` para ignorar `provenance.*.capturedAt` de forma recursiva (o no escribir `updatedAt` si el contenido canónico no cambió). Sin esto, la cadencia híbrida seguirá generando ~5 commits/día de datos, pero al menos no 21.
6. **Después:** consolidar el deploy en un solo workflow reutilizable o en un `workflow_run` que despliegue una vez por cambio real; hoy hay tres copias del mismo bloque y tres workflows compitiendo por Pages.

**No recomiendo** la opción de una sola pasada diaria: ahorra minutos, pero deja la app sin datos el día de partido y sin noticias durante 24 horas. **Tampoco recomiendo** mantener `*/10` permanente “por si acaso”: el 84 % de esos runs no publica nada y el cron ni siquiera garantiza los 10 minutos.

---

## 5. Candidatos a eliminar o mover

| Candidato | Dónde está | Por qué | Destino propuesto |
|---|---|---|---|
| `*/10` permanente de Data | `data-refresh.yml:7` | 84 % de runs sin commit; solo ~21 pasadas reales/día | Base horaria + banda de partido |
| `club` y `club-images` en cada run de Data | `data-refresh.yml:56-64` | El club cambia rara vez; `club-images --offline` solo comprueba que existan | Workflow semanal `club-refresh` o manual |
| `snapshots` y `match-details` en cada run | `data-refresh.yml:50-55` | Solo hacen trabajo si hay un partido terminado sin congelar | Ejecutar en la ventana post-partido (o hourly) |
| `validate` en cada run sin cambios | `data-refresh.yml:79-80`, `news-refresh.yml:50-51` | Valida 3,9 MB de JSON que no ha cambiado | Solo si `changed=true`; dejar validación completa en CI |
| `social.json` regenerado en News | `cli.py:646-652` | La app no lo consume; se reescribe con timestamps | Eliminar del pipeline o pasarlo a semanal |
| Health cada 30 min | `health.yml:6` | El estado no cambia tan rápido; force-push sin historial | Cada 4-6 horas o solo tras fallo |
| Rivals diario | `rivals-refresh.yml:5` | El histórico solo cambia cuando se juega un cruce | Semanal + dispatch tras jornada |
| Deploy duplicado en 3 workflows | `data-refresh.yml:107-133`, `news-refresh.yml:82-108`, `rivals-refresh.yml:80-106` | Tres copias del mismo bloque; compiten por Pages | Un `publish.yml` reutilizable o `workflow_run` |
| `club titles` / `club rivalries` del árbol local | `data-refresh.yml` local, líneas 65-72 | Multiplicarían BDFutbol por 144 | Workflow semanal separado, nunca en el `*/10` |
| `enrich.yml` con artefacto de 14 días | `enrich.yml` | Es manual y no forma parte de la cadencia; el artefacto caduca | Mantener manual, pero documentar que no es un pipeline de producción |

**No eliminar:** el `validate` de CI, el `gitleaks`, el `pip-audit` ni la validación de esquemas. Son baratos y protegen contratos.

---

## 6. Fiabilidad

### 6.1 Fallos medidos

| Workflow | Fallos | Detalle |
|---|---:|---|
| Data refresh | **9 / 1.672** | 4 × `configure-pages` Not Found (21-22 oct); 1 × push HTTP 500; 1 × `fetch first` (carrera de push); 1 × fallo de ID token en deploy; 2 × runs huérfanos con solo el deploy skipped (9-nov) |
| News refresh | **2 / 488** (+4 cancelados) | 4 × timeout de deploy (repartidos entre fallos y cancelaciones); 1 × push rechazado por `commit_refs_rules`; cancelaciones por concurrencia |
| Health | **1 / 251** | 1 fallo puntual de infraestructura/API; no se ha podido clasificar con más detalle. El `--soft` evita que un `ok:false` tumbe el workflow, pero no protege de un fallo del propio job |
| Rivals refresh | **2 / 10** | **403 de BDFutbol** en la fase de histórico |
| CI | **10 / 45** | Fallos de lint/test/auditoría; no se han clasificado uno a uno en esta fase |

### 6.2 Carreras de push y fragilidad del deploy

- Data y Rivals comparten `concurrency: data-publish` (`data-refresh.yml:20-22`, `rivals-refresh.yml:18-20`), pero **News tiene su propio grupo** (`news-publish`). Data y News pueden hacer push a `main` a la vez; el rebase de 5 intentos lo mitiga, no lo elimina.
- Los tres workflows hacen `git pull --rebase origin main` y `git push` dentro de un bucle con `sleep` creciente (`data-refresh.yml:93-102` y equivalentes). Un `fetch first` o un 500 de la API deja el run en rojo después de haber generado el commit local.
- Pages se despliega desde un checkout nuevo de `main` (`ref: main`, `fetch-depth: 1`) y se serializa en `pages-deploy`. Eso evita que dos snapshots se pisen, pero **no evita que se encolen**: si Data y News publican a la vez, el segundo deploy espera y puede agotar los 10 minutos.
- Límite de Pages: **10 builds/hora**. Con ~21 commits de datos/día + ~19 de noticias/día, la media es ~1,7/h, pero en una tarde de partido con commits cada 10 minutos + noticias cada 30 se puede rozar el límite y provocar esperas/timeouts.
- `configure-pages@v5` falló con “Not Found” en 4 runs de octubre: el entorno `github-pages` o Pages aún no estaba listo. Es un fallo de arranque, no recurrente, pero no hay retry.
- El deploy sube **todo `data/public` (3,9 MB)** desde cero en cada commit. No hay caché de artefactos ni build incremental; el coste es pequeño, pero el acoplamiento es alto: un cambio de una línea en `standings.json` redespliega también las 58 imágenes.

### 6.3 Dependencia de BDFutbol

- Rivals hace 19 peticiones a BDFutbol por pasada (una por rival) con `--interval 1`; `PoliteClient` respeta robots.txt y espacia las peticiones. En 10 runs, **2 acabaron en 403**.
- `SourceBlocked` no reintenta: 403/429/202 se consideran bloqueo definitivo (`enrich/http.py:321-324`). Es una decisión correcta deontológicamente, pero deja el pipeline a merced de la disponibilidad de la fuente.
- `cmd_match_details` captura `SourceError` al leer el calendario de BDFutbol, imprime un aviso y **devuelve 0** (`cli.py:418-421`). El workflow sale verde aunque no se haya publicado ningún detalle. Lo mismo ocurre por partido: si falla una ficha, se marca `unresolved`, se sigue y el run termina bien.
- `_keep_previous_rivals` solo protege el caso de **0 rivales con histórico** (`cli.py:164-181`). Si BDFutbol devuelve 1 de 19, el guard no se activa, se publica un `rivals.json` con 1 histórico y 18 `null`, y se pierde la información anterior. Es el fallo más peligroso de la fase: una degradación parcial se convierte en pérdida de datos.
- El parser de BDFutbol es HTML con expresiones regulares sobre clases y textos exactos (`tipus1`, `text-right`, `text-left`, `text-blanc`, `Suplentes`, `Entrenadores`, `País de nacimiento`, `Fecha de nacimiento`). Cualquier cambio de maquetación o traducción rompe el parseo; el guard de Rivals solo lo detecta si fallan **todos** los rivales.

---

## 7. Parsers frágiles

| Fuente / parser | Mecanismo | Fragilidad | Detección actual | Recomendación |
|---|---|---|---|---|
| **BDFutbol — calendario** (`bdfutbol.py:618-680`) | Regex sobre `<tr>`, `<a href="../j/jNNN.html">`, celdas `<td>` | Alta: rutas relativas, clases y estructura de tabla | `SourceError` → aviso y `return 0` en match-details | Test de contrato con HTML guardado; fallar el run si no hay calendario en día de partido |
| **BDFutbol — detalle de partido** (`bdfutbol.py:717-731, 807-808`) | Búsqueda de literales `<div class="row pt-1...">`, `<h2>Suplentes</h2>`, `<h2>Entrenadores</h2>` | Alta: depende de clases y encabezados en español | `unresolved` + aviso; run verde | Marcar `degraded` en status y alertar; conservar el detalle anterior si existe |
| **BDFutbol — h2h** (`rivals.py:98-102`, `bdfutbol.py:592-703`) | Regex sobre tablas y enlaces `../r/rNNN.html` | Alta: HTML de histórico | `SourceBlocked` o `SourceError`; Rivals falla solo si 0 históricos | Guard por **pérdida relativa**: no publicar si `with_history < previous_with_history` |
| **BDFutbol — ficha de jugador** (`bdfutbol.py:183-229`) | Búsqueda de etiquetas `>País de nacimiento<`, `>Fecha de nacimiento<` | Alta: texto exacto | Campos vacíos, no error | Validación de campos mínimos y aviso agregado |
| **RSS/Atom de noticias** (`news/parse.py`) | `xml.etree.ElementTree`, sin `feedparser` | Media: feeds mal formados o con namespaces raros | `FeedFetch.error`; si fallan todos, exit 1; si fallan algunos, publica parcial | Mantener; añadir alerta si una fuente falla 3 pasadas seguidas |
| **football-data.org** | JSON validado con Pydantic | Baja: API estable y tipada | `ValidationError` / `SourceError`; run rojo | Mantener; ya hay reintentos 429/5xx en `client.py` |
| **Worker `live-proxy/transform.js`** | Contrato duplicado en JS, sin tests en CI | Media-alta: puede divergir del Pydantic/Zod | Ninguna: no se despliega ni se prueba | Test de contrato o eliminar hasta que se despliegue (ADR 0030) |

**Patrón común:** los parsers de BDFutbol no fallan de forma ruidosa; degradan con avisos y el workflow sigue verde. La observabilidad actual no distingue “no había nada que hacer” de “la fuente cambió y no supimos leerla”.

---

## 8. Observabilidad

### 8.1 Qué publica `status.json`

```json
{
  "updatedAt": "2026-11-10T15:32:24Z",
  "commit": "75ebe6e...",
  "ok": false,
  "files": [
    { "name": "meta.json", "present": true, "ageMinutes": 59, "detail": null },
    { "name": "club.json", "present": true, "ageMinutes": 13278, "detail": null },
    { "name": "social.json", "present": true, "ageMinutes": 14592, "detail": null }
  ],
  "workflows": [
    { "name": "Data refresh", "conclusion": "success", "updatedAt": "..." },
    { "name": "News refresh", "conclusion": "success", "updatedAt": "..." },
    { "name": "Rivals refresh", "conclusion": null, "updatedAt": null }
  ]
}
```

### 8.2 Problemas concretos

1. **`per_page=50` global.** `health.yml:37-41` pide los últimos 50 runs del repo, no los de cada workflow. Data y News generan ~186 runs/día, así que la ventana cubre ~4-6 horas. El run diario de Rivals casi nunca entra. `_status_workflows` descarta los runs con `conclusion is None` (`cli.py:963-980`), no encuentra candidato y publica `conclusion: null`. `ok = workflows_ok` exige que **todos** sean `success` (`cli.py:1015-1019`), así que `ok` es `false` de forma casi permanente.
2. **Sin umbrales de frescura.** `required_missing` solo comprueba presencia, no antigüedad (`cli.py:1002-1013`). `club.json` lleva 13.278 minutos (9,2 días) y `social.json` 14.592 (10,1 días), pero no hay ningún campo que los marque como sospechosos. Un dato requerido podría estar congelado durante días y `ok` seguiría siendo `true` si los workflows están verdes.
3. **Solo tres workflows.** Health no se vigila a sí mismo, ni vigila CI, ni el deploy de Pages. Tampoco distingue “último run verde” de “último run con datos”.
4. **Sin alertas.** No hay Slack, email, issue automática ni webhook. El único consumidor de `status.json` sería una persona que abra la rama `status`; la app no lo consume (no hay `useStatus`).
5. **Sin historial.** `git push --force origin HEAD:status` (`health.yml:63`) reescribe la rama en cada pasada. No se puede ver la evolución de `ok`, ni correlacionar un fallo con un deploy, ni calcular disponibilidad.
6. **`--soft` oculta el rojo en GitHub.** El workflow de Health termina en verde aunque `ok:false` (`cli.py:1035`). Es intencionado para no perder el diagnóstico, pero significa que la UI de Actions no avisa de nada; solo el JSON lo sabe.
7. **Sin métricas de pipeline.** No se registran duración, no-op rate, retardo de cron, longitud de cola, commits vacíos ni tasa de fallo por fuente. Todo lo de esta fase se ha reconstruido con `gh api` a posteriori.

### 8.3 Qué añadir (mínimo viable)

- Consultar los runs **por workflow** (`/actions/workflows/{id}/runs?per_page=1`) o filtrar por `path` con `per_page=100`; no depender de una ventana global.
- Añadir `ageMinutes` máximos por fichero requerido (p. ej. 90 min para standings/fixtures, 24 h para club, 7 días para social) y marcar `stale: true`.
- Incluir Health y CI en el resumen, y el resultado del último deploy.
- Guardar una copia diaria de `status.json` en vez de force-push (o una rama `status-history`), para tener tendencia.
- Alertar en el propio workflow si `ok:false` o si un fichero requerido supera el umbral (issue automática o webhook).
- Registrar en el commit o en un artefacto cuántos ficheros cambiaron de verdad, para medir el no-op rate sin descargar parches.

---

## 9. Hallazgos

### [PIPE-01] Actions deshabilitadas a nivel de repositorio mientras los workflows figuran activos

- **Área:** Operación / GitHub Actions
- **Severidad:** Crítica
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `GET /actions/permissions` devuelve `{"enabled": false}` el 2026-11-11 08:37 UTC; el último run es `42845450576` (2026-11-10 15:32:48 UTC); los 7 workflows devuelven `state: active`; `status.json` sigue en `2026-11-10T15:32:24Z`.
- **Qué ocurre:** No se ejecuta ningún pipeline desde hace ~17 horas. Los datos publicados están congelados y `status.json` no se actualiza. La UI de workflows puede dar la impresión de que todo está activo.
- **Causa raíz:** `actions/permissions.enabled=false` es un ajuste de repositorio que prevalece sobre el `state` de cada workflow. La FASE 0 midió antes de que se aplicara.
- **Impacto:** Si nadie lo reactiva, la app sirve datos del 10-nov indefinidamente. Si se reactiva sin corregir la cadencia, vuelve el ruido de §2.3.
- **Recomendación:** Decidir explícitamente si el parón es intencionado. Si lo es, documentarlo y añadir un aviso visible (README/status). Si no, reactivar y aplicar la cadencia híbrida antes de la primera pasada.
- **Alternativas:** Mantener el parón y publicar datos manualmente; o reactivar solo Data/News y dejar Rivals/Health en manual.
- **Esfuerzo:** S
- **Riesgo:** Reactivar sin corregir `content_hash` recupera ~21 commits/día de datos.
- **Dependencias:** Permisos de administrador del repo.

### [PIPE-02] El cron `*/10` ejecuta un pipeline completo aunque `--if-due` no toque la red

- **Área:** Cadencia / coste
- **Severidad:** Alta
- **Tipo de evidencia:** MEDIDO
- **Evidencia:** 1.672 runs de Data en 22 días; **1.398 (84,0 %) sin commit**; 665 minutos de runner en esos runs. Run `42843650039` (15:22:33-15:22:46 UTC): `ingest` 0 s, snapshots 1 s, match-details 0 s, club 1 s, club-images 0 s, validate 0 s, commit 1 s; total 13 s.
- **Qué ocurre:** Cada 10 minutos se arranca un runner, se instala el paquete, se restauran cachés y se ejecutan cinco comandos locales, aunque `ingest --if-due` haya decidido que no toca refrescar. El 84 % de los runs no publica nada.
- **Causa raíz:** El cron es fijo y la decisión de cadencia está dentro del job (`cadence.py:43-54`), no antes de arrancar el runner. `--if-due` solo evita la red, no el resto del pipeline.
- **Impacto:** ~3.700 runs/mes sin commit y ~29 h/mes de runner low-value; ruido en Actions, presión innecesaria sobre Pages y sobre BDFutbol (match-details se ejecuta en cada pasada, aunque no tenga pendientes).
- **Recomendación:** Bajar el cron base a hourly y reservar `*/10` para una banda de partido. Mantener `--if-due` como segunda barrera.
- **Alternativas:** Dejar `*/10` y añadir un job de preflight que consulte el estado antes de arrancar el job pesado (sigue consumiendo un runner); o usar el cron externo documentado.
- **Esfuerzo:** S
- **Riesgo:** Si la banda de partido no cubre un kickoff entre semana, la frescura baja a 60 min; se mitiga con `workflow_dispatch`.
- **Dependencias:** Ninguna.

### [PIPE-03] `content_hash` no ignora `provenance.*.capturedAt`: cada refresco real crea un commit vacío

- **Área:** Idempotencia / publicación
- **Severidad:** Alta
- **Tipo de evidencia:** CONFIRMADO + MEDIDO
- **Evidencia:** `transform.py:327-335` solo excluye `updatedAt` y `dataHash` de primer nivel. `build_season` escribe `captured_at=updated_at` en tres provenances (`transform.py:249-257`). Commit `aed883f`: `season.json +4/-4` por tres `capturedAt`; `fixtures/standings/squad +1/-1` por `updatedAt`; `meta.json` por `updatedAt`/`dataHash`. **179 de 233 commits de datos desde el 31-oct (76,8 %) son solo timestamps**.
- **Qué ocurre:** Cada pasada real (cada ~60 min fuera de ventana, cada 10 min en ventana) reescribe cinco ficheros con la hora actual, crea un commit y dispara un deploy de Pages aunque ningún dato deportivo cambie.
- **Causa raíz:** El hash canónico excluye timestamps solo en el primer nivel; los `capturedAt` anidados dentro de `season.provenance` no se normalizan. Además, `write_if_changed` compara el hash pero luego escribe `updatedAt` nuevo en todos los ficheros.
- **Impacto:** ~489 commits y ~489 deploys vacíos/mes; historial de `main` ilegible; builds de Pages y timeouts; el `dataHash` cambia aunque el contenido sea idéntico.
- **Recomendación:** Normalizar timestamps de forma recursiva en `content_hash` (o excluir explícitamente `provenance.*.capturedAt`), y no reescribir `updatedAt` si el hash canónico no cambió. Añadir un test que compare dos pasadas con el mismo contenido y distinto reloj.
- **Alternativas:** Mantener `updatedAt` pero publicar solo cuando cambie el hash; separar `updatedAt` de `capturedAt` y no versionar este último.
- **Esfuerzo:** S
- **Riesgo:** Bajo; el cambio afecta a la idempotencia, no al contrato público.
- **Dependencias:** Tests de `transform.py` y `publish.py`.

### [PIPE-04] `match-details` convierte un fallo de BDFutbol en un run verde sin datos

- **Área:** Fiabilidad / datos
- **Severidad:** Alta
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `cli.py:418-421`: si `client.schedule(season)` lanza `SourceError`, imprime `AVISO: no se pudo leer el calendario de BDFutbol` y `return 0`. Por partido, un `SourceError` incrementa `unresolved` y continúa (`cli.py:437-441`). El workflow no comprueba `unresolved`.
- **Qué ocurre:** Una caída, un 403 o un cambio de HTML de BDFutbol dejan el run en verde. No se publican alineaciones/eventos y nadie recibe una señal de fallo.
- **Causa raíz:** Se prioriza no romper el pipeline de datos por una fuente secundaria; el error se degrada a aviso y el código de salida es 0.
- **Impacto:** La app puede mostrar partidos sin alineaciones durante días; el health check sigue en verde; el problema solo se detecta mirando logs.
- **Recomendación:** Distinguir “no hay partidos pendientes” de “no se pudo leer la fuente”. Si hay pendientes y falla el calendario, salir con código ≠ 0 o publicar `degraded: true` en status. Añadir un contador de `unresolved` y alertar si supera 0 en un día de partido.
- **Alternativas:** Reintentar una vez con backoff; usar el snapshot de fixtures como fallback; dejar el detalle pendiente para la siguiente pasada y marcarlo.
- **Esfuerzo:** S-M
- **Riesgo:** Un fallo de BDFutbol puede tumbar el workflow de datos; separar `match-details` en su propio workflow reduce el acoplamiento.
- **Dependencias:** ADR 0031 y tolerancia del producto a detalles ausentes.

### [PIPE-05] `status.json` consulta 50 runs globales y deja Rivals en `null`: `ok:false` permanente

- **Área:** Observabilidad
- **Severidad:** Alta
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `health.yml:37-41` pide `/actions/runs?per_page=50` sin filtrar por workflow. `_status_workflows` (`cli.py:963-980`) descarta `conclusion is None` y busca el último run de cada workflow en esa lista. `status.json` actual: Rivals `conclusion: null`, `updatedAt: null`, `ok: false`. Data/News generan ~186 runs/día, así que la ventana cubre ~4-6 h; Rivals corre 1 vez/día.
- **Qué ocurre:** El run diario de Rivals nunca está en los últimos 50, no se encuentra candidato y se publica `null`. Como `ok` exige que todos los workflows sean `success`, el semáforo está en rojo casi siempre.
- **Causa raíz:** Ventana global en lugar de consulta por workflow; y `null` se trata como no-éxito en `workflows_ok`.
- **Impacto:** El health check no distingue un fallo real de un artefacto de la consulta; se ignora; no se puede usar para alertar.
- **Recomendación:** Consultar cada workflow por separado (`/actions/workflows/{id}/runs?per_page=1`) o filtrar por `path` con `per_page=100`. Si no hay run en la ventana, usar `null` pero no convertirlo en fallo; añadir `stale` como estado separado.
- **Alternativas:** Aumentar a `per_page=100` y filtrar por `path` (sigue siendo frágil); usar la API de check runs.
- **Esfuerzo:** S
- **Riesgo:** Bajo.
- **Dependencias:** Ninguna.

### [PIPE-06] Carreras de push y fragilidad del deploy de Pages

- **Área:** Fiabilidad / publicación
- **Severidad:** Alta
- **Tipo de evidencia:** MEDIDO
- **Evidencia:** Data 9 fallos: 4 `configure-pages` Not Found (21-22 oct), 1 push 500, 1 `fetch first`, 1 ID token, 2 runs huérfanos (9-nov). News: 4 timeouts de deploy, 1 `commit_refs_rules`. Deploy medido: 6 s con caché, 3 min 04 s en `42840496473`, timeout de 10 min en los fallos. `data-publish` comparte Data/Rivals; News usa `news-publish`; los tres despliegan con `pages-deploy`.
- **Qué ocurre:** Los workflows compiten por `main` y por Pages. El rebase de 5 intentos mitiga los push, pero no las carreras entre Data y News; el deploy del sitio completo (3,9 MB) se repite por cada commit y puede encolarse hasta agotar el timeout.
- **Causa raíz:** Tres workflows independientes con lógica de commit/deploy duplicada; sin un único publicador; sin retry en `configure-pages`; deploy completo en cada cambio.
- **Impacto:** Runs rojos intermitentes, commits locales que no llegan a `main`, retrasos de publicación y builds de Pages desperdiciados.
- **Recomendación:** Un solo workflow de publicación (reutilizable o `workflow_run`) que despliegue una vez por cambio real; `concurrency` común para todos los que escriben en `main`; retry en `configure-pages`; no desplegar si solo cambian timestamps.
- **Alternativas:** Mantener los deploy jobs pero añadir `needs` y una comprobación de `changed` común; usar un entorno de Pages separado para previews.
- **Esfuerzo:** M
- **Riesgo:** Un publicador único puede convertirse en cuello de botella; el `concurrency` debe permitir encolar, no cancelar.
- **Dependencias:** Permisos `pages: write` e `id-token: write`.

### [PIPE-07] BDFutbol: 403 en 2/10 pasadas y guard de Rivals que no protege degradaciones parciales

- **Área:** Fiabilidad / parsers
- **Severidad:** Alta
- **Tipo de evidencia:** MEDIDO + CONFIRMADO
- **Evidencia:** Rivals 8 OK / 2 fallos (20 %) por 403. `SourceBlocked` no reintenta (`enrich/http.py:321-324`). `_keep_previous_rivals` solo conserva el fichero anterior si `with_history == 0` (`cli.py:164-181, 233-239`); si hay 1 de 19, publica 1 histórico y 18 `null`. Parser basado en regex y literales HTML (`bdfutbol.py:592-703, 717-731, 807-808`).
- **Qué ocurre:** Una pasada parcial de BDFutbol puede sobrescribir un `rivals.json` completo con otro casi vacío, y el workflow puede salir verde si al menos un rival respondió.
- **Causa raíz:** El guard mide “¿hay algún histórico?” en vez de “¿hemos perdido histórico respecto a la publicación anterior?”. El parser no tiene un contrato estable.
- **Impacto:** Pérdida de datos verificados en `rivals.json`; la app muestra rivales sin histórico; el problema no se detecta porque el run no falla.
- **Recomendación:** Comparar `with_history` con el fichero anterior y no publicar si baja; marcar `degraded` y fallar el run. Añadir tests de contrato con HTML guardado y un contador por fuente.
- **Alternativas:** Cachear el último `rivals.json` válido como artefacto y restaurarlo si la nueva pasada empeora; separar Rivals en un workflow con más reintentos y menos frecuencia.
- **Esfuerzo:** M
- **Riesgo:** Un cambio legítimo (un rival sale de la temporada) reduciría el histórico; el umbral debe comparar solo rivales presentes.
- **Dependencias:** ADR 0031 y riesgo legal de BDFutbol.

### [PIPE-08] La rama local añadiría `club titles`/`club rivalries` al cron de 10 minutos

- **Área:** Riesgo latente / cadencia
- **Severidad:** Alta
- **Tipo de evidencia:** CONFIRMADO (fichero local) + HIPÓTESIS (volumen)
- **Evidencia:** `data-refresh.yml` local, líneas 65-72, añade `club titles --proposal` y `club rivalries` antes de `validate`; `origin/main` no los tiene. `club rivalries` usa BDFutbol; si se ejecuta por cada run y no hay caché, son hasta 19 peticiones.
- **Qué ocurre:** Al fusionar la rama local, el workflow de 10 minutos pasaría de 0 a 19 peticiones a BDFutbol por pasada (hasta ~2.700/día, ~82.000/mes), además de las de Rivals.
- **Causa raíz:** Se añadió funcionalidad de club al workflow de datos sin separar la cadencia.
- **Impacto:** Bloqueos 403, carga innecesaria sobre una fuente externa, runs más lentos y más fallos; el problema de cadencia empeora.
- **Recomendación:** No fusionar esos pasos en `data-refresh.yml`; crear un `club-refresh.yml` semanal o manual, con caché y `--offline` cuando sea posible.
- **Alternativas:** Mover `club titles` (que es local) a un workflow de release; dejar `club rivalries` en Rivals, que ya tiene caché h2h.
- **Esfuerzo:** S
- **Riesgo:** Si se fusiona tal cual, el impacto es inmediato.
- **Dependencias:** Decisión sobre la rama local y el despliegue de `titles.json`/`rivalries.json`.

### [PIPE-09] El cron de 10 minutos no garantiza 10 minutos

- **Área:** Cadencia / fiabilidad
- **Severidad:** Media
- **Tipo de evidencia:** MEDIDO
- **Evidencia:** Desde el 31-oct: intervalo mediano 9,9 min, p90 13,0, p99 32,2, máximo 71,8; 17 huecos >30 min en 11 días. Retardo respecto al slot: mediana 139 s, p90 375 s, máximo 599 s. News: máximo 91,8 min. Health: máximo 41,8 min.
- **Qué ocurre:** GitHub retrasa y a veces se salta ejecuciones programadas; la frescura real no es la nominal.
- **Causa raíz:** `schedule` de GitHub Actions no es un cron de tiempo real y se deprioriza en repos con poca actividad.
- **Impacto:** La app puede servir datos de hasta 1-2 horas de antigüedad en un momento crítico, aunque el cron diga 10 minutos. El `--if-due` añade otra capa de retraso.
- **Recomendación:** No prometer 10 minutos si solo hay `schedule`. Para la ventana de partido, usar el cron externo documentado o aceptar 10-30 minutos; para el resto, hourly es suficiente.
- **Alternativas:** Mantener `*/10` y añadir un monitor que detecte huecos >20 min; o usar un servicio externo de cron.
- **Esfuerzo:** S-M
- **Riesgo:** El cron externo necesita un token con `Actions: write` y un lugar seguro para guardarlo.
- **Dependencias:** `docs/operations.md:90-117`.

### [PIPE-10] News cada 30 minutos con pipeline completo y `social.json` que nadie consume

- **Área:** Cadencia / producto
- **Severidad:** Media
- **Tipo de evidencia:** MEDIDO + CONFIRMADO
- **Evidencia:** 488 runs, 206 commits (42,2 %), 282 sin commit; 158 minutos de runner sin commit. El paso `news` tarda ~3 s con caché caliente; el coste está en el arranque. `cmd_news` regenera `social.json` (`cli.py:646-652`), pero no hay ningún consumidor en `apps/mobile`.
- **Qué ocurre:** Se lanza un runner cada 30 minutos para leer 5 feeds; la mayoría de las pasadas no publica nada. Además se reescribe `social.json` con timestamps, lo que puede generar commits por un fichero que la app no usa.
- **Causa raíz:** Cadencia copiada de la necesidad de “breaking news”, sin medir el rendimiento real de los feeds; `social` se acopló al pipeline de noticias.
- **Impacto:** ~1.440 runs/mes y ~560 commits/mes; ruido y despliegues; un fichero muerto más en el árbol público.
- **Recomendación:** News hourly; eliminar `social.json` del pipeline o moverlo a un workflow semanal. Si se necesita inmediatez, mantener `*/30` solo para News.
- **Alternativas:** Un solo feed “prioritario” cada 15 min y el resto cada hora; o un webhook del feed.
- **Esfuerzo:** S
- **Riesgo:** La pestaña de noticias puede perder algún titular de última hora; la app ya cachea 10 min.
- **Dependencias:** Producto/noticias.

### [PIPE-11] Pasos no-op en cada run de Data

- **Área:** Eficiencia
- **Severidad:** Media
- **Tipo de evidencia:** MEDIDO
- **Evidencia:** Run `42843650039`: snapshots 1 s, match-details 0 s, club 1 s, club-images 0 s, validate 0 s, commit 1 s; `ingest` 0 s por `due=false`. `club-images` hace `--offline` si el directorio existe (`data-refresh.yml:58-64`). `validate` recorre 3,9 MB aunque no haya cambios.
- **Qué ocurre:** Se ejecutan cinco comandos locales en cada pasada, incluso cuando no hay nada que hacer. El coste por paso es bajo, pero se multiplica por 144 al día.
- **Causa raíz:** El workflow no tiene una condición `if` basada en `steps.ingest.outputs.changed`; solo usa `refreshed` para guardar la caché.
- **Impacto:** ~13 s por run vacío; ~30 h/mes de runner; más superficie de fallo (p. ej., `club` o `club-images` pueden fallar aunque no haya datos nuevos).
- **Recomendación:** Ejecutar `snapshots`, `match-details`, `club`, `club-images` y `validate` solo si `ingest.changed == 'true'` o si hay partidos pendientes; mover `club`/`club-images` a un workflow semanal.
- **Alternativas:** Dejar solo `validate` y `commit` en el camino rápido; el resto en un job separado.
- **Esfuerzo:** S
- **Riesgo:** Un partido puede terminar entre pasadas sin que `ingest.changed` sea true; usar una condición adicional “hay partidos FINISHED sin snapshot/detalle”.
- **Dependencias:** Ninguna.

### [PIPE-12] Health no cubre Health/CI, no alerta y no tiene umbrales de frescura

- **Área:** Observabilidad
- **Severidad:** Media
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `_STATUS_WORKFLOWS` solo incluye Data, News y Rivals (`cli.py:885-889`). `required_missing` solo mira presencia (`cli.py:1002-1013`). `club.json` 13.278 min y `social.json` 14.592 min no afectan a `ok`. `git push --force origin HEAD:status` (`health.yml:63`). No hay Slack/email/issue. La app no consume `status.json`.
- **Qué ocurre:** El único resumen de salud no vigila el propio Health, ni CI, ni el deploy; no distingue un fichero viejo de uno ausente; y no avisa a nadie.
- **Causa raíz:** `status.json` se diseñó como resumen informativo, no como sistema de alertas; la rama `status` se reescribe entera.
- **Impacto:** Un fallo silencioso (BDFutbol, deploy, datos congelados) puede pasar días sin detectarse; el semáforo está en rojo por un artefacto y se ignora.
- **Recomendación:** Añadir umbrales de antigüedad, incluir Health/CI/deploy, conservar historial y emitir una alerta cuando `ok:false` o `stale:true`. Si no se va a alertar, simplificar `status.json` para que no dé una falsa sensación de monitorización.
- **Alternativas:** Usar GitHub Issues como alerta (abrir/cerrar automáticamente) o un webhook a Slack/Discord.
- **Esfuerzo:** M
- **Riesgo:** Exceso de alertas si no se filtran los fallos transitorios; usar ventanas de 2-3 pasadas.
- **Dependencias:** Ninguna.

### [PIPE-13] CI no prueba el Worker ni un smoke end-to-end de los JSON publicados

- **Área:** Calidad / contratos
- **Severidad:** Media
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `ci.yml` tiene 3 jobs (`mobile`, `python`, `secrets`); no hay ningún paso que ejecute `workers/live-proxy`, ni un test que descargue `data/public/v1` y valide el contrato que consume la app. `workers/live-proxy/src/transform.js` duplica el contrato. CI: 10 fallos de 45 (22,2 %).
- **Qué ocurre:** El Worker no desplegado puede divergir del Pydantic/Zod sin que nadie lo detecte. Los cambios de contrato se validan con Pydantic y JSON Schema, pero no con un cliente real.
- **Causa raíz:** El Worker está pendiente (ADR 0030) y se dejó fuera de CI; el smoke test se confía a `validate`.
- **Impacto:** Si se despliega el Worker, puede romper la app; los errores de contrato se descubren en producción.
- **Recomendación:** Añadir un job `worker` con tests de `transform.js` y un smoke test que valide los JSON publicados contra los esquemas Zod (o un subset). Marcar los 10 fallos de CI y corregir los que sean crónicos.
- **Alternativas:** Eliminar el Worker del árbol hasta que se vaya a desplegar; o congelar su contrato con un test de fixtures.
- **Esfuerzo:** M
- **Riesgo:** Bajo; el CI tarda ~1 min.
- **Dependencias:** ADR 0030 y decisión sobre el Worker.

### [PIPE-14] El cron externo está documentado pero no implementado

- **Área:** Fiabilidad / operación
- **Severidad:** Media
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `docs/operations.md:90-117` describe un cron externo con `POST /actions/workflows/{id}/dispatches` y un token fine-grained con `Actions: write`, pero no hay configuración, secreto ni workflow que lo use.
- **Qué ocurre:** El único disparador real es `schedule`, con los retrasos y huecos de §2.2. La alternativa documentada queda como teoría.
- **Causa raíz:** Se documentó el respaldo antes de necesitarlo; nunca se configuró.
- **Impacto:** Si se promete una frescura de 10 minutos, no hay mecanismo para cumplirla cuando GitHub se retrasa.
- **Recomendación:** Decidir: o se implementa el cron externo (con el token fuera del repo) y se usa para la ventana de partido, o se elimina la promesa de 10 minutos y se acepta hourly. No dejar ambas cosas a medias.
- **Alternativas:** Usar `workflow_dispatch` manual en partidos concretos; o un servicio serverless propio.
- **Esfuerzo:** M
- **Riesgo:** Un token mal guardado es un riesgo de seguridad; usar un secreto del repo/organización y rotarlo.
- **Dependencias:** Token con `Actions: write`, servicio externo.

### [PIPE-15] Coste privado: ~8.600 minutos facturables/mes, la mitad low-value

- **Área:** Coste
- **Severidad:** Baja
- **Tipo de evidencia:** MEDIDO + HIPÓTESIS (tarifa)
- **Evidencia:** 4.250 min de runner/mes proyectados; cada job se redondea al minuto; los runs con commit tienen 2 jobs. Estimación: ~8.600 min facturables/mes; ~2.500 min son runs sin commit o deploys vacíos. Repo público: 0 €.
- **Qué ocurre:** En un repo público el coste es 0; en uno privado, la cadencia actual supera los 3.000 min de Pro y costaría ~45 USD/mes extra, la mitad por trabajo que no publica nada.
- **Causa raíz:** Cadencia fija + jobs de arranque + deploys duplicados.
- **Impacto:** Si el repo se privatiza o se mueve a una organización con límites, el coste aparece de golpe.
- **Recomendación:** Aplicar la cadencia híbrida; el coste privado baja a ~2.000 min/mes (dentro de Pro) y el low-value a ~800 min.
- **Alternativas:** Self-hosted runner (más mantenimiento) o GitHub Free con 2.000 min (la híbrida cabe justo).
- **Esfuerzo:** S
- **Riesgo:** La tarifa puede cambiar; verificar antes de presupuestar.
- **Dependencias:** Plan de GitHub y visibilidad del repo.

### [PIPE-16] Deploy completo de 3,9 MB desde tres workflows duplicados

- **Área:** Publicación / eficiencia
- **Severidad:** Media
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** El bloque `deploy` se repite en `data-refresh.yml:107-133`, `news-refresh.yml:82-108` y `rivals-refresh.yml:80-106`; sube `path: data/public` completo (3,9 MB, 58 imágenes). `pages-deploy` serializa, pero no consolida. Límite de Pages: 10 builds/hora.
- **Qué ocurre:** Cada commit de cualquier workflow redespliega el sitio entero; tres copias del mismo código pueden divergir y compiten por el mismo entorno.
- **Causa raíz:** No hay un publicador único; se copió el bloque para cada pipeline.
- **Impacto:** Deploys innecesarios, timeouts, builds duplicados y mantenimiento triple.
- **Recomendación:** Extraer un `publish.yml` reutilizable (`workflow_call`) o un `workflow_run` que despliegue una vez por cambio real; mantener `pages-deploy` como único punto de serialización.
- **Alternativas:** Dejar los tres bloques pero unificarlos con una acción compuesta; no resuelve la duplicación de runs.
- **Esfuerzo:** M
- **Riesgo:** Un fallo en el publicador único bloquea las tres fuentes; monitorizarlo.
- **Dependencias:** Permisos de Pages y diseño de `workflow_run`.

---

## 10. Resumen final

1. **7.230 runs/mes** nominales y **~4.250 minutos** de runner; el 84 % de los runs de Data no publica nada y el 77 % de sus commits desde el 31-oct solo cambia timestamps.
2. **La causa raíz de los commits vacíos es `content_hash`:** ignora `updatedAt`/`dataHash` de primer nivel, pero no `season.provenance.*.capturedAt`; cada refresco real reescribe cinco ficheros.
3. **El cron de 10 minutos no cumple:** retardo mediano 139 s, p90 375 s, máximo 599 s; 17 huecos >30 min en 11 días y uno de 71,8 min.
4. **Una pasada diaria no basta** para días de partido ni noticias; **`*/10` permanente es excesivo**; la opción correcta es base horaria + ventana densa de partido.
5. **La opción recomendada** (~2.100-2.250 runs/mes, ~1.300 min) ahorra ~70 % de runs y ~70 % de minutos, manteniendo 10 min en ventana y 60 min fuera.
6. **El coste en repo público es 0 €**; en privado, la cadencia actual ronda **8.600 min facturables/mes (~45 USD extra)** y la híbrida cabe en Pro.
7. **La fiabilidad está dominada por Pages y BDFutbol:** 9 fallos de Data, 4 timeouts de deploy, 2/10 fallos de Rivals por 403.
8. **Hay fallos silenciosos:** `match-details` devuelve 0 si BDFutbol falla; `rivals` solo protege el caso de 0 históricos, no una degradación parcial.
9. **`status.json` está roto como semáforo:** `per_page=50` global deja Rivals en `null` y `ok:false` permanente; no vigila Health/CI, no alerta y no conserva historial.
10. **Los workflows figuran `active`, pero las Actions del repo están deshabilitadas** (`enabled:false`) desde el 10-nov 15:32; la premisa de “pausadas” es cierta ahora, no en la FASE 0.
11. **La rama local no fusionada es un riesgo:** añadiría `club titles`/`club rivalries` al cron de 10 min (~2.700 peticiones/día a BDFutbol si no hay caché).
12. **Los parsers de BDFutbol son frágiles** (regex sobre clases y textos en español); un cambio de HTML degrada el pipeline sin ponerlo en rojo.
13. **Prioridad de arreglo:** 1) `content_hash`; 2) cadencia híbrida; 3) guard de Rivals y errores de `match-details`; 4) `status.json`/alertas; 5) publicador único.
14. **No se ha modificado nada fuera de `docs/auditoria/`;** no se han lanzado workflows ni se han usado secretos.

---

## Anexo — Comandos y fuentes

- Runs: `GET /repos/angelvilarino/depor-hub/actions/runs?per_page=100` paginado (2.487 runs; 2.466 de los cinco pipelines principales).
- Commits: `GET /repos/angelvilarino/depor-hub/commits?since=2026-10-19T00:00:00Z&per_page=100` paginado (556 commits).
- Clasificación de commits: descarga del parche de cada commit y filtrado de líneas `updatedAt|capturedAt|dataHash|{|}`.
- Permisos: `GET /repos/angelvilarino/depor-hub/actions/permissions` → `enabled:false`.
- Workflows: `GET /repos/angelvilarino/depor-hub/actions/workflows` → 7 workflows, todos `state:active`.
- Estado publicado: `GET /repos/angelvilarino/depor-hub/contents/status.json?ref=status`.
- Ficheros locales: `.github/workflows/*.yml`, `scripts/depor_hub/{cli,transform,publish,cadence,rivals}.py`, `scripts/depor_hub/enrich/{http,bdfutbol}.py`, `docs/operations.md`, ADR 0015/0025/0027/0028/0030/0031.
- No se ha llamado a football-data.org ni a BDFutbol; no se ha usado `FOOTBALL_DATA_TOKEN`; no se ha ejecutado ningún workflow.
