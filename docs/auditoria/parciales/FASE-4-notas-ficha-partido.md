# Notas visuales — Ficha de partido (2 capturas)

Capturas ya examinadas dentro de `FASE-4-notas-calendario.md` (no se recargan): `calendario_vistaPartido.jpeg`, `calendario_vistaPartido2.jpeg`. Modo oscuro.

## Resumen
Es la pantalla con más texto plano de la app y la que peor representa el momento “partido”. Todo lo que no es el marcador se presenta como pares etiqueta/valor o párrafos de 15 pt.

## Evidencia visual
- Botón atrás “(tabs)” en la cabecera: nombre del grupo de rutas filtrado (`_layout.tsx:50` + `match/[id].tsx:44`). Es el defecto visual más grave.
- Marcador: `Card` plana, escudos 56, “2 – 1” 28, nombres 16 bold, “Resultado final” 14 gris. Sin competición, fecha, sede ni contexto en el hero. No usa `PosterCard` (`match/[id].tsx:124-149`).
- Metadatos: seis `InfoRow` verticales —Fecha, Hora (Madrid), Jornada, Sede, Árbitro, Descanso— con etiqueta 14 y valor 16 (`:151-156`, `:346-358`). Seis filas y ~560 px para seis datos; el patrón es una ficha administrativa.
- Alineaciones: “Deportivo de A Coruña” 16, “Entrenador: …” 14, “TITULARES” 12 y una línea por jugador “13 · Leo Román” de 15 (`:224-282`). Sin campo, sin badges de dorsal, sin dos columnas. Los suplentes repiten el mismo patrón.
- Goles / Tarjetas / Cambios: tres tarjetas con **párrafos** de 15/22 (`:288-330`). “32' · Osasuna · Budimir · 0–1”; en cambios conviven “Quagliata → Adama” y “Sale: Moro”/“Entra: Rubén García”, con entradas y salidas del mismo minuto en filas separadas.
- Ancho desaprovechado: las líneas de evento terminan a media tarjeta.
- Sin iconos de balón/tarjeta/cambio, sin línea temporal, sin agrupación por equipo o por tiempo.
- El marcador del hero no se conecta con los goles de la cronología.

## Código que confirma
`InfoRow` (`:21-30`), `lineupBlock` (`:224-282`), `eventLine` (`:358`), `substitutionLabel` (`:270-275`). No hay SVG ni componente visual de eventos.
