# ADR 0032 — Club: datos ampliados, títulos, rivalidades y medios externos

- **Estado:** aceptado
- **Fecha:** 2026-11-06
- **Ámbito:** ampliación aditiva del contrato de club (`/v1/`) y pipelines editoriales

## Contexto

La pestaña Club ya tenía identidad, himnos, escudos, equipaciones, estadio, museo,
ciudad deportiva, junta, patrocinadores, títulos, rivalidades y enlaces. Faltaban
tres cosas para el rediseño:

1. metadatos legales y de procedencia en las letras de los himnos;
2. detalle de equipaciones, estadio, patrocinios y medios externos sin romper los
   campos legados (`image`, `lyrics`, `official`, etc.);
3. un sitio para el detalle de títulos y rivalidades que no engordara `club.json`
   ni obligara a la app a descargar todo si no lo necesita.

El proyecto mantiene una regla estricta: Pydantic es el origen del contrato y Zod
su espejo; lo desconocido es `null`/`[]`; no se inventan datos; las imágenes nuevas
no se copian al repositorio. Además, cada dato nuevo debe poder auditarse con su
fuente, confianza y fecha de captura.

## Decisión

### 1. Ampliación aditiva de `club.json`

Se añaden campos opcionales con `default=null`/`default=[]`; los campos legados no
cambian de tipo:

| Bloque | Campos nuevos |
|---|---|
| `Anthem` | `media`, `lyricsRights` |
| `CrestVersion` | `media` |
| `Kit` | `media` |
| `Stadium` | `schedule`, `accessDetails`, `capacityAlternatives`, `tenants`, `media` |
| `Sponsors` | `details` |
| `Club` | `media` |

`MediaRef` publica `url`, `kind`, `width`, `height`, `license`, `licenseUrl`,
`author`, `credit`, `sourceUrl`, `origin` y `verifiedAt`. La URL es siempre la
fuente original; el repositorio no redistribuye el binario. `origin` distingue
Commons, web oficial, prensa y otros.

`AnthemLyricsRights` publica `status` (`licensed`, `public_domain`,
`permission_granted`, `unknown`), `holder`, `license`, `licenseUrl`, `sourceUrl`,
`note` y `verifiedAt`. Las tres letras actuales se mantienen por decisión del
responsable y se publican con `status: unknown`, crédito y una nota explícita: no
se afirma permiso de reutilización. La app puede seguir mostrando la letra con uso
editorial y atribución.

No se añaden `source`, `confidence` ni `provenance` al bloque `Club`: la
trazabilidad de los datos editoriales sigue viviendo en el YAML y en
`docs/sources.md`, tal como fijó el ADR 0026. Los nuevos campos usan `sourceUrl` y
`verifiedAt`, que son atribución y fecha de comprobación, no una insignia de
confianza.

### 2. Ficheros opcionales `titles.json` y `rivalries.json`

`club.json` conserva la lista breve `titles` (competición + años) y `rivalries`
(rival + descripción + año). El detalle vive en dos ficheros opcionales:

- `titles.json` (`Titles`): ediciones individuales con `competition`, `year`,
  `season`, `scope`, `status`, `coach`, `finalMatch`, `topScorers`, `squad`,
  `media`, `note` y `provenance`.
- `rivalries.json` (`Rivalries`): rivalidades con `rivalBdfutbolId`, `tier`,
  `status`, `headToHead` (reutiliza el contrato `HeadToHead` de `rivals.json`),
  `iconicMatches`, `facts`, `media` y `provenance`.

`FinalMatch` añade `referee` y `goalScorers`; cada `GoalScorer` puede llevar
`minute` y `team`. `DataStatus` (`verified`/`pending_verification`) distingue lo
contrastado de lo que aún espera revisión sin ocultar el dato.

Ambos están en `EXTRA_FILES` y en `OPTIONAL_FILES`. `validate` los valida si
existen y no falla si faltan: 404 = sin datos. La app los lee con
`useTitles`/`useRivalries` y `optionalDocument`; un 404 se pinta como sección
vacía, no como error global. `club.json` sigue siendo suficiente para la ficha
básica.

`Provenance` se reutiliza en estos dos ficheros (no en `club.json`) con `source`,
`confidence` y `capturedAt`. Es el mismo contrato que ya usan jugador, entrenador
y temporada.

### 3. Pipelines

- `python -m depor_hub.cli club titles` publica `titles.json` desde
  `data/manual/titles.yml` y compara el palmarés con BDFutbol. Las diferencias se
  escriben en `data/manual/titles.proposed.yml`; **nunca se aplican solas**. El
  parser descarta premios individuales (Pichichi, Zamora) y normaliza los nombres
  de competición. BDFutbol no cubre competiciones regionales: esas ediciones
  aparecen como `only_in_curated` y se conservan.
- `python -m depor_hub.cli club rivalries` publica `rivalries.json` y rellena
  `headToHead` desde BDFutbol con `PoliteClient` (caché, robots.txt y 1 s/host).
  Si ninguna fuente devuelve balance, conserva el `rivalries.json` anterior para
  no borrar un histórico ya verificado.
- `python -m depor_hub.cli club probe-media` recorre todos los medios declarados
  en `club.yml`, `titles.yml`, `rivalries.yml` y `club_images.yml`: hace HEAD para
  estado, MIME y tamaño, y un GET mínimo para las imágenes (dimensiones). También
  comprueba las rutas locales contra `data/public/v1`. Escribe
  `data/manual/club_media.proposed.yml` con `ok`/`local`/`broken`/`blocked`/
  `missing`, MIME, tamaño, dimensiones, origen y contexto, e inserta un resumen
  con las URLs rotas o bloqueadas en `docs/sources.md`. No copia binarios ni
  modifica los YAML/JSON: una URL rota se queda en `null` y solo se retira tras
  revisión humana.

Los ids de BDFutbol de los rivales históricos se verificaron abriendo cada ficha
(`e12` Compostela, `e28` Oviedo, `e34` Sporting, `e48` Racing de Ferrol, `e76`
Lugo) y se documentan en `data/manual/bdfutbol_teams.yml`. No se resuelven por
búsqueda automática: un homónimo produciría un balance equivocado.

### 4. Datos publicados

- `titles.json`: 21 ediciones; las Copas de 1995 y 2002 y la Liga 2000 quedan
  `verified` con final, marcador, sede, goleadores con minuto, árbitro,
  entrenador y fuente (Wikipedia contrastada con BDFutbol). El resto conserva el
  palmarés curado con `pending_verification`.
- `rivalries.json`: 6 rivalidades (Celta, Compostela, Oviedo, Sporting, Racing de
  Ferrol y Lugo) con balance histórico de BDFutbol. El Celta queda `verified` y
  `derbi`; Racing de Ferrol es `derbi`; el resto es `historico` y
  `pending_verification`. La descripción narrativa solo se publica cuando está
  documentada; las demás son factuales y breves.
- `club.json`: las tres letras mantienen su contenido y ganan `lyricsRights`;
  el estadio gana `tenants`; los patrocinadores ganan `details` para ABANCA y
  Nike. No se añaden imágenes nuevas ni se duplican los 15 binarios locales.

## Consecuencias

- La app puede seguir leyendo `club.json` como hasta ahora; los campos nuevos
  tienen default en Zod y los ficheros nuevos son opcionales.
- El detalle editorial crece sin romper `dataHash` deportivo ni la caché de la
  ficha: `titles.json` y `rivalries.json` se publican en su propio comando.
- Las letras quedan en un estado legal honesto (`unknown`) y con atribución; si
  el club o los autores conceden permiso, basta cambiar `status`, `license` y
  `sourceUrl` en `club.yml`.
- BDFutbol sigue siendo una fuente de riesgo medio-alto: solo se guardan hechos
  (balance, cruces) y se enlaza la ficha original. El pipeline no insiste ante
  403/429 y no redistribuye HTML.
- Los medios nuevos no entran al repositorio: se publica URL, licencia y crédito.
  `probe-media` deja una propuesta auditable, pero la aplicación es manual.
- `docs/kits_coverage.md` sigue generándose en cada `club`; la cobertura actual
  no cambia (42 temporadas, 44 equipaciones, 1 imagen local).
