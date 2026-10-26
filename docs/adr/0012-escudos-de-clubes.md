# ADR 0012 — Escudos de clubes en carrera y partidos

- **Estado:** aceptada (26-oct-2026).
- **Alcance:** resolver el escudo de los clubes que aparecen en la trayectoria (`CareerEntry`) y en los partidos con el Depor (`PlayerMatch`), sin guardar binarios y sin inventar URLs.
- **Regla base:** si no hay una fuente inequívoca, el valor es `null` y la app pinta un monograma. Un escudo equivocado es peor que ningún escudo.

## Contexto

La ficha ya mostraba el escudo del rival en el calendario, pero la trayectoria y los partidos históricos solo tenían el nombre del club. Los clubes de la trayectoria pertenecen a muchas ligas y no todos están en los fixtures actuales de football-data.org. Hacía falta un contrato aditivo y un pipeline que intentara resolver todos los clubes sin romper JSON antiguos ni depender de una sola fuente.

## Decisiones

### 1. Contrato aditivo

Se añaden dos campos opcionales:

| Campo | Dónde | Significado |
|---|---|---|
| `crestUrl` | `CareerEntry` | URL del escudo del club de esa etapa |
| `opponentCrestUrl` | `PlayerMatch` | URL del escudo del rival de ese partido |

- Pydantic es el origen; se regeneran `packages/schemas` y el espejo Zod los acepta con `default(null)`. Un JSON o una caché anteriores siguen validando.
- Los ejemplos de `packages/schemas` incluyen ambos campos.
- Se sube `buster` a `data-v4` porque la caché persistida de la app no tiene estos campos.
- La app solo pinta la imagen si la URL existe; si falla la carga, `TeamCrest` cae al monograma.

### 2. Prioridad de resolución

`CrestResolver` (`scripts/depor_hub/enrich/crests.py`) prueba, en este orden:

1. **football-data.org**: índice construido con los equipos de `data/public/v1/fixtures.json` (nombre y nombre corto). Es la fuente más fiable y la que ya usa el calendario.
2. **Wikidata + Wikimedia Commons**: búsqueda de la entidad, validación de que es un club de fútbol (`P31 = Q476028`), lectura de `P154` (logo) y petición de la miniatura a Commons a **96 px**.
3. **Overrides manuales**: `data/manual/club_crests.yml`, solo con URL y fuente reales. Nunca se inventa una URL ni se deduce un id.

Para un filial o reserva, si no hay escudo propio se intenta el de la matriz. Para un club senior sin `P154` **no** se toma el escudo de una entidad matriz: podría ser el club equivocado.

### 3. Normalización y filiales

- Los nombres se comparan sin mayúsculas, tildes ni puntuación. Para el emparejamiento se quitan palabras de forma (`CF`, `CD`, `de`, `la`, `club`, `fútbol`…), pero no las de identidad.
- Todos los patrones de filial viven en un único sitio (`_RESERVE_PATTERNS`): sufijos ` B`, ` C`, ` II`, ` Atlètic/Atlético`, ` Castilla`, ` Fabril`, ` Promesas`, ` Juvenil`, `Sub-19/21`, `U19/U21/U23`, `Next Gen` y prefijo `Jong `. El alias `Fabril` apunta a `Deportivo de A Coruña`.
- Una clave repetida con URLs distintas queda marcada como ambigua y devuelve `null`; nunca se resuelve por parecido.

### 4. Wikidata y Commons: límites conservadores

- Solo se aceptan entidades con `P31 = Q476028` (club de fútbol).
- Si hay varias entidades candidatas y ninguna coincide de forma exacta, se devuelve `null`.
- Si la entidad tiene `P154` pero Commons no devuelve una URL legible, **no** se usa el escudo de la matriz: el dato propio prevalece aunque sea ilegible.
- `P154` admite errores en Wikidata (fotos de partido, de aficionados o de un estadio). Para no pintar una foto como escudo, se rechazan las imágenes con una relación de aspecto fuera de **0,4–1,4**. Es una salvaguarda deliberadamente conservadora: algunos escudos legítimamente apaisados se quedarán en `null`.
- La miniatura se pide a 96 px. Las URLs de Wikimedia se enlazan; no se descargan ni se guardan en el repositorio.

### 5. Caché e idempotencia

- La caché vive en `data/raw/enrich/crests.json` (ignorada por git) y guarda también los `null`, para no repetir consultas.
- Se invalida si `fixtures.json` o `club_crests.yml` son más recientes que la caché.
- **Importante:** si se hace una pasada `--offline` y se cachean negativos, una pasada online posterior los reutiliza. Antes de una resolución online real hay que borrar o mover `data/raw/enrich/crests.json`.
- `enrich --apply --offline` es idempotente: la segunda pasada devuelve `changed=false`.
- El pipeline no tumba el enriquecimiento si Wikidata o Commons fallan: el club queda en `null` y se sigue.

### 6. Riesgo legal

Los escudos son marcas de sus clubes. El usuario asume el riesgo de usarlos como ilustración editorial en esta app de aficionados, igual que ya ocurre con los escudos del calendario (ADR 0006). Queda anotado en `docs/sources.md`; si Wikimedia limita el hotlinking o cambia sus términos, se deja de usar esa vía y se avisa. No se usa el escudo del Depor como logo o icono de la app.

## Cobertura (26-oct-2026)

- Clubes distintos en carrera/partidos: **40/132** con escudo (**31/75** de carrera y **19/82** rivales). El resto queda en `null` (monograma): clubes sin `P154`, entidades ambiguas o imágenes descartadas por aspecto.
- Entradas de carrera: **97/156**. Partidos: **320/1262**.
- La cobertura es deliberadamente parcial: no se rellena con URLs sin fuente. Los overrides manuales solo se añaden con una URL y una fuente verificables.

## Comandos

```bash
python -m depor_hub.cli enrich --apply --offline
python -m depor_hub.cli enrich --apply --fixtures data/public/v1/fixtures.json
python -m depor_hub.cli enrich --apply --club-crests data/manual/club_crests.yml
python -m depor_hub.cli enrich --apply --no-crests
```

## Pruebas

`scripts/tests/test_crests.py` cubre: fixtures inequívocos, claves ambiguas, overrides y prioridad, filiales, `P154` + Commons, club senior sin `P154`, entidades ambiguas, rechazo de imágenes apaisadas, caché idempotente y negativos. `scripts/tests/test_enrich.py` comprueba que la cobertura de escudos tolera `None` y que los extras conservan los campos.

## Referencias

- `scripts/depor_hub/enrich/crests.py`, `scripts/depor_hub/enrich/commons.py`, `scripts/depor_hub/enrich/wikidata.py`.
- `data/manual/club_crests.yml`, `data/public/v1/fixtures.json`.
- ADR 0006 (escudos del calendario), ADR 0011 (rediseño de la ficha).
- `https://www.wikidata.org/wiki/Property:P154` — logo image.
- `https://commons.wikimedia.org/` — miniaturas y metadatos.
