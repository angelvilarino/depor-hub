# Auditoría integral de Depor Hub

**Fecha:** 11 de noviembre de 2026
**Alcance:** árbol local (`main`, HEAD `5759480`) y lo publicado en `origin/main` / GitHub Pages.
**Modo:** solo lectura. No se ha modificado nada fuera de `docs/auditoria/`. Sin commits ni pushes.
**Fuentes:** `docs/auditoria/parciales/FASE-0` a `FASE-5` y 29 capturas en `docs/auditoria/capturas/`.
**Deuda legal pendiente, fuera de esta auditoría** (BDFutbol, escudos, fotos, marcas y titulares).

> **Aviso de alcance imprescindible.** El `main` local está **23 commits por delante y 159 por detrás de `origin/main`** (`git rev-list --left-right --count main...origin/main` → `23 159`). Este informe audita el árbol local (incluye el trabajo H7 de club) y lo contrasta con producción. Producción **no tiene** `titles.json` ni `rivalries.json` (404) y no incluye el rediseño de Club. Donde una cifra depende de esa divergencia, se indica.

---

## 1. Resumen ejecutivo

Depor Hub es un proyecto **bien pensado y sorprendentemente maduro para una sola persona**: monorepo ordenado, contrato validado, 230 tests de Python y 302 de app, `ruff`/`lint`/`typecheck` limpios, datos estáticos con ETag/gzip y una identidad visual («Cartel + Prensa») que funciona en Inicio. **No necesita una reescritura.** Necesita cerrar la brecha entre lo que el sistema promete y lo que hace: **publicar lo que está en local, dejar de generar commits vacíos, aligerar lo que pesa y convertir las fichas en interfaces**.

### 1.1 Veredicto por área

| Área | Semáforo | Diagnóstico en una línea |
|---|---|---|
| **Datos** | 🟠 Ámbar | El modelo JSON + Pages es el correcto; fallan idempotencia, partición de `squad.json`, imágenes y la divergencia local/producción. |
| **Pipelines** | 🔴 Rojo | 84 % de los runs de Data no publica nada; 77 % de los commits desde el 31-oct solo cambian timestamps; `status.json` da falso rojo; Actions está deshabilitado a nivel de repo. |
| **App / Rendimiento** | 🟠 Ámbar | Arquitectura sólida; sin `eas.json`, sin URL de producción, skeletons infinitos sin red, retratos de 1,17 MB y `squad.json` de 950 KB. |
| **Diseño / UX** | 🔴 Rojo | Nota global **2,3/5**. Tres sistemas visuales, fichas convertidas en documentos, app estática y contraste AA roto en el cartel (1,02:1). |
| **Calidad / Seguridad** | 🟢 Ámbar-verde | Tests rápidos y cobertura real ~80 %; higiene mejorable (CI parcial, Node bajo mínimo, acciones sin SHA, 3 `high` de npm). |

### 1.2 Las cinco conclusiones que importan

1. **El problema no es el almacenamiento, es la escritura.** JSON estático + GitHub Pages es la decisión correcta para 3,86 MB (cap. 4). Lo que falla es que el pipeline **escribe un commit aunque no cambie el contenido**: `content_hash` no ignora `provenance.*.capturedAt` anidado. Eso genera 179 de 233 commits (77 %) que solo mueven timestamps y ~489 despliegues vacíos al mes.
2. **El cron de 10 minutos no compra frescura.** El retardo mediano del `schedule` es de **139 s**, el p90 de **375 s** y hay huecos de hasta **71,8 min**. El 84 % de los 1.672 runs de Data no publicó nada. Una base horaria con banda densa en fin de semana baja de ~7.230 a ~2.250 runs/mes (−70 %) sin perder el día de partido.
3. **La app no se puede distribuir todavía.** Faltan `eas.json`, `versionCode`/`buildNumber` y la URL de datos de producción. Además, con `networkMode: 'online'` el primer arranque sin red deja **toda la app en skeleton indefinido**, que es el peor estado posible para una app de consulta.
4. **Las pantallas que deberían vender el producto son las peores.** Ficha de partido 1,3/5, ficha de jugador 1,9/5, entrenador 1,9/5, media docena de secciones de Club entre 1,5 y 2,0. No es falta de datos: es que se presentan como formularios y párrafos. La identidad existe pero solo se importa en **7 archivos**.
5. **Hay una deuda de verdad operativa.** No hay smoke test post-deploy, el `status.json` se calcula sobre 50 runs globales (falso rojo permanente), `match-details` convierte fallos de BDFutbol en runs verdes, y CI no cubre el Worker ni un end-to-end de los JSON publicados.

### 1.3 Qué haría primero (si solo hubiera una semana)

| # | Acción | Resuelve | Coste |
|---:|---|---|---|
| 1 | Rebasear `main`, publicar y añadir smoke test de Pages | D1-01 / F5-01 | M |
| 2 | Corregir `content_hash` (ignorar `capturedAt` recursivo) + test de doble pasada | D1-02 / PIPE-03 | S |
| 3 | Reactivar Actions con la cadencia híbrida y `status.json` por workflow | PIPE-01, PIPE-02, PIPE-05 | S |
| 4 | Arreglar navegación (`(tabs)`), contraste G/E/P y targets de 44 pt | D-01, D-02, D-22 | S |
| 5 | `eas.json` + URL de producción + estado offline explícito | F3-01, F3-03 | M |

### 1.4 Lo que NO hay que hacer

- **No migrar a base de datos** (R2, D1, Supabase, Turso). Añade credenciales, runtime, backups y migraciones para resolver un problema que no es de capacidad.
- **No reescribir la app.** La arquitectura es correcta; el problema es de adopción del sistema de diseño y de estados.
- **No añadir más fuentes ni más secciones.** El Club ya tiene pantallas que no aportan valor práctico (D-15 a D-19); el siguiente paso es recortar, no ampliar.
- **No mantener `*/10` permanente «por si acaso»**: ni ahorra frescura real ni el cron lo garantiza.

---

## 2. Línea base medida

Todo lo de esta sección está ejecutado el **2026-11-11** sobre el árbol local. Comandos en el Anexo B.

### 2.1 Entorno y código

| Métrica | Valor | Nota |
|---|---:|---|
| Node local | **v20.20.2** | `package.json` exige `>=22.13` **[CONFIRMADO]** |
| Python del venv | 3.12.15 | Coincide con `setup-python` |
| Python | 19.317 líneas / 53 ficheros | |
| TypeScript + TSX | 17.472 líneas / 126 ficheros (`app/` + `src/`) | |
| JSON versionado | 76.165 líneas / 70 ficheros | |
| Mayor fichero de app | `src/data/schemas.ts` 1.029 líneas | Zod manual |
| Mayor pantalla | `app/player/[id].tsx` 743 líneas | |

### 2.2 Calidad ejecutada

| Comando | Resultado | Tiempo |
|---|---|---:|
| `ruff check scripts` | ✅ limpio | < 1 s |
| `pytest scripts -q` | ✅ **230 passed** | **0,82 s** |
| `npm run lint` | ✅ exit 0 (solo warning de Node) | ~5 s |
| `npm run typecheck` | ✅ exit 0 | ~8 s |
| `npx jest --ci --runInBand` | ✅ **35 suites / 302 tests** | **9,06 s** |
| Cobertura real app (`--collectCoverageFrom`) | **79,98 % líneas / 64,00 % ramas** | Jest por defecto reporta 86,84 % porque omite 15 módulos |
| Cobertura Python | **79,6 %** | |
| Módulos a 0 % | `app/_layout.tsx`, `settings.tsx`, `DataProvider.tsx`, `persister.ts`, `notifications.ts` | Flujos críticos sin red |

### 2.3 Datos publicados (`data/public/v1`)

| Fichero | Bytes | % JSON raíz |
|---|---:|---:|
| `squad.json` | **950.390** | 72,9 % |
| `news.json` | 107.828 | 8,3 % |
| `club.json` | 47.411 | 3,6 % |
| `rivals.json` | 42.244 | 3,2 % |
| `fixtures.json` | 30.697 | 2,4 % |
| `titles.json` | 21.446 | 1,6 % |
| `rivalries.json` | 14.525 | 1,1 % |
| `standings.json` | 8.425 | 0,6 % |
| `season.json` | 3.655 | 0,3 % |
| `social.json` | 645 | 0,05 % |
| `meta.json` | 594 | 0,05 % |

- **Sitio completo:** 3,86 MB. **JSON raíz:** 1,23 MB.
- **Transferencia real (gzip, medido con `curl`):** home en frío ≈ **34 KB de JSON + hasta 578 KB de miniaturas**; `squad.json` solo = **59,8 KB gzip**.
- **`squad.json`:** `deporMatches` **485.084 B (51 %)**, `career` 72.483 B (7,6 %), `provenance` 30.211 B (3,2 %). 28 jugadores, 1.262 partidos de historial.
- **Imágenes de club:** 14 PNG de escudos = **2,32 MB** (59 % del peso de `data/public/v1`); 44 SVG de equipaciones = 216 KB. El peor, `escudos/1910.png`, 289 KB a 381×512.
- **Cobertura de campos:** dorsal 28/28, peso 25/28, redes 27/28, fotos 28/28, `marketValueEur` **0/28**, `keyPlayers` **0/19**.

### 2.4 Git

| Métrica | Valor |
|---|---:|
| Commits en `main` | 420 |
| Commits que tocan `data/` | **359 (85 %)** |
| Commits del bot | **327 (78 %)** |
| `.git` en disco | **26 MB** (pack 2,14 MiB, 3.182 objetos sueltos) |
| Commits `data: refresh` / `data(news)` / `data(rivals)` | 177 / 146 / 5 |
| Divergencia con `origin/main` | **23 delante / 159 detrás** |

### 2.5 GitHub Actions (22 días: 2026-10-20 → 2026-11-10 15:32 UTC)

| Workflow | Runs | OK | Fallos | Nota |
|---|---:|---:|---:|---|
| Data refresh | **1.672** | 1.663 | 9 | 1.040 min; **1.398 runs (84 %) sin commit** |
| News refresh | 488 | 482 | 2 (+4 cancel) | 146 commits |
| Health | 251 | 250 | 1 | |
| Rivals refresh | 10 | 8 | 2 | 403 de BDFutbol |
| CI | 45 | 35 | 10 | No se ejecuta en commits del bot |

- **Commits de datos desde el 31-oct:** 179 de 233 (**76,8 %**) solo cambian timestamps.
- **Retardo del cron:** mediana **139 s**, p90 **375 s**, máximo **599 s**; 17 huecos > 30 min en 11 días; hueco máximo **71,8 min**.
- **Coste:** ~7.230 runs/mes y ~4.250 min/mes de runner. En repo público, **0 €**; en privado serían ~8.600 min facturables (~45 USD extra).
- **Estado actual:** `GET /actions/permissions` → `{"enabled": false}` (2026-11-11 08:37 UTC); el último run es `42845450576` (2026-11-10 15:32:48 UTC). Los 7 workflows figuran `state: active`: la UI engaña.

---

## 3. Por qué hay tantos Data Refresh

Esta es la pregunta central del encargo. La respuesta corta: **porque el cron está dimensionado para la ventana de partido y se quedó encendido todo el día, y porque el hash de contenido no distingue «no ha cambiado nada» de «ha cambiado el reloj»**. Son dos causas independientes que se multiplican.

### 3.1 Qué hace realmente cada pasada

`data-refresh.yml` se dispara cada 10 minutos (`*/10 * * * *`) y ejecuta **siempre** esta secuencia:

| Paso | Qué hace | ¿Trabajo útil si no hay nada nuevo? |
|---|---|---|
| `checkout` + `setup-python` + `pip install -e scripts` | Prepara el runner | **No**: ~13 s de arranque en cada uno de los 144 runs/día |
| `ingest --if-due` | Consulta `cadence.py`; si `due=false`, **no llama a la red** | Sí, pero barato |
| `snapshots` | Congela tablas si hay partido terminado sin snapshot | Casi siempre no-op |
| `match-details` | Scraping de BDFutbol por partido terminado pendiente | Casi siempre no-op; **convierte un 403 en run verde** (PIPE-04) |
| `club` | Regenera `club.json` | Casi siempre no-op |
| `club-images --offline` | Comprueba que existan las imágenes locales | No-op |
| `validate` | Valida 3,9 MB de JSON | **No**: valida lo que no ha cambiado |
| `commit` con rebase ×5 | Solo si `changed=true` | — |
| `deploy Pages` | Solo si `changed=true` | — |

**Si el refresco toca la red**, hace 4–5 llamadas a football-data.org (`/competitions/PD`, `/standings`, `/matches`, `/teams`, `/teams/{id}` opcional), 1 a BDFutbol (`schedule`) y 1 por partido terminado pendiente. **Si no toca**, hace 0 llamadas de red pero **igualmente arranca el runner, instala el paquete y valida 3,9 MB**.

### 3.2 Las tres cifras que explican el ruido

| Medición | Valor | Implicación |
|---|---:|---|
| Runs de Data que **no** generan commit | **1.398 / 1.672 (84 %)** | Ocho de cada diez pasadas existen solo para comprobar que no había nada que hacer |
| Runs **sin commit** y su duración | 13 s de media | El trabajo vacío cuesta ~824 min en 22 días |
| Commits de datos desde el 31-oct que **solo** cambian timestamps | **179 / 233 (76,8 %)** | El hash considera cambio lo que es solo `capturedAt`/`generatedAt` |

Y una cuarta que rompe la premisa de «cada 10 minutos»:

| Retardo del `schedule` | Valor |
|---|---:|
| Mediana | **139 s** |
| p90 | **375 s** |
| Máximo | **599 s** |
| Huecos > 30 min (11 días) | 17 |
| Hueco máximo | **71,8 min** |

**Conclusión:** el `*/10` no garantiza 10 minutos; en la práctica entrega una mediana de 2,3 min de retardo y de vez en cuando pierde una hora. Pagar 144 ejecuciones diarias para eso es un mal negocio.

### 3.3 Qué se gana y qué se pierde con cada cadencia

| Opción | Runs/mes | Min runner/mes | Frescura de resultados | Veredicto |
|---|---:|---:|---|---|
| **Actual `*/10`** | ~7.230 | ~4.250 | 10 min nominales, 13 min p90, huecos de 72 min | **No**: 84 % sin commit |
| **Una diaria** | ~120 | ~65 | 24 h | **No**: rompe día de partido y noticias |
| **Diaria + ventana de partido estricta** | ~950 | ~600 | 24 h base, 10 min en ventana | Buena, pero exige disparador externo |
| **Base horaria + banda densa sáb/dom 12–23 UTC** | **~2.100–2.250** | **~1.300–1.380** | **60 min base, 10 min en ventana** | **Recomendada** |
| **Manual + diaria** | ~140 | ~80 | 24 h o cuando alguien se acuerde | No: depende de memoria |

### 3.4 Recomendación concreta de cadencia

1. **Data:** `0 * * * *` como base + `*/10 12-23 * * 6,0` como banda densa de fin de semana. Mantener `--if-due`; añadir `workflow_dispatch` para partidos entre semana. **No volver a `*/10` permanente.**
2. **News:** `0 * * * *`. Si el producto exige 30 min, mantener `*/30` **solo para News**; el ahorro de Data sigue siendo el 80 %.
3. **Health:** `0 */4 * * *`. El estado no cambia cada media hora y el force-push cada 30 min no aporta historial.
4. **Rivals:** `0 6 * * 1` (semanal) + dispatch manual tras jornadas con cruces relevantes.
5. **Antes de aplicar la cadencia:** corregir `content_hash` para ignorar `capturedAt`/`generatedAt` **a cualquier profundidad** (o separar las marcas de tiempo en un bloque `_meta` que no se hashea). Sin esto, la cadencia nueva seguirá generando ~5 commits/día de datos en vez de 21, pero no cero.
6. **Después:** consolidar el deploy en **un solo workflow reutilizable** o un `workflow_run`. Hoy hay tres copias del mismo bloque compitiendo por Pages.

### 3.5 Qué eliminar o mover de la cadencia

| Candidato | Por qué | Destino |
|---|---|---|
| `club` y `club-images` en cada pasada | El club cambia rara vez | Workflow semanal o manual |
| `snapshots` y `match-details` en cada pasada | Solo trabajan si hay partido terminado sin congelar | Ventana post-partido / horario |
| `validate` cuando `changed=false` | Valida 3,9 MB que no han cambiado | Solo si `changed=true`; validación completa en CI |
| `social.json` en News | La app no lo consume | Eliminar del pipeline |
| Health cada 30 min | El estado no cambia tan rápido | Cada 4–6 h |
| Rivals diario | El histórico solo cambia al jugar el cruce | Semanal + dispatch |
| `club titles`/`club rivalries` del árbol local | Multiplicarían BDFutbol por 144 | Workflow semanal separado |

**No eliminar:** `validate` de CI, `gitleaks`, `pip-audit` ni la validación de esquemas. Son baratos y protegen contratos.

---

## 4. Evaluación del almacenamiento

**Pregunta:** ¿es «JSON estático versionado en git + GitHub Pages» óptimo para lo que existe hoy y con coste cero?

**Respuesta: sí.** No por inercia, sino porque el dato es un **catálogo de solo lectura, regenerado por lotes, sin escrituras de usuario ni consultas ad hoc**. Es el caso de uso exacto de un fichero estático.

### 4.1 Comparativa con coste cero

| Alternativa | Coste | Límites gratuitos | Encaje hoy |
|---|---|---|---|
| **JSON + GitHub Pages (actual)** | 0 € | 1 GB de sitio; 100 GB/mes blando; 10 builds/h | **Óptimo para el tamaño actual** |
| **JSON particionado + Pages** | 0 € | Los mismos | **Recomendado a corto plazo** (squad/players, news-home) |
| Cloudflare Pages + R2 | 0 € dentro de límites | Pages: 20.000 ficheros, 25 MiB/fichero, 500 builds/mes; R2: 10 GB | Sobredimensionado para 3,86 MB; solo si crece el tráfico o las imágenes |
| Supabase Free | 0 € | 500 MB; pausa tras una semana de inactividad | No: cold start y pausa sin beneficio |
| Turso Free | 0 € | 5 GB; 500 M filas leídas/mes | No: exige API/Worker y token |
| Cloudflare D1 | 0 € | 5 M lecturas/día; 100 K escrituras/día; 5 GB | No: requiere Worker y modelo relacional |
| GitHub Releases / jsDelivr para imágenes | 0 € | CDN con uso aceptable | Solo plan B de imágenes |

### 4.2 Por qué no migrar hoy

- **Capacidad:** 3,86 MB de sitio y ~100 KB de JSON por visita están dos órdenes de magnitud por debajo de los límites gratuitos.
- **Complejidad:** una base de datos añade credenciales, backups, migraciones, errores de red y un runtime que hoy no existe. El pipeline actual es reproducible con `git` y `curl`.
- **Naturaleza del dato:** sin escrituras de usuario. Un JSON es inspeccionable, diffeable y restaurable.
- **Coste de salida:** migrar obligaría a reescribir Zod, Pydantic, los workflows y la caché de la app para resolver un problema que se arregla con un hash y unas imágenes.

### 4.3 El cuello de botella real no es el almacenamiento

| Problema | Dónde duele | Arreglo | Efecto |
|---|---|---|---|
| `squad.json` monolítico (950 KB) | 59,8 KB gzip por visita a Equipo; Zod valida 1.029 líneas de esquema | `squad.json` resumen + `players/{id}.json` | Equipo ≈ **3 KB gzip** |
| Escudos PNG de 2,32 MB a 92 px | Sección de escudos de Club | WebP 256/128 + `srcset` | **−90 %** de bytes |
| Home descarga 150 historias y 578 KB de miniaturas | Arranque en frío | `news-home.json` (5–10) + miniaturas 2× | **−80 %** |
| Retratos `-large` de 1,17 MB | Cuadrícula de Equipo | Pedir `-small` (27× menos) | ~32,7 MB → ~1,2 MB si se ven 28 |
| Caché en una sola clave | Límite de AsyncStorage en Android | Persistencia por consulta | Menos riesgo de corrupción |

### 4.4 Cuándo revisar la decisión

| Disparador | Umbral | Acción |
|---|---:|---|
| Tráfico mensual | > 50 GB/mes o p95 de home > 2 s | CDN delante de Pages o R2 para imágenes |
| Tamaño del sitio | > 500 MB o > 5.000 ficheros | Particionar más o mover binarios a R2 |
| Documento mayor | > 2 MB o > 150 KB gzip | Partir por entidad |
| Necesidad de escritura | Cualquier escritura de usuario | Worker + D1/Supabase/Turso |
| Frecuencia | > 1.000 commits/mes o > 100 MB/año | Rama de datos separada o publicación por artefacto |

**Decisión:** mantener JSON + Pages, **particionar** los documentos grandes, **optimizar** las imágenes y **corregir la idempotencia**. Revisar solo si se cruza uno de los umbrales anteriores.

---

## 5. Hallazgos por área

> **Convención.** Los hallazgos **Críticos y Altos** llevan la plantilla completa (evidencia, qué ocurre, causa, impacto, recomendación, esfuerzo, riesgo, dependencias). Los **Medios** usan la misma plantilla de forma abreviada y los **Bajos/Mejora** un bloque mínimo. Los IDs duplicados entre fases se han fusionado y se indica el alias: `D1-01 = F5-01`, `D1-02 = PIPE-03`, `D1-03 = F3-06`, `D1-06 = PIPE-10 = F3-20`, `D1-12 = F3-10`, `D1-15 = F3-04`, `PIPE-05 = F5-02`, `PIPE-13 = F5-10`, `F5-11 = F3-01`, `F3-16 = F5-05`, `F3-18 = D-23`, `F3-21 = F5-16 = F5-12`.
>
> **Etiquetas de evidencia:** `[CONFIRMADO]` código/configuración leída · `[MEDIDO]` comando/API/curl con salida · `[HIPÓTESIS]` inferencia razonada sin medición.

### 5.1 Datos

#### D1-01 · `main` local y producción divergen; `titles.json` y `rivalries.json` dan 404

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Medio · **Dependencias:** ninguna
- **Evidencia:** `git rev-list --left-right --count main...origin/main` → `23 159`; `curl -o /dev/null -w '%{http_code}' https://angelvilarino.github.io/depor-hub/v1/titles.json` → **404** (ídem `rivalries.json`); los 23 commits locales no tienen CI asociada. `FASE-1-datos.md:271-299`.
- **Qué ocurre:** el trabajo H7 de club (títulos, rivalidades, capa editorial) está en el árbol local y en `data/public`, pero no en `origin/main` ni en la copia publicada. La app local llama a `useTitles`/`useRivalries`; contra producción recibe 404, lo interpreta como «sin datos» y muestra secciones vacías **sin error visible**.
- **Causa raíz:** la rama local quedó 23 delante y 159 detrás; no se rebasó antes de seguir trabajando y el bot siguió avanzando `origin/main`.
- **Impacto:** producción sirve una app más antigua y sin las secciones nuevas; el propietario cree que están publicadas.
- **Recomendación:** rebasar `main` sobre `origin/main`, resolver conflictos de datos, abrir PR, dejar que CI valide y desplegar. Añadir un **smoke test post-deploy** que compruebe `200` y el `dataHash` esperado de cada documento del contrato.
- **Criterio de aceptación:** `curl` devuelve 200 para los 13 documentos; `git rev-list --count main..origin/main` = 0; el smoke test falla si un documento no coincide con `meta.json`.

#### D1-02 · `content_hash` no ignora `capturedAt` anidado → commits y deploys vacíos

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Medio · **Dependencias:** D1-01
- **Evidencia:** 270 de 273 commits de `squad.json` cambian **una sola línea**; 214 de 233 de `season.json` cambian ≤ 4 líneas. `content_hash()` hashea el documento completo, incluidos `season.provenance.*.capturedAt` y `generatedAt`. `FASE-1-datos.md:300-329`, `FASE-2-pipelines.md:389-403`.
- **Qué ocurre:** cada pasada real de ingesta reescribe los timestamps de procedencia; el hash cambia; se crea commit y se despliega Pages aunque el contenido canónico sea idéntico.
- **Causa raíz:** el hash se calcula sobre el JSON serializado sin normalizar campos volátiles en profundidad.
- **Impacto:** 179 de 233 commits (77 %) desde el 31-oct son ruido; ~489 despliegues vacíos/mes; historial y `.git` crecen sin información.
- **Recomendación:** normalizar el hash excluyendo `capturedAt`/`generatedAt` a cualquier profundidad, o mover las marcas de tiempo a un bloque `_meta` que no se hashea. Añadir un test de idempotencia que ejecute la ingesta dos veces con el mismo fixture y exija `changed=false` en la segunda.
- **Criterio de aceptación:** dos pasadas consecutivas con el mismo fixture producen **cero** commits; el test de idempotencia está en CI y falla si se reintroduce un campo volátil.

#### D1-03 · `squad.json` monolítico: 950 KB, el 51 % es historial que la lista no usa

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Bajo · **Dependencias:** D1-02
- **Evidencia:** 950.390 B; `deporMatches` 485.084 B (51 %), `career` 72.483 B (7,6 %); 1.262 partidos para 28 jugadores; 59,8 KB gzip por visita a Equipo.
- **Qué ocurre:** la lista de plantilla solo necesita nombre, dorsal, posición, foto y poco más, pero descarga y valida el historial completo de cada jugador.
- **Causa raíz:** un único documento por entidad padre en vez de resumen + detalle.
- **Impacto:** transferencia, parseo Zod y caché persistida pagan 950 KB para pintar 28 filas.
- **Recomendación:** `squad.json` resumen + `players/{id}.json` con historial y carrera. La ficha carga su detalle bajo demanda.
- **Criterio de aceptación:** `squad.json` ≤ 120 KB; Equipo transfiere ≤ 5 KB gzip; la ficha sigue mostrando los mismos datos.

#### D1-04 · 13 escudos PNG de 2,32 MB mostrados a 92 px

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Bajo · **Dependencias:** ninguna
- **Evidencia:** `data/public/v1/img/club/escudos/` = 14 PNG / 2,3 MB; `1910.png` = 289 KB a 381×512; se pintan a ~92 px. Supone el 59 % del peso de `data/public/v1`.
- **Qué ocurre:** se descargan originales de hasta 289 KB para una miniatura.
- **Causa raíz:** no hay paso de derivación de imágenes.
- **Impacto:** la sección de escudos es la más pesada del sitio y de las más lentas en 4G.
- **Recomendación:** generar WebP 256 y 128, servir `srcset` y conservar el PNG solo como descarga.
- **Criterio de aceptación:** la sección transfiere < 300 KB en total; ninguna miniatura supera 20 KB; el PNG original sigue disponible.

#### D1-05 · La home descarga 150 historias y 578 KB de miniaturas para mostrar 5

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Bajo · **Dependencias:** D1-03
- **Evidencia:** `news.json` 107.828 B (82 % en `stories`); home en frío ≈ 34 KB JSON + hasta 578.289 B de miniaturas. `FASE-1-datos.md:88-130`.
- **Qué ocurre:** Inicio pide el documento completo de noticias y todas sus imágenes.
- **Causa raíz:** no existe una vista «home» del feed ni miniaturas redimensionadas.
- **Impacto:** ~612 KB en el primer arranque para cinco titulares.
- **Recomendación:** `news-home.json` con 5–10 historias y miniaturas 2× del tamaño mostrado.
- **Criterio de aceptación:** home en frío < 150 KB; `news.json` completo solo se pide al abrir Noticias.

#### D1-06 · Documentos y campos muertos: `social.json`, `keyPlayers`, `marketValueEur`, `provenance`

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo · **Dependencias:** D1-01
- **Evidencia:** `social.json` (645 B) no lo consume ninguna pantalla; `keyPlayers` 0/19; `marketValueEur` 0/28; `provenance` 30.211 B en `squad.json` y no se muestra. Alias: PIPE-10, F3-20.
- **Qué ocurre:** se generan, versionan y transfieren campos que la UI no usa.
- **Causa raíz:** funcionalidades retiradas sin limpiar el contrato ni el pipeline.
- **Impacto:** ruido en el contrato, bytes y superficie de validación; confunde a un mantenedor nuevo.
- **Recomendación:** eliminar `social.json` del pipeline y del contrato; retirar `keyPlayers` y `marketValueEur`; mover `provenance` a un bloque no publicado o marcarlo como interno.
- **Criterio de aceptación:** ningún esquema, tipo Zod ni pantalla referencia esos campos; el pipeline no escribe `social.json`.

#### D1-07 · Triple esquema mantenido a mano: Pydantic, JSON Schema y Zod

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Medio · **Dependencias:** ninguna
- **Evidencia:** 14 esquemas JSON, 6.898 líneas de JSON Schema, `schemas.ts` 1.029 líneas / 178 constructores Zod y 86 `strictObject`. El espejo Zod no se genera.
- **Qué ocurre:** tres definiciones del mismo contrato evolucionan por separado.
- **Causa raíz:** no hay generación desde una fuente única.
- **Impacto:** riesgo alto de deriva; `strictObject` convierte cualquier campo nuevo en error de validación en cliente.
- **Recomendación:** generar Zod desde JSON Schema (o al menos un test que compare ambos) y usar `.passthrough()` en los objetos de borde para permitir campos aditivos.
- **Criterio de aceptación:** un test compara los campos de Pydantic, JSON Schema y Zod; añadir un campo al servidor no rompe el cliente.

#### D1-09 · Títulos y rivalidades tienen dos contratos solapados que ya divergen

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo · **Dependencias:** D1-01
- **Evidencia:** `titles.json` y `club.json.titles`; `rivalries.json` y `club.json.rivalries`. `FASE-1-datos.md:503-530`.
- **Qué ocurre:** la misma información vive en dos documentos con campos distintos.
- **Causa raíz:** se añadió la capa editorial sin retirar el documento previo.
- **Impacto:** dos fuentes de verdad; la UI puede mostrar datos distintos según la pantalla.
- **Recomendación:** una sola fuente por entidad; el otro documento pasa a ser una vista derivada o se elimina.
- **Criterio de aceptación:** un test verifica que ambas vistas coinciden en número y orden; no hay campos duplicados con nombres distintos.

#### D1-10 · Completitud: 3 pesos, 6 escudos históricos y 37 conflictos sin resolver

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Bajo · **Dependencias:** D1-11
- **Evidencia:** `weightKg` 25/28; 6 escudos históricos sin URL; 37 conflictos entre `squad_enrich.proposed.yml`, `squad_overrides.yml` y `squad_extras.yml`.
- **Qué ocurre:** la ficha muestra huecos y el pipeline arrastra conflictos que no se resuelven.
- **Causa raíz:** fuentes incompletas y un flujo de enriquecimiento manual sin cierre.
- **Impacto:** perceción de datos «a medias»; trabajo manual repetido.
- **Recomendación:** decidir por campo si el hueco es aceptable (mostrar «—») o bloqueante; resolver los 37 conflictos con una regla explícita de precedencia y un test.
- **Criterio de aceptación:** 0 conflictos sin resolver; los huecos se muestran de forma deliberada, no como celdas vacías.

#### D1-11 · Dos YAML generados de 1,52 MB y 37 conflictos versionados en `main`

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Bajo · **Dependencias:** ninguna
- **Evidencia:** `data/manual/squad_enrich.proposed.yml` (28.178 líneas añadidas históricas) y `squad_extras.yml` (27.452); juntos ~1,52 MB.
- **Qué ocurre:** artefactos de trabajo generados se versionan como si fueran fuente.
- **Causa raíz:** el flujo de enriquecimiento escribe en `data/manual` y se commitea.
- **Impacto:** repo más pesado, diffs ilegibles, conflictos de merge.
- **Recomendación:** tratar los `.proposed.yml` como artefacto (`.gitignore` + release/artefacto de Actions) y versionar solo el resultado consolidado.
- **Criterio de aceptación:** `git ls-files data/manual` no incluye `*.proposed.yml`; el flujo sigue siendo reproducible desde el artefacto.

#### D1-08 · El historial y los despliegues crecen por commits sin información

- **Severidad:** Baja · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** `.git` 26 MB, 3.182 objetos sueltos; 359 de 420 commits tocan `data/`; 4 de los 5 ficheros que más crecen son JSON/YAML de datos.
- **Recomendación:** `git gc` periódico, commits solo con cambio real (D1-02) y, si se cruza el umbral de 100 MB/año, rama de datos separada o publicación por artefacto.

#### D1-13 · Caché HTTP correcta pero sin URLs versionadas ni revalidación explícita

- **Severidad:** Baja · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** `Cache-Control: max-age=600` + `ETag` + `Vary: Accept-Encoding`; no hay `?v=` ni `immutable` en imágenes.
- **Recomendación:** `immutable` para imágenes con hash en el nombre; dejar el JSON con `max-age=600` y `must-revalidate`.

#### D1-14 · La home descarga los 19 rivales completos para mostrar un oponente

- **Severidad:** Baja · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** `rivals.json` 42.244 B (59 % en `rivals`), se usa un solo rival en Inicio.
- **Recomendación:** incluir el rival de la jornada en `fixtures.json` o un `rival-next.json` mínimo.

#### D1-15 · La caché persistida guarda `squad.json` completo (alias de F3-04)

- **Severidad:** Media (la canónica es **F3-04**, que mide el impacto en arranque) · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Medio
- **Evidencia:** una sola clave `deporhub-query-cache`, `throttleTime` 1.000 ms, reescritura completa; cerca del límite de AsyncStorage en Android.
- **Recomendación:** persistencia por consulta con `maxAge` y exclusión de documentos grandes; ver F3-04 y D1-03.

### 5.2 Pipelines

#### PIPE-01 · Actions deshabilitado a nivel de repositorio con workflows «activos»

- **Severidad:** Crítica · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Alto · **Dependencias:** ninguna
- **Evidencia:** `GET /actions/permissions` → `{"enabled": false}` el 2026-11-11 08:37 UTC; último run `42845450576` a las 2026-11-10 15:32:48 UTC; los 7 workflows devuelven `state: active`. `FASE-2-pipelines.md:359-373`.
- **Qué ocurre:** no se ejecuta ningún pipeline desde hace ~17 horas. Los datos publicados están congelados y `status.json` no se actualiza.
- **Causa raíz:** `actions/permissions.enabled=false` es un ajuste de repositorio que **prevalece** sobre el `state` de cada workflow. La Fase 0 midió antes de que se aplicara.
- **Impacto:** si nadie lo reactiva, la app sirve datos del 10-nov indefinidamente. Si se reactiva sin corregir la cadencia, vuelve el ruido de §3.
- **Recomendación:** decidir explícitamente si el parón es intencionado: si lo es, documentarlo y añadir un aviso en la app; si no, reactivar **después** de aplicar la cadencia nueva y el fix del hash.
- **Criterio de aceptación:** `/actions/permissions` → `enabled: true`; el siguiente run programado aparece en `gh run list` en < 2 h; README documenta el estado esperado.

#### PIPE-02 · El cron `*/10` ejecuta el pipeline completo aunque `--if-due` no toque la red

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo · **Dependencias:** PIPE-01
- **Evidencia:** 1.398 de 1.672 runs (84 %) sin commit; un run vacío dura ~13 s; 824 min en 22 días solo en pasadas sin cambio. `data-refresh.yml:1-110`.
- **Qué ocurre:** cada 10 minutos se arranca runner, se instala Python, se ejecutan `snapshots`, `match-details`, `club`, `club-images` y `validate` aunque no haya nada que hacer.
- **Causa raíz:** cadencia dimensionada para la ventana de partido y mantenida todo el día; los pasos no son condicionales.
- **Impacto:** ~4.250 min/mes de runner, de los que ~58 % es trabajo de bajo valor.
- **Recomendación:** base horaria + banda densa sáb/dom 12–23 UTC; hacer `snapshots`/`match-details`/`club`/`validate` condicionales a `changed=true` o a ventana de partido.
- **Criterio de aceptación:** runs/mes < 2.500; minutos/mes < 1.500; el resultado de un partido se publica en < 15 min dentro de la banda densa.

#### PIPE-04 · `match-details` convierte un fallo de BDFutbol en un run verde sin datos

- **Severidad:** Alta · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Medio · **Dependencias:** PIPE-07
- **Evidencia:** el paso captura el error y continúa; 2 de 10 pasadas de Rivals recibieron 403. `FASE-2-pipelines.md:404-418`.
- **Qué ocurre:** si el scraping falla, el workflow termina en verde y no se publican detalles del partido.
- **Causa raíz:** el error se trata como no bloqueante sin registrar estado.
- **Impacto:** fallo silencioso; la ficha de partido se queda sin alineaciones/eventos y nadie se entera.
- **Recomendación:** separar «no había partido pendiente» de «había partido y falló»; lo segundo debe marcar el run en rojo o `warning` visible y escribirlo en `meta.json`.
- **Criterio de aceptación:** un 403 simulado produce run no-verde y una entrada de error en `meta.json`; un día sin partido sigue siendo verde.

#### PIPE-05 · `status.json` consulta 50 runs globales y deja Rivals en `null` (alias F5-02)

- **Severidad:** Alta · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo · **Dependencias:** PIPE-01
- **Evidencia:** `status.json` en `ok:false` permanente; la ventana de 50 runs la consumen Data/News y Rivals (10 runs en 22 días) queda fuera. `FASE-5-calidad.md:200-213`.
- **Qué ocurre:** el semáforo del proyecto está en rojo aunque todo funcione.
- **Causa raíz:** una única ventana global en vez de una por workflow.
- **Impacto:** la señal de salud deja de ser informativa; se ignora por ruido.
- **Recomendación:** calcular el estado **por workflow** con su propia ventana y un `last_success_at`; el `ok` global es la conjunción.
- **Criterio de aceptación:** con Rivals semanal, `status.json` sigue en verde 7 días; un fallo real de Data lo pone en rojo en el siguiente run.

#### PIPE-06 · Carreras de push y fragilidad del deploy de Pages

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Medio · **Dependencias:** PIPE-16
- **Evidencia:** Data y Rivals comparten `concurrency: data-publish`; **News tiene `news-publish`**, así que Data y News pueden hacer push a la vez; 1 fallo `fetch first` y 1 HTTP 500; deploy con timeout de 10 min.
- **Qué ocurre:** el rebase de 5 intentos mitiga pero no elimina la carrera; si el deploy se encola, puede agotar el tiempo.
- **Causa raíz:** tres workflows independientes escribiendo `main` y desplegando Pages.
- **Impacto:** runs rojos tras haber generado el commit local; despliegues perdidos.
- **Recomendación:** un único grupo de concurrencia para escritura de datos y **un solo** workflow de publicación (`workflow_run` o reusable).
- **Criterio de aceptación:** 0 fallos de push en 30 días; un solo deploy por commit; el grupo de concurrencia cubre Data+News+Rivals.

#### PIPE-07 · BDFutbol: 403 en 2/10 pasadas y guard que no protege degradaciones parciales

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Medio · **Dependencias:** ninguna
- **Evidencia:** `rivals-refresh` 2 fallos de 10 por 403 en la fase de histórico; parsers regex sobre HTML sin fixtures completos.
- **Qué ocurre:** el scraping es el punto único de fallo de rivales y detalles de partido.
- **Causa raíz:** dependencia de HTML ajeno sin detección temprana ni backoff específico.
- **Impacto:** datos incompletos o congelados sin aviso; un rediseño de BDFutbol rompe el pipeline.
- **Recomendación:** fixtures HTML en tests, detección de «0 filas parseadas» como error, backoff y caché de la última respuesta válida.
- **Criterio de aceptación:** un HTML cambiado hace fallar un test, no producción; 0 filas parseadas ⇒ run rojo.

#### PIPE-08 · La rama local añadiría `club titles`/`club rivalries` al cron de 10 minutos

- **Severidad:** Alta · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Medio · **Dependencias:** D1-01
- **Evidencia:** `data-refresh.yml` local, líneas 65-72, añade los pasos de club ampliado dentro del cron existente.
- **Qué ocurre:** al publicar la rama, el scraping de BDFutbol se multiplicaría por 144 pasadas/día.
- **Causa raíz:** el trabajo nuevo se añadió al workflow más frecuente sin separarlo.
- **Impacto:** más 403, más minutos y más riesgo de bloqueo de la fuente.
- **Recomendación:** mover títulos y rivalidades a un `club-refresh` semanal o manual **antes** de publicar.
- **Criterio de aceptación:** `data-refresh.yml` no contiene pasos de títulos/rivalidades; existe `club-refresh.yml` semanal.

#### PIPE-09 · El cron de 10 minutos no garantiza 10 minutos

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** retardo mediano 139 s, p90 375 s, máximo 599 s; 17 huecos > 30 min en 11 días; hueco máximo 71,8 min.
- **Recomendación:** asumir el retardo en el diseño; si se necesita inmediatez real en directo, usar el Worker (hoy sin desplegar), no el cron.

#### PIPE-11 · Pasos no-op en cada run de Data

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** `snapshots`, `match-details`, `club`, `club-images`, `validate` se ejecutan siempre (`data-refresh.yml:50-80`).
- **Recomendación:** condicionar cada paso a `changed` o a ventana de partido; `validate` completo solo en CI.

#### PIPE-12 · Health no cubre Health/CI, no alerta y no tiene umbrales de frescura

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** `health.yml` solo comprueba una parte; `--soft` evita que `ok:false` tumbe el job; no hay notificación.
- **Recomendación:** incluir Health y CI, definir umbrales de antigüedad por documento y exponerlos; alerta opcional por issue.

#### PIPE-13 · CI no prueba el Worker ni un smoke end-to-end de los JSON publicados (alias F5-10)

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** `ci.yml` no ejecuta tests del Worker ni valida los documentos servidos; los commits del bot no disparan CI.
- **Recomendación:** job de Worker + smoke test de contrato; el bot debe disparar al menos validación.

#### PIPE-14 · El cron externo está documentado pero no implementado

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** `docs/operations.md` describe un respaldo externo que no existe en el repo.
- **Recomendación:** implementarlo o borrar la referencia; documentación que promete lo que no hay es peor que no tenerla.

#### PIPE-16 · Deploy completo de 3,9 MB desde tres workflows duplicados

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Medio
- **Evidencia:** tres copias del bloque de deploy (`data-refresh.yml:107-133`, `news-refresh.yml:82-108`, `rivals-refresh.yml:80-106`); se sube todo `data/public` desde cero.
- **Recomendación:** un `publish.yml` reutilizable; si es posible, deploy incremental o solo de los ficheros cambiados.

#### PIPE-15 · Coste privado: ~8.600 minutos facturables/mes

- **Severidad:** Baja · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** en repo privado serían ~8.600 min (~45 USD extra/mes); en público, 0 €.
- **Recomendación:** no es un problema hoy; la cadencia híbrida lo dejaría dentro de los 3.000 min de Pro si algún día se privatiza.

### 5.3 App y rendimiento

#### F3-01 · No hay pipeline de distribución ni versionado de build (alias F5-11)

- **Severidad:** Crítica · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** M · **Riesgo:** Alto · **Dependencias:** ninguna
- **Evidencia:** no existe `eas.json`; `app.json` no define `android.versionCode` ni `ios.buildNumber`; los identificadores `com.deporhub.app` son provisionales; la URL de datos de producción está vacía. `FASE-3-app.md:693-709`, `FASE-5-calidad.md:326-339`.
- **Qué ocurre:** no hay forma reproducible de generar un binario ni de publicar una actualización.
- **Causa raíz:** el proyecto se ha desarrollado en Expo Go y nunca se ha cruzado el umbral de distribución.
- **Impacto:** **bloqueante de producto**: la app no puede llegar a nadie que no sea el propietario. Todo lo demás es irrelevante hasta resolver esto.
- **Recomendación:** crear `eas.json` con perfiles `development`/`preview`/`production`, fijar `versionCode`/`buildNumber`, decidir identificadores definitivos y configurar la URL de producción por entorno.
- **Criterio de aceptación:** `eas build --profile preview` produce un APK instalable; la app arranca contra producción y muestra `dataHash` de `meta.json`.

#### F3-03 · Primer arranque sin red: skeletons indefinidos en toda la app

- **Severidad:** Crítica · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** M · **Riesgo:** Alto · **Dependencias:** F3-04
- **Evidencia:** `networkMode: 'online'` deja las consultas `paused`; timeout de 15 s × 3 reintentos ≈ 48 s; el splash se oculta antes de restaurar la caché. `src/data/DataProvider.tsx`, `src/data/queries.ts`.
- **Qué ocurre:** sin red, ninguna pantalla distingue «cargando» de «no hay datos»; se queda en skeleton para siempre.
- **Causa raíz:** la política de red no contempla offline y no hay estado terminal.
- **Impacto:** el peor escenario posible para una app de consulta: el usuario no sabe si esperar o cerrar.
- **Recomendación:** `networkMode: 'offlineFirst'`, timeout más corto, estado `offline` explícito con la antigüedad de la caché y botón de reintento; no ocultar el splash hasta hidratar la caché.
- **Criterio de aceptación:** en modo avión, toda pantalla muestra datos de caché o un mensaje «sin conexión, datos del …», nunca un skeleton infinito.

#### F3-02 · Navegación sin `+not-found`, sin `initialRouteName` y sin `ErrorBoundary`

- **Severidad:** Alta · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo · **Dependencias:** ninguna
- **Evidencia:** no existe `app/+not-found.tsx`; no hay `initialRouteName`; no hay `ErrorBoundary` de ruta.
- **Qué ocurre:** una ruta inválida o un error de render deja la app en blanco o en el estado por defecto.
- **Causa raíz:** el esqueleto de Expo Router nunca se completó.
- **Impacto:** un enlace profundo roto o un dato raro tumba la pantalla sin recuperación.
- **Recomendación:** añadir `+not-found`, `ErrorBoundary` por grupo de rutas y `initialRouteName: '(tabs)'`.
- **Criterio de aceptación:** navegar a `/no-existe` muestra una pantalla útil; un componente que lanza excepción muestra fallback y permite volver.

#### F3-05 · `strictObject` rompe la compatibilidad aditiva y oculta documentos inválidos

- **Severidad:** Alta · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Medio · **Dependencias:** D1-07
- **Evidencia:** 86 `strictObject` en `schemas.ts`; un campo nuevo del servidor invalida el documento; el error se traga y se muestra «sin datos».
- **Qué ocurre:** la app es frágil ante cualquier adición de contrato y no distingue «vacío» de «inválido».
- **Causa raíz:** validación estricta en el borde sin política de evolución.
- **Impacto:** un despliegue de datos puede vaciar pantallas sin error visible.
- **Recomendación:** `.passthrough()` en los objetos de borde, validación estricta solo en CI, y telemetría local del error de esquema.
- **Criterio de aceptación:** añadir un campo desconocido a un JSON no rompe la pantalla; un documento inválido muestra «datos no disponibles», no «vacío».

#### F3-15 · Falta el permiso de alarmas exactas en Android 12+

- **Severidad:** Alta · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Medio · **Dependencias:** ninguna
- **Evidencia:** `app.json` no declara `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM`; los recordatorios usan notificaciones programadas.
- **Qué ocurre:** en Android 12+ los recordatorios pueden llegar con minutos de retraso o no llegar.
- **Causa raíz:** requisito de plataforma no cubierto.
- **Impacto:** una función de utilidad real (avisar del partido) falla de forma intermitente.
- **Recomendación:** declarar el permiso, comprobar `canScheduleExactAlarms` y degradar con aviso si no está concedido.
- **Criterio de aceptación:** en Android 12+ un recordatorio a T−15 min se dispara con ±1 min o informa de que no puede.

#### F3-04 · Caché persistida en una sola entrada, cerca del límite de Android (alias D1-15)

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Medio
- **Evidencia:** `deporhub-query-cache` único, `throttleTime` 1.000 ms, reescritura completa; `squad.json` 950 KB.
- **Recomendación:** persistencia por consulta con `maxAge`, exclusión de documentos grandes y migración/limpieza al cambiar versión.

#### F3-07 · El refresco manual de la Home solo recarga 3 de 6 consultas

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** el `onRefresh` invalida un subconjunto de claves.
- **Recomendación:** invalidar todas las claves de la pantalla o usar `queryClient.invalidateQueries()` con prefijo.

#### F3-08 · «Borrar caché» no limpia la caché en memoria

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** solo limpia AsyncStorage; TanStack Query mantiene los datos en memoria.
- **Recomendación:** `queryClient.clear()` + `persister.removeClient()` + feedback explícito.

#### F3-14 · El objetivo de arranque < 2,5 s no está instrumentado ni medido

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** no hay marcas de tiempo de arranque ni medición en dispositivo; bundle Hermes 6.009.226 B.
- **Recomendación:** protocolo medible: `performance.mark` en `_layout`, primer render de Home y fin de hidratación; medir 10 arranques en frío en un dispositivo de gama media y publicar p50/p95. Objetivo: p75 < 2,5 s.
- **Criterio de aceptación:** existe un informe con 10 medidas en frío y p50/p95; la métrica se puede repetir con un comando documentado.

#### F3-16 · `syncReminders` no está serializado: cancelaciones y programaciones concurrentes (alias F5-05)

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Medio
- **Evidencia:** `src/features/reminders` llama a cancelar y programar sin cola; dos efectos pueden solaparse.
- **Recomendación:** mutex/cola de promesas y test de concurrencia; cubre también la capa de notificaciones a 0 % de cobertura.

#### F3-18 · Gallego al 29,7 % y documentación desactualizada (alias D-23)

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** 212 de 713 claves (29,7 %), no 162/454 como dice `ESTADO.md`; formatos de fecha/número inconsistentes.
- **Recomendación:** decidir entre completar GL o retirarlo; si se mantiene, marcar visualmente las cadenas sin traducir y unificar `Intl`.

#### F3-22 · Error de red presentado como «no encontrado» en Partido, Jugador y Entrenador

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** el estado de error cae en la rama de «no encontrado».
- **Recomendación:** separar `notFound` de `error` y ofrecer reintento.

#### F3-11 · 4,08 MB de fuentes de iconos y 4,8 MB de assets; `licenses.json` en el bundle

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** solo se usa Ionicons (389.724 B), pero el barrel importa 19 familias (4.076.840 B); `licenses.json` 95.701 B en el bundle.
- **Recomendación:** importar `@expo/vector-icons/Ionicons`; cargar licencias bajo demanda.

#### F3-12 · La cuenta atrás repinta cada segundo y hay cuatro timers en la Home

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Recomendación:** actualizar solo cuando cambia el valor mostrado (p. ej. cada minuto) y consolidar timers.

#### F3-10 · Retratos `-large` de 1,17 MB en la cuadrícula de 88 pt (alias D1-12)

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo · **Dependencias:** ninguna
- **Evidencia:** la cuadrícula de Equipo pide la variante `-large` (1.168.147 B) para celdas de 88 pt; la `-small` pesa 42.870 B (**27,2×** menos). 28 jugadores ⇒ hasta **32,7 MB**. `FASE-3-app.md:846-862`.
- **Qué ocurre:** se descarga la foto de alta resolución para una miniatura.
- **Causa raíz:** el componente de retrato no elige variante por tamaño mostrado.
- **Impacto:** la pantalla más visitada después de Inicio es la que más bytes mueve; en 4G son decenas de segundos.
- **Recomendación:** pedir `-small` en listas y `-large` solo en la cabecera de la ficha; usar `expo-image` con `contentFit` y caché.
- **Criterio de aceptación:** la cuadrícula de 28 retratos transfiere < 2 MB; la ficha sigue usando alta resolución.

#### F3-09 · `refetch()` del directo ejecuta una consulta deshabilitada

- **Severidad:** Baja · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Recomendación:** comprobar `enabled` antes de refrescar.

#### F3-13 · Listas sin memoización ni ajustes de virtualización

- **Severidad:** Baja · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Recomendación:** `React.memo` en filas, `keyExtractor` estable y `getItemLayout` donde aplique.

#### F3-17 · El plegado de ICS cuenta caracteres, no octetos UTF-8

- **Severidad:** Baja · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Recomendación:** plegar por octetos y añadir test con acentos/emoji.

#### F3-19 · Textos hardcodeados y metadatos ICS solo en español

- **Severidad:** Baja · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Recomendación:** mover a i18n y parametrizar el locale del calendario.

#### F3-20 · Código y claves i18n muertos (alias D1-06)

- **Severidad:** Baja · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Recomendación:** cruzar claves con `rg` y eliminar las no referenciadas; ver D1-06.

#### F3-21 · Higiene de dependencias: extraneous, Node y duplicados de tooling (alias F5-12/F5-16)

- **Severidad:** Baja · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** 18 MB de `@expo-google-fonts/*` extraneous; Node local 20.20.2 < 22.13; `override` de React rompe Dependabot.
- **Recomendación:** `npm prune`, `.nvmrc`/`engines` coherentes y revisar el `override`.

### 5.4 Diseño y experiencia

> Rúbrica completa en §6. Las capturas están en **modo oscuro** (no claro, como asumía el encargo); el modo claro solo se ha evaluado por tokens.

#### D-01 · El botón atrás muestra `(tabs)`

- **Severidad:** Crítica · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** S · **Riesgo:** Bajo · **Dependencias:** ninguna
- **Evidencia:** `calendario_vistaPartido.jpeg`, `equipo_vistaJugador*`; el título de la ruta padre se filtra al `headerBackTitle` de Expo Router.
- **Qué ocurre:** en la ficha de partido y en las fichas de jugador/entrenador el botón atrás dice literalmente `(tabs)`.
- **Causa raíz:** no se ha configurado `headerBackTitle`/`title` en el layout de las rutas apiladas.
- **Impacto:** es el defecto más visible y barato del producto; rompe la ilusión de app terminada en la primera interacción.
- **Recomendación:** `headerBackTitle: ''` o `headerBackButtonDisplayMode: 'minimal'` en el `Stack` raíz y títulos explícitos por ruta.
- **Criterio de aceptación:** ninguna pantalla muestra `(tabs)`; captura de cada ficha con el botón atrás correcto.

#### D-02 · G/E/P ilegibles sobre el cartel (1,02–1,56:1)

- **Severidad:** Crítica · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo · **Dependencias:** D-26
- **Evidencia:** `inicio_proximopartido.jpeg`, `inicio_rival.jpeg`; cálculo WCAG sobre `tokens.ts`: 1,02–1,56:1 frente al mínimo 4,5:1.
- **Qué ocurre:** las etiquetas de victorias/empates/derrotas se pintan sobre el degradado azul con un color casi idéntico.
- **Causa raíz:** el color semántico se eligió para fondo claro y se reutilizó sobre el cartel oscuro.
- **Impacto:** el dato más importante de la temporada es ilegible; incumple AA.
- **Recomendación:** usar la variante clara del semáforo sobre cartel o una pastilla con fondo propio; verificar 4,5:1 con herramienta.
- **Criterio de aceptación:** cada par texto/fondo del cartel ≥ 4,5:1 medido; captura con contraste anotado.

#### D-03 · Tres lenguajes visuales y `DesignSystem` huérfano

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** L · **Riesgo:** Medio · **Dependencias:** D-04, D-26
- **Evidencia:** `DesignSystem` se importa en **7 archivos**; **66 `<Card>`**, **4 `<PosterCard>`**, **6 `<PaperCard>`**; `SectionHeader` con 4 variantes. `FASE-4-diseno.md:186-199`.
- **Qué ocurre:** conviven «Cartel + Prensa» (Inicio, Rival), «Hero + Editorial» (Club) y `Card` genérico (resto).
- **Causa raíz:** la identidad se construyó para tres pantallas y no se extendió.
- **Impacto:** la app no parece un producto, sino tres cosidos; la nota global cae a 2,3/5.
- **Recomendación:** un sistema con tres superficies (`poster`/`paper`/`flat`) y migrar pantalla a pantalla empezando por Equipo, Calendario y Partido.
- **Criterio de aceptación:** 0 usos de `<Card>` fuera de `flat`; un inventario demuestra que ≥ 90 % de las pantallas usan el mismo `SectionHeader`.

#### D-04 · 318 tamaños literales y 25 escalas distintas

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** L · **Riesgo:** Medio · **Dependencias:** D-26
- **Evidencia:** 318 `fontSize` literales, 25 tamaños (9–64), 156 `fontWeight`; `tokens.ts` solo define familias, no escala.
- **Qué ocurre:** el mismo nivel de título mide 16 en Jugador, 21 en Club, 23 en Inicio y 27 en Himnos.
- **Causa raíz:** no hay escala tipográfica tokenizada.
- **Impacto:** jerarquía impredecible; cada pantalla se siente de un producto distinto.
- **Recomendación:** definir 8–10 pasos (`display`, `h1..h3`, `body`, `caption`, `numeral`) con línea y peso, y un lint que prohíba `fontSize` numérico.
- **Criterio de aceptación:** 0 `fontSize` literales fuera de `tokens.ts`; la escala aparece documentada con ejemplos.

#### D-05 · La ficha de partido es un documento de texto

- **Severidad:** Alta · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** L · **Riesgo:** Medio · **Dependencias:** D-03, D-04
- **Evidencia:** `calendario_vistaPartido.jpeg`, `calendario_vistaPartido2.jpeg`; nota 1,3/5; seis filas de metadatos, alineaciones en una línea por jugador, goles y cambios en párrafos.
- **Qué ocurre:** el partido —el momento central del producto— se presenta como una ficha administrativa.
- **Causa raíz:** se volcaron los datos sin diseñar la forma.
- **Impacto:** el usuario no puede leer el partido de un vistazo; es la peor pantalla de la app.
- **Recomendación:** marcador protagonista, campo de alineaciones, línea temporal de eventos, y metadatos en una sola línea secundaria.
- **Criterio de aceptación:** una captura de la ficha muestra marcador grande, once jugadores por equipo en campo y eventos en línea temporal; sin párrafos explicativos.

#### D-06 · Nombres y contexto duplicados hasta el ruido

- **Severidad:** Alta · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** M · **Riesgo:** Bajo · **Dependencias:** D-05, D-24
- **Evidencia:** el nombre del equipo aparece en cabecera, miga, tarjeta y fila; «Deportivo» repetido en cada bloque.
- **Qué ocurre:** información redundante ocupa el espacio que debería ir a datos.
- **Causa raíz:** cada componente pinta su propio contexto sin saber qué hay alrededor.
- **Impacto:** densidad alta sin información; el ojo no sabe dónde mirar.
- **Recomendación:** un solo encabezado por pantalla; el contexto se da una vez y se mantiene al hacer scroll.
- **Criterio de aceptación:** el nombre del equipo no aparece más de dos veces en el primer viewport de ninguna pantalla.

#### D-07 · Párrafos estáticos que explican la UI o sus límites

- **Severidad:** Alta · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** M · **Riesgo:** Bajo · **Dependencias:** D-05, D-09
- **Evidencia:** textos tipo «Datos pendientes», «Se muestra…», explicaciones de qué hace la pantalla en varias fichas.
- **Qué ocurre:** se usa prosa para justificar huecos y describir la interfaz.
- **Causa raíz:** se trasladó el lenguaje del repositorio a la UI.
- **Impacto:** es exactamente el «mucho texto estático» que el propietario rechaza.
- **Recomendación:** sustituir por estados visuales (`EmptyState` con icono y acción), etiquetas cortas y datos.
- **Criterio de aceptación:** 0 párrafos > 2 líneas que describan la UI; los vacíos usan el componente `EmptyState`.

#### D-08 · App estática: sin pressed, sin háptica, sin transiciones

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Medio · **Dependencias:** D-03
- **Evidencia:** un único `({ pressed })` en todo el código, 0 háptica, un solo archivo con Reanimated y 5 `Animated.timing`; media de Dinamismo 1,3/5.
- **Qué ocurre:** nada responde al toque ni acompaña al cambio de pantalla.
- **Causa raíz:** Reanimated/Gesture Handler están instalados pero no adoptados.
- **Impacto:** la app se siente de 2015 aunque el diseño sea bueno; contradice la prioridad «moderna, dinámica e interactiva».
- **Recomendación:** pressed con spring en todas las superficies, indicador de tab deslizante, entrada escalonada de listas y transición compartida en imágenes; respetar «reducir movimiento».
- **Criterio de aceptación:** toda superficie tocable tiene estado pressed; al menos 3 transiciones con Reanimated; `useReducedMotion` respetado.

#### D-09 · La ficha de jugador es un formulario

- **Severidad:** Alta · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** L · **Riesgo:** Medio · **Dependencias:** D-03, D-04
- **Evidencia:** `equipo_vistaJugador*`; dos `SegmentedControl` idénticos, franja de abreviaturas y rejilla de 7 campos; nota 1,9/5.
- **Qué ocurre:** el jugador se presenta como una ficha de datos, no como un cromo.
- **Causa raíz:** misma causa que D-05: volcado de datos sin jerarquía.
- **Impacto:** la pantalla que debería generar afinidad es la segunda peor.
- **Recomendación:** cabecera con retrato grande y dorsal, stats como tarjetas con número grande, trayectoria como raíl temporal, un solo segmentado.
- **Criterio de aceptación:** un dato protagonista por sección; un único control de navegación; sin rejilla de etiqueta/valor.

#### D-10 · Filas de calendario sin competición, jornada ni próximo partido

- **Severidad:** Alta · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** M · **Riesgo:** Bajo · **Dependencias:** D-23
- **Evidencia:** `calendario_proximos.jpeg`; las filas muestran fecha y equipos, pero no competición ni jornada; no hay marca del próximo partido.
- **Qué ocurre:** no se puede saber qué se juega ni cuál es el siguiente.
- **Causa raíz:** el componente de fila no recibe esos campos o no los pinta.
- **Impacto:** el calendario es una lista plana, no una herramienta.
- **Recomendación:** chip de competición y jornada, fila del próximo partido destacada, agrupación por mes con cabecera sticky.
- **Criterio de aceptación:** cada fila muestra competición; el próximo partido está visualmente destacado; agrupación mensual visible.

#### D-12 · El papel oscuro se confunde con el fondo (1,11:1)

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo · **Dependencias:** D-26
- **Evidencia:** `PaperCard` sobre fondo `#0B1220` da 1,11:1; el borde no compensa.
- **Qué ocurre:** las tarjetas «papel» no se distinguen del fondo en modo oscuro.
- **Causa raíz:** el token de papel se define para modo claro y se reutiliza en oscuro.
- **Impacto:** se pierde la metáfora editorial y la separación de bloques.
- **Recomendación:** token de papel específico para oscuro con elevación ≥ 1,3:1 o borde/sombra explícitos.
- **Criterio de aceptación:** separación papel/fondo ≥ 1,3:1 y borde visible; captura en oscuro.

#### D-22 · Texto pequeño, abreviaturas y targets sin garantía

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` + captura · **Esfuerzo:** M · **Riesgo:** Medio · **Dependencias:** D-04
- **Evidencia:** textos de 9–12 pt; abreviaturas sin leyenda; varios targets < 44 pt; accesibilidad media 2,0/5 y mínimo 1 en Redes.
- **Qué ocurre:** la app no es usable con vista cansada ni con dedos grandes.
- **Causa raíz:** la densidad se priorizó sobre la legibilidad.
- **Impacto:** exclusión de usuarios y suspenso en accesibilidad.
- **Recomendación:** mínimo 12 pt (13 para cuerpo), targets 44×44, `accessibilityLabel` en iconos y abreviaturas con leyenda.
- **Criterio de aceptación:** 0 textos < 12 pt; todos los touchables ≥ 44×44; auditoría de accesibilidad sin errores críticos.

#### D-26 · 43 hex, 5 familias y decenas de medidas fuera de tokens

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Medio · **Dependencias:** ninguna
- **Evidencia:** 43 colores hexadecimales literales, 5 familias tipográficas, decenas de márgenes mágicos; `tokens.ts` no cubre tamaños ni espaciado.
- **Qué ocurre:** el sistema de diseño es nominal: la mayoría de valores viven fuera de él.
- **Causa raíz:** tokens incompletos y prisa por pantalla.
- **Impacto:** cualquier cambio global es manual y frágil; deriva visual permanente.
- **Recomendación:** completar tokens (color, escala, espaciado 4/8, radios, sombras) y añadir regla de lint contra literales.
- **Criterio de aceptación:** 0 hex fuera de `tokens.ts`; escala de espaciado 4/8 usada en ≥ 90 % de los márgenes.

#### D-11 · «Noviembre De 2026» por `textTransform: capitalize`

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** `calendario_proximos.jpeg`; `textTransform: 'capitalize'` aplicado al mes completo.
- **Recomendación:** capitalizar solo la primera letra con `Intl.DateTimeFormat` y locale.

#### D-13 · Tiles de Club desbordados y badge que tapa el icono

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** `club_explorar.jpeg`.
- **Recomendación:** grid con `aspectRatio`, truncado a 2 líneas y badge fuera del área del icono.

#### D-14 · Los filtros de Club ocupan más que el contenido

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** `club_explorar.jpeg`; fila de chips persistente.
- **Recomendación:** chips colapsables o segmentado compacto; el contenido debe dominar el viewport.

#### D-15 · Patrocinadores como cajas vacías con monograma

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** `club_patrocinadores.jpeg`; nota 1,5/5.
- **Recomendación:** si no hay logo, no hay tarjeta: lista de texto con nombre y enlace, o retirar la sección.

#### D-16 · Himnos sin reproductor y con media pantalla vacía

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** `club_himnos*.jpeg`; nota 1,8/5.
- **Recomendación:** reproductor real (expo-audio, dependencia nueva) o presentar la letra como documento tipográfico; no dejar un hueco.

#### D-17 · Redes planas, todas azules y con el pájaro antiguo de Twitter

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** `club_redes.jpeg`; nota 1,5/5, accesibilidad 1/5.
- **Recomendación:** icono y color de marca por red, targets 44 pt y logotipo actual.

#### D-18 · Museo con copy repetido y sin información práctica

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** `club_museo.jpeg`; nota 1,6/5.
- **Recomendación:** convertir en visitante guiado (horario, ubicación, piezas) o retirar del producto.

#### D-19 · Ciudad deportiva como lista de bullets

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** `club_CiudadDeportiva.jpeg`; nota 1,9/5.
- **Recomendación:** mapa/plano con puntos de interés y una cifra protagonista (superficie, campos).

#### D-20 · Noticias con doble truncado y tres capas de filtro

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** `Noticias.jpeg`; nota 2,7/5, densidad 1/5.
- **Recomendación:** un solo truncado, un filtro principal y agrupación por fecha.

#### D-21 · Rivalidades invierte G/E/P y usa fechas ISO

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** `club_rivalidades.jpeg`; el orden de la barra no coincide con el resto de la app y las fechas se muestran en ISO.
- **Recomendación:** mismo orden semántico global y `Intl.DateTimeFormat`.

#### D-23 · Fechas, guiones y miles inconsistentes; GL al 30 % (alias F3-18)

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** distintos separadores y formatos entre pantallas; 212/713 claves GL.
- **Recomendación:** helpers únicos de formato y decisión sobre GL.

#### D-24 · Contexto de navegación duplicado y tarjetas anidadas

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` + captura · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** píldora «Equipo» en fichas compitiendo con el título; `Card` dentro de `Card`.
- **Recomendación:** eliminar la píldora y aplanar tarjetas anidadas.

#### D-25 · Emoji, Ionicons y logos mezclados sin criterio

- **Severidad:** Baja · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Recomendación:** una sola familia de iconos de interfaz y logos de marca aparte.

### 5.5 Calidad, seguridad y documentación

#### F5-03 · 3 vulnerabilidades `high` de npm quedan en verde por `continue-on-error`

- **Severidad:** Alta · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Medio · **Dependencias:** F5-04
- **Evidencia:** `npm audit --omit=dev` → 3 `high`, 32 `moderate`, 1 `low`; el job de auditoría en CI usa `continue-on-error: true`. `FASE-5-calidad.md:214-227`.
- **Qué ocurre:** la app puede publicarse con dependencias vulnerables y el CI no lo impide.
- **Causa raíz:** la auditoría se añadió como informativa, no como puerta.
- **Impacto:** riesgo real bajo en una app sin backend propio, pero invisible; contradice la sensación de «todo verde».
- **Recomendación:** separar `audit` en un job que falle solo con `high`, con allowlist documentada y fecha de revisión; actualizar las 3.
- **Criterio de aceptación:** `npm audit --omit=dev --audit-level=high` devuelve 0; el job falla si aparece un `high` nuevo.

#### F5-04 · Sin lockfile de Python y Dependabot no cubre `pip` ni el Worker

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** M · **Riesgo:** Medio
- **Evidencia:** no hay `requirements.txt`/`uv.lock`; `.github/dependabot.yml` solo declara `npm` y `github-actions`.
- **Recomendación:** lockfile reproducible y ecosistemas `pip` y `npm` del Worker.

#### F5-06 · Tests acoplados a datos publicados que el bot cambia sin CI

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** M · **Riesgo:** Medio
- **Evidencia:** varios tests leen `data/public` real; los commits del bot no disparan CI (ADR 0025).
- **Recomendación:** fixtures congelados en tests; CI sobre los commits de datos al menos para validación de contrato.

#### F5-07 · Cobertura real del 80 % con huecos en flujos críticos

- **Severidad:** Media · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** M · **Riesgo:** Bajo
- **Evidencia:** `app/_layout.tsx`, `settings.tsx`, `DataProvider.tsx`, `persister.ts`, `notifications.ts` a **0 %**; ramas 64 %.
- **Recomendación:** tests de arranque/offline, persistencia y recordatorios antes que subir el número global.

#### F5-08 · Documentación contradictoria y primera instrucción de arranque rota

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** `setup.sh` no existe; `ESTADO.md` dice GL 162/454 (real 212/713) y 15 imágenes (real 58); ADR 0016/0017/0018 superados sin marcar; ADR 0025 habla de `data-publish` y 3 reintentos frente a `news-publish` y 5.
- **Recomendación:** arreglar la primera instrucción, marcar ADRs superados y sustituir cifras por enlaces a la medición.

#### F5-09 · Acciones de GitHub fijadas por tag mayor, no por SHA

- **Severidad:** Media · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** M · **Riesgo:** Medio
- **Evidencia:** `actions/checkout@v4`, `setup-python@v5`, etc.
- **Recomendación:** fijar por SHA con comentario de versión; Dependabot mantiene las actualizaciones.

#### F5-13 · Worker con CORS abierto y sin límite por cliente

- **Severidad:** Baja · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Evidencia:** `Access-Control-Allow-Origin: *` en `workers/live-proxy/`.
- **Recomendación:** allowlist del origen de Pages; el Worker no está desplegado, así que el riesgo es potencial.

#### F5-14 · URLs externas sin allowlist de esquema en la app

- **Severidad:** Baja · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Recomendación:** validar `https:` antes de `Linking.openURL`.

#### F5-15 · `.gitignore` no cubre cachés de Python/cobertura

- **Severidad:** Mejora · **Evidencia:** `[CONFIRMADO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Recomendación:** añadir `__pycache__/`, `.pytest_cache/`, `coverage/`.

#### F5-16 · Node local por debajo del mínimo y sin fijación de versión (alias F3-21)

- **Severidad:** Mejora · **Evidencia:** `[MEDIDO]` · **Esfuerzo:** S · **Riesgo:** Bajo
- **Recomendación:** `.nvmrc` con 22.x y `engines` coherente.

---

## 6. Rúbrica de diseño por pantalla

Once criterios, 1–5, media aritmética simple. **Nota global del producto: 2,3/5.** Corpus: 29 capturas en modo oscuro (946×2048); Rival sin captura, puntuado por código y marcado provisional.

**Leyenda:** JER jerarquía · TIP tipografía · COL color/contraste · ESP espaciado · COM componentes · DIN dinamismo · INT interactividad · DAT visualización de datos · DEN densidad · ACC accesibilidad · MOD modernidad.

| Pantalla | JER | TIP | COL | ESP | COM | DIN | INT | DAT | DEN | ACC | MOD | **Media** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Inicio · Próximo partido | 4 | 4 | 4 | 4 | 4 | 2 | 2 | 4 | 4 | 3 | 4 | **3,5** |
| Inicio · El rival | 4 | 4 | 2 | 4 | 4 | 3 | 2 | 4 | 4 | 2 | 4 | **3,4** |
| Inicio · Temporada | 3 | 4 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 4 | **3,1** |
| Inicio · Clasificación y titulares | 3 | 3 | 3 | 3 | 3 | 1 | 2 | 3 | 2 | 3 | 3 | **2,6** |
| Equipo · Plantilla | 3 | 2 | 3 | 3 | 2 | 1 | 2 | 3 | 3 | 2 | 2 | **2,4** |
| Jugador · Resumen | 3 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | **2,0** |
| Jugador · Partidos | 3 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | **2,0** |
| Jugador · Trayectoria | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 2 | 2 | 1 | **1,7** |
| Entrenador · Resumen | 3 | 2 | 2 | 3 | 2 | 1 | 1 | 3 | 2 | 2 | 2 | **2,1** |
| Entrenador · Trayectoria y cuerpo técnico | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 1 | 2 | 1 | **1,6** |
| Calendario · Próximos | 3 | 3 | 3 | 3 | 3 | 1 | 2 | 3 | 3 | 3 | 2 | **2,6** |
| Partido · Resultado y alineaciones | 2 | 1 | 2 | 2 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | **1,4** |
| Partido · Eventos | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | **1,2** |
| Noticias | 4 | 3 | 3 | 3 | 3 | 1 | 3 | 3 | 1 | 3 | 3 | **2,7** |
| Club · Portada | 4 | 4 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 2 | 4 | **3,1** |
| Club · Explorar | 3 | 2 | 3 | 2 | 2 | 1 | 3 | 2 | 2 | 2 | 3 | **2,3** |
| Club · Cronología | 4 | 3 | 3 | 3 | 3 | 1 | 3 | 3 | 3 | 3 | 3 | **2,9** |
| Club · Estadio | 3 | 3 | 3 | 3 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | **2,3** |
| Club · Equipaciones | 2 | 3 | 2 | 2 | 2 | 1 | 2 | 3 | 1 | 2 | 2 | **2,0** |
| Club · Escudos | 3 | 3 | 3 | 3 | 2 | 1 | 3 | 2 | 1 | 2 | 2 | **2,3** |
| Club · Palmarés | 2 | 3 | 3 | 2 | 2 | 1 | 2 | 2 | 1 | 2 | 2 | **2,0** |
| Club · Rivalidades | 3 | 3 | 2 | 3 | 3 | 1 | 2 | 3 | 3 | 2 | 2 | **2,5** |
| Club · Himnos | 2 | 2 | 3 | 2 | 2 | 1 | 2 | 1 | 1 | 2 | 2 | **1,8** |
| Club · Vista de himno | 2 | 3 | 3 | 3 | 2 | 1 | 2 | 1 | 1 | 2 | 2 | **2,0** |
| Club · Junta | 4 | 3 | 3 | 3 | 3 | 1 | 2 | 3 | 3 | 2 | 3 | **2,7** |
| Club · Museo | 2 | 2 | 3 | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | **1,6** |
| Club · Patrocinadores | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | **1,5** |
| Club · Redes | 2 | 3 | 2 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | **1,5** |
| Club · Ciudad deportiva | 3 | 3 | 3 | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 2 | **1,9** |
| Rival · Ficha (provisional) | 4 | 4 | 3 | 4 | 3 | 3 | 2 | 4 | 3 | 2 | 4 | **3,3\*** |

### 6.1 Lectura

- **Mejor:** Inicio · Próximo partido (3,5). Es la única pantalla que se acerca a un producto editorial: cartel, jerarquía, aire y acción clara.
- **Peor:** Partido · Eventos (1,2). No hay un solo recurso visual: ni icono, ni línea temporal, ni agrupación. Es una lista de frases.
- **Mayor brecha interna:** Club. Cronología (2,9) y Junta (2,7) demuestran que el equipo sabe hacer interfaces de datos; Patrocinadores y Redes (1,5) demuestran lo contrario.
- **Problema sistémico:** **ninguna pantalla supera 3 en Dinamismo** salvo Inicio · Temporada y Rival (3, por animaciones puntuales). La media de Dinamismo es **1,3**. No es un problema de pantalla, es de plataforma.
- **Accesibilidad:** solo cuatro pantallas llegan a 3 y ninguna a 4. El mínimo global es 1 (Redes).
- **Coherencia:** el mismo nivel de título mide 16 en Jugador, 21 en Club, 23 en Inicio y 27 en Himnos. No hay escala, hay costumbre.

### 6.2 Prioridad de rediseño

| Orden | Pantalla | Nota | Por qué primero |
|---:|---|---:|---|
| 1 | Partido (resultado y eventos) | 1,2–1,4 | Es el corazón del producto y el peor caso |
| 2 | Jugador / Entrenador | 1,6–2,0 | Generan afinidad y hoy son formularios |
| 3 | Club (patrocinadores, redes, himnos, museo) | 1,5–1,9 | Contenido que no está listo: recortar antes de rediseñar |
| 4 | Equipo | 2,4 | Puerta de entrada a las fichas |
| 5 | Calendario | 2,6 | Fácil de arreglar (D-10, D-11) |
| 6 | Inicio | 3,1 | Ya funciona; solo movimiento y contraste |

### 6.3 Límites de esta rúbrica

- Solo hay **modo oscuro**; el claro se ha evaluado por tokens, no visualmente.
- No hay capturas de **carga, error, offline, texto grande, Ajustes ni Recordatorios**; esos estados se puntúan por código.
- **Rival** no tiene captura; su 3,3 es provisional.
- Las notas son de un auditor, no de usuarios reales. No hay test con personas ni analítica (la app no la tiene).

---

## 7. Matriz de decisiones

> Cubre **todos** los hallazgos de severidad **Media o superior** (68 filas únicas tras fusionar duplicados). Decisión: **Hacer** (corregir), **Reducir** (recortar alcance), **Retirar** (eliminar), **Mantener** (aceptar con justificación). Cada fila es convertible en un prompt de corrección independiente: el «criterio de aceptación» es la condición verificable.

### 7.1 Datos

| ID | Sev | Decisión | Lote | Esf | Criterio de aceptación |
|---|---|---|---|---|---|
| D1-01 / F5-01 | Alta | Hacer | 0 | M | `main..origin/main` = 0; 13 documentos a 200; smoke test activo |
| D1-02 / PIPE-03 | Alta | Hacer | 1 | S | Dos ingestas idénticas ⇒ 0 commits; test en CI |
| D1-03 / F3-06 | Media | Hacer | 2 | M | `squad.json` ≤ 120 KB; Equipo ≤ 5 KB gzip |
| D1-04 | Media | Hacer | 2 | M | Sección de escudos < 300 KB; miniatura < 20 KB |
| D1-05 | Media | Hacer | 2 | M | Home en frío < 150 KB; feed completo solo en Noticias |
| D1-06 / PIPE-10 / F3-20 | Media | Retirar | 7 | S | 0 referencias a `social.json`, `keyPlayers`, `marketValueEur` |
| D1-07 | Media | Hacer | 7 | M | Test de paridad Pydantic ↔ JSON Schema ↔ Zod |
| D1-09 | Media | Hacer | 7 | S | Una fuente por entidad; test de coincidencia entre vistas |
| D1-10 | Media | Hacer | 7 | M | 0 conflictos sin resolver; huecos mostrados con «—» |
| D1-11 | Media | Retirar | 7 | M | `*.proposed.yml` fuera de git; flujo reproducible |
| D1-12 / F3-10 | Media | Hacer | 2 | S | Cuadrícula pide `-small`; 28 retratos < 2 MB |

### 7.2 Pipelines

| ID | Sev | Decisión | Lote | Esf | Criterio de aceptación |
|---|---|---|---|---|---|
| PIPE-01 | Crítica | Hacer | 0 | S | `enabled: true`; run programado en < 2 h; documentado |
| PIPE-02 | Alta | Hacer | 1 | S | < 2.500 runs/mes y < 1.500 min/mes; resultado en < 15 min en ventana |
| PIPE-04 | Alta | Hacer | 0 | S | 403 simulado ⇒ run no verde + error en `meta.json` |
| PIPE-05 / F5-02 | Alta | Hacer | 0 | S | Estado por workflow; verde 7 días con Rivals semanal |
| PIPE-06 | Alta | Hacer | 1 | M | 0 fallos de push en 30 días; 1 deploy por commit |
| PIPE-07 | Alta | Hacer | 1 | M | HTML cambiado rompe test, no producción; 0 filas ⇒ rojo |
| PIPE-08 | Alta | Hacer | 1 | S | Sin títulos/rivalidades en `data-refresh`; `club-refresh` semanal |
| PIPE-09 | Media | Mantener | — | — | Aceptado: el cron no garantiza 10 min; el directo usa Worker |
| PIPE-11 | Media | Hacer | 1 | S | Pasos condicionados a `changed` o ventana |
| PIPE-12 | Media | Hacer | 1 | M | Estado cubre Health y CI; umbrales de frescura definidos |
| PIPE-13 / F5-10 | Media | Hacer | 7 | M | CI ejecuta tests del Worker y smoke de contrato |
| PIPE-14 | Media | Retirar | 7 | M | Cron externo implementado o referencia eliminada |
| PIPE-16 | Media | Hacer | 1 | M | Un solo `publish.yml`; un deploy por cambio |

### 7.3 App

| ID | Sev | Decisión | Lote | Esf | Criterio de aceptación |
|---|---|---|---|---|---|
| F3-01 / F5-11 | Crítica | Hacer | 3 | M | `eas build --profile preview` genera APK instalable contra producción |
| F3-02 | Alta | Hacer | 3 | S | `/no-existe` muestra pantalla útil; error de render con fallback |
| F3-03 | Crítica | Hacer | 3 | M | Modo avión ⇒ caché o mensaje «sin conexión», nunca skeleton infinito |
| F3-05 | Alta | Hacer | 3 | S | Campo desconocido no rompe; inválido ≠ vacío |
| F3-04 | Media | Hacer | 2 | M | Caché por consulta; sin reescritura completa ni riesgo de límite Android |
| F3-07 | Media | Hacer | 3 | S | Pull-to-refresh invalida las 6 consultas de Home |
| F3-08 | Media | Hacer | 3 | S | «Borrar caché» limpia memoria + disco con feedback |
| F3-11 | Media | Hacer | 2 | S | Solo Ionicons en el bundle; `licenses.json` bajo demanda |
| F3-12 | Media | Hacer | 3 | S | Cuenta atrás y timers sin repintar cada segundo |
| F3-14 | Media | Hacer | 3 | M | Informe de 10 arranques en frío con p50/p95 y p75 < 2,5 s |
| F3-15 | Alta | Hacer | 3 | S | Recordatorio T−15 en Android 12+ con ±1 min o aviso |
| F3-16 / F5-05 | Media | Hacer | 3 | S | Test de concurrencia de `syncReminders`; capa de notificaciones cubierta |
| F3-18 / D-23 | Media | Hacer | 5 | M | GL completo o retirado; formatos vía `Intl` |
| F3-22 | Media | Hacer | 3 | S | `notFound` y `error` con reintento, estados distintos |

### 7.4 Diseño

| ID | Sev | Decisión | Lote | Esf | Criterio de aceptación |
|---|---|---|---|---|---|
| D-01 | Crítica | Hacer | 4 | S | Ninguna pantalla muestra `(tabs)` |
| D-02 | Crítica | Hacer | 4 | S | Todo texto del cartel ≥ 4,5:1 |
| D-03 | Alta | Hacer | 4 | L | 0 `<Card>` fuera de `flat`; `SectionHeader` único |
| D-04 | Alta | Hacer | 4 | L | 0 `fontSize` literales fuera de tokens |
| D-05 | Alta | Hacer | 5 | L | Marcador + campo + línea temporal; sin párrafos |
| D-06 | Alta | Hacer | 5 | M | Nombre del equipo ≤ 2 veces en el primer viewport |
| D-07 | Alta | Hacer | 5 | M | 0 párrafos que expliquen la UI; vacíos con `EmptyState` |
| D-08 | Alta | Hacer | 4 | M | Pressed en toda superficie; 3 transiciones; reduce-motion respetado |
| D-09 | Alta | Hacer | 5 | L | Un dato protagonista por sección; un solo segmentado |
| D-10 | Alta | Hacer | 5 | M | Competición + jornada por fila; próximo partido destacado |
| D-12 | Alta | Hacer | 4 | S | Papel/fondo ≥ 1,3:1 o borde visible |
| D-22 | Alta | Hacer | 4 | M | Texto ≥ 12 pt; touchables ≥ 44×44; labels en iconos |
| D-26 | Alta | Hacer | 4 | M | 0 hex fuera de tokens; espaciado 4/8 en ≥ 90 % |
| D-11 | Media | Hacer | 5 | S | Mes capitalizado solo en la inicial |
| D-13 | Media | Hacer | 6 | M | Grid con `aspectRatio`; badge fuera del icono |
| D-14 | Media | Hacer | 6 | M | Filtros no ocupan más que el contenido |
| D-15 | Media | Retirar | 6 | M | Sin logo no hay tarjeta; sección con contenido real o fuera |
| D-16 | Media | Reducir | 6 | M | Reproductor real o letra como documento; sin hueco |
| D-17 | Media | Hacer | 6 | S | Icono y color por red; logo actual; target 44 pt |
| D-18 | Media | Retirar | 6 | M | Museo con información práctica o fuera del producto |
| D-19 | Media | Hacer | 6 | M | Plano/mapa con puntos y cifra protagonista |
| D-20 | Media | Hacer | 5 | M | Un truncado, un filtro principal, agrupación por fecha |
| D-21 | Media | Hacer | 5 | S | Orden G/E/P global; fechas con `Intl` |
| D-24 | Media | Hacer | 4 | S | Sin píldora de contexto; sin `Card` anidada |

### 7.5 Calidad y seguridad

| ID | Sev | Decisión | Lote | Esf | Criterio de aceptación |
|---|---|---|---|---|---|
| F5-03 | Alta | Hacer | 7 | M | `npm audit --audit-level=high` = 0; job bloqueante |
| F5-04 | Media | Hacer | 7 | M | Lockfile Python; Dependabot cubre `pip` y Worker |
| F5-06 | Media | Hacer | 7 | M | Fixtures congelados; CI valida commits de datos |
| F5-07 | Media | Hacer | 7 | M | Tests de arranque/offline, persistencia y recordatorios |
| F5-08 | Media | Hacer | 7 | S | `setup.sh` existe o se corrige; ADRs superados marcados; cifras corregidas |
| F5-09 | Media | Hacer | 7 | M | Acciones fijadas por SHA con comentario de versión |

### 7.6 Resumen de la matriz

| Decisión | Nº | Lectura |
|---|---:|---|
| **Hacer** | 61 | La mayoría son correcciones pequeñas o medias |
| **Reducir** | 1 | Himnos (D-16) |
| **Retirar** | 5 | Dead fields, YAML propuestos, patrocinadores vacíos, museo sin valor, cron externo fantasma |
| **Mantener** | 1 | PIPE-09: el cron no garantiza 10 min; se asume |
| **Baja/Mejora (fuera de matriz)** | 13 | Ver §5 |

---

## 8. Hoja de ruta por lotes

Cada lote es **independiente y verificable**. No se abre el siguiente sin cerrar el criterio de salida del anterior. Esfuerzos en días de una persona: S ≤ 1, M ≤ 3, L ≤ 8.

### Lote 0 · Verdad operativa (1–2 días)

**Objetivo:** saber qué hay publicado y que el semáforo no mienta.

| Acción | Hallazgo | Criterio de salida |
|---|---|---|
| Rebasear `main`, resolver conflictos, PR y deploy | D1-01 / F5-01 | 0 divergencia; 13 documentos a 200 |
| Smoke test post-deploy en CI | D1-01 | Falla si falta un documento o no coincide `dataHash` |
| `status.json` por workflow con ventana propia | PIPE-05 / F5-02 | Verde 7 días con Rivals semanal |
| Fallo de BDFutbol ya no es verde | PIPE-04 | 403 simulado ⇒ run no verde |
| Decidir y documentar el estado de Actions | PIPE-01 | `enabled` coherente con lo documentado |

**No hacer todavía:** cambiar la cadencia. Primero hay que publicar y ver.

### Lote 1 · Idempotencia y cadencia (2–3 días)

**Objetivo:** dejar de pagar por runs y commits que no cambian nada.

| Acción | Hallazgo | Criterio de salida |
|---|---|---|
| Hash normalizado + test de doble pasada | D1-02 / PIPE-03 | Dos ingestas ⇒ 0 commits |
| Cron híbrido (horario + `*/10` sáb/dom 12–23) | PIPE-02 | < 2.500 runs/mes, < 1.500 min/mes |
| Pasos condicionales a `changed`/ventana | PIPE-11 | `validate` no corre sin cambios |
| Un solo `publish.yml` | PIPE-06, PIPE-16 | 1 deploy por commit; 0 carreras en 30 días |
| `club-refresh` semanal | PIPE-08 | Títulos/rivalidades fuera del `*/10` |
| Fixtures y detección de 0 filas | PIPE-07 | HTML roto ⇒ test rojo |
| Health 4 h + umbrales | PIPE-12 | Estado con frescura por documento |

**Criterio de salida del lote:** 30 días con < 5 commits de datos/día y 0 commits que solo muevan timestamps.

### Lote 2 · Peso de datos e imágenes (3–5 días)

**Objetivo:** que cada pantalla descargue lo que muestra.

| Acción | Hallazgo | Criterio de salida |
|---|---|---|
| `squad.json` resumen + `players/{id}.json` | D1-03 / F3-06 | Equipo ≤ 5 KB gzip |
| `news-home.json` + miniaturas 2× | D1-05 | Home < 150 KB |
| WebP de escudos + `srcset` | D1-04 | Sección < 300 KB |
| Retratos `-small` en cuadrícula | D1-12 / F3-10 | 28 retratos < 2 MB |
| Caché por consulta | F3-04 / D1-15 | Sin reescritura completa; sin límite Android |

**Criterio de salida:** home en frío < 200 KB; Equipo < 100 KB; ficha de partido < 60 KB.

### Lote 3 · Release y resiliencia (3–5 días)

**Objetivo:** que la app se pueda instalar y no se rompa sin red.

| Acción | Hallazgo | Criterio de salida |
|---|---|---|
| `eas.json`, versionado e identificadores | F3-01 / F5-11 | APK instalable contra producción |
| `offlineFirst` + estados terminales | F3-03 | Modo avión usable |
| `+not-found`, `ErrorBoundary`, `initialRouteName` | F3-02 | Rutas rotas con recuperación |
| Zod tolerante en el borde | F3-05 | Campo nuevo no rompe |
| Alarmas exactas Android 12+ | F3-15 | Recordatorio ±1 min |
| `syncReminders` serializado + tests | F3-16 / F5-05 | Test de concurrencia |
| Protocolo de arranque < 2,5 s | F3-14 | Informe p50/p95 |
| Refresco completo, borrado real, errores separados | F3-07, F3-08, F3-22 | Comportamiento verificable por pantalla |

**Criterio de salida:** un tercero instala la app, la abre en modo avión y ve datos con antigüedad, sin skeleton.

### Lote 4 · Sistema de diseño y navegación (5–8 días)

**Objetivo:** una app, no tres.

| Acción | Hallazgo | Criterio de salida |
|---|---|---|
| Tokens completos (color, escala, espaciado, radios) | D-04, D-26 | 0 literales fuera de tokens |
| Navegación y chrome | D-01, D-24 | Sin `(tabs)`, sin píldoras |
| Contraste del cartel y del papel | D-02, D-12 | ≥ 4,5:1 texto; ≥ 1,3:1 superficie |
| Accesibilidad base | D-22 | ≥ 12 pt, ≥ 44 pt, labels |
| Movimiento con propósito | D-08 | Pressed global + 3 transiciones |
| Migración a `poster`/`paper`/`flat` | D-03 | 0 `Card` fuera de `flat` |

**Criterio de salida:** una captura de cualquier pantalla se reconoce como la misma app.

### Lote 5 · Fichas como interfaces (8–12 días)

**Objetivo:** que el partido y el jugador sean el producto.

| Acción | Hallazgo | Criterio de salida |
|---|---|---|
| Ficha de partido: marcador, campo, línea temporal | D-05 | Sin párrafos; 11 por equipo en campo |
| Ficha de jugador: cabecera, stats, raíl | D-09 | Un protagonista por sección |
| Calendario con competición y próximo | D-10 | Fila completa y destacada |
| Menos contexto duplicado y menos prosa | D-06, D-07 | ≤ 2 menciones; 0 párrafos de UI |
| Noticias: un truncado, un filtro | D-20 | Densidad ≥ 3 |
| Formato y GL | D-23 / F3-18, D-21, D-11 | `Intl` único; GL decidido |

**Criterio de salida:** Partido ≥ 3,0 y Jugador ≥ 3,0 en la rúbrica de §6.

### Lote 6 · Club con criterio editorial (3–5 días)

**Objetivo:** recortar antes de rediseñar.

| Acción | Hallazgo | Criterio de salida |
|---|---|---|
| Grid y filtros | D-13, D-14 | Contenido domina el viewport |
| Patrocinadores y museo | D-15, D-18 | Con contenido real o fuera |
| Himnos | D-16 | Reproductor o documento; sin hueco |
| Redes y ciudad deportiva | D-17, D-19 | Targets y mapa/plano |

**Criterio de salida:** ninguna sección de Club por debajo de 2,5.

### Lote 7 · Higiene, contratos y documentación (3–5 días)

**Objetivo:** que el siguiente mantenedor (o el mismo en seis meses) no tenga que arqueología.

| Acción | Hallazgo | Criterio de salida |
|---|---|---|
| Retirar campos y documentos muertos | D1-06 / PIPE-10 / F3-20 | 0 referencias |
| Paridad de esquemas | D1-07 | Test Pydantic ↔ JSON Schema ↔ Zod |
| Conflictos y YAML | D1-10, D1-11 | 0 conflictos; propuestos fuera de git |
| CI completo | PIPE-13 / F5-10 | Worker + smoke + Prettier |
| Seguridad | F5-03, F5-04, F5-09 | Audit bloqueante, lockfile, SHA |
| Tests de flujos críticos | F5-07 | Arranque/offline/persistencia cubiertos |
| Documentación | F5-08, PIPE-14 | Arranque reproducible; ADRs marcados |

**Criterio de salida:** un clon limpio arranca con las instrucciones del README sin pasos ocultos.

### 8.1 Secuencia y dependencias

```
Lote 0 ──> Lote 1 ──> Lote 2 ──> Lote 3 ──> Lote 4 ──> Lote 5 ──> Lote 6
                 └──────────────────────────> Lote 7 (transversal, al final)
```

- **Lote 0 es bloqueante:** sin publicación y semáforo fiable, el resto se valida a ciegas.
- **Lote 1 antes de Lote 2:** sin idempotencia, cada cambio de formato genera commits vacíos.
- **Lote 4 antes de Lote 5:** rediseñar fichas sin tokens multiplica el trabajo.
- **Lote 7 puede solaparse** con 5 y 6 si hay una segunda persona; con una, va al final.

### 8.2 Estimación total

| Lotes | Días (1 persona) |
|---|---:|
| 0 + 1 | 3–5 |
| 2 + 3 | 6–10 |
| 4 + 5 | 13–20 |
| 6 + 7 | 6–10 |
| **Total** | **28–45 días** |

**Si solo hay dos semanas:** Lotes 0, 1 y 3. Es lo que convierte el proyecto en algo publicable y sostenible. El diseño puede esperar; la app que no se instala y los commits vacíos, no.

---

## 9. Preguntas abiertas

Estas no se pueden responder con el repositorio; necesitan una decisión del propietario.

1. **¿El parón de Actions es intencionado?** Si sí, ¿hasta cuándo y qué debe mostrar la app mientras tanto? Si no, ¿se reactiva antes o después del Lote 1?
2. **¿La app es para publicar en tiendas o para uso personal?** Cambia por completo la prioridad de F3-01: con distribución, `eas.json` e identificadores son críticos; sin ella, basta un APK de preview.
3. **¿El gallego se completa o se retira?** 212/713 no es «casi»: es un tercio. Mantenerlo a medias es peor que no ofrecerlo.
4. **¿El Club es un producto o un archivo?** Cinco secciones (patrocinadores, himnos, museo, redes, ciudad deportiva) no aportan hoy valor práctico. ¿Se recortan o se completan con contenido real?
5. **¿Se quiere directo real?** El Worker existe sin desplegar y el cron no garantiza 10 minutos. Si el directo es un requisito, hay que desplegar el Worker y asumir su contrato; si no, conviene retirar la promesa.
6. **¿Cuál es el presupuesto de frescura aceptable?** 60 minutos de base y 10 en ventana es la recomendación; si el propietario exige 10 minutos siempre, el coste es ~7.230 runs/mes y el cron no lo garantiza igualmente.
7. **¿Se acepta el coste de mantener tres esquemas?** Si no, hay que generar Zod desde JSON Schema; si sí, hay que añadir el test de paridad.
8. **¿Qué pasa con los 37 conflictos de enriquecimiento?** ¿Se resuelven a mano, se descartan o se aplica una regla automática?
9. **¿La URL de producción es `angelvilarino.github.io/depor-hub` de forma definitiva?** Hoy es la única que existe y no está configurada en la app.
10. **¿Se quiere conservar el historial de datos en git?** Si el repo crece, la alternativa es una rama de datos o publicación por artefacto; decidirlo antes de cruzar 100 MB/año.

---

## 10. Limitaciones de esta auditoría

| Limitación | Efecto |
|---|---|
| **Divergencia local/producción (23/159)** | Se audita el árbol local; las cifras de producción pueden diferir y se han contrastado cuando ha sido posible |
| **Capturas solo en modo oscuro** | El modo claro se evalúa por tokens, no visualmente. El encargo asumía modo claro |
| **Sin capturas de carga/error/offline/Ajustes/Recordatorios** | Esos estados se puntúan por código, no por experiencia real |
| **Rival sin captura** | Su 3,3/5 es provisional |
| **Sin medición en dispositivo** | El objetivo < 2,5 s no se ha medido; se propone protocolo, no resultado |
| **Sin acceso a football-data.org** | No se ha verificado la cuota real de la API; se usa la documentación pública |
| **Sin `pip-audit` local** | La auditoría de dependencias Python no se ha podido ejecutar |
| **Historial de Actions de 22 días** | Puede no representar un año completo; los porcentajes son de esa ventana |
| **Coste real de Actions** | En repo público es 0 €; el cálculo de repo privado es una estimación |
| **Legalidad fuera de alcance** | BDFutbol, escudos, fotos y titulares no se evalúan |
| **Una sola persona, un solo auditor** | Las notas de diseño son subjetivas y no hay test con usuarios |
| **Sin analítica** | No hay datos de uso real; las prioridades son de producto, no de tráfico |

---

## 11. Anexos

### Anexo A · Inventario de capturas

29 imágenes en `docs/auditoria/capturas/`, 946×2048, **modo oscuro**, tomadas el 2026-11-10.

| Grupo | Nº | Archivos |
|---|---:|---|
| Inicio | 4 | `inicio_proximopartido`, `inicio_rival`, `inicio_temporada`, `inicio_clasificacionytitulares` |
| Equipo y fichas | 6 | `equipo`, `equipo_vistaJugador`, `equipo_vistaJugador_Partidos`, `equipo_vistaJugador_Trayectoria`, `equipo_vistaEntrenador`, `equipo_vistaEntrenador_trayectoriaCuerpoTecnico` |
| Calendario y partido | 3 | `calendario_proximos`, `calendario_vistaPartido`, `calendario_vistaPartido2` |
| Noticias | 1 | `Noticias` |
| Club | 15 | `club`, `club_explorar`, `club_cronologia`, `club_estadio`, `club_equipaciones`, `club_escudos`, `club_titulos`, `club_rivalidades`, `club_himnos`, `club_himnos_vistahimno`, `club_junta`, `club_museo`, `club_patrocinadores`, `club_redes`, `club_CiudadDeportiva` |
| Rival | 0 | Sin captura; evaluado por `app/rival/[teamId].tsx` |

Notas de pantalla en `docs/auditoria/parciales/FASE-4-notas-*.md` (8 ficheros).

### Anexo B · Comandos de reproducción

Todo lo medido se puede repetir desde la raíz del repo.

**Entorno y tests**

```bash
node -v && npm -v && python -V
ruff check scripts
pytest scripts -q
cd apps/mobile && npm run lint && npm run typecheck && npx jest --ci --runInBand
# cobertura real (no la de por defecto)
npx jest --ci --coverage --collectCoverageFrom='app/**/*.{ts,tsx}' --collectCoverageFrom='src/**/*.{ts,tsx}' --coverageDirectory=/tmp/auditoria-cov
```

**Datos**

```bash
du -sh data/public/v1
wc -c data/public/v1/*.json
jq '[.players[].deporMatches] | length' data/public/v1/squad.json
jq '[.players[] | select(.marketValueEur != null)] | length' data/public/v1/squad.json
# transferencia real
for f in meta standings fixtures news season rivals club squad; do
  curl -s -o /dev/null -w "$f %{http_code} %{size_download}\n" -H 'Accept-Encoding: gzip' \
    "https://angelvilarino.github.io/depor-hub/v1/$f.json"
done
```

**Git**

```bash
git rev-list --left-right --count main...origin/main
git log --oneline main -- data/public/v1/squad.json | wc -l
git log --oneline main -- data/public/v1/season.json | wc -l
du -sh .git && git count-objects -vH
```

**Actions (solo lectura)**

```bash
gh api repos/angelvilarino/depor-hub/actions/permissions
gh run list --limit 50 --json name,conclusion,createdAt,updatedAt
gh api 'repos/angelvilarino/depor-hub/actions/workflows' --jq '.workflows[] | {name,state}'
```

**Diseño (recuentos de código)**

```bash
rg -c 'fontSize:' apps/mobile/app apps/mobile/src | awk -F: '{s+=$2} END {print s}'
rg -c '<Card' apps/mobile/app apps/mobile/src | awk -F: '{s+=$2} END {print s}'
rg -l 'DesignSystem' apps/mobile/app apps/mobile/src | wc -l
```

### Anexo C · Cronología breve

| Fecha | Hecho |
|---|---|
| 2026-10-20 10:06 UTC | Primer run del historial de Actions analizado (22 días) |
| 2026-10-31 | 31 de octubre; desde aquí se miden los 233 commits de datos (179 solo timestamps) |
| 2026-11-08 | HEAD local `5759480`; último commit del trabajo H7 de club |
| 2026-11-10 15:04 UTC | `origin/main` en `75ebe6e` (`data(news): refresh`) |
| 2026-11-10 15:32 UTC | Último run de Actions (`42845450576`) |
| 2026-11-10 17:14 | Capturas de la app (29, modo oscuro) |
| 2026-11-11 08:37 UTC | `actions/permissions` → `enabled: false` |
| 2026-11-11 | Auditoría: fases 0–5, síntesis y este informe |

### Anexo D · Índice de parciales

| Fichero | Contenido | Líneas |
|---|---|---:|
| `parciales/FASE-0-linea-base.md` | Entorno, código, tests, datos, git, Actions | 263 |
| `parciales/FASE-1-datos.md` | Inventario, transferencia, contratos, crecimiento, alternativas, D1-01…D1-15 | 766 |
| `parciales/FASE-2-pipelines.md` | Workflows, medición, cadencias, fiabilidad, PIPE-01…PIPE-16 | 629 |
| `parciales/FASE-3-app.md` | Estructura, datos, rendimiento, dependencias, i18n, F3-01…F3-22 | 1.177 |
| `parciales/FASE-4-diseno.md` | Rúbrica, D-01…D-26, propuestas de patrón | 965 |
| `parciales/FASE-5-calidad.md` | Cobertura, deuda, CI, seguridad, docs, F5-01…F5-16 | 442 |
| `parciales/FASE-4-notas-*.md` | Notas por pantalla (8 ficheros) | 338 |

---

**Fin del informe.** Elaborado el 11 de noviembre de 2026. Solo lectura: `git status` únicamente muestra `docs/auditoria/`.
