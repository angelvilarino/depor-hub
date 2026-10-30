# ADR 0024 — Retirada de escenarios «Qué se juega»

- **Estado:** aceptado
- **Fecha:** 2026-10-30

## Contexto

El bloque sumaba únicamente puntos del Depor y mantenía inmóviles a los demás equipos, de modo que sus rangos podían parecer una predicción de clasificación.

## Decisión

Eliminar el bloque, su cálculo, textos y propiedades del modelo, esquema y datos nuevos. Pydantic ignora únicamente la propiedad retirada al leer cachés H5.2; el objeto Zod de temporada elimina esa clave desconocida durante la lectura. Añadir prueba de migración.

## Consecuencias

La interfaz presenta hechos de temporada y su evolución, no escenarios. Los clientes actuales no muestran el dato y un caché anterior sigue pudiendo cargar.
