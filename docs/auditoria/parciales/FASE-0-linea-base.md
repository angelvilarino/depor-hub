# FASE 0 — Inventario y línea base

> Auditoría de solo lectura. Todos los datos se tomaron el **2026-11-10** sobre `main` limpio (`git status` vacío al inicio).
> Los números marcados **[MEDIDO]** proceden de un comando ejecutado en esta máquina; los **[CONFIRMADO]** de lectura directa de ficheros/API.

## 1. Entorno local

| Herramienta | Versión detectada | Notas |
|---|---|---|
| Node | **v20.20.2** | `package.json` exige `>=22.13`; Expo avisa de versión no soportada **[CONFIRMADO]** |
| npm | 10.8.2 | |
| Python del venv | **3.12.15** | Coincide con `setup-python` de los workflows |
| Python del sistema | 3.9.18 | No usar; el proyecto asume 3.12 |
| ruff | 0.17.2 | |
| pytest | 9.1.1 | |
| gh | 2.102.0 | Autenticado como `angelvilarino` con scopes `gist, read:org, repo, workflow` **[CONFIRMADO]** |
| pnpm / yarn | no instalados | El repo usa npm workspaces |

**Hallazgo de entorno:** el Node local (20.20.2) está por debajo del mínimo declarado (`>=22.13`). `expo lint` lo marca como *outdated and unsupported* pero termina con código 0. Esto puede explicar comportamientos raros de Metro/Expo en local y no está documentado en el README.

## 2. Inventario de código

### 2.1 Líneas por lenguaje (git ls-files) **[MEDIDO]**

| Lenguaje | Líneas | Ficheros |
|---|---:|---:|
| Python | 19.317 | 53 |
| TSX | 11.237 | 74 |
| TypeScript | 6.235 | 67 |
| JavaScript | 201 | 4 |
| Markdown | 3.792 | 43 |
| YAML | 50.538 | 20 |
| JSON | 76.165 | 70 |

> El YAML está dominado por dos ficheros de datos curados: `data/manual/squad_enrich.proposed.yml` (24.164 líneas) y `data/manual/squad_extras.yml` (23.443). Juntos son el **94 %** de todo el YAML del repo.

### 2.2 Python (`scripts/`) **[MEDIDO]**

| Módulo | Líneas |
|---|---:|
| `scripts/depor_hub/enrich/` (11 ficheros) | 5.089 |
| `scripts/depor_hub/news/` (12 ficheros) | 2.447 |
| `scripts/depor_hub/club_extra.py` | 1.624 |
| `scripts/depor_hub/cli.py` | 1.593 |
| `scripts/depor_hub/models.py` | 1.183 |
| `scripts/depor_hub/extras.py` | 769 |
| `scripts/depor_hub/transform.py` | 335 |
| `scripts/depor_hub/club.py` | 333 |
| `scripts/depor_hub/rivals.py` | 140 |
| `scripts/depor_hub/source_models.py` | 122 |
| `scripts/depor_hub/social.py` | 102 |
| `scripts/depor_hub/client.py` | 87 |
| `scripts/depor_hub/publish.py` | 79 |
| `scripts/depor_hub/cadence.py` | 77 |
| **Tests** (`scripts/tests/`, 17 ficheros) | 5.336 |

### 2.3 App móvil **[MEDIDO]**

| Zona | Líneas | Ficheros |
|---|---:|---:|
| `apps/mobile/app/` (rutas) | 3.412 | 15 |
| `apps/mobile/src/components/` | 3.660 | 32 |
| `apps/mobile/src/features/` | 4.001 | 36 |
| `apps/mobile/src/data/` | 1.366 | — |
| `apps/mobile/src/theme/` | 159 | — |
| `apps/mobile/src/store/` | 142 | — |
| `apps/mobile/src/i18n/` | 27 | — |
| **Total `app/` + `src/`** | **17.472** | 126 |

Ficheros más grandes de la app:

| Fichero | Líneas |
|---|---:|
| `apps/mobile/src/data/schemas.ts` | 1.029 |
| `apps/mobile/app/player/[id].tsx` | 743 |
| `apps/mobile/src/features/squad/logic.ts` | 554 |
| `apps/mobile/app/(tabs)/team.tsx` | 478 |
| `apps/mobile/app/(tabs)/news.tsx` | 391 |

## 3. Calidad y tests (ejecutado hoy) **[MEDIDO]**

| Comando | Resultado | Tiempo |
|---|---|---|
| `ruff check scripts` | ✅ All checks passed | < 1 s |
| `pytest scripts -q` | ✅ **230 passed** | **0.82 s** |
| `npm run lint` (Expo) | ✅ exit 0 (solo warning de Node) | ~5 s |
| `npm run typecheck` (`tsc --noEmit`) | ✅ exit 0 | ~8 s |
| `npx jest --ci --runInBand` | ✅ **35 suites / 302 tests** | **9.06 s** |

No hay cobertura generada en esta fase (Fase 5 la intentará). Los tests son rápidos; el coste de ejecutarlos no es una barrera.

## 4. `data/public/v1` — tamaño y composición **[MEDIDO]**

Tamaño total: **3,9 MB** (`du -sh`), de los cuales **2,5 MB son imágenes**.

### 4.1 Ficheros raíz (bytes exactos)

| Fichero | Bytes | % del total JSON raíz |
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

### 4.2 Carpetas

| Carpeta | Ficheros | Tamaño |
|---|---:|---:|
| `snapshots/2026-27` | 11 | 44 KB |
| `match-details/2026-27` | 11 | 132 KB |
| `img/club/escudos` | 14 PNG | **2,3 MB** |
| `img/club/equipaciones` | 44 SVG + 1 JPG | 216 KB |

> El escudo histórico más pesado es `escudos/1910.png` con **289 KB** y 381×512 px. Los 14 PNG suman 2,3 MB: son el 59 % del peso de `data/public/v1`.

### 4.3 Qué pesa dentro de los ficheros grandes **[MEDIDO con jq]**

**`squad.json`** (28 jugadores):

| Campo | Bytes agregados | % del fichero |
|---|---:|---:|
| `deporMatches` | 485.084 | **51 %** |
| `career` | 72.483 | 7,6 % |
| `provenance` | 30.211 | 3,2 % |
| `photos` | 9.871 | 1,0 % |
| `careerTotals` | 2.495 | 0,3 % |
| `social` | 1.588 | 0,2 % |
| resto (nombre, dorsal, físico…) | ~4.100 | 0,4 % |

Un jugador medio lleva 9,1 KB de `deporMatches` (22 partidos) y 2,6 KB de `career` (10 temporadas). **El 59 % de `squad.json` es historial de partidos y carrera que solo se usa en la ficha individual, no en la lista de la plantilla.**

**`news.json`**: `stories` ocupa 88.461 B (82 %); `sources` 1.059 B.
**`club.json`**: `kits` 12.309 B (26 %), `crests` 7.738 B (16 %), `anthems` 6.059 B (13 %).
**`rivals.json`**: `rivals` 24.785 B (59 %).

### 4.4 Cobertura de campos de `squad.json` (verificación de `ESTADO.md`) **[MEDIDO]**

| Campo | Cobertura | ¿Coincide con ESTADO? |
|---|---|---|
| `shirtNumber` (dorsal) | 28/28 | Sí |
| `weightKg` (peso) | 25/28 | Sí |
| `social` no vacío (redes) | 27/28 | Sí |
| `photos` (fotos) | 28/28 | Sí |
| `birthPlace` | 28/28 | — |
| `preferredFoot` | 28/28 | — |
| `heightCm` | 28/28 | — |
| `contractUntil` | 28/28 | — |
| `marketValueEur` | **0/28** | Campo muerto/sin fuente |
| `loanFrom` / `loanTo` | 3/28 / 1/28 | Solo cesiones |

`photos` es un array con un objeto por foto (URL, rol, licencia, autor, crédito, `sourceUrl`), no un booleano.

## 5. Git — tamaño e historial **[MEDIDO]**

| Métrica | Valor |
|---|---|
| Commits en `main` | **420** |
| Commits totales (todas las ramas) | 593 |
| Commits del bot `depor-hub-bot` en `main` | **327 (78 %)** |
| Commits que tocan `data/` | **359 (85 %)** |
| Commits que **no** tocan `data/` | 87 (21 %) |
| `.git` en disco | **26 MB** |
| Objetos sueltos | 3.182 / 23,68 MiB |
| Packs | 8 / **2,14 MiB** |
| Árbol de trabajo versionado (`git ls-files`) | **10 MB** |
| `data/public` versionado | 3,9 MB |
| `apps/mobile` versionado | 2,4 MB |

Distribución mensual de commits en `main`:

| Mes | Commits |
|---|---:|
| 2026-10 | 131 |
| 2026-11 | 289 |

Commits de datos por prefijo: `data: refresh` 177, `data(news)` 146, `data(rivals)` 5 → **328 de 420** son datos puros.

**Top 10 ficheros por líneas añadidas en toda la historia:**

| Fichero | Líneas añadidas |
|---|---:|
| `data/public/v1/squad.json` | 32.031 |
| `package-lock.json` | 29.448 |
| `data/manual/squad_enrich.proposed.yml` | 28.178 |
| `data/manual/squad_extras.yml` | 27.452 |
| `data/public/v1/news.json` | 12.972 |
| `apps/mobile/src/data/licenses.json` | 8.620 |
| `data/public/v1/rivals.json` | 5.836 |
| `packages/schemas/club.schema.json` | 3.651 |
| `data/public/v1/club.json` | 3.029 |
| `scripts/depor_hub/cli.py` | 2.518 |

El historial no es grande hoy (pack de 2,14 MiB), pero está **dominado por datos regenerados**: 4 de los 5 ficheros que más crecen son JSON/YAML de datos.

## 6. GitHub Actions — medición real **[MEDIDO vía `gh api`]**

Historial completo disponible: **2.487 ejecuciones**, del **2026-10-20** al **2026-11-10 15:32 UTC**.

| Workflow | Runs | OK | Fallos | Cancel | Duración media | Minutos totales | Rango |
|---|---:|---:|---:|---:|---:|---:|---|
| Data refresh | **1.672** | 1.663 | **9** | 0 | 0,6 min | **1.040** | 20-oct → 10-nov |
| News refresh | **488** | 482 | **2** | **4** | 0,8 min | 387 | 31-oct → 10-nov |
| Health | **251** | 250 | **1** | 0 | 0,3 min | 80 | 05-nov → 10-nov |
| CI | 45 | 35 | **10** | 0 | 0,9 min | 41 | 20-oct → 06-nov |
| Rivals refresh | 10 | 8 | **2** | 0 | 1,0 min | 10 | 01-nov → 10-nov |
| Dependabot (varios) | ~20 | ~20 | 0 | 0 | ~1 min | ~20 | 20-oct → 05-nov |

- **Data refresh**: 1.672 ejecuciones en 22 días. Del 20 al 30-oct fueron ~24/día; **desde el 31-oct son 134–141/día** (el cron `*/10` funciona). Solo **177 commits** `data: refresh` → **~89 % de las ejecuciones no cambian nada**.
- **News refresh**: 48/día desde el 31-oct; 146 commits de 488 runs → **~70 % sin cambios**.
- **Health**: 48/día desde el 5-nov; el workflow hace `git push --force` a la rama `status` cada 30 min (hay 1 solo commit visible en `origin/status` porque se fuerza).
- **CI**: 10 fallos de 45 (22 %). Los commits del bot no lo disparan (ADR 0025).
- Duración media muy baja (0,3–1,0 min). Ojo: en una ejecución inspeccionada, `pip install -e scripts` tardó 5 s y los pasos de datos <1 s; los tiempos que reporta la API son sintéticos/anómalamente bajos, así que los minutos totales deben tomarse como **cota inferior orientativa**.
- En la ejecución inspeccionada (`Data refresh` del 10-nov 15:32), el paso *Guardar el último refresco* salió **skipped** y aun así se ejecutaron snapshots, match-details, club, club-images, validate y commit: es exactamente el trabajo "vacío" que sospecha el propietario **[CONFIRMADO]**.

### 6.1 Discrepancia importante: las Actions **no** están pausadas

El prompt de auditoría dice que están pausadas, pero la API muestra ejecuciones **hoy a las 15:32 UTC** y los 7 workflows figuran como `state: active`. Las tres programaciones (`*/10`, `*/30`, `17 6 * * *`) siguen produciendo runs. Si el propietario las pausó después de escribir el prompt, el estado no se refleja en la API; si no, **la premisa de la auditoría es falsa y el consumo sigue activo**. Hay que aclararlo antes de la Fase 2 (afecta a la medición de minutos y a la recomendación de cadencia).

## 7. Otras discrepancias prompt ↔ realidad **[CONFIRMADO]**

| Prompt | Realidad hoy |
|---|---|
| `img/club/` 15 ficheros ~2,3 MiB | **58 ficheros**, 2,5 MiB (14 PNG de escudos + 44 SVG + 1 JPG de equipaciones) |
| `squad.json` monolítico | Confirmado: 950 KB, 59 % historial (`deporMatches`+`career`) |
| `data/public` tiene `img/club` | Además hay `snapshots/` y `match-details/` con 11 ficheros cada una |
| Actions pausadas | Activas y ejecutándose (ver 6.1) |
| ADR 0013 no existe | Confirmado: no hay `0013*.md`; el índice lo explica |
| `social.json` ya no se muestra | Generado y validado; sin uso visible (a confirmar en Fase 3) |
| 5 feeds RSS/YouTube | `data/manual/news_feeds.yml` tiene 190 líneas (ver Fase 2) |

## 8. Estructura del repo (resumen)

```
apps/mobile/            Expo SDK 58, RN 0.88, React 19.3, Expo Router, TanStack Query, Zustand, i18next
packages/schemas/       JSON Schema generado desde Pydantic
scripts/depor_hub/      ingesta, enrich, news, club, snapshots, match-details, rivals, status
scripts/tests/          17 ficheros, 230 tests
data/manual/            13 YAML + 3 TXT curados a mano (1,6 MB)
data/public/v1/         JSON publicado + img/ + snapshots/ + match-details/ (3,9 MB)
data/raw/               cachés locales NO versionadas (295 MB en esta máquina)
workers/live-proxy/     Cloudflare Worker sin desplegar
docs/                   33 ADRs + CONTEXTO + ESTADO + sources + operations
.github/workflows/      data-refresh, news-refresh, rivals-refresh, health, enrich, ci
```

## 9. Línea base para los demás subagentes

- **Datos**: `squad.json` = 950 KB y 59 % historial; `img` = 2,5 MB; 11 snapshots y 11 match-details.
- **Pipelines**: 1.672 Data refresh (89 % sin cambios), 488 News, 251 Health, 10 Rivals en 22 días; ~1.558 minutos de runner medidos.
- **App**: 17.472 líneas TS/TSX; 35 suites / 302 tests; typecheck y lint limpios; Node local por debajo del mínimo.
- **Calidad**: ruff/pytest limpios (230 tests en 0,82 s); CI con 22 % de fallos.
- **Git**: 420 commits, 85 % tocan datos, 78 % del bot; pack 2,14 MiB.

---

*Generado por el agente principal. Los subagentes de Fase 1–5 deben partir de estas cifras y no volver a medirlas salvo para contradecirlas con evidencia.*

---

## 10. Corrección posterior (2026-11-11, Fase 2)

Esta línea base se midió **antes** de que se aplicara el ajuste de repositorio que deshabilita Actions. La Fase 2 comprobó después:

- `GET /actions/permissions` → `{"enabled": false}` (2026-11-11 08:37 UTC).
- Último run del historial: `42845450576`, 2026-11-10 15:32:48 UTC.
- Los 7 workflows siguen devolviendo `state: active`: la UI no refleja el ajuste global.

Por tanto, la cifra de «1.672 Data refresh» describe la ventana 2026-10-20 → 2026-11-10 y **no** un sistema en marcha. El análisis de cadencia sigue siendo válido como caracterización del comportamiento cuando Actions estuvo activo. Ver `FASE-2-pipelines.md` §2 y hallazgo PIPE-01.
