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

## Contrato y validación técnica

El componente valida contexto, perfil canónico, opciones y recibo dentro del consumidor de la respuesta, antes de confirmar la referencia del diario. Una respuesta incompleta, de otra obra o con recibo inválido queda sin confirmar. Los handlers, transacciones, revisiones, permisos y activos Meta existentes no cambian en este bloque.

Pruebas: `production-customer-whatsapp-view.test.mjs` compone transporte y diario reales con respuestas controladas. `verify-customer-whatsapp-ui.mjs` monta el componente real a 320, 390, 768 y 1280 píxeles, incluyendo conflicto, denegaciones, pérdida de respuesta, recibos malformados, fallos de sesión y navegación por teclado. Su evidencia se guarda en `.vercel/customer-whatsapp-evidence/`; no constituye login, autorización Meta, entrega ni aceptación humana reales. Publicación y aceptación deben registrarse por separado para la revisión exacta desplegada.
