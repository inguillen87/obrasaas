# Metrado de tareas y reportes diarios

La base de medición pertenece a la tarea de la obra. Un administrador o director autorizado puede definir cantidad total, unidad, referencia del cómputo revisado y motivo desde el cronograma de `/cuenta`. La configuración conserva las fechas, el porcentaje y el estado de la tarea y registra un recibo en el mismo `AuditLog` que la operación de campo.

La base no se deduce de una foto ni de materiales consumidos. El importador de PDF, imagen o Excel todavía no certifica cantidades: la referencia se confirma por el responsable. Una tarea con porcentaje histórico pero sin metrado exacto aprobado no se convierte automáticamente a cantidades. Una base o unidad con cantidades ya aprobadas no se redefine por este recorrido.

## Reportar desde WhatsApp o la web

En una tarea configurada, el participante elige **Realizado hoy** o **Total acumulado** y declara una cantidad exacta en la unidad establecida. El servidor lee el metrado aprobado vigente y calcula con decimales exactos:

- Adicional: acumulado aprobado + cantidad declarada.
- Acumulado: cantidad declarada; la diferencia se muestra por separado.

Antes de confirmar se muestran acumulado anterior, adicional, nuevo acumulado, base y porcentaje. La selección conserva la revisión de la tarea y la evidencia aprobada. Una nota de audio puede servir de fuente revisada; nunca suma cantidades o aprueba el avance por sí sola.

La propuesta permanece pendiente. Otro administrador o director revisa la medición, el motivo y la evidencia. Al aprobar se actualizan juntos la tarea, la propuesta y el recibo. El cronograma muestra el metrado aprobado. Rechazar conserva el avance anterior. Un cambio de tarea, base, evidencia o permisos impide usar una confirmación obsoleta.

## Recuperación y compatibilidad

Los intentos conservan la misma referencia de operación. Una respuesta perdida se consulta; no dispara otro reporte ni vuelve a sumar el adicional. El recibo conserva su resultado original y permite consultar el estado vigente de la tarea. Una tarea con propuesta pendiente requiere resolverla antes de configurar otra base.

Si la configuración sigue sin recibo, el responsable puede cerrar explícitamente ese intento. El cierre queda registrado bajo la misma referencia y bloquea un POST original que llegue más tarde. Si la configuración ya se había guardado, el cierre recupera ese resultado; conserva la base y su recibo. La recuperación también está disponible después de recargar, sin guardar el formulario en el navegador.

Las tareas existentes sin configuración conservan el recorrido anterior de porcentaje o cantidad acumulada/base. Una tarea configurada exige el nuevo contrato y no acepta que el operario cambie base, unidad o porcentaje en el mensaje. La configuración no habilita nuevos roles, identidad, cobros, conexión de WhatsApp o acceso a otra empresa.

Las verificaciones automatizadas usan personas, obras, documentos y proveedores sintéticos. La aceptación del piloto sigue necesitando presentación personal de identidad, revisión independiente y reportes de obra reales.
