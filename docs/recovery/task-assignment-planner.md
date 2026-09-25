# S11.A10 — Planificación y seguimiento de responsables

Base: e6cc278c9fe217c9693f17b78ce80f758fd272f4. Fecha: 19/09/2026.

## Circuito cerrado en esta entrega
La pantalla de ejecución mostraba las asignaciones, pero indicaba que debían crearse mediante API. Ahora permite planificar una actividad para una persona o cuadrilla activa de la misma obra, revisar la selección y guardarla como PLANNED. Funciona desde el listado general o desde la actividad enfocada del Gantt.

La preparación consulta la actividad canónica actual y su revisión, hasta 100 personas y 100 cuadrillas activas. El truncamiento se informa. El administrador elige un tipo de responsable y uno de sus registros; la interfaz no asigna automáticamente al remitente de WhatsApp. Se pueden dejar las fechas vacías. Cuando se cargan, son días de planificación, sin hora, almacenados a medianoche UTC y presentados sin convertirlos al día local anterior. No es un control de disponibilidad, superposición de recursos, cumplimiento de jornada ni calendario laboral.

Se reutiliza TaskAssignment y el creador transaccional extraído de createExecutionRecord. La API anterior delega en la misma función, manteniendo su contrato. No se crea un inventario paralelo de asignaciones ni una tabla nueva.

## Confirmación e idempotencia
El nuevo endpoint fija PLANNED como estado inicial. La petición contiene tarea, versión consultada, responsable y fechas; no acepta actor, empresa, obra ni estado elegidos por el cliente. La sesión y sus permisos proporcionan autoridad. Los headers se comparan obligatoriamente con el contexto autenticado y se rechazan orígenes cruzados y queries ambiguas.

La creación queda dentro del bloqueo transaccional de la obra, vuelve a leer la tarea y el responsable activo y verifica que la versión no haya cambiado. Un ID y recibo de auditoría deterministas vinculan empresa, obra, actor e intento. El mismo intento retorna la asignación existente, incluso si ya terminó; no la reabre ni recrea una eliminada. Otro contenido con la misma clave se rechaza. El planificador rechaza una asignación pendiente o en curso del mismo responsable, actividad y fechas exactas. No declara detección general de todas las superposiciones ni modifica la política de todos los clientes legacy.

Si falla la auditoría, se revierte la creación. Ante una respuesta incierta el diálogo conserva datos y clave, bloquea la edición de ese intento y permite verificarlo. Una respuesta vacía o de otra obra no limpia la preparación. Salir con datos exige confirmación; no se implementa almacenamiento offline del formulario.

## Seguimiento con revisión y explicación
Las transiciones del nuevo circuito son PLANNED → ACTIVE/CANCELLED y ACTIVE → ENDED/CANCELLED. ENDED y CANCELLED no se reabren por estas acciones. Iniciar revalida tarea y responsable; cancelar o finalizar una asignación activa no exige que el responsable siga activo, para permitir el cierre administrativo.

Cada cambio requiere revisión esperada, explicación y confirmación del usuario. La actualización y su auditoría son atómicas. Las fechas planificadas, el responsable y la actividad no se reescriben en estas transiciones. Si se pierde la respuesta, se consulta GET antes de considerar otro PATCH; una revisión anterior no aplica dos veces el cambio. El GET devuelve la última decisión que coincide con el estado/revisión del registro. No ofrece un historial completo de todas las decisiones ni reemplaza la auditoría general.

Finalizar una asignación no completa Task.progress, no modifica mediciones, línea base, duración o dependencias, no ficha una jornada, no acredita un salario y no concede un rol del canal. Los contratos de identidad de campo y WhatsApp permanecen separados.

## Gantt y experiencia
El estado de campo incorpora un único groupBy de asignaciones por hasta 50 tareas visibles dentro de la lectura RepeatableRead existente. Se devuelven conteos de planificadas, activas, finalizadas y canceladas, no nombres ni mensajes privados. La huella del snapshot cambia al cambiar esos conteos. La tarjeta muestra que se trata de registros de asignación, no número de personas: una cuadrilla puede tener varios integrantes. El enlace abre la actividad exacta y sitúa al usuario en el tablero de responsables.

La planificación y las decisiones confirmadas emiten la invalidación de campo existente. Se conserva el sondeo visible del Gantt; no se añade un canal push ni se afirma sincronización instantánea. Las barras y su avance conservan sus fuentes previas.

El tablero utiliza Dark Obsidian, búsqueda local por actividad/responsable y filtros explícitos de estado. Las tarjetas muestran responsable, tipo, período y revisión. El diálogo fija una tarea recibida del Gantt y separa la preparación de la confirmación. Los controles son táctiles, el foco vuelve al botón de origen y las acciones quedan visibles con desplazamiento en móviles. Las cuadrillas y personas son las ya autorizadas en la obra; no se envían invitaciones ni mensajes.

## Pruebas y límites de la evidencia
La suite de dominio utiliza el servicio y creador reales con un adaptador de base controlado: crea una asignación, conserva auditoría y fechas, comprueba duplicados, replay, tarea modificada, responsables inactivos, transición y revisión, suscripción/obra no escribibles, aislamiento y rollback. Los tests de handlers ejercitan los permisos y límites del nuevo endpoint. No equivalen a una prueba de carreras entre conexiones reales de PostgreSQL ni a un piloto con trabajadores reales.

El verificador `scripts/verify-task-assignments-ui.mjs` monta ExecutionClient y sus componentes reales con HTTP sintético. Recorre preparación sin escritura, selección de cuadrilla y fechas, descarte cancelado, respuesta perdida después de planificar y repetición idéntica, inicio cuya respuesta se pierde y recuperación GET sin repetir PATCH, finalización, recarga y consulta de decisión guardada. Comprueba el acceso de lectura y 320/390/768/1280 px. Los contactos, registros y servidor de ese ensayo son ficticios; no se envía WhatsApp a personas.

Ejecutar también `verify-schedule-restrictions-ui.mjs` y `verify-field-gantt-ui.mjs` para conservar la integración anterior. El resultado de suite, lint, build, commit y despliegue se registra por SHA en el PR #1. Un Preview READY no es Production y las pruebas controladas no renuevan la credencial Meta ni acreditan una respuesta física entregada.

Sin dependencias ni migraciones nuevas. La siguiente ampliación posible es planificación de capacidad/solapamientos y administración de integrantes de cuadrilla; no deben darse por implementadas por existir este tablero.
