# Operación del pipeline

## Estado publicado

`health.yml` publica un único fichero cada 30 minutos en la rama `status`:

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

- `ok: false` → algún fichero requerido falta o la última ejecución completada de
  un workflow terminó en `failure`/`cancelled`.
- `files[].ageMinutes` es informativo: un dato viejo puede ser normal si no hubo
  cambios.
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
  imprime un `AVISO` y termina con código 0: el detalle es opcional y no debe
  bloquear la publicación de fixtures, snapshots o club. Tampoco se publica si
  el marcador de BDFutbol difiere del publicado.
- Corregir un detalle publicado requiere `--force`, revisar el diff y commitear.
- El riesgo legal asumido y sus límites están en
  [`bdfutbol-legal-risk.md`](bdfutbol-legal-risk.md) y
  [`adr/0031-detalle-partido-bdfutbol.md`](adr/0031-detalle-partido-bdfutbol.md).

## Cron externo de respaldo

GitHub Actions no garantiza la puntualidad de `schedule` y, en repositorios con
poca actividad, puede retrasar o saltarse ejecuciones. Una vez creado un token
fine-grained con permiso **Actions: write** sobre este repositorio, configura un
cron externo (cron-job.org, UptimeRobot, etc.) que haga `POST` a:

```text
https://api.github.com/repos/angelvilarino/depor-hub/actions/workflows/data-refresh.yml/dispatches
https://api.github.com/repos/angelvilarino/depor-hub/actions/workflows/news-refresh.yml/dispatches
```

Cabeceras:

```text
Authorization: Bearer <TOKEN>
Accept: application/vnd.github+json
Content-Type: application/json
```

Cuerpo:

```json
{"ref":"main"}
```

No guardes el token en el repositorio, en `apps/mobile/.env` ni en la app. Si el
cron externo se configura en un servicio, guárdalo allí. Sin token, los workflows
siguen funcionando con su `schedule` normal; el respaldo es opcional.

## Diagnóstico manual

```bash
python -m depor_hub.cli status --data data/public/v1 --out /tmp/status.json
python -m depor_hub.cli status --data data/public/v1 --runs runs.json --commit "$(git rev-parse HEAD)"
```

`runs.json` es la respuesta de:

```bash
curl -fsS -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/angelvilarino/depor-hub/actions/runs?per_page=50"
```

El comando sale con 1 si el estado es rojo. `--soft` permite inspeccionarlo sin
romper una ejecución.

## Qué no hace

- No reinicia workflows ni despliega Pages.
- No inventa salud a partir de la edad de los datos.
- No sustituye a la pestaña Actions para ver el historial completo.
