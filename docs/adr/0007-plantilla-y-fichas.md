# ADR 0007 — Plantilla, fichas de jugador y datos manuales (H4)
- **Estado:** aceptada.
- **Pantallas:** pestaña Equipo (entrenador + jugadores agrupados Porteros/Defensas/Centrocampistas/Delanteros) y ficha `app/player/[id].tsx`. `SectionList` (28 jugadores); FlashList se evalúa en H8 si hace falta.
- **Agrupación:** `features/squad/logic.ts` (pura y testeada) mapea las posiciones de football-data.org (`Goalkeeper/Defence/Midfield/Offence`) y tolera posiciones finas. Orden: con dorsal primero; si no, por nombre.
- **Foto:** nunca fotos con derechos. Avatar generado (iniciales + color estable por id, contraste AA con texto blanco, comprobado en test). El contrato no tiene `photoUrl`.

> **Nota (posterior):** el ADR 0009 sustituye esta decisión: se añaden fotos enlazadas con licencia y atribución, con el avatar generado como respaldo. El avatar sigue existiendo para jugadores sin foto o si la imagen falla.
- **Edad:** calculada en el dispositivo desde `dateOfBirth` (UTC), nunca guardada.
- **Datos que la API gratuita no da (dorsal 0/28, contrato 0/28, altura):** fichero manual `data/manual/squad_extras.yml` por id de jugador, **con `source` obligatoria**; `depor_hub/extras.py` lo valida y solo rellena huecos (el dato de la API manda). Está vacío: no se inventa nada. Mientras falte, la ficha lo muestra en el bloque «Datos pendientes».
- **Contrato (aditivo, sigue en /v1/):** `Player.heightCm` (`null` por defecto). Pydantic origen; Zod con `default(null)` para JSON o caché anteriores. No hace falta subir `buster`.
- **Nacionalidades:** la API da nombres en inglés; `country.*` en i18n (ES/EN) con fallback al texto original.
- **Fuera de H4:** estadísticas por jugador, trayectoria, valor de mercado, redes (fases posteriores).
