# Estado del proyecto — 20-oct-2026
H0 (andamiaje), H1 (contratos + ingesta + Pages) y H2 (capa de datos con caché y modo sin conexión) HECHOS y verificados en iPhone. **H3 (calendario) implementado; pendiente de verificar en dispositivo** (ver «Verificación H3»). Siguiente: H4 (plantilla).

## Datos reales (sondeo football-data.org, plan gratuito)
- Acceso a PD (LaLiga) 2026-27; sin Copa del Rey. Depor: id 560, tla DEP.
- Plantilla: posición, nacimiento y nacionalidad 28/28; dorsal y contrato 0/28 (plan H4: data/manual/squad_extras.yml).
- Estados de partido: TIMED = hora confirmada (p. ej. 2026-10-24T19:00Z); SCHEDULED = hora NO fijada, viene a las 00:00:00Z. H3: mostrar solo la fecha en SCHEDULED, hora en Europe/Madrid solo en TIMED. No inventar horas.
- URL de datos: https://angelvilarino.github.io/depor-hub/v1 (meta, standings, fixtures, squad). Contrato v1 en packages/schemas (Pydantic origen, Zod espejo).

## H3 — Calendario (implementado)
- Pestaña Calendario: Próximos / Resultados / Clasificación, agrupado por mes, pull-to-refresh y banner de frescura. Detalle en `app/match/[id].tsx`.
- Recordatorios locales opt-in por partido (24 h y 1 h antes, solo TIMED), reprogramados por `ReminderSync`. Ajuste global en Ajustes.
- Añadir partido al calendario del sistema y exportar todo el calendario en .ics.
- Decisiones en `docs/adr/0005-calendario-y-recordatorios.md`. Sin cambios en contrato ni en Python.

## Ampliación H3 (ADR 0006): escudos, sede y árbitro
- Contrato ampliado de forma aditiva: `crestUrl`, `venue`, `referee`. Sede de partidos fuera de casa = estadio del local. Árbitro solo si la API lo da (el plan gratuito puede no traerlo; entonces no se muestra).
- **Tras aplicar el zip:** `(cd apps/mobile && npx expo install expo-image)` y lanza el workflow **Data refresh con `force`** para que los JSON publicados incluyan los campos nuevos (mientras tanto la app funciona igual: los campos faltan = null y se ven monogramas).
- Comprueba qué cubre tu token: `python -m depor_hub.cli probe` (ahora cuenta escudos, estadios y árbitros).
- CI: `git diff --exit-code packages/schemas` exige que los `*.schema.json` coincidan con Pydantic; se regeneraron a mano replicando el formato. Si CI falla ahí, ejecuta `python -m depor_hub.cli schemas` y haz commit del resultado.

### Verificación H3
```bash
(cd apps/mobile && npx expo install expo-notifications expo-calendar expo-file-system expo-sharing expo-image)
npm run lint && npm run typecheck && npm test
```
Las APIs nativas se escribieron sin acceso a red; si `typecheck` falla en `features/calendar/system.ts` (expo-file-system `File`/`Paths`, expo-calendar) o `features/reminders/notifications.ts` (tipos del trigger), consulta la doc de la versión instalada (AGENTS.md). Esos dos ficheros son los únicos que tocan módulos nativos. Probar en iPhone: Recordarme (permiso contextual), recordatorio con un partido cercano, añadir al calendario, exportar .ics, modo avión.

## Reglas de trabajo que han evitado errores
- Node 22 (nvm use 22) y venv Python 3.12 (.venv). Aplicar zips con `unzip -o X.zip -d .`, NUNCA reemplazando carpetas en Finder. Commit antes y después de cada hito.
- Instalar dependencias de la app con `npm install -w apps/mobile <pkg>`; módulos nativos con `(cd apps/mobile && npx expo install <pkg>)`. Nunca `npx expo install -- -w ...`.
- Secretos: FOOTBALL_DATA_TOKEN solo en GitHub Secrets y en .env local (ignorado). CONTACT_EMAIL es una variable de Actions (visible). Nada de valores en .env.example.
- tsconfig de la app declara types ["jest","node"]; ESLint con import/no-unresolved desactivado (TypeScript ya lo comprueba).
- Datos desconocidos = null. Escudos: solo por URL externa de la API (ADR 0006, riesgo asumido); no se guardan imágenes en el repo ni se usa el escudo del Depor como logo de la app.

## Pendiente
H4 plantilla, H5 inicio, H6 noticias, H7 club y legal, H8 pulido, H9 distribución. Decisiones abiertas: contactar al club, nombre definitivo, identificadores com.deporhub.app provisionales.
