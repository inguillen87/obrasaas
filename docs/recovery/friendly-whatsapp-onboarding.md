# Alta de WhatsApp para clientes y separación del piloto

## Decisión de producto
El cliente de ObraSaaS no debe copiar tokens, identificadores WABA, claves de aplicación ni callbacks. El recorrido usa el Embedded Signup ya presente: Conectar WhatsApp → proteger el número → autorizar la cuenta y el número en Meta → validar y guardar en el backend → comprobar recepción y respuesta. Meta puede exigir verificaciones de identidad o número; un botón no elimina esos requisitos.

La protección de seis dígitos conserva el contrato del registrador existente. No se genera un PIN nuevo oculto ni se cambia automáticamente el de un número conectado. Las credenciales del proveedor no se guardan en localStorage ni se muestran al cliente. No se reescribe el intercambio de código ni se afirma aquí un nuevo alta real de una empresa comercial en Meta.

Referencias públicas de Meta consultadas: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview y https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider . Las páginas devolvieron limitación de lectura 429 al expandirlas; la disponibilidad de Embedded Signup con botón y onboarding de Tech Providers se comprobó en los resultados indexados oficiales. No se anuncia una homologación comercial de esta aplicación a partir de esa documentación.

## Cambios implementados
Se incorpora una entrada guiada con una acción principal, contexto de empresa/obra y tres etapas. Los identificadores y métricas técnicas quedan en un detalle plegado. Preflight, alta del piloto e importación manual están detrás de Administración técnica y siguen restringidos a superadmin; no constituyen el onboarding de los clientes. Flows y plantillas se consultan sólo al abrir su sección avanzada, no por entrar a Integraciones.

La administración interna no puede vincular números como si fuera una empresa cliente. Se distingue explícitamente del destino piloto que figura en el importador. Las conexiones piloto ya guardadas se resumen desde el catálogo autorizado, mostrando empresa, obra, número, mensajes entrantes, mensajes pendientes de participante y envíos registrados por este backend. La lectura está acotada y no expone tokens, IDs de Meta, cuerpos de mensajes o nombres de remitentes.

Los envíos externos desde la consola de Meta no cuentan como respuestas emitidas por ObraSaaS. Un estado de entrega sin correlación propia no se usa para atribuir una respuesta al asistente. Un remitente no vinculado no recibe permisos operativos por haber escrito al número.

## Seguridad del recorrido de autorización
Los handlers de alta, lectura y desactivación comparan la empresa/obra de la pantalla con la sesión antes de acceder a la conexión o contactar al proveedor. Las mutaciones rechazan origen cruzado; la creación se bloquea desde la organización interna. No se elimina la autorización original ni el cifrado, las restricciones de número único o las protecciones de concurrencia existentes.

La respuesta del alta debe confirmar el contexto solicitado y una conexión vinculada antes de mostrar éxito. La instancia del cliente se reinicia por empresa/obra/revisión de la conexión. Los eventos del SDK sólo se atienden durante un intento iniciado, desde los orígenes Meta permitidos y con IDs válidos; se descartan callbacks fuera de su generación y eventos posteriores a cancelar. Esto no es una certificación exhaustiva del protocolo ni reemplaza sus validaciones de servidor.

## Arquitectura comercial recomendada — no toda implementada
Número corporativo ObraSaaS: ventas, demostraciones, soporte y seguimiento de la suscripción. No usarlo como buzón indistinto de partes privados de todas las constructoras.
Cada empresa operadora: su cuenta/número autorizado por Embedded Signup. Técnicos y operarios participan en esa empresa mediante roles y asignaciones, sin convertirse automáticamente en empleados ni administradores por WhatsApp.
Multiobra: la implementación actual conserva la relación de una conexión con una obra. Antes de comercializar un número de empresa que reciba partes de varias obras, incorporar una relación de canal a destinos autorizados y una selección explícita de obra, sin inferir el tenant sólo por el teléfono del remitente. No se implementó esa migración en esta entrega.
Un asistente compartido de marca ObraSaaS puede evaluarse como modalidad adicional, con consentimiento y contexto explícito por participante/empresa/obra; no es el valor predeterminado ni equivale al número comercial.
