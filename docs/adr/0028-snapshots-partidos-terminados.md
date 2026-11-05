# ADR 0028 — Snapshots congelados de partidos terminados

- **Estado:** aceptado
- **Fecha:** 2026-11-04
- **Contexto:** H3.5 de la fase 2 (fiabilidad de datos y ficha de partido)

## Problema

`fixtures.json` solo contiene la temporada en curso. Cuando football-data.org deja
de devolver un partido antiguo —o cuando la temporada avanza— la ficha
`/match/[id]` se queda sin datos y muestra «partido no encontrado», aunque el
resultado ya se publicó. Reescribir `fixtures.json` no resuelve el problema: el
contrato está pensado para la temporada viva y no debe crecer con el histórico.

Además, la ficha debe seguir siendo honesta: un resultado final no permite
deducir goles, tarjetas, alineaciones ni estadísticas.

## Decisión

1. **Un JSON congelado por partido terminado** en
   `data/public/v1/snapshots/<season>/<matchId>.json`, con el contrato
   `MatchSnapshot` (Pydantic → JSON Schema → Zod). Incluye solo lo que publica la
   fuente: equipos, marcador final y de descanso, fecha, jornada, fase, sede,
   árbitro y `deporIsHome`. No contiene eventos, alineaciones, estadísticas ni
   campos inferidos.
2. **Solo se crea con marcador final.** `cmd_snapshots` recorre `fixtures.json` y
   escribe únicamente partidos `FINISHED` o `AWARDED` con `score.home` y
   `score.away` no nulos. Un `TIMED`, `IN_PLAY` o un terminado sin marcador no
   genera fichero.
3. **Escritura única.** Si el snapshot existe, se omite. Solo `--force` lo
   reescribe; así una corrección puntual es una decisión explícita y auditable.
   El workflow `data-refresh.yml` ejecuta `snapshots` después de la ingesta y
   antes de validar y publicar.
4. **Fallback en la app.** `useMatchSnapshot(season, matchId)` lee el snapshot
   solo cuando el partido no está en `fixtures.json`. Un 404, un JSON inválido o
   una temporada desconocida se tratan como ausencia: la ficha muestra el estado
   vacío de siempre, nunca datos inventados.
5. **Contrato aditivo y tolerante.** `capturedAt` deja claro cuándo se congeló;
   `source` identifica la fuente. Los campos opcionales usan `null`. El snapshot
   no entra en `meta.dataHash` ni sustituye a `fixtures.json`.

## Consecuencias

- Una ficha antigua sigue funcionando aunque el partido desaparezca de la API.
- El histórico crece de forma lineal (un fichero pequeño por partido), sin
  reescribir `fixtures.json` ni romper su contrato.
- El snapshot no puede «arreglar» un hueco de la fuente: si no había árbitro,
  sede o marcador de descanso, se publica `null`.
- La app no depende de que exista el snapshot; la ausencia es un caso normal.
- Cambiar un resultado publicado requiere `--force` y queda en el historial de
  Git.

## Alternativas descartadas

- **Guardar todo el histórico en `fixtures.json`:** mezcla temporada viva y
  archivo, hace crecer el documento que se descarga en cada arranque y complica
  la compatibilidad.
- **Reescribir el snapshot en cada refresco:** perdería el sentido de «foto
  congelada» y un fallo temporal de la API podría empeorar un dato ya bueno.
- **Rellenar eventos o estadísticas desde el marcador:** inventaría datos. La
  ficha mantiene el aviso de disponibilidad y la fuente.
