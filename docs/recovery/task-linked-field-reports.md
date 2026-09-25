# Partes de campo: tarea elegida y recuperación de borradores

## Circuito implementado
Campo móvil permite elegir una tarea canónica de la obra antes de guardar el parte. La selección es opcional y explícita: si no se conoce la tarea, el registro queda pendiente de vincular, sin inventar una actividad. El servidor exige permiso de lectura de tareas cuando se selecciona una y verifica su pertenencia a la obra en la misma transacción que crea parte y auditoría. El catálogo móvil está acotado a 500 actividades y se informa cuando es parcial.

La bitácora incorpora Vincular a una tarea / Cambiar tarea del borrador. El diálogo muestra obra, parte, tarea actual, destino e impacto antes de confirmar. Conserva el texto, fecha y autor: no crea otro parte. La operación suma una revisión y un evento de auditoría con relación anterior y nueva, sin copiar el texto del parte en esa auditoría.

La acción está limitada a DRAFT. SUBMITTED, APPROVED y REJECTED no pueden reasignarse mediante este endpoint. Las transiciones de revisión y sus permisos no se modifican. Los registros finales sin tarea se conservan como tales; no se reescribe silenciosamente su historia.

El panel de Gantt enlaza a una bandeja específica de partes sin tarea. Después de confirmar una vinculación, ese registro sale de la bandeja y la capa de campo del Gantt vuelve a consultar el backend. La vinculación no aumenta porcentajes, no desplaza fechas, no emite compras ni modifica stock.

## Integridad
PATCH /api/progress/[recordId]/task requiere sesión, permiso de ejecución, lectura de tareas, cabeceras de contexto comparadas con la sesión y cuerpo acotado. Rechaza origen cruzado. El ID de empresa/obra/actor no se toma del JSON. La escritura usa el bloqueo de proyecto existente, versión esperada y comprobación atómica de estado DRAFT.

El recibo idempotente queda en AuditLog, con dominio propio y clave ligada a empresa/obra/actor/registro. El mismo intento no incrementa dos veces la versión; reutilizar su clave con otro contenido se rechaza. Un reintento antiguo no revierte una vinculación posterior ni transforma un parte revisado en borrador. Si falla la auditoría, se revierte la vinculación dentro de la transacción.

La captura móvil conserva la normalización anterior cuando no hay tarea. Así no cambia la huella de solicitudes legacy ni se invalidan sus reintentos por agregar un campo opcional. No se requieren nuevas tablas, migraciones ni dependencias.

## UX y recuperación
Diálogo Dark Obsidian con búsqueda en el catálogo disponible, selección nativa, resumen del efecto, foco inicial en volver, recorrido de teclado, Escape y confirmación antes de descartar la selección. La operación en curso participa de la protección de salida del editor. Ante respuesta incierta, conserva la misma clave y contenido para verificar el intento; no crea una operación distinta automáticamente.

La respuesta debe confirmar registro, obra, tarea y revisión antes de actualizar la tarjeta. Un conflicto de contexto, permiso o versión exige revisar el estado actual. Una imagen aprobada no equivale a medición aprobada, y esta entrega tampoco cambia esa distinción.

## Pruebas y límites
Suite de dominio y handlers con dependencias controladas: normalización, enlace, reintentos, asignación posterior, concurrencia simulada, alcance, permisos, estados finales, fallo de auditoría y filtro sin tarea. La prueba de concurrencia local no sustituye una prueba de carga PostgreSQL.

scripts/verify-journal-task-link-ui.mjs ejecuta los componentes reales de Campo y Bitácora con HTTP sintético: alta ya vinculada, apertura/cancelación sin escritura, conservación de selección, salida de la bandeja, pérdida de respuesta y reintento idéntico, ausencia de acción en estado final y tamaños 320/390/768/1280 px. La evidencia autenticada de cada despliegue se registra aparte en el PR.

Se consultó la cuenta Meta configurada en lectura y respondió Test Number. No se enviaron mensajes ni se cambió el webhook; esa consulta no acredita la conexión WhatsApp→backend→obra. La integración de recepción y las credenciales operativas continúan como entrega pendiente del Sprint 11 del plan maestro. Los medios reales de Victoria no se procesaron en esta tanda ni se usaron para entrenamiento.
