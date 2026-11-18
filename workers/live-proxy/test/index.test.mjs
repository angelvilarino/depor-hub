import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

const ctx = { waitUntil() {} };

function get(path = '/v1/fixtures.json', headers = {}) {
  return worker.fetch(
    new Request(`https://proxy.test${path}`, { headers }),
    { FOOTBALL_DATA_TOKEN: 't' },
    ctx,
  );
}

test('preflight responde 204 con el origen de Pages', async () => {
  const response = await worker.fetch(
    new Request('https://proxy.test/v1/fixtures.json', {
      method: 'OPTIONS',
      headers: { Origin: 'https://angelvilarino.github.io' },
    }),
    {},
    ctx,
  );

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('Access-Control-Allow-Origin'),
    'https://angelvilarino.github.io',
  );
  assert.equal(response.headers.get('Vary'), 'Origin');
});

test('no refleja un origen ajeno', async () => {
  const response = await worker.fetch(
    new Request('https://proxy.test/v1/fixtures.json', {
      headers: { Origin: 'https://evil.test' },
    }),
    {},
    ctx,
  );

  assert.equal(
    response.headers.get('Access-Control-Allow-Origin'),
    'https://angelvilarino.github.io',
  );
});

test('ALLOWED_ORIGINS permite un origen propio', async () => {
  const response = await worker.fetch(
    new Request('https://proxy.test/v1/fixtures.json', {
      headers: { Origin: 'https://deporhub.test' },
    }),
    { ALLOWED_ORIGINS: 'https://deporhub.test,https://angelvilarino.github.io' },
    ctx,
  );

  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://deporhub.test');
});

test('sin token responde 503 con JSON y sin caché', async () => {
  const response = await worker.fetch(new Request('https://proxy.test/v1/fixtures.json'), {}, ctx);

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'not_configured' });
});

test('solo atiende GET /v1/fixtures.json', async () => {
  assert.equal((await get('/v1/otra.json')).status, 404);
  const post = await worker.fetch(
    new Request('https://proxy.test/v1/fixtures.json', { method: 'POST' }),
    {},
    ctx,
  );
  assert.equal(post.status, 405);
});
