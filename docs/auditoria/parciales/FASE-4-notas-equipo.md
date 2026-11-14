# Notas visuales — Equipo y fichas (5 capturas)

Capturas: `equipo.jpeg`, `equipo_vistaJugador.jpeg`, `equipo_vistaJugador_Partidos.jpeg`, `equipo_vistaJugador_Trayectoria.jpeg`, `equipo_vistaEntrenador.jpeg`, `equipo_vistaEntrenador_trayectoriaCuerpoTecnico.jpeg` (6 en total, 5 de la ficha). Modo oscuro.

## Artefacto
Botón flotante de engranaje (overlay del dispositivo) sobre la cabecera; en la ficha tapa parte del botón atrás «Equipo».

## equipo.jpeg — pestaña Equipo
- Cabecera nativa «Equipo» + engranaje. Primera tarjeta: entrenador con foto 48, kicker «ENTRENADOR» 12, nombre 16 bold sans, bandera+país 13, chevron. Compacta y clara.
- Buscador pill de 44+ con icono 20 y placeholder 16. Sin botón de filtro ni historial.
- Fila «28 jugadores» 14 gris + conmutador cuadrícula/lista de 2 botones de 44 con fondo azul en el activo. El conmutador pesa visualmente más que el dato.
- Chips Todos/POR/DEF/MED/DEL con contador, 44 de alto, scroll horizontal (el último se corta en el borde). Correcto, pero sin animación de selección ni indicador de desplazamiento.
- Rejilla 2 columnas: retrato 88 sobre fondo de tarjeta, dorsal en badge azul 26 arriba-derecha, nombre 15 bold sans centrado, línea «🇪🇸 · POR · 28» 12 gris. **No usa `PosterCard` ni `PaperCard` ni `SectionHeader`**: es un componente genérico de tarjeta redondeada.
- Mucho aire alrededor del retrato: el jugador ocupa ~40 % de la tarjeta y queda pequeño; la tarjeta parece un cromo vacío.
- No hay agrupación por posición ni cabeceras de sección; todo plano.
- Sin indicación de que la tarjeta sea pulsable (no chevron, sin sombra/realce).
- Tipografía: toda sans (Inter) en 12/14/15/16; cero serif. La identidad editorial de Inicio desaparece.

## equipo_vistaJugador.jpeg — ficha, Resumen
- Cabecera nativa vacía con botón atrás que muestra «Equipo» en una píldora blanca translúcida (iOS). Queda raro y compite con el contenido.
- Hero: retrato 96, nombre 24 bold en 2 líneas, línea «🇪🇸 España · Defensa · 36 años» 13, dorsal 44 azul + «DORSAL» 10. Bien: el dorsal es el único elemento con fuerza.
- **Dos `SegmentedControl` seguidos**: «Depor 26-27 / Carrera» y «Resumen / Partidos / Carrera». Ocupan 180 px de alto y compiten entre sí; el usuario debe entender dos ejes distintos.
- Franja de stats: 5 columnas con icono 17 + número 18 + etiqueta 11 (`PJ G min TA TR`). Abreviaturas sin leyenda; «G» puede ser goles o ganados; «TA/TR» exige conocer el argot.
- Tarjeta «Datos»: rejilla 2 columnas de 7 campos, etiqueta 12 gris y valor 15 semibold. «Lugar de nacimiento» rompe a 2 líneas y descuadra la rejilla; «Desde»/«Contrato» dejan huecos.
- Tarjeta «Redes oficiales»: botones pill con icono + nombre.
- Títulos de tarjeta 16 bold sans, sin kicker ni serif: no hay jerarquía editorial.
- El 70 % de la pantalla es texto de 12–15 pt sobre tarjetas idénticas.

## equipo_vistaJugador_Partidos.jpeg
- Cabecera: solo el segmented de 3 pestañas. Sin contexto de jugador (nombre/dorsal desaparecen al cambiar de pestaña) → pérdida de orientación.
- Título «Partidos con el Depor» 16 bold y resumen «8 PJ · 0 G · 652 min» 17 gris.
- Filas: escudo 28, rival 15 bold, subtítulo «16 de octubre de 2026 · Local · LaLiga» 12 que **rompe en 2–3 líneas** porque «LaLiga» no cabe; altura de fila irregular. Marcador 15, chip G/E/P con borde de color y letra, chevron.
- Repetición de «LaLiga» en cada fila y fecha larga completa: ruido. No hay agrupación por mes/competición ni filtros.
- La franja «8 PJ · 0 G · 652 min» repite los mismos totales ya mostrados en el Resumen.
- 8 filas llenan toda la pantalla: densidad baja para ser una lista de partidos.

## equipo_vistaJugador_Trayectoria.jpeg
- Timeline vertical: línea + punto azul, escudo 24, club 17 bold, años a la derecha 15 gris, segunda línea «58 PJ · 1 G · 4957 min» 15.
- **Inconsistencias tipográficas visibles**: «2009–2011» (en dash), «2010-11» (guion), «2026–» (en dash colgando). Clubs duplicados con dos nombres: «Deportivo de La Coruña» y «Deportivo de A Coruña».
- Cifras sin separador de miles («4957 min», «8168 min») en una app en español.
- Todos los puntos iguales: no se distingue el club actual ni las etapas. No es plegable ni interactiva.
- Pantalla de 11 filas idénticas: es una tabla, no una visualización.

## equipo_vistaEntrenador.jpeg
- Cabecera nativa con «Entrenador» centrado **y** píldora «Equipo» a la izquierda: duplica el contexto de navegación.
- Hero: foto 120 circular con fondo blanco (rompe el tema oscuro), nombre 24, «Entrenador»/«España»/«En el Depor desde 2025» 17.
- «Datos personales»: misma rejilla 2 columnas; 5 campos y un hueco final.
- «Balance con el Depor»: 7 cifras en rejilla 4+3, todas a 32 y mismas etiquetas 12 (PJ G E P GF GC Pts). Sin barra G/E/P ni sparkline. Debajo, párrafo estático de 2 líneas: «Calculado con los partidos terminados de la temporada publicada.» → texto explicativo que el propietario rechaza.
- «Trayectoria» con segmented Entrenador/Jugador y lista de clubes con monograma «EC» cuando falta escudo.

## equipo_vistaEntrenador_trayectoriaCuerpoTecnico.jpeg
- Trayectoria (6 filas) + «Cuerpo técnico»: «Publicado por la web oficial del club.» 17 gris como subtítulo estático.
- Cada rol ocupa ~140 px: kicker 13 mayúsculas + avatar de iniciales 48 + nombre 20. Seis roles → más de una pantalla. Cabría en una rejilla 2×3 o en filas de 56.
- El header sigue diciendo «Entrenador» aunque la pantalla sea de cuerpo técnico.

## Impresión global de Equipo/fichas
Es la zona **menos alineada con la identidad**: no hay Cartel ni Prensa, no hay serif, no hay kickers, no hay grandes cifras (salvo el dorsal). Los patrones son tarjeta genérica + rejilla de datos + lista. La información está, pero se presenta como formulario. El jugador se siente como una ficha administrativa, no como un cromo.
