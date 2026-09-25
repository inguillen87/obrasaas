# S11.A28 — Aceptación autenticada del ingreso vinculado

Base funcional: `27e59cb03149df53367170865d255a3b7854612a` (A27). Esta entrega prueba el recorrido existente; no añade una interfaz, activa cuentas Meta o cambia el dominio de asistencia.

## Qué comprueba
El journey S9.2 incorpora cuatro pasos con sesiones reales Clerk Development, rutas reales y PostgreSQL local desechable. El administrador consulta dos formularios asociados al mismo ingreso pendiente anterior, distingue un formulario legacy sin vínculo, y recupera el panel desde la bandeja móvil después de recargar.

La preparación usa el dominio real `ensurePendingGeoAttendance` y comprueba que dos consumos reutilicen un único registro. Guarda los recibos mediante Prisma y el constructor de recibos de A27, dentro de una transacción de ensayo. No se hace una búsqueda por nombre, teléfono o proximidad temporal. Se compara el contenido persistido antes/después de las consultas: ingresos, jornadas, mensajes, sesiones y número de auditorías no deben cambiar.

Se rechazan el visitante anónimo, otra empresa, las cabeceras ajenas, el contexto ausente y selectores de entryId aportados por URL. El auditor tiene attendance:read pero no conversations:read: ese permiso aislado no alcanza. El test no modifica la matriz de roles para obtener un caso positivo.

Una sesión independiente del director puede leer; después de cerrarse pierde el acceso a la respuesta y al ingreso. La sesión del administrador conserva su acceso. No se cierran otras sesiones del mismo actor ni se alteran membresías del cliente.

## Límites del ensayo
La preparación crea tres sesiones y seis mensajes sintéticos, sin ninguna conexión de envío. Prueba dominio/Prisma y lectura autenticada, no la firma de un webhook real, el procesamiento completo de `applyWebhookMessageAtomically`, entrega física de Meta, una ubicación real o aprobación de horas. Las referencias del proveedor son artificiales y no se envían fuera del test.

Los datos de localización, teléfono y tokens no aparecen en los resultados. La validez real del canal y el piloto siguen pendientes de sus propios controles. La existencia de un recibo no transforma un pendiente en presencia confirmada.

## Operación y seguridad del fixture
`openAuthenticatedFlowAttendanceFixture` exige autorización S92 explícita, host loopback, nombre exacto de base, comprobación del socket/servidor, obra marcada synthetic y ausencia de canal de envío. Antes de abrir la base valida IDs exactos. Crea con Prisma en lugar de mantener INSERT que omitan timestamps @updatedAt. Una segunda preparación falla y debe dejar los datos originales intactos.

`verify-flow-attendance-acceptance-postgres.mjs` prepara una base vacía autorizada, comprueba lectura/reutilización y rollback por duplicados sin Clerk. Es un verificador auxiliar: sólo su resultado ejecutado acredita SQL. El journey real está cableado en S9.2 antes del historial que cierra la sesión de dirección.

No añade migraciones, dependencias, rutas, permisos o modificaciones del emisor. Publicación, resultados y límites se registran por SHA en PR #1.
