# ADR 0030 — Proxy de lectura para el marcador en directo

- **Estado:** aceptado (despliegue pendiente de cuenta Cloudflare)
- **Fecha:** 2026-11-05
- **Contexto:** Hito 4 de la fase 2 (partido en directo)

## Problema

La app lee `fixtures.json` de GitHub Pages, que se refresca cada 30 min. Eso
basta para el calendario, pero un partido en juego necesita el marcador cada
30–60 s. Llamar a football-data.org desde la app exigiría llevar el token al
bundle y lo expondría; además, el plan gratuito permite 10 peticiones/minuto y
multiplicar usuarios agotaría la cuota.

API-Football no es una opción: su plan gratuito no cubre 2026-27 y el plan Pro
cuesta 19 $/mes. El objetivo de la fase es coste cero.

## Decisión

1. **Cloudflare Worker de solo lectura** en `workers/live-proxy`, con una única
   ruta `GET /v1/fixtures.json` que devuelve **el mismo contrato** que
   `fixtures.json`. Solo incluye partidos del Depor de la temporada actual.
2. **El token vive como secreto del Worker** (`FOOTBALL_DATA_TOKEN`), nunca en
   la app, el repositorio ni GitHub Pages. El Worker no acepta escrituras ni
   parámetros que permitan consultar otra competición.
3. **Caché en el edge de 60 s** y `staleTime`/`refetchInterval` de 30/60 s en la
   app. Así el origen recibe como máximo una petición por minuto y por PoP, muy
   por debajo del límite gratuito.
4. **Transformación mínima:** equipos, marcador final y de descanso, estado,
   jornada, fase, sede, árbitro y `deporIsHome`. **No hay eventos, alineaciones
   ni estadísticas**, y no se deducen del marcador.
5. **Fusión honesta en la app:** `mergeFixtures` superpone por `id` los partidos
   del proxy sobre la publicación estática. Si el proxy falla, no está
   configurado o devuelve datos más antiguos que la publicación, se ignoran y la
   app sigue con lo estático. Nunca se retrocede un resultado ya publicado.
6. **Sin variable `EXPO_PUBLIC_LIVE_BASE_URL`, el directo está apagado.** No hay
   peticiones, ni errores, ni comportamiento distinto: la app funciona como
   antes.

## Consecuencias

- El marcador en directo puede actualizarse cada minuto sin exponer el token.
- El Worker se despliega una vez y no forma parte del build de la app.
- Si football-data cae, la app conserva el último dato estático; el Worker
  responde `502` y no se inventa un resultado.
- El plan gratuito de Workers (100.000 peticiones/día) sobra para este uso.
- Sigue sin haber eventos, alineaciones o estadísticas: la ficha mantiene el
  aviso de disponibilidad (ADR 0028).

## Alternativas descartadas

- **Llamar a football-data desde la app:** expone el token y multiplica las
  peticiones por usuario.
- **API-Football Pro:** 19 $/mes y no resuelve eventos sin otra fuente.
- **Refrescar `fixtures.json` cada minuto desde GitHub Actions:** gasta minutos
  de Actions, compite con las otras publicaciones y sigue sin ser tiempo real.
- **WebSocket propio:** no hay fuente gratuita de eventos y añade servidor,
  autenticación y coste.
- **Servir el proxy desde Pages Functions:** requeriría otro despliegue y no
  aporta nada frente a Worker para una única ruta cacheada.

## Pendiente para cerrar el Hito 4

El código y las pruebas están en el repositorio, pero el Worker no se ha
desplegado porque no hay cuenta/token de Cloudflare en esta sesión. Al desplegar:

```bash
cd workers/live-proxy
npx wrangler secret put FOOTBALL_DATA_TOKEN
npx wrangler deploy
```

y definir `EXPO_PUBLIC_LIVE_BASE_URL` en el entorno de build. Mientras no exista,
el Hito 4 queda en modo terminado (snapshots), no en modo directo.
