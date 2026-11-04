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
