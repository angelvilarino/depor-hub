# Notas visuales — Club (15 capturas)

Capturas: `club.jpeg`, `club_explorar.jpeg`, `club_cronologia.jpeg`, `club_estadio.jpeg`, `club_equipaciones.jpeg`, `club_escudos.jpeg`, `club_titulos.jpeg`, `club_rivalidades.jpeg`, `club_himnos.jpeg`, `club_himnos_vistahimno.jpeg`, `club_junta.jpeg`, `club_museo.jpeg`, `club_patrocinadores.jpeg`, `club_redes.jpeg`, `club_CiudadDeportiva.jpeg`. Modo oscuro.

## Patrón general
Club tiene **un tercer lenguaje visual**, distinto del Cartel/Prensa de Inicio y del `Card` genérico de Equipo/Noticias:
- `HeroHeader` con degradado azul, icono watermark de 92 px y título 40 en Barlow.
- `Editorial.SectionHeader`: icono 23 azul + título 21 bold + subtítulo **14 en Source Serif**, con familias hardcodeadas (`Editorial.tsx:42`) en vez de los tokens `typography`.
- `StatCounter`: número 25 con animación de conteo, mientras el `StatTile` de Inicio es 23 y el dorsal de ficha 44. Tres escalas de “número grande”.
- Muchas pantallas usan `Card` de `Screen.tsx` + párrafos serif de 15–21.

## club.jpeg — portada
- Hero: escudo 70, degradado azul, “RC Deportivo” 40 condensed, subtítulo serif 16, 5 chips de apodo en 2 filas (Dépor, Súper Dépor, Blanquiazul, Herculinos, Los Turcos). Los chips parecen filtros pulsables pero son estáticos.
- Aviso legal a ancho completo entre el hero y las cifras: “Proyecto de aficionados sin vinculación oficial con el Real Club Deportivo de La Coruña, S.A.D.” (12 pt, `club.tsx:130`). Correcto legalmente, pero rompe el ritmo y se repite en Ajustes/Acerca de.
- Cifras: 1.906 / 42 / 21 en una fila y 32.490 solo en una segunda tarjeta a ancho completo. Rejilla rota por `flexWrap` + `flexGrow`.
- “Identidad del club”: icono “i” 36 que no es pulsable; título 21 + subtítulo serif con el nombre oficial; 3 pares etiqueta/valor. El icono de información invita a tocar y no hace nada.
- Sin fotos del estadio/ciudad; el hero es un degradado con escudo.

## club_explorar.jpeg
- Rejilla 2×N de 14 secciones. Cada tile: zona de arte 66 px (fondo = `colors.background`, casi negro), icono dentro de un círculo blanco de 44, badge azul arriba-derecha (3, 14, 42, 32.490, 6, 17), título 16/24 y subtítulo 12 truncado a 2 líneas.
- **Los títulos no caben**: “Ciudad deportiva” y “Junta y organigrama” rompen en 2 líneas y empujan el subtítulo; otros se truncan (“fabricantes y patrocin…”).
- El badge “32.490” es tan ancho que tapa el icono de estadio.
- Los 14 iconos son genéricos y del mismo color: no hay pista visual de categoría (historia, equipo, patrimonio).
- El tile de Equipaciones mete una foto de camiseta con fondo blanco que rompe el tema oscuro.

## club_cronologia.jpeg
- Cabecera “Cronología del club” 21 + subtítulo serif 14.
- **6 chips de filtro** (Todas, Escudo, Títulos, Estadio, Patrocinadores, Junta) de 56 px que ocupan 2 filas y 250 px de alto.
- Timeline: año 13 azul, título 16 bold, chevron; línea vertical y punto azul. Plegable (patrón correcto).
- Todos los eventos cerrados por defecto, categorías solo por texto; dos entradas “1912” seguidas sin agrupar.
- Es de las pocas pantallas con interacción real y aun así el filtro pesa más que el contenido.

## club_estadio.jpeg
- Hero “Riazor” 40 + dirección serif.
- Tarjeta: párrafo 15 de 4 líneas + 4 pares etiqueta/valor (Dirección, Inaugurado, Césped, Dimensiones) + CTA azul “Cómo llegar” a ancho completo.
- “Aforo”: título 27, tarjeta anidada 32.490 + “espectadores”, y **párrafo técnico** de 2 líneas sobre sectores que no se suman. Después, un chip gigante “Fuente oficial · Confianza: contrastado” a ancho completo que parece un botón.
- La procedencia del dato (fuente/confianza) tiene más peso visual que el dato.

## club_equipaciones.jpeg
- **Dos filas de chips** de 56 px (tipo de equipación y década) con scroll horizontal: 250 px antes de ver una camiseta.
- Párrafo instructivo de 3 líneas: “Todas las temporadas documentadas… Usa el selector para saltar de década.” (`club.equipaciones.intro`) — texto estático que explica la UI.
- “2020s” 27. Tarjeta por temporada: “2026-27” 27 + “3 equipaciones” 18; dentro, cada kit con imagen 160×~160 sobre blanco, título 16/21, “Nike · Estrella Galicia”, “Colores: blanco / azul” y pill negro “Crédito de imagen” por imagen + caption “Ilustración”.
- Imágenes con fondos y proporciones distintas; el conjunto parece una ficha de e-commerce, no una app editorial.
- No hay swipe entre equipaciones ni comparador visual.

## club_escudos.jpeg
- Intro editorial: título 21 + párrafo serif 15 de 4 líneas + instrucción “Toca cualquier escudo para verlo en grande.”
- Timeline de escudos: tarjeta con imagen 160, rango “1906-1908” 21 bold, descripción serif 15 de 3 líneas, icono expandir; debajo, **“Crédito de imagen” en pill negra de 56 px para cada escudo** y enlace “Comparar transición” 18 azul con icono (44 pt).
- El comparador es una buena idea, pero está enterrado y no se ve el resultado en la captura.
- Mezcla de guiones: “1906-1908” (guion) en esta pantalla frente a en-dash en otras.

## club_titulos.jpeg
- Cabecera “Palmarés” 30 + subtítulo serif + “21 títulos en 9 competiciones.”
- **9 chips de competición a ancho completo que ocupan media pantalla** (Primera División, Copa del Rey, Supercopa, Concurso España, Segunda, Primera Federación, Tercera, Campeonato de Galicia, Copa Galicia). Se envuelven en 5 filas.
- Detalle de la competición seleccionada: “2000 / Primera División / Entrenador: Javier Irureta / Temporada 1999-2000.” en tarjeta.
- Luego resúmenes por competición (“Primera División · 1 título · 2000”; “Copa del Rey · 2 títulos · 2002 1995”).
- No hay una cifra grande de títulos, ni agrupación por década, ni trofeos visuales.

## club_rivalidades.jpeg
- “RC Celta de Vigo” 30 con **icono de balón genérico** (no el escudo), “Derbi gallego” serif.
- 133 PJ / 49 G / 32 E / 52 P en 40 px; **color semántico invertido**: G en azul de marca, P en rosa, E en gris (en el resto de la app G=verde, E=ámbar, P=rojo).
- Barra proporcional azul/gris/rosa + “Goles: 194 a favor · 202 en contra · BDFutbol”.
- “Balance en BDFutbol” como enlace azul suelto que repite el dato anterior.
- Chips Todas / Primera División; “Enfrentamientos” con timeline de 5 partidos: fecha ISO “2018-05-05”, frase completa “Celta de Vigo 1–1 Deportivo de La Coruña” 21 bold en 2 líneas, chevron.
- La fecha ISO y el nombre completo repetido en cada fila hacen la lista muy pesada.

## club_himnos.jpeg
- 3 tarjetas: icono musical en círculo 70, título 27, meta 18 (“Himno oficial · 2026 · Xoel López”), estado “Letra disponible en la fuente” / “Letra pendiente”, play 44 solo en el oficial, chevron.
- **Media pantalla vacía**. Sin imagen, sin artista, sin duración, sin onda de audio.
- Dos affordances por tarjeta (play y chevron) sin distinción.

## club_himnos_vistahimno.jpeg
- “Voa” 40 + 2 chips + párrafo serif de 4 líneas.
- “Reproducción oficial”: explicación de 2 líneas + botón azul gigante + caption. Tres capas de texto para una acción.
- “Letra”: caja vacía “Letra disponible en la fuente” + botón “Ver letra en la fuente”.
- “Créditos”: lista de músicos en párrafos de 15–21.
- Todo son tarjetas apiladas con títulos 27 y copy largo; no hay reproductor embebido (la web oficial se abre fuera).

## club_junta.jpeg
- “Junta directiva” 22. Presidente con iniciales 56, rol 18, nombre 21; conector vertical; “Consejo” con raíl y 5 miembros; conector y “Entrenador” con chevron. **Es el mejor patrón de datos de Club**: organigrama legible.
- Debajo, “Composición publicada por el club.” y media pantalla vacía.
- Todos los avatares son el mismo círculo azul con iniciales; no hay jerarquía visual entre presidencia/consejo/entrenador más allá de la posición.

## club_museo.jpeg
- Hero sin foto (icono edificio) “Museo RC Deportivo” 40 + “Estadio Abanca-Riazor”.
- Párrafo descriptivo 15, “Ubicación”, botón “Cómo llegar”.
- “Visitas”: 3 modalidades, cada una con título 16/21 y **la misma frase** “Consultar precio y disponibilidad en la web oficial.” repetida 2 veces y “Consultar condiciones…” una tercera. Puro relleno.
- No hay fotos, horarios, precios ni CTA de entradas.

## club_patrocinadores.jpeg
- “Patrocinio” 27; grupos “Patrocinador principal”, “Proveedor técnico”, “Patrocinadores oficiales”.
- Cada patrocinador es una tarjeta de ~300×230 con **monograma de iniciales y nombre**, sin logo, sin enlace, sin rol en la mayoría. 17 patrocinadores → scroll infinito de cajas vacías.
- El monograma (AB, NI, EG…) ocupa 64 px y el nombre 21; el 70 % de la tarjeta es aire.
- No hay búsqueda ni agrupación por sector.

## club_redes.jpeg
- “Canales oficiales” 24; 10 filas de ~120 px: icono 28 + etiqueta 21 azul + icono de enlace externo 24. Todo azul, todo igual.
- Icono de X = **pájaro antiguo de Twitter**, mientras la ficha de jugador usa `logo-x`.
- “Más enlaces” con 1 fila; “Contacto” empieza.
- Es una lista de enlaces sin descripción, sin marca de cada red y con altura excesiva.

## club_CiudadDeportiva.jpeg
- Hero degradado con icono de mancuerna, “Dépor Training Center” 40, “Abegondo, A Coruña” serif.
- Párrafo serif de 4 líneas con la cita gallega “Onde nace o futuro” mezclada en texto español.
- “Instalaciones”: **5 bullets de texto** (“140.000 m² de superficie”, “8 campos…”, “3 campos…”, “Diseño del estudio Populous”, “Energías renovables…”). Es el caso más claro de datos que deberían ser tarjetas/iconos.
- Media pantalla vacía.

## Diagnóstico de Club
Es la zona con más contenido y la más desigual: el organigrama y la cronología funcionan; los patrocinadores, himnos, redes y museo son listas de texto o cajas vacías. La identidad “Cartel/Prensa” no llega: Club inventa un tercer sistema (Hero + Editorial) con fuentes y tamaños propios. El coste de mantener tres sistemas ya se ve en los subtítulos serif de 14 y en los `SectionHeader` distintos.
