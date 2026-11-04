# ADR 0027 — Salud del pipeline y `status.json` en la rama `status`

- **Estado:** aceptado
- **Fecha:** 2026-11-04
- **Contexto:** H0.2 de la fase 2 (fiabilidad de noticias y datos)

## Problema

Los workflows de datos y noticias publican en `main` y despliegan Pages. Cuando
algo falla, el fallo queda enterrado en la pestaña Actions: la app sigue leyendo
el último `news.json` bueno y no hay una señal externa que distinga «no hay
noticias nuevas» de «el pipeline lleva horas roto». Además, un refresco de datos
lento podía dejar a las noticias esperando en la misma cola de concurrencia.

## Decisión

1. **Contrato `status.json`** (Pydantic → JSON Schema → Zod), separado de los
   datos deportivos. Resume:
   - `updatedAt` y `commit` del diagnóstico;
   - `ok` global;
   - `files`: presencia, `updatedAt`, antigüedad en minutos y detalle de cada
     JSON publicado (noticias, partidos, rivales, etc.);
   - `workflows`: última ejecución **completada** de `data-refresh`,
     `news-refresh` y `rivals-refresh`, con conclusión y enlace.
   La antigüedad se publica como información, **no** como veredicto: un
   `updatedAt` viejo puede significar simplemente que no hubo cambios. El estado
   rojo se basa en ficheros requeridos ausentes y en la última conclusión de cada
   workflow.
2. **Rama `status`**, no Pages. `health.yml` escribe un único `status.json` con
   `git checkout --orphan` y `push --force` a `status`. Se lee en:
   `https://raw.githubusercontent.com/angelvilarino/depor-hub/status/status.json`.
   Así el diagnóstico sigue disponible aunque falle el deploy de Pages.
3. **Concurrencia separada:**
   - `data-publish`: Data y Rivals (comparten `data/public`);
   - `news-publish`: News, para que no espere detrás de un refresco de datos;
   - `pages-deploy`: los tres deploys de Pages se serializan, aunque los commits
     ya se resuelven con `pull --rebase` y reintentos.
4. **Reintentos tolerantes:** cinco intentos con `git rebase --abort` ante un
   conflicto transitorio antes de volver a intentar. Si se agotan, el job falla
   y no se publica un estado falso.
5. **Cron externo de respaldo (manual, una vez):** GitHub Actions puede retrasar
   o saltarse un `schedule`. Se documenta en `docs/operations.md` cómo lanzar
   `workflow_dispatch` desde un cron externo con un token de solo Actions. No se
   guarda ningún token en el repositorio ni en la app.

## Consecuencias

- La app **no** depende de `status.json`; si la rama no existe, no cambia nada.
- `health.yml` necesita `contents: write` (rama `status`) y `actions: read`
  (leer ejecuciones). No despliega Pages.
- `status.json` se reescribe cada 30 min; el histórico no se conserva. Para
  auditar runs se usa GitHub Actions.
- `cmd_status` sale con código 1 cuando el estado es rojo. `health.yml` usa
  `--soft` para publicar también el diagnóstico rojo; así el fallo se ve en el
  JSON y no desaparece por el propio fallo.

## Alternativas descartadas

- **Servir `status.json` desde Pages:** si Pages falla, desaparece justo la señal
  que se quiere vigilar.
- **Deducir salud por la edad de `news.json`:** falso positivo en semanas sin
  noticias y falso negativo si el workflow falla pero el fichero es reciente.
- **Una rama por workflow:** más complejidad de la necesaria para un único
  diagnóstico de lectura.
