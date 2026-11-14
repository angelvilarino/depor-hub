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

### Lo que sigue

- **Lote 1:** hash normalizado, cron híbrido, pasos condicionales y un solo
  `publish.yml`; al terminar, reactivar Actions con las instrucciones exactas y
  verificar los 13 documentos en producción.
- **Lote 2:** `squad.json` ligero, WebP de escudos, noticias de portada y
  retratos pequeños.
- **Lote 3 en adelante:** release, offline, rediseño, gallego y cierre.
