# ADR 0017 — Inicio v2, contexto de temporada, rivales y tiempo

- **Estado:** aceptada (28-oct-2026).
- **Alcance:** orden y estados de la Home, reloj único, `season.json`, `rivals.json`, evolución de la posición, «Qué se juega», tiempo en la sede, editor nativo del calendario y recordatorios configurables.
- **Regla base:** todo dato ausente queda en `null` y su bloque se oculta. No se inventan posiciones, marcadores, horas, asistencias ni previsiones.

## Contexto

H5 dejó una Home correcta pero plana: el resultado anterior siempre ocupaba el mismo sitio, la temporada repetía posición y puntos en dos tarjetas, el rival solo mostraba la clasificación y el hero no tenía ni tiempo ni estados intermedios entre «próximo» y «terminado». Además, el editor de calendario documentado en el ADR 0005 (`createEventInCalendarAsync`) ya no existe en `expo-calendar` 58.

Esta iteración convierte la Home en un relato: qué ha pasado, qué viene, contra quién, qué hay en juego y cómo va la temporada. Cada bloque tiene una sola responsabilidad y una sola fuente.

## Decisiones

### 1. Orden de la Home

1. **Resultado final** solo si el partido terminó hace **24 h o menos**. Pasada la ventana desaparece; no se queda como «último resultado» permanente.
2. **Próximo partido** (hero).
3. **Aviso de aplazado** si el partido cronológicamente más cercano está `POSTPONED`. Es discreto, enlaza a la ficha y no ocupa el hero.
4. **El rival**.
5. **Qué se juega**.
6. **La temporada** (bloque fusionado).
7. **Titulares** (H6, opcional).

Los aplazados y cancelados no son «el próximo partido»: `selectNextMatch` los descarta. Un `TIMED` cuya hora ya pasó se presenta como **«Pendiente de actualizar»** (`awaiting_result`), nunca como resultado inventado.

### 2. Reloj y estados

`src/utils/clock.ts` expone `nowMs()`. En desarrollo, `EXPO_PUBLIC_DEV_NOW` fija el instante inicial y el reloj sigue avanzando; en producción la variable se ignora.

`useNow(intervalMs)` mantiene un intervalo por componente y lo **pausa con `AppState`** cuando la app deja de estar activa. La cuenta atrás vive en su propio componente (`Countdown`): solo él se repinta cada segundo, no la tarjeta entera. Bajo una hora actualiza cada segundo; por encima, cada minuto.

`matchPhase(match, now)` traduce la API a: `tbc`, `upcoming`, `live`, `awaiting_result`, `finished`, `postponed`, `suspended`, `cancelled` y `unknown`. `SCHEDULED` nunca tiene cuenta atrás (no hay hora); muestra solo días.

Accesibilidad: la etiqueta de la cuenta atrás se recalcula como mucho **una vez por minuto** para no interrumpir al lector, aunque el texto visible cambie cada segundo. La animación de pulso se desactiva con «Reducir movimiento» y no existe si no hay segundos.

### 3. `season.json`

Contrato aditivo con:

- `summary`: posición, puntos, PJ, G-E-P, GF-GC y DG (la única fuente de esas cifras en la Home).
- `form`: los cinco partidos terminados más recientes con rival, local/visitante, marcador y resultado. Orden: el más reciente primero.
- `positionEvolution`: posición y puntos por jornada.
- `whatIsAtStake`: posición y puntos actuales y un escenario por resultado.

La **evolución de la posición** se calcula con todos los partidos de la competición: se acumulan puntos, diferencia de goles y goles a favor jornada a jornada y se ordena con los criterios de la clasificación. Se marca `confidence: estimated` porque es un cálculo propio, no una tabla publicada por la fuente. BDFutbol no ofrece el histórico de posiciones en un formato reutilizable.

**Qué se juega** simula solo los puntos del Depor (victoria +3, empate +1, derrota +0) sin mover al resto de equipos. El rango abarca todas las posiciones empatadas a puntos. `assumption` es una clave estable (`other_results_unchanged`) que la app traduce; nunca se presenta como una certeza. Si falta la clasificación o el próximo partido, `whatIsAtStake` es `null` y el bloque no se pinta.

### 4. `rivals.json`

Se publica en su propio comando (`python -m depor_hub.cli rivals`), no en `ingest`, porque BDFutbol es una fuente externa más lenta y no debe bloquear el refresco de 10 minutos.

Por cada uno de los **19 rivales** de la temporada:

- **Balance histórico completo** desde BDFutbol `vs.php?e1=13&e2=<id>`: partidos, victorias, empates, derrotas, goles a favor y en contra, y los **cinco cruces más recientes**. El alcance se declara como `all_official_matches` y se muestra la fuente y el enlace.
- **Entrenador** desde football-data.org (`teams`).
- **Goleadores** desde football-data.org (`scorers`, máximo 3). Solo se publican goles; las asistencias quedan en `null` cuando la fuente no las da y la app no las muestra.

El mapa football-data → BDFutbol es **manual y verificado** (`data/manual/bdfutbol_teams.yml`): no se resuelve por búsqueda automática porque un homónimo produciría un balance equivocado. Si un rival no tiene id o BDFutbol falla, su `headToHead` es `null` y el bloque desaparece; el resto se publica igual.

`rivals.json` es opcional para la app (404 = sin contexto). `season.json` también: sin él, la Home usa la clasificación y los partidos para el resumen y la racha, y omite detalle, gráfica y «Qué se juega».

### 5. La temporada fusionada

Una sola tarjeta contiene:

- Resumen único (posición, puntos, PJ, G-E-P, GF-GC, DG).
- Racha con chips, **leyenda** (G/E/P) y detalle de los cinco partidos.
- Gráfica de evolución de la posición (`react-native-svg`, sin animación, con etiqueta textual).
- Mini-clasificación de cinco filas centrada en el Depor y enlace a la tabla completa.

Se elimina la tarjeta `MiniTable` independiente para no repetir posición y puntos.

### 6. Tiempo en la sede

Se consulta **Open-Meteo** por coordenadas del estadio, solo cuando:

- el estado es distinto de `SCHEDULED` (hora confirmada),
- el partido está a **16 días o menos**,
- la sede tiene coordenadas verificadas.

No se usa la ubicación del usuario. Solo Riazor (`43.3686, -8.4175`) está verificado; las demás sedes ocultan el tiempo hasta que exista una coordenada contrastada. Se muestra temperatura, grupo de cielo, probabilidad de lluvia y viento, con atribución a Open-Meteo. Un fallo de la API no rompe la Home.

### 7. Calendario y recordatorios

El ADR 0005 queda corregido: `createEventInCalendarAsync` ya no existe. El orden es:

1. **iOS:** `Calendar.presentPicker()` + `cal.addEventWithForm()`, el editor nativo, sin permiso de lectura.
2. **`.ics`** si la API no está disponible (Expo Go, Android, build antigua) o falla.
3. **Error específico** solo si también falla el `.ics`.

Cancelar el picker o el formulario no es un error y no comparte nada. La causa real de que el editor nativo no se pueda probar en Expo Go es que el módulo nativo de `expo-calendar` no está incluido en el cliente de Expo Go; requiere un development build. El `.ics` sí es verificable en Expo Go.

Los recordatorios pasan de `remindMatchIds: number[]` a `remindMatches: Record<matchId, offsets>` con migración automática. Offsets: 1 día, 1 hora, 15 minutos y al inicio. El permiso se pide al pulsar «Recordarme» y el estado visible indica si hay recordatorio. La planificación se recorta a **64 notificaciones** (límite de iOS), priorizando las más próximas.

### 8. Workflow

`rivals-refresh.yml` se ejecuta a diario (`17 6 * * *`) y bajo demanda. Comparte el grupo `data-publish` con `data-refresh` y `news-refresh`, hace `git pull --rebase` antes de empujar y despliega Pages desde un checkout fresco de `main`. El histórico de BDFutbol solo cambia cuando se juega un cruce, así que no necesita la cadencia de 10 minutos.

## Consecuencias

- La Home funciona con `season.json`/`rivals.json` ausentes o con una caché anterior.
- Los esquemas se regeneran con `python -m depor_hub.cli schemas`; el espejo Zod usa `default(...)` para tolerar JSON antiguo.
- `react-native-svg` añade una dependencia nativa: requiere development build para probar la gráfica en dispositivo, aunque Jest la renderiza con el mock del preset.
- Quedan fuera, por falta de fuente fiable: asistencias, coordenadas de las demás sedes y el histórico de posiciones publicado por un tercero.
