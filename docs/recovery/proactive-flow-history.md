# S11.A22 — Seguimiento persistido de formularios por conversación

Base: `72061e8f8004a677cd486d012732a537dd90b0bd`. Extiende el recorrido A21 sin modificar sus escrituras.

## Funcionalidad
Debajo del lanzador, «Consultar envíos anteriores» abre un seguimiento de los registros ya guardados en esta conversación. Funciona después de recargar o volver al chat, sin necesitar la clave de envío conservada en memoria por A21. No recupera borradores ni claves de idempotencia: consulta Message y su sesión correlacionada dentro de la obra autorizada.

Páginas de 20, orden descendente por fecha de registro e ID, navegación anterior/siguiente y actualización explícita. «Revisar pendientes» filtra sólo la página visible, sin presentarla como un indicador global. No hace polling ni peticiones al montar o por cambiar filtros. El cuerpo original queda en un detalle plegado; no se reconstruye con el texto de la plantilla actual.

Aceptación, envío, entrega, lectura y respuesta del formulario son hechos distintos. Una sesión consumida prueba únicamente que hay respuesta registrada; no acredita que el parte, fichaje o acción de negocio se haya aprobado. Enlace vencido sin consumo no demuestra falta de entrega. El estado failed por resolución manual con riesgo no se etiqueta como rechazo de Meta.

## Consulta y autorización
GET del endpoint existente de proactive-flows admite `mode=history` y un cursor acotado. Mantiene sesión, conversations:read, contexto explícito, origen y obra verificados. El permiso de lectura de la conversación permite consultar su historia compartida; no requiere ser autor del envío. La recuperación del recibo original de A21 conserva por separado su comprobación del actor y la clave.

Una transacción RepeatableRead lee conversación, hasta 21 mensajes y hasta 20 sesiones en lote. Usa los índices existentes de conversación/dirección/fecha/ID. No hay count global, offsets crecientes ni consulta por sesión en cada tarjeta. Cada cursor está vinculado a empresa/obra/conversación, pero no es una autorización; incluso una modificación del cursor conserva filtros y permisos del servidor. Las páginas no forman una instantánea eterna: actualizar vuelve a consultar la fuente y los registros pueden cambiar entre lecturas.

La sesión se filtra por empresa y obra antes de leerla y se contrasta con el externalId y blueprint del mensaje. Conflictos de referencias del proveedor o de sesión fallan de forma cerrada. Un mensaje accepted/sent/delivered/read sin referencia propia del proveedor se presenta como incierto. No se infiere entrega a partir de la sesión ni se reescribe la fila durante esta lectura.

La respuesta pública contiene identificador local, blueprint, cuerpo original, fecha de registro, estado observado, vínculo de sesión, fecha de respuesta y vencimiento cuando están verificados. Nunca devuelve tokens, claves de idempotencia, teléfono, WAMID, credenciales, actor ni metadata cruda. Respuestas y errores mantienen private/no-store, Vary y nosniff. No se necesita un token de envío vigente para leer la historia; sí permiso actual en la conversación.

## Red y límites
Una consulta fallida retira los registros visibles; no conserva una aprobación antigua como si hubiera terminado bien. Cerrar/cambiar chat descarta respuestas tardías. Fuera de línea se ocultan las observaciones y reconectar no genera envíos ni consultas automáticas. Cada página indica la hora de consulta; las fechas se muestran en la zona del dispositivo. No se declara operación offline, un mensaje fuera de la ventana de conservación ni recuperación de registros eliminados.

No se agrega ningún botón de reenviar, desbloquear, editar o borrar a esta vista. Su lectura no modifica Message, WhatsAppFlowSession ni AuditLog, no llama a Meta y no cambia la decisión del lanzador. La acción y confirmación de riesgo de A21 siguen siendo independientes.

## Pruebas y entrega
Los tests puros/de consulta cubren orden, paginación, cursores, datos ajenos, privacidad, referencias contradictorias, respuestas, vencimiento y sólo lectura. Los tests de la ruta mantienen permisos y rechazo de parámetros ambiguos. El navegador monta el componente, ruta y servicio reales con identidad/base controladas, comprueba recarga, filtros, paginación, fallos, contexto ajeno, red y respuestas tardías a 320/390/768/1280 px.

El verificador `verify-proactive-flow-history-postgres.mjs` requiere la conexión loopback de ensayo y base vacía del guard existente. Siembra registros sintéticos, consulta con Prisma/PostgreSQL, compara filas antes/después y nunca configura un proveedor. Se incorpora como cuarta suite aislada de execution-postgres, no reutiliza una base de producto. Su resultado y el CI autenticado/deployment se acreditan por SHA en el PR.

Sin nuevas dependencias, migraciones, endpoints públicos, cambios de roles o envío real. La autorización piloto y el pase a Production conservan controles separados.
