# ADR 0009 — Fotos de jugador, ficha oficial y previsualización local (H4)

- **Estado:** aceptada (25-oct-2026).
- **Alcance:** añadir fotos con atribución a cada jugador, usar la ficha oficial del club como fuente autoritativa cuando existe, permitir overrides manuales sin pisar el generador y servir `data/public` en local con `npm run mobile`.
- **Regla base:** no se inventa ningún dato ni se redistribuyen imágenes con derechos. Lo que no tiene fuente fiable sigue en `null` y la app lo muestra como «Datos pendientes».

## Contexto

La ficha H4 no tenía foto: solo un avatar generado con iniciales (ADR 0007). Además, al ejecutar `npm run mobile` la app seguía leyendo los datos publicados en GitHub Pages, así que los cambios de `data/public` no se veían. Faltaban también altura, pie y redes en varios jugadores que la web oficial sí publica.

La petición es que **todos** los jugadores tengan la máxima información posible y al menos una foto. Eso choca con dos límites:

1. Hay campos que ninguna fuente libre publica (peso, redes) para algunos jugadores.
2. Las fotos de los medios oficiales del club están protegidas: no se pueden copiar al repositorio ni relicenciar.

## Decisiones

### 1. La ficha oficial del club manda cuando existe

`OfficialClient` recorre `/es/depor` y `/es/depor-fabril`, entra en cada ficha y extrae del HTML servido: nombre, fecha de nacimiento, altura, pie preferido, foto del CDN y redes. Se deduplica por `(fecha de nacimiento, foto)` porque el mismo jugador aparece en ambas plantillas con nombres distintos (por ejemplo «Nsongo Bil» y «Bil Nsongo»).

Prioridad por campo:

| Campo | Fuente que se aplica | Conflicto |
|---|---|---|
| `heightCm`, `preferredFoot`, `shirtNumber` | Ficha oficial | Se registra con `applied` y `resolution` |
| `weightKg` | BDFutbol | Se registra con `applied` y `resolution` |
| `birthPlace` | Consenso de formas compatibles («Arnedo» ⊂ «Arnedo, La Rioja, España») | Las formas disidentes quedan en `candidates` |
| Resto | Consenso normal; si discrepan, no se aplica | Queda en `conflicts` |

Una fuente oficial nunca borra la discrepancia: el conflicto sigue visible en `data/manual/squad_enrich.proposed.yml`.

### 2. Fotos: solo la del club, enlazada con atribución

La ficha del jugador usa **una sola foto: la que publica el club** en su ficha oficial (o, si no tiene ficha, en la noticia oficial de presentación). Esa foto es siempre la de perfil (`role: "portrait"`) y la única que se aplica; las imágenes de Wikimedia Commons o Wikipedia **no** se usan para jugadores, aunque el contrato siga admitiéndolas.

Reglas:

- Solo se guardan **URLs y metadatos**; las imágenes no se descargan al repositorio ni se sirven desde él.
- Cada foto lleva `license`, `licenseUrl`, `author`, `credit` y `sourceUrl`. La app muestra la atribución y enlaza a la ficha original.
- Las fotos del club se marcan como `Uso editorial del club (sin licencia de reutilización)` y `© RC Deportivo de La Coruña`. No se relicencian ni se presentan como libres.
- El CDN oficial sirve HEIF aunque la URL acabe en `.jpg`; `expo-image` lo decodifica en iOS y Android modernos. Si falla, `PlayerPortrait` vuelve al avatar de iniciales.
- En listas y cabecera se usa la variante `-small` del CDN (`~43 KB`) en lugar de `-large` (`~1,1 MB`); la galería mantiene `-large` para que no se vea borrosa.
- `--no-photos` no añade ninguna foto; `--no-official` desactiva la ficha oficial (y, por tanto, la foto); `--no-fabril` no recorre la plantilla del filial.

### 3. Contrato aditivo: `Player.photos`

`PlayerPhoto` se añade a `Player` sin romper JSON ni cachés anteriores:

| Campo | Tipo | Notas |
|---|---|---|
| `url` | `string` | URL original (https) |
| `role` | `"portrait" \| "action" \| "other"` | Por defecto `portrait` |
| `width`, `height` | `int \| null` | Los publica la fuente si los conoce |
| `license` | `string \| null` | Nombre corto de la licencia o «uso editorial» |
| `licenseUrl` | `string \| null` | Enlace a la licencia |
| `author` | `string \| null` | Autoría |
| `credit` | `string \| null` | Texto de crédito tal como debe mostrarse |
| `sourceUrl` | `string \| null` | Ficha de la foto o de la noticia |

Pydantic es el origen; `packages/schemas/*.schema.json` se regeneran y el espejo Zod usa `photos: z.array(PlayerPhoto).default([])`. Un JSON o una caché anteriores a este ADR siguen validando.

### 4. Overrides manuales separados del generador

`enrich --apply` escribe `data/manual/squad_extras.yml`. Ese fichero es **salida generada**: si se edita a mano, la siguiente pasada puede pisarlo.

Los datos manuales viven en `data/manual/squad_overrides.yml`:

- Se cargan con `--overrides` (por defecto ese fichero) y mandan sobre lo generado.
- Cada jugador con datos exige `source`; cada campo puede afinar su `provenance`.
- Se usan para contratos publicados en notas del club y para la foto de un jugador sin ficha (Teun Gijselhart).
- No se usan para «rellenar» huecos con fuentes débiles: si dos fuentes discrepan (peso de Ede Bright, peso de Teun), el campo sigue en `null`.

### 5. Previsualización local con `npm run mobile`

`scripts/mobile.mjs` levanta un servidor estático de solo lectura sobre `data/public` (puerto 8000 por defecto, CORS abierto) y arranca Expo en paralelo.

`apps/mobile/src/config.ts`:

- Si `EXPO_PUBLIC_DATA_BASE_URL` tiene valor, se usa tal cual (datos publicados).
- Si está vacía y `__DEV__`, se deriva `http://<host de Metro>:<puerto>/v1`. Así funciona en simulador y en un móvil de la misma red sin IP fija.
- La clave de React Query incluye `DATA_BASE_URL` y el `data-v3` de caché; en desarrollo el `staleTime` es 0 para no enseñar datos viejos.

`apps/mobile/.env` está ignorado por git; `.env.example` documenta las dos variables.

## Consecuencias

- **Pros:** la ficha se ve completa y con foto; cada dato y cada imagen tienen origen; los conflictos no se ocultan; los cambios locales se ven al instante.
- **Contras:** las fotos del club dependen de un CDN externo y de su política de uso editorial; si cambia la URL, la app cae al avatar. Peso y redes siguen incompletos en algunos jugadores porque no hay fuente fiable.
- **Mantenimiento:** al añadir un campo o una fuente hay que tocar Pydantic, regenerar esquemas, actualizar el espejo Zod y los tests de compatibilidad.

## Cobertura real (25-oct-2026)

`enrich --apply --offline` sobre 28 jugadores:

| Campo | Cobertura |
|---|---|
| Dorsal | 28/28 |
| Contrato | 28/28 (24 generadas + 4 overrides) |
| Altura | 28/28 |
| Peso | 25/28 |
| Lugar de nacimiento | 28/28 |
| Pie preferido | 28/28 (27 generadas + 1 override) |
| Redes | 27/28 (19 generadas + 8 overrides) |
| Fotos | 28/28 (solo la oficial del club) |
| Carrera | 28/28 |
| Totales de carrera | 28/28 |
| Partidos con el Depor | 28/28 |
| Cesión (`loanFrom`) | 3/28 |
| Cesión de salida (`loanTo`) | 1/28 (Teun → Al Ain) |

Los huecos restantes están documentados como pendientes en la propuesta; no se rellenan por deducción.

## Referencias

- `docs/sources.md` — fuentes, límites y comandos.
- `docs/adr/0007-plantilla-y-fichas.md` — ficha original y avatar generado.
- `docs/adr/0008-enriquecimiento-fuentes-libres.md` — pipeline de enriquecimiento.
- `apps/mobile/src/components/PlayerPortrait.tsx`, `apps/mobile/app/player/[id].tsx`.
