# Notas visuales — Calendario y ficha de partido (3 capturas)

Capturas: `calendario_proximos.jpeg`, `calendario_vistaPartido.jpeg`, `calendario_vistaPartido2.jpeg`. Modo oscuro.

## calendario_proximos.jpeg
- Cabecera «Calendario» + engranaje.
- `SegmentedControl` de 3 («Próximos / Resultados / Clasificación») a ancho completo, 56 px, azul el activo. Bien.
- Justo debajo, botón outline a ancho completo «Exportar calendario (.ics)»: ocupa el segundo elemento más prominente de la pantalla para una acción secundaria.
- Cabeceras de mes «Noviembre De 2026», «Diciembre De 2026»: **error de capitalización** (preposición «de» en mayúscula, formato título inglés). 17 pt gris.
- Tarjetas de partido: columna izquierda fecha corta «sáb, 7 nov» + hora 16:15; derecha dos filas escudo+equipo con el Depor en negrita. Alto ~120 pt.
- «Hora por confirmar» rompe en dos líneas en la columna estrecha y hace las tarjetas más altas: alturas irregulares entre filas.
- **Falta competición y jornada** en cada fila (no se distingue liga/copa), y no hay distintivo de «próximo partido».
- No hay ninguna pista de que la tarjeta abra la ficha (sin chevron ni feedback).
- El bloque de mes no es sticky; con listas largas se pierde la referencia.

## calendario_vistaPartido.jpeg
- **El botón atrás muestra literalmente «(tabs)»**: el nombre del grupo de rutas de Expo Router se filtra a la interfaz. Defecto visible y vergonzoso.
- Hero de resultado: escudos ~100, «2 – 1» 44, nombres 23 bold, «Resultado final» 17 gris. Fondo plano `surface`, no `PosterCard`; sin competición ni fecha.
- Tarjeta de metadatos = **lista de definición vertical**: Fecha / Hora (Madrid) / Jornada / Sede / Árbitro / Descanso. Etiqueta 17 gris, valor 19–21. Seis filas y ~560 px para seis datos. Es el ejemplo más claro de «mucho texto estático».
- «Alineaciones y eventos»: título 20 bold; «Deportivo de A Coruña» 21 bold; «Entrenador: Antonio Hidalgo» 19; «TITULARES» 15; y una lista de «13 · Leo Román», «2 · Alti»… una por línea a 19 pt. Sin dibujo de campo, sin dorsales en badge, sin dos columnas.
- No hay cronología visual ni iconos.

## calendario_vistaPartido2.jpeg
- Tres tarjetas seguidas: «Goles», «Tarjetas», «Cambios», cada una con **párrafos de texto corrido de 17–21 pt**: «32' · Osasuna · Budimir · 0–1», «87' · Deportivo de A Coruña · Nsongo · 2–1».
- Ancho desaprovechado: las líneas terminan a media tarjeta y dejan 300 px vacíos a la derecha.
- «Cambios» mezcla dos formatos en la misma lista: «Quagliata → Adama» y «Sale: Moro» / «Entra: Rubén García»; repite entradas y salidas del mismo minuto en filas separadas (69' Osasuna ×4).
- «Deportivo de A Coruña» repetido en cada línea (6+ veces).
- Cero iconografía: ni balón, ni tarjeta amarilla, ni flechas de cambio. Cero agrupación por equipo o por tiempo.
- El resultado del partido no se refleja en la cronología: los goles no están conectados con el marcador del hero.

## Impresión global de Calendario
La lista de próximos es funcional pero plana y con un error de formato de fecha; la ficha de partido es la pantalla **más “documento de texto”** de toda la app: metadatos en lista vertical, alineaciones en párrafos y eventos en líneas de texto sin estructura visual. Es la mayor oportunidad de rediseño con SVG/Reanimated.
