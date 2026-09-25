# S11.A9 — Restricciones de obra junto al cronograma

Base de trabajo: adddb05a2696a791b085e40bec791b83fdda473d. Fecha: 19/09/2026. Complementa el Sprint 11 del plan vigente y el cierre mensaje → restricción → resolución, sin sustituir la prueba física de WhatsApp.

## Circuito conectado
Las restricciones existentes se muestran junto a su tarea en el panel del Gantt y en la etiqueta de la barra. Se distinguen pendientes de atención, en tratamiento, resueltas y canceladas; la prioridad alta/crítica corresponde a la registrada, no a una inferencia nueva. El vencimiento mostrado proviene de dueAt y sólo se considera mientras la restricción sigue abierta o en tratamiento.

Desde la tarjeta se abre la vista de ejecución filtrada por la tarea canónica. Allí se consulta el responsable y se utiliza la resolución explicada existente. Volver al Gantt permite consultar el cambio confirmado. El Centro de operaciones abre la restricción exacta de su muestra mediante blockerId, en lugar de dirigir al usuario a buscarla en el listado general.

No se modifica Task.progress, avance medido, duración, dependencias, línea base, presupuesto o inventario. Una prioridad crítica no prueba que la actividad pertenezca a la ruta crítica del plan. Un plazo vencido no se convierte en días de atraso calculados. Resolver un impedimento no certifica que la tarea esté completada.

## Lectura y límites
El endpoint de estado de campo conserva los permisos de tareas y ejecución, la comparación del contexto con la sesión y su transacción RepeatableRead. Dentro de esa misma lectura se agrega una única consulta groupBy para hasta 50 tareas visibles, acotada por empresa, obra e IDs. No se hace una consulta por tarea, no se traen mensajes, descripciones o nombres de trabajadores en el canal de resumen.

Se agregan conteos, severidad de las restricciones activas, primera fecha de vencimiento activa y última modificación. La huella de la respuesta cambia al cambiar la restricción o al cruzar su fecha de vencimiento. El servidor mantiene su reautorización incluso con ETag; no hay caché compartida ni nueva conexión push. Se conserva la consulta visible cada 10 segundos y la invalidación local ya implementada.

Los conteos de restricciones son de esta página de tareas. El filtro «Mostrar sólo tarjetas con restricciones» reduce las tarjetas de la página, no elimina barras del Gantt ni busca todas las páginas. Cero sólo se presenta cuando la consulta confirmó esa ausencia; un payload anterior sin el nuevo campo aparece sin verificar. Un fallo de la consulta no se reemplaza con una lista vacía saludable.

La vista de ejecución con taskId comprueba que la actividad pertenece a la obra y es canónica; la página exige lectura de tareas además de ejecución. Un ID inválido, combinado con blockerId o perteneciente a otra obra no termina en la primera tarea. La consulta de restricciones y asignaciones usa ese taskId. Las cuadrillas y responsables siguen perteneciendo a la obra y no se presentan como exclusivos de esa actividad.

## UX y continuidad
Se conservan Dark Obsidian, tokens, controles de 44 px y estados textuales que no dependen solamente del color. Las métricas se reordenan verticalmente en pantallas angostas. Los enlaces del panel respetan el guard de cambios locales; un texto de resolución no se pierde por volver al cronograma. La tarea seleccionada queda fijada al abrir otra restricción desde esa vista; un guardado no la deselecciona.

No se agrega otro motor para cerrar restricciones. El formulario y PATCH existentes conservan permisos, revisión y confirmación; la creación manual confirmada también emite la invalidación de campo. El historial resuelto permanece consultable y no se convierte en una nueva operación por navegar.

## Verificación
Tests de la agregación, scope, capacidad máxima, prioridades, estados finales, fechas, ausencia de datos y fallo de fuente. Tests del listado por tarea canónica y de la huella del snapshot, conservando fechas y progreso. El verificador de navegador monta Panel, Gantt y ExecutionClient reales con HTTP y participantes sintéticos, y utiliza la agregación nueva real. Recorre señal → filtro de tarjetas → tarea exacta → responsable → resolución consentida → vuelta al Gantt; comprueba que el aviso desaparece sin cambiar 10% operativo o 20% medido.

Ese ensayo no es una escritura de un trabajador real en PostgreSQL ni una respuesta física de Meta. El SHA, resultados de suite/lint/build, regresiones y estado del despliegue se registran en el PR después de ejecutar cada control. No se agregaron tablas, dependencias, claves o proveedores pagos. Production permanece separada del entorno Preview.
