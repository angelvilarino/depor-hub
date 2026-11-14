# FASE 4 — Diseño y experiencia de uso

> **Auditoría de solo lectura.** No se ha instalado ni ejecutado la app. Todo el análisis se apoya en las 29 capturas de `docs/auditoria/capturas/` y en lectura de código de `apps/mobile/`. No se ha modificado nada fuera de `docs/auditoria/` ni se ha hecho commit/push.
>
> **Fecha:** 2026-11-11 · **Corpus:** 29 capturas (946×2048) · **Código:** Expo SDK 58 / React Native 0.88.
>
> **Nota de alcance:** el encargo indicaba «solo modo claro», pero **las 29 capturas están en modo oscuro** (fondo `#0B1220`). Se evalúa visualmente el modo oscuro y el modo claro solo por tokens. Esta discrepancia se detalla en §1.5.

---

## 0. Resumen ejecutivo

La app tiene una **idea visual buena** —el sistema «Cartel + Prensa»— que solo existe de verdad en Inicio y en la ficha de rival. En el resto convive con otros dos lenguajes: el `Card` genérico de Equipo, Noticias, Calendario, Partido y Jugador, y el `HeroHeader + Editorial` propio de Club. El resultado no es una app con identidad, sino **tres apps cosidas**: una editorial, una administrativa y una de museo.

La consecuencia se ve en la rúbrica: **nota global 2,3/5**. Inicio aprueba (3,1), Noticias y Calendario quedan en aceptable (2,7 y 2,6), y las pantallas que deberían ser el corazón del producto —ficha de partido (1,3), ficha de jugador (1,9), entrenador (1,9) y media docena de secciones de Club (1,5–2,0)— suspenden. No es un problema de falta de datos: es un problema de **cómo se presentan**.

### 0.1 Nota global por módulo

| Módulo | Nota | Lectura |
|---|---:|---|
| Inicio | **3,1** | Lo más trabajado; el Cartel funciona, pero le sobra texto y le falta movimiento. |
| Equipo (plantilla) | **2,4** | Rejilla de cromos vacíos; sin jerarquía ni agrupación. |
| Ficha de jugador | **1,9** | Formulario, no cromo; dos segmentados y una rejilla de datos. |
| Entrenador | **1,9** | Datos correctos, presentación de ficha administrativa. |
| Calendario | **2,6** | Funcional y plano; sin competición/jornada y con error de capitalización. |
| Ficha de partido | **1,3** | El peor caso: metadatos en lista, alineaciones y eventos en párrafos. |
| Noticias | **2,7** | Bien organizada, pero densa y con doble truncado. |
| Club | **2,2** | Muy desigual: cronología y junta funcionan; patrocinadores, redes, himnos y museo no. |
| Rival | **3,3\*** | \*Provisional: no hay captura; solo código. |

### 0.2 Los cinco problemas principales

1. **Navegación rota y chrome duplicado (D-01, D-24).** El botón atrás de la ficha de partido muestra literalmente `(tabs)`; en jugador/entrenador aparece una píldora «Equipo» que compite con el título. Es el defecto más visible y el más barato de arreglar.
2. **Las fichas son documentos, no experiencias (D-05, D-09).** La ficha de partido dedica seis filas a los metadatos, alineaciones en una línea por jugador y goles/cambios en párrafos. La ficha de jugador tiene dos `SegmentedControl` idénticos, una franja de abreviaturas y una rejilla de 7 campos.
3. **Tres sistemas visuales y una tipografía sin escala (D-03, D-04, D-26).** Solo 7 archivos importan `DesignSystem`; hay 66 `<Card>` frente a 4 `<PosterCard>` y 6 `<PaperCard>`; 318 `fontSize` literales con 25 tamaños distintos (9–64) y 156 pesos. La identidad no está sistematizada.
4. **La app se siente estática (D-08).** Un único `({ pressed })` en todo el código, cero háptica, un solo archivo con Reanimated y cinco `Animated.timing`. Los gráficos dependen de párrafos para explicarse.
5. **Contraste y accesibilidad (D-02, D-12, D-22).** Las etiquetas G/E/P sobre el cartel azul quedan en **1,02–1,56:1**; el papel oscuro se separa del fondo solo **1,11:1**; hay textos de 9–12 pt y abreviaturas sin leyenda.

> **Mención especial:** el Club tiene pantallas que no aportan valor práctico —patrocinadores con monogramas vacíos, himnos con media pantalla en blanco, museo con la misma frase repetida—. No son fallos de estilo: son contenido que no está listo para publicarse (D-15 a D-19).

### 0.3 Índice de hallazgos

| ID | Severidad | Área | Título |
|---|---|---|---|
| D-01 | **Crítica** | Navegación | El botón atrás muestra `(tabs)` |
| D-02 | **Crítica** | Color / Accesibilidad | G/E/P ilegibles sobre el cartel (1,02–1,56:1) |
| D-03 | Alta | Sistema de diseño | Tres lenguajes visuales y `DesignSystem` huérfano |
| D-04 | Alta | Tipografía | 318 tamaños literales y 25 escalas distintas |
| D-05 | Alta | Datos / UX | La ficha de partido es un documento de texto |
| D-06 | Alta | Contenido | Nombres y contexto duplicados hasta el ruido |
| D-07 | Alta | Microcopy | Párrafos estáticos que explican la UI o sus límites |
| D-08 | Alta | Movimiento | App estática: sin pressed, sin háptica, sin transiciones |
| D-09 | Alta | Jerarquía | La ficha de jugador es un formulario |
| D-10 | Alta | Calendario | Filas sin competición, jornada ni próximo partido |
| D-11 | Media | Microcopy | «Noviembre De 2026» por `textTransform: capitalize` |
| D-12 | Alta | Color / Sistema | El papel oscuro se confunde con el fondo (1,11:1) |
| D-13 | Media | Layout | Tiles de Club desbordados y badge que tapa el icono |
| D-14 | Media | Jerarquía | Los filtros de Club ocupan más que el contenido |
| D-15 | Media | Contenido | Patrocinadores como cajas vacías con monograma |
| D-16 | Media | Contenido | Himnos sin reproductor y con media pantalla vacía |
| D-17 | Media | Contenido | Redes planas, todas azules y con el pájaro antiguo de Twitter |
| D-18 | Media | Contenido | Museo con copy repetido y sin información práctica |
| D-19 | Media | Datos | Ciudad deportiva como lista de bullets |
| D-20 | Media | Densidad | Noticias con doble truncado y tres capas de filtro |
| D-21 | Media | Color semántico | Rivalidades invierte G/E/P y usa fechas ISO |
| D-22 | Alta | Accesibilidad | Texto pequeño, abreviaturas y targets sin garantía |
| D-23 | Media | Formato / i18n | Fechas, guiones y miles inconsistentes; GL al 30 % |
| D-24 | Media | Navegación | Contexto de navegación duplicado y tarjetas anidadas |
| D-25 | Baja | Iconografía | Emoji, Ionicons y logos mezclados sin criterio |
| D-26 | Alta | Tokens | 43 hex, 5 familias y decenas de medidas fuera de tokens |

---

## 1. Metodología

### 1.1 Corpus real

| Grupo | Capturas | Nombres |
|---|---:|---|
| Inicio | 4 | `inicio_proximopartido`, `inicio_rival`, `inicio_temporada`, `inicio_clasificacionytitulares` |
| Equipo y fichas | 6 | `equipo`, `equipo_vistaJugador`, `equipo_vistaJugador_Partidos`, `equipo_vistaJugador_Trayectoria`, `equipo_vistaEntrenador`, `equipo_vistaEntrenador_trayectoriaCuerpoTecnico` |
| Calendario y partido | 3 | `calendario_proximos`, `calendario_vistaPartido`, `calendario_vistaPartido2` |
| Noticias | 1 | `Noticias` |
| Club | 15 | `club`, `club_explorar`, `club_cronologia`, `club_estadio`, `club_equipaciones`, `club_escudos`, `club_titulos`, `club_rivalidades`, `club_himnos`, `club_himnos_vistahimno`, `club_junta`, `club_museo`, `club_patrocinadores`, `club_redes`, `club_CiudadDeportiva` |
| Rival | 0 | No hay captura independiente; solo el bloque «El rival» de Inicio |
| **Total** | **29** | |

> El encargo hablaba de 12 capturas de Club y 1 de Rival. La realidad es **15 de Club y 0 de Rival**. La ficha de rival se puntúa por código (`app/rival/[teamId].tsx:106-179`) y se marca como provisional.

### 1.2 Procedimiento

1. Lectura de la línea base (`FASE-0-linea-base.md`), los ADR 0011, 0017, 0019, 0022, 0023 y 0032, `src/theme/tokens.ts` y `src/components/design/DesignSystem.tsx`.
2. Revisión de las capturas **una a una**, con notas inmediatas por pantalla en `FASE-4-notas-inicio.md`, `-equipo.md`, `-calendario.md`, `-noticias.md`, `-club.md`, `-ficha-jugador.md`, `-ficha-partido.md` y `-rival-limitaciones.md`. No se recargaron imágenes ya vistas.
3. Contraste de lo observado con el código: recuento de componentes, tamaños, colores, estados y dependencias.
4. Cálculo de ratios de contraste con los valores de `tokens.ts` (fórmula WCAG 2.1, luminancia relativa).
5. Rúbrica 1–5 por pantalla y redacción de hallazgos con evidencia doble (captura + `path:lines`).
6. Propuestas de patrón con las dependencias ya instaladas: **Reanimated 4.7.1**, **Gesture Handler 3.3**, **SVG 15.16**, **expo-image** y **expo-linear-gradient**.

### 1.3 Rúbrica

Cada pantalla se puntúa de 1 a 5 en once criterios. La nota global es la media aritmética simple (no ponderada), para que ninguna pantalla esconda su problema tras un criterio fuerte.

| Criterio | 1 | 3 | 5 |
|---|---|---|---|
| **Jerarquía** | No se distingue título, cuerpo y acción | Correcta pero plana | Niveles claros y consistentes |
| **Tipografía** | Tamaños arbitrarios y mezclados | Legible con inconsistencias | Escala tokenizada y uso editorial |
| **Color / contraste** | Falla AA en texto | Cumple con excepciones | AA/AAA y semántica estable |
| **Espaciado** | Descuadres y medidas mágicas | Ritmo aceptable | Sistema 4/8 y alineaciones |
| **Componentes** | Cada pantalla inventa | Reutilización parcial | Sistema único con variantes |
| **Dinamismo** | Todo estático | Algunas transiciones | Movimiento con propósito |
| **Interactividad** | Sin feedback ni affordance | Lo básico | Gestos, estados y targets |
| **Datos** | Datos como prosa | Tablas/listas | Visualización adecuada |
| **Densidad** | Muro de texto o desierto | Aceptable | Ritmo editorial |
| **Accesibilidad** | Targets/contraste/escala rotos | Mínimos | AA, texto grande y labels |
| **Modernidad** | Aspecto de formulario | Correcto pero genérico | Producto actual con identidad |

### 1.4 Convenciones de evidencia

- **Captura:** nombre del archivo en `docs/auditoria/capturas/`.
- **Código:** ruta relativa a `apps/mobile/` y líneas.
- **Medido:** recuento obtenido con `grep`/`find` en esta máquina.
- **Estimado:** tamaño en pt inferido de la captura y del código; las capturas no son un viewport estándar.
- **Contraste:** calculado con los hex de `tokens.ts`; no se ha medido con un colorímetro.

### 1.5 Limitaciones

1. **Modo oscuro, no claro.** Las 29 capturas usan `darkColors` y fondo `#0B1220`. El modo claro solo se puede juzgar por tokens (`lightColors`), no visualmente. No se certifica el paso claro↔oscuro ni el contraste del papel claro.
2. **Sin estados de error, offline, carga, vacío, texto grande, Ajustes ni Recordatorios.** Se ha leído `HomeSkeleton`/`LoadingState`, pero no se han visto en pantalla. Tampoco hay capturas de hojas de filtros, modales de foto, comparador de escudos ni búsqueda de noticias.
3. **Sin vídeo.** No se puede evaluar movimiento real, transiciones, gestos, háptica ni reproducción de audio; solo lo que declara el código.
4. **Sin ficha de rival.** La única imagen `inicio_rival.jpeg` es un scroll de Inicio. La rúbrica de rival es provisional.
5. **Artefacto de captura.** Un botón flotante azul con engranaje aparece en todas las imágenes, cambia de posición y tapa contenido (el CTA «Añadir al calendario», el kicker del partido, parte del botón atrás). Es un overlay del dispositivo/grabador, no de la app; no se penaliza, pero invalida esos píxeles.
6. **Sin device/build.** No hay versión de build, modelo de dispositivo ni densidad. Los tamaños en pt son aproximados; se apoyan en el código.
7. **Muestra pequeña.** 29 capturas no cubren las 30+ rutas de la app. Las conclusiones son válidas para lo visto, no para toda la superficie.
8. **Sin pruebas de usuario.** No hay métricas de uso, entrevistas ni tests de tareas. Las afirmaciones de impacto son hipótesis razonadas, no evidencia experimental.
9. **Solo lectura.** No se ha ejecutado la app, así que no se han podido comprobar animaciones, rendimiento, teclado, safe areas ni comportamiento real de los gestos.

---

## 2. Rúbrica por pantalla

> **Leyenda:** JER = Jerarquía · TIP = Tipografía · COL = Color/contraste · ESP = Espaciado · COM = Componentes · DIN = Dinamismo · INT = Interactividad · DAT = Visualización de datos · DEN = Densidad · ACC = Accesibilidad · MOD = Modernidad · **Media** = media de los once.

| Pantalla | JER | TIP | COL | ESP | COM | DIN | INT | DAT | DEN | ACC | MOD | **Media** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Inicio · Próximo partido | 4 | 4 | 4 | 4 | 4 | 2 | 2 | 4 | 4 | 3 | 4 | **3,5** |
| Inicio · El rival | 4 | 4 | 2 | 4 | 4 | 3 | 2 | 4 | 4 | 2 | 4 | **3,4** |
| Inicio · Temporada | 3 | 4 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 4 | **3,1** |
| Inicio · Clasificación y titulares | 3 | 3 | 3 | 3 | 3 | 1 | 2 | 3 | 2 | 3 | 3 | **2,6** |
| Equipo · Plantilla | 3 | 2 | 3 | 3 | 2 | 1 | 2 | 3 | 3 | 2 | 2 | **2,4** |
| Jugador · Resumen | 3 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | **2,0** |
| Jugador · Partidos | 3 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | **2,0** |
| Jugador · Trayectoria | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 2 | 2 | 1 | **1,7** |
| Entrenador · Resumen | 3 | 2 | 2 | 3 | 2 | 1 | 1 | 3 | 2 | 2 | 2 | **2,1** |
| Entrenador · Trayectoria y cuerpo técnico | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 1 | 2 | 1 | **1,6** |
| Calendario · Próximos | 3 | 3 | 3 | 3 | 3 | 1 | 2 | 3 | 3 | 3 | 2 | **2,6** |
| Partido · Resultado y alineaciones | 2 | 1 | 2 | 2 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | **1,4** |
| Partido · Eventos | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | **1,2** |
| Noticias | 4 | 3 | 3 | 3 | 3 | 1 | 3 | 3 | 1 | 3 | 3 | **2,7** |
| Club · Portada | 4 | 4 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 2 | 4 | **3,1** |
| Club · Explorar | 3 | 2 | 3 | 2 | 2 | 1 | 3 | 2 | 2 | 2 | 3 | **2,3** |
| Club · Cronología | 4 | 3 | 3 | 3 | 3 | 1 | 3 | 3 | 3 | 3 | 3 | **2,9** |
| Club · Estadio | 3 | 3 | 3 | 3 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | **2,3** |
| Club · Equipaciones | 2 | 3 | 2 | 2 | 2 | 1 | 2 | 3 | 1 | 2 | 2 | **2,0** |
| Club · Escudos | 3 | 3 | 3 | 3 | 2 | 1 | 3 | 2 | 1 | 2 | 2 | **2,3** |
| Club · Palmarés | 2 | 3 | 3 | 2 | 2 | 1 | 2 | 2 | 1 | 2 | 2 | **2,0** |
| Club · Rivalidades | 3 | 3 | 2 | 3 | 3 | 1 | 2 | 3 | 3 | 2 | 2 | **2,5** |
| Club · Himnos | 2 | 2 | 3 | 2 | 2 | 1 | 2 | 1 | 1 | 2 | 2 | **1,8** |
| Club · Vista de himno | 2 | 3 | 3 | 3 | 2 | 1 | 2 | 1 | 1 | 2 | 2 | **2,0** |
| Club · Junta | 4 | 3 | 3 | 3 | 3 | 1 | 2 | 3 | 3 | 2 | 3 | **2,7** |
| Club · Museo | 2 | 2 | 3 | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | **1,6** |
| Club · Patrocinadores | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | **1,5** |
| Club · Redes | 2 | 3 | 2 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | **1,5** |
| Club · Ciudad deportiva | 3 | 3 | 3 | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 2 | **1,9** |
| Rival · Ficha (provisional) | 4 | 4 | 3 | 4 | 3 | 3 | 2 | 4 | 3 | 2 | 4 | **3,3\*** |

### 2.1 Lectura de la tabla

- **Mejor:** Inicio · Próximo partido (3,5). Es la única pantalla que se acerca a un producto editorial: cartel, jerarquía, aire y una acción clara.
- **Peor:** Partido · Eventos (1,2). No hay un solo recurso visual: ni icono, ni línea temporal, ni agrupación. Es una lista de frases.
- **Mayor brecha interna:** Club. Cronología (2,9) y Junta (2,7) demuestran que el equipo sabe hacer interfaces de datos; Patrocinadores y Redes (1,5) demuestran lo contrario.
- **Problema sistémico:** ninguna pantalla supera 3 en Dinamismo salvo Inicio · Temporada y Rival (3, y por animaciones puntuales). La media de Dinamismo es **1,3**. No es un problema de pantalla, es de plataforma.
- **Accesibilidad:** solo Inicio · Próximo partido, Temporada, Calendario y Cronología llegan a 3. Ninguna llega a 4. El mínimo global es 1 (Redes).

---

## 3. Diagnóstico transversal

### 3.1 Tres lenguajes visuales

| Lenguaje | Dónde | Piezas | Tipografía | Superficie |
|---|---|---|---|---|
| **Cartel + Prensa** | Inicio, Rival | `PosterCard`, `PaperCard`, `SectionHeader`, `StatTile`, `Chip` | Display condensada + serif en papel | Degradado azul / papel cálido |
| **Hero + Editorial** | Club | `HeroHeader`, `Editorial.SectionHeader`, `StatCounter`, `Timeline` | Barlow/Source Serif hardcodeadas | Degradado azul + `Card` |
| **Card genérico** | Equipo, Noticias, Calendario, Partido, Jugador, Entrenador | `Card`, `InfoRow`, `SectionTitle`, `SegmentedControl` | Inter 12–24, sin serif | `surface` plana |

**Medido:** `DesignSystem` se importa en **7 archivos** (`app/(tabs)/index.tsx`, `app/rival/[teamId].tsx` y 5 componentes de Home). Hay **66 `<Card>`**, **4 `<PosterCard>`** y **6 `<PaperCard>`**. `SectionHeader` tiene al menos **cuatro variantes**: la de `DesignSystem`, la de `Editorial.tsx`, la de `src/features/club/sections/ui.tsx` y la local de `app/coach.tsx`.

La identidad no falla por falta de diseño, sino por **falta de adopción**. El sistema está construido para tres pantallas y el resto sigue usando el andamio.

### 3.2 Tipografía sin escala

**Medido:** 318 `fontSize` literales, 25 tamaños distintos (9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 32, 36, 40, 44, 64) y 156 `fontWeight` literales. `tokens.ts` solo define familias (`display`, `headline`, `body`, `numeric`), no tamaños ni interlineados.

Efectos visibles:

- El mismo nivel de título mide 16 en la ficha de jugador, 21 en Club, 23 en Inicio y 27 en Himnos.
- Los totales de estadísticas miden 18 en la ficha, 23 en `StatTile`, 25 en `StatCounter` y 32 en el entrenador.
- Los pesos 600/700/800/900 se usan casi indistintamente; el 800 es el comodín.
- Los textos de 9–12 pt se usan para información primaria (dorsal, etiquetas de stats, subtítulos de partido).

No hay una escala que permita decir «esto es un H2» sin mirar el archivo. Eso hace imposible mantener jerarquía entre pantallas y explicar por qué Inicio parece más «premium» que Equipo.

### 3.3 Color y contraste

| Combinación | Ratio | Uso | Veredicto |
|---|---:|---|---|
| `#07513C` sobre `#00478F` | **1,02:1** | Etiqueta G sobre cartel | Falla AA/AAA |
| `#654A00` sobre `#00478F` | **1,31:1** | Etiqueta E sobre cartel | Falla AA/AAA |
| `#7A1F1A` sobre `#00478F` | **1,56:1** | Etiqueta P sobre cartel | Falla AA/AAA |
| `#151D2A` sobre `#0B1220` | **1,11:1** | PaperCard oscuro vs fondo | Separa mal |
| `#FFF9ED` sobre `#F5F7FA` | **1,02:1** | PaperCard claro vs fondo | Separa mal |
| `#A7B4C4` sobre `#0B1220` | ~8,4:1 | Texto mutado | Correcto |
| `#EAF0F7` sobre `#0B1220` | ~15,9:1 | Texto principal | Correcto |

El problema no es la paleta: es el **uso cruzado**. Los tokens `outcome.*Text` se diseñaron para fondos pastel (`winBackground`), no para el azul del cartel. En `HeadToHeadBar.tsx:40-46` se usan como color de texto sobre `poster` y el resultado es ilegible. Lo mismo ocurre con el papel: en claro y en oscuro se eligió un tono demasiado próximo al fondo, así que la metáfora «Prensa» se queda en un rectángulo invisible.

### 3.4 Espaciado, radio y elevación

**Medido:** 21 `padding`/`margin` con valores literales, 42 `gap` literales y 24 `borderRadius` numéricos fuera de tokens. No es que no existan tokens (`spacing` 4/8/16/24/32, `radius` 8/12/20/24/999), es que se saltan cuando el diseño «necesita» un ajuste.

Consecuencias visibles: alturas de fila irregulares en la ficha de jugador, tarjetas de patrocinador de 300×230, tarjetas anidadas con doble borde en Inicio, chips de 56 px que ocupan dos filas. La app no tiene un ritmo vertical; tiene una suma de decisiones locales.

### 3.5 Movimiento e interacción

**Medido:** 1 `({ pressed })` en todo el código (`JuntaSection.tsx:53`), 0 `android_ripple`, 0 `onPressIn`/`onPressOut`, 0 háptica, 1 archivo con Reanimated (`PositionChart.tsx`) y 5 `Animated.timing` (`Editorial.tsx`, `WeatherLine.tsx`, `Countdown.tsx`, `NextMatchCard.tsx`, `HeadToHeadBar.tsx`).

La app tiene Reanimated 4 y Gesture Handler 3 instalados, pero los usa solo para el gráfico de posición. No hay:

- feedback al pulsar tarjetas, chips, filas o enlaces;
- transición al cambiar de pestaña o de filtro;
- entrada escalonada de listas;
- gesto de swipe en noticias, calendario o equipaciones;
- háptica (y `expo-haptics` no está instalado, así que no se puede prometer sin añadir dependencia).

El resultado es una app que **se ve** editorial pero **se siente** de formulario. El propietario pedía «moderna, dinámica e interactiva»; hoy solo cumple la primera parte, y solo en Inicio.

### 3.6 Densidad y texto estático

Hay dos extremos:

- **Muro de texto:** ficha de partido (seis metadatos, alineaciones en párrafos, eventos en frases), ficha de jugador (7 campos + 5 stats + 2 segmentados), noticias (titular 3 líneas + extracto 2 + metadatos).
- **Desierto:** himnos (media pantalla vacía), museo (sin fotos ni horarios), ciudad deportiva (5 bullets y media pantalla), patrocinadores (cajas de 300×230 con un monograma).

Ninguno de los dos es densidad editorial. La densidad correcta es **información por pantalla con jerarquía**: un dato grande, dos secundarios, una acción. Hoy o hay demasiado texto o no hay nada que mirar.

### 3.7 Accesibilidad

| Problema | Evidencia | Consecuencia |
|---|---|---|
| Texto de 9–12 pt para información primaria | `player/[id].tsx:68-93` (etiquetas de stats a 11), `HeadToHeadBar.tsx:64-70` (12) | Difícil para vista cansada o baja visión |
| Abreviaturas sin leyenda | «PJ G min TA TR» en ficha; «GF-GC», «DG» en Inicio | El usuario tiene que saber argot |
| Enlaces de 13 pt sin altura mínima | «Abrir ficha del rival →» en Inicio | Target pequeño, difícil de tocar |
| Colores semánticos invertidos | Rivalidades: G azul, P rosa, E gris | Se pierde el significado aprendido en el resto |
| Sin estrategia de texto grande | `typography.displayMaxFontSizeMultiplier` existe, pero no se aplica globalmente | El layout puede romperse con tamaño de fuente del sistema |
| Gráficos sin descripción visual | `PositionChart` depende de párrafos; la barra H2H tiene `accessibilityLabel`, pero el gráfico no tiene equivalente táctil | Usuarios de lector de pantalla pierden el dato |

No se ha podido probar VoiceOver/TalkBack ni texto grande. Lo que se ve en código no permite certificar AA.

### 3.8 Microcopy y formatos

| Problema | Ejemplo | Dónde |
|---|---|---|
| Estado contradictorio | «Pendiente de actualizar» + fecha y hora exactas | `inicio_proximopartido.jpeg` |
| Instrucción obvia | «Usa el selector para saltar de década» | `club_equipaciones.jpeg` |
| Explicación de límite | «El recordatorio estará disponible cuando se confirme la hora» (4 líneas) | `inicio_proximopartido.jpeg` |
| Procedencia con más peso que el dato | Chip «Fuente oficial · Confianza: contrastado» | `club_estadio.jpeg` |
| Capitalización inglesa | «Noviembre De 2026» | `calendario_proximos.jpeg` |
| Nombre duplicado | «Deportivo de La Coruña» / «Deportivo de A Coruña» | Trayectoria, rivalidades, eventos |
| Fecha técnica | «2018-05-05» | `club_rivalidades.jpeg` |
| Sin separador de miles | «4957 min», «8168 min» | Trayectoria |
| Texto legal en el flujo | «Proyecto de aficionados sin vinculación oficial…» | `club.jpeg` |
| Cita en gallego sin contexto | «Onde nace o futuro» | `club_CiudadDeportiva.jpeg` |

El tono es institucional y explicativo. Para una app de aficionado debería ser **directo, breve y con una sola idea por línea**. Cada párrafo que explica la UI es una señal de que la UI no se entiende sola.

### 3.9 Navegación y chrome

- `(tabs)` como botón atrás en la ficha de partido: `app/_layout.tsx:50` no define `headerBackTitle`; Expo Router usa el nombre del grupo.
- Píldora «Equipo» en jugador/entrenador: `app/_layout.tsx:51-52` define `headerBackTitle`, pero en iOS se muestra como una píldora blanca que compite con el título y, en la ficha, tapa contenido.
- Título «Entrenador» + píldora «Equipo»: dos contextos de navegación a la vez.
- Tarjetas dentro de tarjetas en Inicio · Clasificación: doble borde y doble radio.
- Aviso legal a ancho completo entre el hero y las cifras: rompe el ritmo y se repite en Ajustes/Acerca de.

La app necesita **una sola estrategia de cabecera**: título grande en el contenido, chevron mínimo, sin texto de atrás, y acciones a la derecha. El título nativo centrado puede quedarse para pantallas de utilidad, no para fichas editoriales.

### 3.10 Presentación de datos

| Dato | Cómo se presenta hoy | Cómo debería |
|---|---|---|
| Alineaciones | Una línea por jugador, dos bloques | Dos columnas + campo SVG + dorsales |
| Goles/tarjetas/cambios | Párrafos dentro de tarjetas | Línea temporal con iconos y minuto |
| Trayectoria | Lista de filas idénticas | Raíl SVG con etapa actual resaltada |
| Balance G/E/P | Barra + texto; en Club, colores invertidos | Barra + chips semánticos consistentes |
| Posición en liga | SVG dependiente de 4 líneas de texto | Gráfico con eje, tooltip y gesto |
| Palmarés | 9 chips + resumen textual | Cifra grande + rejilla de trofeos por década |
| Aforo | Tarjeta anidada + párrafo técnico | Cifra 32.490 en display + unidad |
| Instalaciones | 5 bullets | 3 stat tiles + 2 feature cards |

La app tiene los datos. Lo que falta es **traducirlos a forma visual**.

---

## 4. Hallazgos

> **Plantilla:** Área · Severidad · Evidencia · Qué ocurre · Causa raíz · Impacto · Recomendación · Alternativas · Esfuerzo · Riesgo · Dependencias.
>
> **Escala de esfuerzo:** S ≤ 1 día · M = 2–5 días · L ≥ 1 semana. **Riesgo:** probabilidad de regresión visual o de datos.

### D-01 · El botón atrás muestra `(tabs)`

- **Área:** Navegación / chrome.
- **Severidad:** **Crítica**.
- **Evidencia:** `calendario_vistaPartido.jpeg`, `calendario_vistaPartido2.jpeg`; `app/match/[id].tsx:44` y `app/_layout.tsx:50-52`.
- **Qué ocurre:** al abrir una ficha de partido, la cabecera muestra el botón atrás con el texto literal `(tabs)`. Es el nombre del grupo de rutas de Expo Router, no una etiqueta de producto.
- **Causa raíz:** `Stack.Screen name="match/[id]"` define `title` pero no `headerBackTitle`. Expo Router deriva el texto del segmento padre (`(tabs)`) y lo filtra a la UI. Jugador y entrenador sí definen `headerBackTitle` (`_layout.tsx:51-52`), lo que confirma que es una omisión, no una limitación.
- **Impacto:** el defecto aparece en cada entrada a la ficha de partido, una de las rutas más importantes. Comunica «build de desarrollo» y rompe la confianza en el resto del producto. Es el primer hallazgo que vería cualquier revisión externa.
- **Recomendación:** añadir `headerBackTitle: t('tabs.calendar')` o `headerBackButtonDisplayMode: 'minimal'` en `match/[id]`; centralizar la configuración de cabeceras por ruta y añadir una prueba visual de todas las rutas.
- **Alternativas:** (a) ocultar el texto de atrás en todas las rutas y usar solo chevron; (b) cabecera propia con `headerShown: false` y botón explícito.
- **Esfuerzo:** **S**.
- **Riesgo:** **Bajo**; solo afecta al chrome, no a datos.
- **Dependencias:** `app/_layout.tsx`, claves i18n `tabs.calendar`, `match.title`.

### D-02 · G/E/P ilegibles sobre el cartel (1,02–1,56:1)

- **Área:** Color / accesibilidad.
- **Severidad:** **Crítica**.
- **Evidencia:** `inicio_rival.jpeg`; `src/components/rival/HeadToHeadBar.tsx:40-65`; `src/theme/tokens.ts:69-74`.
- **Qué ocurre:** la barra histórica G/E/P usa como color de texto `#07513C` (verde), `#654A00` (ámbar) y `#7A1F1A` (rojo) sobre el azul del cartel `#00478F`. Los ratios son **1,02:1, 1,31:1 y 1,56:1**: muy por debajo de 4,5:1 para texto normal y de 3:1 para texto grande.
- **Causa raíz:** se reutilizan los tokens `poster.outcome.*Text`, pensados para fondos pastel (`winBackground`, `drawBackground`, `lossBackground`), como color de primer plano sobre el degradado azul. No existe una variante de etiqueta para cartel.
- **Impacto:** el dato central del bloque «El rival» —el balance histórico— es prácticamente ilegible. Afecta a usuarios con visión normal en exterior y a cualquier usuario con baja visión. Es un fallo de accesibilidad objetivo, no una preferencia.
- **Recomendación:** usar `poster.text` (#FFFFFF) para las etiquetas y reservar el color semántico para un punto/chip de 8–10 px con fondo pastel; o usar tints claros (`#C7F2DD`, `#FFF0BD`, `#FFDAD7`) sobre el azul. Verificar ≥4,5:1 y añadir el ratio al ADR de color.
- **Alternativas:** (a) mover las etiquetas debajo de la barra, sobre `paper`, donde los tokens actuales sí funcionan; (b) usar posición + patrón (rayas) y texto blanco, sin depender del color.
- **Esfuerzo:** **S**.
- **Riesgo:** **Bajo**; cambio local y verificable.
- **Dependencias:** `HeadToHeadBar.tsx`, `tokens.ts`, cálculo de contraste.

### D-03 · Tres lenguajes visuales y `DesignSystem` huérfano

- **Área:** Sistema de diseño.
- **Severidad:** **Alta**.
- **Evidencia:** todas las capturas; `src/components/design/DesignSystem.tsx`; `src/components/club/Editorial.tsx`; `src/components/Screen.tsx:25-32`. **Medido:** `DesignSystem` se importa en 7 archivos; 66 `<Card>`, 4 `<PosterCard>`, 6 `<PaperCard>`; 4 variantes de `SectionHeader`.
- **Qué ocurre:** Inicio y Rival usan Cartel/Prensa; Club usa `HeroHeader` + `Editorial` con fuentes y tamaños propios; Equipo, Noticias, Calendario, Partido y Jugador usan `Card` genérica. No hay una regla que diga cuándo usar cada uno.
- **Causa raíz:** el `DesignSystem` se construyó para Home y no se adoptó fuera; Club resolvió sus necesidades creando `Editorial.tsx`; `Screen.tsx` mantuvo `Card` como denominador común. No hay deprecación ni guía de migración.
- **Impacto:** el usuario cambia de tab y tiene que releer la jerarquía; la marca se diluye; cada arreglo visual hay que hacerlo tres veces. Es la causa raíz de la mitad de los hallazgos de este informe.
- **Recomendación:** promover un único `Surface` con tres variantes (`poster`, `paper`, `flat`) y un `SectionHeader` con tres niveles (`display`, `section`, `compact`). Migrar por módulos, empezando por Equipo y Partido. Deprecar `Card` para contenido de feature; dejarlo solo para filas de utilidad.
- **Alternativas:** (a) mantener tres sistemas pero documentar reglas estrictas y compartir tokens; (b) quedarse solo con Cartel/Prensa y eliminar el lenguaje de Club; más rápido pero pierde la riqueza editorial.
- **Esfuerzo:** **L**.
- **Riesgo:** **Medio**; regresión visual en 20+ pantallas. Hacerlo por módulos y con capturas de referencia.
- **Dependencias:** `DesignSystem.tsx`, `Editorial.tsx`, `Screen.tsx`, `tokens.ts`, ADR de sistema visual.

### D-04 · 318 tamaños literales y 25 escalas distintas

- **Área:** Tipografía.
- **Severidad:** **Alta**.
- **Evidencia:** todas las capturas; **medido** en `app/` y `src/`: 318 `fontSize:` literales, 25 valores distintos (9–64), 156 `fontWeight` literales. `src/theme/tokens.ts:115-121` solo define familias.
- **Qué ocurre:** no hay escala tipográfica. El mismo nivel semántico mide 16, 18, 21, 23, 24 o 27 según la pantalla. Los pesos 600/700/800/900 se usan como sinónimos.
- **Causa raíz:** `typography` solo contiene `display`, `headline`, `body`, `numeric` y un multiplicador; no hay tamaños, interlineados ni pesos. Cada componente inventa su combinación.
- **Impacto:** la jerarquía es inconsistente entre pantallas; Inicio parece más cuidado que Equipo sin razón funcional; cualquier ajuste global es imposible; el texto grande del sistema rompe layouts impredecibles.
- **Recomendación:** definir una escala de 8 pasos con tamaño, interlineado y peso (p. ej. `display 40/44 800`, `h1 28/32 800`, `h2 22/28 700`, `h3 18/24 700`, `body 16/22 400`, `small 14/20 400`, `caption 12/16 600`, `micro 11/14 700`). Migrar por módulos y añadir regla ESLint que prohíba `fontSize`/`fontWeight` fuera de tokens.
- **Alternativas:** escala de 6 pasos si 8 es demasiado; nombres semánticos (`hero`, `title`, `body`, `meta`) en vez de numéricos.
- **Esfuerzo:** **L** (mecánico pero extenso).
- **Riesgo:** **Medio**; cambios de layout por interlineados. Hacer con captura antes/después por pantalla.
- **Dependencias:** `tokens.ts`, ESLint, todas las pantallas.

### D-05 · La ficha de partido es un documento de texto

- **Área:** Presentación de datos / UX.
- **Severidad:** **Alta**.
- **Evidencia:** `calendario_vistaPartido.jpeg`, `calendario_vistaPartido2.jpeg`; `app/match/[id].tsx:21-30` (`InfoRow`), `:151-156` (seis metadatos), `:224-282` (alineaciones), `:288-330` (eventos).
- **Qué ocurre:** el hero es una `Card` plana con escudos 56, «2 – 1» 28 y «Resultado final» 14, sin competición, fecha ni sede. Debajo, seis `InfoRow` verticales (fecha, hora, jornada, sede, árbitro, descanso) ocupan ~560 px. Las alineaciones son una línea por jugador («13 · Leo Román»), sin campo, sin dorsales en badge y sin dos columnas. Goles, tarjetas y cambios son **párrafos** de 15/22 pt; los cambios mezclan «Quagliata → Adama» con «Sale: Moro / Entra: Rubén García» y repiten entradas/salidas del mismo minuto en filas separadas.
- **Causa raíz:** el modelo de datos se renderiza directamente con `Text`; no existe un componente de partido. `InfoRow` es un par etiqueta/valor genérico y `eventLine` es un `Text` con formato. No hay SVG ni línea temporal.
- **Impacto:** la pantalla que debería ser el momento culminante del producto se lee como un acta administrativa. El usuario no puede escanear goles, tarjetas o cambios; el marcador no se conecta con la cronología; el ancho se desaprovecha (las líneas terminan a media tarjeta).
- **Recomendación:** reestructurar en tres capas: (1) `ScoreboardHero` con degradado, competición, fecha, sede y marcador grande; (2) tabs «Resumen / Alineaciones / Eventos»; (3) `MatchTimeline` agrupada por tiempo y equipo, con iconos de balón/tarjeta/cambio y progresión del marcador. En Alineaciones, campo SVG con dos columnas y dorsales.
- **Alternativas:** (a) empezar solo por la línea temporal (sin campo) para reducir esfuerzo; (b) mantener las alineaciones en lista pero con dos columnas y badges, y dejar el campo para una segunda iteración.
- **Esfuerzo:** **L**.
- **Riesgo:** **Medio**; hay partidos sin alineaciones/eventos y hay que diseñar estados vacíos. También hay que validar la calidad de los datos de cambios.
- **Dependencias:** `match-details` API, `react-native-svg`, Reanimated, Gesture Handler, i18n.

### D-06 · Nombres y contexto duplicados hasta el ruido

- **Área:** Contenido / UX.
- **Severidad:** **Alta**.
- **Evidencia:** `club_rivalidades.jpeg`, `calendario_vistaPartido2.jpeg`, `equipo_vistaJugador_Partidos.jpeg`, `equipo_vistaJugador_Trayectoria.jpeg`; `src/components/CareerTimeline.tsx`, `src/components/MatchCard.tsx`, `src/features/club/sections/RivalidadesSection.tsx`.
- **Qué ocurre:** conviven «Deportivo de La Coruña» y «Deportivo de A Coruña»; «LaLiga» se repite en cada fila de partidos; el nombre completo del club se repite en cada evento y en cada cruce de rivalidades; las fechas largas («16 de octubre de 2026 · Local · LaLiga») rompen en 2–3 líneas.
- **Causa raíz:** las fuentes de datos usan nombres oficiales distintos y los componentes renderizan la cadena completa. No hay capa de normalización ni de formato corto.
- **Impacto:** ruido visual, filas de altura irregular, duda sobre cuál es el nombre oficial y sensación de datos sin curar. En una app de aficionado, el nombre del club es identidad: si baila, el producto pierde autoridad.
- **Recomendación:** definir nombre canónico + nombre corto + abreviatura; usar el corto en listas y el completo solo en detalle; agrupar por competición/mes para no repetir «LaLiga»; fechas relativas («sáb 7 nov») y contexto en una línea. Decidir oficialmente «A Coruña» o «La Coruña» y aplicarlo en datos, i18n y copy.
- **Alternativas:** mantener el nombre completo pero reducirlo a 13 pt y truncar; no resuelve la duplicación.
- **Esfuerzo:** **M**.
- **Riesgo:** **Bajo/Medio**; requiere tocar transformación de datos y revisar textos legales.
- **Dependencias:** `packages/schemas`, `scripts/depor_hub/transform.py`, `src/utils/matchTime.ts`, i18n.

### D-07 · Párrafos estáticos que explican la UI o sus límites

- **Área:** Microcopy.
- **Severidad:** **Alta**.
- **Evidencia:** `inicio_proximopartido.jpeg` (párrafo de 4 líneas sobre el recordatorio), `equipo_vistaEntrenador.jpeg` («Calculado con los partidos terminados…»), `club_equipaciones.jpeg` (intro de 3 líneas), `club_himnos_vistahimno.jpeg` (tres capas de texto para una acción), `club_museo.jpeg` (frase repetida en las tres modalidades).
- **Qué ocurre:** se usan párrafos para explicar limitaciones, procedencia o cómo funciona la pantalla. El texto ocupa el espacio de la acción y convierte la pantalla en documentación.
- **Causa raíz:** la UI no se entiende sola y se compensa con copy; no hay un sistema de microcopy ni de estados. Las cadenas largas se añadieron sin revisar densidad.
- **Impacto:** el usuario no lee; la pantalla parece más compleja de lo que es; el CTA pierde protagonismo. En el caso del recordatorio, además hay contradicción: se muestra fecha/hora exactas y se dice que no está confirmado.
- **Recomendación:** sustituir por un estado breve + icono: «Recordatorio disponible al confirmar la hora» en una línea, o el botón deshabilitado con motivo corto. Mover procedencia a un pie de tarjeta. Eliminar instrucciones que la UI hace obvias. Un solo mensaje por estado.
- **Alternativas:** (a) «Más información» colapsable para el texto largo; (b) mover la explicación a un tooltip accesible.
- **Esfuerzo:** **M**.
- **Riesgo:** **Bajo**.
- **Dependencias:** i18n, componentes de estado, revisión de copy.

### D-08 · App estática: sin pressed, sin háptica, sin transiciones

- **Área:** Movimiento / interacción.
- **Severidad:** **Alta**.
- **Evidencia:** todas las capturas; **medido:** 1 `({ pressed })` (`src/features/club/sections/JuntaSection.tsx:53`), 0 `android_ripple`, 0 `onPressIn`/`onPressOut`, 0 háptica, 1 archivo con Reanimated (`src/components/home/PositionChart.tsx`), 5 `Animated.timing` (`Editorial.tsx`, `WeatherLine.tsx`, `Countdown.tsx`, `NextMatchCard.tsx`, `HeadToHeadBar.tsx`).
- **Qué ocurre:** casi ningún elemento responde al tacto. Las tarjetas, chips, filas y enlaces no tienen estado pressed; no hay transición al cambiar de pestaña/filtro; las listas aparecen de golpe; no hay gestos de swipe.
- **Causa raíz:** no hay primitivas de interacción (`PressableScale`, `StaggerList`, `AnimatedTabs`). Reanimated y Gesture Handler están instalados pero solo se usan en un gráfico. `expo-haptics` no está instalado.
- **Impacto:** la app se siente más antigua que su diseño; el usuario duda si un elemento es pulsable; se pierden oportunidades de deleite en una app de contenido emocional (un gol, un fichaje, un título).
- **Recomendación:** crear `PressableScale` (Reanimated `useSharedValue` + `withSpring`, escala 0.97, opacidad 0.9) y `StaggerList` (`FadeInUp` con `delay = index * 40`); usar `LinearTransition` al filtrar; `AnimatedTabs` con indicador deslizante. Si se aprueba añadir `expo-haptics`, limitar a acciones clave (gol, favorito, filtro), nunca a scroll.
- **Alternativas:** (a) solo `Pressable` con opacidad y `Animated` de RN, sin nuevas dependencias; (b) Reanimated + Gesture Handler, que ya están instalados, sin háptica.
- **Esfuerzo:** **M**.
- **Riesgo:** **Bajo**; animaciones con `useReducedMotion` y sin bloquear la UI.
- **Dependencias:** Reanimated 4.7.1, Gesture Handler 3.3, `useReducedMotion`; `expo-haptics` solo si se aprueba.

### D-09 · La ficha de jugador es un formulario

- **Área:** Jerarquía / UX.
- **Severidad:** **Alta**.
- **Evidencia:** `equipo_vistaJugador.jpeg`, `equipo_vistaJugador_Partidos.jpeg`, `equipo_vistaJugador_Trayectoria.jpeg`; `app/player/[id].tsx:452-548`, `:510`, `:520`, `:68-93`, `:534-548`.
- **Qué ocurre:** el hero es retrato 96, nombre 24 en dos líneas, identidad 13, dorsal 44 + «DORSAL» 10. Debajo, **dos `SegmentedControl` consecutivos** de ancho completo: uno elige ámbito («Depor 26-27 / Carrera») y otro pestaña («Resumen / Partidos / Carrera»). La franja de stats tiene 5 columnas con icono 17, número 18 y etiqueta 11 («PJ G min TA TR»). «Datos» es una rejilla de 2 columnas con 7 campos, etiqueta 12 y valor 15; «Lugar de nacimiento» rompe a dos líneas y descuadra.
- **Causa raíz:** se reutilizan `Card` y `SegmentedControl` para dos ejes distintos; no hay hero de jugador, ni stat tile, ni cabecera sticky. La ficha se construyó como suma de campos, no como cromo.
- **Impacto:** el jugador —el contenido más emocional— se siente administrativo. El usuario no sabe si el primer segmentado cambia de temporada o de sección; al cambiar de pestaña desaparece el nombre/dorsal y se pierde el contexto. El 70 % de la pantalla es texto de 12–15 pt sobre tarjetas idénticas.
- **Recomendación:** hero a sangre con retrato `expo-image`, degradado y dorsal en display 64; cabecera compacta sticky con nombre + dorsal al hacer scroll; un solo tab bar (Resumen/Partidos/Carrera) y el ámbito en un control secundario (pill o menú); 5 stat tiles con número grande y leyenda en bottom sheet; datos en 2 columnas de altura fija; partidos agrupados por mes.
- **Alternativas:** (a) mantener el hero actual pero eliminar el primer segmentado y mover el ámbito a un desplegable; (b) convertir la ficha en una sola página scrollable con secciones y anclas, sin tabs.
- **Esfuerzo:** **L**.
- **Riesgo:** **Medio**; hay campos opcionales y jugadores con trayectorias incompletas.
- **Dependencias:** `player/[id].tsx`, `CareerTimeline`, expo-image, expo-linear-gradient, Reanimated.

### D-10 · Filas de calendario sin competición, jornada ni próximo partido

- **Área:** Calendario / datos.
- **Severidad:** **Alta**.
- **Evidencia:** `calendario_proximos.jpeg`; `src/components/MatchCard.tsx` (columna de fecha 84), `app/(tabs)/calendar.tsx:94-106`.
- **Qué ocurre:** cada fila muestra fecha corta + hora y dos equipos con escudo. No hay competición, jornada, local/visitante ni marca de «próximo partido». «Hora por confirmar» rompe en dos líneas en la columna estrecha y hace las filas irregulares. No hay chevron ni feedback de pulsación.
- **Causa raíz:** `MatchCard` se diseñó como fila mínima de fixture; el modelo tiene competición y jornada, pero no se renderizan. La columna de fecha es fija (84) y el texto no tiene variante compacta.
- **Impacto:** el usuario no distingue Liga/Copa, no sabe qué jornada es ni cuál es el próximo partido; las alturas irregulares parecen un bug. La pantalla es funcional pero no ayuda a planificar.
- **Recomendación:** añadir chip de competición + jornada + local/visitante; marcar el próximo con borde/acento y etiqueta; sustituir «Hora por confirmar» por un badge compacto «Por confirmar»; cabeceras de mes sticky; chevron o `PressableScale`.
- **Alternativas:** agrupar por competición dentro del mes; útil pero añade jerarquía y esfuerzo.
- **Esfuerzo:** **M**.
- **Riesgo:** **Bajo**.
- **Dependencias:** `fixtures.json`, `MatchCard.tsx`, `calendar.tsx`, i18n.

### D-11 · «Noviembre De 2026» por `textTransform: capitalize`

- **Área:** Microcopy / formato.
- **Severidad:** **Media**.
- **Evidencia:** `calendario_proximos.jpeg`; `app/(tabs)/calendar.tsx:106`.
- **Qué ocurre:** las cabeceras de mes muestran «Noviembre De 2026», «Diciembre De 2026». La preposición «de» va en mayúscula, un patrón de título inglés.
- **Causa raíz:** `textTransform: 'capitalize'` sobre el resultado de `formatMonth`, que devuelve «noviembre de 2026». `capitalize` capitaliza cada palabra, no solo la primera.
- **Impacto:** error gramatical visible en una pantalla principal; rompe la sensación de cuidado. Es barato de arreglar y muy visible.
- **Recomendación:** eliminar `textTransform` y capitalizar solo la primera letra en `formatMonth` (o usar `Intl.DateTimeFormat` con `month: 'long'` y `year: 'numeric'`). Añadir prueba unitaria para ES/GL/EN.
- **Alternativas:** hardcodear los nombres de mes por locale; menos flexible pero controla el formato.
- **Esfuerzo:** **S**.
- **Riesgo:** **Bajo**.
- **Dependencias:** `src/utils/matchTime.ts`, `calendar.tsx`, tests.

### D-12 · El papel oscuro se confunde con el fondo (1,11:1)

- **Área:** Color / sistema.
- **Severidad:** **Alta**.
- **Evidencia:** `inicio_temporada.jpeg`; `src/theme/tokens.ts:86-92` (`paper.background: #151D2A` sobre `background: #0B1220`) y `:43` (`#FFF9ED` sobre `#F5F7FA`).
- **Qué ocurre:** la `PaperCard` apenas se separa del fondo: 1,11:1 en oscuro y 1,02:1 en claro. En las capturas, la metáfora «Prensa» se reduce a un rectángulo casi invisible; el contraste Cartel/Prensa queda en azul vs negro.
- **Causa raíz:** los tokens de papel se eligieron para un look editorial claro y se reutilizaron en oscuro sin elevación ni borde. No hay token de `surface` específico para papel ni sombra.
- **Impacto:** las secciones se funden; se pierde la separación entre «momento» (cartel) y «lectura» (papel); el sistema visual no se entiende en el modo que realmente se usa.
- **Recomendación:** en oscuro, usar un papel cálido elevado (p. ej. `#1B2433`) con borde de 1 px y sombra suave; en claro, añadir borde y sombra. Mantener separación de superficie ≥1,3:1 y texto ≥4,5:1. Documentar el par en tokens.
- **Alternativas:** (a) usar el degradado de cartel para tarjetas destacadas y `surface` plana para el resto; (b) añadir textura de papel sutil; más riesgo visual.
- **Esfuerzo:** **S/M**.
- **Riesgo:** **Bajo**.
- **Dependencias:** `tokens.ts`, `PaperCard`, `DesignSystem`.

### D-13 · Tiles de Club desbordados y badge que tapa el icono

- **Área:** Layout.
- **Severidad:** **Media**.
- **Evidencia:** `club_explorar.jpeg`; `app/(tabs)/club.tsx:143-158`; `sectionBadge`/`sectionImage` en `:17-40`.
- **Qué ocurre:** la rejilla 2×N de 14 secciones usa una zona de arte de 66 px con icono en círculo blanco y badge azul arriba-derecha. «Ciudad deportiva» y «Junta y organigrama» rompen en dos líneas y empujan el subtítulo; otros se truncan («fabricantes y patrocin…»). El badge «32.490» es tan ancho que tapa el icono del estadio. Los 14 iconos son genéricos y del mismo color; el tile de Equipaciones mete una foto de camiseta con fondo blanco.
- **Causa raíz:** altura de tile fija, badge sin ancho máximo, títulos sin reserva de dos líneas y arte genérico. No hay una regla de truncado ni de color por categoría.
- **Impacto:** los títulos no se leen, la composición se rompe y el usuario no distingue secciones. Es la primera pantalla de descubrimiento de Club y parece una cuadrícula de accesos de una app interna.
- **Recomendación:** rejilla 2 columnas con arte 4:3 (foto o degradado por categoría), badge limitado a 4 caracteres o formato «32,5k», título con 2 líneas reservadas y subtítulo opcional de 1 línea; icono de categoría con color; imagen de equipación con fondo neutro.
- **Alternativas:** lista de filas con icono + título + badge; más legible pero menos visual.
- **Esfuerzo:** **M**.
- **Riesgo:** **Bajo**.
- **Dependencias:** `club.json`, imágenes, expo-image.

### D-14 · Los filtros de Club ocupan más que el contenido

- **Área:** Jerarquía / filtros.
- **Severidad:** **Media**.
- **Evidencia:** `club_cronologia.jpeg` (6 chips en 2 filas, ~250 px), `club_equipaciones.jpeg` (2 filas de chips), `club_titulos.jpeg` (9 chips en 5 filas), `club.jpeg` (rejilla de cifras rota: 1.906/42/21 + 32.490 sola; icono de información no pulsable; chips de apodo que parecen filtros).
- **Qué ocurre:** los filtros de 56 px se envuelven y ocupan media pantalla antes de ver contenido. En la portada, la rejilla de cifras se rompe por `flexWrap` + `flexGrow`; el icono «i» invita a tocar y no hace nada; los chips de apodo parecen filtros.
- **Causa raíz:** se usa un patrón de chips de ancho completo para muchas opciones; no hay scroll horizontal ni hoja de filtros. Las cifras usan un grid flexible sin celdas iguales. Los chips estáticos no tienen variante visual.
- **Impacto:** el usuario hace scroll antes de ver lo que busca; la jerarquía se invierte (filtro > contenido); los falsos affordances generan toques muertos.
- **Recomendación:** una sola fila horizontal scrollable de chips (con «Todos» y un botón de filtros si hay muchas); barra sticky; cifras en 2×2 con celdas iguales; chips estáticos como etiquetas planas o eliminarlos; icono «i» como botón real o quitarlo.
- **Alternativas:** hoja de filtros inferior para 9+ competiciones; más escalable.
- **Esfuerzo:** **M**.
- **Riesgo:** **Bajo**.
- **Dependencias:** secciones de Club, `ui.tsx`, i18n.

### D-15 · Patrocinadores como cajas vacías con monograma

- **Área:** Contenido / datos.
- **Severidad:** **Media**.
- **Evidencia:** `club_patrocinadores.jpeg`; `src/features/club/sections/PatrocinadoresSection.tsx:20-80`.
- **Qué ocurre:** 17 patrocinadores se muestran en tarjetas de ~300×230 con monograma de iniciales y nombre. No hay logo, enlace ni rol en la mayoría; el 70 % de la tarjeta es aire. El resultado es un scroll infinito de cajas vacías.
- **Causa raíz:** faltan assets de logo y el componente cae en un monograma; la tarjeta está dimensionada para un logo que no existe. No hay enlace en el modelo o no se renderiza.
- **Impacto:** la pantalla parece sin terminar; el usuario no reconoce las marcas ni puede visitarlas; un contenido comercial queda reducido a relleno.
- **Recomendación:** rejilla compacta de 3 columnas con área de logo de 72–96 px, nombre y rol; enlace externo si existe; si no hay logo, usar un wordmark neutro pequeño, no una tarjeta gigante. Separar «Principal / Técnico / Oficiales / Colaboradores».
- **Alternativas:** lista de filas con nombre + rol + enlace; mínimo esfuerzo y más legible.
- **Esfuerzo:** **M**.
- **Riesgo:** **Bajo/Medio**; depende de assets y permisos de marca.
- **Dependencias:** logos, `Linking`, `club.json`.

### D-16 · Himnos sin reproductor y con media pantalla vacía

- **Área:** Contenido / interacción.
- **Severidad:** **Media**.
- **Evidencia:** `club_himnos.jpeg`, `club_himnos_vistahimno.jpeg`; `src/features/club/sections/HimnosSection.tsx`, `src/features/club/AnthemDetail.tsx`.
- **Qué ocurre:** tres tarjetas con icono musical en círculo 70, título 27, meta 18, estado «Letra disponible en la fuente» / «Letra pendiente», play 44 solo en el oficial y chevron. Media pantalla vacía. La vista de himno es un hero 40 + chips + párrafo serif + «Reproducción oficial» con explicación de dos líneas + botón azul gigante + caption + «Letra» con caja vacía + «Créditos» en párrafos. No hay duración, artista, onda ni reproductor embebido.
- **Causa raíz:** no hay reproducción de audio en la app; el detalle abre la fuente externa. La UI se construyó alrededor del texto, no del audio.
- **Impacto:** el himno —un activo emocional— se siente como un documento. El usuario sale de la app para escucharlo; se pierde la ocasión de producto.
- **Recomendación:** tarjeta con portada/artista, duración, play y barra de progreso; si el audio es externo, etiquetar «Abrir en fuente oficial» con icono externo y no fingir un reproductor. Si se añade audio, usar onda SVG estática + progreso Reanimated. Reducir la vista a: hero, reproductor/CTA, letra plegable, créditos.
- **Alternativas:** un solo CTA externo con una tarjeta editorial; mucho menos esfuerzo y más honesto.
- **Esfuerzo:** **M/L**.
- **Riesgo:** **Medio**; derechos de audio, streaming y dependencia nueva (`expo-audio`/`expo-av`) no confirmada.
- **Dependencias:** fuente de audio, reproductor, assets, derechos.

### D-17 · Redes planas, todas azules y con el pájaro antiguo de Twitter

- **Área:** Contenido / iconografía.
- **Severidad:** **Media**.
- **Evidencia:** `club_redes.jpeg`; `src/features/club/sections/RedesSection.tsx:16-27`, `:56-122`.
- **Qué ocurre:** 10 filas de ~120 px con icono 28 + etiqueta 21 azul + icono de enlace externo 24. Todo es azul y del mismo peso. El icono de X es el pájaro antiguo de Twitter, mientras la ficha de jugador usa `logo-x`. No hay descripción, handle ni marca visual.
- **Causa raíz:** se usa una lista de Ionicons genéricos; no hay un set de iconos de marca ni una política de enlaces. La altura de fila es excesiva para el contenido.
- **Impacto:** la pantalla parece una lista de enlaces de 2012; el usuario no distingue canales oficiales de enlaces secundarios; el icono incorrecto resta credibilidad.
- **Recomendación:** filas de 56–64 px con icono de marca (SVG/asset oficial), nombre + handle/descripción y icono externo; agrupar «Club / Tienda / Contacto»; corregir X. Si no hay descripción, usar una rejilla 2 columnas de tiles de marca.
- **Alternativas:** tarjetas de 2 columnas con logo y nombre; más visual, mismo esfuerzo.
- **Esfuerzo:** **S/M**.
- **Riesgo:** **Bajo**.
- **Dependencias:** iconos de marca, `Linking`, `social.json`.

### D-18 · Museo con copy repetido y sin información práctica

- **Área:** Contenido / UX.
- **Severidad:** **Media**.
- **Evidencia:** `club_museo.jpeg`; `src/features/club/sections/MuseoSection.tsx:14-70`.
- **Qué ocurre:** hero sin foto (icono de edificio), párrafo descriptivo, «Ubicación», botón «Cómo llegar», y tres modalidades de visita con la misma frase «Consultar precio y disponibilidad en la web oficial» repetida dos veces y «Consultar condiciones…» una tercera. No hay fotos, horarios, precios ni CTA de entradas.
- **Causa raíz:** datos escasos y componente que rellena cada modalidad con el mismo fallback. No hay assets ni integración de entradas.
- **Impacto:** la pantalla no ayuda a planificar una visita; el usuario no sabe cuánto cuesta, cuándo abre ni qué va a ver. Es contenido que ocupa espacio sin aportar valor.
- **Recomendación:** hero con foto, tres tarjetas de visita con precio/duración/CTA, fila de información práctica (horario, ubicación, duración) y botón primario «Comprar entrada». Si faltan datos, un solo estado vacío honesto con enlace oficial, no tres frases repetidas.
- **Alternativas:** una única tarjeta con enlace a la web oficial del museo; mínimo esfuerzo.
- **Esfuerzo:** **M**.
- **Riesgo:** **Medio**; datos/fotos/entradas.
- **Dependencias:** `club.json` (museum), assets, `Linking`.

### D-19 · Ciudad deportiva como lista de bullets

- **Área:** Presentación de datos.
- **Severidad:** **Media**.
- **Evidencia:** `club_CiudadDeportiva.jpeg`; `src/features/club/sections/TrainingSection.tsx`.
- **Qué ocurre:** cinco bullets de texto («140.000 m² de superficie», «8 campos…», «3 campos…», «Diseño del estudio Populous», «Energías renovables…») y media pantalla vacía. La cita gallega «Onde nace o futuro» se mezcla en un párrafo en español.
- **Causa raíz:** los datos se guardan como frases y se renderizan con `Bullets`/`BodyText`; no hay campos estructurados para superficie, campos o arquitecto.
- **Impacto:** unas instalaciones impresionantes parecen una nota de prensa; no hay escala ni gancho visual. El usuario no retiene las cifras.
- **Recomendación:** 3 stat tiles (140.000 m², 8 campos, 3 campos) + 2 feature cards (Populous, sostenibilidad) + foto/mapa; la cita como pull quote destacada y traducida/contextualizada. Reducir prosa a dos líneas.
- **Alternativas:** carrusel de fotos con overlay de datos; más visual, más esfuerzo.
- **Esfuerzo:** **M**.
- **Riesgo:** **Bajo**.
- **Dependencias:** datos estructurados, fotos, `StatTile`.

### D-20 · Noticias con doble truncado y tres capas de filtro

- **Área:** Densidad / noticias.
- **Severidad:** **Media**.
- **Evidencia:** `Noticias.jpeg`; `app/(tabs)/news.tsx`, `src/components/news/NewsStoryCard.tsx`.
- **Qué ocurre:** la tarjeta muestra fuente 28 + nombre 17 + «hace 4 d» 15 + punto de no leída, miniatura 120×120, titular 21 hasta 3 líneas y extracto 17 a 2 líneas con truncado a mitad de palabra («…como de…»). El nombre de fuente se trunca («RC Deportivo (Yo…»). Antes de la primera noticia hay buscador, `SegmentedControl` Todo/Artículos/Vídeos, chips de grupo y hoja de filtros: tres capas.
- **Causa raíz:** la tarjeta intenta mostrar todo; el número de líneas es generoso; la miniatura es fija y pequeña; los filtros se acumulan en la cabecera sin jerarquía.
- **Impacto:** la pantalla más informativa es también la más densa; el usuario no escanea, y la imagen no manda. Para una app de aficionado, la portada debería priorizar imagen y titular corto.
- **Recomendación:** una noticia principal con imagen 16:9 y titular a 2 líneas; secundarias en filas de 96×96 con titular a 2 líneas y sin extracto; una sola fila de filtros (buscador + tipo + icono de filtros) y grupos en hoja; skeleton y swipe para marcar leída.
- **Alternativas:** layout revista 1 lead + 4 compactas; mantener extracto solo en la lead.
- **Esfuerzo:** **M**.
- **Riesgo:** **Bajo**.
- **Dependencias:** `news.json`, expo-image, Gesture Handler.

### D-21 · Rivalidades invierte G/E/P y usa fechas ISO

- **Área:** Color semántico / formato.
- **Severidad:** **Media**.
- **Evidencia:** `club_rivalidades.jpeg`; `src/features/club/sections/RivalidadesSection.tsx`.
- **Qué ocurre:** el balance muestra 133 PJ / 49 G / 32 E / 52 P en 40 px, pero **G en azul de marca, P en rosa y E en gris**, mientras el resto de la app usa G=verde, E=ámbar, P=rojo. Los enfrentamientos usan fecha ISO «2018-05-05» y el nombre completo de ambos clubes en cada fila.
- **Causa raíz:** la sección define su propia paleta en vez de usar `colors.win/draw/loss`; las fechas se renderizan sin `formatDate`.
- **Impacto:** el usuario interpreta mal el resultado; la inconsistencia con Inicio/Calendario obliga a reaprender el código de color; las fechas parecen datos técnicos.
- **Recomendación:** usar tokens semánticos; fecha «5 may 2018» o relativa; nombres cortos; chip G/E/P con los mismos colores que el resto. Si se quiere una barra de marca, usar tonos derivados pero mantener el texto/leyenda semántica.
- **Alternativas:** monocromo + posición; no recomendado porque pierde lectura rápida.
- **Esfuerzo:** **S**.
- **Riesgo:** **Bajo**.
- **Dependencias:** `tokens.ts`, `matchTime.ts`, `RivalidadesSection.tsx`.

### D-22 · Texto pequeño, abreviaturas y targets sin garantía

- **Área:** Accesibilidad.
- **Severidad:** **Alta**.
- **Evidencia:** `equipo_vistaJugador.jpeg` («PJ G min TA TR» a 11), `inicio_rival.jpeg` (etiquetas a 12), `club_redes.jpeg` (filas de 120), `equipo_vistaJugador_Partidos.jpeg` (subtítulos a 12); `player/[id].tsx:68-93`; `HeadToHeadBar.tsx:64-70`; `tokens.ts` (`minTouch: 44`, `displayMaxFontSizeMultiplier: 1.5`).
- **Qué ocurre:** información primaria a 9–12 pt; abreviaturas sin leyenda; enlaces de 13 pt sin altura mínima; colores semánticos inconsistentes; no se observa una estrategia de texto grande aplicada globalmente. `minTouch` existe pero no se aplica de forma obligatoria.
- **Causa raíz:** tamaños literales y ausencia de checklist de accesibilidad. Los tokens de accesibilidad no se usan de forma sistemática.
- **Impacto:** excluye a usuarios mayores o con baja visión, un segmento amplio en una app de fútbol. Falla WCAG AA en contraste y tamaño. Los targets pequeños generan errores de toque.
- **Recomendación:** mínimo 14 para cuerpo y 12 para caption; leyenda o `accessibilityLabel` para abreviaturas; 44×44 en todo lo pulsable; permitir escala hasta 1,5 con layouts flexibles; contrast AA; `accessibilityRole`/`accessibilityLabel` en tarjetas y gráficos. Añadir una pantalla de «Texto grande» si el sistema no basta.
- **Alternativas:** (a) modo «texto grande» dentro de Ajustes; (b) auditar solo las pantallas principales y dejar el resto para una segunda fase.
- **Esfuerzo:** **M/L**.
- **Riesgo:** **Medio**; cambios de layout y pruebas con lector de pantalla.
- **Dependencias:** `tokens.ts`, `minTouch`, todos los componentes, pruebas de accesibilidad.

### D-23 · Fechas, guiones y miles inconsistentes; GL al 30 %

- **Área:** Formato / i18n.
- **Severidad:** **Media**.
- **Evidencia:** `equipo_vistaJugador_Trayectoria.jpeg` («2009–2011», «2010-11», «2026–», «4957 min», «8168 min»), `club_rivalidades.jpeg` («2018-05-05»), `calendario_proximos.jpeg` («Noviembre De 2026»), `club_escudos.jpeg` («1906-1908»); `src/i18n/index.ts:24` y locales: **ES 713 claves, GL 212, EN 713**.
- **Qué ocurre:** se mezclan en dash y guion, fechas ISO y largas, cifras sin separador de miles. El gallego solo tiene 212 de 713 claves y cae a español; el usuario ve una mezcla de idiomas.
- **Causa raíz:** no hay capa central de formato; cada pantalla usa `String` o plantillas. GL se dejó parcial y el fallback es español.
- **Impacto:** inconsistente y poco profesional; los usuarios gallegos reciben una experiencia híbrida; las cifras grandes se leen mal.
- **Recomendación:** centralizar `formatDate`, `formatNumber`, `formatRange` con `Intl` y locale (`es-ES`, `gl-ES`, `en-GB`); usar en dash solo para rangos y guion para temporadas; completar GL o ocultar la opción hasta que esté al 100 %; tests de formato.
- **Alternativas:** publicar solo ES/EN y añadir GL cuando esté completo; reduce riesgo y expectativas.
- **Esfuerzo:** **M**.
- **Riesgo:** **Bajo**.
- **Dependencias:** `matchTime.ts`, i18n, `Intl`, tests.

### D-24 · Contexto de navegación duplicado y tarjetas anidadas

- **Área:** Navegación / chrome.
- **Severidad:** **Media**.
- **Evidencia:** `equipo_vistaEntrenador.jpeg` (título «Entrenador» + píldora «Equipo»), `equipo_vistaJugador.jpeg` (píldora «Equipo»), `club.jpeg` (aviso legal a ancho completo), `inicio_clasificacionytitulares.jpeg` (tarjeta dentro de tarjeta).
- **Qué ocurre:** la cabecera nativa muestra título centrado y, a la izquierda, una píldora con el destino anterior. En la ficha de jugador/entrenador, esa píldora compite con el contenido y tapa parte del hero. El aviso legal se coloca entre el hero y las cifras. La mini-clasificación tiene doble borde/radio.
- **Causa raíz:** se confía en el chrome nativo de iOS sin una estrategia de cabecera; el aviso legal se insertó en el flujo; las tarjetas se anidan por composición, no por necesidad.
- **Impacto:** ruido, menos espacio útil y confusión sobre la jerarquía. El usuario ve dos «dónde estoy» a la vez.
- **Recomendación:** una sola estrategia: título grande en contenido, chevron mínimo sin texto, acciones a la derecha. Aviso legal como pie/enlace. Evitar tarjetas anidadas: un solo nivel de superficie.
- **Alternativas:** mantener la píldora solo en iOS y ocultarla en Android; no resuelve la duplicación conceptual.
- **Esfuerzo:** **S/M**.
- **Riesgo:** **Bajo**.
- **Dependencias:** `_layout.tsx`, pantallas, i18n.

### D-25 · Emoji, Ionicons y logos mezclados sin criterio

- **Área:** Iconografía.
- **Severidad:** **Baja**.
- **Evidencia:** `equipo_vistaJugador.jpeg` (bandera emoji), `club_rivalidades.jpeg` (balón genérico para el Celta), `club_redes.jpeg` (pájaro antiguo de Twitter), `club_explorar.jpeg` (14 iconos genéricos del mismo color).
- **Qué ocurre:** se mezclan emoji, Ionicons y logos propios (`logo-x`) sin una política. Algunos iconos no representan el contenido (balón para un club, edificio para museo, mancuerna para ciudad deportiva).
- **Causa raíz:** no hay set de iconos ni mapa sección→icono; se usan fallbacks rápidos.
- **Impacto:** tono inconsistente y pérdida de reconocimiento. Los emoji cambian según plataforma y no encajan con la estética editorial.
- **Recomendación:** definir un set (Ionicons + SVG de marca), banderas como SVG o código de país, un icono único por sección y color por categoría; eliminar emoji del contenido editorial.
- **Alternativas:** quitar iconos donde no aportan y usar tipografía; más limpio, menos trabajo.
- **Esfuerzo:** **S/M**.
- **Riesgo:** **Bajo**.
- **Dependencias:** assets, `@expo/vector-icons`, SVG.

### D-26 · 43 hex, 5 familias y decenas de medidas fuera de tokens

- **Área:** Tokens / mantenibilidad.
- **Severidad:** **Alta**.
- **Evidencia:** **medido:** 43 hex fuera de `theme/tokens.ts`; 5 `fontFamily` hardcodeadas (`Editorial.tsx:42`, `:170-171`, `club.tsx:175`, `TitulosSection.tsx:52`); 21 `padding`/`margin` literales; 42 `gap` literales; 24 `borderRadius` numéricos.
- **Qué ocurre:** los tokens existen, pero se saltan. Hay colores, familias, espaciados y radios inventados en componentes. `Editorial.tsx` define su propio `SectionHeader` con `fontFamily: 'SourceSerif4-SemiBold'` y `heroTitle` con Barlow; `club.tsx` usa `#64748B`; `TitulosSection.tsx` usa `SourceSerif4-SemiBold`.
- **Causa raíz:** no hay aplicación obligatoria; el sistema de tokens no cubre tipografía y los atajos son más rápidos que añadir un token. La revisión de código no lo detecta.
- **Impacto:** el tema claro/oscuro se rompe en los colores hardcodeados; la deriva visual es inevitable; cada rediseño cuesta más. Es la deuda que explica por qué los tres sistemas no convergen.
- **Recomendación:** ampliar tokens (escala tipográfica, superficies semánticas, tamaños de icono); añadir reglas ESLint (`no-restricted-syntax`) para hex, `fontSize`, `fontFamily`, `borderRadius` y `gap` literales; migrar primero las pantallas de mayor tráfico; revisar en CI.
- **Alternativas:** checklist de revisión manual; no escala y se olvida.
- **Esfuerzo:** **M**.
- **Riesgo:** **Bajo**; las reglas pueden excluir casos justificados con comentario.
- **Dependencias:** ESLint, `tokens.ts`, CI.

---

## 5. Propuestas de patrón UI

> Todas las propuestas usan **solo dependencias presentes** en `apps/mobile/package.json`: Reanimated 4.7.1, Gesture Handler 3.3, SVG 15.16, expo-image y expo-linear-gradient. Cuando una propuesta necesita algo no instalado (audio, háptica), se indica explícitamente.

### 5.1 Principios

1. **Un sistema, tres superficies.** `poster` para momentos (próximo partido, resultado, jugador, título); `paper` para lectura (noticia, historia, museo, datos); `flat` para utilidad (calendario, ajustes, listas). No una superficie por pantalla.
2. **Un dato grande por pantalla.** Cada pantalla tiene una cifra o imagen protagonista: marcador, dorsal, aforo, número de títulos, posición. El resto es apoyo.
3. **La forma explica el dato.** Campo para alineaciones, línea temporal para eventos, barra para balance, raíl para trayectoria, mapa para sede. Si el dato es temporal o espacial, se dibuja.
4. **Movimiento con propósito.** Entrada escalonada, pressed con spring, indicador de tabs deslizante, progreso de gráfico. Nada de animación decorativa infinita.
5. **El texto es el último recurso.** Un párrafo que explica la UI es un bug de diseño. Máximo una línea de apoyo por bloque.

### 5.2 Fichas de patrón

#### Patrón A · `PosterHero` (Inicio, ficha de jugador, ficha de partido, portada de Club)

- **Objetivo:** unificar el momento editorial y eliminar el hero de `Card` plana.
- **Estructura:** `expo-image` a sangre (o degradado si no hay foto) + `expo-linear-gradient` de scrim inferior + kicker 11 en mayúsculas + título display 32–40 + subtítulo 16 + acción.
- **Movimiento:** `FadeIn` + `FadeInDown` con `delay` 40–80 ms; parallax opcional con `useAnimatedScrollHandler` e `interpolate` (solo si el hero está en un `ScrollView`).
- **Deps:** expo-image, expo-linear-gradient, Reanimated.
- **Esfuerzo:** M · **Riesgo:** Bajo · **Dependencias:** assets, tokens de tipografía.

#### Patrón B · `ScoreboardHero` + `MatchTimeline` + `PitchSVG` (ficha de partido)

- **Objetivo:** convertir el acta en una experiencia de partido.
- **ScoreboardHero:** dos escudos, marcador display 48–56, competición/jornada/fecha/sede en una línea, estado («Final», «En directo», «Próximo»). Fondo `poster` con degradado.
- **MatchTimeline:** raíl vertical SVG o `View` con línea de 2 px; eventos agrupados por tiempo (1T/2T) y equipo; icono de balón/tarjeta/cambio; minuto en mono; marcador acumulado a la derecha. Los cambios se muestran como una fila con flecha de entrada/salida, no dos filas.
- **PitchSVG:** `react-native-svg` con un campo de 2 mitades, dos columnas de jugadores, dorsal en círculo y nombre corto; formación si el dato existe. Interacción: tocar un jugador abre su ficha (Gesture Handler `Tap`).
- **Movimiento:** la timeline entra con `FadeInLeft` escalonado; el marcador cambia con `withSequence`/`withTiming` al seleccionar un evento; el campo aparece con `FadeIn`.
- **Deps:** SVG, Reanimated, Gesture Handler.
- **Esfuerzo:** L · **Riesgo:** Medio · **Dependencias:** `match-details` completo, estados vacíos.

#### Patrón C · `PlayerPosterHero` + cabecera sticky (ficha de jugador)

- **Objetivo:** que la ficha se sienta como un cromo y no como un formulario.
- **Hero:** retrato a sangre o 40 % del ancho con `expo-image` (`contentFit: 'cover'`), degradado inferior, dorsal display 64 en la esquina, nombre 28, identidad 14. El dorsal es el ancla visual.
- **Sticky header:** al hacer scroll, interpolación de opacidad/altura para mostrar una barra de 56 px con nombre + dorsal + botón de compartir. `useAnimatedScrollHandler` + `interpolate`; sin re-render.
- **Tabs:** un solo `AnimatedTabs` (Resumen/Partidos/Carrera) con indicador deslizante (`withSpring`). El ámbito (Depor/Carrera) pasa a un `Chip` secundario o a un menú, no a un segundo segmented de ancho completo.
- **Stats:** 5 `StatTile` con número 28–32 y etiqueta 12; leyenda en bottom sheet (`@gorhom/bottom-sheet` no está instalado: usar `Modal` + `Pressable` o una hoja propia con Gesture Handler).
- **Partidos:** agrupados por mes, fila de 64 px con escudo 28, rival 15, fecha corta 12, marcador 15 y chip G/E/P; sin repetir «LaLiga».
- **Trayectoria:** raíl SVG vertical con punto actual resaltado y animación de progreso; años y cifras en dos columnas; separador de miles.
- **Deps:** expo-image, expo-linear-gradient, Reanimated, SVG, Gesture Handler.
- **Esfuerzo:** L · **Riesgo:** Medio · **Dependencias:** datos de carrera, fotos, estados vacíos.

#### Patrón D · `CompareSlider` (escudos) y `KitsPager` (equipaciones)

- **CompareSlider:** dos imágenes superpuestas; una `Mask` SVG o un `View` con `overflow: 'hidden'` cuyo ancho sigue al dedo. `Gesture.Pan()` de Gesture Handler + `useSharedValue`/`useAnimatedStyle`; tirador de 44 px; acceso alternativo con dos botones «Anterior/Siguiente». Es el patrón más vistoso y barato del Club.
- **KitsPager:** `ScrollView` horizontal con `snapToInterval` y `decelerationRate="fast"`, o `Gesture.Pan` + `withSpring` para paginación; una camiseta por página, fondo neutro consistente, indicador de página. Evita la lista vertical de imágenes con fondos distintos.
- **Deps:** Gesture Handler, Reanimated, SVG, expo-image.
- **Esfuerzo:** M · **Riesgo:** Bajo · **Dependencias:** assets de escudos/kits.

#### Patrón E · `StatGrid` con conteo (Inicio, estadio, ciudad deportiva, palmarés)

- **Objetivo:** sustituir párrafos y listas por cifras.
- **Estructura:** 2×2 o 3+2 con celdas iguales; número display 32–40, unidad 12, etiqueta 12; icono opcional 20. En Club, la cifra de aforo/títulos ocupa el hero.
- **Movimiento:** conteo con `useSharedValue` + `withTiming` y `useAnimatedProps` sobre `TextInput`/`AnimatedText` (o `react-native-reanimated` `useAnimatedReaction` + `runOnJS` si se necesita formateo); duración 600–800 ms, solo la primera vez.
- **Deps:** Reanimated.
- **Esfuerzo:** S/M · **Riesgo:** Bajo · **Dependencias:** datos numéricos estructurados.

#### Patrón F · `FilterRail` (Club, Calendario, Noticias)

- **Objetivo:** que los filtros no ocupen media pantalla.
- **Estructura:** una fila horizontal scrollable de chips de 40–44 px con «Todos» + opciones; si hay 8+, un botón «Filtros» que abre una hoja. Chip activo con fondo primario; inactivo con borde. Barra sticky bajo la cabecera.
- **Movimiento:** indicador de selección con `Layout`/`LinearTransition`; aparición de la hoja con `SlideInDown`/`SlideOutDown`.
- **Deps:** Reanimated, Gesture Handler.
- **Esfuerzo:** S/M · **Riesgo:** Bajo · **Dependencias:** secciones, i18n.

#### Patrón G · `PressableScale` + `StaggerList` (global)

- **Objetivo:** dar feedback y ritmo sin tocar cada pantalla.
- **PressableScale:** `Pressable` + `useSharedValue`; `onPressIn` → `withSpring(0.97)`, `onPressOut` → `withSpring(1)`; opacidad 0.9; `accessibilityRole="button"`; respeta `useReducedMotion`.
- **StaggerList:** `Animated.View` con `entering={FadeInUp.delay(index * 40).duration(220)}`; para listas largas, limitar el stagger a los primeros 8 y usar `FadeIn` para el resto.
- **Deps:** Reanimated.
- **Esfuerzo:** S · **Riesgo:** Bajo · **Dependencias:** ninguna nueva.

### 5.3 Propuesta por pantalla

| Pantalla | Patrón principal | Composición | Deps | Esf. | Riesgo | Dependencias |
|---|---|---|---|---|---|---|
| Inicio · Próximo partido | `PosterHero` + `MatchCountdown` | Hero con fecha/hora/sede, CTA de calendario como icono, estado claro | Reanimated, gradient | M | Bajo | assets, i18n |
| Inicio · El rival | `PosterHero` + `H2HBar` accesible | Etiquetas blancas, barra con segmentos y leyenda; enlace con 44 pt | Reanimated | S | Bajo | tokens |
| Inicio · Temporada | `StatGrid` + `PositionChart` con gesto | 5 tiles en 3+2 sin hueco; gráfico con eje, tooltip y `Pan` | Reanimated, Gesture Handler, SVG | M | Medio | datos de posición |
| Inicio · Clasificación | Tabla compacta + `PressableScale` | 5 filas con G/E/P/DG, resaltado por fondo; CTA secundario | Reanimated | S | Bajo | standings |
| Equipo · Plantilla | `PlayerPosterCard` + secciones por posición | Retrato a sangre, dorsal display, agrupación POR/DEF/MED/DEL, grid/list con `LinearTransition` | expo-image, Reanimated | M | Bajo | fotos, datos |
| Jugador · Resumen | `PlayerPosterHero` + sticky + tabs | Ver Patrón C | image, gradient, Reanimated | L | Medio | player data |
| Jugador · Partidos | Lista agrupada por mes | Filas de 64, fecha corta, chip G/E/P, sin repetir liga | Reanimated | M | Bajo | matches |
| Jugador · Trayectoria | Raíl SVG + etapa actual | Punto actual resaltado, cifras con separador, años consistentes | SVG | M | Bajo | career |
| Entrenador · Resumen | Hero + `WDLBar` + 3 stats | Balance G/E/P como barra/donut SVG; 7 cifras en 3 destacadas + fila | SVG | M | Bajo | coach data |
| Entrenador · Cuerpo técnico | Rejilla 2×3 de 56–72 px | Avatar 48, nombre 16, rol 13; sin párrafos | — | S | Bajo | staff |
| Calendario · Próximos | `FilterRail` + `MatchRow` | Mes sticky, chip competición, jornada, próximo marcado, «Por confirmar» badge | Reanimated | M | Bajo | fixtures |
| Partido · Resultado | `ScoreboardHero` + `PitchSVG` + tabs | Ver Patrón B | SVG, Reanimated, Gesture Handler | L | Medio | match-details |
| Partido · Eventos | `MatchTimeline` | Raíl, iconos, agrupación por tiempo/equipo, marcador acumulado | SVG, Reanimated | M | Medio | events |
| Noticias | Lead + lista compacta | Imagen 16:9, titular 2 líneas, sin extracto en secundarias; filtros en una fila | expo-image, Gesture Handler | M | Bajo | news |
| Club · Portada | `PosterHero` + `StatGrid` 2×2 | Cifras iguales, aviso legal al pie, chips estáticos | Reanimated | M | Bajo | club |
| Club · Explorar | Grid 2 col con arte 4:3 | Badge «32,5k», título 2 líneas, color por categoría | expo-image | M | Bajo | images |
| Club · Cronología | `FilterRail` + timeline | Chips en una fila, años sticky, eventos plegables | Reanimated | M | Bajo | timeline |
| Club · Estadio | `StatHero` + mapa | Aforo 32.490 display, 4 datos en tiles, CTA «Cómo llegar» | SVG/map link | S | Bajo | stadium |
| Club · Equipaciones | `KitsPager` | Swipe por kit, fondo neutro, una ficha por página | Gesture Handler, Reanimated, image | M | Bajo | kits |
| Club · Escudos | `CompareSlider` | Comparador con tirador 44, botones alternativos | Gesture Handler, SVG, image | M | Bajo | crests |
| Club · Palmarés | `StatHero` 21 + rejilla por década | Filtro horizontal, trofeos visuales, sin 9 chips en 5 filas | SVG/Reanimated | M | Bajo | titles |
| Club · Rivalidades | `H2HBar` + lista de cruces | Colores semánticos, fechas cortas, nombres cortos | SVG/Reanimated | S | Bajo | rivalry |
| Club · Himnos | Tarjeta de audio + CTA externo | Portada/artista/duración; si no hay audio, enlace oficial | image | M | Medio | audio/derechos |
| Club · Junta | Organigrama SVG | Conectores, avatares con jerarquía, 2 columnas en móvil | SVG | M | Bajo | board |
| Club · Museo | Hero foto + 3 tarjetas prácticas | Precio/duración/CTA, un solo estado vacío | expo-image | M | Medio | museum data |
| Club · Patrocinadores | Grid de logos 3 col | Logo 72–96, rol y enlace; fallback wordmark | expo-image | M | Medio | logos |
| Club · Redes | Lista 56–64 px con marca | Icono oficial, handle, descripción, externo | SVG | S/M | Bajo | brand icons |
| Club · Ciudad deportiva | `StatGrid` + feature cards | 140.000 m², 8 campos, 3 campos; cita como pull quote | Reanimated | M | Bajo | training data |
| Rival · Ficha | Alinear con Inicio | `PosterCard` + `PaperCard` + `H2HBar`; validar con captura | Reanimated | S/M | Bajo | rival data |

---

## 6. ¿Se sostiene el sistema Cartel + Prensa?

**No, todavía no.** El sistema existe y es bueno, pero se queda en un prototipo de Inicio:

- **Cobertura:** `DesignSystem` se importa en 7 archivos; el resto usa `Card` o `Editorial`.
- **Consistencia:** el cartel aparece en Inicio y Rival, pero la ficha de partido —el momento más «cartel»— usa una `Card` plana. La prensa aparece en Inicio, pero las noticias usan `Card`.
- **Tokens:** `Editorial.tsx` hardcodea Barlow y Source Serif; `club.tsx` y `TitulosSection.tsx` también. El sistema no es la fuente de verdad.
- **Modo oscuro:** el papel se confunde con el fondo (1,11:1), así que la metáfora «prensa» desaparece justo en el modo que se usa.
- **Tipografía:** el cartel usa display condensada y serif; el resto usa Inter en 12–24. No hay una escala común que permita decir «esto es cartel» o «esto es prensa» sin mirar el archivo.

**Cómo salvarlo:**

1. **Definir dos superficies con reglas, no dos estéticas.** `poster` = momento/impacto: próximo partido, resultado, ficha de jugador, título, portada. `paper` = lectura: noticia, historia, museo, datos. `flat` = utilidad: calendario, ajustes, listas.
2. **Un solo `SectionHeader` con tres niveles** (`display`, `section`, `compact`) y un solo `StatTile` con dos tamaños (`hero`, `compact`). Eliminar las cuatro variantes actuales.
3. **Tokenizar la tipografía editorial** (display, headline, body, numeric) con tamaños y line-height. Si una pantalla necesita un tamaño nuevo, se añade al token, no al componente.
4. **Aplicar el cartel a los momentos, no a todo.** No hace falta que todas las pantallas sean un póster; hace falta que las importantes lo sean y que las demás no parezcan de otra app.
5. **Validar en claro y oscuro** con capturas antes de dar el sistema por cerrado. Hoy el oscuro es el único modo real y el papel no funciona.

---

## 7. Microcopy y formatos

### 7.1 Antes → después

| Antes | Después | Motivo |
|---|---|---|
| «Pendiente de actualizar» + fecha y hora exactas | «Fecha y hora por confirmar» o «Confirmado · sáb 7 nov, 16:15» | Eliminar contradicción |
| «El recordatorio estará disponible cuando se confirme la hora del partido.» (4 líneas) | «Recordatorio al confirmar la hora» (1 línea) | El texto no debe explicar la limitación |
| «Calculado con los partidos terminados de la temporada publicada.» | «Datos de la temporada 2026-27» en pie | Procedencia al pie |
| «Usa el selector para saltar de década.» | Eliminar; el selector ya lo indica | No instruir lo obvio |
| «Consultar precio y disponibilidad en la web oficial.» ×3 | Una tarjeta con precio/duración/CTA o un solo enlace | No repetir fallback |
| «Proyecto de aficionados sin vinculación oficial…» entre hero y cifras | Pie legal o enlace «Aviso legal» | No romper el ritmo |
| «Noviembre De 2026» | «Noviembre de 2026» | Formato español |
| «Deportivo de La Coruña» / «Deportivo de A Coruña» | Un nombre canónico + corto | Identidad y consistencia |
| «4957 min» | «4.957 min» | Formato español |
| «2018-05-05» | «5 may 2018» | Fecha legible |
| «Fuente oficial · Confianza: contrastado» como chip gigante | Icono de info + «Fuente: web oficial» en pie | La fuente no es el dato |
| «Voa» sin contexto | Cita con traducción/contexto o solo «Himno oficial» | No mezclar idiomas sin explicar |

### 7.2 Reglas de copy

- **Una idea por línea.** Si necesita dos líneas, probablemente es dos bloques.
- **Voz activa y presente.** «Consulta», «Añade», «Abre»; no «será disponible».
- **Sin explicar la UI.** Si el botón necesita un párrafo, el botón está mal.
- **Procedencia al pie.** Fuente, confianza y licencia no compiten con el dato.
- **Nombres canónicos.** Un solo nombre oficial y un solo nombre corto, aplicados en datos e i18n.
- **Formato local.** `Intl` para fechas, números y rangos; nada de ISO en la interfaz.
- **Longitud.** Título ≤ 2 líneas; subtítulo ≤ 1; botón ≤ 3 palabras; estado ≤ 4 palabras.

---

## 8. Priorización

### 8.1 Quick wins (≤ 1 día cada uno)

| ID | Acción | Impacto | Esfuerzo |
|---|---|---|---|
| D-01 | `headerBackTitle` en `match/[id]` | Muy alto | S |
| D-11 | Quitar `textTransform: capitalize` | Alto | S |
| D-02 | Etiquetas G/E/P en blanco sobre cartel | Muy alto | S |
| D-21 | Colores semánticos + fechas cortas en Rivalidades | Alto | S |
| D-23 | Separador de miles y fechas con `Intl` | Medio | S |
| D-24 | Ocultar píldora «Equipo» y evitar tarjetas anidadas | Medio | S |

### 8.2 Fase 1 · Fundamentos (1–2 semanas)

1. **D-04 + D-26:** escala tipográfica y tokens; lint de hex/fontSize/fontFamily.
2. **D-03:** `Surface` + `SectionHeader` + `StatTile` únicos; migrar Equipo y Partido.
3. **D-08:** `PressableScale` + `StaggerList` global.
4. **D-12:** papel oscuro elevado y borde; validar contraste.

### 8.3 Fase 2 · Pantallas clave (2–4 semanas)

1. **D-05:** ficha de partido con `ScoreboardHero`, `PitchSVG` y `MatchTimeline`.
2. **D-09:** ficha de jugador con hero, sticky y un solo eje de tabs.
3. **D-10:** calendario con competición/jornada/próximo.
4. **D-20:** noticias con lead + lista compacta y filtros en una fila.

### 8.4 Fase 3 · Club y contenido (2–4 semanas)

1. **D-13/D-14:** explorar, filtros y portada.
2. **D-15 a D-19:** patrocinadores, himnos, redes, museo, ciudad deportiva.
3. **D-16:** decidir audio propio vs enlace oficial (decisión de producto, no de UI).
4. **D-25:** iconografía y banderas.

### 8.5 Matriz impacto/esfuerzo

| | Esfuerzo S | Esfuerzo M | Esfuerzo L |
|---|---|---|---|
| **Impacto alto** | D-01, D-02, D-21 | D-10, D-20, D-08 | D-03, D-04, D-05, D-09 |
| **Impacto medio** | D-11, D-23, D-24, D-17 | D-06, D-07, D-13, D-14, D-18, D-19, D-22 | D-16 |
| **Impacto bajo** | D-25 | D-15 | — |

---

## 9. Criterios de aceptación

Para considerar cerrada la fase de diseño:

1. **Navegación:** ninguna ruta muestra nombres de grupo (`(tabs)`), rutas crudas ni textos de depuración. Una sola estrategia de cabecera.
2. **Tipografía:** no hay `fontSize`, `fontWeight` ni `fontFamily` literales fuera de tokens; la escala se aplica en las 10 pantallas principales.
3. **Color:** todo texto cumple ≥4,5:1 (≥3:1 en grandes); G/E/P usa los mismos tokens en Inicio, Calendario, Partido, Jugador y Club.
4. **Superficies:** `poster` y `paper` se distinguen ≥1,3:1 en claro y oscuro; no hay tarjetas anidadas.
5. **Interacción:** todo elemento pulsable tiene estado pressed, target ≥44×44 y `accessibilityRole`; las listas tienen entrada escalonada; los filtros tienen transición.
6. **Ficha de partido:** marcador con contexto, alineaciones en campo SVG, eventos en timeline con iconos y agrupación.
7. **Ficha de jugador:** hero con dorsal, cabecera sticky, un solo tab bar, stats con leyenda, partidos agrupados.
8. **Calendario:** cada fila muestra competición, jornada y próximo partido; mes sticky; «Por confirmar» no rompe la fila.
9. **Noticias:** una lead con imagen y titulares a 2 líneas; sin doble truncado; una sola fila de filtros.
10. **Club:** patrocinadores y redes con logo/marca y enlace; himnos con reproductor o CTA externo honesto; museo y ciudad deportiva con datos prácticos o un estado vacío único.
11. **Formatos:** fechas, rangos y números con `Intl`; GL completo o oculto; nombres canónicos.
12. **Evidencia:** capturas de claro y oscuro, texto grande, error, offline, carga y vacío para cada pantalla modificada.

---

## 10. Anexo · Evidencias y recuentos

### 10.1 Recuentos medidos

| Métrica | Valor | Comando |
|---|---:|---|
| Capturas | 29 | `ls docs/auditoria/capturas` |
| Archivos que importan `DesignSystem` | 7 | `grep -rl "components/design/DesignSystem"` |
| `<Card>` | 66 | `grep -ro "<Card"` |
| `<PosterCard>` | 4 | `grep -ro "<PosterCard"` |
| `<PaperCard>` | 6 | `grep -ro "<PaperCard"` |
| `<SectionHeader>` | 19 | `grep -ro "<SectionHeader"` |
| `fontSize:` literales | 318 | `grep -ro "fontSize: [0-9]"` |
| Tamaños distintos | 25 (9–64) | `grep -rho "fontSize: [0-9]*"` + `sort -u` |
| `fontWeight` literales | 156 | `grep -ro "fontWeight: '[0-9]*'"` |
| Hex fuera de tokens | 43 | `grep -rno "#[0-9A-Fa-f]\{6\}"` sin `tokens.ts` |
| `fontFamily` hardcodeadas | 5 | `grep -rn "fontFamily: '"` |
| `padding`/`margin` literales | 21 | `grep -rEo "padding…"` + `margin…` |
| `gap` literales | 42 | `grep -rEo "gap: [0-9]+"` |
| `borderRadius` numéricos | 24 | `grep -rEo "borderRadius: [0-9]+"` |
| Estados `({ pressed })` | 1 | `grep -rn "({ pressed })"` |
| `android_ripple` | 0 | `grep -rn "android_ripple"` |
| `onPressIn`/`onPressOut` | 0 | `grep -rn "onPressIn"` + `onPressOut` |
| Háptica | 0 | `grep -rn "expo-haptics"` + `Haptics` |
| Archivos con Reanimated | 1 | `grep -rln "react-native-reanimated"` |
| `Animated.timing` | 5 | `grep -rn "Animated.timing"` |
| Claves ES / GL / EN | 713 / 212 / 713 | recuento de JSON |

### 10.2 Contraste calculado

| Fondo | Texto | Ratio | Uso |
|---|---|---:|---|
| `#00478F` | `#07513C` | 1,02:1 | G sobre cartel |
| `#00478F` | `#654A00` | 1,31:1 | E sobre cartel |
| `#00478F` | `#7A1F1A` | 1,56:1 | P sobre cartel |
| `#0B1220` | `#151D2A` | 1,11:1 | Paper oscuro |
| `#F5F7FA` | `#FFF9ED` | 1,02:1 | Paper claro |
| `#0B1220` | `#EAF0F7` | ~15,9:1 | Texto principal |
| `#0B1220` | `#A7B4C4` | ~8,4:1 | Texto mutado |

> Cálculo WCAG 2.1 con luminancia relativa. Los ratios de texto principal/mutado son aproximados por redondeo; los de G/E/P y papel son los relevantes para los hallazgos.

### 10.3 Archivos de notas

- `docs/auditoria/parciales/FASE-4-notas-inicio.md`
- `docs/auditoria/parciales/FASE-4-notas-equipo.md`
- `docs/auditoria/parciales/FASE-4-notas-calendario.md`
- `docs/auditoria/parciales/FASE-4-notas-noticias.md`
- `docs/auditoria/parciales/FASE-4-notas-club.md`
- `docs/auditoria/parciales/FASE-4-notas-ficha-jugador.md`
- `docs/auditoria/parciales/FASE-4-notas-ficha-partido.md`
- `docs/auditoria/parciales/FASE-4-notas-rival-limitaciones.md`

---

*Fin de FASE 4. Auditoría de solo lectura; no se ha modificado código de la app, no se ha instalado nada y no se ha hecho commit ni push.*
