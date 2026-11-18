# ADR 0036: Higiene del contrato, auditoría y documentación

- **Estado:** Aceptado
- **Fecha:** 2026-11-18
- **Contexto:** la auditoría de noviembre de 2026 encontró documentos y campos que
  el pipeline generaba pero ninguna pantalla leía, tres esquemas mantenidos a
  mano, CI que no probaba el Worker ni el contrato publicado, una auditoría de
  dependencias informativa y documentación que contradecía el estado real.

## Decisión

- **Contrato mínimo.** Se retiran `social.json`, `keyPlayers` y
  `marketValueEur`. Ninguno tenía consumidor: `social.json` no se pintaba desde
  ADR 0018, `keyPlayers` viajaba vacío en los 19 rivales y `marketValueEur`
  estaba en `null` en los 28 jugadores. Pydantic, JSON Schema, Zod, datos y
  pruebas quedan sin referencias.
- **`provenance` se conserva.** Es la traza de fuente y confianza por campo del
  JSON publicado; se retira el código cliente que resumía esa procedencia, no el
  dato. Un campo sin procedencia no se publica.
- **Precedencia de fuentes.** `data/manual/squad_overrides.yml` manda sobre
  `squad_extras.yml`, y este sobre la propuesta automática. Los conflictos se
  registran con su resolución en `squad_enrich.proposed.yml`, que ya no se
  versiona: se descarga como artefacto del workflow `enrich`. Lo publicado no
  puede contener `confidence: conflict`.
- **Paridad de esquemas.** Pydantic genera JSON Schema (`cli schemas`) y CI
  comprueba que no hay diferencias. Un test de la app compara los campos de cada
  esquema con su objeto Zod, incluidos los `$defs` anidados.
- **CI como puerta.** Se añaden los tests del Worker, el smoke del contrato
  publicado y Prettier. `npm audit --omit=dev` es bloqueante con una allowlist de
  toolchain fechada (`scripts/audit.mjs`): Metro, codegen y Jest no viajan en el
  binario, pero un aviso nuevo en una dependencia de ejecución rompe el job.
- **Dependencias fijadas.** `scripts/requirements.lock` con hashes; Dependabot
  cubre npm raíz, `workers/live-proxy`, `pip` y las acciones. Las acciones de
  todas las workflows van fijadas por SHA con la versión en comentario.
- **Arranque reproducible.** El README describe `nvm use` y `npm install`; no hay
  pasos ocultos ni `setup.sh`.

## Consecuencias

- El cliente descarta campos que ya no existen en el contrato y tolera cachés
  anteriores (`z.object` no estricto en los objetos de borde).
- Un campo nuevo en el servidor exige actualizar Zod y pasa por dos pruebas: la
  de paridad y la de contrato publicado.
- La allowlist de auditoría caduca: `scripts/audit.mjs` lleva la fecha de
  revisión y la lista de raíces de toolchain debe revisarse en cada subida de
  Expo o Jest.
- Los documentos de auditoría se conservan como registro histórico; el estado
  vigente vive en [`docs/ESTADO.md`](../ESTADO.md).
