# ADR 0018 — Noticias curadas, clústeres y filtros sin ruido

- **Estado:** aceptada (30-oct-2026).
- **Sustituye a:** ADR 0016 en todo lo relativo a fuentes, contrato, deduplicación y pestaña Noticias. `social.json` y sus perfiles curados siguen vigentes.
- **Alcance:** catálogo de 5 fuentes, relevancia explicable, taxonomía cerrada, historias con clústeres, contrato `news.json` v1 roto de forma deliberada, retención, CLI, workflow cada 6 h y rediseño completo de la pestaña.
- **Regla base:** solo se publica lo que entrega el feed. No se descarga el cuerpo del artículo, no se rodean bloqueos y no se inventan fechas, medios, resúmenes ni miniaturas.

## Contexto

El ADR 0016 dejó 21 feeds activos, muchos de ellos generalistas o agregadores de Google News. El resultado era correcto pero ruidoso: entraban noticias de otros «Deportivo», el mismo hecho aparecía varias veces con titulares distintos, las etiquetas mezclaban equipos y jugadores con temas, y la pestaña acumulaba paginación, filtros permanentes y cromo que no ayudaba a leer. Además, Google News no entrega miniaturas y obliga a mantener una rotación de consultas por jugador.

La auditoría del 29-oct-2026 midió cada feed con el filtro real. Solo cinco fuentes aportaban historias del Depor con volumen y calidad suficientes. Este ADR reduce el catálogo a esas cinco, cambia el contrato para que la unidad sea la **historia** (no el ítem de un medio) y rediseña la pestaña alrededor de esa unidad.

## Decisiones

### 1. Cinco fuentes curadas

| Fuente | Grupo | Prioridad | Papel |
|---|---|---:|---|
| RC Deportivo (YouTube) | club | 5 | Vídeos oficiales |
| Riazor.org | galicia | 10 | Medio independiente centrado en el Depor |
| DXT Campeón | galicia | 20 | Sección deportiva del Ideal Gallego |
| La Voz de Galicia | galicia | 30 | Feed de tema Deportivo, no la portada |
| Marca | nacional | 40 | Único nacional con feed directo del Depor |

`group` es cerrado (`club`, `galicia`, `nacional`) y gobierna los chips de la barra. `priority` decide qué versión representa la historia: menor gana. El catálogo documenta once fuentes descartadas con su motivo (sin RSS, 403/406, sección 410, feed general sin señal o tag ambiguo); no se reintentan a ciegas.

YouTube se mantiene como excepción expresa: su `robots.txt` desaconseja el RSS, pero el responsable del proyecto autorizó conservar el canal oficial. Es la única fuente que no es un medio editorial.

### 2. Relevancia con señales fuertes

El filtro puntúa título y resumen. **«Deportivo» a secas no cuenta**: aparece en decenas de clubes y en usos genéricos. Solo suman señales que identifican al club de A Coruña, su entorno o personas de la plantilla:

- nombres del club (`RC Deportivo`, `Deportivo de La Coruña`, `Dépor`, `Depor`), `Fabril`, `Abegondo`, `Riazor` con contexto de fútbol, `blanquiazul`;
- jugadores y entrenador de la plantilla actual;
- rivales y competiciones, siempre con contexto futbolístico;
- para feeds `depor_specific` se exige menos puntuación, pero nunca se acepta un titular de otro club.

Se excluyen explícitamente otros «Deportivo» (Alavés, Cali, Saprissa, Tenerife, Betis Deportivo, etc.), el `Riazor` de playa o sucesos y los apellidos comunes sueltos. El umbral es configurable (`--threshold`). Cada descarte registra un motivo (`sin_senal`, `otro_deportivo`, `solo_extracto`, `fuera_de_ventana`, `sin_fecha`, `duplicado_de_url`…), y el informe los agrega.

Un titular sin señal propia que solo se apoya en el extracto se descarta como `solo_extracto`: evita publicar «Parte médico» porque el resumen menciona al Depor. Sí se aceptan jugador, entrenador, Fabril o Abegondo cuando aparecen en el extracto, porque identifican al club sin ambigüedad.

### 3. Taxonomía cerrada y máximo dos etiquetas

`fichajes`, `cantera`, `lesiones`, `partido`, `afición`, `club` y `opinión`. Nunca se derivan etiquetas de equipos o jugadores. Como máximo dos por historia y, si ninguna regla aplica, la lista queda vacía.

Reglas destacadas:

- `lesiones` exige lenguaje de lesión o parte médico; una muerte o un fallecimiento **no** genera `lesiones`.
- `partido` exige contexto de partido (previa, crónica, alineación, jornada); la palabra suelta no basta.
- `opinión` solo con marcas editoriales claras (artículo de opinión, análisis firmado, columna).

Las etiquetas se recalculan también sobre las historias conservadas de ejecuciones anteriores, para que un cambio de taxonomía no deje valores obsoletos.

### 4. Deduplicación por historia, no por titular

La unidad publicada es una `NewsStory` con una versión principal y las demás en `alsoIn`. Reglas:

- ventana de **±48 h**;
- misma URL ⇒ mismo ítem, sin discusión;
- dos entradas del **mismo medio** con URL distinta **nunca** se fusionan: pueden ser dos noticias del mismo jugador o dos piezas del mismo día;
- similitud de titulares con tokens, *shingles* y Jaccard; umbral base **0,52**;
- fusión por solapamiento de palabras ≥ 0,55 cuando la similitud supera el umbral;
- fusión por entidades (jugador, entrenador, rival) con umbral **0,44** y solapamiento fuerte;
- conflicto previa/crónica: una previa y una crónica del mismo partido no se fusionan;
- el representante se elige por prioridad de fuente y, a igualdad, por antigüedad;
- el `id` es estable: se hereda de la historia anterior que contenía alguna de sus URLs; si no, se deriva de la URL canónica del representante;
- `alsoIn` guarda `sourceId`, `title`, `url` y `publishedAt` de cada versión.

Calibración real: pares con similitud 0,548 y 0,474 se fusionaron; dos noticias distintas del mismo jugador (≈0,20) no. Los clústeres de tres versiones (Hidalgo/Aubameyang) y dos versiones (Auriense-Dépor) quedaron verificados en los tests.

### 5. Contrato roto a propósito

Se autorizó romper `/v1/` y sustituir `items`/`meta` por `stories`/`sources`. El contrato pasa a:

```json
{
  "updatedAt": "2026-10-29T10:00:00Z",
  "sources": [
    { "id": "riazor", "name": "Riazor.org", "group": "galicia", "kind": "article", "homepage": "https://www.riazor.org/" }
  ],
  "stories": [
    {
      "id": "…",
      "title": "…",
      "url": "…",
      "sourceId": "riazor",
      "publishedAt": "…",
      "kind": "article",
      "summary": null,
      "thumbnailUrl": null,
      "tags": ["fichajes"],
      "alsoIn": [
        { "sourceId": "dxt-campeon", "title": "…", "url": "…", "publishedAt": "…" }
      ]
    }
  ]
}
```

Pydantic es la fuente; el JSON Schema se regenera con `python -m depor_hub.cli schemas`; el espejo Zod usa `default(...)` para tolerar campos ausentes. `sources.json` desaparece: las fuentes viajan dentro de `news.json` porque son pocas y la app las necesita para resolver nombre, grupo y monograma. `meta.json.dataHash` sigue cubriendo solo los ficheros deportivos; noticias tiene su propio hash y no escribe si no cambia.

### 6. Retención y fallos

- Ventana de **14 días** y máximo **150 historias**.
- Si una fuente falla, sus historias anteriores se conservan: no desaparecen del JSON por un error temporal.
- Si **todas** las fuentes fallan, `run_ingest` lanza `AllFeedsFailed`, el CLI imprime `ERROR:` y sale con código 1. No se publica un `news.json` vacío ni se pisa el anterior. El workflow falla de forma visible.
- La escritura es idempotente: compara el hash del contenido y el texto exacto del fichero; un refresco sin cambios no genera commit.

### 7. CLI

```bash
python -m depor_hub.cli news [--dry-run] [--offline] [--report] [--force] [--threshold N]
python -m depor_hub.cli news audit [--all] [--write-docs]
```

`news` es el comando principal; `news ingest` se mantiene como alias. `--report` imprime elementos y relevantes por fuente, descartes por motivo, tamaños de clúster, etiquetas y los 20 clústeres mayores. `--dry-run` calcula sin escribir; `--offline` usa solo la caché de `data/raw/news`; `--force` ignora ETag/If-Modified-Since.

### 8. Workflow cada 6 horas

`news-refresh.yml` pasa a `cron: "37 */6 * * *"`, con `workflow_dispatch` y `force`. Comparte `concurrency.group: data-publish` con `Data refresh` y `cancel-in-progress: false`; permisos mínimos (`contents`, `pages`, `id-token`); caché `data/raw/news`; `timeout-minutes`; commit solo cuando hay cambios; `git pull --rebase` antes de publicar; despliegue solo con cambios. Si ninguna fuente responde, el paso de ingesta sale con error y no se despliega.

Las fuentes publican pocas veces al día; cada 30 minutos generaba peticiones y commits sin valor. El refresco manual sigue disponible desde Actions.

### 9. Pestaña Noticias

- **`SectionList` por día natural en `Europe/Madrid`**, con «Hoy» y «Ayer» y, para el resto, fecha larga localizada.
- **Cabecera que scrollea**: banner de frescura, recuento, no leídas y «Marcar leídas».
- **Barra sticky compacta** fuera de la lista: búsqueda expandible, segmento Todo/Artículos/Vídeos, chips de grupo multiselección y botón de filtros con contador.
- **Hoja inferior** con fuentes y etiquetas, contadores y «Limpiar (n)». Los filtros no se persisten: al abrir la pestaña se parte de cero.
- **Tarjeta**: monograma por fuente, título a 3 líneas, extracto a 2, miniatura de 72 px con `expo-image`, hora relativa una sola vez, punto discreto de no leída, dos etiquetas pulsables y `+N medios` desplegable y accesible que abre cada versión.
- **Leídos** en Zustand, persistentes y podados a los ids que siguen en la retención. «Marcar leídas» es una acción secundaria con confirmación y snackbar de deshacer.
- **Contador** solo si hay no leídas: por debajo de 100 muestra el número; a partir de 100, `99+`.
- **Búsqueda** con debounce de 250 ms sobre título, medio y etiquetas, sin acentos.
- **Estados** completos: carga, error con reintento, vacío sin noticias, vacío filtrado, sin conexión con caché visible.
- **Accesibilidad**: objetivos de 44 pt (o `hitSlop` equivalente), etiquetas de acción, estado `expanded` del clúster y contraste AA. Sin sombras pesadas.

La Home sigue mostrando cinco titulares y «Ver todas», ahora resolviendo el nombre del medio desde `sources`.

### 10. Pruebas

- **Python:** relevancia (incluido Molina fuera y `solo_extracto`), taxonomía con 30 titulares, clústeres reales, retención, fallo total y parcial, idempotencia y validación del contrato de ejemplo.
- **TypeScript:** lógica de filtros, agrupación por día, top 5, monogramas, contadores y clúster; render de estados, búsqueda, grupos, hoja de filtros, `alsoIn`, marcar leídas con deshacer y apertura externa. El mismo ejemplo de `news.json` se valida en pytest y en Jest.

## Consecuencias

- Menos fuentes, menos ruido y menos peticiones; se pierde cobertura de medios que solo publicaban ocasionalmente al Depor.
- El contrato rompe clientes antiguos de `/v1/`. Es una decisión consciente y coordinada con la app en el mismo cambio; la caché móvil sube a `data-v6`.
- Marca es el único nacional viable con feed directo; no se sustituye por Google News para no depender de un agregador sin miniaturas.
- El clúster es heurístico. Los umbrales están calibrados con pares reales y cubiertos por tests; cualquier ajuste debe añadir un caso real al test.
- YouTube sigue siendo una excepción documentada a `robots.txt`; si el club cambia de canal o cierra el RSS, la fuente se deshabilita y las demás siguen publicando.
- `social.json` deja de mostrarse en Noticias, pero se sigue generando y validando para no romper el contrato ni perder los perfiles curados.

## Alternativas descartadas

- **Mantener 21 feeds y filtrar más agresivamente:** multiplica peticiones y falsos positivos sin mejorar la cobertura real.
- **Deduplicar solo por URL:** deja el mismo hecho repetido con titulares distintos.
- **Deduplicar por título exacto:** no fusiona versiones reales (0,548) y sí fusiona piezas distintas con el mismo titular genérico.
- **Persistir filtros:** vuelve a esconder noticias sin que el usuario recuerde por qué.
- **Etiquetas abiertas o por entidad:** generan ruido y envejecen mal; la taxonomía cerrada es explicable y testeable.
