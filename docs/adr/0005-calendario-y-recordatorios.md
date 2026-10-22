# ADR 0005 — Calendario, recordatorios locales y exportación (H3)
- **Hora:** SCHEDULED = hora no fijada (00:00Z de la API): solo fecha (leída en UTC) y «Hora por confirmar». Resto de estados: hora real en Europe/Madrid. Nunca se inventa hora.
- **Recordatorios:** opt-in por partido (el permiso se pide al pulsar «Recordarme»). Solo TIMED futuros, 24 h y 1 h antes. `ReminderSync` cancela las notificaciones propias y replanifica (`plan.ts`, pura y testeada) al cambiar datos o ajustes; cubre cambios de hora y aplazamientos.
- **Añadir al calendario:** `createEventInCalendarAsync` (editor del sistema, sin permiso). Descartado: escribir en un calendario concreto (exige permisos).
- **.ics:** generado en el dispositivo, escrito en caché y compartido con la hoja del sistema. Aplazados/suspendidos/cancelados excluidos; SCHEDULED = día completo.
- **Fuera de H3:** árbitro y sede de partidos fuera de casa (no están en el contrato); alineaciones/eventos («Próximamente»).
