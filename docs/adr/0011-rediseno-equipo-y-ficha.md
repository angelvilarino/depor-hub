# ADR 0011 — Rediseño de la pestaña Equipo y de la ficha de jugador

- **Estado:** aceptada (26-oct-2026).
- **Alcance:** pestaña Equipo (`app/(tabs)/team.tsx`) y ficha (`app/player/[id].tsx`) antes de empezar H5. No cambia el contrato de datos; los escudos se tratan en el ADR 0012.
- **Regla base:** la UI solo pinta lo que existe. Un dato desconocido es `null` y se oculta; no se rellena por deducción.

## Contexto

La pestaña Equipo agrupaba a los 28 jugadores en secciones por posición y la ficha acumulaba bloques de texto, una galería de fotos y una línea de «Fuente/confianza» al final. Con 28 jugadores y una ficha que ya tiene carrera, partidos, redes y datos personales, la pantalla se alargaba y costaba comparar jugadores. Antes de H5 hacía falta una vista más compacta, con búsqueda y filtros reales, y una ficha con jerarquía clara.

## Decisiones

### 1. Equipo: cuadrícula y lista, sin FlashList

- La vista por defecto es una **cuadrícula de 2 columnas**; el usuario puede cambiarla a **lista**.
- La preferencia se guarda en Zustand (`settings.squadView: 'grid' | 'list'`, por defecto `grid`) con la misma persistencia que el tema y el idioma.
- Se usa `FlatList` (y `SectionList` solo donde ya existía), no FlashList. Con 28 jugadores no compensa añadir una dependencia nativa que no funciona en Expo Go sin un development build. Si en H8 la lista crece, se reevalúa.
- La cuadrícula usa retrato de 112 pt (`quality="large"`), dorsal en una insignia, nombre, bandera, posición abreviada y edad. La lista usa filas de 44 pt con retrato `-small` (192 px, ~43 KB), dorsal, nombre, bandera + nacionalidad, posición y edad, con cabeceras alineadas.
- `PlayerPortrait` mantiene `contentPosition="top"` y `recyclingKey` para que al cambiar de vista no se reutilice una imagen de otro tamaño.

### 2. Búsqueda, filtros y resumen

- La búsqueda normaliza a minúsculas, quita tildes (NFD) y recorta espacios. Busca por **nombre** o por **dorsal**.
- Los chips **Todos / POR / DEF / MED / DEL** muestran el contador de la búsqueda actual (no del total). El filtro de posición se combina con la búsqueda.
- El resumen es real: número de jugadores visibles y edad media calculada en el dispositivo. Si no hay fechas válidas, se muestra solo el número. Las claves usan plurales (`summary_one`/`summary_other`).
- Si no hay resultados, `EmptyState` explica que ningún jugador coincide y ofrece **Limpiar filtros**; si la plantilla está vacía, no ofrece la acción.

### 3. Ficha: jerarquía y foto

- La cabecera de navegación se deja vacía (`Stack.Screen options={{ title: '' }}`); el nombre ya está en el hero. No se repite «(tabs)» ni el título de la ruta.
- El hero tiene un retrato circular de **88 pt** con un botón de ampliar. Al pulsarlo se abre un modal con la foto grande y la atribución completa: `credit`, `author`, `license`, enlace a `sourceUrl` y la nota de que no se redistribuye.
- El modal se cierra con el botón de 44 pt, tocando el fondo, con `onAccessibilityEscape` o con un arrastre vertical de más de 80 pt (o velocidad > 1,2). No se cierra por un toque dentro de la tarjeta.
- Si el sistema pide **reducir movimiento**, el modal usa `animationType="none"` y la imagen no hace transición. El hook `useReducedMotion` escucha `reduceMotionChanged`.
- Ya no hay tarjeta «Fotos»: la foto de perfil es la única y su atribución vive en el modal.

### 4. Datos, partidos y trayectoria

- La franja superior muestra **PJ · G · min · TA · TR** con los totales de carrera. Si no hay totales, cae al resumen de los partidos con el Depor; si tampoco hay, la franja no se pinta.
- La bio va en **dos columnas** y solo incluye los campos con valor. El valor de mercado se sigue marcando como «Estimación».
- Las redes usan Ionicons (`logo-x`, `logo-instagram`, `logo-tiktok`) y `expo-linking`.
- Cada partido muestra escudo del rival, Local/Visitante, marcador y un chip **G/E/P** con los tokens `win`/`draw`/`loss` (contraste AA en claro y oscuro). El chip lleva la letra y el color, no solo el color.
- Un partido enlaza a `/match/[id]` solo si `fixtureForMatch` encuentra **un único** fixture con la misma fecha, localía y rival normalizado. Si hay ambigüedad o no casa, la fila no es pulsable.
- La trayectoria es una línea vertical plegable, abierta por defecto, de la temporada más antigua a la más reciente. Los datos pendientes van al final, plegados y cerrados por defecto.
- Se elimina `SourceNote` y las claves i18n que solo usaba (`sourceLine`, `confidence`, `photosTitle`, `careerTotalsTitle`, `team.group`).

### 5. Accesibilidad e idiomas

- Todos los controles nuevos tienen al menos 44 pt (`minTouch`), etiqueta accesible y estado (`selected`/`expanded`). `SegmentedControl` sube a 44 pt; esto también afecta a Calendario.
- Los textos largos usan `numberOfLines` para no romper la cuadrícula; la información sigue disponible en la ficha.
- ES y EN están completos; GL mantiene las claves que tiene y cae a ES para el resto. El test de paridad exige que EN tenga las mismas claves que ES y que GL no invente claves.
- Los tests de tokens comprueban AA ≥ 4,5 para `win`, `draw` y `loss` sobre `surface` en claro y oscuro.

## Consecuencias

- **Pros:** comparar jugadores es más rápido; la búsqueda y los filtros son reales; la ficha prioriza identidad, stats y partidos; la foto y su atribución quedan en un modal accesible.
- **Contras:** la cuadrícula necesita dos columnas y un retrato grande; la lista y la cuadrícula tienen componentes distintos. `SegmentedControl` cambia de alto en Calendario. No se usa FlashList, así que una plantilla mucho mayor exigiría revisar el rendimiento.
- **Mantenimiento:** cualquier campo nuevo de la ficha debe entrar en `bio` (o en su bloque) y en `pendingFields` si puede faltar. Los cambios de vista deben seguir pasando por `squadView` para no perder la preferencia.

## Referencias

- `apps/mobile/app/(tabs)/team.tsx`, `apps/mobile/app/player/[id].tsx`.
- `apps/mobile/src/features/squad/logic.ts` — búsqueda, filtros, edades, banderas, `fixtureForMatch`.
- `apps/mobile/src/theme/tokens.ts`, `apps/mobile/src/theme/useReducedMotion.ts`.
- `apps/mobile/src/__tests__/team.test.tsx`, `playerDetail.test.tsx`, `squadLogic.test.ts`, `tokens.test.ts`.
- ADR 0007 (plantilla y fichas), ADR 0009 (fotos), ADR 0012 (escudos).
