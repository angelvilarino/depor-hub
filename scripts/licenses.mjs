#!/usr/bin/env node
// Genera apps/mobile/src/data/licenses.json a partir de package-lock.json.
//
// Solo incluye dependencias de producción (no dev), deduplicadas por nombre y
// versión, y agrupadas por licencia para que la pantalla Acerca de pueda usar una
// SectionList sin aplanar más de mil filas. El resultado es determinista: no lleva
// fecha de generación para que `npm run licenses` no ensucie el árbol sin cambios.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = path.join(ROOT, 'package-lock.json');
const TARGET = path.join(ROOT, 'apps', 'mobile', 'src', 'data', 'licenses.json');

function licenseOf(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) return value.filter(Boolean).join(' OR ') || 'UNKNOWN';
  if (value && typeof value === 'object' && typeof value.type === 'string') return value.type;
  return 'UNKNOWN';
}

function nameOf(key) {
  const parts = key.split('node_modules/');
  return parts[parts.length - 1];
}

const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
const packages = new Map();

for (const [key, entry] of Object.entries(lock.packages ?? {})) {
  if (!key.startsWith('node_modules/')) continue;
  if (entry.dev || entry.link || entry.extraneous) continue;
  const name = nameOf(key);
  const version = entry.version ?? '0.0.0';
  const id = `${name}@${version}`;
  if (!packages.has(id)) {
    packages.set(id, { name, version, license: licenseOf(entry.license) });
  }
}

const groups = new Map();
for (const pkg of packages.values()) {
  const bucket = groups.get(pkg.license) ?? [];
  bucket.push({ name: pkg.name, version: pkg.version });
  groups.set(pkg.license, bucket);
}

const licenses = [...groups.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([license, list]) => ({
    license,
    count: list.length,
    packages: list.sort(
      (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
    ),
  }));

const output = {
  source: 'package-lock.json',
  count: licenses.reduce((sum, group) => sum + group.count, 0),
  licenses,
};
const text = `${JSON.stringify(output, null, 2)}\n`;
const previous = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : null;

if (previous === text) {
  console.log(`Licencias sin cambios: ${output.count} paquetes en ${licenses.length} licencias`);
} else {
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, text, 'utf8');
  console.log(`Licencias actualizadas: ${output.count} paquetes en ${licenses.length} licencias`);
  console.log(`Archivo: ${path.relative(ROOT, TARGET)}`);
}
