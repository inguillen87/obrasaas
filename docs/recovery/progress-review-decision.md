# Bitácora: decisión humana y fundamento visible

## Funcionalidad
Aprobar y rechazar un parte o una evidencia abre una revisión explícita antes de enviar cambios. Se muestra obra, título, versión y contenido del registro. Cuando el servidor suministra una referencia de evidencia permitida, se puede abrir el original en otra pestaña; el enlace se limita a su recurso interno exacto y mantiene la autorización del endpoint.

El rechazo exige un motivo tanto en la interfaz como en el dominio. El motivo normalizado queda en rejectionReason o reviewNote, según el tipo de registro, y se muestra en su tarjeta. El límite es 2000 caracteres. La nota opcional de una aprobación sólo se ofrece para evidencia, donde existe persistencia; un parte aprobado no acepta una nota que fuera a descartarse silenciosamente.

No se alteran los permisos de captura/revisión, las transiciones finales ni las revisiones optimistas. Se preserva el orden de comprobación de alcance, versión y transición. No se crean modelos ni migraciones y no se modifican cantidades, pagos, certificados o cronogramas.

## Confirmación y recuperación
La respuesta debe coincidir con ID, obra, estado, siguiente versión y motivo esperado antes de actualizar la tarjeta. Una respuesta incompleta, un conflicto o un contexto cambiado no se presenta como decisión confirmada. El fundamento se conserva en el diálogo, puede copiarse, y se ofrece consultar el estado sin reenviar automáticamente. El bloqueo por respuesta incierta no desaparece si falla el portapapeles.

El diálogo permite cerrar con Escape y devolver el foco, contiene el recorrido de Tab y pide confirmación antes de descartar un fundamento escrito. Durante el envío no se permite cerrar. Los cambios pendientes se suman a la protección existente del editor. No es almacenamiento offline ni recuperación después de cerrar el navegador.

## Verificación
Se añaden pruebas de dominio para rechazo sin motivo, límites, tipos inválidos, normalización y ausencia de mutaciones al fallar. Pruebas de confirmación verifican ID/obra/versión/estado/motivo; las de enlaces rechazan recursos ajenos o referencias no autorizadas.

scripts/verify-progress-review-ui.mjs monta ProgressClient real con HTTP y roles sintéticos. Verifica que abrir o cancelar no escriba, rechazo con motivo, cancelación de descarte, teclado/foco, conservación ante conflicto/respuesta incompleta, aprobación explícita, estado final sin botones de decisión y ausencia de controles en el rol de captura. Comprueba el diálogo a 320/390/768/1280 px. No sustituye una sesión real de Clerk, PostgreSQL, WhatsApp ni dispositivos físicos.

La evidencia del despliegue y la prueba autenticada se registran por separado en el PR, con commit y entorno. No se incorporan credenciales ni capturas privadas al repositorio público.

Referencias de interacción: documentación local del Next.js instalado y W3C APG Dialog Modal Pattern. Esta implementación no se anuncia como certificación de accesibilidad.
