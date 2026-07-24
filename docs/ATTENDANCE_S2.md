# S2 - Turnos, expectativas y control de asistencia

## Estado verificable

S2 queda implementado en la rama `codex/platform-ux-foundation` con:

- schedules versionados de siete dias, zona horaria IANA, tolerancias, turnos nocturnos y DST fail-closed;
- expectativas inmutables por trabajador y fecha, con excepciones fechadas;
- clasificacion separada de presencia, puntualidad, ciclo de jornada y verificacion GPS;
- no-show, ausencia, tardanza y cierre pendiente derivados de una obligacion publicada;
- correcciones append-only con hash, doble control, CAS, expiracion y corte de secuencia del ledger;
- alertas durables, acknowledgement auditado y dashboard con permisos por rol;
- reporte semanal que incluye personas ausentes o justificadas aunque no tengan eventos fisicos.

La implementacion no inventa checkout, presencia ni identidad a partir de una foto. `PENDING_GEO`, `REVIEW_REQUIRED` y `PENDING_CLOSE` permanecen visibles como estados pendientes o anomalos.

## Contrato de datos

`AttendanceExpectationRevision` captura el schedule, dia, politica, zona y umbrales exactos usados para clasificar una fecha. La correccion aprobada no edita `AttendanceEntry`: guarda una secuencia efectiva canonica y `baseLedgerSequence`; los eventos fisicos posteriores se agregan una sola vez durante la proyeccion.

Las APIs S2 estan bajo `/api/attendance/*` y exigen autenticacion, organizacion, proyecto y permiso server-side. Finance/Auditor reciben lecturas sanitizadas; GPS, evidencia, fingerprints e idempotency keys no forman parte del DTO general.

## Rollout y gates

La migracion se verifico desde cero con PostgreSQL 17.5: S1 + S2, 48 migraciones, 48 checks, 37 FK, 41 indices y exclusion GiST. Los fixtures legacy sobrevivieron sin fabricar expectativas.

Antes de habilitarlo comercialmente aun deben cerrarse:

1. CI remota exactamente con PostgreSQL 17 y permiso para `CREATE EXTENSION btree_gist`;
2. E2E autenticado por rol, tenant y obra;
3. WABA/telefono real, red interrumpida y outbox de alertas;
4. base legal, consentimiento, retencion, exportacion y borrado de GPS/foto;
5. observabilidad de transiciones, backlog de cron, alertas y runbook.

La especificacion de la clienta pide foto de ingreso/salida. Esa capacidad queda explicitamente fuera del release hasta aprobar proporcionalidad, acceso, retencion y alternativa operativa. No se implementa biometria ni reconocimiento facial.

## Secuencia siguiente

S3 debe convertir tareas y WBS en fuente canonica para conectar asistencia, avance y costos. S15 debe entregar las alertas por outbox multicanal. S20 debe agregar offline con conflictos sobre estas APIs; no se debe construir offline sobre snapshots JSON.
