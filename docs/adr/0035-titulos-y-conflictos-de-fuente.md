# ADR 0035: Procedencia y conflictos en los detalles de títulos

- **Estado:** Aceptado
- **Fecha:** 2026-11-08
- **Contexto:** los detalles de las finales de Copa mezclaban la plantilla completa
  de la temporada con las alineaciones del día de la final. Además, las fuentes
  consultadas discrepan en algunos minutos de gol y la final de 1995 se disputó
  en dos fechas.

## Decisión

- `squad` representa la **plantilla de la temporada campeona**, no solo los
  convocados o titulares de la final. Se publican las 24 fichas de 1994-95 y las
  31 de 2001-02 obtenidas de BDFutbol; la interfaz lo etiqueta explícitamente y
  muestra su procedencia y confianza `single_source`.
- Los entrenadores de las finales se atribuyen a las fichas de partido de
  Wikipedia. Mientras no haya un contraste independiente, su confianza es
  `single_source`. `coachProvenance` y `squadProvenance` son campos aditivos y
  opcionales, con `null` como default para clientes y payloads previos.
- Para la final de 1995, `date` es el día de inicio/suspensión (24 de junio); la
  nota conserva que se reanudó y completó el 27. Los minutos de Manjarín,
  Mijatović y Alfredo se dejan en `null` porque BDFutbol y Wikipedia discrepan.
  Para 2002 también se deja en `null` el minuto de Tristán (38 frente a 37).
- La comparación de finales coteja identidad de goleador y equipo por separado
  de los minutos. Los minutos en conflicto se informan como diferencias; si no
  se han seleccionado en la fuente curada, se conservan como no resueltos. El
  enriquecimiento sigue generando una propuesta y nunca modifica por sí solo
  `titles.yml`.

## Consecuencias

- Pydantic, JSON Schema y Zod se mantienen sincronizados; los campos nuevos
  tienen defaults compatibles y se comprueba la lectura de payloads antiguos.
- La app atribuye entrenador y plantilla por separado, sin presentar una
  plantilla estacional como alineación de la final.
- Los datos disputados no se muestran como hechos precisos. La fecha de 1995
  identifica el comienzo de la final y su nota explica la reanudación.
