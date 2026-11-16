#!/usr/bin/env node
/**
 * Calcula p50/p95 de una tanda de arranques en frío (F3-14).
 *
 * Acepta la salida de `adb shell am start -W` (una o varias tandas) o una lista
 * de milisegundos, un valor por línea. El protocolo completo está en
 * docs/auditoria/ARRANQUE.md.
 *
 * Uso:
 *   node scripts/startup-report.mjs arranque.txt
 *   adb shell am start -W -n com.deporhub.app/.MainActivity | node scripts/startup-report.mjs
 *
 * Sale con código 1 si p95 supera el objetivo de 2.500 ms.
 */
import { readFileSync } from 'node:fs';

const TARGET_MS = 2500;

function readInput() {
  const file = process.argv[2];
  if (file) return readFileSync(file, 'utf8');
  return readFileSync(0, 'utf8'); // stdin
}

function parseTimes(text) {
  const total = [...text.matchAll(/TotalTime:\s*(\d+)/g)].map((match) => Number(match[1]));
  if (total.length > 0) return total;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line))
    .map(Number);
}

/** Percentil con interpolación lineal, igual que `numpy.percentile` por defecto. */
function percentile(sorted, fraction) {
  if (sorted.length === 0) return Number.NaN;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower));
}

const times = parseTimes(readInput()).sort((a, b) => a - b);

if (times.length === 0) {
  console.error('No hay tiempos. Pasa la salida de `adb shell am start -W` o un número por línea.');
  process.exit(2);
}

const p50 = percentile(times, 0.5);
const p95 = percentile(times, 0.95);

console.log(`Arranques en frío: ${times.length}`);
console.log(
  `Mínimo: ${times[0]} ms · p50: ${p50} ms · p95: ${p95} ms · máximo: ${times.at(-1)} ms`,
);
console.log(
  p95 <= TARGET_MS ? `OK: p95 ≤ ${TARGET_MS} ms` : `Por encima del objetivo: p95 > ${TARGET_MS} ms`,
);

process.exit(p95 <= TARGET_MS ? 0 : 1);
