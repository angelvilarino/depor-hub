# ADR 0019 — Identidad visual «Cartel + Prensa»

- **Estado:** aceptado
- **Fecha:** 2026-10-30

## Contexto

Inicio usaba una superficie y jerarquía tipográfica casi únicas. Próximo partido y temporada necesitaban tratamientos distintos sin romper accesibilidad, i18n ni modo oscuro.

## Decisión

- Usar `PosterCard` con degradado azul y texto claro para partido, rival y resultado; `PaperCard` cálida/clara o neutra/oscura para temporada, tablas y noticias.
- Centralizar color, contraste, tipografía, radios y movimiento en tokens. Probar texto AA (4,5:1) contra cada parada del cartel y el papel.
- Empaquetar Barlow Condensed SemiBold (display), Source Serif 4 SemiBold (editorial) e Inter Regular (cuerpo), las tres OFL 1.1. Son 776.496 bytes. El splash espera la carga; el arranque <2,5 s queda pendiente de medición en dispositivo real.
- Usar `expo-image`, `expo-linear-gradient`, `react-native-svg`, Gesture Handler 3.4 y Reanimated compatible con RN 0.88.

## Consecuencias

Hay una identidad más reconocible, con fallback de sistema y modo de reducir movimiento. Las fuentes suman ~758,3 KiB; sin medición en gama media no afirmamos que el objetivo de arranque ya se cumpla.
