# Notas visuales — Inicio (4 capturas)

Capturas: `inicio_proximopartido.jpeg`, `inicio_rival.jpeg`, `inicio_temporada.jpeg`, `inicio_clasificacionytitulares.jpeg`.
Todas a 946×2048, **modo oscuro real** (fondo #0B1220), pese a que el encargo indicaba modo claro.

## Artefacto de captura
En las cuatro aparece un botón flotante azul con engranaje que se mueve de posición (abajo-derecha, arriba-izquierda) y **tapa contenido**: el CTA «Añadir al calendario», el kicker «2026-27 · Jornada 12». Es un overlay del dispositivo/grabador, no de la app (la app ya tiene engranaje en la cabecera). No se penaliza, pero invalida evaluar esos píxeles.

## inicio_proximopartido
- Cabecera nativa oscura, título centrado «Inicio», engranaje 22 px a la derecha. Tab bar de 5 con iconos de línea y etiqueta.
- `PosterCard` degradado azul: kicker 11 pt mayúsculas con tracking, título serif 23 («Próximo partido»), escudos 72, nombres condensed 23 en dos líneas, «CONTRA» en mostaza 18, estado «Pendiente de actualizar» en serif 21.
- Fecha «SÁBADO 7 NOV · 16:15» en condensed 22 con tracking; sede 14. Ritmo vertical correcto, mucho aire.
- **Choque semántico**: el estado dice «Pendiente de actualizar» pero se muestra fecha y hora exactas y sede. El usuario no sabe si el partido se juega.
- CTA «Añadir al calendario» ocupa media fila; a su izquierda, párrafo de 4 líneas «El recordatorio estará disponible cuando se confirme la hora del partido.» → texto estático que explica una limitación. Debería ser un icono+una línea o el botón deshabilitado con motivo corto.
- «El rival» empieza en el mismo viewport: nombre 30, posición 32 en mostaza, puntos 15, entrenador con iniciales. Buena jerarquía.

## inicio_rival
- Tarjeta «El rival»: escudo 84, nombre condensed 30, «14º» 32 mostaza + «11 puntos». Bloque entrenador con avatar de iniciales 42. Barra histórica G/E/P de 10 px con animación de anchura.
- **Contraste**: las etiquetas «G 35 / E 28 / P 41» usan `poster.outcome.winText` (#07513C), `drawText` (#654A00) y `lossText` (#7A1F1A) sobre azul #00478F. El verde y el rojo quedan casi ilegibles (≈1,3–1,6:1). La barra sí se distingue por posición, pero el texto no cumple AA.
- «Todos los partidos oficiales · BDFutbol · 104 PJ» 11 pt y «134 a favor · 158 en contra» 14: dato útil enterrado en dos líneas de texto.
- «Abrir ficha del rival →» es un enlace de texto de 13 pt alineado a la derecha, sin altura mínima declarada; target pequeño y poco descubrible.
- La tarjeta entera es pulsable, pero el affordance visual es solo ese enlace.

## inicio_temporada
- `PaperCard` en oscuro = superficie casi idéntica al fondo: se pierde la metáfora «Prensa» y el contraste entre Cartel y Prensa se reduce a azul vs negro.
- 5 `StatTile` en rejilla 3+2 con hueco vacío a la derecha. Etiquetas de 12 con formatos mezclados: «PJ», «G-E-P», «GF-GC», «DG», «Puntos / partido» (las cuatro abreviaturas y una frase larga). Valores 23 condensed.
- Tres `SectionHeader` de 23 serif dentro de la misma tarjeta («La temporada», «Últimos 5 partidos», «Evolución de la posición»): misma jerarquía para tres niveles distintos.
- Racha: 5 cromos con escudo 38 en anillo de color + badge G/E/P de 20. El seleccionado se marca con borde azul y fondo. Funciona, pero los nombres van a 11 pt y el detalle inferior repite «Levante · 16 oct · Local · 1-1 · Ver partido» en 3 tipografías.
- Evolución: 4 líneas de texto estático («Jornada 9 · Levante · Empate · puesto 9 · 11 puntos / 16 oct · Local») antes del SVG. El gráfico no tiene eje X ni tooltip: sin ese párrafo no se entiende. El círculo «E» amarillo a la derecha queda flotando sin conexión visual con el punto seleccionado.
- El gráfico no se puede tocar (en código sí hay gesto, pero en la captura no hay pista visual de ello).

## inicio_clasificacionytitulares
- Mini-clasificación dentro de una tarjeta anidada (borde + radio sobre otra tarjeta): doble marco innecesario.
- Tabla de 5 filas con Pos/Equipo/Pts; el Depor se resalta con una barra azul de 3 px a la izquierda, sin fondo. Se lee bien, pero faltan G/E/P y DG que sí existen en el modelo.
- Cabecera de tabla 13 en gris; filas 17; puntos en serif 24. Alineación correcta.
- «Ver tabla completa» es un botón outline de ancho completo: pesa más visualmente que la propia tabla.
- «Titulares»: título serif 23 + «Ver todas» azul; imagen a sangre dentro de la tarjeta, muy grande. La foto mostrada (selección española) no tiene relación evidente con el Depor: la imagen domina más que el titular.
- No hay bloque «Qué se juega» en ninguna captura.

## Impresión global de Inicio
Es la pantalla más trabajada y la única donde Cartel/Prensa se aplica con intención. Aun así: (1) exceso de `SectionHeader` idénticos; (2) párrafos explicativos estáticos dentro de tarjetas; (3) el gráfico depende de texto; (4) contraste G/E/P sobre cartel; (5) nada se mueve salvo la barra H2H y el puntito «live»: la sensación es de póster bonito pero estático.
