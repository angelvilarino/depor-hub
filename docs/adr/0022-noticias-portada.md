# ADR 0022 — Portada de noticias y entidades de evento

- **Estado:** aceptado
- **Fecha:** 2026-10-30

## Contexto

La portada mostraba hasta cinco titulares planos. Tres entradas reales describían Falas Dépor y se publicaban por separado; además, la marca visual de cada medio faltaba.

## Decisión

Mostrar una noticia destacada y cuatro más, con imagen que el feed ya publica o monograma de color estable, fuente y hora relativa localizada. `alsoIn` se despliega con enlaces a las otras versiones. `iconUrl` es opcional y solo se rellenará con una URL verificada; no se rastrean páginas ni se copian iconos.

El agrupador de 48 horas puede unir una entidad de evento compartida en título/extracto cuando ambas entradas tienen contexto explícito de evento. Los tests conservan los tres titulares y extractos reales de Falas Dépor y el caso de Alberto Molina: el apellido/homonimia no da relevancia por sí solo. El representante sigue la prioridad curada de las fuentes.

## Consecuencias

La Home reduce duplicados, conserva los medios alternativos y respeta los límites del feed. La regla de evento se mantiene acotada por fecha y contexto para evitar fusionar piezas de personas o equipos homónimos.
