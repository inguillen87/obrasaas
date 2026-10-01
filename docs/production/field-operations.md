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

El formulario de campo permite tomar una foto o adjuntar un archivo. Una foto mayor a 2 MiB se prepara en el navegador como copia JPEG, con decodificación orientada, revisión visual y giro explícito. El archivo original no se sobrescribe y puede descargarse antes de cerrar el formulario. Se informa el tamaño original, el tamaño de la copia y la reducción real; una transparencia pasa a fondo blanco en esa copia. Elegir el archivo y guardar el formulario son decisiones separadas: preparar, grabar o revisar no inicia una carga automática.

La grabación solicita permisos sólo después de pulsar el botón correspondiente. El audio se limita a dos minutos; el video, a cuarenta segundos, solicitando resolución y bitrate reducidos. La duración usa reloj monotónico y el tamaño final se vuelve a comprobar contra 3 MiB. Un navegador sin grabación compatible conserva la opción de adjuntar un archivo. Cancelar, cerrar el componente o cambiar el contexto autorizado detiene las pistas de cámara y micrófono. La lectura QR también es cancelable y mantiene la alternativa de pegar el contenido.

La reproducción de imagen, audio y video obtiene bytes desde la descarga autorizada de la obra. Comprueba tipo y tamaño contra la versión consultada y crea una URL temporal local; cerrar la reproducción, cambiar la versión o cambiar obra/permisos revoca esa URL. No se presenta un enlace público de Blob. El formulario de revisión muestra el registro y la versión de la decisión.

Las incidencias y los pedidos de materiales del participante utilizan `REPORT_INCIDENT` y `REQUEST_MATERIAL`, con ficha propia, KYC, permiso de reporte, sector y tarea opcional. La evidencia vinculada pertenece a la misma ficha y tarea. Se guardan en el registro canónico de `Incident.metadata.siteRegister`; oficina y compras continúan sobre esa misma fila. Un pedido no autoriza gasto, cambia inventario ni acredita entrega física.

## Seguimiento por obra

El estado operativo agrega consultas SQL autorizadas de empresa y obra. La recepción `meta-customer-v1` y las respuestas `meta-customer-outbound-v1` se cuentan por separado: pendientes, procesamiento activo, plazos vencidos, errores recuperables y operaciones guardadas; envío desconocido, envío confirmado, entrega o lectura informada por el proveedor y rechazos. Una reserva de respuesta vencida o `SEND_UNKNOWN` no habilita un reenvío automático ni demuestra que el mensaje salió.

Los errores de prueba firmada se cuentan como revisión de autenticidad, separados de reintentos, usando la misma constante de códigos que el recuperador. El panel informa también evidencias pendientes, procesamiento en cola/en curso/fallido, videos por revisar y pedidos canónicos abiertos. Excluye archivos ya revisados de los pendientes de procesamiento. No devuelve secretos, contenido cifrado ni detalles privados del error del proveedor. Los recibos muestran nombres comprensibles para identidad del canal, actividad recibida, archivo privado y habilitación del canal; ninguna de estas métricas certifica aceptación humana.

## Evidencia de validación

- Pruebas de políticas y HTTP: contratos negativos, precisión, ubicación antigua, MIME, límites, autorización y origen.
- PostgreSQL local desechable: empresas y personas ajenas, identidad pendiente, secuencia, concurrencia, idempotencia, lectura privada, integridad, decisiones, recuperación de respuesta perdida y rollback si falla el recibo.
- Navegador con componente real y API sintética: 320, 390, 768 y 1280 px; configuración, ubicación, QR, foto, procesamiento, revisión, propuestas/aprobación, errores y recuperación. Los proveedores y la ubicación de estos ensayos son sintéticos.
- Captura con `MediaRecorder` real y cámara Y4M/micrófono generados: foto grande, conservación del original, giro, audio/video compatibles con el decodificador canónico, lectura privada y reproducción del archivo resultante. Permisos denegados o cancelados, cancelación durante grabación, desmontaje, cambio de contexto, duración con reloj controlado, límites y revocación de URLs temporales. Estos dispositivos y el reloj del ensayo son sintéticos.
- Seguimiento: PostgreSQL desechable verifica separación de namespaces, empresa/obra, leases vigentes/vencidos, cuarentena de autenticidad, respuesta sin confirmar y procesamiento privado. HTTP verifica identidad, origen, consultas duplicadas, escrituras y denegación sin secretos. Navegador real con API sintética verifica cuatro anchos, errores, reintento, valores ausentes honestos y limpieza del contexto.

Estos resultados prueban implementación y contratos locales. Publicación y comprobación del dominio requieren evidencia del despliegue por SHA. La aceptación con trabajadores, teléfono, cámara QR, ubicación física, audio español de campo y WhatsApp sigue siendo un gate distinto.
