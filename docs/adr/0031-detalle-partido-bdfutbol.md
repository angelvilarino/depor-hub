# ADR 0031 — Detalle de partido con BDFutbol

- **Estado:** aceptado
- **Fecha:** 2026-11-05
- **Contexto:** Hito 4 de la fase 2 (ficha de partido terminada)

## Problema

La ficha `/match/[id]` mostraba marcador, estado, sede, árbitro y jornada, pero
no alineaciones ni eventos. football-data.org en el plan gratuito no los ofrece
y no hay otra fuente gratuita verificada para 2026-27. BDFutbol publica en HTML
las alineaciones, los goles, las tarjetas y los cambios de cada partido.

El informe [`docs/bdfutbol-legal-risk.md`](../bdfutbol-legal-risk.md) concluyó
que reutilizar esa parte de la base tiene **riesgo alto** y recomendó no hacerlo
sin autorización. El responsable del proyecto decidió el **05-nov-2026 asumir el
riesgo** (opción C del informe) para publicar solo hechos deportivos, sin copiar
HTML, fotos, escudos ni textos de la fuente.

## Decisión

1. **Un JSON por partido terminado** en
   `data/public/v1/match-details/<season>/<matchId>.json`. La clave es el `id` de
   football-data.org que ya usa la app; el documento incluye además el
   `bdfutbolId` y la URL de la ficha consultada.
2. **Solo se publican hechos:** alineaciones (titulares, suplentes y
   entrenador), goles, tarjetas y sustituciones. **No** se publican fotos,
   escudos, textos, estadísticas ni datos deducidos del marcador. Lo que la
   fuente no escribe queda en `null` o no aparece. Si la ficha no contiene ni
   alineaciones ni eventos, no se publica un detalle vacío.
3. **Emparejamiento explícito.** `match-details` descarga el calendario de la
   temporada y cruza cada partido terminado por los dos equipos y una fecha a
   menos de tres días. Si hay dos candidatos con la misma distancia, no se elige
   ninguno. Un partido sin emparejamiento se registra como `unresolved` y no
   genera fichero. Si BDFutbol publica un marcador distinto al de
   `fixtures.json`, tampoco se publica detalle: la ficha no debe contradecir el
   resultado oficial que ya muestra la app.
4. **Escritura única.** Si el detalle existe se omite; solo `--force` lo
   reescribe. Corregir un evento es una decisión explícita y queda en Git, igual
   que los snapshots (ADR 0028).
5. **Sustituciones honestas.** Solo se emparejan cuando en el mismo minuto hay
   exactamente un jugador que sale y otro que entra. Si hay dos salidas o dos
   entradas, se publican como registros separados «sale»/«entra»: nunca se
   inventa la pareja.
6. **Degradación normal.** La ficha del partido funciona sin este JSON. Un 404,
   un documento inválido o un partido en juego muestran el aviso actual; el
   workflow de datos no falla si BDFutbol no tiene la ficha, porque el detalle es
   opcional y no debe bloquear `fixtures.json`, los snapshots ni el club.
7. **Contrato aditivo.** Pydantic es el origen, JSON Schema se regenera y Zod lo
   refleja. `MATCH_DETAIL_FILES` añade `match-detail.schema.json`; la app lo lee
   con `useMatchDetail` y lo pinta solo cuando el partido está terminado.

## Consecuencias

- Los partidos terminados muestran alineaciones y eventos reales, con la fuente
  atribuida a BDFutbol en la propia ficha.
- El detalle crece de forma lineal (un fichero pequeño por partido) y no altera
  `fixtures.json`, `meta.dataHash` ni los snapshots.
- La app tolera que el detalle no exista: el marcador y el estado siguen siendo
  la base y los eventos nunca se deducen.
- El riesgo legal asumido queda documentado. Si BDFutbol cambia sus condiciones,
  bloquea el acceso o exige licencia, se puede dejar de generar el detalle sin
  romper la app (`--no-*` no aplica: basta con retirar el paso del workflow).
- La primera pasada genera **11 detalles** de la temporada 2026-27 y las
  siguientes no vuelven a pedir las fichas ya publicadas.

## Alternativas descartadas

- **Deducir eventos del marcador:** inventaría goles, tarjetas y cambios.
- **API v2 de BDFutbol:** sería la vía legítima, pero tiene coste y el proyecto
  mantiene coste cero; queda como propuesta si el riesgo asumido deja de ser
  aceptable.
- **API-Football:** su plan gratuito no cubre 2026-27 y el plan Pro cuesta
  19 $/mes; además no aporta alineaciones completas sin otra fuente.
- **Guardar el HTML de BDFutbol:** reproduciría la base y los textos; solo se
  guardan hechos y la caché HTTP temporal del cliente educado.
- **Reescribir el detalle en cada refresco:** perdería la trazabilidad de una
  corrección y permitiría que un fallo temporal empeorara un dato ya publicado.

## Verificación

```bash
python -m depor_hub.cli match-details            # crea los que falten
python -m depor_hub.cli match-details            # segunda pasada: created=0
python -m depor_hub.cli schemas
ruff check scripts && pytest scripts
```

Cubierto por `scripts/tests/test_match_details.py`: calendario, emparejamiento
inequívoco, goles con penalti/propia puerta, tarjetas, cambios emparejados y
ambiguos, construcción del contrato e idempotencia del comando.
