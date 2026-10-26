# ADR 0014 — Entrenador, cuerpo técnico y ficha v2

- **Estado:** aceptada (26-oct-2026).
- **Alcance:** completar la pestaña Equipo y la ficha de jugador al nivel de Sofascore/Flashscore y añadir una ficha de entrenador con su cuerpo técnico, sin romper el contrato `v1` ni las cachés anteriores.
- **Regla base:** solo se publica lo que una fuente identificable sostiene. Si un dato no existe, se muestra un estado vacío; no se inventa una etapa, un miembro del staff ni una foto.

## Contexto

La ficha de jugador ya tenía retrato, biografía, partidos y trayectoria (ADR 0007, 0009 y 0011), y los escudos de carrera y rivales estaban resueltos (ADR 0012). Faltaban tres cosas para cerrar H4:

1. La pestaña Equipo seguía mostrando edad media, un conmutador con texto y una cabecera de lista que se cortaba.
2. La ficha no separaba la temporada actual de la carrera completa, no enlazaba los partidos con el calendario y truncaba filas.
3. El entrenador solo era un nombre y una nacionalidad; no había ficha ni cuerpo técnico.

## Decisiones

### 1. Contrato aditivo y compatibilidad

Se amplía `Coach` con `birthPlace`, `photoUrl`, `career` y `staff`. `CareerEntry` gana `role` (`player` | `coach`, por defecto `player`) para distinguir la trayectoria como jugador de la de entrenador. `StaffMember` es un objeto nuevo con `name`, `role` y `photoUrl`.

- Pydantic sigue siendo el origen; `packages/schemas` se regenera y el espejo Zod usa `default(null)`, `default([])` y `default('player')`.
- Los JSON y las cachés anteriores validan sin migración: los campos nuevos son opcionales o tienen valor por defecto.
- Se sube `buster` a **`data-v5`** porque la caché persistida de la app no tiene entrenador ni los campos nuevos de carrera.

### 2. Fuentes y prioridad

| Dato | Fuente | Regla |
|---|---|---|
| Nombre y nacionalidad | football-data.org | Autoritativos: el enriquecimiento nunca los pisa. |
| Fecha y lugar de nacimiento | Wikipedia ES, con Wikidata `P569`/`P19`/`P27` como contraste | Wikipedia manda en el lugar; Wikidata aporta la fecha si falta. |
| Trayectoria como jugador y entrenador | Tablas de Wikipedia ES | Se separan por sección y se marca `role`. |
| Foto | `og:image` de la ficha oficial del entrenador | Se quita el recorte social (`?rect=…&w=…`); si no hay, iniciales. |
| Cuerpo técnico | `https://www.rcdeportivo.es/es/depor` | Solo lo que publica la web oficial; 21 miembros en la última pasada. |

El entrenador actual se identifica con Wikidata `Q602465` (Antonio Hidalgo). `data/manual/coach.yml` es la salida generada y revisable; `python -m depor_hub.cli coach` la regenera. `ingest` y `enrich --apply` aceptan `--coach` para aplicarla.

### 3. Trayectoria y cuerpo técnico

- Las secciones «Como jugador» y «Como entrenador» se parsean por separado. Las filas contiguas del mismo club y rol se unifican en un solo periodo; la app vuelve a unificar por si el JSON trae filas por temporada (`mergeCareerPeriods`).
- El rol se conserva en `CareerEntry.role` y la ficha del entrenador permite alternar **jugador/entrenador** cuando existen ambas trayectorias.
- El cuerpo técnico se guarda con claves estables (`head_coach`, `assistant_coach`, `goalkeeping_coach`, `fitness_coach`, `rehab_coach`, `physiotherapist`, `doctor`, `nutritionist`, `psychologist`, `podiatrist`, `analyst`, `delegate`, `kit_manager`). La app las traduce y, si no conoce una, muestra la clave original; nunca inventa un rol.
- El balance del entrenador **no se almacena**: se calcula en la app desde `fixtures.json` con `coachRecord`, contando solo partidos `FINISHED` y, si hay `since`, desde ese año. Así el dato no se queda obsoleto al publicar una jornada nueva.

### 4. Pestaña Equipo v2

- Se elimina la edad media del resumen: no aporta y envejece mal.
- El conmutador cuadrícula/lista usa solo los iconos `grid-outline` y `list-outline`, con 44 pt y estado `selected`; se mantiene la preferencia en Zustand.
- Los chips de posición van en una fila horizontal con contador y desplazamiento; la cabecera de la lista es `# / Jugador / Edad` y no se corta.
- Las tarjetas son más compactas. Si `loanTo` existe, se muestra la etiqueta **Cedido**.
- El buscador tiene botón de borrar y oculta el teclado al hacer scroll (`keyboardDismissMode="on-drag"`).
- La tarjeta del entrenador muestra foto, nombre y nacionalidad, y navega a `/coach`.
- El banner de frescura solo aparece si los datos tienen más de 12 h o si hay error/sin conexión; no ocupa espacio cuando todo está al día.

### 5. Ficha de jugador v2

- El hero es compacto y estable: retrato, nombre, fila de identidad con escudo del Depor, bandera, nacionalidad, posición y edad, y dorsal grande. La foto se amplía en un modal con atribución.
- El selector de ámbito es **«Depor 26-27 | Carrera»** y controla la franja de estadísticas: temporada actual (partidos con el Depor de esa temporada) o totales de carrera. La pestaña Partidos usa el mismo ámbito, de modo que «Depor 26-27» no mezcla partidos históricos. No se muestran asistencias.
- Tres pestañas: **Resumen** (bio, redes y pendientes), **Partidos** (con escudo, Local/Visitante, marcador, resultado y enlace a `/match/[id]`) y **Carrera** (timeline con escudos y periodos unificados).
- Las filas no se truncan; los textos largos pueden ocupar dos líneas.
- El botón de volver dice **«Equipo»**; en la ficha del entrenador también. Ajustes es un icono neutro de al menos 44 pt, sin círculo azul que se solape.

### 6. Accesibilidad, i18n y pulido

- Zonas táctiles de al menos 44 pt, etiquetas accesibles en iconos y estados de carga/error/vacío.
- ES y EN completos; GL tiene las claves principales y cae a ES para el resto.
- Números y fechas se formatean con `Intl` según el idioma.
- Los colores de victoria/empate/derrota mantienen contraste AA ≥ 4,5 en claro y oscuro.
- `TeamCrest` reserva siempre el hueco y pinta un monograma mientras carga o si falla; `CoachPortrait` hace lo mismo con las iniciales.

### 7. Idempotencia y pruebas

- `apply_coach` rellena solo huecos y no pisa nombre ni nacionalidad de la API; `reset_coach` retira únicamente los campos y la procedencia que puso el enriquecimiento. Una segunda aplicación devuelve el mismo objeto.
- `scripts/tests/test_coach.py` cubre parsers de Wikipedia y de la web oficial, foto, extracción cruzada, `load_coach`, `apply_coach`, `reset_coach`, compatibilidad con procedencia antigua e idempotencia.
- La app cubre Equipo, ficha y entrenador con tests de render; `squadLogic.test.ts` cubre `coachRecord`, `mergeCareerPeriods`, `groupStaff`, `shortSeason` y `formatNumber`.

## Consecuencias

- El contrato sigue siendo `v1`: solo se añaden campos con valor por defecto.
- La cobertura de escudos queda **156/156** entradas de carrera (**75/75** clubes) y **1229/1262** partidos (**76/82** rivales distintos; los 20 de LaLiga, al 100 %). Los 6 rivales sin escudo son históricos de Segunda B y se quedan en monograma.
- El cuerpo técnico depende de que la web oficial lo publique; si cambia el HTML, el parser devuelve una lista vacía y la app no muestra la sección. No se rellena con terceros.
- El balance del entrenador solo cubre la temporada publicada; no se presenta como histórico completo.
- Riesgo legal: la foto del entrenador es del club y se enlaza con atribución editorial, igual que las de los jugadores (ADR 0009). No se guardan binarios.

## Referencias

- `scripts/depor_hub/enrich/coach.py`, `scripts/depor_hub/extras.py`, `scripts/depor_hub/models.py`, `scripts/depor_hub/cli.py`.
- `data/manual/coach.yml`, `data/public/v1/squad.json`.
- `apps/mobile/app/(tabs)/team.tsx`, `apps/mobile/app/player/[id].tsx`, `apps/mobile/app/coach.tsx`.
- `apps/mobile/src/components/{TeamCrest,CoachPortrait,CareerTimeline}.tsx`, `apps/mobile/src/features/squad/logic.ts`.
- ADR 0007, 0009, 0011 y 0012.
