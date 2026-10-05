# Acceso vigente y recuperación de invitaciones y CRM

## Aceptación de participantes

Una aceptación repetida consulta la misma autorización y auditoría canónicas que la recuperación por GET. Antes de confirmar `saved`, `joined` y el recibo original, exige la cuenta propia, el rol vigente, las pertenencias activas a empresa y obra y el evento exacto de aceptación. No crea otra pertenencia ni otro recibo. Una auditoría ausente o inválida requiere revisión; una referencia almacenada no acredita por sí sola el alta.

Se conserva el conflicto explícito cuando otra cuenta intenta aceptar. El POST mantiene la comprobación previa del proveedor y los bloqueos existentes; el GET de recuperación no llama al proveedor.

## CRM ante pérdida de acceso

Un HTTP 401 o 403 oculta contactos, búsqueda, recibo visible y borrador aunque el cuerpo sea HTML o esté vacío. La interfaz explica la sesión vencida o la falta de acceso. Una consulta fallida no guarda datos ni envía mensajes y no se repite automáticamente.

Si ya se despachó un guardado, una denegación, un error de integridad del recibo o una respuesta ajena al contrato conserva su referencia. El diario compartido no persiste nombres, correo, teléfono ni notas. Tras ocultar los datos, el estado temporal sólo conserva contexto, UUID, acción y el identificador de la oportunidad si era una edición. La recuperación usa GET con el mismo UUID y mantiene la comprobación del destinatario exacto de una edición.

Sólo un rechazo reconocido de negocio con `saved:false` permite terminar un intento nuevo rechazado. Un conflicto de revisión conserva el borrador y requiere consultar y revisar el estado vigente antes de enviar un nuevo cambio. La confirmación exige el recibo canónico correspondiente; no se interpreta un HTTP exitoso como prueba suficiente.

## Validación y límites

Las regresiones ejecutan el store real con fixtures controladas y PostgreSQL desechable. El navegador ejecuta los componentes reales, el ciclo de solicitud y el diario de recuperación con HTTP controlado, en 320, 390, 768 y 1280 píxeles. Cubren alta y edición, 401/403 no JSON, integridad y respuesta no contractual, conservación de referencia y recuperación sin otro POST. Se conservan las pruebas anteriores de búsqueda, paginación, conflictos, sesión y recarga.

Estas pruebas no certifican un inicio OAuth nuevo, entrega de correo o WhatsApp, biometría, aprobación de Meta ni aceptación humana de una obra. La implementación, ejecución de pruebas, publicación del commit y aceptación del piloto se registran por separado en la evidencia de cada versión.
