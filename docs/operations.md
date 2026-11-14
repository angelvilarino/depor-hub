# Operación del pipeline

> **Actions está deshabilitado (11-nov-2026).** Mientras siga así no hay crons, no se publica `status.json` nuevo y Pages no recibe despliegues. Los comandos de este documento sirven para operar en local; la reactivación se hará al cerrar el Lote 1 de la auditoría, no antes.

## Estado publicado

`health.yml` publica un único fichero cada 30 minutos en la rama `status` (cuando Actions está activo):

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
  `failure`/`timed_out` o su último éxito supera la ventana esperada.
- `files[].ageMinutes` es informativo: un dato viejo puede ser normal si no hubo
  cambios.
- `workflows[]` incluye `lastSuccessAt`, `expectedWithinHours` y `stale`. Cada
  workflow tiene su ventana (Data 36 h, News 6 h, Rivals 8 días, Health 8 h);
  `CI` no caduca porque solo corre con pushes. Rivals ya no queda en `null`
  porque la consulta es por workflow, no una lista global de 50 runs.
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

## Snapshots de partidos

`data-refresh.yml` ejecuta `python -m depor_hub.cli snapshots` después de la
ingesta. Cada partido `FINISHED` o `AWARDED` con marcador final deja un fichero
inmutable en `data/public/v1/snapshots/<season>/<matchId>.json` (ADR 0028). Si un
resultado publicado necesita corrección, se ejecuta manualmente:

```bash
python -m depor_hub.cli snapshots --force
```

El snapshot corregido se revisa y se commitea como cualquier otro dato. No se
borran snapshots automáticamente: son el archivo de la ficha de partido.

## Detalle de partido con BDFutbol

`data-refresh.yml` ejecuta `python -m depor_hub.cli match-details` después de los
snapshots. El comando crea un fichero por partido `FINISHED` o `AWARDED` en
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
  `bdfutbol-alert` marca el run en rojo **después** de publicar fixtures,
  snapshots y club; un día sin partidos pendientes sigue en verde (PIPE-04).
  Tampoco se publica si el marcador de BDFutbol difiere del publicado.
- Corregir un detalle publicado requiere `--force`, revisar el diff y commitear.
- El riesgo legal asumido y sus límites están en
  [`bdfutbol-legal-risk.md`](bdfutbol-legal-risk.md) y
  [`adr/0031-detalle-partido-bdfutbol.md`](adr/0031-detalle-partido-bdfutbol.md).

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
