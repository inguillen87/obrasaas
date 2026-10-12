# Seguimiento de los intentos de identidad por WhatsApp

La consulta de la ficha separa el intento recibido, su respuesta y la entrega de esa respuesta. Una aceptación de la API no confirma entrega ni lectura. Los recibos anteriores sin información suficiente permanecen por comprobar.

La observación requiere acceso vigente a la obra y autorización canónica sobre la ficha. El servidor correlaciona el mensaje firmado, la salida reservada y su recibo sellado. Para mostrar entrega, lectura o fallo verifica además el estado firmado de WhatsApp con el mismo mensaje, destinatario, canal y organización. La respuesta pública sólo incluye un estado cerrado y, cuando existe evidencia, su fecha; nunca incluye código, documento, teléfono, mensaje, credencial ni identificador del proveedor.

La consulta no envía mensajes ni modifica el desafío. Las respuestas reservadas o cuyo envío quedó sin confirmar conservan su recibo original y no se reenvían automáticamente. Cambiar la ficha, obra o desafío descarta el diagnóstico anterior; perder autorización cierra la consulta privada. La presentación personal y la revisión independiente de identidad se conservan.

Un inicio corporativo `IDENTIDAD` que no conserva el formato esperado usa la respuesta genérica existente, después de comprobar firma y autoridad vigente del canal. Esa respuesta no confirma si una persona o código existen, no concede permisos y no guarda una presentación. Mensajes de otro tipo conservan su recorrido.

## Validación y límites

La aceptación adicional usa PostgreSQL desechable con callbacks firmados, los adaptadores reales y transporte sintético: ocho grupos verifican rechazo, duplicados, envío incierto, revocaciones y observación privada de respuestas. La UI real tiene veintidós casos a 320, 390, 768 y 1280 píxeles, con consultas GET, teclado, cambios de contexto y denegaciones.

El verificador exige el commit y árbol exactos, fuentes y productores comparados contra Git, matrices completas, cero llamadas a proveedores y cierre de los recursos propios. Estas pruebas no acreditan entrega real de un mensaje, identidad humana aprobada, KYC profesional contratado ni aceptación de campo. La publicación y la comprobación autenticada se registran por separado.
