# ADR 0021 — Ficha del rival e histórico BDFutbol

- **Estado:** aceptado
- **Fecha:** 2026-10-30

## Contexto

La Home resumía entrenador, forma y un balance cifrado; los últimos cruces no se podían inspeccionar con claridad.

## Decisión

La tarjeta cartel abre `/rival/[teamId]`. La ficha presenta equipo, puesto/racha si existen, entrenador, fuente football-data.org, el balance BDFutbol como barra G/E/P con goles, alcance, confianza y enlace a la fuente, y hasta cinco cruces con escudos y marcador. BDFutbol sigue siendo fuente del histórico, no una suposición de cobertura de estadísticas actuales.

## Consecuencias

Los datos de un bloque ausente se ocultan y el resto de la ficha permanece disponible. No se scrapean nombres ni fotos desde páginas nuevas; la tabla manual de correspondencia BDFutbol sigue siendo el enlace entre equipos.
