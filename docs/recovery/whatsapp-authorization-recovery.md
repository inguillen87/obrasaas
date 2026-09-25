# Sprint 11: autorización vencida y recuperación antes de enviar

## Falla que se cierra
El piloto podía mostrar una conexión guardada como CONNECTED y habilitar una respuesta según la ventana de atención, aunque la autorización temporal ya hubiese vencido. El envío canónico la rechazaba correctamente, pero con un mensaje genérico que no indicaba cómo resolverlo.

La consulta del piloto ahora combina la ventana de atención con una proyección de las verificaciones guardadas del canal. Presenta el vencimiento conocido y un diagnóstico específico antes de habilitar el consentimiento. Distingue autorización vencida o rechazada, configuración de plataforma pendiente y verificaciones de cuenta o webhook faltantes. Un estado CONNECTED almacenado no equivale a credencial vigente.

## Implementación
`src/lib/whatsapp/channel-recovery.js` produce una descripción pública sin token, material cifrado, claves de aplicación o payloads del proveedor. Es una lectura de estado previamente verificado, no una consulta nueva a Meta ni una autorización para cambiar permisos. La información devuelta identifica expresamente esa base y mantiene providerVerifiedByThisRead=false.

El envío manual existente conserva sus comprobaciones originales: permiso, plan, obra, conexión, credencial cifrada, salud y ventana de atención. Cuando falla la salud, utiliza un código específico para una credencial vencida o inválida y una explicación de recuperación. No se eliminan guardas ni se cambia el circuito idempotente del envío.

La lectura del piloto mantiene la comprobación de membresía local/remota y el activo permitido. Puede mostrar que hubo un mensaje recibido y, al mismo tiempo, que no está habilitado un envío. No confunde una ventana de atención cerrada con una credencial vencida ni envía plantillas automáticamente.

## Interacción
El panel muestra un aviso diferenciado y acceso a la configuración del mismo piloto. Renovar no implica crear otra empresa, obra o número. Las herramientas siguen reservadas a administración de plataforma en Preview; no se exponen campos de token al cliente comercial.

Después de una consulta fallida se retiran la habilitación y el consentimiento anteriores. Una respuesta incompleta no habilita el envío. Cuando se dispone de una fecha de expiración, la interfaz limita la habilitación conforme al tiempo transcurrido; el servidor vuelve a comprobarla al escribir. La hora del navegador nunca amplía una autorización denegada por el servidor.

Ante respuesta incierta del envío se conserva la solicitud. Verificar el mismo intento sigue disponible para recuperar el resultado idempotente, sin generar otra operación. Una renovación seguida de nueva consulta exige un consentimiento nuevo. No se reenvía un mensaje por cambiar de estado el canal.

## Validación y alcance
Pruebas específicas cubren el límite de vencimiento, credencial inválida, datos desconocidos, ventana de atención, privacidad de la proyección y renovación sin cambiar destino. Se amplía el verificador existente de navegador con el componente real, HTTP controlado y cero servicios externos: consulta sin envío, rechazo de consentimiento con token vencido, conservación de la solicitud incierta y renovación con consentimiento explícito.

Las pruebas de renovación usan una configuración sintética renovada: no equivalen a haber obtenido una credencial real de Meta. Este cambio no renueva secretos, no manda mensajes, no añade participantes, no completa la integración de audios ni migra producción. El estado del despliegue y la comprobación autenticada se registran en el PR con el SHA exacto.

Referencias oficiales revisadas: guía de tokens de WhatsApp Business Platform y Get Started de Meta. Meta diferencia tokens temporales de pruebas e incorporación de clientes por Embedded Signup; este cambio no promete renovación automática ni permanencia por la ausencia de una fecha de expiración.
https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens
https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
