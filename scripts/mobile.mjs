#!/usr/bin/env node
/**
 * Arranca Expo y, a la vez, sirve `data/public` en local.
 *
 * La app deriva la URL de datos del host de Metro (ver apps/mobile/src/config.ts),
 * así que esto funciona en simulador y en un móvil de la misma red sin tocar IPs.
 * El servidor estático es de solo lectura y añade CORS para que la app pueda leerlo.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = path.join(ROOT, 'data', 'public');
const PORT = Number(process.env.EXPO_PUBLIC_DATA_PORT || process.env.DEPOR_DATA_PORT || 8000);

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function send(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const target = path.resolve(DATA_ROOT, relative || '.');
    if (target !== DATA_ROOT && !target.startsWith(DATA_ROOT + path.sep)) {
      send(response, 403, 'Prohibido');
      return;
    }
    const info = await stat(target).catch(() => null);
    if (!info?.isFile()) {
      send(response, 404, 'No encontrado');
      return;
    }
    response.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    createReadStream(target).pipe(response);
  } catch (error) {
    send(response, 500, `Error sirviendo datos: ${error}`);
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.warn(`[datos] El puerto ${PORT} ya está ocupado; se usará el servidor existente.`);
    startExpo();
    return;
  }
  console.error('[datos] No se pudo arrancar el servidor local:', error);
  process.exitCode = 1;
});

function startExpo() {
  const child = spawn('npm', ['run', 'start', '-w', 'apps/mobile', '--', ...process.argv.slice(2)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_DATA_PORT: String(PORT) },
  });
  const stop = (signal) => {
    child.kill(signal);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  child.on('exit', (code) => {
    server.close(() => process.exit(code ?? 0));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[datos] Sirviendo ${DATA_ROOT} en http://0.0.0.0:${PORT}/v1`);
  startExpo();
});
