# ADR 0026 — Club: contrato, imágenes locales e himnos

- **Estado:** aceptado
- **Fecha:** 2026-11-02

## Contexto

H7 cierra la pestaña Club con identidad, himnos, escudo histórico, equipaciones, estadio, museo, ciudad deportiva, junta, patrocinadores, títulos, rivalidades y enlaces. La app necesitaba datos que hasta ahora no tenían contrato (`club.json`) y una forma de servir imágenes propias sin depender de dominios externos ni reutilizar la capa de escudos remotos de H4. Además, las letras de los himnos se copian de páginas del club con formato libre y no deben publicarse con créditos mezclados ni con datos inventados.

La ficha es editorial y no lleva procedencia visible: el usuario pidió expresamente que el contrato y la interfaz no muestren fuente, confianza ni estado de verificación.

## Decisión

### Contrato `club.json`

Pydantic en `scripts/depor_hub/models.py` genera el JSON Schema de `packages/schemas/club.schema.json`; la app mantiene el espejo Zod en `apps/mobile/src/data/schemas.ts`. El objeto raíz es:

| Campo | Tipo | Contenido |
|---|---|---|
| `updatedAt` | ISO 8601 | Última escritura con cambios reales |
| `identity` | objeto | Nombre oficial, nombre corto, fundación, ciudad, país, colores, apodos, lema, presidencia, entidad, sede, web y contacto |
| `anthems` | lista | `id`, `title`, `kind` (`oficial`/`no_oficial`/`popular`), `authors`, `year`, `description`, `lyrics`, `credits` (`role`, `names`, `text`) |
| `crests` | lista | `id`, `yearFrom`, `yearTo`, `description`, `image` (ruta relativa) |
| `kits` | lista | Temporada `AAAA-AA` y equipaciones con `type`, fabricante, patrocinadores, colores, descripción e `image` |
| `stadium` | objeto | Nombre, dirección, coordenadas, inauguración, reformas, césped, dimensiones, acceso, transporte, aparcamiento y `capacity` |
| `tickets` | objeto | Temporada, zonas con precio y nota, URL de compra |
| `museum`, `trainingCenter`, `board`, `sponsors` | objetos | Museo y visitas, ciudad deportiva, junta/organigrama y patrocinios |
| `titles`, `rivalries`, `facts` | listas | Palmarés por competición, rivalidades y hechos del club |
| `links` | objeto | Canales oficiales tipados y enlaces adicionales (`others`) |

Reglas del contrato:

- Todo campo desconocido es `null` (o lista vacía) y nunca se deduce. No se inventan dorsales, fechas, patrocinadores, equipaciones ni cifras.
- No existen campos `source`, `confidence`, `verified`, `provenance` ni equivalentes. La trazabilidad vive en comentarios de `data/manual/club.yml`, en `data/manual/club_images.yml` y en `docs/sources.md`.
- `Capacity.total` se valida contra la suma de `breakdown`; el modelo y la app comparten la misma garantía. Se publica **33.225** = 32.490 gradas + 141 palco de honor + 385 palcos VIP + 113 Área 1906 + 96 medios.
- `season` debe cumplir `AAAA-AA`. El orden de publicación es estable y ascendente; la app agrupa por década y ofrece un selector rápido.
- `updatedAt` solo cambia si cambia el contenido. `publish_club` compara el JSON anterior ignorando `updatedAt`, reutiliza la marca previa y devuelve `changed=false` cuando no hay diferencias.
- `club.json` está en `FILES` para validarse y publicarse, pero se excluye del `dataHash` deportivo (`SPORTS_FILES`): un cambio editorial del club no invalida la caché de clasificación, plantilla o partidos.
- La junta **no duplica** al entrenador: la app lo toma de `squad.json` (`coach.name`) y enlaza a `/coach`. El YAML solo modela presidencia, consejo, dirección deportiva y nota.

### Imágenes locales

Las imágenes del club se guardan en el repositorio y se sirven desde `data/public/v1/img/club/`:

- `escudos/<año>.png` (o `.svg` para el vigente) y `equipaciones/<temporada>-<tipo>.jpg`.
- El contrato guarda siempre **rutas relativas** (`img/club/escudos/1906.png`), nunca URLs externas.
- `clubImageUrl(path)` en `apps/mobile/src/config.ts` resuelve la ruta contra `DATA_BASE_URL`, respeta URLs absolutas y devuelve `null` si no hay ruta o no hay base configurada. `ClubImage` pinta un marcador del mismo tamaño cuando falta la imagen o falla la carga, de modo que las listas no saltan.
- `data/manual/club_images.yml` contiene las 15 fuentes (14 escudos + la equipación local 2026-27). `python -m depor_hub.cli club-images` descarga, normaliza y escribe; `--offline` no hace peticiones y solo comprueba qué ficheros ya existen.
- Los escudos se limitan a 512 px de lado y la equipación se guarda como JPEG. El total actual es **2.416.456 bytes (2,30 MiB) en 15 ficheros**: 44 KB de equipaciones y 2,3 MiB de escudos. El escudo 2026 se guarda como SVG oficial porque `expo-image` lo soporta en iOS y Android.
- Solo la equipación local 2026-27 tiene imagen real; las demás se publican sin `image` y la app muestra el marcador. `docs/kits_coverage.md` se regenera en cada `club` y deja la cobertura explícita (42 temporadas, 44 equipaciones, 1 con imagen).
- El workflow `data-refresh.yml` ejecuta siempre `club`; `club-images` solo descarga si falta el directorio y, si existe, se ejecuta con `--offline`.

### Himnos y letras

- Un fichero de texto por himno en `data/manual/himnos/<id>.txt`; si no existe, se prueba `data/manual/<id>.txt` como compatibilidad.
- El YAML aporta título, tipo, autoría, año, descripción y créditos. La letra **nunca** se escribe en el YAML: se lee del `.txt` al publicar.
- Si el fichero contiene una línea que sea exactamente `Letra` (sin distinguir mayúsculas), se publica solo el bloque posterior. Lo anterior se descarta de la letra, pero la información útil se modela como créditos en el YAML y la app la muestra en la tarjeta de créditos.
- Las líneas que empiezan por `#` son comentarios y no se publican. Los saltos se normalizan y, si no queda texto, `lyrics` es `null` (nunca `""`).
- La app lista los himnos con indicador de letra disponible y abre `/club/himno/[id]`; la letra es seleccionable, escala con el tamaño de fuente del sistema hasta 2× y se comparte con la hoja nativa (`Share`). No hay audio ni reproductor.
- Las letras y los nombres propios no se traducen. La interfaz sí: ES/EN con paridad exacta y GL parcial sin claves extra.

## Consecuencias

- El Club funciona sin conexión con la caché persistida de TanStack Query y muestra `FreshnessBanner`; todas las pantallas cubren carga, vacío, error con reintento y sin datos.
- Las imágenes quedan versionadas y son auditables, a cambio de 2,30 MiB en el repositorio y de un paso de normalización con Pillow en los scripts.
- La app no hace hotlinking de escudos ni de equipaciones del club. Las imágenes externas de H4 (fotos de jugador y escudos de rivales) mantienen su tratamiento y atribución.
- El contrato no expone procedencia, pero cualquier revisión editorial puede auditarse en `data/manual/club.yml`, `club_images.yml`, `docs/sources.md` y `docs/kits_coverage.md`.
- `npm run licenses` genera `apps/mobile/src/data/licenses.json` de forma determinista desde `package-lock.json` (1.052 paquetes de producción en 16 grupos). La pantalla Acerca de lo muestra agrupado y sin fecha de generación.
