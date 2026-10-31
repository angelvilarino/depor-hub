# ADR 0015 — Inicio real y cadencia adaptativa de la ingesta

- **Estado:** aceptada (27-oct-2026).
- **Alcance:** sustituir la pantalla provisional de H2 por la Home real, extraer la lógica y las acciones compartidas de partido y hacer que la ingesta se adapte a la ventana de partido sin multiplicar peticiones.
- **Regla base:** la Home solo muestra datos ya publicados y validados. Lo que falta se explica con un estado vacío; no se rellena con ceros, horas inventadas ni noticias de ejemplo.

## Contexto

H2 dejó una Home de demostración que solo probaba la capa de datos. H3 y H4 ya publican calendario, clasificación, plantilla y ficha, pero faltaba la pantalla que responde a las preguntas del aficionado al abrir la app: cuándo es el próximo partido, cómo quedó el último, cómo va la temporada, cómo está la tabla alrededor del Depor y quién es el próximo rival.

Además, el workflow de datos se ejecutaba cada hora. En un partido eso es demasiado lento y fuera de él, innecesario. El plan gratuito de football-data.org limita a 10 peticiones por minuto, así que la solución no puede ser ejecutar cada minuto.

## Decisiones

### 1. Orden y contenido de la Home

La Home se compone, en este orden, de:

1. `FreshnessBanner` (solo avisa si hay datos viejos, error o falta de conexión).
2. `NextMatchCard`.
3. `LastResultCard`.
4. `SeasonCard`.
5. `MiniTable`.
6. `OpponentCard`.
7. `HeadlinesBlock` (opcional).
8. Pie con `data.seasonLine` (temporada y jornada).

La pantalla tolera tres estados: datos reales, datos vacíos y error. Con datos vacíos cada bloque explica qué falta. Con error global se muestra `ErrorState` y se reintentan `meta`, `standings` y `fixtures`. El refresco manual recarga esas tres consultas; las noticias son opcionales y nunca convierten la Home en un error global.

### 2. Lógica pura en `features/home/logic.ts`

Toda la selección y los cálculos viven fuera de los componentes y se prueban sin renderizar:

- `selectNextMatch`: primer `splitMatches().upcoming`, que ya incluye `IN_PLAY`, `PAUSED` y `POSTPONED` y excluye cancelados.
- `selectLastResult`: resultado más reciente de `splitMatches().results`.
- `miniTableWindow`: cinco filas centradas en el Depor; en los extremos se desplaza para seguir mostrando cinco si hay al menos cinco equipos.
- `recentForm`: últimos cinco resultados en orden cronológico, con `G/E/P` desde el punto de vista del Depor.
- `seasonSummary`: posición, puntos, partidos, G-E-P, goles y diferencia desde `standings.json`.
- `nextOpponentInfo`: rival del próximo partido, su fila de clasificación y el balance de la temporada contra él. Sin partidos jugados el balance es `null`, no un 0-0-0.
- `countdownParts`, `hasCountdown`, `showsSeconds`, `isLive` y `utcDayDiff`.

### 3. Cuenta atrás honesta

- Solo `TIMED` tiene cuenta atrás: es el único estado con hora confirmada.
- `SCHEDULED` muestra «Hoy» o «Faltan N días» y «Hora por confirmar»; nunca inventa una hora.
- `POSTPONED`, `SUSPENDED` y `CANCELLED` muestran su estado, no una cuenta atrás.
- `IN_PLAY` y `PAUSED` muestran marcador y estado en lugar de la cuenta atrás.
- La hora se muestra en `Europe/Madrid` con `Intl` (CET/CEST automático).
- `useCountdown` usa un único intervalo: cada segundo bajo una hora y cada minuto por encima. Se limpia al desmontar y no usa animaciones, por lo que «reducir movimiento» no necesita nada extra.
- La cuenta atrás lleva `accessibilityLiveRegion="none"` para no anunciar cada segundo.

### 4. Acciones de partido compartidas

`useMatchActions(match)` centraliza sede, hora, título, recordatorio y «Añadir al calendario». Lo usan la Home y la ficha `/match/[id]`, de modo que el permiso de notificaciones se pide solo al pulsar «Recordarme» y no hay dos implementaciones que se desincronicen.

La tarjeta del próximo partido agrupa su contenido en una etiqueta accesible resumida, abre la ficha al pulsar y ofrece «Cómo llegar» con enlace nativo al mapa (Apple Maps en iOS, `geo:` en Android). Las zonas táctiles mantienen al menos 44 pt.

### 5. Mini tabla y acceso a la completa

La mini tabla usa `StandingsTable` en modo compacto (posición, escudo, equipo y puntos). El Depor queda resaltado y siempre se ven cinco filas cuando la clasificación tiene al menos cinco equipos, también si el Depor es primero, segundo, penúltimo o último. «Ver tabla completa» navega a Calendario con `?tab=standings`; la pestaña vive en la URL para que el enlace funcione aunque la pantalla ya estuviera montada.

### 6. Titulares opcionales y contrato mínimo

Se añade un contrato mínimo `news.json` (`updatedAt`, `items` con `id`, `title`, `url`, `sourceName`, `publishedAt`, `thumbnailUrl` y `tags`) como origen Pydantic y espejo Zod. La app lo consume con `useNews`, que trata un **404 como «sin titulares»** y no como error. El bloque se oculta si no hay elementos. La ingesta RSS real llega en H6 y ampliará el contrato de forma aditiva.

### 7. Cadencia adaptativa de la ingesta

`python -m depor_hub.cli ingest --if-due` decide antes de tocar la red:

- Ventana original: desde 30 minutos antes del kickoff hasta 3 horas después, para `TIMED`, `IN_PLAY` y `PAUSED`; refresco cada **10 minutos**. El límite vigente de +150 min está fijado por ADR 0025.
- Fuera de la ventana: refresco cada **60 minutos**.
- Sin fixtures o sin estado previo: se refresca.
- Si no toca, termina con `changed=false due=false` y no hace peticiones.

El estado del último refresco se guarda en `data/raw/ingest_state.json`. No se puede deducir de `updatedAt` porque ese campo solo cambia cuando cambia el contenido. El workflow lo restaura y guarda con `actions/cache` y ejecuta cada 10 minutos; GitHub Actions no garantiza puntualidad, pero la caché conserva el intervalo real. `workflow_dispatch` mantiene `force` para publicar sin esperar. El límite de 10 peticiones por minuto se respeta porque cada ejecución hace una sola pasada y el mínimo entre pasadas es de 10 minutos.

### 8. Accesibilidad e i18n

- Las tarjetas se agrupan con una etiqueta que resume el contenido; los chips G/E/P tienen etiqueta textual («Victoria», «Empate», «Derrota»).
- ES y EN mantienen paridad exacta de claves; GL sigue siendo parcial y cae a ES.
- Fechas, horas y números se formatean con `Intl` según el idioma y la zona de Madrid.

### 9. Pruebas

- `homeLogic.test.ts`: próximos partidos, resultados, mini tabla en extremos, forma, resumen, balance del rival, cuenta atrás, `SCHEDULED`, aplazados, ausencia de datos y CET/CEST.
- `home.test.tsx`: render con los JSON reales, datos vacíos, error con reintento y titulares opcionales.
- `headlines.test.tsx`, `useCountdown.test.ts` y `maps.test.ts`.
- `test_cadence.py`: ventana de partido, fuera de ventana, sin fixtures y estado persistido.
- `test_depor_hub.py`: salida limpia de `--if-due` cuando no toca y escritura de estado cuando toca.

## Consecuencias

- La Home deja de ser provisional y no necesita datos de ejemplo.
- El contrato sigue siendo `v1`: `news.json` es un fichero nuevo y opcional, y los campos añadidos son aditivos.
- La cadencia depende de que el workflow pueda guardar la caché. Si la caché se pierde, la siguiente ejecución refresca y vuelve a crear el estado.
- Los titulares no se publican hasta H6; mientras tanto la Home simplemente no muestra el bloque.
- El balance del rival solo cubre la temporada publicada, igual que el del entrenador.

## Referencias

- `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/calendar.tsx`, `apps/mobile/app/match/[id].tsx`.
- `apps/mobile/src/features/home/{logic,useCountdown,useMatchActions,maps}.ts`, `apps/mobile/src/components/home/`.
- `scripts/depor_hub/cadence.py`, `scripts/depor_hub/cli.py`, `.github/workflows/data-refresh.yml`.
- `packages/schemas/news.schema.json`, `packages/schemas/examples/news.json`.
- ADR 0003, 0004, 0005 y 0006.
