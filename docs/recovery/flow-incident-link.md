# S11.A29 — De la respuesta a su incidencia operativa

Base: `6f77f652e1a03de549c602c6bdb1945655b8cde6`. Conserva A25–A28 y no modifica el emisor de WhatsApp.

## Registro existente, no duplicación de dominio
El motor de incident-report ya escribe incidencias dentro de `ProjectSnapshot.state.incidents`. Esta entrega no usa la tabla Incident como si esas filas existieran allí ni crea una copia de ellas. Al procesar una respuesta autorizada, conserva un recibo mínimo con el ID determinista exacto del incidente, proyecto, trabajador y sesión en el mensaje entrante.

El algoritmo del ID existente no cambia. Un helper comparte su derivación para comparar la referencia, pero esa identidad no es una firma o permiso. La recepción durable existente guarda estado y mensajes dentro de su transacción; el cambio añade el recibo a los metadatos del mensaje. No se cambia el dispatcher ni se añade una llamada a Meta.

## Consulta de mínima exposición
Bandeja → Seguimiento → Respuesta vinculada → Consultar incidencia vinculada. GET mode=incident requiere conversations:read y projects:read antes de tocar la base, además del contexto y origen coherentes. La opción depende del permiso real y del tipo de Flow confirmado por el servidor. No recibe incidentId, workerId ni texto de búsqueda como selector.

La lectura repite la cadena exacta envío/sesión/mensaje de A25 y comprueba recibo, ID derivado del evento y clase de registro en el snapshot de esa obra. Sólo devuelve ID, severidad, estado explícito, versión y fecha del estado general de obra. No expone descripción, título libre, informante, área, teléfonos, coordenadas, adjuntos, tokens o datos de otras incidencias.

La fecha de snapshot NO es fecha de resolución de la incidencia. Cuando el registro no tiene status, muestra «Sin estado de resolución registrado»: no inventa abierto/cerrado. Un estado ajeno al contrato, duplicados de ID, snapshot inválido o registro perdido no producen una confirmación. Una respuesta legacy sin recibo queda sin vínculo, aunque haya un registro similar; no hay backfill.

Consultar no resuelve incidentes, aprueba partes, cambia tareas, cantidades, nómina o auditorías. El enlace al tablero abre la sección general; el registro exacto se muestra dentro del panel, no se promete un filtro por incidente en destino.

## Recuperación y uso móvil
Apertura y actualización explícitas. Una actualización retira el resultado anterior mientras consulta. Los errores de permisos bloquean reintentos en la misma instancia. Cerrar, cambiar conversación o pasar offline descartan respuestas tardías; volver online no inicia otra consulta ni restaura información anterior como vigente. No hay polling ni consultas por render.

## Verificación prevista y evidencia
Los resultados por SHA y entorno se registran en PR #1 después de ejecutar. Pruebas de política, lector, ruta y motor cubren identidad y privacidad. El navegador monta componentes/ruta/servicios reales con identidad/HTTP/base controlados y doce escenarios a 320/390/768/1280 px. El verificador SQL utiliza PostgreSQL desechable, el motor real y persistencia transaccional del fixture; no llama al proveedor.

El journey de S9.2 incluye origen/legacy, permisos/aislamiento y recuperación móvil con sesión real de Clerk Development. El fixture exige la base/socket/obra sintéticos, no configura conexión de envío y guarda el resultado del motor. No acredita firma de Meta, cola completa `applyWebhookMessageAtomically`, transporte físico ni una incidencia real. Esos puntos siguen separados.

Sin nuevas dependencias, migraciones, tablas, rutas públicas o permisos concedidos. No se renueva la credencial piloto ni se promueve Production en esta fase.
