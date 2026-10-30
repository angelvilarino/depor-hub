# ADR 0023 — Escudo del club como marca dentro de la interfaz

- **Estado:** aceptado
- **Fecha:** 2026-10-30

## Contexto

La identidad de aficionados necesitaba identificar visualmente al Depor. Usar el escudo como icono de tienda podría sugerir una app oficial o exceder el uso editorial previsto.

## Decisión

`BrandMark` puede cargar el escudo remoto solo en la interfaz, controlado por `SHOW_CLUB_CREST_AS_BRAND=true`. El aviso de proyecto no oficial queda visible en la cabecera. El monograma DH permanece en icono, splash y ficha de tienda. Si falla la URL o se apaga la constante, la interfaz usa DH.

## Consecuencias y riesgo

El escudo es una marca del club y la URL externa puede dejar de funcionar. El responsable asume ese uso editorial dentro de la app; el proyecto no afirma afiliación ni incluye el binario. Para una futura distribución se puede apagar la constante sin cambiar el icono o el splash.
