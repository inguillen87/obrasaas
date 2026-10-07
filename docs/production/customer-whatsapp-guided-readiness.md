# Alta de WhatsApp: preparación, conexión y recuperación

## Recorrido del cliente

1. Ingresá a **Mi cuenta**, elegí tu empresa y abrí la obra que querés conectar. La preparación y la autorización requieren el permiso vigente de administración o dirección de esa empresa.
2. En **Tu número. Tu obra.**, elegí **Preparar WhatsApp**. Indicá el nombre del asistente, el tipo de número y los circuitos necesarios; confirmá que preparás la conexión para esa empresa y obra.
3. Elegí **Guardar preparación**. El recibo confirma esa preparación: no registra un número, no autoriza a ObraSaaS ante Meta ni activa mensajes o circuitos.
4. El enlace **Consultar autorización y conexión en Meta** lleva al panel **Autorizar WhatsApp con Meta** de la misma obra. Ese panel consulta la disponibilidad y las verificaciones reales. Una conexión almacenada como `CONNECTED` o habilitada no acredita recepción, respuesta ni aceptación del piloto.

Para un número dedicado, continuá únicamente con el recorrido de Meta disponible para tu cuenta. Necesitás acceso administrativo a los activos de tu empresa y cumplir los requisitos efectivos de negocio, permisos, publicación y autorización del proveedor. La validación del teléfono por código de Meta y el PIN de registro son pasos distintos. Las plantillas se comprueban para la cuenta vinculada; su existencia o aprobación no demuestra entrega.

Si usás **WhatsApp Business**, la coexistencia y la elegibilidad necesitan verificarse antes de conectar. Si ya tenés otro proveedor, el traspaso requiere un plan y validación. Guardar cualquiera de estas elecciones conserva la preparación; no desconecta la app o el proveedor ni permite sustituir el recorrido por un alta dedicada. No compartas tokens, claves o contraseñas.

La conexión sólo puede considerarse operativa después de las verificaciones canónicas de autorización, registro y habilitación, seguidas de una recepción y respuesta reales. El uso por participantes además depende de sus permisos, revisión humana de identidad y vínculo propio. La aceptación de campo permanece separada de una prueba técnica controlada.

## Cuando un resultado no se confirma

- **Sin respuesta al guardar:** elegí **Comprobar preparación**. Se consulta por GET el recibo del mismo intento con tu acceso vigente; no se envía otro guardado automáticamente.
- **El recibo todavía no se observa:** mientras los datos originales siguen disponibles en esta pantalla, podés elegir explícitamente **Reenviar mismo intento**. Conserva exactamente el identificador y el contenido anteriores. La consulta ausente no demuestra que el primer envío se haya perdido.
- **Otro administrador modificó la preparación:** elegí **Consultar versión actual sin perder mi edición**. Compará el nombre, tipo de número y circuitos guardados; marcá que revisaste la preparación vigente antes de guardar tu edición sobre esa revisión. No hay reintento automático ni sustitución silenciosa.
- **Cambió o terminó tu acceso:** se ocultan la preparación y el formulario privado. Un intento previamente incierto conserva sólo su referencia para consultar por GET. Si no hay recibo y ya no existen los datos originales, la pantalla no los reconstruye ni habilita un reenvío supuesto.
- **Después de recargar:** el diario de recuperación guarda únicamente referencias mínimas en IndexedDB. Permite consultar recibos con el contexto autorizado; no conserva formularios, tokens o archivos ni es una cola de trabajo sin conexión. Un recibo de una revisión anterior muestra la preparación vigente sin atribuirle el contenido del guardado original.

## Participantes e identidad por el canal autorizado

La preparación de este panel, la invitación de cuenta y la presentación de identidad por chat son acciones separadas. La invitación por correo y `PREPARE_KYC_CHAT` existen; el envío automático de la invitación junto con el código `IDENTIDAD` por WhatsApp no está implementado. El código privado se muestra una sola vez para su entrega por el responsable. Copiarlo, guardarlo o cerrar una presentación no demuestra un mensaje entregado ni crea una cuenta o permisos.

El responsable consulta por GET el perfil y las capacidades seguras vigentes antes de preparar o cerrar una presentación. La proyección de chat excluye código, digest, ciphertext, localizadores de documentos y credenciales. Un desafío `PENDING` o `CLAIMED`, incluso vencido, no puede reemplazarse silenciosamente por otro código ni por una invitación nueva. La acción explícita `CANCEL_KYC_CHAT` exige al emisor original con permiso canónico vigente, revisión exacta, motivo y recibo; conserva en un archivo privado el desafío anterior y el ciphertext original. El cierre no llama a proveedores ni cambia la revisión de identidad o los permisos. Si la participación está `REVOKED`, se exige además el evento canónico de revocación correspondiente y sus permisos de campo deshabilitados. `FINALIZING`, una confirmación pendiente o un KYC ya presentado impiden cerrar el borrador.

Una respuesta perdida al cerrar se recupera consultando por GET el mismo UUID. Si el recibo está confirmado, no se genera otro POST. La referencia mínima del diario permite consultar después de recargar; no guarda motivo ni material privado. Una preparación o invitación nueva sólo se ofrece tras consultar el estado cerrado y comprobar su propia elegibilidad. Renovar una invitación vencida o revocada sin cuenta vinculada sigue pasando por la autorización y correlación existentes de Clerk; cerrar la presentación no la renueva automáticamente.

Cuando una solicitud de ingreso ya está `ADMITTED`, el clasificador de intake puede reconocer una respuesta a un prompt KYC mediante el outbound sellado y su proyección canónica. Sólo cede el mensaje al puente KYC: no escribe ni concede autoridad. El puente conserva las comprobaciones del evento firmado, identidad, autorización del canal, asignación de obra, nonce, lease y plazos antes de avanzar. Un canal compartido conserva la obra destinataria del desafío; el historial de intake no la cambia.

El contrato técnico y las verificaciones de cierre están descritos en [Participación de obra, invitación y revisión privada](participant-access-and-private-kyc.md). Los ensayos PostgreSQL usan SQL real en un schema desechable y proveedores controlados; los ensayos de interfaz usan componentes reales y HTTP sintético. El login Clerk, la autorización y entrega reales de Meta y la aceptación del piloto por participantes de una obra siguen pendientes de evidencia propia. Ninguno de esos ensayos acredita por sí mismo una conexión operativa en campo.

## Contrato y validación técnica

El componente de preparación valida contexto, perfil canónico, opciones y recibo dentro del consumidor de la respuesta, antes de confirmar la referencia del diario. Una respuesta incompleta, de otra obra o con recibo inválido queda sin confirmar. El bloque de preparación conserva los handlers, transacciones, revisiones, permisos y activos Meta existentes; las acciones de participantes e identidad mantienen sus propios contratos descritos arriba.

Pruebas: `production-customer-whatsapp-view.test.mjs` compone transporte y diario reales con respuestas controladas. `verify-customer-whatsapp-ui.mjs` monta el componente real a 320, 390, 768 y 1280 píxeles, incluyendo conflicto, denegaciones, pérdida de respuesta, recibos malformados, fallos de sesión y navegación por teclado. Su evidencia se guarda en `.vercel/customer-whatsapp-evidence/`; no constituye login, autorización Meta, entrega ni aceptación humana reales. Publicación y aceptación deben registrarse por separado para la revisión exacta desplegada.
