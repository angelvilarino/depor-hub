# ADR 0010 — Cesión de salida (`loanTo`) y redes aportadas manualmente

- **Estado:** aceptada (25-oct-2026).
- **Alcance:** representar que el Depor cede a un jugador a otro club y registrar redes sociales que no publica ninguna fuente automática.
- **Regla base:** no se inventa nada. La cesión se toma de la nota oficial del club y las redes, de los enlaces que aporta una persona; cada dato queda con `source` y `confidence`.

## Contexto

El contrato solo tenía `loanFrom` («cedido por»), que describe a un jugador que llega al Depor cedido por otro club. No había forma de expresar lo contrario: un jugador del Depor cedido a un tercero. Teun Gijselhart fue cedido al Al Ain de Emiratos Árabes para la temporada 2026/27, según la nota oficial del club del 16-sep-2026.

Además, la web oficial, Wikidata y Wikipedia no publican las redes de varios jugadores. El usuario las aportó directamente (Instagram y, en tres casos, X).

## Decisiones

### 1. Campo aditivo `loanTo`

`Player.loanTo` (`string | null`) indica el club de destino cuando el Depor cede al jugador. Es independiente de `loanFrom`:

| Campo | Significado | Ejemplo |
|---|---|---|
| `loanFrom` | El jugador llega cedido al Depor desde otro club | Un jugador cedido por el Atlético |
| `loanTo` | El Depor cede al jugador a otro club | Teun → Al Ain |

Se añade con `default(null)`, se regeneran los esquemas JSON y el espejo Zod lo tolera ausente. Un JSON o una caché anteriores siguen validando.

La ficha muestra «Cedido a» solo cuando el campo tiene valor. La fuente y la confianza salen de `provenance.loanTo`.

### 2. Redes manuales

Las redes aportadas por el usuario se guardan en `data/manual/squad_overrides.yml`, no en `squad_extras.yml` (que es salida generada). Cada jugador lleva:

- `social` con los handles de X, Instagram y TikTok (`null` si no se conoce).
- `source` con los enlaces exactos aportados (sin parámetros de seguimiento).
- `provenance.social` con `confidence: single_source`, porque proceden de una única vía (el usuario).

`apply_extras` mezcla red a red: el valor manual rellena lo que falte y no borra un handle generado que ya exista.

### 3. Privacidad y verificación

- Solo se guardan los enlaces/handles públicos que el usuario proporciona; no se hace scraping de perfiles privados.
- Si en el futuro una fuente oficial publica un handle distinto, el conflicto se revisa a mano. No se cambia en silencio.
- La cesión de Teun se marca `verified` porque la publica el club; las redes, `single_source` porque no tienen contraste independiente.

## Consecuencias

- **Pros:** la ficha refleja la cesión de salida y las redes que faltaban sin mezclar datos generados con manuales.
- **Contras:** `loanTo` es texto libre; no se guarda la fecha de fin ni la opción de compra porque la fuente no las publica de forma estructurada.
- **Mantenimiento:** al añadir otro campo de cesión (por ejemplo, `loanUntil`) hay que tocar Pydantic, regenerar esquemas, actualizar Zod, la ficha y los tests de compatibilidad.

## Cobertura (25-oct-2026)

- Redes: **27/28**. Solo queda Teun Gijselhart, cedido fuera y sin redes públicas aportadas.
- Cesión de salida: **1/28** (Teun → Al Ain).
- El resto de campos mantiene la cobertura del ADR 0009.

## Referencias

- `https://www.rcdeportivo.es/es/noticias/teun-gijselhart-cedido-al-al-ain` — nota oficial de la cesión.
- `data/manual/squad_overrides.yml` — overrides de redes y cesión.
- `docs/adr/0008-enriquecimiento-fuentes-libres.md`, `docs/adr/0009-fotos-y-fuente-oficial.md`.
