# ADR 0025: publicación fiable y compatibilidad de datos

- Estado: aceptada
- Fecha: 2026-10-31

## Contexto

GitHub Pages sustituye el despliegue completo al publicar un artefacto. Los workflows de datos usan `GITHUB_TOKEN`, cuyos commits no disparan CI. Una validación fallida o un artefacto parcial podría dejar la app sin datos. GitHub Actions también puede retrasar o saltarse ejecuciones programadas.

## Decisiones

- Los workflows `Data refresh`, `News refresh` y `Rivals refresh` comparten el grupo `data-publish`, validan los ocho JSON públicos con Pydantic antes del commit y hacen rebase/push con hasta tres intentos.
- Todo despliegue sube el `data/public` completo desde un checkout nuevo de `main`.
- Datos y clasificación se consultan cada 10 minutos. La ingesta refresca cada 10 minutos dentro de [−30 min, +150 min] de un kickoff confirmado/en juego, y cada hora fuera. Una hora redonda en estado `SCHEDULED` no confirma el kickoff y no abre la ventana.
- Noticias se consultan cada 30 minutos. El proceso respeta feeds, `robots.txt`, pausas por dominio y validadores HTTP; un fallo parcial conserva las historias disponibles. Si todas las fuentes fallan o quedan menos de cinco historias, falla sin reemplazar el JSON anterior.
- Rivales se refrescan una vez al día; los fallos de una consulta histórica dejan ese rival sin histórico, sin bloquear a los demás.
- Los contratos Zod permanecen estrictos. CI valida los ocho ficheros publicados y los ocho ejemplos con Zod; Pydantic valida todos los ficheros. Los documentos opcionales inválidos producen estado vacío y registran el error. Los ficheros obligatorios siguen siendo una incompatibilidad de despliegue detectable por CI; sus cambios deben desplegarse junto con la app.
- `publish.py` valida modelos antes de escribir, prepara y valida archivos temporales y reemplaza `meta.json` al final como marcador de publicación.

## Consecuencias

Los commits del bot no disparan CI, así que los workflows de datos deben conservar validación propia. `expo-doctor`, `expo install --check`, `npm audit` y `pip-audit` son informativos; gitleaks bloquea secretos. Prettier se mantiene como tarea aparte para evitar reformatear cientos de archivos en este cambio.
