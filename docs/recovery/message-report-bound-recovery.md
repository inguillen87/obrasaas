# S11.A26 — Parte ligado al mensaje y recuperación sólo por lectura

Base: `3f67efbc13cae99abf7a277ef2b951a838513e1a`. Cierra el defecto de contrato registrado en issue #3 cuando el árbol final y su aceptación queden comprobados.

## Identidad y comprobaciones
El identificador determinista de DailyLog se conserva: SHA-256 de organización, obra, conversación y mensaje, con el prefijo ya utilizado por el escritor. El cliente calcula esa identidad antes de aceptar la preparación y la confirmación; no utiliza el ID devuelto por una respuesta defectuosa como su propia expectativa.

Preparar devuelve contexto exacto, identidad prevista, fuente, registro existente y recibo original mínimo. La consulta existente comprueba ahora la auditoría persistida y sus referencias de origen, tarea y trabajador. Un parte sin recibo o un recibo sin parte no produce un enlace inventado ni se repara automáticamente.

El POST devuelve contexto, versión de fuente y huella del input normalizado junto al registro y replay. El cliente y el handler comprueban ese contrato; un 200 con datos ajenos, incompletos, ID malformado o una huella distinta no confirma el parte. La huella no es una firma ni sustituye autenticación: vincula el resultado al intento dentro de un canal ya autorizado.

La idempotencia transaccional y el identificador de parte existentes se mantienen. Otro operador no crea otra copia del mismo origen; un contenido diferente sigue rechazado. No se añade migración ni cambia el régimen de permisos de conversaciones, evidencia, ejecución o tareas.

## Recuperación de la interfaz
Una consulta inicial que falla se puede repetir dentro del diálogo. Si el mensaje cambia antes del guardado, se actualiza su origen conservando tarea, título y resumen, pero retirando consentimiento; es necesario revisar nuevamente. Mientras se consulta o falla la verificación no se confirma con fuentes antiguas.

Un resultado POST incierto conserva su intento y ofrece «Consultar recibo sin guardar de nuevo». Esa acción sólo hace GET. Reconocer el recibo persistido de la misma fuente, versión e input recupera el parte y su estado actual, incluso si ya fue revisado después. Si el recibo no aparece, no se infiere que el guardado falló ni se habilita automáticamente otro POST. Si el mensaje se modificó después de guardar, la consulta conserva por separado la versión del recibo original y la fuente actual.

El diálogo está aislado por empresa/obra/conversación/mensaje; respuestas tardías no cambian otra fuente. Doble envío bloqueado antes de generar la solicitud. Un fallo del callback de actualización de bandeja conserva la confirmación local y el enlace exacto; no vuelve incierto un guardado válido. Cerrar pestaña no añade persistencia offline del borrador: la copia local sigue en memoria, con guardia de salida y copia manual.

Se mantienen los textos operativos y transcripciones existentes, restricciones médicas y privadas, estado inicial DRAFT, auditoría atómica y rechazo de obra no operable. No se envía WhatsApp, modifica avance ni aprueba partes por estas consultas. No convierte respuestas de Flow INTERACTIVE en partes: el enlace de A25 al mensaje y esta preparación de texto/audio son circuitos relacionados pero distintos.

## Verificación por capas
`message-report-recovery.test.js` cubre recibos negativos, identidad/fingerprint, origen actualizado, auditoría inválida y recuperación sin escritura. Los tests de ruta comprueban permisos y rechazan resultados incompletos. Los contratos preexistentes de texto, audio, suscripción, tareas, idempotencia y rollback permanecen.

`verify-whatsapp-report-ui.mjs` usa diálogo y servicios reales con identidad, HTTP y base controlados. Incluye 14 escenarios con recarga, fallos, respuesta perdida, ausencia, actualización de origen, doble submit, callback fallido y cambio de mensaje; anchos 320/390/768/1280. El ensayo acepta sólo sus avisos beforeunload al navegar entre escenarios; no se deshabilita la guardia de salida de la aplicación.

`verify-message-report-recovery-postgres.mjs` exige PostgreSQL desechable loopback con la guarda existente. Comprueba preparación, creación/recibo, GET sin cambios, replay por otro operador, solicitudes paralelas, aislamiento, fuente cambiada, rollback ante auditoría fallida y registro huérfano.

El recorrido `s11-message-report-journey.js`, integrado al S9.2 antes de historia, usa Clerk Development y base aislada: preparación y rechazos, creación móvil del borrador, recuperación/recarga con enlace exacto y una única auditoría. El helper verifica socket, nombre de base, metadatos sintéticos, ámbito y ausencia de canal de envío.

Registrar los resultados por SHA en PR #1 después de ejecutarlos. Un verificador escrito no equivale a un resultado aprobado. La renovación del piloto, Meta físico, producción y otros dominios siguen separados.
