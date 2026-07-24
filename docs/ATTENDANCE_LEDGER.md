# Ledger de asistencia

## Alcance y autoridad

`AttendanceShift` y `AttendanceEntry` son la fuente canónica de la jornada. El bloque `ProjectSnapshot.attendance` queda únicamente como proyección transitoria para la pantalla operativa; las escrituras generales de estado no pueden modificarlo y el servidor conserva su valor al guardar o restablecer otros módulos.

La jornada implementada en S1 admite:

```text
sin jornada --CHECK_IN--> WORKING --BREAK_START--> ON_BREAK
                               ^                    |
                               |----BREAK_END-------|
                               |
                               +----CHECK_OUT------> CLOSED
```

Reglas invariantes:

- una sola jornada `OPEN` por persona y obra;
- exactamente un `CHECK_IN` y, como máximo, un `CHECK_OUT` por jornada;
- una pausa debe cerrarse antes de iniciar otra o registrar la salida;
- la hora efectiva es la del servidor; `sourceOccurredAt` sólo conserva una hora aportada por el canal cuando realmente existe;
- cada evento tiene origen, secuencia, clave idempotente y fingerprint del request;
- el replay exacto devuelve el resultado original; reutilizar una clave con otro payload falla;
- todos los vínculos persona/jornada/evento están acotados por `projectId`.

## Captura y privacidad

`CHECK_IN` y `CHECK_OUT` requieren una lectura GPS puntual con accuracy, `capturedAt`, radio de geocerca y versión exacta del aviso. `BREAK_START` y `BREAK_END` no solicitan ubicación. El servidor exige que la captura v2 sea posterior a la emisión del enlace y tenga como máximo dos minutos de antigüedad, con una tolerancia acotada de reloj; `occurredAt` sigue siendo siempre la hora autoritativa del servidor y `sourceOccurredAt` conserva la hora de evidencia del dispositivo. La distancia y el resultado `VERIFIED`/`REVIEW_REQUIRED` se calculan en servidor. El criterio es conservador: sólo se verifica cuando `distancia + accuracy <= radio`; una lectura geométricamente cercana pero incierta queda para revisión.

El navegador no activa tracking. Para resolver una respuesta de red ambigua mantiene el payload exacto en `sessionStorage` durante un máximo de diez minutos; lo elimina al confirmar, ante un rechazo explícito, al vencer o al salir de la pantalla. Un doble toque no inicia dos capturas concurrentes.

Un `CHECK_IN` que no completa GPS vence por reloj a las dos horas. El recovery cron procesa primero un batch acotado, cambia el evento a `EXPIRED` y reconcilia la proyección `GPS pendiente` en la misma transacción con lock por obra y CAS. Si existía una jornada cerrada anterior, reconstruye la vista desde sus eventos canónicos; no conserva un overlay pendiente ni hereda sus campos. Un intento tardío ejecuta ese mismo preflight fuera de la transacción que devuelve `NO_PENDING_CHECK_IN`, por lo que el vencimiento no se revierte junto con el error.

Las coordenadas exactas permanecen en el ledger y en la proyección restringida. La vista general las elimina por defecto; sólo un rol con `org:field:evidence:read` puede recibirlas. Reportes, Supervisor IA y roles Finance/Auditor no reciben coordenadas ni evidencia del fichaje.

La foto solicitada por la especificación original no se activa hasta resolver base legal, proporcionalidad, retención, acceso y alternativa operativa. No se implementa biometría ni reconocimiento facial.

## Canales y consumidores

- WhatsApp inicia el ingreso y emite enlaces firmados por acción. Las pausas se registran con texto; ingreso y salida finalizan en el webview seguro por requerir GPS.
- El webview firma y valida la acción, el worker y la obra; no acepta cambiar `CHECK_IN` por otra transición usando el mismo enlace.
- Cada enlace v2 queda ligado además al agregado exacto que puede mutar: `CHECK_IN` al `pendingEntryId`; pausa/salida al `shiftId` y su `revision`. Un enlace emitido antes de una transición devuelve `ATTENDANCE_LINK_STALE` y nunca actúa sobre una jornada posterior.
- El bridge de despliegue para enlaces v1 sólo admite `CHECK_IN`, conserva la identidad histórica de replay y vence de forma absoluta el 31/08/2026 a las 03:00 UTC. V2 mantiene consentimiento, frescura de evidencia e idempotencia estrictos por acción. La verificación de frescura ocurre después de buscar el resultado auditado, de modo que un retry byte-a-byte de una respuesta perdida sigue devolviendo el resultado original sin duplicar la operación.
- La bitácora muestra el tipo y la verificación reales. Filas históricas `EXCUSED`, `ABSENT` o `LEGACY` sin jornada nunca se presentan como ingresos exitosos.
- El reporte semanal selecciona jornadas por `AttendanceShift.workDate` en la zona horaria del tenant y pagina el recorrido completo sin un corte artificial para el plan Enterprise. Las horas se renderizan con la zona histórica guardada en cada jornada.
- Hasta S2, ausencias/licencias heredadas de `attendance` o `hrAttendance` se muestran como excepción sin fecha canónica. Un evento canónico del mismo worker tiene precedencia.

## Migración y rollout

La migración se divide en cuatro fases funcionales y veinte pasos autocommit-safe para evitar mantener un lock pesado durante todo el backfill:

1. enum `AttendanceStatus.EXPIRED` aislado;
2. expansión de tipos, tabla, columnas, índices esenciales y bridge compatible;
3. backfill conservador de filas legacy;
4. constraints, validación e índices finales.

El backfill no inventa checkout ni hora del dispositivo. `sourceOccurredAt` queda `NULL` para datos históricos y `ABSENT` permanece `LEGACY` porque el modelo anterior no permite distinguir ausencia laboral de timeout técnico. Las entradas históricas aceptadas se vinculan a una jornada `LEGACY_INCOMPLETE`; una escritura aceptada por un binario viejo durante el rollout crea una jornada `OPEN`, por lo que también participa de la unicidad activa.

La emisión nueva usa tokens v2 y el parser nuevo acepta temporalmente v1; esa compatibilidad es deliberadamente unidireccional. Por eso el release exige promoción atómica del deployment inmutable y drenaje de requests anteriores: no se permite balancear pods v1 y v2 simultáneamente. Si otra infraestructura no puede garantizar ese corte, debe usarse un rollout en dos releases (primero parser v2 manteniendo emisión v1; luego emisión v2) y no este procedimiento.

El job de CI debe:

1. aplicar el historial anterior a S1 en PostgreSQL 17;
2. sembrar fixtures legacy representativos;
3. aplicar los veinte pasos agrupados en las cuatro fases;
4. ejecutar el verificador estructural y semántico;
5. comprobar `migrate status` y diff sin drift.

El smoke de despliegue debe confirmar además que un request iniciado antes de promover termina en el deployment viejo y que todo request nuevo llega al alias v2; un canary mixto invalida este rollout.

### Rollback operativo

No se eliminan enums, columnas ni eventos durante un incidente. El rollback seguro consiste en apagar el journey nuevo, volver al binario compatible, conservar el esquema expandido y reconciliar operaciones antes de reanudar. El bridge de compatibilidad sólo se retira en una migración posterior, cuando no existan binarios viejos y se haya ejecutado su smoke mixto.

Antes de `migrate deploy`, la conexión operativa debe imponer `lock_timeout = 5s` y un `statement_timeout` compatible con la ventana aprobada, y esos valores deben comprobarse con `SHOW` en staging. Un timeout aborta la promoción; no se eleva indefinidamente para forzar un `ALTER TABLE` sobre tráfico activo.

Recuperación de una migración no transaccional:

1. mantener el binario anterior y bloquear la promoción;
2. conservar el log de `_prisma_migrations` e inspeccionar constraints, triggers e `indisvalid`/`indisready` en `pg_index`;
3. si falló un paso que sólo crea un índice concurrente, eliminar exclusivamente el índice inválido con `DROP INDEX CONCURRENTLY`, marcar esa migración `--rolled-back` y reintentar;
4. si falló expand o contract después de efectos parciales, no ejecutar `resolve` ni borrar columnas a ciegas: preparar SQL de reparación revisado contra el estado real, completar el contrato y recién entonces marcar `--applied`; restaurar es la alternativa si la reparación no puede probarse;
5. si el `CALL` de backfill se interrumpió, sus batches confirmados se conservan: verificar invariantes, marcar el paso fallido `--rolled-back` y reejecutar el procedimiento idempotente;
6. volver a ejecutar verificador, `migrate status`, diff sin drift y smoke old-shape/new-shape antes de promover.

## Gates todavía abiertos

S1 no habilita por sí solo un release laboral comercial. Permanecen abiertos:

- ejecución verde del job PostgreSQL 17 en CI remota;
- prueba con WABA/teléfono real y respuesta de red interrumpida;
- política legal de GPS/foto, retención, exportación y borrado;
- corrección de eventos mediante aprobación append-only;
- turnos, tolerancias, tardanza, no-show y excepciones fechadas de S2;
- observabilidad, métricas de transición y runbook de incidente productivo.
