# S11.A15 — Continuidad entre creación y reprogramación

Base: `342555bfcbfa9b56677e53ff70f84a0277cb42ce`. Fecha: 22/09/2026 (Argentina).

## Dos regresiones reproducidas antes de corregir

Una creación cuya respuesta se perdió no podía confirmarse desde el planificador si otra sesión había reprogramado sus fechas. El recibo idempotente del servidor encontraba el registro correcto, pero el cliente seguía exigiendo las fechas originales como si fueran inmutables.

Además, reprogramar podía dejar dos asignaciones pendientes/en curso con idéntica actividad, responsable y período. El creador rechazaba esa duplicación exacta; la reprogramación sólo la mostraba como una coincidencia coordinable. Las dos pruebas de regresión fallaron sobre la base indicada, antes de aplicar la corrección.

## Recibo de creación y estado vigente

El servidor mantiene la clave determinista y su recibo de auditoría existentes. Antes de recuperar un intento comprueba el fingerprint completo (incluida la revisión aceptada), empresa, obra, actor, origen del planificador y metadatos de tarea/responsable. También verifica que la identidad actual no haya cambiado y que las fechas no hayan sido alteradas sin incrementar la revisión.

La respuesta añade `creationReceipt`, schemaVersion 1, con el ID de asignación y el plan de creación aceptado. Los recibos históricos se reconstruyen únicamente después de verificar el fingerprint del mismo cuerpo normalizado: no se inventan fechas desde el estado mutable actual. No se requiere migración ni reescritura de auditorías anteriores.

El cliente sólo acepta un período actual distinto cuando es un replay, hay revisión posterior y coincide todo el recibo de creación. Un recibo presente pero incompleto/ajeno se rechaza. Las respuestas anteriores sin este campo mantienen compatibilidad únicamente cuando el período coincide exactamente.

El recibo es un contrato de respuesta, no una firma digital, un token de acceso ni una sustitución de los permisos. `assignment` sigue siendo el estado vigente: recuperar no restaura fechas, reabre estados o crea otro registro. El tablero distingue creación nueva, recuperación y recuperación con fechas cambiadas posteriormente.

## Duplicación exacta versus coordinación

`assertAssignmentPeriodUnique` comparte la misma consulta entre creación y reprogramación. Se compara obra, actividad, persona/cuadrilla, inicio y fin exactos, sólo en estados PLANNED/ACTIVE. Dos períodos sin fechas también pueden ser duplicados. ENDED/CANCELLED se conservan como historia y no impiden una nueva intención explícita.

La reprogramación excluye exclusivamente el ID leído por el servidor en la obra autorizada. La revisión previa comprueba duplicados y la escritura repite el control bajo el bloqueo transaccional de proyecto. Dos asignaciones diferentes, o una creación y una reprogramación concurrentes, no pueden ganar el mismo período exacto por estos circuitos.

Una coincidencia parcial o en otra actividad continúa siendo una advertencia que puede coordinarse con motivo explícito. No es un cálculo de horas ni de disponibilidad laboral. La regla no es un índice SQL global: la API genérica legacy y escrituras externas conservan sus contratos; no se promete unicidad frente a caminos que no usan este servicio.

El rechazo `ASSIGNMENT_DUPLICATE` ocurre antes de la escritura. El diálogo conserva fechas y motivo, retira revisión/confirmación y permite corregir directamente. Un error de red desconocido sigue requiriendo consulta del estado; no se trata todo 409 como una respuesta guardada ni se reenvía automáticamente un PATCH incierto.

## Pruebas y publicación

`tests/assignment-lifecycle-continuity.test.js` cubre ambas regresiones, recibos alterados, estados posteriores, compatibilidad histórica, identidad, períodos nulos, cuadrillas, otra obra y rechazo sin escritura. Usa los servicios reales con una base controlada, no un proveedor de identidad.

`verify-assignment-continuity-ui.mjs` monta Board, Planner, Card y RescheduleDialog reales con HTTP y servicios de dominio. Simula la pérdida de respuesta después de crear y reprogramar; comprueba recuperación del mismo intento, período vigente, duplicados en revisión y guardado, conservación del motivo y coordinación de una coincidencia parcial. Revisa 320/390/768/1280 px. La identidad y la base son controladas; no acredita Clerk.

`verify-assignment-continuity-postgres.mjs` exige la base loopback desechable nombrada por `executionTestConnection`. No carga archivos de entorno ni usa conexiones alternativas. Comprueba recibos, aislamiento, rollback y carreras entre conexiones reales de PostgreSQL 17. El workflow de ejecución añade esta suite en una instancia de servicio separada y conserva evidencia distinta por suite; no usa credenciales productivas.

Los números de pruebas, resultados SQL/navegador y SHA/deployment se registran en el PR después de ejecutar cada comprobación. El build y las pruebas controladas no autorizan Production. La sesión real, configuración efectiva, respaldo/identidad de base y prueba física del canal mantienen sus controles independientes.

Sin nuevas dependencias, migraciones, notificaciones o personas reales. No se modifica Task, Gantt, avance, asistencia, salarios, activos de Meta ni configuración productiva.
