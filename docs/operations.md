# Operación del pipeline

> **Actions está deshabilitado (11-nov-2026).** Mientras siga así no hay crons, no se publica `status.json` nuevo y Pages no recibe despliegues. Los comandos de este documento sirven para operar en local; la reactivación se hará al cerrar el Lote 1 de la auditoría, no antes.

## Estado publicado

`health.yml` publica un único fichero cada 4 horas en la rama `status` (cuando Actions está activo):

```text
https://raw.githubusercontent.com/angelvilarino/depor-hub/status/status.json
```

No se sirve desde Pages a propósito: si el deploy falla, el diagnóstico sigue
disponible. Contrato y decisiones en
[`adr/0027-salud-pipeline-status.md`](adr/0027-salud-pipeline-status.md).

Lectura rápida:

```bash
curl -fsS https://raw.githubusercontent.com/angelvilarino/depor-hub/status/status.json | jq .
```

- `ok: false` → algún fichero requerido falta, un workflow terminó en
  `failure`/`timed_out` o su último éxito supera la ventana esperada. Health
  publica primero el estado y después pone su propio run en rojo si `ok=false`
  (PIPE-12); su run no se cuenta en su propio veredicto para no crear un bucle.
- `files[].ageMinutes` es informativo: un dato viejo puede ser normal si no hubo
  cambios.
- `workflows[]` incluye `lastSuccessAt`, `expectedWithinHours` y `stale`. Cada
  workflow tiene su ventana (Data 36 h, News 6 h, Rivals 8 días, Club 10 días,
  Health 8 h); `CI` no caduca porque solo corre con pushes. Rivals ya no queda en
  `null` porque la consulta es por workflow, no una lista global de 50 runs.
- `workflows[].url` enlaza a la ejecución concreta.

## Proxy en directo

`workers/live-proxy` es un Worker de solo lectura que devuelve
`/v1/fixtures.json` con el mismo contrato que la app. El token de
football-data.org es un secreto del Worker, nunca del bundle. Cachea 60 s en el
edge y la app refresca cada 60 s.

```bash
cd workers/live-proxy
npm install
npx wrangler login
npx wrangler secret put FOOTBALL_DATA_TOKEN
npx wrangler deploy
```

Comprobación:

```bash
curl -fsS https://<worker>.workers.dev/v1/fixtures.json | jq '.season, (.matches | length)'
```

Sin `EXPO_PUBLIC_LIVE_BASE_URL` la app no hace peticiones en directo y usa solo
los datos publicados. Si el Worker falla, la app conserva lo estático. Decisiones
en [`adr/0030-proxy-directo-worker.md`](adr/0030-proxy-directo-worker.md).

## Cadencia y publicación

- **Data** despierta con un cron híbrido: `0 * * * *` (base horaria) y
  `*/10 12-23 * * 6,0` (banda densa de sábado y domingo). `--if-due` sigue
  decidiendo: cada 10 minutos dentro de [−30, +150] min del kickoff y cada 55 min
  fuera, de modo que el disparo horario siempre encuentre la pasada vencida.
- **News** cada 30 minutos, **Rivals** una vez al día y **Club** una vez a la
  semana (`0 7 * * 1`). Títulos, rivalidades, ficha e imágenes del club ya no se
  ejecutan en el cron de datos (PIPE-08).
- Data, News, Rivals y Club comparten el grupo de concurrencia `main-write`: solo
  uno escribe `main` a la vez. Todos llaman al workflow reutilizable
  [`publish.yml`](../.github/workflows/publish.yml), que serializa Pages en
  `pages-deploy` y despliega una vez por commit (PIPE-06, PIPE-16).
- `snapshots`, `match-details`, la validación completa y el commit de Data solo
  trabajan cuando `--if-due` hizo una pasada real (`refreshed=true`) o hay cambios
  (`dirty=true`). Un run vacío ya no instala, valida 3,9 MB ni despliega (PIPE-11).

## Reactivar Actions

La reactivación se hace solo al cerrar el Lote 1 y con estos pasos exactos:

```bash
# 1. Comprobar que está deshabilitado y habilitarlo a nivel de repositorio.
gh api repos/angelvilarino/depor-hub/actions/permissions
gh api -X PUT repos/angelvilarino/depor-hub/actions/permissions \
  -f enabled=true -f allowed_actions=all

# 2. Lanzar una pasada manual de cada workflow y esperar a que termine.
gh workflow run data-refresh.yml --ref main -f force=true
gh workflow run news-refresh.yml --ref main
gh workflow run rivals-refresh.yml --ref main
gh workflow run club-refresh.yml --ref main
gh workflow run health.yml --ref main

# 3. Verificar los 13 documentos del contrato (11 raíz + snapshots/detalles).
for f in meta standings fixtures squad season club news rivals social titles rivalries; do
  curl -o /dev/null -w "%{http_code} $f.json\n" \
    "https://angelvilarino.github.io/depor-hub/v1/$f.json"
done
python -m depor_hub.cli smoke --base-url https://angelvilarino.github.io/depor-hub
```

Si `ok=false`, revisar `status.json` antes de volver a lanzar nada: Health deja el
run en rojo a propósito y el diagnóstico ya está publicado en la rama `status`.

## Snapshots de partidos

`data-refresh.yml` ejecuta `python -m depor_hub.cli snapshots` después de la
ingesta, **solo si la ingesta ha hecho una pasada real**. Cada partido `FINISHED` o
`AWARDED` con marcador final deja un fichero inmutable en
`data/public/v1/snapshots/<season>/<matchId>.json` (ADR 0028). Si un resultado
publicado necesita corrección, se ejecuta manualmente:

```bash
python -m depor_hub.cli snapshots --force
```

El snapshot corregido se revisa y se commitea como cualquier otro dato. No se
borran snapshots automáticamente: son el archivo de la ficha de partido.

## Detalle de partido con BDFutbol

`data-refresh.yml` ejecuta `python -m depor_hub.cli match-details` después de los
snapshots, **solo si la ingesta ha hecho una pasada real**. El comando crea un
fichero por partido `FINISHED` o `AWARDED` en
`data/public/v1/match-details/<season>/<matchId>.json` (ADR 0031). Si el fichero
existe, se omite; no se pide de nuevo la ficha a BDFutbol.

```bash
python -m depor_hub.cli match-details            # crea solo los que falten
python -m depor_hub.cli match-details --offline  # repite desde data/raw/enrich/match-details
python -m depor_hub.cli match-details --force    # reescribe todos y revisa el diff
```

- Solo se publican alineaciones, entrenadores, goles, tarjetas y cambios. No hay
  fotos, escudos, textos ni estadísticas, y no se deducen eventos del marcador.
- Si BDFutbol no tiene la ficha o no se puede emparejar el partido, el comando
  imprime una anotación `::error::` y, con `--strict` (lo que usa el workflow),
  termina con código 2. El paso tiene `continue-on-error` y el job
  `bdfutbol-alert` marca el run en rojo **después** de publicar fixtures y
  snapshots; un día sin partidos pendientes sigue en verde (PIPE-04).
  Tampoco se publica si el marcador de BDFutbol difiere del publicado.
- Corregir un detalle publicado requiere `--force`, revisar el diff y commitear.
- El riesgo legal asumido y sus límites están en
  [`bdfutbol-legal-risk.md`](bdfutbol-legal-risk.md) y
  [`adr/0031-detalle-partido-bdfutbol.md`](adr/0031-detalle-partido-bdfutbol.md).

## Club semanal

`club-refresh.yml` se ejecuta los lunes a las 07:00 UTC y también se puede lanzar
a mano. Ordena las dependencias para que `club.json` derive de los documentos
canónicos (D1-09):

```bash
python -m depor_hub.cli club titles --proposal data/raw/titles.proposed.yml
python -m depor_hub.cli club rivalries
python -m depor_hub.cli club
python -m depor_hub.cli club-images
```

- La propuesta de títulos se escribe en `data/raw/titles.proposed.yml`, fuera de
  `main`: el workflow nunca aplica automáticamente un cambio editorial.
- Títulos, rivalidades e imágenes usan `continue-on-error`: un 403/429, un HTML
  cambiado o una descarga fallida dejan el run en rojo al final (`club-alert`)
  pero **no** bloquean la ficha local ni el resto de la publicación (PIPE-07).
- `club` solo lee YAML curado. Se puede ejecutar en local sin red y es la vía para
  aplicar un cambio manual de `club.yml`.

## Disparo manual

No hay cron externo implementado ni se promete uno. GitHub Actions no garantiza
la puntualidad de `schedule`, así que la operación manual es explícita:

```bash
# Local (recomendado mientras Actions esté pausado)
python -m depor_hub.cli ingest --force
python -m depor_hub.cli news
python -m depor_hub.cli rivals
python -m depor_hub.cli club

# Remoto, con un token que ya tengas configurado para gh (no se guarda en el repo)
gh workflow run data-refresh.yml --ref main -f force=true
gh workflow run news-refresh.yml --ref main -f force=true
gh workflow run rivals-refresh.yml --ref main -f force=true
gh workflow run club-refresh.yml --ref main -f force=true
gh workflow run health.yml --ref main
```

`gh workflow run` requiere que Actions esté habilitado. No se guarda ningún
token en el repositorio, en `apps/mobile/.env` ni en la app.

## Diagnóstico manual

```bash
python -m depor_hub.cli status --data data/public/v1 --out /tmp/status.json
python -m depor_hub.cli status --data data/public/v1 --runs-dir /tmp/runs --commit "$(git rev-parse HEAD)"
```

`/tmp/runs` contiene un JSON por workflow, con la respuesta de:

```bash
curl -fsS -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/angelvilarino/depor-hub/actions/workflows/data-refresh.yml/runs?per_page=20&status=completed" \
  -o /tmp/runs/data-refresh.yml.json
```

El comando sale con 1 si el estado es rojo. `--soft` permite inspeccionarlo sin
romper una ejecución. `--now` fija el instante para probar umbrales sin esperar.

## Qué no hace

- No reinicia workflows ni despliega Pages.
- No inventa salud a partir de la edad de los datos.
- No sustituye a la pestaña Actions para ver el historial completo.
