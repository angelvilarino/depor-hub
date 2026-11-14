# Notas visuales — Noticias (1 captura)

Captura: `Noticias.jpeg`. Modo oscuro.

- Cabecera «Noticias» + engranaje.
- Barra superior: icono de lupa suelto, `SegmentedControl` Todo/Artículos/Vídeos, icono de filtros (sliders) a la derecha. Tres controles de filtrado en una fila, sin jerarquía entre ellos.
- Debajo, chips de grupo (Club, Galicia, Nacional) con scroll horizontal. **Mismo lenguaje visual (pill) que los filtros de categoría/tags de cada tarjeta**: el usuario no distingue filtro de etiqueta.
- Resumen: «150 noticias» 20 bold + pill «99+ sin leer» + «Marcar leídas» con doble check. El dato de no leídas está bien resuelto.
- Cabeceras de día sticky «viernes, 6 de noviembre» en minúscula y 13 gris: correcto, aunque el contraste es bajo sobre fondo (#A7B4C4 sí cumple).
- Tarjeta: icono de fuente 28 + nombre 17 + «hace 4 d» 15 + punto azul de no leída + miniatura 120×120 a la derecha.
- Titular 21 bold hasta 3 líneas → ocupa media tarjeta; extracto 17 gris 2 líneas con truncado a mitad de palabra («…como de…»). Doble truncado (título y extracto) deja la tarjeta a medias.
- Nombre de fuente truncado «RC Deportivo (Yo…».
- Etiqueta «Partido» en pill azul + «+1 medio ⌄» a la derecha: la etiqueta parece un filtro pulsable; el desplegable de medios alternativos está bien pero poco visible.
- La miniatura es 120×120 y el texto ocupa el 75 % del ancho: la imagen no manda y el conjunto se lee como lista de titulares, no como portada.
- Hay tres niveles de filtro (buscador, tipo, grupo, sheet de filtros) antes de la primera noticia: mucha maquinaria para 150 elementos.
- La lista deja «Marcar leídas» con confirmación por `Alert.alert` nativo y snackbar de undo de 6 s: correcto, pero el Alert rompe la estética de la app.

## Impresión
La pantalla está bien organizada, pero es **la más densa en texto**: titular 3 líneas + extracto 2 + metadatos. Para una app de aficionado, la portada de noticias debería priorizar imagen y titular corto.
