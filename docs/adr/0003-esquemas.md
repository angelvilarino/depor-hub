# ADR 0003 — Contratos de datos: Pydantic como origen, Zod en espejo
- **Estado:** aceptada (H1)
- **Decisión:** modelos Pydantic (`scripts/depor_hub/models.py`) → JSON Schema exportado a `packages/schemas/*.schema.json` (CI falla si no está al día). Zod en `apps/mobile/src/data/schemas.ts` en espejo.
- **Garantía de sincronía:** `packages/schemas/examples/*.json` (sintéticos) los validan Pydantic (pytest) y Zod (jest). Si divergen, falla un CI.
- **Reglas del contrato v1:** camelCase; todas las claves siempre presentes; desconocido = `null`; `extra=forbid`; cambios incompatibles => `/v2/`.
- **No se publican escudos/imágenes** en H1 (decisión legal pendiente; ver riesgo 7).
