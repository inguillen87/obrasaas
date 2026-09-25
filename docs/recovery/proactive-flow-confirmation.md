# S11.A21 — Envío revisado y recibo de la misma operación

Base: `d3d2c37be9dad4519bb65552184989aa6a7f07ca`. Cierra el defecto descrito en la issue #2 mediante contratos verificables y pruebas por escenario; el resultado y SHA publicado se registran en el PR después de ejecutar las validaciones.

## Mensaje y resultado
La bandeja muestra cuerpo, botón, destinatario enmascarado, idioma y vigencia antes de solicitar consentimiento. El POST requiere revisión y confirmación explícitas. El servidor reconstruye la huella de conversación, trabajador, contacto y definición de plantilla, y la compara tanto antes de reservar como antes de contactar al proveedor. Una versión o destinatario cambiados no se envían silenciosamente.

La respuesta exige empresa, obra, conversación, formulario, clave del intento, revisión, Message ID y estado explícitos. El cliente conserva también el cuerpo revisado. Un HTTP 200 vacío, incompleto o ajeno queda sin confirmar y no llega al callback del historial. Aceptado, enviado, entregado, leído, rechazado e incierto son estados distintos; ninguno acredita por sí solo avance físico o un pago.

## Recibo sin reenvío
GET del endpoint existente acepta `mode=receipt` y blueprint, con Idempotency-Key y X-ObraSaaS-Flow-Review en cabeceras, nunca el token de Flow. La búsqueda usa la identidad determinista anterior y verifica conversación autorizada, actor, blueprint y huella persistida. No llama a Meta, al sender, a resolución manual, ni modifica mensajes, sesiones o auditorías.

Un recibo ausente no prueba que el envío falló. El intento se conserva y no se habilita otro automáticamente. Un registro marcado aceptado sin referencia del proveedor se devuelve como incierto, sin modificar la fila. La consulta puede recuperar un envío histórico aunque luego la credencial de envío o la plantilla ya no estén habilitadas; el permiso de lectura actual sigue siendo obligatorio.

Los borradores y la clave permanecen en memoria dentro de la instancia empresa/obra/conversación. Cambiar chat o desmontar descarta sus respuestas tardías; no se ofrece persistencia offline ni recuperación nueva después de cerrar pestaña. Los bloqueos durables existentes del dominio siguen visibles desde el catálogo al volver.

## Decisiones y concurrencia
Un bloqueo síncrono impide doble clic. Reconectar no inicia un POST. Un error al refrescar el historial no transforma un recibo válido en una orden de reenviar. La resolución manual conserva su confirmación de riesgo y las guardas/auditoría anteriores; un PATCH vacío o ajeno no habilita un nuevo envío. Verificar la misma decisión reutiliza el mismo Message ID y no contacta al sender.

GET, POST y PATCH exigen contexto coherente con la sesión, rechazan origen cruzado y consultas ambiguas, y conservan permisos de conversación. El POST rechaza claves contradictorias en cabecera/cuerpo. Respuestas y errores son private/no-store, con Vary y nosniff. La recuperación no eleva roles ni omite membresías revocadas.

El servicio interno de envío conserva compatibilidad de llamadas legacy sin revisión para sus consumidores internos; la ruta HTTP nueva exige revisión de forma incondicional. No se cambia la identidad de idempotencia ni se reescriben registros históricos.

## Pruebas
`proactive-flow-confirmation.test.js` cubre los contratos puros. `whatsapp-proactive-flows.test.js` conserva los ensayos anteriores y agrega revisión del destinatario, consulta de recibos sin escrituras, credencial posterior revocada, alcance/actor, falta de referencia del proveedor, contextos y respuestas de rutas malformadas. El fixture común vive en `tests/helpers/proactive-flow-fixture.js` y no usa conexiones reales.

`verify-proactive-flow-confirmation-ui.mjs` monta el componente React, las rutas y servicios reales con identidad, base y proveedor inyectados. Comprueba respuesta vacía/ajena, consulta fallida y posterior recuperación, ausencia de recibo, reconexión sin reenvío, doble clic, fallo del historial, cambio de chat durante envío/lectura, destinatario cambiado y respuesta PATCH vacía. Se ejecuta también en el job público de CI con Chromium; sus capturas y prueba estructurada quedan como artefactos.

La prueba visual inicial detectó una rejilla de dos columnas incorrecta en el panel de decisión. Se corrigió con una columna, controles táctiles y altura de revisión móvil acotada; no se retiró la comprobación de visibilidad para obtener un resultado positivo.

Los ensayos usan proveedor HTTP simulado y base en memoria; no son una operación real de Meta ni un nuevo ensayo PostgreSQL del recibo. Suite, lint, build, regresiones anteriores, CI autenticado y comprobación pública del deployment se registran por separado y por SHA. No se importan credenciales o actores reales para estos fixtures.

Sin migraciones, dependencias, endpoints nuevos, cambios de precio, credenciales o permisos. El piloto físico y el pase a Production continúan requiriendo sus comprobaciones de cuenta, destinatario, recepción, respuesta, entorno e identidad/respaldo de base.
