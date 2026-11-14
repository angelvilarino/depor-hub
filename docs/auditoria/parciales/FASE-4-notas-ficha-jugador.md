# Notas visuales — Ficha de jugador (4 capturas)

Capturas ya examinadas dentro de `FASE-4-notas-equipo.md` (no se recargan): `equipo_vistaJugador.jpeg`, `equipo_vistaJugador_Partidos.jpeg`, `equipo_vistaJugador_Trayectoria.jpeg`, y `equipo_vistaEntrenador*.jpeg` como comparative. Modo oscuro.

## Resumen
La ficha es un formulario, no un cromo. El único elemento con fuerza es el dorsal 44 (`player/[id].tsx:484`). El resto es una sucesión de tarjetas `Card` con títulos de 16 bold y valores de 15: la misma jerarquía para nombre, datos, redes y pendientes.

## Evidencia visual
- Hero: retrato 96, nombre 24 en 2 líneas, identidad 13, dorsal 44 + “DORSAL” 10 (`player/[id].tsx:452-497`). El retrato no sangra ni ocupa el ancho; la foto queda pequeña y el dorsal compite con el nombre.
- Dos `SegmentedControl` consecutivos (`player/[id].tsx:510` y `:520`), ambos de 44+ y ancho completo. Uno elige ámbito (Depor 26-27 / Carrera), el otro pestaña (Resumen / Partidos / Carrera). Visualmente idénticos → el usuario no sabe que son ejes distintos.
- `StatStrip`: 5 columnas icono 17 + número 18 + etiqueta 11 (`player/[id].tsx:68-93`). “PJ G min TA TR” sin leyenda. La franja no tiene fondo propio, solo un borde superior.
- “Datos”: rejilla 2 columnas de 7 campos (`:534-548`), etiqueta 12 y valor 15. “Lugar de nacimiento” rompe a 2 líneas y descuadra la rejilla; los campos ausentes se omiten, así que unas fichas tienen 5 y otras 7.
- “Redes oficiales”: botones pill con icono + nombre.
- Pestaña Partidos: título 16 + resumen 17 gris; filas con escudo 28, rival 15, subtítulo 12 que rompe en 2–3 líneas (“16 de octubre de 2026 · Local · LaLiga”), marcador 15, chip G/E/P y chevron (`:229-249`). Altura irregular y repetición de “LaLiga”.
- Pestaña Carrera: timeline de clubes 15/13; años a la derecha; cifras sin separador de miles (`CareerTimeline.tsx:69-73`).
- Al cambiar de pestaña desaparece el hero: no hay cabecera sticky con nombre/dorsal, así que se pierde el contexto (`:510-530`).
- El modal de foto está bien resuelto: fondo, 44 pt, arrastre >80 pt, `reduceMotion` (`:96-200`).
- No se ve el bloque “Datos pendientes” en las capturas, pero existe (`player.pendingTitle`) y añade otra tarjeta de texto.

## Código que confirma
`Card` genérica, títulos 16 bold, sin `PosterCard` ni `PaperCard`, sin `SectionHeader` del sistema. Todo el archivo usa `fontSize` literales (27 apariciones), ninguna escala tipográfica.
