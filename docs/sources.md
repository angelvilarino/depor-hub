# Fuentes de datos (obligatorio antes de automatizar ingestas)
| Fuente | Aporta | Licencia / términos | Frecuencia | Estado |
|---|---|---|---|---|
| football-data.org (plan gratuito) | Clasificación, partidos, plantilla y entrenador (PD) | Pendiente de revisar términos de uso y atribución | Cron horario; escribe solo si cambia el contenido | Cobertura 2026-27 y campos de plantilla: ejecutar `probe` y anotar aquí el resultado |
| RSS de medios | Titular, fuente, fecha, enlace | Pendiente por medio | 30-60 min | Auditoría en H6 |
| `data/manual/club.yml` | Datos del club | Elaboración propia con fuente | Manual | H7 |

Reglas de ingesta aplicadas: User-Agent identificable con contacto (variable `CONTACT_EMAIL`), >= 6,5 s entre peticiones, reintentos con respeto a `Retry-After`, crudos en `data/raw/` (no versionados), sin saltarse restricciones de la API.

## Sondeo football-data.org — 20-oct-2026
- Plan gratuito con acceso a PD (LaLiga) 2026-27; **sin Copa del Rey (CDR)**.
- Depor: id 560, tla DEP. Plantilla 28 jugadores: posición, nacimiento y nacionalidad 28/28; **dorsal y contrato 0/28**.
- 38 partidos del Depor en la respuesta (9 terminados al ingerir), jornada actual 9. Fechas futuras pueden venir a las 00:00 UTC (hora sin confirmar).
