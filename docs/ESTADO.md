# Estado del proyecto — 23-oct-2026
H0 (andamiaje), H1 (contratos + ingesta + Pages), H2 (capa de datos) y H3 (calendario) HECHOS. **H4 (plantilla) implementado; pendiente de verificar en dispositivo** (ver «Verificación H4»). Siguiente: H5 (inicio).

## Datos reales (sondeo football-data.org, plan gratuito)
- Acceso a PD (LaLiga) 2026-27; sin Copa del Rey. Depor: id 560, tla DEP.
- Plantilla: posición, nacimiento y nacionalidad 28/28; dorsal y contrato 0/28 → `data/manual/squad_extras.yml` (vacío; solo con fuente).
- Estados de partido: TIMED = hora confirmada; SCHEDULED = hora NO fijada (00:00:00Z). Solo fecha en SCHEDULED; hora en Europe/Madrid solo en TIMED. No inventar horas.
- URL de datos: https://angelvilarino.github.io/depor-hub/v1 (meta, standings, fixtures, squad). Contrato v1 en packages/schemas (Pydantic origen, Zod espejo).

## H3 — Calendario (hecho)
Ver `docs/adr/0005-calendario-y-recordatorios.md` y `0006-escudos-sede-arbitro.md`.

## H4 — Equipo (implementado, ADR 0007)
- Pestaña Equipo: entrenador + plantilla agrupada por posición; ficha de jugador con avatar generado, edad calculada, bloque «Datos pendientes».
- Contrato ampliado de forma aditiva: `Player.heightCm`. Nueva dependencia Python: `pyyaml` (en `scripts/pyproject.toml`).
- Para que los JSON publicados incluyan `heightCm`, lanza **Data refresh con `force`** (la app funciona igual sin ello).
- Para añadir dorsales/contratos/alturas: edita `data/manual/squad_extras.yml` (cada jugador necesita `source`) y relanza Data refresh.

### Verificación H4
```bash
source .venv/bin/activate && pip install -e "scripts[dev]"
ruff check scripts && pytest scripts
python -m depor_hub.cli schemas && git diff --exit-code packages/schemas
npm run lint && npm run typecheck && npm test
```
Probar en iPhone: pestaña Equipo (secciones y contador), tocar un jugador (ficha, «Datos pendientes»), cambiar idioma ES/EN, modo oscuro, modo avión (la plantilla sigue visible con el banner).

## Reglas de trabajo que han evitado errores
- Node 22 (nvm use 22) y venv Python 3.12 (.venv). Aplicar zips con `unzip -o X.zip -d .`, NUNCA reemplazando carpetas en Finder. Commit antes y después de cada hito.
- Instalar dependencias de la app con `npm install -w apps/mobile <pkg>`; módulos nativos con `(cd apps/mobile && npx expo install <pkg>)`. Nunca `npx expo install -- -w ...`.
- Secretos: FOOTBALL_DATA_TOKEN solo en GitHub Secrets y en .env local (ignorado). CONTACT_EMAIL es una variable de Actions. Nada de valores en .env.example.
- tsconfig de la app declara types ["jest","node"]; ESLint con import/no-unresolved desactivado.
- Datos desconocidos = null. Escudos solo por URL externa (ADR 0006); sin fotos de jugadores (ADR 0007).

## Pendiente
H5 inicio, H6 noticias, H7 club y legal, H8 pulido (FlashList, tests de render), H9 distribución. Decisiones abiertas: contactar al club, nombre definitivo, identificadores com.deporhub.app provisionales.
