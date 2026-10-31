# Auditoría técnica de Depor Hub — 31-oct-2026

- **Rama de auditoría:** `audit/2026-10-31`
- **Snapshot de código:** `a5b1ff3` + commit de limpieza `d5ce9bb` (la limpieza no cambia comportamiento)
- **Comparación de producción:** `origin/main` = `0d472f5` (`data: refresh 2026-10-30T22:20Z`)
- **Alcance:** repositorio, datos públicos, GitHub Actions, GitHub Pages, app Expo y scripts Python
- **Modo:** auditoría de solo lectura salvo la fase 10 de limpieza segura
- **Idioma:** español

---

## 0. Resumen ejecutivo

**Las noticias no se actualizan porque la funcionalidad de noticias nunca se desplegó, no porque el pipeline esté roto.**

La implementación de noticias (código Python, workflow `news-refresh.yml`, `news.json`, pestaña de Noticias y home con titulares) existe solo en la rama local. `origin/main` está 34 commits por detrás en producto y sigue mostrando `PlaceholderScreen` en Noticias. GitHub Pages solo publica `meta.json`, `standings.json`, `fixtures.json` y `squad.json`; `news.json`, `season.json`, `rivals.json` y `social.json` devuelven **HTTP 404**. GitHub Actions solo ejecuta workflows programados del branch por defecto, así que un `news-refresh.yml` que no está en `main` no se ejecuta nunca.

El resto de la cadena está sano:

- El cron de datos de producción lleva **179/179 ejecuciones correctas** desde el 24-oct, con mediana de 0,98 h entre ejecuciones y máximo de 2,52 h. No está caído.
- Los datos de producción están razonablemente frescos: `meta.json` con `updatedAt = 2026-10-30T22:20:30Z`; el cron siguió ejecutándose el 31-oct a las 11:19Z sin cambios de contenido.
- Las **5 fuentes de noticias responden** (auditoría online del 31-oct, 0 errores). Riazor.org tenía una pieza nueva a las 11:30Z.
- El pipeline completo, ejecutado online en un directorio temporal, produjo **47 historias, 5 fuentes y 0 errores**. La ejecución offline con la caché local produjo **72 historias** y llegó hasta el 31-oct.
- El `news.json` local está fechado el **30-oct 08:01Z** porque el cron local nunca se ejecuta en GitHub; no es un síntoma de que el pipeline falle.

### Top 10 hallazgos

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| 1 | **P0** | Noticias no desplegadas: código y workflow solo en local; Pages sin `news.json` y app de producción con placeholder | `L-01`, `L-03`, `L-07` |
| 2 | **P1** | La rama local está 34 commits delante y 6 detrás de `origin/main`; además `data/public` local es más antiguo que producción (28-oct vs 30-oct) | `L-01`, `L-07` |
| 3 | **P1** | `news`, `season`, `rivals` y `social` devuelven 404 en Pages; la app los trata como opcionales, así que falla en silencio | `L-02`, `L-18` |
| 4 | **P1** | La publicación escribe los JSON y `meta.json` antes de validarlos; si la validación falla, quedan archivos inválidos publicados | `L-11` |
| 5 | **P1** | Los esquemas Zod son estrictos: cualquier campo aditivo nuevo rompe la app si no se actualiza el espejo Zod a la vez | `L-12` |
| 6 | **P1** | `squad_overrides.yml` solo se aplica con `enrich --apply` manual; el cron de datos no lo lee | `L-08` |
| 7 | **P2** | La caché HTTP de enriquecimiento no tiene TTL y se sirve antes de la red, incluso con datos de 2019 | `L-09` |
| 8 | **P2** | CI no ejecuta `expo-doctor`, `expo install --check`, `npm audit`, cobertura, Prettier ni escaneo de secretos; los commits del bot no disparan CI | `L-16`, `L-17` |
| 9 | **P2** | Dorsal 6 duplicado: Marc Casado y Noé Carrillo, también en producción | `L-25` |
| 10 | **P2** | Gallego incompleto: 162 de 454 claves; 292 caen a español | `L-24` |

**Confianza global del diagnóstico principal: Confirmada.** Se apoya en la diferencia Git, en los 404 de Pages, en la ausencia del workflow en `origin/main`, en la app de producción con placeholder y en la reproducción exitosa del pipeline.

---

## 1. Alcance, método y evidencia

### 1.1 Qué se auditó

- Repositorio Git completo, con comparación entre `HEAD`, `main` local y `origin/main`.
- Workflows de GitHub Actions y ejecuciones reales vía API de GitHub.
- GitHub Pages y sus cabeceras HTTP.
- Scripts Python de ingesta, enriquecimiento, noticias, publicación y esquemas.
- App Expo/React Native: contratos Zod, consultas, recordatorios, calendario, ICS, i18n y assets.
- Dependencias npm/Expo, auditoría de vulnerabilidades y build de export Android.
- Documentación, licencias, artefactos obsoletos y higiene de secretos.

### 1.2 Qué no se hizo

- No se editó `data/public/**`.
- No se ejecutaron `ingest`, `enrich --apply`, `coach --apply` ni ningún workflow de publicación.
- No se hizo push, merge ni reescritura de historia.
- No se tocaron los dos archivos WIP del propietario.
- No se probó en dispositivo físico ni en App Store/Play Store.

### 1.3 Evidencia

Cada hallazgo tiene un archivo reproducible en `docs/audit/evidence/`:

- `L-01.txt` … `L-32.txt`: una hipótesis por archivo.
- `QA.txt`: matriz de tests, lint, tipos, esquemas, cobertura y export.
- `CLEANUP.txt`: limpieza ejecutada, pruebas de no uso y checks posteriores.

Escala de confianza:

| Etiqueta | Significado |
|---|---|
| **Confirmada** | Reproducido con comando, código o dato verificable |
| **Probable** | Evidencia de código fuerte, sin reproducción en dispositivo |
| **Parcial** | Confirmado en una parte y no verificable en otra |
| **Refutada** | La evidencia contradice la hipótesis |

Las peticiones a terceros se hicieron con User-Agent identificable, al menos 1 s por dominio y sin insistir ante 403/429. La auditoría de feeds hizo una sola pasada.

---

## 2. Snapshot auditado

| Elemento | Valor |
|---|---|
| Rama | `audit/2026-10-31` |
| HEAD de producto | `a5b1ff3 feat(mobile): finish H5 cartel and press redesign` |
| Commit de limpieza | `d5ce9bb chore(audit): retirar andamiaje obsoleto…` |
| `origin/main` | `0d472f5 data: refresh 2026-10-30T22:20Z` |
| Divergencia | `origin/main` tiene 6 commits que no están en `HEAD`; `HEAD` tiene 34 commits que no están en `origin/main` (35 tras limpieza) |
| WIP sin commit | `apps/mobile/app/_layout.tsx`, `apps/mobile/src/features/news/logic.ts` |
| Workflows en `origin/main` | `ci.yml`, `data-refresh.yml`, `enrich.yml` |
| Workflows en local | los anteriores + `news-refresh.yml`, `rivals-refresh.yml` |
| Node usado | v22.23.3 |
| Python usado | 3.12.15 en `.venv` |
| App | Expo SDK 58, React Native 0.88.0, React 19.3.0 |
| Datos locales | `meta/fixtures/standings/squad/season` del 28-oct; `news` del 30-oct |
| Datos de producción | `meta` del 30-oct 22:20Z; solo 4 JSON publicados |
| Pages | `meta/standings/fixtures/squad` 200; `news/season/rivals/social` 404 |

**Aviso operativo:** el `data/public` local no es producción. Cualquier despliegue debe partir de `origin/main`, rebasar la rama y regenerar los datos; no se debe publicar el `data/public` local tal cual porque retrocedería `fixtures` y `meta` del 30-oct al 28-oct.

---

## 3. Cronología del incidente

| Fecha/hora (UTC) | Hecho |
|---|---|
| 20–25 oct | Se completa H4 en `origin/main`; Noticias sigue con `PlaceholderScreen`. |
| 25–30 oct | La rama local acumula H5/H6: noticias, historias, rivales, temporada y rediseño. |
| 29 oct 08:27 | Último commit de datos de producción antes del 30-oct. |
| 30 oct 08:01 | Última escritura local de `news.json` (45 historias, máximo 29-oct 08:00Z). |
| 30 oct 22:20 | Último cambio de contenido en producción (`meta.updatedAt`). |
| 31 oct 11:19 | Última ejecución correcta del cron de datos (38 s). |
| 31 oct 11:37 | Auditoría: Pages devuelve 404 para `news.json`; `origin/main` no tiene workflow de noticias. |
| 31 oct 11:44 | Auditoría online: 5/5 feeds OK, 0 errores; pipeline en temporal produce 47 historias. |

La cronología encaja con una única explicación: **el trabajo de noticias se quedó en local**. No hay un corte de scheduler, ni un fallo de fuentes, ni un error de pipeline que explique el 404 de Pages y el placeholder de la app de producción.

---

## 4. Matriz de hipótesis L-01…L-32

| ID | Hipótesis | Veredicto | Evidencia | Confianza |
|---|---|---|---|---|
| L-01 | Pages no publica `news.json` y la app de producción no tiene Noticias reales | Confirmada | `L-01` | Confirmada |
| L-02 | Los datos de producción están congelados o incompletos | Refutada | `L-02` | Confirmada |
| L-03 | El workflow de noticias no existe en el branch por defecto | Confirmada | `L-03` | Confirmada |
| L-04 | El cron de datos está caído | Refutada | `L-04` | Confirmada |
| L-05 | El pipeline de noticias está roto | Refutada | `L-05` | Confirmada |
| L-06 | Las fuentes de noticias están caídas o bloqueadas | Refutada | `L-06` | Confirmada |
| L-07 | El código de noticias nunca se publicó a `main` | Confirmada | `L-07` | Confirmada |
| L-08 | Los overrides manuales no se aplican en el cron | Confirmada | `L-08` | Confirmada |
| L-09 | La caché HTTP de enriquecimiento no caduca | Confirmada | `L-09` | Confirmada |
| L-10 | football-data no usa peticiones condicionales | Confirmada | `L-10` | Confirmada |
| L-11 | La publicación no es atómica y valida tarde | Confirmada | `L-11` | Confirmada |
| L-12 | Zod estricto rechaza campos aditivos | Confirmada | `L-12` | Confirmada |
| L-13 | Hay deriva entre Pydantic, JSON Schema y Zod | Refutada | `L-13` | Confirmada |
| L-14 | La cadencia de refresco es inadecuada | Parcial | `L-14` | Confirmada |
| L-15 | Los workflows no tienen timeout ni robustez suficiente | Confirmada | `L-15` | Confirmada |
| L-16 | Los commits del bot no disparan CI | Confirmada | `L-16` | Confirmada |
| L-17 | CI no cubre validaciones importantes | Confirmada | `L-17` | Confirmada |
| L-18 | La app no tolera JSON opcionales ausentes | Refutada | `L-18` | Confirmada |
| L-19 | `syncReminders` tiene una carrera | Probable | `L-19` | Probable |
| L-20 | El permiso de calendario no se solicita | Probable | `L-20` | Probable |
| L-21 | El deep import de `AndroidImportance` es frágil | Confirmada | `L-21` | Confirmada |
| L-22 | El plegado ICS se hace por caracteres, no octetos | Confirmada | `L-22` | Confirmada |
| L-23 | Los anchos fijos rompen con texto grande | Probable | `L-23` | Probable |
| L-24 | El gallego está incompleto | Confirmada | `L-24` | Confirmada |
| L-25 | Hay dorsales duplicados | Confirmada | `L-25` | Confirmada |
| L-26 | Faltan árbitros en los partidos | Confirmada | `L-26` | Confirmada |
| L-27 | Hay deriva de versiones Expo | Confirmada | `L-27` | Confirmada |
| L-28 | Hay vulnerabilidades npm relevantes | Confirmada | `L-28` | Confirmada |
| L-29 | Iconos e identidad siguen siendo de plantilla | Confirmada | `L-29` | Confirmada |
| L-30 | `ingest` publica aunque fallen validaciones de negocio | Confirmada | `L-30` | Confirmada |
| L-31 | Hay documentación y artefactos obsoletos | Confirmada | `L-31` | Confirmada |
| L-32 | Hay secretos versionados o falta escaneo | Parcial | `L-32` | Confirmada |

---

## 5. Causa raíz y diagnóstico diferencial (L-01…L-07)

### 5.1 Causa raíz

`origin/main` no contiene la implementación de noticias:

- No existe `.github/workflows/news-refresh.yml` en `origin/main`.
- `apps/mobile/app/(tabs)/news.tsx` en `origin/main` es un `PlaceholderScreen`.
- `data/public/v1/news.json` no existe en `origin/main` ni en Pages.
- La rama local sí contiene todo: `scripts/depor_hub/news/**`, `news-refresh.yml`, `news.json`, la pestaña real y la home con titulares.

GitHub Actions ejecuta los `schedule` solo en el branch por defecto. Un workflow que no está en `main` no se ejecuta aunque exista en una rama local. Por eso no hay ninguna ejecución de “News refresh” en la API de Actions.

### 5.2 Por qué el `news.json` local está viejo

El archivo local se escribió el 30-oct a las 08:01Z. Ese archivo lo generó una ejecución manual/local, no un cron de GitHub. Al no existir el workflow en el remoto, no hay ninguna ejecución programada que lo actualice. El pipeline, sin embargo, funciona: una pasada online en directorio temporal produjo 47 historias, 5 fuentes y 0 errores.

### 5.3 Diagnóstico diferencial

| Hipótesis | Resultado | Prueba |
|---|---|---|
| Scheduler caído | Descartada | 179/179 ejecuciones correctas; última 31-oct 11:19Z |
| Fuentes caídas | Descartada | 5/5 feeds OK; Riazor con pieza a las 11:30Z |
| Pipeline roto | Descartada | 47 historias online, 0 errores; 72 historias offline |
| App no lee noticias | Descartada en local | `useOptionalData('news.json')` y tests de Home/Noticias |
| App de producción no tiene noticias | Confirmada | `news.tsx` es placeholder en `origin/main` |
| Datos no publicados | Confirmada | 404 en Pages y ausencia en `origin/main` |
| Código no desplegado | Confirmada | 34 commits locales; workflow ausente en remoto |

### 5.4 Riesgo de despliegue

La rama local no está rebasada: `origin/main` tiene 6 commits de datos que la rama local no tiene. Un push directo o un merge sin rebase puede:

- retroceder `data/public` del 30-oct al 28-oct;
- provocar conflictos en JSON generados;
- publicar datos locales obsoletos junto con el código nuevo.

El orden correcto es: rebasar sobre `origin/main`, resolver los JSON regenerándolos (no a mano), conservar los dos WIP del propietario y solo después abrir PR.

---

## 6. Publicación de datos y contratos (L-08…L-13)

### L-08 — Overrides manuales fuera del cron

`data/manual/squad_overrides.yml` solo se carga en `enrich --apply` (`cli.py`, `--overrides`). El workflow `data-refresh.yml` ejecuta únicamente `python -m depor_hub.cli ingest`. Consecuencia: un cambio manual de contrato, dorsal, foto o cesión no se publica hasta que alguien ejecuta el enriquecimiento a mano. No es la causa de noticias, pero sí una fuente de datos desactualizados.

### L-09 — Caché sin TTL

`PoliteClient._read_cache()` devuelve cualquier archivo existente antes de mirar la red. No hay fecha de caducidad, `max-age` ni validación. Se demostró sirviendo una entrada de 2019 con `offline=True`. En enriquecimiento esto puede reutilizar HTML viejo indefinidamente; el borrado manual de `data/raw/enrich/crests.json` es la única válvula documentada.

### L-10 — Sin peticiones condicionales en football-data

`scripts/depor_hub/client.py` no envía `If-None-Match` ni `If-Modified-Since` y no guarda ETag. Cada ejecución descarga de nuevo todos los recursos. `NewsHttp` sí implementa validadores; la carencia está en el cliente de datos.

### L-11 — Escritura no atómica y validación tardía

`write_if_changed()` escribe todos los archivos con `write_text()` y después valida. `meta.json` se escribe el último, pero antes de la validación. La prueba con un modelo inválido dejó `squad.json` inválido y `meta.json` con el hash nuevo. No hay `tmp` + `rename` ni rollback. Impacto: un error de modelo puede publicar JSON inválido y hacer que los clientes rechacen datos.

### L-12 — Zod estricto

La app usa `z.strictObject` en 33 sitios. Un campo nuevo en el JSON publicado sin actualizar `schemas.ts` produce `Unrecognized key: "extraField"` y la app descarta el documento. No hay `.passthrough()` ni negociación por `schemaVersion`. Es una decisión consciente de contrato, pero eleva el riesgo de despliegues desincronizados.

### L-13 — Sin deriva actual

La regeneración de esquemas en un directorio temporal coincide con `packages/schemas` salvo `examples/`, que no se genera. Los 8 JSON locales validan con Pydantic. No hay deriva en el snapshot; el riesgo es futuro, no actual.

---

## 7. Workflows y CI (L-14…L-17)

### L-14 — Cadencia

- Producción: `data-refresh.yml` cada hora (`17 * * * *`), sin `--if-due`.
- Local: `data-refresh.yml` cada 10 min con `--if-due` (10/60 min).
- Noticias: `news-refresh.yml` cada 6 h en local, inexistente en remoto.
- Rivales: `rivals-refresh.yml` en local, inexistente en remoto.

La cadencia de datos de producción es suficiente y funciona. La cadencia de noticias no existe efectivamente porque el workflow no está desplegado. Veredicto: **Parcial**.

### L-15 — Robustez

`data-refresh.yml` de producción tiene `concurrency` pero **no** `timeout-minutes`. Un fetch colgado puede retener el runner hasta el límite por defecto. El workflow local de noticias sí tiene timeout (15/10 min). No hay `cancel-in-progress`; es correcto para no pisar commits, pero un job lento bloquea al siguiente.

### L-16 — CI invisible para los datos

Los commits `data: refresh` los crea `github-actions[bot]` con el `GITHUB_TOKEN`. Por diseño, esos pushes no disparan workflows. La última ejecución de CI es del 27-oct, mientras que ha habido commits de datos hasta el 31-oct. Los datos publicados no pasan por lint, tests ni validación de esquemas antes de Pages.

### L-17 — Huecos de CI

CI ejecuta lint, typecheck, Jest, ruff, pytest y comparación de esquemas. **No** ejecuta:

- `expo-doctor` ni `expo install --check`;
- `npm audit` ni `pip-audit`;
- cobertura con umbral;
- Prettier;
- validación de `data/public`;
- escaneo de secretos (gitleaks/trufflehog).

Además, hay 10 PRs de Dependabot abiertos y 2 fallos de CI recientes (eslint 10 y React 19.3.1). La última CI verde de `main` es del 25-oct; el 27-oct solo hubo PRs de Dependabot, dos de ellos fallidos.

---

## 8. App móvil (L-18…L-24)

### L-18 — Datos opcionales: bien resuelto

`useOptionalData()` convierte un 404 de `news.json`, `season.json`, `rivals.json` o `social.json` en `null`, no en error global. Hay test de Home sin `season`/`rivals`. La app no se rompe por el 404 de producción; simplemente no muestra noticias. Esto **refuta** que la app sea la causa, pero también explica por qué el fallo es silencioso.

### L-19 — Carrera en recordatorios (Probable)

`ReminderSync` llama a `syncReminders()` en un `useEffect` sin serializar. La función cancela todos los recordatorios y luego reprograma en varios `await`. Dos ejecuciones solapadas pueden cancelar lo que la otra acaba de programar. No se reprodujo en dispositivo; la evidencia es de código.

### L-20 — Permiso de calendario (Probable)

`app.json` declara calendario write-only y `remindersPermission: false`. El código usa `Calendar.presentPicker()` y `addEventWithForm()` sin llamar a `requestCalendarPermissions()` ni `getCalendarPermissions()`. Si iOS exige el permiso write-only antes del editor, el intento falla y se degrada a compartir un `.ics`. No hay rotura, pero la experiencia nativa puede no funcionar.

### L-21 — Deep import de `AndroidImportance`

El símbolo está reexportado públicamente desde `expo-notifications/build/index.d.ts` (`export * from './NotificationChannelManager.types'`), pero el código lo importa de `expo-notifications/build/NotificationChannelManager.types`. Funciona hoy; es deuda menor y puede romper si Expo reorganiza `build/`.

### L-22 — Plegado ICS incorrecto

`foldLine()` pliega a 75 **caracteres**, no a 75 **octetos**. Prueba: `'ñ'.repeat(40)` tiene 40 caracteres y 80 octetos; la función no pliega nada. RFC 5545 exige octetos. Afecta a resúmenes, sedes y descripciones con acentos. Es un fallo real de interoperabilidad, aunque muchos clientes toleran líneas largas.

### L-23 — Anchos fijos y texto grande (Probable)

Hay columnas de 20–84 pt (`dateCol` 84, `listNumber` 32, `listAge` 34, `meetingResult` 22) y miniaturas fijas. El texto display limita `maxFontSizeMultiplier`, pero el texto de cuerpo no tiene layout alternativo. Con tamaño de texto grande puede truncar o solapar. Requiere prueba visual en dispositivo.

### L-24 — Gallego incompleto

ES 454 claves, EN 454, GL 162. Faltan 292 claves: `home` 101, `country` 36, `calendar` 26, `reminder` 23, `coach` 20, `news` 17, `team` 16, `match` 15, `data` 11, `player` 11, `common` 9, `settings` 7. La app cae a español; no rompe, pero GL no está terminado.

---

## 9. Integridad de datos y operación (L-25…L-30)

### L-25 — Dorsal 6 duplicado

Marc Casado y Noé Carrillo comparten el dorsal 6 en local y en `origin/main`. Los 28 jugadores tienen foto, carrera, contrato y procedencia. El duplicado es un dato a corregir con fuente del club; no es un fallo de contrato.

### L-26 — Árbitros incompletos

38 partidos, solo 8 con árbitro. 25 están `SCHEDULED`, 10 `FINISHED` y 3 `TIMED`. La sede está completa. El árbitro es opcional por contrato; la ficha de partido pierde detalle en 30/38.

### L-27 — Deriva de versiones Expo

`expo-doctor`: 19/20 checks, 11 parches atrasados. Ejemplos: `expo` 58.0.19 vs ~58.0.22, `expo-router` 58.0.26 vs ~58.0.29, `react-native` 0.88.0 vs 0.88.1, `react-native-screens` 4.30.0 vs ~4.30.1. Es riesgo bajo-medio de bugs nativos corregidos; no explica el 404.

### L-28 — Vulnerabilidades npm

`npm audit --omit=dev`: 48 vulnerabilidades (1 low, 44 moderate, 3 high, 0 critical). Las high son `@expo/cli`, `node-forge` (1.4.0) y `zod` 3.25.76 interno de `@expo/cli`. La app usa `zod` 4.6.7, fuera del rango afectado. Son dependencias de build/CLI, no del runtime; conviene actualizar Expo.

### L-29 — Identidad de plantilla

`apps/mobile/assets/icon.png` es el arte de plantilla de Expo (letra A azul, fondo `#E6F4FE`), no el monograma DH que describe `docs/ESTADO.md`. `bundleIdentifier` y `package` siguen en `com.deporhub.app`. No hay `eas.json`. Además, sin `EXPO_PUBLIC_DATA_BASE_URL` en el build de producción, `DATA_BASE_URL` queda vacío y la app no puede cargar datos. Es un riesgo de distribución, no del código de noticias.

### L-30 — `ingest` publica con avisos

Si la clasificación no tiene 20 filas o la plantilla queda vacía, `cmd_ingest` imprime `AVISO` por stderr y continúa: escribe `data/public` y devuelve 0. No hay bloqueo ni código de salida distinto. Un fallo de datos puede publicarse como si fuera válido.

---

## 10. Documentación, limpieza y seguridad (L-31…L-32)

### L-31 — Deriva documental

Antes de la limpieza:

- `README.md` pedía copiar `DEPOR_HUB_CONTEXTO.md` (el archivo real es `docs/CONTEXTO.md`) y ejecutar `./setup.sh`.
- `apps/mobile/AGENTS.md` decía que las rutas viven en `src/app/`; viven en `app/`.
- La secuencia de ADR salta de `0012` a `0014`; falta `0013`.
- `template/mobile/**` era un esqueleto anterior, sin uso real.
- Los `egg-info` estaban versionados pese a ser generados por `pip install -e`.

Se corrigieron README y AGENTS.md, se retiró el andamiaje y se añadió `*.egg-info/` al `.gitignore`. No se inventó el ADR 0013.

### L-32 — Secretos

No hay secretos versionados: `.env` y `apps/mobile/.env` están ignorados; `git grep` no encuentra valores. El `.env` local contiene `FOOTBALL_DATA_TOKEN` y una `API_FOOTBALL_KEY` que el código no usa; no se reproducen valores en este informe. No hay gitleaks, trufflehog ni pip-audit instalados, y CI no escanea secretos ni dependencias Python. Veredicto: **Parcial**.

---

## 11. Limpieza segura ejecutada

Commit: `d5ce9bb chore(audit): retirar andamiaje obsoleto y corregir rutas de documentación`.

| Acción | Elemento | Prueba de no uso |
|---|---|---|
| Retirado | `template/mobile/**` (22 archivos, 88 KB) | Solo lo referenciaba `setup.sh` |
| Retirado | `setup.sh` | Bootstrap de un solo uso; `apps/mobile` ya existe |
| Retirado | `scripts/depor_hub_scripts.egg-info/**` (5 archivos) | Metadata generada; ahora ignorada |
| Retirado | `apps/mobile/.claude/settings.json` | Configuración personal, sin efecto en build |
| Conservado | `apps/mobile/LICENSE` | Atribución MIT de Expo citada en `docs/licenses.md` |
| Conservado | `apps/mobile/.gitignore` | Cubre secretos nativos que el `.gitignore` raíz no cubre |
| Conservado | `data/manual/squad_enrich.proposed.yml` | Propuesta generada y documentada; se revisa, no se borra |
| Conservado | `data/raw/**` | Caché local ignorada, no versionada |

Checks posteriores: lint OK, typecheck OK, Jest 238/238, pytest 156/156, ruff OK, esquemas sin diferencias y `expo export` Android OK. No se tocaron los dos WIP del propietario ni `data/public/**`.

---

## 12. QA, límites, preguntas abiertas, olas y seguimiento

### 12.1 QA ejecutada

| Check | Resultado |
|---|---|
| Node | v22.23.3 |
| Python | 3.12.15 |
| Jest `TZ=Europe/Madrid` | 238/238, 28 suites |
| Jest `TZ=UTC` | 238/238, 28 suites |
| Jest `TZ=America/Los_Angeles` | 238/238, 28 suites |
| pytest `TZ=Europe/Madrid` | 156/156 |
| pytest `TZ=UTC` | 156/156 |
| pytest `TZ=America/Los_Angeles` | 156/156 |
| Cobertura Jest | 85,53 % statements; 69,86 % branches; 79,51 % functions; 87,91 % lines |
| ESLint / TypeScript | OK |
| ruff | OK |
| Esquemas Pydantic → JSON Schema | Sin diferencias salvo `examples/` |
| `expo export --platform android` | OK; bundle Hermes 6 MB, export ~11 MB |
| `expo-doctor` | 19/20; 11 parches atrasados |
| `npm audit --omit=dev` | 48 vulnerabilidades (3 high, 0 critical) |
| Prettier | 109 archivos con estilo distinto; no bloquea CI |

### 12.2 No verificable en este entorno

- Arranque en frío < 2,5 s en móvil de gama media.
- Decodificación HEIF y render real de fotos/escudos.
- Notificaciones locales reales en iOS/Android.
- Editor nativo de calendario y permiso write-only en dispositivo.
- Escalado de texto grande y Dynamic Type.
- Build EAS/App Store/Play Store (no hay `eas.json`).
- Comportamiento de Pages tras un despliegue real (no se desplegó).

### 12.3 Preguntas abiertas

1. ¿La rama local es la fuente de verdad para H5/H6 o se va a trocear en PRs?
2. ¿Se rebasa sobre `origin/main` y se regeneran los JSON antes de publicar?
3. ¿Qué dorsal es correcto para Marc Casado y Noé Carrillo?
4. ¿Se completa el gallego o se acepta la caída a español?
5. ¿Se añade permiso de calendario explícito o se documenta el fallback `.ics`?
6. ¿Se adopta `eas.json` y una URL de datos de producción antes de distribuir?
7. ¿Se actualiza Expo a los parches del SDK 58 y se añade auditoría a CI?
8. ¿Se conserva `squad_enrich.proposed.yml` como artefacto revisable? (decisión de esta auditoría: sí)

### 12.4 Olas de trabajo

| Ola | Objetivo | Contenido |
|---|---|---|
| **0 — Desbloqueo** | Publicar noticias con seguridad | Rebase sobre `origin/main`; conservar WIP; regenerar `data/public`; PR; verificar `news-refresh` en Actions; comprobar Pages |
| **1 — Robustez** | Evitar regresiones | Escritura atómica; validación antes de escribir; TTL de caché; timeout en `data-refresh`; validación de datos en CI |
| **2 — Producto** | Cerrar deuda visible | GL completo; ICS por octetos; serializar `syncReminders`; permiso de calendario; iconos/identidad; accesibilidad |
| **3 — Distribución** | Preparar tiendas | `eas.json`; URL de producción; actualización de parches Expo; gitleaks/pip-audit; pruebas en dispositivo |

### 12.5 Seguimiento YAML

```yaml
audit: 2026-10-31
branch: audit/2026-10-31
root_cause: noticias_solo_en_rama_local
items:
  - id: AUD-001
    priority: P0
    status: open
    title: Rebase de H5/H6 sobre origin/main y PR
    evidence: [L-01, L-07]
  - id: AUD-002
    priority: P0
    status: open
    title: Regenerar data/public tras el rebase; no publicar el snapshot local del 28-oct
    evidence: [L-01, L-07]
  - id: AUD-003
    priority: P0
    status: open
    title: Verificar news-refresh en Actions y news.json en Pages tras el merge
    evidence: [L-03, L-07]
  - id: AUD-004
    priority: P1
    status: open
    title: Escritura atómica y validación previa en publish.py
    evidence: [L-11]
  - id: AUD-005
    priority: P1
    status: open
    title: Tolerancia o versionado de campos aditivos en Zod
    evidence: [L-12]
  - id: AUD-006
    priority: P1
    status: open
    title: Aplicar overrides en el cron o documentar el paso manual
    evidence: [L-08]
  - id: AUD-007
    priority: P2
    status: open
    title: TTL y validación de caché en PoliteClient
    evidence: [L-09]
  - id: AUD-008
    priority: P2
    status: open
    title: Timeout y validación de datos en data-refresh
    evidence: [L-15, L-30]
  - id: AUD-009
    priority: P2
    status: open
    title: Ampliar CI con expo-doctor, audit, cobertura y Prettier
    evidence: [L-16, L-17]
  - id: AUD-010
    priority: P2
    status: open
    title: Corregir dorsal 6 con fuente del club
    evidence: [L-25]
  - id: AUD-011
    priority: P3
    status: open
    title: Completar GL y revisar plegado ICS
    evidence: [L-22, L-24]
  - id: AUD-012
    priority: P3
    status: open
    title: Iconos, eas.json y URL de datos de producción
    evidence: [L-29]
```

---

### Cierre

La auditoría confirma un único bloqueo principal —**noticias sin desplegar**— y un conjunto de deudas secundarias que no lo causan pero elevan el riesgo de la próxima publicación. La limpieza ejecutada es conservadora y reversible; no se modificó ningún dato público ni se tocó el trabajo en curso del propietario.
