# ADR 0025: publicación fiable y compatibilidad de datos

- Estado: aceptada
- Fecha: 2026-10-31
- **Revisión (14-nov-2026):** se corrigen las cifras y grupos que ya no coincidían con los workflows. Actions está deshabilitado a nivel de repositorio desde el 11-nov-2026; este ADR describe el comportamiento al reactivarlo.

## Contexto

GitHub Pages sustituye el despliegue completo al publicar un artefacto. Los workflows de datos usan `GITHUB_TOKEN`, cuyos commits no disparan CI. Una validación fallida o un artefacto parcial podría dejar la app sin datos. GitHub Actions también puede retrasar o saltarse ejecuciones programadas.

## Decisiones

- `Data refresh`, `News refresh`, `Rivals refresh` y `Club refresh` comparten el grupo `main-write`: solo uno escribe `main` a la vez (PIPE-06). Todos validan los JSON públicos con Pydantic antes del commit, hacen `git pull --rebase` y reintentan el push **hasta cinco veces**. `titles.json` y `rivalries.json` son opcionales: se validan si existen y su ausencia no bloquea la publicación.
- `match-details` sale con código 2 si había partidos terminados y BDFutbol devolvió 403/429, no emparejó el partido o el marcador no coincide. El paso usa `continue-on-error` y un job `bdfutbol-alert` deja el run en rojo al final, después de publicar fixtures y snapshots (PIPE-04).
- Un único workflow reutilizable, `publish.yml` (`workflow_call`), contiene el despliegue de Pages. Data, News, Rivals y Club lo llaman solo cuando su commit ha cambiado algo; Pages se serializa en `pages-deploy` y hay un deploy por commit (PIPE-16).
- Todo despliegue sube el `data/public` completo desde un checkout nuevo de `main`.
- El cron de datos es **híbrido**: `0 * * * *` (base horaria) y `*/10 12-23 * * 6,0` (sábado y domingo). La ingesta solo llama a la red cada 10 minutos dentro de [−30 min, +150 min] de un kickoff confirmado/en juego, y cada **55 minutos** fuera para que el disparo horario no se salte la pasada. Una hora redonda en estado `SCHEDULED` no confirma el kickoff y no abre la ventana. `snapshots`, `match-details`, `validate` y el commit de Data son condicionales a `refreshed`/`dirty` (PIPE-02, PIPE-11).
- Títulos, rivalidades, ficha e imágenes del club se publican en `club-refresh.yml`, semanal (`0 7 * * 1`), no en el cron de datos (PIPE-08). Un fallo de BDFutbol deja el run en rojo sin bloquear la ficha local ni el resto de la publicación (PIPE-07).
- Noticias se consultan cada 30 minutos. El proceso respeta feeds, `robots.txt`, pausas por dominio y validadores HTTP; un fallo parcial conserva las historias disponibles. Solo falla si **todas** las fuentes fallan; en ese caso no reemplaza el JSON anterior. (El texto original hablaba de «menos de cinco historias», una regla que no existe en el código.)
- Rivales se refrescan una vez al día; los fallos de una consulta histórica dejan ese rival sin histórico, sin bloquear a los demás.
- `status.json` calcula el estado **por workflow** con su propia ventana y `last_success_at`, no con una lista global de 50 runs; `CI` no tiene umbral de frescura porque solo corre con pushes (PIPE-05). Health se ejecuta cada 4 horas, publica primero `ok=false` y después pone su run en rojo; su propio run no cuenta para `ok` para evitar un bucle (PIPE-12).
- Los contratos Zod permanecen estrictos. CI valida los ficheros publicados (11 con los opcionales `titles.json` y `rivalries.json`, más los snapshots de partido) y los ejemplos compartidos con Zod; Pydantic valida todos los ficheros. Los documentos opcionales inválidos producen estado vacío y registran el error. Los ficheros obligatorios siguen siendo una incompatibilidad de despliegue detectable por CI; sus cambios deben desplegarse junto con la app.
- `publish.py` valida modelos antes de escribir, prepara y valida archivos temporales y reemplaza `meta.json` al final como marcador de publicación.

## Consecuencias

Los commits del bot no disparan CI, así que los workflows de datos deben conservar validación propia. `expo-doctor`, `expo install --check`, `npm audit` y `pip-audit` son informativos; gitleaks bloquea secretos. Prettier se mantiene como tarea aparte para evitar reformatear cientos de archivos en este cambio.
