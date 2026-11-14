# FASE 1 — Datos y almacenamiento

> Auditoría de solo lectura realizada el **2026-11-11** sobre el árbol de trabajo local `main` (`5759480`, 2026-11-08), contrastado con `origin/main` (`75ebe6e`, 2026-11-10 15:04 UTC) y con la copia publicada en `https://angelvilarino.github.io/depor-hub/v1/`.
>
> **Caveat de línea base:** `main` local está **23 commits por delante y 159 por detrás** de `origin/main`. Los 23 commits locales son trabajo de club (títulos, rivalidades y capa editorial, incluida la foto histórica de equipación) que **no está en `origin/main` ni en producción**. Las cifras de inventario de la §1 son del árbol local; las de transferencia de la §2 son de producción. Donde difieren, se indica.
>
> No se ha modificado ningún fichero de datos, workflow ni código. Los comandos de escritura de datos se han dirigido a `/tmp`; este informe es el único fichero creado. `git status` solo muestra `docs/auditoria/` como no versionado.

---

## Resumen ejecutivo

1. **El modelo JSON estático + GitHub Pages sigue siendo la opción correcta hoy.** El sitio completo pesa **3,86 MB** (2,53 MB de imágenes), el JSON raíz **1,23 MB** (99,8 KB gzip en producción) y el límite gratuito de Pages (1 GB de sitio, 100 GB/mes de tráfico blando) queda muy lejos. No hay motivo de capacidad para migrar a R2, D1, Supabase o Turso.
2. **El problema principal no es el almacenamiento, es la disciplina de publicación.** `squad.json` concentra el 77 % del JSON y el 55 % del peso gzip; la home descarga 34 KB de JSON más hasta **578 KB de miniaturas externas**; y la sección de escudos descarga **2,32 MB de PNG** para mostrar imágenes de 92 px.
3. **La idempotencia está rota por un detalle concreto.** `content_hash()` ignora `updatedAt` y `dataHash` de primer nivel, pero no `season.provenance.*.capturedAt`. Resultado medido: **270 de 273 commits de `squad.json` cambian exactamente una línea** y **214 de 233 de `season.json` cambian cuatro líneas o menos**. Se publica y se redespliega sin cambios sustantivos.
4. **Hay tres contratos que mantener** (Pydantic, JSON Schema generado y Zod manual), **14 esquemas JSON**, 6.898 líneas de JSON Schema y 1.029 líneas de Zod. La validación es buena, pero el espejo Zod es manual y los objetos estrictos rechazan campos aditivos, lo que hace frágil una actualización escalonada de app y datos.
5. **La calidad de datos es honesta pero incompleta:** 3/28 pesos ausentes, 0/28 valores de mercado, 0/19 `keyPlayers`, 6 escudos históricos de rivales sin URL y 37 conflictos de enriquecimiento sin resolver. El 94 % de todo el YAML son dos ficheros generados (1,52 MB).
6. **Recomendación:** mantener JSON + Pages, corregir la idempotencia, partir `squad.json`, optimizar imágenes, limpiar contratos/campos muertos y sincronizar la rama. No migrar a base de datos ni a R2 en esta fase.

---

## 1. Inventario de datos publicados

### 1.1 Ficheros raíz de `data/public/v1` (árbol local) **[MEDIDO]**

| Fichero | Bytes | gzip local | % del JSON | Registros principales | Consumidor en app | Estado en producción |
|---|---:|---:|---:|---|---|---|
| `squad.json` | **950.390** | **54.982** | **77,4 %** | 28 jugadores + entrenador | `useSquad` (equipo y ficha) | 200, 59.818 B gzip |
| `news.json` | 107.828 | 24.660 | 8,8 % | 150 historias, 5 fuentes | `useNews` (home y noticias) | 200, 25.109 B gzip |
| `club.json` | 47.411 | 7.354 | 3,9 % | 14 escudos, 42 grupos de equipación, 3 himnos | `useClub` (club) | 200, 5.729 B gzip |
| `rivals.json` | 42.244 | 3.640 | 3,4 % | 19 rivales | `useRivals` (home y ficha) | 200, 3.958 B gzip |
| `fixtures.json` | 30.697 | 2.266 | 2,5 % | 38 partidos | `useFixtures` (home, calendario, equipo) | 200, 2.372 B gzip |
| `titles.json` | 21.446 | 2.124 | 1,7 % | 21 ediciones | `useTitles` (club) | **404** |
| `rivalries.json` | 14.525 | 1.675 | 1,2 % | 6 rivalidades | `useRivalries` (club) | **404** |
| `standings.json` | 8.425 | 1.228 | 0,7 % | 20 equipos | `useStandings` (home) | 200, 1.324 B gzip |
| `season.json` | 3.655 | 838 | 0,3 % | resumen, forma, evolución | `useSeason` (home) | 200, 854 B gzip |
| `social.json` | 645 | 273 | 0,05 % | 3 perfiles, 0 pins | **ninguno** | 200, 262 B gzip |
| `meta.json` | 594 | 365 | 0,05 % | temporada, equipo, `dataHash` | `useMeta` | 200, 359 B gzip |
| **Total** | **1.227.860** | **99.405** | 100 % | — | — | ~99,8 KB gzip |

> El total de `data/public/v1` es **3.864.765 B** (3,69 MiB; `du` redondea a 3,9 MB): 1,23 MB de JSON raíz, 2,53 MB de imágenes y 110 KB de snapshots/fichas de partido.

### 1.2 Carpetas y activos

| Ruta | Ficheros | Bytes | Notas |
|---|---:|---:|---|
| `img/club/escudos` | 14 (13 PNG + 1 SVG) | **2.374.125** | Los 13 PNG suman **2.318.669 B**; el SVG actual, 55.456 B |
| `img/club/equipaciones` | 44 (43 SVG + 1 JPG) | **153.062** | 42 grupos de equipación en el contrato; 44 imágenes individuales |
| `snapshots/2026-27` | 11 | **8.631** | Fotos congeladas de partidos terminados |
| `match-details/2026-27` | 11 | **101.087** | Alineaciones y eventos (ADR 0031) |
| **Total `img/`** | **58** | **2.527.187** | 65,4 % del peso publicado |
| **Total `data/public/v1`** | **91** | **3.864.765** | — |

**Lectura:** las imágenes son el 65 % del peso, y los 13 PNG de escudos son el 92 % de las imágenes. Las 44 imágenes de equipación (43 SVG + 1 JPG) pesan 153 KB en total y no son un problema. El escudo más pesado es `1910.png` (289.361 B, 381×512 px); los 13 PNG están a ~512 px de alto y se pintan a 92×92 px en la sección de escudos.

### 1.3 Composición interna de los ficheros grandes **[MEDIDO con `jq`]**

| Fichero / campo | Bytes | % del fichero | Uso real |
|---|---:|---:|---|
| `squad.json` · `deporMatches` | 485.084 | **51,0 %** | Solo ficha individual; la lista de plantilla no lo necesita |
| `squad.json` · `career` | 72.483 | 7,6 % | Solo ficha individual |
| `squad.json` · `provenance` | 30.211 | 3,2 % | `provenanceSummary()` existe, pero **no tiene consumidores** |
| `squad.json` · `photos` | 9.871 | 1,0 % | Retrato y atribución |
| `squad.json` · `careerTotals` | 2.495 | 0,3 % | Ficha individual |
| `squad.json` · resto | ~4.100 | 0,4 % | Nombre, dorsal, físico, contrato, redes |
| `news.json` · `stories` | 88.461 | 82,0 % | La home solo muestra 5 titulares |
| `club.json` · `kits` | 12.309 | 26,0 % | Sección de equipaciones |
| `rivals.json` · `rivals` | 24.785 | 58,7 % | La home solo necesita el próximo rival |

**Cifra clave:** un resumen de plantilla con id, nombre, dorsal, posición, foto y poco más cabe en **~3,1 KB gzip**. El 55 % del peso gzip de `squad.json` es historial que solo se usa al abrir una ficha.

### 1.4 Consumo por pantalla

| Pantalla | Documentos que descarga | Peso gzip de JSON | Imágenes / observaciones |
|---|---|---:|---|
| Home (`app/(tabs)/index.tsx`) | `meta`, `standings`, `fixtures`, `news`, `season`, `rivals` | **33.976 B** | Hasta **578.289 B** de las 5 miniaturas de titulares (producción, 2026-11-11) |
| Equipo (`app/(tabs)/team.tsx`) | `squad` | **59.818 B** | Vista por defecto `grid`: retratos `-large` de ~1,1 MB; vista lista: `-small` de ~43 KB |
| Ficha de jugador (`app/player/[id].tsx`) | `squad`, `fixtures`, `meta` | ~62 KB | Descarga el `squad` completo aunque ya esté en caché; retrato `-large` |
| Club (`app/(tabs)/club.tsx`) | `club`, `rivalries` | 5.729 B + 404 | Escudo actual y miniatura de equipación |
| Sección Escudo (`app/club/[section].tsx` → `EscudoSection`) | `club` | 5.729 B | **Los 14 escudos se montan en un `ScrollView`**: hasta 2,37 MB |
| Noticias (`app/(tabs)/news.tsx`) | `news` | 25.109 B | 150 historias; miniaturas externas |
| Calendario (`app/(tabs)/calendar.tsx`) | `fixtures`, `meta` | ~2,7 KB | — |

> La home no descarga `club.json`; el club solo se carga al entrar en la pestaña. La ficha de jugador no vuelve a pedir `squad` si la caché de React Query está viva, pero el tamaño del documento sigue siendo el mismo en la primera visita.

---

## 2. Transferencia real y caché

### 2.1 Medición con `curl` contra GitHub Pages **[MEDIDO 2026-11-11]**

| Petición | HTTP | Bytes transferidos (gzip) | Cabeceras relevantes |
|---|---:|---:|---|
| `meta.json` | 200 | 359 | `Cache-Control: max-age=600`, `ETag`, `Vary: Accept-Encoding` |
| `standings.json` | 200 | 1.324 | ídem |
| `fixtures.json` | 200 | 2.372 | ídem |
| `news.json` | 200 | 25.109 | ídem |
| `season.json` | 200 | 854 | ídem |
| `rivals.json` | 200 | 3.958 | ídem |
| `club.json` | 200 | 5.729 | ídem |
| `squad.json` | 200 | **59.818** | ídem; `ETag: W/"6af3333f-e8076"` |
| `social.json` | 200 | 262 | ídem |
| `titles.json` | **404** | 0 | No existe en `origin/main` ni en Pages |
| `rivalries.json` | **404** | 0 | No existe en `origin/main` ni en Pages |

- **Home en frío:** 33.976 B de JSON + hasta **578.289 B** de miniaturas = **~612 KB**. En caliente, el JSON puede revalidarse con `304` y las imágenes quedan en caché de disco de `expo-image`.
- **Equipo en frío:** 59.818 B de JSON. La vista `grid` añade retratos `-large` de ~1,1 MB cada uno; con `initialNumToRender` por defecto (10) y 2 columnas, la primera ventana puede pedir **hasta ~11 MB** si todas las celdas entran en pantalla. **No medido en dispositivo**, pero el `Content-Length` de cada `-large` es 1.092.627–1.260.816 B.
- **Sección Escudo:** 5.729 B de JSON + **2.374.125 B** de imágenes, casi todo PNG de 512 px.
- **ETag/304:** comprobado con `If-None-Match` sobre `squad.json`: **304, 0 bytes**. GitHub Pages negocia gzip y ETag correctamente.
- **Tráfico mensual:** no hay analítica ni logs de acceso en el repositorio; **no medido**. No se puede afirmar cuántos GB/mes se consumen. El límite blando de Pages (100 GB/mes) admitiría del orden de 170.000 homes en frío si todo el tráfico fuera eso, pero es una cota, no una medición.

### 2.2 Caché en la app

| Capa | Configuración | Evidencia | Comentario |
|---|---|---|---|
| React Query | `staleTime` 5 min (deportivos), 10 min (noticias), `gcTime` 7 días | `apps/mobile/src/data/queries.ts:10-12, 44-47, 64-66` | Correcto para datos que cambian cada 30–60 min |
| Persistencia | AsyncStorage, clave `deporhub-query-cache`, `buster: 'data-v7'`, `maxAge` 7 días | `apps/mobile/src/data/persister.ts:6-10`, `DataProvider.tsx:29-34` | Persiste todos los documentos exitosos, incluido `squad.json` de 950 KB |
| HTTP | `fetch` con `Accept: application/json`, sin `If-None-Match` explícito | `apps/mobile/src/data/api.ts:24-31` | La revalidación depende de la caché HTTP de iOS/Android, no de la app |
| Pages | `max-age=600`, ETag, gzip | Medido con `curl` | No se pueden personalizar cabeceras en Pages; 10 min es aceptable, pero no “immutable” |

**Conclusión de transferencia:** el coste por visita es razonable para una app de aficionados, pero la home gasta **~17 veces más en miniaturas que en JSON** y la sección de escudos gasta **400 veces más en imágenes que en datos**. Ahí está la optimización real, no en migrar de almacenamiento.

---

## 3. Contratos y validación

### 3.1 Las tres representaciones

| Representación | Dónde vive | Tamaño | Generación | Validación |
|---|---|---|---:|---|
| Pydantic | `scripts/depor_hub/models.py` | 1.183 líneas | Fuente de verdad | `cli validate` valida los JSON publicados y los snapshots/fichas |
| JSON Schema | `packages/schemas/*.schema.json` | **6.898 líneas** (14 esquemas) | `cli schemas` desde Pydantic | CI comprueba `git diff --exit-code` tras regenerar |
| Zod | `apps/mobile/src/data/schemas.ts` | **1.029 líneas** | **Manual** | `contracts.test.ts` valida ejemplos y JSON publicados |

- Los 14 esquemas cubren `meta`, `standings`, `fixtures`, `squad`, `season`, `news`, `social`, `rivals`, `club`, `titles`, `rivalries`, `snapshot`, `match-detail` y `status`; hay 13 ejemplos en `packages/schemas/examples/` (1.341 líneas).
- `contracts.test.ts` comprueba que los ejemplos y los JSON reales validan, que un campo desconocido se rechaza y que los snapshots publicados validan. **No compara estructuralmente el JSON Schema con Zod**; el espejo Zod se mantiene a mano.
- `club.json`, `titles.json` y `rivalries.json` son opcionales en `validate` (404 = sin datos). La app los trata con `useOptionalData`, así que un 404 **no rompe la pantalla**, pero deja la sección vacía sin avisar.

### 3.2 Riesgos concretos del contrato

1. **Objetos estrictos + despliegue escalonado.** `Squad`, `News` y varios documentos usan `z.strictObject`. Si el servidor publica un campo aditivo antes de que el usuario actualice la app, la app antigua rechaza el documento entero (`DataError('invalid')`) y deja de mostrar datos. El test lo consagra: “un campo aditivo en un documento publicado estricto se rechaza”.
2. **Versionado grueso.** Solo `meta.json` lleva `schemaVersion: 1`; el resto se apoya en la ruta `/v1`. Un cambio incompatible exige nueva ruta o actualización simultánea de app y datos.
3. **Zod manual.** Cualquier campo nuevo en Pydantic y JSON Schema hay que replicarlo a mano en Zod; los tests detectan divergencias en ejemplos publicados, pero no todos los casos opcionales/legados.
4. **`titles.json` y `rivalries.json` no están en `origin/main`.** El contrato local y el publicado difieren; la app del árbol local no puede validarlos contra producción porque no existen.

---

## 4. Crecimiento de git y coste de publicación

### 4.1 Tamaño y actividad **[MEDIDO]**

| Métrica | Valor |
|---|---:|
| `.git` en disco | **27 MB** |
| Objetos sueltos | 3.182 / **23,68 MiB** |
| Packs | 9 / **2,42 MiB** |
| Basura detectada | 87,98 KiB |
| Commits en `main` | 420 |
| Commits en todas las ramas | 630 |
| Commits que tocan `data/` | 359 (85 %) |
| Clon espejo tras `git gc` | **4,8 MB** (pack 4,63 MiB) |
| JSON histórico comprimido | ~360 KB |
| Simulación de 500 commits no-op | 1,08 MiB de pack (~2,1 KB/commit) |

- El `.git` local está inflado por objetos sueltos y basura; un `git gc` lo dejaría en ~4,8 MB. No es un problema de disco, pero sí de higiene.
- El historial de datos es pequeño hoy (~360 KB comprimido), pero **cada commit no-op cuesta ~2,1 KB** y el ritmo actual es de ~15.000 commits/año (22 refrescos de datos/día + 18 de noticias/día, aunque no todos publican). Eso son **10–30 MB/año** empaquetados (estimación), sin contar los blobs de imágenes si crecen.
- **No es urgente**, pero corrigiendo la idempotencia se elimina la mayor fuente de ruido y se evita que el historial de datos crezca sin información.

### 4.2 Por qué se publica sin cambios **[MEDIDO]**

| Evidencia | Resultado |
|---|---:|
| Commits que tocan `squad.json` con exactamente 1 línea cambiada | **270 de 273** |
| Commits que tocan `season.json` con ≤4 líneas cambiadas | **214 de 233** |
| Ejecuciones de Data refresh (20-oct → 10-nov) | 1.672 |
| Commits `data: refresh` en el mismo periodo | 177 |
| Ejecuciones sin commit | ~89 % |

`content_hash()` ignora solo `updatedAt` y `dataHash` de primer nivel:

```python
# scripts/depor_hub/transform.py:327-335
ignored = {"updatedAt", "dataHash"}
canon = {
    name: {k: v for k, v in body.items() if k not in ignored}
    for name, body in sorted(files.items())
}
```

Pero `build_season()` escribe `capturedAt` **dentro** de `season.provenance.summary/form/positionEvolution` con el mismo `updated_at` de la ingesta (`transform.py:236-278`). Al cambiar `capturedAt`, cambia el hash, `write_if_changed()` reescribe los cinco ficheros deportivos, `meta.dataHash` cambia y el workflow hace commit. El `squad.json` solo cambia en su `updatedAt`: de ahí los 270 commits de una línea.

**Impacto operativo:** cada pasada “vacía” genera commit, despliegue completo de Pages (3,86 MB de artefacto), invalidación de la caché de 10 min y ruido en el historial. El coste de Actions no es el problema principal; el problema es que no se puede distinguir un cambio real de uno de reloj.

---

## 5. Calidad de datos

### 5.1 Cobertura verificada en el árbol local **[MEDIDO]**

| Campo / colección | Cobertura | Comentario |
|---|---:|---|
| `squad.players` | 28 | Plantilla completa |
| `weightKg` | **25/28** | Faltan Ede Bright, Teun Gijselhart y Jonathan Asp-Jensen |
| `marketValueEur` | **0/28** | Campo publicado siempre `null`; la ficha lo formatea pero nunca lo muestra |
| `photos` | 28/28 | 27 del CDN del club + 1 de `scdn.ovixia.app` |
| `social` | 27/28 | Teun Gijselhart sin redes públicas |
| `contractUntil` | 28/28 | — |
| `rivals.keyPlayers` | **0/19** | Todos los arrays vacíos; el contrato y la ficha de rival los admiten |
| `club.crests` | 14/14 | 13 PNG + 1 SVG; los 6 escudos históricos de rivales son otro campo y siguen `null` |
| `club.kits` | 42 grupos / 44 imágenes | Cobertura visual alta |
| `titles.editions` | 21/21 | 9 competiciones |
| `rivalries.rivalries` | 6/6 | Celta, Compostela, Oviedo, Sporting, Racing de Ferrol y Lugo |
| Conflictos de enriquecimiento | **37** | Documentados en `data/manual/squad_enrich.proposed.yml`; aplicados con `resolution` o pendientes |

### 5.2 Duplicación y deriva editorial

| Dato | `club.json` | Fichero específico | Riesgo |
|---|---|---|---|
| Títulos | `titles[]` con 21 años agrupados por competición | `titles.json` con 21 ediciones ricas (final, entrenador, plantilla) | Ambos suman 21, pero con formas distintas; no hay test que garantice que coinciden |
| Rivalidades | `rivalries[]` con **1** rivalidad (Celta) | `rivalries.json` con **6** | Deriva real: la home del club usa `club.rivalries` si `rivalries.json` falla; mostraría solo 1 |
| Escudos | `crests[]` con 14 versiones | `img/club/escudos/*` | Correcto: el contrato referencia rutas locales |
| Equipaciones | `kits[]` con 42 grupos | `img/club/equipaciones/*` (44 imágenes) | Correcto: un grupo puede tener local/alternativa |

La duplicación de títulos es intencionada (resumen vs detalle), pero **no está validada**. La de rivalidades ya está desincronizada: `club.json` solo lleva el Celta y `rivalries.json` lleva seis.

### 5.3 Frescura y fuentes

- `news.json` de producción: 150 historias, 117 con miniatura, última `publishedAt` 2026-11-10T14:55Z, `updatedAt` 2026-11-10T15:04Z. Correcto para el corte.
- `club.json` de producción: `updatedAt` 2026-11-01T10:14Z; es datos editoriales, no un feed horario. No es un fallo, pero conviene documentar la cadencia editorial.
- `social.json`: `updatedAt` 2026-10-31, 3 perfiles y 0 pins. **No se consume** (`useSocial` solo está definido; no hay ninguna pantalla que lo llame).
- `rivals.json`: 19 rivales, 0 con `keyPlayers`, todos con `headToHead`. El dato está, pero el campo de jugadores clave no se rellena.

---

## 6. Alternativas de almacenamiento y publicación

### 6.1 Comparativa con coste cero

| Alternativa | Coste | Límites gratuitos relevantes | Ventajas | Inconvenientes | Encaje hoy |
|---|---|---|---|---|---|
| **JSON + GitHub Pages (actual)** | 0 € | 1 GB de sitio; 100 GB/mes blando; 10 builds/h salvo Actions | Ya funciona; git como historial; sin servidor; ETag/gzip/304; deploy atómico | Sin consultas; documentos completos; cabeceras fijas de 10 min; commits de datos | **Óptimo para el tamaño actual** |
| **JSON particionado + Pages** | 0 € | Los mismos | `squad` resumen + `players/{id}.json`; `news` resumen; imágenes WebP; menos bytes por pantalla | Más ficheros y un paso de generación; hay que versionar el manifest | **Recomendado a corto plazo** |
| Cloudflare Pages + R2 | 0 € dentro de límites | Pages: 20.000 ficheros, 25 MiB/fichero, 500 builds/mes; R2: 10 GB, 1 M Class A, 10 M Class B, egreso gratis | CDN potente; egreso gratis; cabeceras personalizables; imágenes aparte | Otro proveedor, tokens, dominios, dos despliegues; sobredimensionado para 3,86 MB | Solo si crece el tráfico o las imágenes |
| Supabase Free | 0 € | 500 MB de base; pausa tras una semana de inactividad | Postgres, consultas, auth, storage | Latencia y cold start; pausa; no aporta nada a un catálogo de solo lectura | No |
| Turso Free | 0 € | 5 GB; 500 M filas leídas/mes | SQLite edge, lecturas rápidas | Necesita API/Worker y token; migrar contratos y pipeline | No |
| Cloudflare D1 | 0 € | 5 M filas leídas/día; 100 K escritas/día; 5 GB | SQL junto a Worker; buena integración si hay API | Requiere Worker y modelo relacional; pierde el “JSON inspeccionable en git” | No |
| GitHub Releases / jsDelivr para imágenes | 0 € | CDN gratuito con límites de uso aceptable | Descarga binarios del historial; CDN | Gestión de releases; no simplifica el dato | Solo como plan B de imágenes |

### 6.2 Por qué no migrar hoy

- **Capacidad:** 3,86 MB de sitio y ~100 KB de JSON por visita están muy por debajo de los límites gratuitos (1 GB de sitio y 100 GB/mes).
- **Complejidad:** una base de datos añade credenciales, backups, migraciones, errores de red y un runtime que hoy no existe. El pipeline actual es reproducible con `git` y `curl`.
- **Naturaleza del dato:** es un catálogo de solo lectura, regenerado por lotes, sin escrituras de usuario ni consultas ad hoc. JSON estático es el formato natural.
- **Coste de salida:** migrar ahora obligaría a reescribir Zod, Pydantic, los workflows y la caché de la app para resolver un problema que se arregla con un hash y unas imágenes.

### 6.3 Cuándo revisar la decisión

| Disparador | Umbral orientativo | Acción |
|---|---:|---|
| Tráfico mensual | >50 GB/mes o p95 de home >2 s | Cloudflare delante de Pages o R2 para imágenes |
| Tamaño del sitio | >500 MB o >5.000 ficheros | Particionar más o mover binarios a R2 |
| Documento mayor | >2 MB o >150 KB gzip | Partir por entidad (`players/{id}`, `news/{id}`) |
| Necesidad de escritura | Cualquier escritura de usuario o panel editorial | Worker + D1/Supabase/Turso |
| Consultas | Búsquedas/filtros que no quepan en un JSON | Índice estático o base de datos |
| Frecuencia | >1.000 commits/mes o >100 MB/año de historial | Rama de datos separada o publicación por artefacto |

---

## 7. Hallazgos

### [D1-01] `main` local y producción están desincronizados; `titles.json` y `rivalries.json` no existen en Pages

**Área:** Publicación / integridad del artefacto
**Severidad:** Alta
**Tipo de evidencia:** Medido + Confirmado

**Evidencia:**
- `git rev-list --left-right --count main...origin/main` → `23 159`.
- `git ls-tree origin/main data/public/v1/` no incluye `titles.json` ni `rivalries.json`; el árbol local sí.
- `curl -o /dev/null -w '%{http_code}' https://angelvilarino.github.io/depor-hub/v1/titles.json` → **404**; ídem `rivalries.json`.
- `origin/main` está en `75ebe6e` (2026-11-10 15:04 UTC); el HEAD local es `5759480` (2026-11-08).
- Los 23 commits locales no tienen ejecución de CI asociada (Fase 5).

**Qué ocurre:** el trabajo de club ampliado (títulos, rivalidades y la capa editorial de club) está en el árbol local y en `data/public`, pero no en `origin/main` ni en la copia publicada. La app del árbol local sí llama a `useTitles`/`useRivalries`; si se ejecuta contra producción, recibe 404, los trata como “sin datos” y muestra secciones vacías sin error visible. La app publicada desde `origin/main` ni siquiera incluye ese código.

**Causa raíz:** la rama local quedó 23 commits por delante y 159 por detrás; no se rebasó/mergeó antes de seguir trabajando. El bot de datos siguió avanzando `origin/main`, y el despliegue de Pages solo publica lo que está en `origin/main`.

**Impacto:** el contrato local y el publicado divergen; cualquier verificación manual en producción da falsos negativos; la funcionalidad de títulos/rivalidades no llega a los usuarios; el trabajo local no pasa por CI. Es un riesgo de “funciona en mi máquina” a nivel de datos y de release.

**Recomendación:** rebasar `main` sobre `origin/main`, resolver los conflictos de datos, abrir PR, dejar que CI valide y desplegar. Añadir un *smoke test* post-deploy que compruebe `200` y el `dataHash` esperado de cada fichero del contrato, incluidos los opcionales. Mientras no se publique, no usar producción como referencia de aceptación.

**Alternativas:** (a) publicar los 23 commits tal cual; (b) dividir el trabajo en un PR de datos y otro de app; (c) dejar `titles/rivalries` fuera del contrato hasta que estén en `origin/main`. Recomendada: (b), con el smoke test.

**Esfuerzo:** M
**Riesgo:** Medio (conflictos en `club.json`, `schemas.ts` y `models.py`)
**Dependencias:** CI, Pages y la decisión de si los títulos/rivalidades entran en el próximo release.

---

### [D1-02] El hash de contenido no ignora `capturedAt` anidado y provoca commits/despliegues vacíos

**Área:** Publicación / idempotencia
**Severidad:** Alta
**Tipo de evidencia:** Medido + Confirmado

**Evidencia:**
- `scripts/depor_hub/transform.py:327-335`: `ignored = {"updatedAt", "dataHash"}` solo elimina claves de primer nivel.
- `scripts/depor_hub/transform.py:236-278`: `build_season()` escribe `captured_at=updated_at` en `summary`, `form` y `positionEvolution`.
- `scripts/depor_hub/cli.py:139-147`: la ingesta calcula `content_hash(files)` y publica si cambia.
- `scripts/depor_hub/publish.py:24-50`: `write_if_changed()` compara `meta.dataHash` y reescribe los cinco ficheros deportivos.
- **270 de 273** commits que tocan `squad.json` cambian exactamente 1 línea; **214 de 233** de `season.json` cambian ≤4 líneas.
- 1.672 ejecuciones de Data refresh frente a 177 commits `data: refresh` (~89 % de ejecuciones sin commit).

**Qué ocurre:** cada pasada real de ingesta cambia `updatedAt` y, sobre todo, los tres `capturedAt` de `season.provenance`. El hash cambia, se reescriben los cinco JSON, `meta.dataHash` cambia y el bot hace commit. El contenido deportivo es idéntico; solo cambia el reloj.

**Causa raíz:** el hash se diseñó para ignorar marcas de tiempo, pero solo las de primer nivel. `capturedAt` se añadió después dentro de `provenance` y quedó fuera de la lista de exclusión. El test de `content_hash` no cubre ese caso anidado.

**Impacto:** commits y despliegues de Pages innecesarios, historial de git ruidoso, invalidación de caché cada hora, dificultad para distinguir cambios reales y crecimiento de artefactos. No rompe datos, pero degrada la operación y la confianza en el historial.

**Recomendación:** normalizar el hash: excluir `capturedAt`/`generatedAt` en cualquier profundidad, o separar las marcas de tiempo en un bloque `_meta` que no se hashee. Añadir un test de idempotencia que ejecute la ingesta dos veces con el mismo raw y exija `changed=false` y ausencia de diferencias en `git diff`. Mantener `updatedAt` como metadato de publicación, no como contenido.

**Alternativas:** (a) ignorar solo `capturedAt` anidado; (b) mover todas las marcas a un campo no hasheado; (c) comparar los JSON normalizados antes de escribir. Recomendada: (b), con test de dos pasadas.

**Esfuerzo:** S
**Riesgo:** Bajo (cambio localizado en `transform.py` y tests)
**Dependencias:** ninguno; conviene hacerlo antes de D1-08.

---

### [D1-03] `squad.json` es monolítico: 950 KB y el 51 % es historial que la lista no usa

**Área:** Modelo de datos / rendimiento
**Severidad:** Media
**Tipo de evidencia:** Medido

**Evidencia:**
- `squad.json`: **950.390 B** (54.982 B gzip), 77,4 % del JSON raíz y 55,3 % del gzip total.
- `deporMatches` 485.084 B (51,0 %), `career` 72.483 B (7,6 %), `provenance` 30.211 B (3,2 %).
- La lista de equipo solo necesita id, nombre, dorsal, posición, foto y poco más; un resumen medido cabe en **~3,1 KB gzip**.
- `apps/mobile/app/(tabs)/team.tsx:185` llama a `useSquad()` y filtra en cliente; `apps/mobile/src/data/queries.ts:99` descarga el documento completo.

**Qué ocurre:** para pintar 28 filas, la app descarga y valida 950 KB; el historial de 22 partidos y 10 temporadas por jugador solo se usa al abrir la ficha individual. La caché persistida también guarda el documento completo.

**Causa raíz:** el contrato `Squad` se diseñó como una foto completa de la plantilla, sin separar “lista” de “detalle”. El crecimiento del enriquecimiento (partidos, carrera, procedencia) hizo el resto.

**Impacto:** primera carga de equipo más lenta y más cara; parseo Zod de 950 KB; más presión sobre AsyncStorage; la ficha individual no puede cachear por jugador. En una red móvil lenta, la diferencia entre 3 KB y 55 KB gzip es perceptible.

**Recomendación:** publicar `squad.json` como resumen (28 jugadores, campos de lista, URL de ficha) y `players/{id}.json` con `deporMatches`, `career`, `careerTotals`, `provenance` y fotos. La ficha usa `usePlayer(id)`; la lista usa `useSquad()`. Mantener `squad.json` compatible durante una versión.

**Alternativas:** (a) partir solo `deporMatches`; (b) dejar `squad` y añadir un `squad-summary.json`; (c) usar GraphQL/DB (descartado). Recomendada: (b) para migración sin ruptura, luego (a).

**Esfuerzo:** M
**Riesgo:** Medio (nuevo contrato, caché y tests)
**Dependencias:** D1-07 (versionado) y D1-15 (persistencia).

---

### [D1-04] Los 13 escudos PNG pesan 2,32 MB y se muestran a 92 px

**Área:** Imágenes / transferencia
**Severidad:** Media
**Tipo de evidencia:** Medido

**Evidencia:**
- `img/club/escudos`: 13 PNG = **2.318.669 B**; el mayor, `1910.png`, 289.361 B y 381×512 px; todos a ~512 px de alto.
- `2026.svg` = 55.456 B; el total de escudos = 2.374.125 B (94 % de `img/`); solo los 13 PNG ya son el 92 %.
- `EscudoSection.tsx:39-43` hace `club.crests.map(...)` dentro de un `ScrollView`; `ClubImage` monta un `expo-image` por escudo, sin virtualización.
- Conversión medida a WebP 128 px, calidad 82: **69.998 B** para los 13 (-97,0 %).
- La sección se pinta a 92×92 px (`EscudoSection.tsx:64-65`); el modal usa hasta 640 px, pero solo para una imagen.

**Qué ocurre:** al abrir la sección de escudos se descargan 2,32 MB de PNG para mostrar 14 miniaturas; en pantallas 3x, 92 px lógicos equivalen a ~276 px físicos, así que 128 px se queda corto, pero 256 px sigue siendo una fracción del PNG original.

**Causa raíz:** las imágenes se incorporaron como PNG a resolución completa (512 px) sin generar variantes responsive ni convertirlas a un formato moderno. El contrato apunta a un único fichero por escudo.

**Impacto:** sección de escudos lenta en 3G/4G; consumo de datos desproporcionado; el 65 % del peso del sitio son imágenes y casi todo es este bloque. No afecta a la home, pero sí a la percepción de calidad.

**Recomendación:** generar WebP/AVIF a 256 px y 128 px (o 192 px) con `cwebp`/`sharp`, mantener PNG solo como fallback si se necesita, y publicar `srcset`/variantes en el contrato (`image`, `imageSmall`). Para el modal, cargar la variante grande bajo demanda. Medir el resultado con el mismo pipeline y fijar un presupuesto (<300 KB para los 13 escudos).

**Alternativas:** (a) WebP 256; (b) AVIF 256; (c) mantener PNG y usar un CDN de imágenes. Recomendada: (a) por compatibilidad con Expo/Android y ahorro suficiente.

**Esfuerzo:** M
**Riesgo:** Bajo (pérdida visual mínima a 256 px)
**Dependencias:** pipeline de `club-images`, contrato `club.json` y tests de rutas.

---

### [D1-05] La home descarga 150 historias y 578 KB de miniaturas para mostrar 5 titulares

**Área:** Transferencia / noticias
**Severidad:** Media
**Tipo de evidencia:** Medido

**Evidencia:**
- `news.json`: 107.828 B en local (25.109 B gzip en producción), 150 historias, 117 con `thumbnailUrl` en producción.
- Home: `useNews()` descarga el documento completo; `HeadlinesBlock` selecciona `HOME_HEADLINES` (5) y pinta 5 imágenes.
- Medición de las 5 primeras miniaturas de producción (2026-11-11): **149.177 + 115.847 + 118.783 + 110.884 + 83.598 = 578.289 B**.
- Las imágenes se sirven desde `riazor.org`, `dxtcampeon-imagenes.elidealgallego.com`, `ytimg.com`, etc., sin proxy ni redimensionado; algunas son de 1600×900.
- Home en frío: 33.976 B de JSON + 578.289 B de imágenes = **~612 KB**.

**Qué ocurre:** la home necesita 5 titulares, pero descarga y valida las 150 historias y luego carga miniaturas de tamaño original alojadas en medios externos. El JSON es aceptable; las imágenes no.

**Causa raíz:** el contrato `News` es un feed completo y la home reutiliza el mismo documento que la pestaña de noticias. No hay variante de miniatura ni proxy de imágenes; se confía en la URL original del medio.

**Impacto:** la home es la pantalla más visitada y la más pesada en imágenes; depende de la disponibilidad y del WAF de terceros; el tiempo de carga y el consumo de datos se disparan en móvil. Además, un cambio de URL en el medio rompe la miniatura sin aviso.

**Recomendación:** publicar `news-home.json` (o `news-summary.json`) con las 20–30 historias más recientes y una miniatura ya redimensionada (p. ej. 640×360 WebP/JPEG, <60 KB). La pestaña de noticias puede seguir usando `news.json`. Si no se quiere alojar binarios, usar un proxy de imágenes con caché (Cloudflare Worker/Image Resizing) o elegir la variante pequeña que ofrezca cada medio. Añadir `width`/`height` al contrato para evitar saltos de layout.

**Alternativas:** (a) `news-home.json` + miniaturas locales; (b) proxy de imágenes; (c) cargar solo 5 historias y mantener el resto bajo demanda. Recomendada: (a) + (c).

**Esfuerzo:** M
**Riesgo:** Medio (dependencia de terceros y licencias)
**Dependencias:** D1-13 (caché de imágenes) y pipeline de noticias.

---

### [D1-06] Documentos y campos muertos: `social.json`, `keyPlayers`, `marketValueEur` y `provenance`

**Área:** Calidad de contrato / peso
**Severidad:** Media
**Tipo de evidencia:** Medido + Confirmado

**Evidencia:**
- `social.json` (645 B) se genera y se valida, pero `useSocial` (`queries.ts:103`) **no tiene ningún consumidor** en `app/` ni `src/`.
- `rivals[].keyPlayers`: **0/19** arrays con contenido; el contrato (`schemas.ts:210`) los admite, pero no hay ninguna UI que los pinte.
- `squad[].marketValueEur`: **0/28** con valor; la ficha lo formatea (`app/player/[id].tsx:315`) pero nunca se muestra.
- `squad[].provenance`: 30.211 B; `provenanceSummary()` (`features/squad/logic.ts:490`) no se usa fuera de tests.
- `club.titles` y `club.rivalries` duplican parcialmente `titles.json`/`rivalries.json` (ver D1-09).

**Qué ocurre:** se mantienen contratos, validaciones, tests y bytes para datos que la UI no usa o que siempre están vacíos. El coste no es solo de transferencia: también es de evolución (cada campo hay que espejarlo en Pydantic, JSON Schema y Zod).

**Causa raíz:** el contrato creció por hipótesis de producto (valor de mercado, jugadores clave, redes) sin una pantalla que los consumiera o sin una fuente fiable que los rellenara.

**Impacto:** deuda de contrato y ruido; los tests validan campos irrelevantes; los datos vacíos pueden dar una falsa impresión de cobertura. `social.json` añade un documento y una consulta opcional que nunca se ejecuta.

**Recomendación:** decidir por campo: (a) eliminar `social.json` y `useSocial` si no hay UI; (b) eliminar `keyPlayers` o poblarlo con fuente y mostrarlo; (c) eliminar `marketValueEur` o conseguir una fuente lícita; (d) usar `provenanceSummary()` en la ficha o dejar de publicar `provenance` completo. Documentar la decisión en el ADR de contrato.

**Alternativas:** (a) limpieza inmediata; (b) mantener campos vacíos por compatibilidad; (c) marcarlos como `deprecated` y retirarlos en `/v2`. Recomendada: (a) para `social` y `marketValue`; (b) para `keyPlayers` hasta tener fuente.

**Esfuerzo:** S
**Riesgo:** Bajo (cambios de contrato aditivos/eliminación de opcionales)
**Dependencias:** D1-07 y decisión de producto.

---

### [D1-07] Triple esquema mantenido a mano: Pydantic, JSON Schema y Zod

**Área:** Contratos / mantenibilidad
**Severidad:** Media
**Tipo de evidencia:** Confirmado + Medido

**Evidencia:**
- `scripts/depor_hub/models.py`: 1.183 líneas; `packages/schemas/*.schema.json`: **6.898 líneas** en 14 esquemas; `apps/mobile/src/data/schemas.ts`: **1.029 líneas**.
- `cli schemas` genera JSON Schema desde Pydantic (`cli.py:819-835`); CI regenera y exige `git diff --exit-code` (`ci.yml:49-53`).
- Zod es manual; `contracts.test.ts:31-58` valida ejemplos y JSON publicados, pero no compara la estructura del JSON Schema con Zod.
- Los objetos son estrictos: `contracts.test.ts` afirma explícitamente que un campo aditivo se rechaza.

**Qué ocurre:** Pydantic y JSON Schema están sincronizados por generación; Zod no. Un campo nuevo puede pasar Pydantic, generar JSON Schema y romper la app porque Zod no lo conoce o porque el objeto estricto lo rechaza. La actualización escalonada (datos nuevos + app antigua) es el caso más peligroso.

**Causa raíz:** se eligió Zod manual para tener inferencia TypeScript y validación en runtime, sin un generador desde JSON Schema. El versionado es global (`/v1`, `meta.schemaVersion`), no por documento.

**Impacto:** riesgo de deriva silenciosa; tests que solo cubren ejemplos; un despliegue de datos puede invalidar la app instalada. El coste de mantener tres representaciones crece con cada campo.

**Recomendación:** generar Zod desde JSON Schema (o desde un esquema único) y añadir un test que compare ambos; mientras tanto, usar `.passthrough()` o campos opcionales para evoluciones aditivas y reservar `strict` para los documentos que deban cerrarse. Versionar por documento (`schemaVersion` en la raíz) o publicar `/v2` ante rupturas.

**Alternativas:** (a) generar Zod; (b) generar JSON Schema desde Zod y Pydantic desde JSON Schema; (c) mantener el espejo manual con test estructural. Recomendada: (a) a corto plazo, (b) a medio.

**Esfuerzo:** M–L
**Riesgo:** Medio (cambio de herramienta y de tests)
**Dependencias:** D1-03 y D1-09.

---

### [D1-08] El historial de git y los despliegues crecen por commits de datos sin información

**Área:** Almacenamiento / operación
**Severidad:** Baja (mejora)
**Tipo de evidencia:** Medido

**Evidencia:**
- `.git`: **27 MB**; 3.182 objetos sueltos = 23,68 MiB; 9 packs = 2,42 MiB; 87,98 KiB de basura.
- Clon espejo tras `git gc`: **4,8 MB** (pack 4,63 MiB).
- 630 commits totales; 420 en `main`; 359 tocan `data/` (85 %).
- JSON histórico comprimido: ~360 KB.
- Simulación de 500 commits no-op: **1,08 MiB** de pack (~2,1 KB/commit).
- Cada deploy sube el snapshot completo de `data/public` (3,86 MB) como artefacto de Pages.

**Qué ocurre:** el historial no es grande hoy, pero está dominado por commits de datos; la mayoría de los recientes no aportan información (D1-02). El `.git` local está además inflado por objetos sueltos y basura, no por el pack real.

**Causa raíz:** commits automáticos cada hora/día sin deduplicación efectiva, más un `.git` local sin `gc` reciente. El flujo de publicación trata cada escritura como un evento, no como un cambio de contenido.

**Impacto:** ruido en `git log`, más tiempo de clon/fetch, más artefactos de Pages y dificultad para auditar cambios reales. A 10–30 MB/año no es un problema de disco, pero sí de señal/ruido.

**Recomendación:** corregir D1-02 (elimina la mayoría de commits), ejecutar `git gc` periódicamente y, si el volumen crece, publicar datos desde una rama dedicada o un artefacto en vez de acumularlos en `main`. No hace falta LFS para 2,5 MB de imágenes.

**Alternativas:** (a) `git gc` + fix de hash; (b) rama `data` separada; (c) commits squash de datos. Recomendada: (a) ahora; (b) si se superan ~1.000 commits/mes.

**Esfuerzo:** S (a) / M (b)
**Riesgo:** Bajo
**Dependencias:** D1-02.

---

### [D1-09] Títulos y rivalidades tienen dos contratos solapados y ya divergen

**Área:** Calidad de datos / contrato
**Severidad:** Media
**Tipo de evidencia:** Medido

**Evidencia:**
- `club.json` → `titles[]`: 9 competiciones, 21 años agrupados; `titles.json` → `editions[]`: 21 ediciones con final, entrenador, plantilla y procedencia.
- `club.json` → `rivalries[]`: **1** (Celta); `rivalries.json` → **6** (Celta, Compostela, Oviedo, Sporting, Racing de Ferrol, Lugo).
- `apps/mobile/app/(tabs)/club.tsx:46` usa `useClub()` y `useRivalries()`; `sectionBadge` recurre a `rivalriesQuery.data?.rivalries.length ?? club.rivalries.length`.
- No hay test que compare `club.titles` con `titles.editions` ni `club.rivalries` con `rivalries.rivalries`.

**Qué ocurre:** la misma información vive en dos sitios con formas distintas. Los títulos coinciden en número (21) pero no hay garantía; las rivalidades ya no coinciden (1 vs 6). Si `rivalries.json` falla o no está publicado, la app muestra solo el Celta.

**Causa raíz:** `club.json` se diseñó como resumen editorial y `titles/rivalries` como detalle; no se estableció una fuente única ni una validación de consistencia.

**Impacto:** deriva de datos y UI incoherente; en cuanto se publique la app local sin `rivalries.json`, el fallback será el camino real y los usuarios verán una lista incompleta de rivalidades sin saberlo.

**Recomendación:** declarar `titles.json`/`rivalries.json` como fuente única y generar el resumen de `club.json` a partir de ellos en el pipeline; o eliminar el resumen duplicado y hacer que la app use siempre los documentos específicos. Añadir un test que compare conteos, años y nombres.

**Alternativas:** (a) fuente única + resumen generado; (b) eliminar `club.titles/rivalries`; (c) mantener ambos con test de consistencia. Recomendada: (a).

**Esfuerzo:** S–M
**Riesgo:** Medio (cambia la generación de `club.json`)
**Dependencias:** D1-01 y D1-07.

---

### [D1-10] Completitud: 3 pesos, 6 escudos históricos y 37 conflictos sin resolver

**Área:** Calidad de datos
**Severidad:** Media
**Tipo de evidencia:** Medido + Confirmado

**Evidencia:**
- `squad.json`: `weightKg` 25/28; faltan Ede Bright, Teun Gijselhart y Jonathan Asp-Jensen.
- `marketValueEur` 0/28; `keyPlayers` 0/19.
- `club.crests` 14/14, pero los 6 escudos históricos de rivales de Segunda B (Covadonga, Linares, SD Logroñés, San Fernando CD, UD Logroñés y Zamora) siguen `null` (documentado en `docs/ESTADO.md`).
- **37 conflictos** en `data/manual/squad_enrich.proposed.yml`; los aplicados llevan `applied` + `resolution`, los no aplicados quedan sin valor.
- `docs/sources.md:217`: ejecución `enrich --apply --offline` sobre 28 jugadores → 0 errores, 37 conflictos.

**Qué ocurre:** el dato es honesto (no se inventa), pero hay huecos visibles y conflictos que requieren revisión manual. La UI muestra “pendiente” o simplemente omite el campo.

**Causa raíz:** fuentes gratuitas incompletas o contradictorias; el pipeline aplica solo lo que puede contrastar y deja el resto en `null`. No hay una cola de revisión priorizada.

**Impacto:** la ficha de tres jugadores queda incompleta; los rivales históricos muestran monograma; los 37 conflictos pueden contener errores de dorsal, peso o contrato. Afecta a la percepción de rigor, no a la estabilidad técnica.

**Recomendación:** priorizar los 3 pesos y los 6 escudos con fuente oficial; revisar los 37 conflictos y cerrar los que tengan fuente; añadir un informe de cobertura por campo en CI (sin bloquear) y un `TODO` con responsable. Para lo que no tenga fuente lícita, dejar de publicar el campo en vez de un `null` permanente.

**Alternativas:** (a) completar con fuente; (b) eliminar campos sin fuente; (c) mantener `null` y documentar. Recomendada: (a) para pesos/escudos; (b) para `marketValueEur`.

**Esfuerzo:** M
**Riesgo:** Bajo (datos, no código)
**Dependencias:** fuentes oficiales y revisión manual.

---

### [D1-11] Dos YAML generados de 1,52 MB y 37 conflictos se versionan en `main`

**Área:** Almacenamiento / pipeline editorial
**Severidad:** Media
**Tipo de evidencia:** Medido + Confirmado

**Evidencia:**
- `data/manual/squad_enrich.proposed.yml`: **798.008 B**; `data/manual/squad_extras.yml`: **723.483 B**; juntos son el **94 %** de todo el YAML del repo (Fase 0).
- `squad_extras.yml` es **salida generada**; los datos manuales viven en `squad_overrides.yml` (5.037 B), según `docs/ESTADO.md:133`.
- 37 conflictos visibles en `squad_enrich.proposed.yml`.
- `docs/ESTADO.md:308` deja la revisión de los 37 conflictos como pendiente.

**Qué ocurre:** se versionan dos ficheros grandes, uno de ellos generado, que se regeneran con frecuencia y contienen los datos que acaban en `squad.json`. El riesgo de editar el fichero equivocado es real: el generador puede pisar cambios manuales.

**Causa raíz:** el pipeline escribe la propuesta y los extras dentro de `data/manual/`, y se decidió commitearlos para tener historial y revisión. No hay una separación clara entre “entrada manual” y “artefacto generado”.

**Impacto:** crecimiento de git, diffs enormes, confusión sobre la fuente de verdad y riesgo de perder correcciones. No afecta al payload publicado, pero sí al mantenimiento.

**Recomendación:** versionar solo `squad_overrides.yml` y las fuentes; generar `squad_extras.yml`/`squad_enrich.proposed.yml` en CI y publicarlos como artefacto (o en una rama `generated`). Si se necesitan en el repo, comprimirlos o moverlos a `data/generated/` con una cabecera inequívoca y un test que detecte ediciones manuales.

**Alternativas:** (a) artefacto de CI; (b) rama generada; (c) mantener pero con `git diff` acotado. Recomendada: (a).

**Esfuerzo:** M
**Riesgo:** Medio (cambia el flujo de enriquecimiento)
**Dependencias:** pipeline `enrich` y workflows.

---

### [D1-12] Retratos de jugador: `-large` de ~1,1 MB en la vista por defecto y HEIC del CDN

**Área:** Imágenes / rendimiento
**Severidad:** Media
**Tipo de evidencia:** Medido + Inferido

**Evidencia:**
- 27/28 fotos apuntan a `cdn.bff.rcdeportivo.app` con URL `-large`; 1 a `scdn.ovixia.app`.
- `HEAD` de `328414-large?v=21`: `content-type: image/heic`, `content-length: 1.168.147`; otra: 1.131.800; otra: 1.260.816. La variante `-small` del mismo jugador: **42.870 B**, también HEIC.
- `apps/mobile/src/components/PlayerPortrait.tsx:19-25` reescribe `-large` → `-small` solo si se pide `quality="small"`.
- `apps/mobile/app/(tabs)/team.tsx:80` usa `quality="large"` en la vista `grid`; `settings.ts:66` define `squadView: 'grid'` por defecto.
- `team.tsx:131` usa `quality="small"` en la vista lista.

**Qué ocurre:** la vista por defecto de la plantilla es una rejilla con retratos `-large` de ~1,1 MB. Con `initialNumToRender` por defecto (10) y 2 columnas, la primera ventana puede descargar hasta ~11 MB; el dato exacto en dispositivo **no se ha medido**. La variante `-small` de 43 KB existe y se usa en la lista y en `PlayerRow`.

**Causa raíz:** se eligió `large` para la rejilla priorizando nitidez, sin tener en cuenta que el CDN sirve HEIC de más de 1 MB y que el contenedor es de 88 px. No hay redimensionado en servidor ni variante intermedia.

**Impacto:** primera carga de equipo muy pesada en datos móviles; posible decodificación HEIC costosa o no soportada en algún Android/web; dependencia de un CDN externo y de su licencia editorial. La lista (40 px) es mucho más eficiente.

**Recomendación:** usar `-small` (o una variante de 256 px) en la rejilla; reservar `-large` para la ficha y el modal. Si el CDN admite parámetros de ancho, solicitarlos; si no, generar una variante propia WebP/JPEG. Verificar decodificación HEIC en Android real y añadir fallback a `PlayerAvatar`. Medir el tiempo de carga y el tamaño con un dispositivo/emulador.

**Alternativas:** (a) `-small` en grid; (b) variante 256 WebP; (c) proxy de imágenes. Recomendada: (a) inmediata, (b) si se quiere nitidez.

**Esfuerzo:** S
**Riesgo:** Bajo (cambio de URL/variante)
**Dependencias:** CDN del club y licencia de las fotos.

---

### [D1-13] Caché HTTP correcta pero sin URLs versionadas ni revalidación explícita

**Área:** Caché / transferencia
**Severidad:** Baja
**Tipo de evidencia:** Medido + Confirmado

**Evidencia:**
- Pages responde `Cache-Control: max-age=600`, `ETag`, `Vary: Accept-Encoding` y gzip; `If-None-Match` devuelve **304, 0 bytes** para `squad.json`.
- Las imágenes también responden `max-age=600`, aunque sus nombres (`1910.png`, `2026.svg`) no cambian.
- `apps/mobile/src/data/api.ts:24-31` no envía `If-None-Match`; solo `Accept`.
- React Query usa `staleTime` 5/10 min y `gcTime` 7 días; la caché HTTP del sistema puede revalidar, pero no está garantizado en React Native.

**Qué ocurre:** el ETag funciona, pero la app no lo usa explícitamente; las imágenes no llevan hash de contenido, así que no se pueden cachear “para siempre”. Cada 10 minutos se revalida o se descarga de nuevo según la plataforma.

**Causa raíz:** GitHub Pages no permite personalizar cabeceras y el contrato de imágenes usa rutas estables sin versión. La app delega en la caché del sistema.

**Impacto:** más peticiones de las necesarias y peor rendimiento en redes lentas; no es un problema grave con 100 KB de JSON, pero sí con 2,3 MB de escudos si se repiten.

**Recomendación:** añadir versión/hash a las rutas de imágenes (`escudos/1910.<hash>.webp`) y cachear de forma agresiva; para JSON, usar `If-None-Match` explícito o confiar en la caché persistida de React Query. Si se necesita control de cabeceras, poner Cloudflare delante de Pages.

**Alternativas:** (a) versionar rutas; (b) proxy/CDN; (c) mantener y ajustar `staleTime`. Recomendada: (a).

**Esfuerzo:** S
**Riesgo:** Bajo
**Dependencias:** D1-04 y pipeline de imágenes.

---

### [D1-14] La home descarga los 19 rivales completos para mostrar un solo oponente

**Área:** Modelo de datos / rendimiento
**Severidad:** Baja
**Tipo de evidencia:** Medido + Confirmado

**Evidencia:**
- `rivals.json`: 42.244 B en local (3.958 B gzip en producción), 19 rivales con `headToHead`, `meetings`, `facts`, etc.
- `apps/mobile/app/(tabs)/index.tsx:46` llama a `useRivals()`; la home solo usa el rival del próximo partido.
- La ficha de rival también usa `useRivals()` para buscar por id.

**Qué ocurre:** la home descarga y valida 19 rivales completos para pintar la tarjeta del próximo oponente. El 59 % del fichero es `rivals[]`, y dentro de cada rival el `headToHead` con meetings es lo más pesado.

**Causa raíz:** `rivals.json` es un catálogo único para home y fichas; no hay endpoint de “rival por id” ni resumen.

**Impacto:** 4 KB gzip no es crítico, pero es trabajo de parseo y datos que no se usan. Se suma a la home (33.976 B) y a la caché persistida.

**Recomendación:** publicar `rivals-summary.json` (id, nombre, escudo, balance resumido) para la home, o incluir el oponente mínimo en `fixtures.json`. La ficha usa `rivals/{id}.json` o el catálogo completo bajo demanda.

**Alternativas:** (a) resumen; (b) incluir oponente en fixtures; (c) dejar como está. Recomendada: (b), es el menor cambio.

**Esfuerzo:** S
**Riesgo:** Bajo
**Dependencias:** D1-03 (mismo patrón de partición).

---

### [D1-15] La caché persistida guarda el `squad.json` completo y podría penalizar el arranque

**Área:** Persistencia / rendimiento
**Severidad:** Baja (hipótesis)
**Tipo de evidencia:** Hipótesis + No medido

**Evidencia:**
- `apps/mobile/src/data/DataProvider.tsx:29-34`: `PersistQueryClientProvider` con `maxAge` de 7 días y `shouldDehydrateQuery` para toda consulta exitosa.
- `apps/mobile/src/data/persister.ts:6-10`: AsyncStorage, clave `deporhub-query-cache`, throttle 1 s.
- Documentos persistibles: `squad` 950.390 B + `news` 107.828 B + `club` 47.411 B + `rivals` 42.244 B + resto ≈ **1,2 MB** de JSON, más la envoltura de React Query.
- No se ha medido el tamaño real de la clave en un dispositivo ni el tiempo de hidratación.

**Qué ocurre:** al arrancar, React Query rehidrata todos los documentos exitosos, incluido el `squad` completo. En Android, AsyncStorage tiene un límite por defecto de 6 MB (configurable); la lectura es asíncrona, pero el parseo del JSON se hace en el hilo JS. Con 1,2 MB no debería fallar, pero puede añadir latencia.

**Causa raíz:** se persiste el documento completo en vez de un subconjunto de arranque; no hay presupuesto de tamaño ni medición de hidratación.

**Impacto:** arranque más lento y escrituras agrupadas cada 1 s tras cada actualización; si el `squad` crece, el límite de AsyncStorage puede convertirse en un fallo real. **No verificado**: no se ha medido en dispositivo.

**Recomendación:** medir `AsyncStorage.getItem('deporhub-query-cache')` y el tiempo de hidratación en iOS/Android; persistir solo `meta`, `standings`, `fixtures`, `season`, `news-summary` y el resumen de plantilla; dejar el detalle de jugador en caché en memoria. Si se mantiene el `squad` completo, dividirlo (D1-03).

**Alternativas:** (a) persistencia selectiva; (b) dividir `squad`; (c) usar SQLite/MMKV. Recomendada: (a) + (b).

**Esfuerzo:** S
**Riesgo:** Bajo
**Dependencias:** D1-03 y medición en dispositivo.

---

## 8. Recomendación final

**Mantener el modelo actual: JSON estático versionado en git + GitHub Pages.** Es óptimo para este proyecto hoy: coste cero, sin servidor, historial auditable, ETag/gzip/304, y 3,86 MB de sitio frente a 1 GB de límite. Migrar a R2, D1, Supabase o Turso añadiría credenciales, runtime, backups y complejidad para resolver un problema que no es de capacidad.

**Orden de trabajo recomendado:**

| Prioridad | Acción | Hallazgo | Esfuerzo | Efecto |
|---:|---|---|---|---|
| 1 | Rebasear/publicar la rama y añadir smoke test de Pages | D1-01 | M | Producción y git dejan de divergir; títulos/rivalidades visibles |
| 2 | Corregir `content_hash` para ignorar `capturedAt` anidado + test de dos pasadas | D1-02 | S | Elimina la mayoría de commits/despliegues vacíos |
| 3 | Partir `squad.json` en resumen + `players/{id}.json` | D1-03 | M | Equipo pasa de 55 KB a ~3 KB gzip |
| 4 | Generar WebP 256/128 de los 13 escudos y usarlos en la sección | D1-04 | M | Escudos pasan de 2,32 MB a ~0,1–0,3 MB |
| 5 | `news-home.json` + miniaturas redimensionadas | D1-05 | M | Home pasa de ~612 KB a ~100–150 KB |
| 6 | Limpiar `social.json`, `keyPlayers`, `marketValueEur` y `provenance` | D1-06 | S | Menos contrato y menos bytes |
| 7 | Unificar títulos/rivalidades y validar consistencia | D1-09 | S–M | Se elimina la deriva 1 vs 6 |
| 8 | Generar Zod o test estructural + versionado por documento | D1-07 | M–L | Menos riesgo de ruptura app/datos |
| 9 | Revisar 37 conflictos, 3 pesos y 6 escudos | D1-10 | M | Mejor completitud |
| 10 | Mover YAML generado a artefacto/rama | D1-11 | M | Menos peso y confusión |
| 11 | Retratos `-small` en grid; verificar HEIC | D1-12 | S | Primera carga de equipo mucho menor |
| 12 | Versionar rutas de imágenes y cachear | D1-13 | S | Menos revalidaciones |
| 13 | Resumen de rivales para home | D1-14 | S | Menos parseo |
| 14 | Medir y reducir caché persistida | D1-15 | S | Arranque más predecible |
| 15 | `git gc` y, si crece, rama de datos | D1-08 | S/M | Historial más limpio |

**Qué no hacer ahora:** no migrar a una base de datos, no introducir R2, no montar un Worker de consultas y no añadir autenticación. No hay señales de que el límite de Pages, el tamaño del sitio o el tiempo de consulta lo justifiquen. La decisión debe revisarse solo si se superan los umbrales de §6.3.

**Criterio de éxito de la fase:** que una ingesta sin cambios produzca `changed=false`, que la home pese <150 KB en frío, que la sección de escudos pese <300 KB, que `titles.json`/`rivalries.json` devuelvan 200 en producción y que el contrato Zod y el JSON Schema no puedan divergir sin que CI lo detecte.

---

## Anexo A — Comandos de verificación reproducibles

```bash
# Inventario y gzip local
for f in data/public/v1/*.json; do
  printf '%s\t%s\t%s\n' "$(wc -c < "$f")" "$(gzip -c "$f" | wc -c)" "$(basename "$f")"
done | sort -nr

# Transferencia real y caché
curl -s -o /dev/null -H 'Accept-Encoding: gzip' \
  -w 'code=%{http_code} bytes=%{size_download}\n' \
  https://angelvilarino.github.io/depor-hub/v1/squad.json
ET=$(curl -sI https://angelvilarino.github.io/depor-hub/v1/squad.json \
  | awk 'BEGIN{IGNORECASE=1}/^etag:/{print $2}' | tr -d '\r')
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' \
  -H "If-None-Match: $ET" \
  https://angelvilarino.github.io/depor-hub/v1/squad.json

# Commits de una sola línea
git log origin/main --numstat --format='C %H' -- data/public/v1/squad.json \
  | awk '/^C /{next} NF==3{a+=$1;d+=$2;n++} /^$/{if(n==1&&a==1&&d==1)one++; if(n>0){tot++;n=0;a=0;d=0}} END{print tot,one}'

# Divergencia local
git rev-list --left-right --count main...origin/main
git ls-tree origin/main data/public/v1/ | awk '{print $4}'
```

## Anexo B — Qué no se ha medido

| Aspecto | Motivo |
|---|---|
| Tráfico mensual / GB servidos | No hay analítica ni logs de acceso en el repo |
| Tiempo de carga en dispositivo | No se ha ejecutado la app en iPhone/Android real en esta fase |
| Tamaño real de `deporhub-query-cache` | Requiere dispositivo/emulador y AsyncStorage |
| Coste de decodificación HEIC | Requiere medición en dispositivo |
| Impacto visual exacto de WebP 256 | Requiere revisión visual; la conversión a 128 px sí se midió (69.998 B) |
| Minutos de Actions | Fase 2; aquí solo se usa el número de ejecuciones/commits |
