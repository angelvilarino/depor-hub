# Estado del proyecto — 20-oct-2026
H0 (andamiaje), H1 (contratos + ingesta + Pages) y H2 (capa de datos con caché y modo sin conexión) HECHOS y verificados en iPhone. Siguiente: H3 (calendario).

## Datos reales (sondeo football-data.org, plan gratuito)
- Acceso a PD (LaLiga) 2026-27; sin Copa del Rey. Depor: id 560, tla DEP.
- Plantilla: posición, nacimiento y nacionalidad 28/28; dorsal y contrato 0/28 (plan H4: data/manual/squad_extras.yml).
- Estados de partido: TIMED = hora confirmada (p. ej. 2026-10-24T19:00Z); SCHEDULED = hora NO fijada, viene a las 00:00:00Z. H3: mostrar solo la fecha en SCHEDULED, hora en Europe/Madrid solo en TIMED. No inventar horas.
- URL de datos: https://angelvilarino.github.io/depor-hub/v1 (meta, standings, fixtures, squad). Contrato v1 en packages/schemas (Pydantic origen, Zod espejo).

## Reglas de trabajo que han evitado errores
- Node 22 (nvm use 22) y venv Python 3.12 (.venv). Aplicar zips con `unzip -o X.zip -d .`, NUNCA reemplazando carpetas en Finder. Commit antes y después de cada hito.
- Instalar dependencias de la app con `npm install -w apps/mobile <pkg>`; módulos nativos con `(cd apps/mobile && npx expo install <pkg>)`. Nunca `npx expo install -- -w ...`.
- Secretos: FOOTBALL_DATA_TOKEN solo en GitHub Secrets y en .env local (ignorado). CONTACT_EMAIL es una variable de Actions (visible). Nada de valores en .env.example.
- tsconfig de la app declara types ["jest","node"]; ESLint con import/no-unresolved desactivado (TypeScript ya lo comprueba).
- Datos desconocidos = null; no se publican escudos ni imágenes (decisión legal pendiente).

## Pendiente
H3 calendario (próximos, resultados, clasificación, recordatorios locales, .ics, calendario del sistema), H4 plantilla, H5 inicio, H6 noticias, H7 club y legal, H8 pulido, H9 distribución. Decisiones abiertas: contactar al club, nombre definitivo, identificadores com.deporhub.app provisionales.
