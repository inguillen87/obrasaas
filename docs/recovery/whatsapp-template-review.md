# S11.A19 — Revisar el mensaje, solicitar y recuperar su plantilla

Base: `eaf219e77702bcc961bb18d0c23fc9d4e1828bbf`. Usa las plantillas operativas de Flows que ya existían en ObraSaaS; no agrega un catálogo masivo ni cambia el protocolo de Meta.

## Experiencia conectada
En Integraciones → configuración avanzada → formularios, «Ver mensaje y plantilla» abre el cuerpo y botón exactos de la versión publicada del formulario, empresa y obra, idioma, categoría y última sincronización. La consulta sólo se inicia al abrir/refrescar; no se crea una plantilla al abrir la pantalla. Consultar sincroniza el estado observado en la tabla existente, pero no envía mensajes ni crea otra versión en Meta.

Antes de solicitar aprobación se exige revisar y confirmar explícitamente esa definición (blueprint, nombre determinista y SHA-256). El servidor reconstruye la definición, valida contexto y permiso, comprueba salud del canal, adquiere el bloqueo existente y vuelve a comparar después de adquirirlo. Sólo entonces descifra y usa la credencial del proveedor. No acepta destinatarios, contenido libre ni otra obra en el cuerpo de la solicitud.

Se distinguen Sin solicitar, En revisión, Aprobada, Pausada, Rechazada, Deshabilitada, Eliminada y categoría distinta. Un estado desconocido o una categoría ausente no habilita envío. Si falla una actualización, el contenido anterior puede seguir visible, pero su estado no se anuncia como vigente ni ofrece continuar hacia la bandeja.

La plantilla aprobada de categoría operativa puede conducir a las conversaciones existentes. Esto no selecciona una persona ni envía un mensaje: la bandeja mantiene sus controles de destinatario, canal, contenido, versión y consentimiento. Aprobada no significa enviada, entregada, leída o acción de negocio completada.

## Recuperación sin duplicar
La identidad determinista de la plantilla y el reconciliador existentes permanecen. Una respuesta POST perdida bloquea otra creación en el panel y ofrece GET para consultar la misma versión. Sólo reconocer nombre y contenido exactos de una plantilla existente permite dar la solicitud por recuperada. Si sigue ausente, no se reenvía automáticamente ni se trata la ausencia como prueba de que no ocurrió una creación.

Cerrar y reabrir el diálogo dentro de la misma instancia conserva el intento incierto. No se agrega persistencia offline: cerrar la pestaña, cambiar de tenant/canal o desmontar el panel no constituye recuperación durable. Después debe reconciliarse con el catálogo del proveedor por el circuito existente; no se promete una cola de solicitudes de aprobación nueva.

Los rechazos previos al proveedor se identifican por código y HTTP exactos (revisión inválida/cambiada, bloqueo ocupado o conexión cambiada antes de adquirirlo). Obligan a consultar y consentir nuevamente; no se convierten en reintentos automáticos. Otros errores, incluso 409/422 no reconocidos, siguen siendo inciertos.

## Integridad y acceso
GET/POST del endpoint existente ahora requieren las cabeceras de empresa/obra coherentes con la sesión, sin parámetros de alcance por URL, y rechazan origen cruzado. Conservan integrations:manage, la barrera Clerk, salud Graph y el bloqueo/auditoría existentes. Respuestas y errores tienen private/no-store, Vary y nosniff. No hay una nueva ruta pública ni permisos ampliados.

La adopción de plantillas remotas exige exactamente el cuerpo esperado y un contenedor con un único botón Flow. Un encabezado, pie, segundo cuerpo o botón adicional impide adoptar silenciosamente otro mensaje. La categoría consultada se conserva, pero sólo APPROVED + UTILITY comunica elegibilidad para el circuito; el emisor ya revalida esa categoría por separado.

Los textos propuestos son los definidos por los blueprints existentes. En esta entrega no hay editor arbitrario, nuevas variables, campañas, borrado de plantillas, apelaciones automáticas, cambios de facturación o traslado de activos de otras apps. Los nombres/huellas son identidad de contenido, no una credencial ni firma de autorización.

## Verificación
`whatsapp-template-review.test.js` comprueba definición/estados/adopción y recuperación con un proveedor controlado. `whatsapp-template-review-route.test.js` ejecuta el código real de rutas con dependencias aisladas para verificar orden de acceso, comparación posterior al bloqueo, auditoría, saneamiento y cero contacto de proveedor en rechazos previos.

`verify-whatsapp-template-review-ui.mjs` monta el control React y los servicios reales con proveedor HTTP y base controlados. Revisa contenido, confirmación, cambios de estado/categoría, respuesta perdida y recuperación por GET, ausencia incierta sin duplicación, contexto ajeno, errores y 320/390/768/1280 píxeles. No contacta Meta ni envía mensajes reales. El despliegue, credenciales/plantillas de una cuenta real, aceptación autenticada y entrega física se acreditan por separado en el PR con SHA y entorno.

Sin migraciones ni dependencias. La copia Windows no se modifica mientras Desktop Commander permanezca desconectado. El pase a Production conserva sus controles de configuración, identidad/respaldo de base y autorización del release.
