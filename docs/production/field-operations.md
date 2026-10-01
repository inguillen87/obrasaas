# Operaciones de campo canónicas

Este bloque integra el recorrido de campo en Mi cuenta → Mis obras. Utiliza la sesión JWT de Clerk ya verificada y la pertenencia canónica a empresa y obra. La ficha, la invitación aceptada, el permiso de campo y la revisión humana de identidad son requisitos separados; el teléfono no concede acceso.

## Persistencia y decisiones

No se crean motores ni tablas paralelos. `AttendanceEntry` conserva el diario de ingreso, pausa, retorno y salida en `metadata.fieldOperations`, con secuencia, referencia al evento anterior y jornada. `Incident` guarda los registros de evidencia privada. `OperationalProposal` guarda las propuestas de avance y cantidades. `AuditLog` contiene recibos vinculados a actor, empresa, obra, operación y contenido. `Task` es la tarea que consulta el cronograma existente.

Los contratos de transición de asistencia, geolocalización conservadora y decimal exacto proceden del corte enterprise `1677ff72773c95140535603093e5cb8624d1f063`. Las tablas enterprise posteriores (`AttendanceShift`, `ProgressEvidence`, mediciones con funciones PostgreSQL) no estaban desplegadas en el esquema inspeccionado: no se declara que esos módulos completos hayan sido migrados.

Los sectores se configuran en la obra, con centro, radio y QR privado ligado a obra, sector y versión de configuración. Una ubicación puntual requiere consentimiento indicado, precisión de hasta 100 m y antigüedad máxima de dos minutos. Distancia + precisión debe caber dentro del radio. Ubicación fuera del perímetro o ausencia de QR requieren revisión; el QR y el GPS no demuestran por sí solos identidad o presencia física. Las pausas no capturan ubicación.

Otra persona autorizada revisa fichajes y evidencia con fundamento. Administrador o director decide el avance; quien propuso no puede aprobarlo. La aprobación vuelve a comprobar la revisión de la tarea y la evidencia y cambia tarea + propuesta + recibo en una transacción. Rechazar no modifica el avance. El avance no elimina un bloqueo independiente de la tarea ni cambia sus fechas. Recuperar un recibo antiguo devuelve la tarea vigente, conservando por separado el resultado histórico de esa decisión.

Las propuestas vencen a los siete días. La consulta usa el reloj del servidor para mostrarlas vencidas y exponer su plazo, aunque todavía conserven `PENDING` en el registro. Una nueva propuesta válida cierra las anteriores vencidas de esa tarea con estado `EXPIRED` y auditoría dentro de la misma transacción; no modifica la tarea ni otros motores. Recuperar el recibo de una propuesta devuelve su estado vigente. Una propuesta vencida no admite aprobación.

## Archivos y procesamiento

Fotos JPEG/PNG/WebP: hasta 2 MiB. Audio OGG/WAV/MP3/MP4/WebM y video MP4/WebM: hasta 3 MiB, límite compatible con el cuerpo de las funciones de producción. Los contenedores se comprueban por firma; esto no equivale a decodificar, examinar malware o verificar autenticidad. Cada archivo se guarda en Blob privado y se relee comprobando tamaño, tipo y SHA-256. La descarga pasa por autorización de obra y persona; nunca se entrega un enlace público de Blob.

El procesamiento usa el adaptador real ya existente: foto y audio producen consejo/transcripción pendiente de revisión. Su inicio tiene estado durable y un plazo de recuperación; un fallo queda `FAILED_RETRYABLE`, conservando el archivo. Si falta proveedor o falla la respuesta, no se fabrica un resultado. El video queda `MANUAL_REVIEW_REQUIRED`: **el análisis automático de video no está implementado**. Ni procesamiento ni evidencia aprobada cambian automáticamente una tarea.

## Evidencia de validación

- Pruebas de políticas y HTTP: contratos negativos, precisión, ubicación antigua, MIME, límites, autorización y origen.
- PostgreSQL local desechable: empresas y personas ajenas, identidad pendiente, secuencia, concurrencia, idempotencia, lectura privada, integridad, decisiones, recuperación de respuesta perdida y rollback si falla el recibo.
- Navegador con componente real y API sintética: 320, 390, 768 y 1280 px; configuración, ubicación, QR, foto, procesamiento, revisión, propuestas/aprobación, errores y recuperación. Los proveedores y la ubicación de estos ensayos son sintéticos.

Estos resultados prueban implementación y contratos locales. Publicación y comprobación del dominio requieren evidencia del despliegue por SHA. La aceptación con trabajadores, teléfono, cámara QR, ubicación física, audio español de campo y WhatsApp sigue siendo un gate distinto.
