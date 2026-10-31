# ADR 0020 — Alcance de los datos individuales del rival

- **Estado:** aceptado
- **Fecha:** 2026-10-30

## Contexto

H5 proponía fotos y estadísticas actuales de rivales con API-Football, con fallback a goleadores de football-data.org. No se verificó una fuente gratuita, fiable y suficientemente completa para la temporada 2026/27; las fotos también añaden términos de uso y derechos de imagen.

## Decisión

No llamar a API-Football ni a `/scorers`, no pedir ni publicar `API_FOOTBALL_KEY`, y no mostrar cifras ni fotos individuales de rivales. La app conserva la ficha básica de equipo, entrenador de football-data.org e histórico oficial Depor–rival de BDFutbol. `SHOW_RIVAL_PHOTOS=false` hace explícita la opción apagada. `keyPlayers` permanece vacío en los JSON nuevos y el esquema tolera cachés antiguas.

## Consecuencias

La ficha no inventa o mezcla estadísticas parciales. Las fotos oficiales actuales del Depor ya existentes no se ven afectadas. Si más adelante se valida una fuente apropiada, se revisarán cuota, cobertura, atribución y derechos antes de añadirla.
