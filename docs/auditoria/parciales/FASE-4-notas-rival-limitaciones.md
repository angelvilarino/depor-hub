# Notas — Rival y limitaciones de captura

## Rival (sin captura)
No existe ninguna captura de `app/rival/[teamId].tsx`. La única imagen llamada `inicio_rival.jpeg` es un scroll de Inicio con el bloque «El rival». La ficha de rival se audita **solo por código** (`app/rival/[teamId].tsx:106-179`) y su rúbrica se marca como provisional.

Lo que se ve en código:
- `PosterCard` con escudo 90, nombre 32 condensed y posición 21 en mostaza; `FormChips` de forma.
- `PaperCard` de entrenador con monograma 48 y nombre 20 serif.
- `PaperCard` de histórico: 3 `StatTile` (PJ, GF, GC), `HeadToHeadBar`, nota de confianza y enlace a la fuente con `minHeight: 44`.
- `PaperCard` de últimos cruces: tarjetas con dos escudos 38, marcador 28, letra G/E/P y una línea extra con los nombres completos de ambos equipos (texto duplicado).
- No hay comparación visual del balance por temporada ni filtros; el patrón es el mismo que Inicio, lo cual es positivo para consistencia, pero no hay ninguna captura que lo valide.

## Limitaciones de la evidencia visual
1. **Solo hay modo oscuro.** Las 29 capturas muestran fondo `#0B1220` y `darkColors`; el encargo decía «solo modo claro», pero la realidad es la contraria. No se puede evaluar el tema claro, el paso claro↔oscuro ni el contraste de `paper` claro.
2. **No hay capturas de carga** (solo se puede leer `HomeSkeleton`/`LoadingState`), **error**, **offline**, **pull-to-refresh**, **texto grande**, **Ajustes**, **Recordatorios**, **búsqueda de noticias**, **sheets**, **modales de foto**, **comparador de escudos** ni **estados vacíos**.
3. **No hay captura de la ficha de rival** ni de `coach` como ruta independiente (sí de la vista de entrenador).
4. **No hay video**, así que no se puede evaluar movimiento real, transiciones, gestos ni háptica; solo lo que el código declara.
5. **Un overlay de engranaje del dispositivo** aparece en todas las capturas y tapa contenido (incluido el botón atrás de la ficha y el CTA de calendario). No es de la app.
6. Las capturas no indican versión de build ni dispositivo; las proporciones (946×2048) no coinciden con un viewport estándar, así que las estimaciones de tamaño en pt son aproximadas y se apoyan en el código.
