/**
 * Proxy de solo lectura para el marcador en directo (Hito 4).
 *
 * - Una única ruta pública: GET /v1/fixtures.json con el mismo contrato que la app.
 * - El token de football-data.org vive como secreto del Worker, nunca en la app.
 * - Cachea 60 s en el edge para no agotar el plan gratuito (10 req/min).
 * - Si la API falla, responde 502. La app conserva los datos estáticos y no inventa nada.
 */
import { transformFixtures } from './transform.js';

const API = 'https://api.football-data.org/v4';
const CACHE_SECONDS = 60;

const DEFAULT_ORIGIN = 'https://angelvilarino.github.io';

// F5-13: solo el origen de Pages puede leer la respuesta desde un navegador. La app
// nativa no envía `Origin`, así que el CORS no le afecta.
function cors(request, env) {
  const allowed = (env?.ALLOWED_ORIGINS ?? DEFAULT_ORIGIN)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    Vary: 'Origin',
  };
}

function json(request, env, body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge ? `public, max-age=30, s-maxage=${maxAge}` : 'no-store',
      ...cors(request, env),
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: cors(request, env) });
    if (request.method !== 'GET') return json(request, env, { error: 'method_not_allowed' }, 405);
    if (url.pathname !== '/v1/fixtures.json')
      return json(request, env, { error: 'not_found' }, 404);
    if (!env?.FOOTBALL_DATA_TOKEN) return json(request, env, { error: 'not_configured' }, 503);

    const cache = globalThis.caches?.default;
    const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    const competition = env.FOOTBALL_DATA_COMPETITION || 'PD';
    let upstream;
    try {
      upstream = await fetch(`${API}/competitions/${competition}/matches`, {
        headers: {
          'X-Auth-Token': env.FOOTBALL_DATA_TOKEN,
          Accept: 'application/json',
        },
      });
    } catch {
      return json(request, env, { error: 'upstream_unreachable' }, 502);
    }
    if (!upstream.ok)
      return json(request, env, { error: 'upstream_error', status: upstream.status }, 502);

    let payload;
    try {
      payload = await upstream.json();
    } catch {
      return json(request, env, { error: 'upstream_invalid' }, 502);
    }

    const response = json(request, env, transformFixtures(payload), 200, CACHE_SECONDS);
    if (cache && ctx?.waitUntil) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
