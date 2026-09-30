# WhatsApp real con el número de prueba de Meta

Alcance: continuar con el Test Number que Meta asignó a ObraSaaS. No comprar, registrar ni migrar otro número para estos ensayos. La demo web `/demo` sigue siendo ilustrativa; no es la integración Cloud API.

Referencia histórica comprobada: cuenta Test WhatsApp Business Account, +1 555-153-3706, app ObraSaaS, plantilla hello_world/en_US. La auditoría del 17/09 informó 131030 para el teléfono del titular: el destinatario no estaba en la lista permitida. Esa observación no se presenta como resultado actual; el verificador debe comprobar los activos contra Meta con las credenciales del despliegue.

## Transporte sin confirmaciones simuladas
Los helpers de texto, plantilla, documento e interactivos comparten la misma conexión. Se retiraron los IDs sim_wamid/sandbox y los success true ante error de red, ausencia de token o rechazo Meta. Una aceptación exige HTTP correcto, messaging_product whatsapp y un único ID wamid válido. El resultado es ACCEPTED_BY_META, nunca delivered/read. La entrega debe acreditarse mediante callback firmado y recibo persistido; no se implementa ese cierre con una suposición.

131030 es META_TEST_RECIPIENT_NOT_ALLOWED, 190 es META_ACCESS_TOKEN_INVALID, y los errores de plantilla/ventana/permisos son estados distintos. Tiempo de espera, respuesta incompleta o fallo 5xx quedan UNCONFIRMED. No se reenvían automáticamente, no se cambia una lista por texto ni se genera otro identificador. No se presume que la API de envío tenga idempotencia durable por enviar una clave propia.

No se reescribe un teléfono por sus últimos dígitos; se conserva su destino internacional explícito. Las variantes de credenciales en conflicto y overrides de sender ajeno se rechazan. Los mensajes interactivos aceptan el objeto completo sin convertirlo en texto ni mutar al caller. El enlace directo a un archivo Blob privado se rechaza como documento: hace falta un circuito autorizado de media, no publicar el archivo.

## Despacho de prueba y recepción
El endpoint legacy de despacho conserva autorización de servicio y no está abierto a usuarios Clerk o visitantes. Sólo admite modo test, destinatarios locales explícitos y hello_world/texto/payload válidos. La lista local no reemplaza la verificación de destinatarios en Meta. Ya no consulta/escribe el agregado global para fabricar notificaciones con datos, personas, pólizas o asistencias de ejemplo.

La recepción conserva firma Meta, comprueba WABA y phone_number_id antes de tocar estado y rechaza ámbito ajeno. No acusa recibo de un lote procesando sólo el primer evento: la ruta legacy rechaza lotes para que su reemplazo durable los procese de forma completa. No se cambió el secreto de firma ni se activó un flujo operativo multi-tenant por configurar un número.

## Comprobación opt-in
`release:verify-meta-test` es pasivo por defecto. `OBRASAAS_RUN_META_TEST_CHECK=read-only-v1` sólo se admite en un build Production del proyecto ObraSaaS y dominio propio. Consulta metadata del número, pertenencia a WABA, suscripción de la app y plantilla. Se detiene si el número difiere del Test Number conocido. No imprime credenciales ni envía mensajes. Una suscripción no demuestra la salud del callback, un destinatario aprobado ni entrega física; esas condiciones se reportan por separado.

## Aceptación pendiente
Recuperar/verificar el destinatario demo en Meta y realizar una entrega real con wamid y callback. Confirmar después texto, imagen y audio real, revisiones y aislamiento de la obra piloto. El número propio queda para el final; no es el bloqueo de esta fase. La compra no resuelve un token inválido, destinatario fuera de lista o firma faltante.

Pruebas puras y CI se ejecutan antes de publicar; la evidencia efectiva de Meta y del dominio se registra en el PR. No hubo migraciones ni traslado de datos históricos en este bloque.

## Envío técnico explícito
El marcador `send-hello-world-once-v1` sólo permite un hello_world/en_US al `OBRASAAS_META_TEST_RECIPIENT` explícito y después de comprobar número, WABA, suscripción y plantilla. No prueba destinatarios alternativos ni reenvía tras un error. El reporte distingue aceptación API de entrega física. Este marcador es por despliegue, no una tarea recurrente; no dejarlo configurado como variable permanente.
