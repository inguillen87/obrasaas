# S11.A25 — Del formulario enviado a su respuesta original

Base: `ae995bf97f076072afd3302b8d8e6333ed8a4978`. Extiende el seguimiento A22/A23 y su aceptación autenticada A24. No equivale a aprobar ni certificar un resultado de negocio.

## Operación
En Bandeja → Seguimiento de formularios, una fila con respuesta registrada y sesión verificada permite «Consultar respuesta vinculada». La consulta explícita recupera el mensaje recibido aun después de recargar, sin recorrer manualmente las páginas de la conversación ni conservar una clave del intento. Muestra texto operativo permitido, identificador interno y fechas de registro/procesamiento.

La cadena se comprueba en el servidor: Message saliente → sesión de la misma organización/obra y blueprint → consumedExternalId → Message entrante de esa conversación → marcadores de sesión, blueprint, trabajador y proveedor guardados por el motor. Nunca busca por nombre, teléfono, texto parecido o cercanía temporal. No recibe un id de respuesta elegido por el navegador.

No existe un vínculo universal a un registro de negocio en el contrato actual del webhook. La consulta nueva llega al mensaje original correlacionado; no inventa un enlace a Incident, AttendanceEntry, DailyLog ni un estado de aprobación a partir del consumo. El enlace a esos dominios sigue como trabajo separado que debe comprobar su registro y permiso exactos.

## API y privacidad
Se amplía el GET existente de proactive-flows con `mode=reply` y `messageId` (identificador del envío). No hay una ruta pública nueva. Exige permiso conversations:read, contexto real de sesión, origen correcto y filtros de empresa/obra/conversación. No necesita una conexión WhatsApp activa ni busca tokens. El emisor, recibos, roles y endpoints de escritura permanecen sin cambios.

La lectura es RepeatableRead y acotada a una conversación, un envío, una sesión y una respuesta. Incoherencia de identidad, estado de entrega, timestamps, cuarentena, ausencia de mensaje o marcas de sesión incorrectas no devuelven cuerpo. Los estados not_recorded/unavailable se distinguen sin certificar que la respuesta no existió.

El extracto reutiliza el presentador y saneamiento de la bandeja con privilegio mínimo: nunca habilita evidencia médica o de origen adicional. La respuesta HTTP tiene forma estricta, sin teléfono, referencia Meta, token, metadata sin filtrar, URL de archivo, clave de sesión o datos de otro empleador. Los blueprints privados de cobro quedan fuera del historial operativo admitido. Consultar no marca leído, escribe auditorías ni contacta a Meta.

## Interfaz y concurrencia
No consulta por render ni por abrir el historial. Actualizar borra el contenido anterior hasta verificar la respuesta nueva. HTTP exitoso vacío, de otro envío o de otro contexto no acredita correlación. Cerrar, cambiar conversación, refrescar la página de historia o quedar sin conexión descarta la respuesta pendiente. Reconectar no reenvía ni consulta automáticamente. Hay estados de espera, ausencia, fallo, bloqueo y recuperación de sólo lectura, con controles táctiles y teclado.

## Evidencia
Pruebas de dominio/rutas cubren vínculo exacto, otro tenant/conversación/trabajador, timestamps, privacidad, permisos, parámetros extra, respuestas inválidas y cero escrituras. El verificador UI monta History, Reply, ruta y servicios reales con identidad/base controladas, y comprueba diez escenarios a 320/390/768/1280 px. No es una prueba física de Meta.

El verificador PostgreSQL existente incorpora seis casos de respuesta sobre la base desechable, conservando sus ocho casos de historia. El journey con Clerk Development incorpora un mensaje entrante sintético adicional correlacionado a la primera de las 26 sesiones, verifica el GET real y el acceso desde móvil, y vuelve a denegar después de cerrar sesión. No simula autenticación ni las respuestas HTTP; resultado y SHA se acreditan en el PR sólo después de ejecutar.

No se agregan dependencias, migraciones, participantes reales, mensajes externos o promoción a Production. El piloto y la certificación de resultados de negocio siguen separados.
