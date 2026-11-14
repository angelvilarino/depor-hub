# Correcciones de la auditoría

Registro de lo corregido, con el ID del informe, la evidencia y el estado. Los
lotes siguen el orden de `INFORME.md` §8. La fuente de verdad de cada hallazgo es
`docs/auditoria/INFORME.md`; aquí solo se anota qué se ha hecho y cómo se
comprueba.

## Lote 0 — Verdad operativa

Estado: **cerrado en local**. La verificación en producción queda pendiente de
reactivar Actions al cerrar el Lote 1 (decisión del propietario: no reactivar
todavía).

| ID | Estado | Qué se ha corregido | Evidencia |
|---|---|---|---|
| D1-01 / F5-01 | Hecho en local; pendiente de producción | `main` rebasado sobre `origin/main` y publicado con push directo. Se añade un smoke test que comprueba los documentos del contrato, los valida con Pydantic y compara `meta.dataHash`. | `scripts/depor_hub/smoke.py`, `scripts/tests/test_smoke.py`, `.github/workflows/smoke.yml`; `python -m depor_hub.cli smoke --data data/public/v1` → `smoke ok: 11 documentos válidos` |
| D1-09 | Hecho | `club.json` deja de mantener listas paralelas: `titles` se deriva de `titles.json` y `rivalries` de `rivalries.json`. `club.yml` queda como respaldo si los documentos no existen. | `scripts/depor_hub/club.py` (`derive_titles`, `derive_rivalries`), `scripts/tests/test_club.py`; `club.json` pasa de 1 a 6 rivalidades y conserva los 9 grupos de títulos |
| PIPE-01 | Decidido y documentado | Actions sigue **deshabilitado** a nivel de repositorio desde el 11-nov-2026. No se reactiva en el Lote 0. README, `docs/ESTADO.md`, `docs/sources.md` y `docs/operations.md` lo dicen de forma explícita y remiten al cierre del Lote 1. | Búsqueda de «Actions» en README y docs; no se ha usado ningún token ni se ha lanzado un workflow real |
| PIPE-04 | Hecho | `match-details` distingue «no había partido pendiente» de «había partido y BDFutbol falló / no lo emparejó / el marcador no coincide». Emite anotaciones `::error::`; con `--strict` sale 2. El workflow usa `continue-on-error` y un job `bdfutbol-alert` deja el run en rojo al final, después de publicar fixtures, snapshots y club. | `scripts/depor_hub/cli.py`, `.github/workflows/data-refresh.yml`, `scripts/tests/test_match_details.py`, `scripts/tests/test_workflows.py`; 403 simulado ⇒ código 2; día sin pendientes ⇒ 0 |
| PIPE-05 / F5-02 | Hecho | `status.json` se calcula por workflow, con `lastSuccessAt`, `expectedWithinHours` y `stale`. `health.yml` pide una ventana por workflow en vez de 50 runs globales; Rivals ya no queda fuera. | `scripts/depor_hub/models.py`, `scripts/depor_hub/cli.py`, `.github/workflows/health.yml`, `scripts/tests/test_status.py`, `scripts/tests/test_workflows.py`; Data 36 h, News 6 h, Rivals 8 días, Health 8 h, CI sin caducidad |
| PIPE-14 | Hecho | Se elimina de `docs/operations.md` el cron externo que nunca se implementó y se sustituye por disparo manual con `gh workflow run` (solo cuando Actions esté activo). | `docs/operations.md` |
| F5-06 | Hecho | El test de la Home usa fixtures JSON congelados en `apps/mobile/src/test-utils/fixtures/home/`; un refresco del bot ya no cambia la jornada publicada ni rompe Jest. | `apps/mobile/src/__tests__/home.test.tsx`; 302 tests verdes |
| F5-08 | Hecho (Lote 0) | README, `docs/ESTADO.md`, `docs/sources.md`, `docs/operations.md` y ADR 0015–0018 y 0025 alineados con la realidad: cadencia efectiva 10/60 min, noticias 30 min, rivales diario, 58 imágenes, GL 212/713, Actions pausado, 11 documentos raíz + snapshots. | Diff documental de este lote; `python -m depor_hub.cli validate` y `smoke` en verde |
| D1-02 | No, va al Lote 1 | `content_hash` sigue ignorando solo `updatedAt`/`dataHash` en la raíz. Se ha comprobado que `f8b…` no cambia con los nuevos campos de `status.json` porque ese fichero no alimenta el hash deportivo. | `scripts/depor_hub/transform.py`; pendiente el hash normalizado a cualquier profundidad en el Lote 1 |
| PIPE-02 / PIPE-11 | No, van al Lote 1 | La cadencia sigue igual a propósito: primero se publica y se observa. El informe lo pide explícitamente («No hacer todavía: cambiar la cadencia»). | `.github/workflows/data-refresh.yml` sin cambios de cron |

### Medición antes / después

| Métrica | Antes | Después |
|---|---:|---:|
| Divergencia `main...origin/main` | `23 159` | `0 0` tras el push |
| Documentos raíz validados | 11 (sin smoke reproducible) | 11 + smoke con `dataHash` |
| Workflows en `status.json` | 3, con ventana global | 5, con ventana y `lastSuccessAt` por workflow |
| Rivalidades en `club.json` | 1 (Celta) | 6 (las de `rivalries.json`) |
| Tests Python | 230 | 241 |
| Tests Jest | 301/302 (1 rojo por datos) | 302/302 |
| Cron externo documentado | Sí, sin implementar | Eliminado; disparo manual explícito |

### Interpretación de los «13 documentos»

El informe cuenta **13 documentos a 200**: los 11 ficheros raíz del contrato
(`meta`, `standings`, `fixtures`, `squad`, `season`, `club`, `news`, `rivals`,
`social`, `titles`, `rivalries`) más los árboles `snapshots/<season>/<id>.json` y
`match-details/<season>/<id>.json`, que no son documentos raíz sino colecciones.
El smoke comprueba los 11 raíz; `validate` comprueba además los 24 ficheros de
snapshot/detalle. La comprobación HTTP de los 13 sigue bloqueada por Actions.

### Comandos de verificación ejecutados

```bash
ruff check scripts
pytest scripts -q                       # 241 passed
python -m depor_hub.cli schemas
python -m depor_hub.cli validate --data data/public/v1
python -m depor_hub.cli smoke --data data/public/v1
npm run lint
npm run typecheck
npm test                                # 302 passed
cd workers/live-proxy && npm test       # 4 passed
```

## Lote 1 — Idempotencia y cadencia

Estado: **cerrado en local**. Actions sigue deshabilitado hasta que el propietario
ejecute las instrucciones de reactivación de `docs/operations.md`; por eso las
métricas de runs y minutos son una estimación de diseño, no una medición de 30
días todavía.

| ID | Estado | Qué se ha corregido | Evidencia |
|---|---|---|---|
| D1-02 / PIPE-03 | Hecho | `content_hash` elimina `updatedAt`, `dataHash`, `capturedAt` y `generatedAt` a cualquier profundidad, no solo en la raíz. Dos ingestas idénticas con timestamps distintos producen el mismo hash y la segunda no escribe. | `scripts/depor_hub/transform.py` (`_canonical`, `_VOLATILE_KEYS`), `scripts/tests/test_depor_hub.py`; test de doble pasada con `write_if_changed` |
| PIPE-02 | Hecho | Data pasa a **una pasada diaria** (`0 6 * * *`) que borra el estado para consultar la red; fuera de ventana, `--if-due` mantiene **55 min**. En días de partido, `data-matchday.yml` revisa cada 2 h y lanza `data-refresh.yml` cada 10 min dentro de [−30, +150] min del kickoff. | `.github/workflows/data-refresh.yml`, `.github/workflows/data-matchday.yml`, `scripts/depor_hub/cadence.py`, `scripts/tests/test_cadence.py`, `scripts/tests/test_workflows.py` |
| PIPE-06 | Hecho | Data, News y Rivals comparten `concurrency.group: main-write`; Pages se serializa en `pages-deploy`. Se mantiene el rebase de 5 intentos como red de seguridad. | Los tres workflows + `.github/workflows/publish.yml`; `scripts/tests/test_workflows.py` |
| PIPE-07 | Hecho | Se detectan degradaciones parciales de BDFutbol: calendario con 0 filas, ficha sin alineaciones ni eventos y balance con partidos pero sin cruces lanzan `SourceError`. Los workflows dejan el run en rojo con anotación sin impedir la publicación del resto. Fixtures HTML actualizados para que un cambio de estructura rompa un test. | `scripts/depor_hub/enrich/bdfutbol.py`, `scripts/depor_hub/rivals.py`, `scripts/tests/test_match_details.py`, `scripts/tests/test_season_rivals.py`, `scripts/tests/test_club_extra.py` |
| PIPE-08 | Hecho | `data-refresh.yml` no ejecuta `club`, `club titles`, `club rivalries` ni `club-images`. El club es **estático**: se elimina `club-refresh.yml` y sus documentos se regeneran a mano cuando cambian los YAML curados. | `.github/workflows/data-refresh.yml`, `docs/operations.md` (Club manual), `scripts/tests/test_workflows.py` |
| PIPE-11 | Hecho | `snapshots` y `match-details` solo corren si `ingest` hizo una pasada real (`refreshed=true`). La validación completa y el commit solo si hay cambios (`dirty=true`). Un run vacío no instala trabajo de datos ni despliega. | `.github/workflows/data-refresh.yml`; `scripts/tests/test_workflows.py` |
| PIPE-12 | Hecho | Health pasa a **una vez al día** (`0 7 * * *`), consulta Data/News/Rivals/Health/CI y **pone el run en rojo** si `status.json` queda en `ok=false`, después de publicarlo. Su propio run no cuenta para `ok`, para no crear un bucle rojo. Umbrales: Data 36 h, News 6 h, Rivals 8 días, Health 30 h; el Club ya no tiene workflow. | `.github/workflows/health.yml`, `scripts/depor_hub/cli.py` (`_STATUS_WORKFLOWS`, `_workflow_ok`), `scripts/tests/test_status.py`, `scripts/tests/test_workflows.py` |
| PIPE-16 | Hecho | Un único `publish.yml` (`workflow_call`) contiene el deploy de Pages. Data, News y Rivals lo llaman solo si su commit cambió algo; se eliminan las copias duplicadas. | `.github/workflows/publish.yml`; los tres workflows ya solo tienen `uses: ./.github/workflows/publish.yml` |

### Medición antes / después

| Métrica | Antes | Después |
|---|---:|---:|
| Triggers de Data al mes | 4.320 (`*/10` todo el día) | ~30/mes de Data + ~210/mes de checkpoints (7/día) + dispatches solo en días de partido |
| Runs de Data que solo comprueban | 1.398/1.672 (84 %) | Los runs vacíos dejan de ejecutar snapshots, match-details, validación completa y deploy |
| Commits que solo mueven timestamps | 179/233 (76,8 %) | 0 por diseño: dos ingestas idénticas no vuelven a escribir |
| Ventana fuera de partido | 60 min | 55 min |
| Grupos de escritura de `main` | `data-publish` + `news-publish` | Un solo `main-write` |
| Workflows que desplegaban Pages | 3 copias | 1 reusable (`publish.yml`) |
| Cadencia de Rivals | Diaria (`17 6 * * *`) | Semanal (`0 22 * * 1`) |
| Cadencia de Health | Cada 4 h (`0 */4 * * *`) | Diaria (`0 7 * * *`) |
| Workflows que mantenían el club | `club-refresh` semanal | Ninguno: publicación manual |
| Workflows de estado | 6 workflows, Health 8 h sin alerta | 5 workflows, Health 30 h, run rojo visible |

La estimación de runs queda por debajo de los criterios del informe (< 2.500
runs/mes y < 1.500 min/mes). La confirmación real exige 30 días con Actions
activo; hasta entonces se marca como **estimación**, no como medición.

### Decisión del propietario (14-nov-2026)

El informe de auditoría proponía un cron híbrido con banda densa de fin de semana.
El propietario decidió **bajar aún más el coste** antes de empezar el Lote 2:

| Pipeline | Antes (Lote 1) | Ahora | Motivo |
|---|---|---|---|
| Data | `0 * * * *` + `*/10 12-23 * * 6,0` | `0 6 * * *` + `data-matchday.yml` en días de partido | Fuera de un partido los datos apenas cambian; en el partido sí importa la inmediatez |
| Rivals | Diario `17 6 * * *` | Lunes `0 22 * * 1` | BDFutbol solo mueve el histórico al terminar la jornada |
| Club | `club-refresh` semanal | Sin workflow | Es estático; se publica a mano cuando cambian los YAML |
| Health | Cada 4 h `0 */4 * * *` | Diario `0 7 * * *` | El diagnóstico no cambia cada 4 h; el run rojo sigue avisando |

El supervisor de partido no recoge datos: solo ejecuta
`gh workflow run data-refresh.yml --ref main` cada 10 minutos dentro de la
ventana, de modo que cada pasada conserva su propio `publish.yml` y el lock
`main-write`. Los checkpoints cada 2 h cubren cualquier kickoff entre ~09:30 y
~23:30 UTC sin mantener un runner toda la noche. Coste estimado: ~30 runs/mes
de Data, ~7 checkpoints/día, dispatches solo en días de partido, ~4 runs/mes de
Rivals y ~30/mes de Health; el club, 0 automáticos.

### Comandos de verificación ejecutados

```bash
ruff check scripts
pytest scripts -q                       # 256 passed
python -m depor_hub.cli schemas
git diff --exit-code packages/schemas   # sin diferencias
python -m depor_hub.cli validate --data data/public/v1
python -m depor_hub.cli smoke --data data/public/v1
npm run lint
npm run typecheck
npm test
cd workers/live-proxy && npm test
```

### Lo que sigue

- **Reactivación pendiente:** ejecutar las instrucciones de
  `docs/operations.md#reactivar-actions` y verificar los 13 documentos en
  producción. Es el único paso que no se puede hacer con Actions pausado.
- **Lote 2:** `squad.json` ligero, WebP de escudos, noticias de portada y
  retratos pequeños.
- **Lote 3 en adelante:** release, offline, rediseño, gallego y cierre.
