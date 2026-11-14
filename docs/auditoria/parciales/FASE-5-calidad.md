# FASE 5 — Calidad, seguridad y tests

> Auditoría de solo lectura realizada el **2026-11-10**; cifras y referencias revalidadas el **2026-11-11**.
> Entorno: macOS, Node **20.20.2** (por debajo del mínimo declarado `>=22.13`), npm 10.8.2, Python **3.12.15**, pytest 9.1.1, ruff 0.17.2.
> **Caveat de línea base:** el HEAD local auditado es `5759480` (`Training Bot`, 2026-11-08). `main` local está **23 commits por delante y 159 por detrás de `origin/main`** (`75ebe6e`, 2026-11-10). Los 23 commits locales no tienen ninguna ejecución de CI (`gh run list --commit 57594803` → vacío). Las cifras de tests y cobertura de este informe son del árbol local; las de CI y GitHub son de `origin/main`.

Comandos ejecutados (sin escribir en el repo; cobertura en `/tmp`):

| Comando | Resultado | Tiempo |
|---|---|---|
| `ruff check scripts` | ✅ All checks passed | < 1 s |
| `pytest scripts` ×3 | ✅ **230 passed** en las 3 pasadas | 0,66–0,74 s |
| `npm test` (raíz → workspace) ×3 | ✅ **302 tests / 35 suites** en las 3 pasadas | 4,3–9,1 s |
| `npx jest --ci --runInBand` desde `apps/mobile` | ✅ 302 / 35 | 3,99 s |
| `npx jest --ci --runInBand` desde la raíz | ❌ **36 suites fallidas, 0 tests** (ESM sin preset de Jest) | 1,18 s |
| `(cd workers/live-proxy && node --test test/*.test.mjs)` | ✅ **4 tests** | 37 ms |
| `npm run lint` | ✅ exit 0 (solo aviso de Node no soportado) | 1,65 s |
| `npm run typecheck` | ✅ exit 0 | 2,09 s |
| `npm audit --omit=dev` | ⚠️ **3 high, 32 moderate, 1 low** (36) | OK |
| `pip-audit` | ❌ no ejecutable en local (ver §4) | — |

No se observaron fallos intermitentes en tres ejecuciones consecutivas de cada suite. Los tests no hacen red: pytest termina en <1 s y Jest usa `fetch`/módulos mockeados. La reproducibilidad global sí está comprometida por el desfase local y por el acoplamiento a datos publicados (§1.3).

---

## 1. Tests

### 1.1 Batería y cobertura real

Cobertura medida con `coverage`/`pytest-cov` y con Jest `--collectCoverageFrom` sobre **todo** `app/**` y `src/**` (no solo lo importado). Sin ese flag, Jest reporta 86,84 % de líneas porque omite 15 módulos que nunca se cargan; la cifra real es:

| Ámbito | Líneas | Sentencias | Ramas | Funciones |
|---|---:|---:|---:|---:|
| **App móvil (todo `app/` + `src/`)** | **79,98 %** | **77,85 %** | **64,00 %** | **71,07 %** |
| Python (`scripts/depor_hub`) | **79,6 %** | — | — | — |

**App móvil por zona:**

| Zona | Ficheros | Líneas | Sentencias | Ramas | Funciones |
|---|---:|---:|---:|---:|---:|
| `app/(tabs)` | 6 | 79,0 % | 77,9 % | 70,1 % | 73,0 % |
| `app/_layout.tsx` | 1 | **0 %** | 0 % | 0 % | 0 % |
| `app/club` | 2 | 92,0 % | 92,6 % | 70,0 % | 85,7 % |
| `app/match` | 1 | 88,3 % | 87,5 % | 68,8 % | 80,0 % |
| `app/player` | 1 | 95,5 % | 92,9 % | 76,0 % | 92,0 % |
| `app/rival` | 1 | 85,4 % | 80,9 % | 63,6 % | 71,4 % |
| `app/otras` (`coach`, `about`, `settings`) | 3 | 46,8 % | 46,3 % | 40,7 % | 36,0 % |
| `src/` (config, i18n, test-utils) | 3 | 100,0 % | 90,3 % | 77,8 % | 100,0 % |
| `src/components` | 32 | 75,4 % | 74,2 % | 55,4 % | 65,5 % |
| `src/data` | 9 | 79,2 % | 74,3 % | 48,5 % | **28,8 %** |
| `src/features` | 36 | 83,3 % | 80,4 % | 67,8 % | 80,4 % |
| `src/store` | 2 | 65,3 % | 63,0 % | 68,8 % | 55,2 % |
| `src/theme` | 3 | 78,3 % | 76,0 % | **12,5 %** | 66,7 % |
| `src/utils` | 6 | 96,0 % | 96,7 % | 73,5 % | 92,0 % |

**Python por módulo (sentencias):**

| Módulo | Cobertura |
|---|---:|
| `models.py` | 99,2 % |
| `source_models.py` | 100 % |
| `cadence.py` | 97,8 % |
| `rivals.py` / `social.py` | 95,1 % / 92,5 % |
| `publish.py` | 87,7 % |
| `club_extra.py` / `extras.py` | 84,9 % / 84,0 % |
| `transform.py` | 82,5 % |
| `enrich/*` | 77,6 % |
| `news/*` | 80,0 % |
| `club.py` / `crests.py` | 62,4 % / **61,9 %** |
| **`cli.py`** | **58,9 %** |
| `news/http.py` / `news/audit.py` | **29 %** / 58 % |

**Módulos que nunca se cargan en Jest (0 %, 1.049 líneas de fuente):** `app/(tabs)/calendar.tsx` (119), `app/_layout.tsx` (71), `app/about.tsx` (124), `app/settings.tsx` (189), `components/MatchCard.tsx` (82), `components/PlaceholderScreen.tsx` (16), `components/PlayerRow.tsx` (62), `components/news/SocialBlock.tsx` (154), `data/DataProvider.tsx` (39), `data/persister.ts` (20), `data/weather.ts` (44), `features/home/useWeather.ts` (31), `features/reminders/ReminderSync.tsx` (20), `features/reminders/notifications.ts` (66) y `theme/useTheme.ts` (12). Además, ya importados pero casi vacíos: `ReminderSheet.tsx` 3,44 %, `TrainingSection.tsx` 0 %, `RedesSection.tsx` 8,69 %, `HomeSkeleton.tsx` 20 %, `FormChips.tsx` 25 %, `useMatchActions.ts` 47,05 %, `queries.ts` 57,5 % (funciones 4 %).

### 1.2 Calidad de las pruebas

- **No son solo renders.** 25 de las 35 suites son lógica pura (`.ts`): contratos, ICS, recordatorios, noticias, Home, plantilla, club, tiempo, accesibilidad de contraste. Las 10 suites `.tsx` combinan render con interacción (`fireEvent`), navegación y textos. Hay 302 tests, no 302 snapshots.
- **Mocks extensos en pantallas.** `home.test.tsx` mockea `useMeta/useStandings/useFixtures/useNews/useSeason/useRivals`, tema, router, recordatorios, calendario, mapas, `useNow`, `useWeather` y `useCountdown`. Es razonable para aislar la vista, pero deja sin cubrir la integración real de `queries.ts` (funciones 4 %) y de la caché persistida (`DataProvider.tsx`, `persister.ts` al 0 %). `club.test.tsx` acumula 10 mocks equivalentes.
- **Dependencia de datos reales publicados.** `home.test.tsx` lee `data/public/v1/*.json` y afirma valores concretos de la temporada (`2–1`, `Espanyol`, `RCDE Stadium`); `club.test.tsx`, `rival.test.tsx`, `clubLogic.test.ts` y `contracts.test.ts` también leen JSON publicados. Como los commits del bot **no disparan CI** (ADR 0025), un refresco de datos puede romper estos tests sin que nadie lo vea hasta el siguiente PR humano. Es la mayor fuente de fragilidad latente.
- **Python más maduro.** 230 tests en 17 ficheros; HTML/wikitext sintéticos y `httpx.MockTransport` en 4 ficheros; los tests de `enrich` copian datos publicados a `tmp_path`, no escriben en el repo. Los huecos reales son `crests.py` (62 %), `cli.py` (59 %), `news/http.py` (29 %) y `audit.py` (58 %).
- **Cobertura de recordatorios crítica.** `planReminders` está al 100 %, pero la capa que programa/cancela notificaciones (`notifications.ts`) está al 0 % y no tiene test; `ReminderSheet` al 3,4 % y `useMatchActions` al 47 %. Es justo la parte con efectos secundarios en el dispositivo.

### 1.3 Reproducibilidad del comando de tests

`npx jest` **desde la raíz falla** (36 suites, 0 tests, error de ESM) porque el preset `jest-expo` solo está declarado en `apps/mobile/package.json`. Funciona `npm test` desde la raíz (delega al workspace) o `npx jest` dentro de `apps/mobile`. El comando de la Fase 0 (`npx jest --ci --runInBand`) no es reproducible tal cual desde la raíz; conviene documentarlo.

En Python, `pytest scripts` funciona desde la raíz (230 passed, 79,6 % de cobertura); ejecutado dentro de `scripts/` fallan 2 tests (`test_enrich_apply_offline_is_idempotent` y `test_committed_catalog_has_five_active_sources`) porque leen `data/…` con rutas relativas al cwd. El CI ya lo ejecuta desde la raíz (`ci.yml:44`), pero el comando debería quedar documentado con su directorio de trabajo.

---

## 2. Deuda técnica verificada (`docs/ESTADO.md`, «Pendiente técnico»)

| Deuda declarada | Estado real | Evidencia | Impacto | Esfuerzo |
|---|---|---|---|---|
| Serializar `syncReminders` | **CONFIRMADO** | `notifications.ts:41-61` cancela todas y reprograma sin mutex; `ReminderSync.tsx:11-16` dispara en cada cambio de fixtures/ajustes/idioma | Carreras entre dos efectos: avisos duplicados, cancelados o perdidos | S |
| Gallego «162/454» | **CONFIRMADO y desactualizado** | `gl.json`: **212 claves de 713** (29,7 %); faltan 501; 102 valores son idénticos a ES; `i18n/index.ts` cae a ES | Producto: la app se anuncia ES/EN/GL pero GL solo cubre 212/713 claves y 102 repiten el texto ES | L |
| Plegado ICS por octetos | **CONFIRMADO** | `ics.ts:16-22` pliega por caracteres; `SUMMARY:` (8 bytes) + 75 `ñ` (150 bytes) = **158 bytes** (RFC 5545 limita a 75 octetos) | Clientes de calendario estrictos pueden truncar o rechazar el evento | S |
| Permiso de calendario | **NO REPRODUCIDO / por diseño** | `app.json:33-38`: `calendarPermission:false`, `writeOnlyAccess:true`; `system.ts` usa `presentPicker()` y cae a `.ics`; no hay `requestCalendarPermissions` | No hay bug de permisos en código; falta verificarlo en iPhone/Android reales | S |
| `eas.json` | **CONFIRMADO ausente** | No existe `eas.json` ni `extra.eas.projectId` en `app.json` | Bloquea un build de distribución reproducible | S–M |
| `EXPO_PUBLIC_DATA_BASE_URL` de producción | **CONFIRMADO** | `config.ts:21`: sin variable y en producción `DATA_BASE_URL=''`; `fetchData` lanza `not_configured`; no hay `.env.production` ni perfil EAS | Un build de release sin esa variable arranca sin datos | S |
| `status.json` cuando `ok=false` | **CONFIRMADO con causa raíz** | `status.json` del 10-nov 15:32: `ok:false`, `Rivals refresh: conclusion:null`; `health.yml:40` pide `runs?per_page=50`; los últimos 50 runs cubren solo 5 h (10:32–15:32) y Rivals corre 1 vez/día; `cli.py:963-975` y `1015` convierten «sin run en la ventana» en fallo | Falso rojo permanente: el diagnóstico deja de ser fiable y oculta fallos reales | S |
| Worker sin desplegar / `EXPO_PUBLIC_LIVE_BASE_URL` | **CONFIRMADO** | `ESTADO.md:2`; `config.ts:25`; no hay URL en `.env.example` | El directo no está activo; la app degrada a estático | S |
| Cron externo de respaldo | **NO CONFIGURADO (no verificable)** | `operations.md` lo documenta; no hay token ni servicio en el repo | Si Actions se retrasa, no hay respaldo | S (externo) |
| Huecos de datos (3 pesos, 6 escudos históricos, 37 conflictos) | **PARCIALMENTE VERIFICADO** | `squad.json`: peso ausente en Ede Bright, Teun Gijselhart y Jonathan Asp-Jensen; `marketValueEur` 0/28. Los 6 escudos históricos y los 37 conflictos se aceptan de `ESTADO.md`: no se recontaron aquí | Datos honestos, no deuda de código | n/a (requiere fuente) |

**Conclusión de deuda:** de los ocho puntos técnicos de la tabla (los siete de `ESTADO.md` más el Worker), **seis siguen abiertos**, uno está mal documentado (gallego) y uno es diseño intencional pendiente de prueba física (permiso de calendario). Las dos filas restantes no son deuda de código: el cron externo no es verificable desde el repo y los huecos de datos dependen de una fuente fiable. Los dos bloqueantes de release son `eas.json` + URL de producción.

---

## 3. CI

### 3.1 Qué valida y qué no

`.github/workflows/ci.yml` (66 líneas) tiene tres jobs:

| Job | Pasos bloqueantes | Pasos informativos (`continue-on-error`) |
|---|---|---|
| `mobile` | `npm ci`, `npm run lint`, `npm run typecheck`, `npm test -- --ci` | `expo-doctor` (23), `expo install --check` (26), `npm audit --omit=dev --audit-level=high` (29) |
| `python` | `pip install -e "scripts[dev]"`, `ruff check`, `pytest`, `cli validate`, `cli schemas` + `git diff --exit-code` | `pip-audit` (47) |
| `secrets` | `gitleaks-action@v2` | — |

- **Caché:** `setup-node cache:npm` y `setup-python cache:pip` con `cache-dependency-path: scripts/pyproject.toml`. No hay caché de Jest/coverage ni de `data/raw`.
- **Tiempo medido** (run `42221306342`, 2026-11-06): `mobile` 106 s, `python` 23 s, `secrets` 8 s; ~1 min 49 s de pared. La media histórica de la Fase 0 era 0,9 min.
- **No se ejecuta:** tests del Worker (`workers/live-proxy` solo se prueban a mano), Prettier, umbral de cobertura, tipado Python (mypy/pyright), build/export de Expo ni `expo config` de producción.
- **Consecuencia:** los cuatro controles informativos no bloquean. Un `npm audit` con 3 high, un `expo-doctor` roto o un `pip-audit` con CVEs pasan sin bloquear. La validación propia del pipeline de datos (Pydantic + esquemas) sí es razonable para commits que solo tocan `data/`.

### 3.2 Commits del bot y validación propia

ADR 0025 confirma que los commits hechos con `GITHUB_TOKEN` **no disparan CI**. Los workflows de datos validan `cli validate --data data/public/v1` antes del commit y los esquemas se comprueban en CI humana. Para cambios solo de datos es suficiente, pero **no protege los tests acoplados a datos** (§1.2): el bot puede dejar `home.test.tsx` roto durante días.

### 3.3 Desfase local y PRs de Dependabot

- **23 commits locales sin CI.** Incluyen H7.1–H7.4 (`club_extra.py`, títulos, rivalidades, rediseño Club) y no existen en `origin/main` (`git cat-file -e origin/main:scripts/depor_hub/club_extra.py` falla). El CI verde histórico **no cubre el código auditado**.
- **10 fallos de 45 runs** (Fase 0). Los inspeccionados son: `npm ci` roto por el `override` de React (`lock file's react@19.3.1 does not satisfy react@19.3.0`) y `gitleaks` sin `GITHUB_TOKEN` (ya corregido en `ci.yml:64-66`). Hay **10 PRs de Dependabot abiertos**; los de `react`/`expo` siguen fallando por el mismo desajuste de lock.
- **Dependabot solo cubre `npm` y `github-actions`** (`.github/dependabot.yml:1-9`). No cubre `pip`, ni `workers/live-proxy` (que ni siquiera tiene lockfile).

---

## 4. Seguridad y privacidad técnica

| Control | Resultado | Evidencia |
|---|---|---|
| Secretos en árbol | ✅ Sin patrones (`ghp_`, `github_pat_`, `sk-`, `AKIA`, claves PEM) | `rg` sobre el árbol, sin coincidencias |
| Secretos en historial | ✅ Sin valores; `.env` nunca versionado | `git log --all -- .env apps/mobile/.env` vacío; barrido `git grep` en todos los commits sin coincidencias |
| `.env` local | ✅ Ignorado; `.env.example` no contiene valores | `.gitignore:6-8`; `git check-ignore` confirma |
| Escaneo de secretos | ✅ Bloqueante en PR/push | `ci.yml:54-66`, gitleaks v2 con `GITHUB_TOKEN` |
| `npm audit --omit=dev` | ⚠️ **3 high / 32 moderate / 1 low** y no bloqueante | `node-forge@1.4.0` y `zod@3.25.76` vía `@expo/cli@58.1.15`; `zod` directo de la app es 4.6.7 (fuera del rango vulnerable); `fixAvailable:true` |
| `pip-audit` | ❌ No ejecutable en local | Falla en `pip_audit.service.pypi` por `cachecontrol`/`urllib3` (`'HTTPResponse' object has no attribute 'strict'` y error de `pip cache dir`). En CI se instala y se ejecuta, pero es informativo |
| Permisos de workflows | ✅ Bastante mínimos | Datos: `contents:write`; deploy: `contents:read`, `pages:write`, `id-token:write`; Health: `contents:write`, `actions:read`; CI: `contents:read`; Enrich: `contents:read` |
| Acciones fijadas | ⚠️ Por tag mayor, no por SHA | `checkout@v4`, `setup-node@v4`, `setup-python@v5`, `cache@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`, `gitleaks@v2` |
| Dependabot | ⚠️ Parcial | Solo npm raíz + Actions; sin `pip`, sin `workers/live-proxy`; 10 PRs abiertos, varios en rojo |
| Superficie del Worker | ⚠️ Baja | Solo `GET /v1/fixtures.json`; token como secreto; caché 60 s; errores 502/503; **CORS `*`** y sin rate limit por cliente (`index.js:12-15,34-40`) |
| Almacenamiento local | ✅ Sin datos personales | Solo `deporhub-settings`, `deporhub-news-read` y `deporhub-query-cache` (datos públicos). No hay cuentas, tokens ni analítica |
| Notificaciones | ✅ Locales | `expo-notifications` programa avisos con `DATE`; no se pide push token |
| Calendario | ✅ Escritura | `app.json:33-38`: `writeOnlyAccess:true`, `calendarPermission:false`; no se leen calendarios |
| Deep links | ✅ Sin acciones sensibles | Esquema `deporhub`; rutas de solo lectura (`player`, `match`, `club`, `rival`) |
| URLs externas | ⚠️ Esquema no validado en la app | Noticias se sanean a `http(s)` en `news/parse.py:69-75`, pero `openExternal`/`Linking.openURL` aceptan cualquier cadena y los esquemas Zod de URLs son `z.string()` |
| Analítica / cuentas | ✅ No existen | Sin `sentry`, `firebase`, `amplitude`, `posthog`, `segment`, etc.; sin login/password/token en la app |

**Privacidad:** la declaración «sin cuentas ni analítica» se sostiene en el código y en las dependencias. Lo único persistido son preferencias, IDs de noticias leídas y la caché de JSON públicos. El calendario es de solo escritura y las notificaciones son locales.

---

## 5. Documentación y mantenibilidad

| Afirmación documental | Realidad verificada | Evidencia |
|---|---|---|
| `./setup.sh` para la primera vez | **No existe** | `README.md:15`; `ls setup.sh` → no such file |
| Copiar `DEPOR_HUB_CONTEXTO.md` | No existe; `docs/CONTEXTO.md` ya está versionado | `README.md:11`; `ls` falla |
| `img/club` = 15 ficheros / 2,30 MiB | **58 ficheros / 2,5 MB** | recuento de ficheros = 58; `du -sh` = 2,5M; `ESTADO.md:224` ya dice 58 |
| Solo la equipación 2026-27 tiene foto real | Hay **3 fotos verificadas** (1987-88, 1999-00, 2026-27) | `README.md:62` vs `ESTADO.md:244` |
| Jest deduplica React 19.2.3 y 19.3.x | El lock solo tiene **React 19.3.0** | `ESTADO.md:303`; `package-lock.json` y `npm ls react` |
| ADR 0025: News comparte `data-publish`; 3 reintentos | News usa **`news-publish`**; los workflows hacen **5** intentos | `ADR 0025:12` vs `news-refresh.yml:20` y `data-refresh.yml:93` |
| ADR 0016/0017/0018: News en `data-publish` | Superado por ADR 0027 (`news-publish`) sin marca de «superado» | `0016:96`, `0017:99`, `0018:123` |
| Ventana de partido +3 h | El límite vigente es **+150 min** | `sources.md:9,100` vs `ADR 0025:14`; ADR 0015 sí lo matiza en la línea 70 |
| Gallego 162/454 | **212/713**, 501 claves ausentes | `ESTADO.md:308` vs conteo de `gl.json` |
| ADR 0013 inexistente | Correcto: el índice explica que no se asignó | `docs/adr/README.md:3` |
| Node >= 22.13 | Local 20.20.2; no hay `.nvmrc`/`.tool-versions` | `README.md:7`, `node -v` |

**¿Cuánto sabe un mantenedor nuevo?** Sabe qué hace el proyecto, qué datos publica y dónde están los ADR; la arquitectura está bien contada. Pero **el primer comando del README falla** (`setup.sh`), no hay fijación de Node, no hay build de producción (`eas.json`/env) y varias fuentes de verdad se contradicen (imágenes, React, concurrencia, ventana horaria, gallego). Un mantenedor puede arrancar con `npm ci` + `pip install -e "scripts[dev]"` + `npm run mobile`, pero tiene que deducirlo.

---

## 6. Hallazgos

### [F5-01] El HEAD auditado está 23 commits por delante de `origin/main` y nunca ha pasado CI
- **Área:** Calidad
- **Severidad:** Alta
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `git status -sb` → `main...origin/main [ahead 23, behind 159]`; HEAD `5759480`; `gh run list --commit 57594803` → `[]`; `git cat-file -e origin/main:scripts/depor_hub/club_extra.py` → no existe.
- **Qué ocurre:** todo el trabajo H7.1–H7.4 (club ampliado, títulos, rivalidades, rediseño) vive solo en local. CI no lo ha ejecutado nunca en Linux/Node 22.
- **Causa raíz:** rama de trabajo local sin publicar; el repositorio remoto sigue en otra línea con 159 commits de datos.
- **Impacto:** el «CI verde» histórico no valida el código que se audita; regresiones de plataforma (rutas, binarios, Jest en Linux) pueden aparecer al publicar. Los tests locales pasan, pero no hay evidencia de CI.
- **Recomendación:** publicar una rama/PR con los 23 commits, dejar que CI ejecute mobile+python+secrets, rebasar sobre `origin/main` y repetir la medición. No fusionar sin CI.
- **Alternativas:** mantener la rama y ejecutar el CI en un fork; usar un runner local con Node 22.
- **Esfuerzo:** S
- **Riesgo:** conflictos por 159 commits de datos; el rebase puede tocar `data/public` y docs.
- **Dependencias:** acceso de push y decisión de integrar H7.1–H7.4.

### [F5-02] `status.json` está permanentemente en rojo por una ventana de 50 runs
- **Área:** Calidad / Operación
- **Severidad:** Alta
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `status.json` del 2026-11-10T15:32Z: `ok:false`, `workflows: [{Data:success},{News:success},{Rivals:conclusion:null}]`; `health.yml:40` usa `runs?per_page=50`; esos 50 runs cubren 10:32–15:32 y solo incluyen Data/News/Health; `Rivals refresh` corrió con éxito el 10-nov 06:27; `cli.py:963-975` descarta runs con `conclusion:null` y `cli.py:1015` exige que todos sean `success`.
- **Qué ocurre:** el workflow diario de Rivals casi nunca cae dentro de los últimos 50 runs (el pipeline genera >180 runs/día). Se queda sin candidato, `conclusion` es `null` y `ok` pasa a `false` aunque todos los ficheros estén presentes y los workflows recientes hayan ido bien.
- **Causa raíz:** ventana global de 50 runs en vez de una consulta por workflow o una ventana temporal; «sin run» se trata como fallo.
- **Impacto:** el diagnóstico operativo miente de forma sistemática; un `ok:false` real (fichero ausente o workflow caído) queda indistinguible. `health.yml` corre cada 30 min y gasta minutos para publicar un rojo falso.
- **Recomendación:** consultar el último run por workflow (`/actions/workflows/{file}/runs?per_page=1`) o pedir `per_page=200` con corte temporal; representar `conclusion:null` como `unknown` y no como fallo; añadir un test con runs de varias frecuencias.
- **Alternativas:** aumentar `per_page` a 200 mientras se migra; usar la API de cada workflow.
- **Esfuerzo:** S
- **Riesgo:** más llamadas a la API (se puede cachear 5 min) y cambios en el contrato `Status`.
- **Dependencias:** ADR 0027 y el esquema `status.schema.json`.

### [F5-03] 3 vulnerabilidades `high` de npm quedan en verde por `continue-on-error`
- **Área:** Seguridad
- **Severidad:** Alta
- **Tipo de evidencia:** MEDIDO
- **Evidencia:** `npm audit --omit=dev` → `{high:3, moderate:32, low:1, total:36}`. Afectados: `node-forge@1.4.0` y `zod@3.25.76` (vía `@expo/cli@58.1.15`), `@expo/cli`; `fixAvailable:true`. `ci.yml:27-29` ejecuta la auditoría con `continue-on-error:true`.
- **Qué ocurre:** hay avisos altos en la cadena de herramientas de Expo; CI los ignora y nadie los revisa. El `zod` directo de la app (4.6.7) no está en el rango vulnerable, así que no hay exposición directa demostrada en runtime.
- **Causa raíz:** `@expo/cli` arrastra `node-forge` y `zod` 3; la auditoría se marcó informativa para no bloquear el pipeline.
- **Impacto:** deuda de seguridad silenciosa en el toolchain de build; un fallo de `node-forge` afecta a firma/verificación de certificados y podría afectar a artefactos de Expo.
- **Recomendación:** actualizar `expo`/`@expo/cli` a la versión que corrija (`npm audit fix`), volver a auditar y, si quedan avisos aceptados, usar una allowlist explícita en CI en vez de `continue-on-error`.
- **Alternativas:** mantener informativo con un issue de seguimiento y fecha de revisión; aislar el CLI en un workspace de desarrollo.
- **Esfuerzo:** M
- **Riesgo:** actualizar Expo puede romper el mapa de SDK 58; hacerlo en rama y con `expo install --check`.
- **Dependencias:** Dependabot/Expo SDK.

### [F5-04] Sin lockfile de Python y Dependabot no cubre `pip` ni el Worker
- **Área:** Calidad / Seguridad
- **Severidad:** Media
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `scripts/pyproject.toml` usa rangos (`httpx>=0.27,<1`, `pydantic>=2.7,<3`); `ci.yml:41` hace `pip install -e "scripts[dev]"` sin lock; `.github/dependabot.yml:1-9` solo declara `npm` y `github-actions`; `workers/live-proxy` no tiene `package-lock.json` ni está en workspaces.
- **Qué ocurre:** cada ejecución resuelve versiones nuevas; no hay revisión automatizada de dependencias Python ni del Worker; `pip-audit` es informativo.
- **Causa raíz:** el proyecto priorizó pocas dependencias y no adoptó lockfile Python; Dependabot se configuró solo para npm/Actions.
- **Impacto:** builds no reproducibles, cambios silenciosos de dependencias transitivas y superficie de suministro no auditada en el Worker.
- **Recomendación:** generar `uv.lock` (o `requirements.txt` compilado) y usarlo en CI; añadir ecosistemas `pip` y `npm` con `directory: /workers/live-proxy`; hacer `pip-audit` bloqueante o con allowlist.
- **Alternativas:** `pip-tools`; Renovate con soporte pip.
- **Esfuerzo:** M
- **Riesgo:** el lock puede fijar versiones incompatibles con macOS/Linux; validar en CI.
- **Dependencias:** decisión de herramienta (uv/pip-tools).

### [F5-05] Recordatorios sin serialización y sin pruebas de la capa de notificaciones
- **Área:** Calidad
- **Severidad:** Media
- **Tipo de evidencia:** CONFIRMADO + MEDIDO
- **Evidencia:** `notifications.ts:41-61` cancela y reprograma sin bloqueo; `ReminderSync.tsx:11-16` se ejecuta con cada cambio de `fixtures`, `remindersEnabled`, `remindMatches` y `language`; cobertura `notifications.ts` 0 %, `ReminderSheet.tsx` 3,44 %, `useMatchActions.ts` 47,05 %; `plan.ts` 100 %.
- **Qué ocurre:** dos efectos solapados pueden cancelar avisos que el otro acaba de programar, duplicar notificaciones o dejar el estado inconsistente. La lógica pura está bien probada; la integración con `expo-notifications` no.
- **Causa raíz:** `syncReminders` es una función async sin cola/mutex y el efecto no la espera ni la cancela.
- **Impacto:** recordatorios perdidos o duplicados en el dispositivo; bugs difíciles de reproducir y no cubiertos por tests.
- **Recomendación:** encapsular en una cola de promesas (última ejecución gana), cancelar el efecto anterior y añadir tests con un mock de `Notifications` que verifique cancelar/programar, permisos denegados y límite de 64.
- **Alternativas:** debounce del efecto + `useRef` de la promesa en curso.
- **Esfuerzo:** M
- **Riesgo:** tocar el scheduling puede alterar avisos existentes; probar en dispositivo.
- **Dependencias:** `expo-notifications` y `plan.ts`.

### [F5-06] Tests acoplados a datos publicados que el bot cambia sin CI
- **Área:** Calidad
- **Severidad:** Media
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `home.test.tsx:7-15` lee `data/public/v1/*.json` y `:107-115` afirma `2–1`, `Espanyol`, `RCDE Stadium`; `club.test.tsx:9-13` lee `club.json`, `titles.json` y `rivalries.json`; `rival.test.tsx` y `clubLogic.test.ts` también; ADR 0025 confirma que los commits del bot no disparan CI.
- **Qué ocurre:** los tests de pantalla dependen del resultado deportivo y del contenido editorial del momento. Un refresco de datos puede invalidar las aserciones sin que CI lo detecte.
- **Causa raíz:** se usaron los JSON publicados como fixture en vez de datos congelados de test.
- **Impacto:** el siguiente PR humano puede fallar por un cambio del bot; se pierde la señal de regresión real y se fomenta actualizar tests a mano.
- **Recomendación:** mover los casos a `src/test-utils/` o `packages/schemas/examples/` con datos sintéticos estables; dejar un único test de contrato que valide los JSON publicados sin afirmar valores concretos.
- **Alternativas:** congelar una copia `test/fixtures/public` y actualizarla solo a propósito.
- **Esfuerzo:** M
- **Riesgo:** los tests de pantalla pueden necesitar ajustes de textos/estados.
- **Dependencias:** `src/test-utils/matches.ts` ya existe y se puede ampliar.

### [F5-07] Cobertura real del 80 % con huecos en flujos críticos
- **Área:** Calidad
- **Severidad:** Media
- **Tipo de evidencia:** MEDIDO
- **Evidencia:** Jest con `--collectCoverageFrom` sobre todo `app/**` y `src/**`: **79,98 % líneas / 77,85 % sentencias / 64,00 % ramas / 71,07 % funciones**. 15 módulos nunca importados (1.049 líneas): `settings.tsx`, `about.tsx`, `calendar.tsx`, `DataProvider.tsx`, `persister.ts`, `notifications.ts`, `MatchCard.tsx`, etc. Python: **79,6 %**; `cli.py` 58,9 %, `crests.py` 61,9 %, `news/http.py` 29 %, `audit.py` 58 %.
- **Qué ocurre:** la app tiene buena cobertura en lógica de negocio y contratos, pero no en persistencia/caché, ajustes, calendario, notificaciones y algunos parsers/red.
- **Causa raíz:** los tests se centraron en lógica pura y pantallas principales; no hay umbral de cobertura ni job que la vigile.
- **Impacto:** regresiones en caché/offline, ajustes, calendario y recordatorios pueden llegar a producción sin test.
- **Recomendación:** priorizar `persister`/`DataProvider`/`settings`/`notifications`/`calendar` y `news/http`/`crests`; añadir `coverageThreshold` por zona y publicar el informe como artefacto.
- **Alternativas:** empezar con un umbral global del 75 % y subirlo por hitos.
- **Esfuerzo:** M–L
- **Riesgo:** umbral demasiado alto bloquea PRs legítimos; calibrar.
- **Dependencias:** refactor de fixtures (F5-06).

### [F5-08] Documentación contradictoria y primera instrucción de arranque rota
- **Área:** Docs
- **Severidad:** Media
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `README.md:15` invoca `./setup.sh`, que no existe; `README.md:62` dice 15 ficheros/2,30 MiB y solo una foto real, frente a 58 ficheros/2,5 MB y 3 fotos verificadas (`ESTADO.md:224,244`); `ESTADO.md:303` afirma React 19.2.3/19.3.x y el lock solo tiene 19.3.0; `ADR 0025:12` dice que News comparte `data-publish` y 3 reintentos, pero el código usa `news-publish` y 5; `sources.md:9,100` dice +3 h frente a +150 min de `ADR 0025:14`; `ESTADO.md:308` dice gallego 162/454 y son 212/713.
- **Qué ocurre:** las fuentes de verdad se contradicen y algunas instrucciones ya no se pueden ejecutar.
- **Causa raíz:** iteraciones rápidas sin barrido documental; los ADR antiguos no se marcan como superados.
- **Impacto:** un mantenedor nuevo falla en el primer paso y no sabe qué cifra creer; aumenta el coste de incorporación y el riesgo de decisiones equivocadas.
- **Recomendación:** barrido único de README/ESTADO/sources/operations/ADRs; marcar 0016/0017/0018 como «superado por 0025/0027»; corregir 0025 (concurrencia y 5 reintentos); añadir `setup.sh` o quitar la instrucción; actualizar imágenes, React, gallego y ventana.
- **Alternativas:** un `docs/README` con «fuente de verdad» y un checklist de release.
- **Esfuerzo:** S–M
- **Riesgo:** bajo; solo documentación.
- **Dependencias:** cerrar F5-11 para documentar el build real.

### [F5-09] Acciones de GitHub fijadas por tag mayor, no por SHA
- **Área:** Seguridad
- **Severidad:** Media
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `ci.yml` y los cuatro workflows usan `actions/checkout@v4`, `setup-node@v4`, `setup-python@v5`, `cache/restore@v4`, `cache/save@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`, `gitleaks/gitleaks-action@v2`.
- **Qué ocurre:** un tag mayor puede reasignarse a un commit malicioso o roto; no hay revisión por SHA.
- **Causa raíz:** configuración por defecto de Dependabot/plantillas; no hay política de pinning.
- **Impacto:** riesgo de cadena de suministro en workflows con `contents:write`, `pages:write` e `id-token:write`.
- **Recomendación:** fijar SHA completo con comentario de versión y dejar que Dependabot actualice el SHA; opcionalmente `step-security/harden-runner` y `permissions` ya mínimos.
- **Alternativas:** Renovate con `pinDigests: true`.
- **Esfuerzo:** M
- **Riesgo:** más ruido en PRs de Dependabot; automatizar.
- **Dependencias:** Dependabot.

### [F5-10] CI no cubre Worker, Prettier, cobertura, tipos Python ni build
- **Área:** Calidad
- **Severidad:** Media
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `ci.yml` no tiene paso de `workers/live-proxy`; `npx prettier --check .` → **155 ficheros sin formatear** (sin contar `docs/auditoria/`); no hay `coverageThreshold`; no hay mypy/pyright; `expo-doctor`, `expo install --check`, `npm audit` y `pip-audit` son `continue-on-error`.
- **Qué ocurre:** el CI valida lo esencial (lint, tipos TS, tests, esquemas, secretos) pero deja fuera controles que ya existen en el repo (tests del Worker, Prettier) y no vigila la cobertura.
- **Causa raíz:** CI mínimo para no bloquear; Prettier se dejó como tarea aparte (ADR 0025).
- **Impacto:** el Worker puede romperse sin que CI lo note; el estilo deriva (155 ficheros); la cobertura puede bajar sin aviso.
- **Recomendación:** añadir job `worker` (`npm ci && npm test` en `workers/live-proxy`), `prettier --check` con `.prettierignore` para generados (schemas/data), umbral de cobertura y un smoke `expo export` o `expo config`.
- **Alternativas:** ejecutar Prettier solo sobre `apps/mobile/src` y `scripts`; empezar con cobertura informativa y luego bloqueante.
- **Esfuerzo:** M
- **Riesgo:** Prettier sobre 155 ficheros genera un diff grande; hacerlo en un commit aparte.
- **Dependencias:** F5-07.

### [F5-11] No hay configuración de build de producción: `eas.json` ausente y URL de datos vacía
- **Área:** Calidad
- **Severidad:** Alta
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** no existe `eas.json`; `app.json` no tiene `extra.eas.projectId`; `config.ts:21` deja `DATA_BASE_URL=''` en producción si falta `EXPO_PUBLIC_DATA_BASE_URL`; `fetchData` lanza `not_configured` (`api.ts:20-22`); no hay `.env.production`.
- **Qué ocurre:** un build de release sin esa variable arranca sin datos y muestra estados de error; no hay perfil reproducible de EAS (development/preview/production).
- **Causa raíz:** el proyecto se ha probado en desarrollo con `npm run mobile` y datos locales; la distribución (H9) no se ha configurado.
- **Impacto:** bloquea cualquier publicación en tienda o build de QA; el fallo es silencioso hasta abrir la app.
- **Recomendación:** crear `eas.json` con perfiles y variables por entorno, definir `EXPO_PUBLIC_DATA_BASE_URL` en EAS/CI, y añadir una comprobación de build que falle si la URL está vacía en producción.
- **Alternativas:** usar `app.config.ts` con `extra` y validación en tiempo de build.
- **Esfuerzo:** S–M
- **Riesgo:** credenciales/cuenta EAS; decidir URL definitiva (Pages actual).
- **Dependencias:** cuenta EAS y decisión de distribución (H9).

### [F5-12] Tooling de test declarado como dependencia de producción y `override` de React que rompe Dependabot
- **Área:** Calidad
- **Severidad:** Baja
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `package.json:25-32`: `jest`, `jest-expo` y `eslint-config-expo` están en `dependencies`; `overrides.react = "19.3.0"`; el run `41200691672` falla con `lock file's react@19.3.1 does not satisfy react@19.3.0`; `licenses.json` incluye `jest`, `jest-expo` y `eslint-config-expo`.
- **Qué ocurre:** el `npm audit --omit=dev` y la pantalla «Acerca de» tratan herramientas de build/test como parte de la app; el override impide que Dependabot actualice React y genera PRs rojos recurrentes.
- **Causa raíz:** configuración heredada de la plantilla; el override se añadió para deduplicar React y ya no hay dos versiones.
- **Impacto:** ruido de PRs, licencias engañosas y auditoría de producción inflada.
- **Recomendación:** mover esas tres a `devDependencies`, eliminar el override si el lock ya está en 19.3.0 y añadir `ignore` de React en Dependabot o actualizar override+lock a la vez.
- **Alternativas:** mantener el override y configurar Dependabot para no proponer React.
- **Esfuerzo:** S
- **Riesgo:** `npm ci` en CI tras mover deps; verificar lock.
- **Dependencias:** F5-03.

### [F5-13] Worker con CORS abierto y sin límite por cliente
- **Área:** Seguridad
- **Severidad:** Baja
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `workers/live-proxy/src/index.js:12-15` (`Access-Control-Allow-Origin: *`), `:34-36` (solo GET/OPTIONS y una ruta), `:40` (clave de caché sin query), `:67` (caché 60 s). Token en secreto del Worker; errores 502/503.
- **Qué ocurre:** cualquier web puede consumir el proxy; no hay rate limit por IP ni autenticación. La caché de 60 s limita el daño al origen.
- **Causa raíz:** proxy público de solo lectura para datos públicos; se priorizó simplicidad.
- **Impacto:** un tercero podría agotar la cuota de football-data.org si fuerza peticiones fuera de caché; los datos son públicos, no hay fuga.
- **Recomendación:** restringir `Origin` a los orígenes de la app/Pages, añadir rate limit o un token de app de solo lectura, y mantener la caché. Documentar el límite de cuota.
- **Alternativas:** dejar CORS `*` y monitorizar la cuota; el riesgo es bajo.
- **Esfuerzo:** S
- **Riesgo:** romper la app si se restringe mal el origen; probar con `curl`/Expo.
- **Dependencias:** despliegue del Worker.

### [F5-14] URLs externas sin allowlist de esquema en la app
- **Área:** Seguridad
- **Severidad:** Baja
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `openExternal.ts:8-19` prueba `WebBrowser` y luego `Linking.openURL` con cualquier cadena; llamadas en `news.tsx:162`, `HeadlinesBlock.tsx:83`, `MuseoSection`, `EstadioSection`, `RedesSection`, `player/[id].tsx:186,561`; los campos de URL del contrato son `z.string()` (`schemas.ts:26` y siguientes). Noticias sí se sanean a `http(s)` en `news/parse.py:69-75`.
- **Qué ocurre:** los enlaces de noticias están saneados en origen, pero los de club/redes/fotos/jugador llegan de YAML/JSON y se abren sin comprobar el esquema.
- **Causa raíz:** validación de contrato laxa para URLs y helper genérico.
- **Impacto:** un dato corrupto o una fuente comprometida podría lanzar un esquema no web (`intent:`, `tel:`, etc.); no hay ejecución de código demostrada.
- **Recomendación:** validar `http(s)` en los esquemas Zod de URLs y en `openExternal`; centralizar todas las aperturas en el helper.
- **Alternativas:** allowlist por campo (web, maps, mailto, tel).
- **Esfuerzo:** S
- **Riesgo:** romper enlaces legítimos (mapas/mailto); allowlist explícita.
- **Dependencias:** esquemas compartidos y datos manuales.

### [F5-15] `.gitignore` no cubre cachés de Python/cobertura
- **Área:** Calidad
- **Severidad:** Mejora
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `.gitignore:1-18` no incluye `.pytest_cache/`, `.ruff_cache/` ni `.coverage`; `git check-ignore` no encuentra regla del repo para ellos (en esta máquina los oculta un ignore global). `.env` sí está cubierto (`:6-8`) y nunca se versionó.
- **Qué ocurre:** en una máquina sin ignore global, ejecutar pytest/ruff/coverage deja directorios sin seguimiento que pueden colarse en un `git add -A`.
- **Causa raíz:** `.gitignore` mínimo; se confió en la configuración local.
- **Impacto:** ruido y riesgo bajo de commit accidental de artefactos.
- **Recomendación:** añadir `.pytest_cache/`, `.ruff_cache/`, `.coverage`, `coverage/`, `.mypy_cache/` y `.DS_Store` ya está.
- **Alternativas:** `.gitignore` global documentado en README.
- **Esfuerzo:** S
- **Riesgo:** ninguno.
- **Dependencias:** ninguna.

### [F5-16] Node local por debajo del mínimo y sin fijación de versión
- **Área:** Calidad
- **Severidad:** Mejora
- **Tipo de evidencia:** CONFIRMADO
- **Evidencia:** `node -v` → v20.20.2; `package.json:9-11` exige `>=22.13`; `README.md:7`; no hay `.nvmrc`, `.tool-versions` ni `volta`. `expo lint` avisa de versión no soportada pero sale 0.
- **Qué ocurre:** el entorno local no cumple el requisito; los tests pasan igual, pero Metro/Expo pueden comportarse distinto que en CI (Node 22).
- **Causa raíz:** no hay fijación de versión en el repo.
- **Impacto:** diferencias locales/CI y falsos verdes/rojos difíciles de diagnosticar.
- **Recomendación:** añadir `.nvmrc` con `22` y documentar `nvm use`; opcionalmente `engines` ya existe, añadir `volta`.
- **Alternativas:** Docker/Dev Container.
- **Esfuerzo:** S
- **Riesgo:** ninguno.
- **Dependencias:** F5-01 (verificar en CI con Node 22).

---

## 7. Resumen y límites

- **Cobertura real:** 79,98 % de líneas / 77,85 % de sentencias en la app (64,00 % ramas) y 79,6 % en Python. La cifra de Jest sin `collectCoverageFrom` (86,84 %) es engañosa porque excluye 15 módulos, entre ellos ajustes, calendario, persistencia y notificaciones.
- **Tests:** 230 pytest + 302 Jest + 4 Worker, sin fallos ni flaky en 3 pasadas. La calidad es buena en lógica y contratos; floja en efectos secundarios del dispositivo y en integración de caché/consultas.
- **Deuda verificada:** 6 de 8 puntos siguen abiertos; el gallego está desactualizado (212/713, no 162/454); el permiso de calendario es diseño intencional; `eas.json` y la URL de producción son los bloqueantes de release. `status.json` está en rojo por un bug de ventana de runs, no por una caída real.
- **Seguridad:** sin secretos en árbol ni historial; `.env` ignorado; permisos de workflows razonables; 3 vulnerabilidades high de npm no bloqueantes; `pip-audit` no ejecutable en local; Worker con CORS `*`; app sin cuentas, analítica ni datos personales, con URLs externas sin allowlist de esquema.
- **CI:** valida lint/tipos/tests/ruff/esquemas/secretos; deja informativos expo-doctor, expo install check, npm audit y pip-audit; no cubre Worker, Prettier, cobertura, tipos Python ni build. Los commits del bot no disparan CI (por diseño) y los tests acoplados a datos pueden derivar.
- **Límite importante:** el árbol local está 23 commits por delante y 159 por detrás de `origin/main`; el CI histórico no ha visto el código de H7.1–H7.4. Las conclusiones de código aplican al HEAD local; las de CI, a `origin/main`.

### Lista de hallazgos

16 hallazgos: **4 altas**, **7 medias**, **3 bajas** y **2 mejoras**.

| ID | Título | Área | Severidad |
|---|---|---|---|
| F5-01 | HEAD local sin CI (23 commits) | Calidad | Alta |
| F5-02 | `status.json` falso rojo por ventana de 50 runs | Calidad/Operación | Alta |
| F5-03 | 3 vulnerabilidades high npm no bloqueantes | Seguridad | Alta |
| F5-04 | Sin lockfile Python ni Dependabot pip/Worker | Calidad/Seguridad | Media |
| F5-05 | Recordatorios sin serializar y sin tests | Calidad | Media |
| F5-06 | Tests acoplados a datos publicados | Calidad | Media |
| F5-07 | Huecos de cobertura en flujos críticos | Calidad | Media |
| F5-08 | Documentación contradictoria y `setup.sh` inexistente | Docs | Media |
| F5-09 | Actions por tag mayor, no por SHA | Seguridad | Media |
| F5-10 | CI sin Worker/Prettier/cobertura/tipos/build | Calidad | Media |
| F5-11 | Sin `eas.json` ni URL de datos de producción | Calidad | Alta |
| F5-12 | Tooling en `dependencies` y override React | Calidad | Baja |
| F5-13 | Worker con CORS `*` y sin rate limit | Seguridad | Baja |
| F5-14 | URLs externas sin allowlist de esquema | Seguridad | Baja |
| F5-15 | `.gitignore` sin cachés Python/cobertura | Calidad | Mejora |
| F5-16 | Node local < mínimo y sin `.nvmrc` | Calidad | Mejora |
