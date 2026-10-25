# ADR 0008 — Enriquecimiento con fuentes libres: carrera, estadísticas y ficha (H4)

- **Estado:** aceptada (25-oct-2026).
- **Alcance:** completar la ficha del jugador con trayectoria, estadísticas por temporada, totales de carrera y partido a partido con el Depor, además de lugar de nacimiento, peso, pie, cesión, redes y valor de mercado estimado.
- **Regla base:** no se inventa ningún dato. Lo desconocido es `null`; los conflictos se muestran y **nunca** se eligen al azar.

## Contexto

football-data.org (plan gratuito) da posición, fecha de nacimiento y nacionalidad, pero no dorsal, contrato, altura, trayectoria ni estadísticas. La ficha H4 solo tenía los datos de la API y un fichero manual vacío. Se necesitaba una vía reproducible y gratuita para completar 28 jugadores sin recurrir a scraping agresivo ni a datos inventados.

## Fuentes y prioridad

| Prioridad | Fuente | Aporta | Motivo |
|---|---|---|---|
| 1 | **BDFutbol** | Trayectoria por club y temporada, totales, partidos con el Depor (minutos, goles, tarjetas, resultado) y dorsal de la temporada actual | Fuente principal; HTML público, `robots.txt` permite `/es/`; respondió 200 en las pruebas |
| 2 | **Wikipedia ES** (plantilla del club) | Dorsal, contrato, procedencia y cesión | Datos de plantilla actualizados; la fecha de nacimiento desambigua |
| 3 | **Wikidata** (API de entidades) | Lugar de nacimiento, altura, pie (`P8006`), dorsal con `P54=Q8760`, redes, contraste de carrera | Datos estructurados y reutilizables; CC0 |
| 4 | **Web oficial** (opcional, `--official-url`) | Contrato, cesión, dorsal | Solo si se configura una URL; nunca se asume |

Descartadas para esta fase:

- **Transfermarkt:** devuelve 202/bloqueo; no se intenta rodear.
- **FBref:** 403 de Cloudflare.
- **LaLiga:** `Crawl-delay: 30`; no se usa como dependencia.

La lista viva, con estado y cobertura, está en `docs/sources.md`.

## Etiqueta HTTP y límites

`depor_hub/enrich/http.py` implementa un cliente único:

- User-Agent identificable: `DeporHubBot/0.1` con el contacto de `CONTACT_EMAIL`.
- Caché en `data/raw/enrich/` (no versionada); `--offline` relee la caché y falla si no existe.
- Al menos 1 s entre peticiones al mismo host (`--interval`).
- Comprobación de `robots.txt` antes de cada GET HTML.
- Ante 403, 429, 202 con captcha o `robots.txt` denegando: `SourceBlocked`, se registra y **no se insiste**. No se saltan muros ni captchas.
- Reintentos solo para errores de red y 5xx, con espera creciente.

## Emparejamiento de identidad

Nunca se empareja solo por nombre:

- **BDFutbol:** se busca por nombre y se exige la misma fecha de nacimiento, también en la ficha. Si hay 0 o más de una coincidencia, no se asigna nada a ese jugador; **no se cae al nombre** si la fecha no coincide.
- **Wikipedia:** se elige por fecha de nacimiento exacta. Si no hay coincidencia, no se usa aunque el nombre sea único.
- **Wikidata:** `wbsearchentities` + entidad; se exige fecha de nacimiento y, si hay varias, descripción de fútbol. Sin coincidencia única, no se usa.

La fecha de nacimiento de football-data.org es la clave. Un homónimo sin fecha coincidente queda fuera aunque su nombre sea idéntico. Dos fichas de Wikipedia con la fecha cambiada (Lucas Noubi y Dani Barcia) se descartaron; su dorsal se recuperó de BDFutbol.

## Modelo de datos (aditivo, sigue en `/v1/`)

Se amplía `Player` sin romper JSON ni cachés anteriores. Pydantic es el origen; los esquemas JSON se regeneran y el espejo Zod usa `default(...)`.

| Campo público | Tipo | Origen |
|---|---|---|
| `shirtNumber` | `int \| null` | BDFutbol (temporada actual) / Wikipedia / Wikidata |
| `contractUntil` | `string \| null` | Wikipedia |
| `heightCm` | `int \| null` | BDFutbol / Wikidata |
| `birthPlace` | `string \| null` | BDFutbol / Wikidata |
| `preferredFoot` | `"left" \| "right" \| "both" \| null` | Wikidata `P8006` |
| `loanFrom` | `string \| null` | Wikipedia / oficial |
| `marketValueEur` | `int \| null` | Manual; la UI lo marca siempre como **estimación** |
| `weightKg` | `int \| null` | BDFutbol |
| `social` | `{x, instagram, tiktok}` (handles, no URLs) | Wikidata |
| `career` | `CareerEntry[]` | BDFutbol (contraste Wikidata) |
| `careerTotals` | `CareerTotals` | BDFutbol |
| `deporMatches` | `PlayerMatch[]` | BDFutbol |
| `provenance` | `Record<campo, Provenance>` | Generador / manual |
| `coach.*` | `birthDate`, `since`, `contractUntil`, `provenance` | Aditivo, opcional |

Detalles:

- `CareerEntry` incluye `club`, `from`, `to` (fechas parciales `AAAA`, `AAAA-MM` o `AAAA-MM-DD`), totales y `seasons[]`. `to = null` significa “sigue en el club”.
- `CareerSeason.season` es `AAAA-AA`; las estadísticas que la fuente no da son `null`.
- `PlayerMatch` guarda `date`, `opponent`, `competition`, `home`, marcador, resultado (`W/D/L`), titularidad, minutos, goles, asistencias y tarjetas. **Las asistencias quedan en `null`** porque BDFutbol no las publica en esa tabla.
- `provenance` usa las claves camelCase del contrato (`shirtNumber`, `careerTotals`, `deporMatches`…) y guarda `source`, `confidence` y `capturedAt`.

## Confianza y conflictos

Orden de confianza: `estimated` < `single_source` < `cross_checked` < `verified`.

- Una sola fuente ⇒ `single_source`.
- Dos fuentes con el mismo valor ⇒ `cross_checked` (los lugares de nacimiento se comparan por contención: “Arnedo” y “Arnedo (La Rioja), España” son compatibles).
- Fuente oficial + coincidencia ⇒ `verified`.
- Valores distintos ⇒ **`conflict`**: no se aplica el campo. Los candidatos quedan en `data/manual/squad_enrich.proposed.yml` para revisión humana.
- `--min-confidence` filtra lo que se escribe; por defecto `single_source`.

El informe incluye cobertura por campo, jugadores sin datos, errores y conflictos. En la ejecución del 25-oct-2026: 28 jugadores, 37 conflictos visibles, 0 errores. Las cifras definitivas (con ficha oficial y fotos) están en el ADR 0009.

## Mezcla y aplicación

- `data/manual/squad_extras.yml` es salida generada. Los datos manuales viven en `data/manual/squad_overrides.yml` (ADR 0009); cada jugador con datos exige `source`.
- Prioridad al aplicar: **dato de la API > overrides manuales > generado**. El manual solo rellena huecos.
- `enrich --apply` llama antes a `reset_enriched()`: borra únicamente los campos de origen enriquecido, no los de la API, para que un cambio en los extras (corregir o borrar un campo) se refleje en el JSON público.
- La segunda aplicación con los mismos datos no cambia el JSON (`changed=false`), lo que garantiza idempotencia.
- El YAML generado pasa a ser la fuente aplicada: si quieres que el generador vuelva a proponer un campo ya escrito, bórralo antes de relanzar. Los conflictos no se escriben nunca en ese YAML.
- Los ficheros antiguos con claves camelCase anidadas se normalizan a snake_case al leer; al escribir se usa siempre snake_case (coherente con `extras.py`).

## Interfaz

- La ficha muestra solo campos presentes y traducidos (ES/EN/GL).
- Trayectoria en orden cronológico, con rango de temporadas y filas por temporada.
- Partidos con el Depor en orden descendente, con marcador, minutos, goles y tarjetas.
- Redes como botones que abren el enlace oficial con `expo-linking`; se guardan handles, no URLs.
- “Fuente/confianza” discreto al pie de cada bloque, solo si hay datos.
- “Datos pendientes” solo con campos realmente ausentes (`shirtNumber`, `contractUntil`, `heightCm`, `birthPlace`, `preferredFoot`, `weightKg`, `career`, `deporMatches`).
- El valor de mercado se muestra siempre con la etiqueta **“Estimación”**.
- Sin fotos de jugadores: se mantiene el avatar generado del ADR 0007.

## Comandos

```bash
# Propuesta sin tocar datos públicos
python -m depor_hub.cli enrich

# Revisar el informe y aplicar solo lo que supere la confianza indicada
python -m depor_hub.cli enrich --min-confidence cross_checked --apply

# Repetir sin red usando la caché
python -m depor_hub.cli enrich --apply --offline

# Plantilla CSV para edición manual
python -m depor_hub.cli enrich --export-template data/manual/squad.csv
python -m depor_hub.cli enrich --import-csv data/manual/squad.csv
```

El workflow `.github/workflows/enrich.yml` es manual (`workflow_dispatch`), ejecuta la propuesta y sube el YAML como artefacto. **No hace commit ni publica nada.**

## Consecuencias

- Cobertura actual (con ficha oficial, fotos y overrides; detalle en ADR 0009 y 0010): dorsal 28/28, contrato 28/28, altura 28/28, peso 25/28, lugar 28/28, pie 28/28, cesión de entrada 3/28, cesión de salida 1/28, carrera 28/28, totales 28/28, partidos 28/28, redes 27/28 y fotos 28/28.
- Los 37 conflictos y los huecos restantes quedan visibles; no se rellenan a mano sin fuente.
- BDFutbol es HTML: un cambio de columnas puede romper el parser. Los tests offline con fixtures permiten detectarlo sin red.
- Wikidata es disperso para jugadores jóvenes; BDFutbol sigue siendo la base.
- El valor de mercado no tiene fuente gratuita fiable: se mantiene manual y marcado como estimación.
- **Fuera de alcance de este ADR:** estadísticas avanzadas (xG), Transfermarkt y cualquier dato sin fuente verificable. Las fotos y la ficha oficial se abordan en el ADR 0009.
