# S11.A14 — Reprogramación de asignaciones sin duplicar trabajo

Base: 1712129d903eb0b690ca5ccef90af9de77f3750d. Fecha: 21/09/2026.

## Circuito
La tarjeta de asignación permite revisar y cambiar su período previsto sin cancelarla ni crear otra. Conserva ID, actividad, persona/cuadrilla y estado PLANNED. Las asignaciones en curso, terminadas, canceladas, con doble responsable legacy o con fechas que contienen horas no se reprograman por este circuito de días completos.

Antes de guardar se consulta la revisión actual, se comparan fechas guardadas/propuestas y se revisan las coincidencias con otras asignaciones e integrantes de cuadrillas dentro de la misma obra. Se excluye únicamente el ID de la asignación que el servidor leyó en ese contexto: el cliente no puede aportar listas de exclusión ni sustituir el responsable o la tarea.

El motor de coincidencias es el existente. No se implementa un segundo cálculo de capacidad, horas, calendario laboral o disponibilidad entre empresas. Si faltan fechas o dotación, la revisión lo indica y el motivo debe explicar la coordinación; ausencia de hallazgos no es garantía de disponibilidad. Los días de inicio y fin mantienen la semántica inclusiva actual.

## Datos y confirmación
GET consulta el registro y el último cambio de fechas verificable. POST calcula una revisión sin escribir. PATCH acepta revisión esperada, período propuesto, huella de revisión, motivo y confirmación explícita. Los tres métodos exigen sesión/contexto; revisión y escritura requieren gestión de ejecución y lectura de tareas. El body no puede elegir organización, actor, tarea, responsable ni estado.

La escritura se ejecuta bajo el bloqueo transaccional existente de la obra. Relee permisos operativos de suscripción/obra, estado de asignación, responsable activo, revisión de tarea e integrantes; vuelve a calcular el snapshot. Una planificación que cambió después de revisar se rechaza. El update exige la revisión original y PLANNED e incrementa la revisión una vez. La auditoría de antes/después se guarda en la misma transacción.

Un error de auditoría revierte las fechas. Si se pierde la respuesta, la interfaz conserva propuesta/motivo y ofrece GET para consultar el estado, no otro PATCH automático. El recibo debe coincidir con ID, responsable, período, revisión anterior/nueva, motivo y huella. Si otro usuario cambió el registro, se conserva el borrador pero se retira la aprobación hasta revisar la versión vigente. Una respuesta vacía o ajena no cierra el formulario como guardado.

## UX/UI
El diálogo usa Dark Obsidian y compara «Guardado ahora» con «Nueva propuesta». Incluye controles táctiles, foco al abrir/cerrar, cancelación protegida, errores visibles, fechas de calendario sin conversión de huso y revisión de coincidencias. Cambiar una fecha retira la revisión y la confirmación anteriores. En lectura se consulta el período y su cambio registrado, sin botones de escritura.

El flujo de cambio de estado existente se conserva. No se mezclan reprogramación y finalización en un formulario. La versión del registro permite evitar que dos decisiones concurrentes se pisen.

## Límites explícitos
Las fechas modificadas pertenecen a TaskAssignment, no a Task. El circuito no mueve las barras, línea base o dependencias del Gantt; no actualiza progreso/mediciones, asistencia, salarios, permisos de WhatsApp ni identidades de trabajadores. No modifica dueño ni activa trabajo. Las asignaciones planificadas sin fechas pueden ser revisadas explícitamente, pero siguen sin demostrar disponibilidad.

Se utiliza el esquema y AuditLog existentes, sin migraciones o nuevas dependencias. No se envían mensajes ni se incorporan personas reales. Los formularios son efímeros y no agregan almacenamiento offline.

## Evidencias
El job de validación ejecuta suite completa, lint, build y pruebas con PostgreSQL 17 desechable. Las pruebas SQL verifican exclusión propia, coincidencias ajenas, actualización atómica, recuperación GET, revisión obsoleta, aislamiento, rollback de auditoría y dos conexiones compitiendo sobre la misma revisión.

El ensayo de navegador monta la tarjeta y diálogo reales y llama por HTTP a los servicios reales con PostgreSQL desechable. La sesión es sintética: no acredita login de Clerk. Las respuestas perdidas se simulan después del guardado real y una revisión se invalida mediante un cambio real en otra asignación. Se verifican comparación visual, recuperación sin duplicado, motivo tras recarga, sólo lectura y rechazo de un contexto ajeno.

Las cifras y SHA de publicación se consignan al finalizar en el PR #1. Un resultado READY en Preview no es el pase general a Production ni una validación de respuesta física de Meta.
