# Bitácora: corregir un parte rechazado sin borrar su historia

## Circuito cerrado
Un parte REJECTED puede originar un nuevo DailyLog en DRAFT. El original conserva ID, contenido, tarea, fecha, autor, revisión, estado y motivo de rechazo. No se reabre ni se altera una decisión final. El nuevo borrador exige un cambio de título, detalle o tarea, queda relacionado con el original y continúa por el circuito existente de envío y revisión humana.

La fecha de trabajo y atribución del autor original se toman de la base, no del JSON. El actor que prepara la corrección queda en la auditoría. Se permite conservar o seleccionar otra tarea canónica de la misma obra, o dejar pendiente la vinculación; no se inventan actividades. No se copian archivos, mensajes ni adjuntos. No se modifican avances, fechas del Gantt, cantidades, compras o pagos.

Cada original tiene como máximo una corrección creada por este flujo. Si esa corrección también se rechaza, puede originar su propio siguiente borrador; no se sobrescribe ninguno de los antecedentes. La relación utiliza recibos deterministas en AuditLog y referencias verificadas en el dominio, no una nueva clave foránea ni una firma digital certificada.

## Backend y reintentos
GET/POST /api/progress/[recordId]/correction exige sesión, permiso de ejecución y lectura de tareas. Compara las cabeceras de empresa/obra con la sesión antes de acceder a datos, limita el cuerpo y rechaza origen cruzado, campos adicionales y parámetros de consulta. Los identificadores de autoridad no se aceptan desde el formulario.

La consulta inicial devuelve una huella de la fuente. La escritura verifica estado REJECTED, revisión y huella dentro del bloqueo transaccional de proyecto. Un cambio de contexto, contenido fuente o versión impide crear desde una lectura obsoleta. La tarea se verifica en la obra. Una obra archivada/finalizada no permite crear correcciones.

El ID de la corrección se deriva de empresa/obra/original. Repetir la solicitud devuelve el mismo registro sin otro evento. Otra sesión autorizada tampoco genera una copia adicional del mismo origen. Cambiar el contenido para un origen que ya tiene corrección devuelve conflicto y orienta a la existente. Un reintento no revierte un borrador posteriormente vinculado o un estado revisado, y no recrea una corrección eliminada. Si falla la auditoría, se revierte la creación.

No se guardan el texto original ni el corregido dentro del evento de auditoría: se registran referencias, revisión de origen, relaciones de tarea y huellas. La consulta de relaciones está acotada por empresa y obra y sólo expone antecedentes/sucesores que siguen disponibles en ese proyecto.

## UX de continuidad
El diálogo Dark Obsidian separa original rechazado, motivo y campos corregibles. Explica que se creará un borrador distinto antes de confirmar. Mantiene encabezado y acciones accesibles en móvil, nombres accesibles estables, foco, Escape y confirmación de descarte. Una consulta o apertura no crea registros.

Ante una respuesta incierta se conservan texto, clave y contenido del intento. La edición queda detenida para verificar la misma operación, no para duplicarla. Una corrección existente abre su registro en vez de iniciar otra creación. El estado confirmado se valida antes de modificar la pantalla y se emite la invalidación de campo existente para consultar el Gantt.

Las tarjetas muestran ES UNA CORRECCIÓN / TIENE UNA CORRECCIÓN, con navegación al antecedente y al sucesor. Los enlaces usan recordId resuelto en el proyecto activo, por lo que no dependen de que el parte aparezca en la primera página del historial. Esa vista concreta no admite filtros ambiguos ni crea un nuevo parte como efecto de abrirse. Las relaciones permanecen visibles tras enviar, revisar, vincular y recargar.

## Verificación y límites
Se prueban el dominio, fuente obsoleta, reintentos desde otra sesión, historial de correcciones, fallo de auditoría, referencias fuera de scope, conservación del original, estados finales, lectura de registro exacto y handlers con dependencias controladas. Esto no equivale a una prueba de carga ni a carreras reales entre conexiones PostgreSQL.

scripts/verify-journal-correction-ui.mjs utiliza ProgressClient y sus diálogos reales con HTTP/roles sintéticos: abrir/cancelar sin mutación, borrador corregido, envío, aprobación, origen conservado, corrección existente, respuesta perdida y reintento idéntico, respuesta incompleta, conflicto y ausencia de la acción para un rol sin lectura de tareas. El diálogo se prueba a 320/390/768/1280 px. La verificación autenticada de cada preview se registra por separado en el PR.

No se requieren tablas nuevas, migraciones, dependencias, servicios pagos ni claves. No se amplía el permiso de revisión ni se convierten fotografías en mediciones. Se conserva la implementación anterior de mensajes autorizados de WhatsApp a partes; la recepción física y configuración del canal siguen siendo un prerrequisito separado del Sprint 11 del plan maestro. Este cierre de correcciones es una extensión del flujo de partes, no una afirmación de que los 14 módulos o la integración multimedia estén completos.
