# Proxy en directo (Cloudflare Worker)

Proxy de **solo lectura** que devuelve el mismo contrato `fixtures.json` que la
app ya conoce, pero con el marcador actualizado. No sustituye a Pages: la app
fusiona estos partidos sobre los datos estáticos y, si el Worker falla, sigue
funcionando con la última publicación.

- **Ruta:** `GET /v1/fixtures.json`
- **Fuente:** `football-data.org` (competición `PD`), solo partidos del Depor.
- **Caché:** 30 s en cliente y 60 s en el edge. Protege el plan gratuito
  (10 peticiones/minuto).
- **Contrato:** `updatedAt`, `season` y `matches`; cada partido incluye equipos,
  marcador, estado, jornada, fase, sede y árbitro. **No hay eventos,
  alineaciones ni estadísticas** y no se deducen del marcador.
- **Errores:** `503` si falta el secreto, `502` si football-data falla. La app
  nunca inventa un resultado a partir de un error.

## Despliegue (una vez)

```bash
cd workers/live-proxy
npm install
npx wrangler login
npx wrangler secret put FOOTBALL_DATA_TOKEN   # pega el token existente
npx wrangler deploy
```

Wrangler imprime la URL `https://depor-hub-live.<cuenta>.workers.dev`. Define en
`apps/mobile/.env` (y en el build de producción):

```bash
EXPO_PUBLIC_LIVE_BASE_URL=https://depor-hub-live.<cuenta>.workers.dev/v1
```

Sin esa variable la app no hace ninguna petición en directo y se queda con los
datos estáticos. No se guarda ningún token en la app ni en este repositorio.

## Coste

Plan gratuito de Cloudflare Workers: 100.000 peticiones/día. La caché de 60 s
hace que, incluso con varios usuarios, el origen reciba como máximo una petición
por minuto y por PoP. No se necesita plan de pago ni API-Football.

## Pruebas

```bash
cd workers/live-proxy && npm test
```

Las pruebas cubren el recorte al Depor, el orden, el marcador ausente, el
árbitro principal y la etiqueta de temporada.
