# Recordatorio autorizado de jornada

Este bloque reutiliza el proveedor, el cifrado por empresa, el estado outbound de
`WebhookEvent` y la correlación de estados firmados existentes. No agrega tablas,
una cola paralela, un CRM ni un transporte con el número demo.

## Autorización del trabajador

En **Mi WhatsApp de obra** el trabajador puede autorizar avisos operativos con un
aviso versionado, una casilla y una acción explícita. El teléfono vinculado no
implica ese permiso. El registro queda en la identidad canónica del participante
y su auditoría exacta; no se guarda el texto ni el teléfono en la referencia de
recuperación del navegador.

El alta requiere participación, asignación, KYC revisado por otra persona,
vinculación y prueba firmada vigentes. El retiro del consentimiento no exige que
el KYC, la vinculación o la conexión sigan habilitados; sí verifica la cuenta y
su pertenencia/asignación. Cambiar la vinculación no hereda el consentimiento.

El GET con UUID consulta un recibo propio del actor, empresa y obra. No vuelve a
emitir códigos de vinculación ni concede permisos por sí mismo.

## Un único envío manual adoptado

El catálogo incluye cuatro definiciones aisladas por conexión, WABA y contenido.
Sólo **recordatorio de jornada abierta** tiene envío manual. Invitación, pedido de
evidencia y aviso de revisión conservan preparación/aprobación; sus mensajes no
se envían desde esta interfaz. No se afirma que tengan un flujo proactivo completo.

ADMIN/DIRECTOR consulta la disponibilidad, elige un destinatario habilitado,
revisa el texto derivado de la obra y confirma el recordatorio. No ingresa números,
WABA, tokens, un cuerpo arbitrario ni parámetros libres.

Antes de reservar y antes de transmitir se comprueban permisos, consentimiento,
KYC, vínculo firmado, conexión activa y la última fase de `AttendanceEntry` del
trabajador: jornada trabajando o en pausa, sin salida registrada. La aprobación
guardada no alcanza: se consulta la definición exacta en la WABA del cliente y
se exige estado APPROVED/categoría UTILITY, idioma y cuerpo coincidentes.

La consulta presenta hasta 20 participantes y 20 envíos propios recientes. La
interfaz informa ese alcance; no representa un censo de la empresa ni una bandeja
comercial completa. Los envíos manuales no se hacen pasar por mensajes entrantes.

## Resultado durable y recuperación

Se reserva antes de llamar al proveedor. El pedido privado y su contexto se
cifran con AAD de empresa/obra/recurso; la metadata pública guarda sólo referencias.
Un POST incierto conserva el mismo UUID. Un UUID nuevo para ese destinatario se
rechaza mientras siga SEND_STARTED/SEND_UNKNOWN, incluso si venció la lease.
Consultar el recibo usa GET y nunca vuelve a enviar el mensaje.

- ACCEPTED acredita respuesta válida de Meta al envío; **no acredita entrega**.
- STATUS_OBSERVED proviene del callback firmado, correlacionado con conexión,
  destinatario, contenido reservado y mensaje. Sent, delivered, read y failed
  siguen siendo resultados distintos.
- REJECTED puede ser una detención local antes de transmitir o un rechazo del
  proveedor; la interfaz distingue ambos. No se reenvía automáticamente.
- NOT_OBSERVED y resultados inciertos conservan la referencia. Sin un estado
  firmado que resuelva una transmisión incierta, el bloqueo sigue vigente.

La entrega no registra salida, aprueba evidencia ni modifica tareas/Gantt.
Después de recargar se puede consultar el historial propio y sus recibos. La
recuperación general guarda referencias, no formularios ni adjuntos cerrados.

## Prueba y aceptación

Las pruebas emplean motores reales en PostgreSQL desechable, HMAC, cifrado y el
adaptador HTTP con respuestas controladas. El navegador usa componentes reales
con sesión/API controladas. Esto no prueba login humano, consentimiento de un
trabajador real, aprobación efectiva en la WABA nueva ni entrega en un teléfono.

La [colección oficial de Meta: mensaje de plantilla](https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive)
documenta BODY con parámetros text. No se incorpora el SDK histórico archivado.

La publicación se acredita por SHA, CI, alias y código servido en un comprobante
independiente. No se cambian app, WABA, número demo ni tokens de Meta. Los permisos
efectivos de la aplicación y el piloto físico son comprobaciones separadas.
