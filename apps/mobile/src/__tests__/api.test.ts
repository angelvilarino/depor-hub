import fs from 'fs';
import path from 'path';
import { DataError, fetchData } from '@/data/api';
import { Squad } from '@/data/schemas';

const example = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../packages/schemas/examples/squad.json'),
    'utf8',
  ),
);
const BASE = 'https://example.test/v1';
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

const respond = (status: number, body: unknown) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

async function kindOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e instanceof DataError ? e.kind : 'otro';
  }
  return 'sin_error';
}

describe('fetchData', () => {
  it('devuelve datos validados', async () => {
    fetchMock.mockReturnValue(respond(200, example));
    const data = await fetchData('squad.json', Squad, BASE);
    expect(data.players).toHaveLength(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/squad.json`);
  });

  it('sin URL base: not_configured', async () => {
    expect(await kindOf(fetchData('squad.json', Squad, ''))).toBe('not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('HTTP 500: http', async () => {
    fetchMock.mockReturnValue(respond(500, {}));
    expect(await kindOf(fetchData('squad.json', Squad, BASE))).toBe('http');
  });

  it('JSON que no cumple el contrato: invalid', async () => {
    fetchMock.mockReturnValue(respond(200, { ...example, players: 'no-es-una-lista' }));
    expect(await kindOf(fetchData('squad.json', Squad, BASE))).toBe('invalid');
  });

  it('un campo desconocido no invalida el documento (F3-05)', async () => {
    fetchMock.mockReturnValue(respond(200, { ...example, extra: true }));
    const parsed = await fetchData('squad.json', Squad, BASE);
    expect(parsed.players.length).toBeGreaterThan(0);
  });

  it('fallo de red: network', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await kindOf(fetchData('squad.json', Squad, BASE))).toBe('network');
  });
});
