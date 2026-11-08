# ADR 0033 — Himnos: reproducción oficial bajo demanda

## Estado

Aceptada — 2026-11-08.

## Contexto

La app ya depende de `expo-web-browser`; no necesita una vista web embebida para ofrecer acceso a una fuente audiovisual oficial. El himno «Voa» tiene una página del RC Deportivo que presenta el videoclip oficial. Los demás himnos no tienen una fuente audiovisual oficial validada en el contrato.

## Decisión

- El detalle solo muestra la acción de reproducción cuando `media.kind` es `video`, `media.origin` es `club_official` y `media.status` es `verified`.
- La acción abre la página oficial en el navegador del sistema después de que la persona pulse reproducir. No se carga ningún embed, script ni recurso audiovisual antes de la pulsación.
- Se usa `expo-web-browser`, ya presente en el bundle. No se añade `react-native-webview`: evita peso adicional y no cambia los requisitos de Expo Go.
- El medio y su atribución se declaran en `data/manual/club.yml`; `club.json` se regenera con el publicador existente.
- Las letras solo se muestran dentro de la app cuando el estado es `licensed`, `public_domain` o `permission_granted`. En los demás casos se ofrece la fuente si está disponible.

## Consecuencias

La reproducción oficial queda disponible sin dependencia nativa nueva y sin carga de terceros en segundo plano. El vídeo se reproduce en la página oficial del club, fuera del árbol de la app. El detalle de «Voa» conserva el crédito de su fuente.

## Fuente

- [Presentación oficial de «Voa» y su videoclip](https://www.rcdeportivo.es/es/noticias/el-rc-deportivo-presenta-voa-su-himno-oficial-compuesto-por-xoel-lopez-un-simbolo-de-identidad)
