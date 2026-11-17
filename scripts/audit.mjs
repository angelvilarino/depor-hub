#!/usr/bin/env node
/**
 * Puerta de auditoría de dependencias (F5-03).
 *
 * `npm audit` recorre el árbol completo: también las herramientas de build y
 * test, cuyos avisos no viajan en el binario. Este script falla solo cuando hay
 * una vulnerabilidad `high`/`critical` fuera de las cadenas de toolchain
 * aceptadas, de modo que un aviso real en una dependencia de ejecución rompe CI.
 *
 * La reachabilidad se calcula con `package-lock.json`: una vulnerabilidad queda
 * cubierta si cuelga (directa o transitivamente) de alguna raíz de `ROOTS`.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const REVIEWED = '2026-11-17';

/** Raíces de toolchain aceptadas, con el motivo por el que no viajan en la app. */
const ROOTS = {
  expo: 'CLI, Metro y codegen de Expo: se ejecutan al construir.',
  'react-native': 'Codegen y Metro de React Native: se ejecutan al construir.',
  'react-native-reanimated': 'Plugin de compilación; el runtime no procesa datos remotos.',
  jest: 'Runner de tests.',
  'jest-expo': 'Preset de tests de Expo.',
  '@testing-library/react-native': 'Utilidades de test resueltas como peer de expo-router.',
};

/** Avisos aceptados fuera de las raíces, con motivo y fecha de revisión. */
const EXTRA_ALLOWED = {};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadAudit() {
  const result = spawnSync('npm', ['audit', '--omit=dev', '--audit-level=high', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!result.stdout) fail(`No se pudo ejecutar npm audit: ${result.stderr || 'sin salida'}`);
  try {
    return JSON.parse(result.stdout);
  } catch {
    return fail('npm audit no devolvió JSON válido');
  }
}

function loadGraph() {
  let lock;
  try {
    lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  } catch {
    fail('Falta package-lock.json: la auditoría necesita el árbol fijado.');
  }
  const graph = new Map();
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    const name = path.split('node_modules/').pop();
    if (!name) continue;
    const names = graph.get(name) ?? new Set();
    const deps = {
      ...entry.dependencies,
      ...entry.optionalDependencies,
      ...entry.peerDependencies,
    };
    for (const dep of Object.keys(deps)) names.add(dep);
    graph.set(name, names);
  }
  return graph;
}

function reachableFrom(graph, roots) {
  const seen = new Set(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const name = queue.pop();
    for (const dep of graph.get(name) ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      queue.push(dep);
    }
  }
  return seen;
}

const report = loadAudit();
const vulnerabilities = report.vulnerabilities ?? {};
const toolchain = reachableFrom(loadGraph(), Object.keys(ROOTS));

const blocking = Object.entries(vulnerabilities)
  .filter(([, entry]) => entry.severity === 'high' || entry.severity === 'critical')
  .filter(([name]) => !toolchain.has(name) && !(name in EXTRA_ALLOWED))
  .map(([name, entry]) => `${name} (${entry.severity}): ${entry.via.map(describe).join(', ')}`);

const counts = report.metadata?.vulnerabilities ?? {};
const accepted = Object.keys(vulnerabilities).filter(
  (name) => toolchain.has(name) || name in EXTRA_ALLOWED,
).length;
console.log(
  `npm audit: ${counts.high ?? 0} high, ${counts.critical ?? 0} critical; ` +
    `${accepted} en toolchain aceptada (revisado ${REVIEWED})`,
);

if (blocking.length > 0) {
  console.error(`\nVulnerabilidades fuera de la allowlist (${blocking.length}):`);
  for (const line of blocking) console.error(`  - ${line}`);
  console.error(
    '\nActualiza la dependencia o añade el paquete a EXTRA_ALLOWED en scripts/audit.mjs con motivo y fecha.',
  );
  process.exit(1);
}

function describe(via) {
  return typeof via === 'string' ? via : (via.title ?? via.name ?? 'advisory');
}
