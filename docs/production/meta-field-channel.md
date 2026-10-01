# Canal de campo integrado y recuperación

La extensión parte de master `157d74f1383c84fc288c94c3f00c75a0124af323`, que conserva el alta de empresa y los módulos de obra de `2e6edee85726231b25cb845b7884bd100741ef5f`. Reutiliza las operaciones y tablas canónicas; el transporte de Meta no crea cuentas Clerk, otro fichador ni otro registro de materiales.

## Autoridad y circuito

El participante solicita desde su sesión un código efímero propio. Un evento del callback firmado, persistido y cifrado consume el código desde el teléfono exacto de su ficha. El vínculo requiere participación, pertenencias y revisión humana KYC vigentes. La baja o una nueva presentación KYC revocan el vínculo; restaurar la ficha requiere otra prueba del canal. Los activos demo están excluidos.

Después de guardar el inbox, el callback confirma recepción y programa `after`. El procesador reserva un lease y compone `resolveWorkerChannelIdentity` con `createFieldOperations`/`createFieldMedia`. Adquiere los bloqueos de identidad antes de los de obra, ficha, conexión y evento. Los permisos se comprueban de nuevo dentro de cada transacción; ningún caller puede suministrar una identidad, rol o sesión ficticia.

El menú ofrece entrada, pausa, regreso, salida, tareas, evidencia, incidencia, materiales, avance y consulta. Los pasos se conservan cifrados con AAD de empresa, obra y recurso. Las opciones llevan un identificador del paso; una opción vencida o un mensaje anterior no modifica el borrador actual. Las operaciones de negocio requieren una elección explícita y se guardan mediante las mismas funciones de la web. El canal no permite aprobar avances, revisar KYC ni autorizar compras.

La ubicación de WhatsApp no aporta precisión GPS ni lectura de QR. Se conserva `accuracyMeters: null` y el fichaje requiere revisión humana. La web captura precisión y QR con sus controles existentes. Ninguno de los dos transportes certifica presencia física por sí mismo.

El proveedor resuelve el Media ID mediante Graph con el token del cliente y su Phone Number ID. Sólo descarga desde el host y ruta autorizados, con límites, firma de formato y hash. Las fases privadas vuelven a comprobar identidad, tarea y sector después de la entrada/salida del proveedor. Una modificación durante la carga no crea evidencia huérfana. La preparación cifrada y las operaciones derivadas del Event ID permiten recuperar una respuesta perdida sin duplicar archivos ni registros, y conservan los borradores posteriores.

Foto/audio usan el procesador privado existente; un fallo conserva el archivo y queda recuperable. Video admite captura, almacenamiento, reproducción y revisión humana; no incorpora análisis automático. Las propuestas de cantidades/avance requieren evidencia aprobada y mantienen la tarea sin cambios hasta la decisión autorizada de otra persona desde la web.

## Respuestas y recuperación

Antes de enviar se guarda una única reserva cifrada, vinculada al evento, trabajador, empresa y canal. El envío usa exclusivamente la credencial de ese cliente, dentro de la ventana vigente. Una respuesta incierta no se retransmite automáticamente: los callbacks correlacionados con `biz_opaque_callback_data` permiten observar envío, entrega y lectura. Estos estados no acreditan aceptación humana.

`/api/meta/customer-process` sólo permite GET con `CRON_SECRET` y POST con HMAC sobre propósito, timestamp y bytes exactos, incluyendo una lista explícita de eventos. Hay límite de trabajos y presupuesto por ejecución. El cron de Vercel despierta el recuperador; las pruebas de autenticidad irreparables quedan en revisión y no se reintentan indefinidamente. La UI autorizada permite procesar el mismo inbox y consultar resultados durables.

La activación requiere confirmación explícita del ADMIN, perfil dedicado vigente y comprobaciones frescas de registro, suscripción de la app, expiración y tres permisos Meta. Desactivar bloquea nuevas operaciones. Una conexión vinculada o una variable de configuración no equivalen a una prueba de entrega.

## Validación y límites de publicación

Las suites de identidad, pipeline y bridge ejecutan PostgreSQL desechable con callback HMAC real, cifrado/AAD, concurrencia, rollback, respuestas perdidas, leases, revocación y separación de empresas. El bridge prueba los registros canónicos y la aprobación web que actualiza una tarea; las llamadas a Meta, Blob y análisis son proveedores controlados. Las suites de navegador usan los componentes reales, dispositivos sintéticos y cuatro tamaños de pantalla.

La publicación requiere CI, despliegue y comprobación del mismo SHA en el dominio. La aceptación requiere usuarios, entrega de invitación, archivos y dispositivos reales, además del número nuevo y sus mensajes reales. El App Secret actual, verificación dedicada del callback, autorización efectiva de Embedded Signup y claves de recuperación deben estar configurados antes de activar Meta. Este corte no cambia ni regenera tokens, app, WABA o Test Number existentes, y no modifica MuniControl.
