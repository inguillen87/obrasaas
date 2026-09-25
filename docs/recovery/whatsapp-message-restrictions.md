# S11.A8 — Del mensaje a una restricción con seguimiento

Base: ddb11fb28b9ab941d4a85e87cd25eaf9d0fbac38. Fecha: 19/09/2026.

## Circuito conectado
Un administrador con acceso a la conversación, evidencia, tareas y ejecución puede abrir «Registrar una restricción» desde un texto operativo de WhatsApp o un audio cuya transcripción ya se completó. La acción reutiliza la elegibilidad del origen existente: excluye mensajes salientes, simulados, sin autorización registrada, en cuarentena, médicos o con contenido restringido. No transcribe nuevamente el audio ni infiere una cantidad a partir de una foto.

El diálogo muestra la fuente conservada y exige título, detalle revisado, actividad, responsable y prioridad. No selecciona automáticamente al remitente como responsable. La confirmación aclara que se abre un pendiente, no una orden de compra. El registro se crea como ProjectBlocker OPEN mediante el dominio existente de ejecución. No se escriben cantidades, stock, presupuesto, fechas o porcentaje de tareas.

La consulta de preparación no escribe. Los responsables se consultan sólo dentro de la obra, hasta 100 personas y 100 cuadrillas; una lista truncada se informa. No poder encontrar un responsable no habilita inventar un ID. La comprobación final de la actividad y del responsable activo ocurre dentro de la transacción de la obra. La vista anticipa el bloqueo por obra o suscripción no escribibles, sin sustituir las comprobaciones del guardado.

## Reutilización, identidad y auditoría
Se extrajo la creación transaccional del blocker desde createExecutionRecord a createProjectBlockerInTransaction. El formulario de ejecución y el puente desde WhatsApp llaman a esa misma función, conservando validación, auditoría y notificaciones. No hay un segundo inventario de restricciones ni un motor de compra paralelo.

El ID de la restricción y el recibo de origen se derivan de empresa, obra, conversación y mensaje. El mismo mensaje puede originar una restricción por este circuito. Repetir la solicitud, incluso desde otro operador autorizado, devuelve la existente si su contenido coincide; no la duplica ni reabre un registro resuelto. Un contenido distinto provoca conflicto y un registro eliminado no se recrea silenciosamente.

La fuente se vuelve a leer y su versión debe coincidir con la que revisó el administrador. Se conserva el texto original del mensaje. La auditoría de dominio registra la creación y un segundo evento vincula la fuente y sus huellas; no copia el texto crudo del mensaje al recibo. Ambos eventos y el registro forman parte de la misma transacción. Si falla la auditoría de procedencia, se revierte la creación.

Las prioridades alta y crítica usan la notificación IN_APP existente para miembros activos de la obra. No se envía un WhatsApp, correo o mensaje a un proveedor al pulsar el botón. La aplicación de una notificación no equivale a su lectura por una persona.

## Interfaz de seguimiento y resolución
La confirmación abre /dashboard/execution?blockerId=... en el módulo existente. El parámetro identifica un registro de la obra activa y falla con notFound si no está disponible; no busca en otro tenant. El registro muestra tarea, responsable, prioridad, estado y revisión, con enlace a consultar la actividad en el cronograma.

Se reemplazó el botón que resolvía de inmediato con un texto fijo por «Preparar resolución». Ahora el administrador escribe cómo se resolvió, confirma el efecto y envía esa explicación al mismo endpoint PATCH. La respuesta debe identificar el mismo registro, obra, estado, revisión y explicación antes de mostrarla como confirmada. Una respuesta incierta ofrece GET para consultar el estado sin reenviar automáticamente. La revisión optimista existente impide aplicar dos veces una resolución con la misma versión.

Los cambios de texto activan la protección de salida. Descartar pide confirmación. Al consultar una resolución ya registrada se muestra su resultado sin afirmar que acaba de ejecutarse de nuevo. Las tarjetas cerradas no ofrecen reapertura por este nuevo formulario; eso no modifica por sí solo todas las transiciones admitidas por APIs preexistentes.

Se mantuvieron los tokens Dark Obsidian y el contenedor de diálogo existente, con encabezado/acciones visibles y contenido desplazable en móvil. Se aclararon «blockers», «owner» y estados de cuadrilla en la pantalla de ejecución. Los detalles de la fuente sólo se muestran con los permisos del mensaje; el registro revisado tiene su propia autorización de ejecución.

## Pruebas y alcance comprobado
Las pruebas de dominio usan el servicio real, la validación de origen reutilizada, el creador transaccional y el actualizador de ejecución con un adaptador de base controlado. Cubren aislamiento de empresa/obra, fuente no elegible o cambiada, responsable inactivo, propiedad por cuadrilla, duplicados, retorno del registro ya resuelto, auditoría fallida, registro eliminado y consulta exacta. No equivalen a un ensayo de carga ni a carreras entre conexiones reales de PostgreSQL.

El verificador `scripts/verify-message-blocker-ui.mjs` monta InboxClient, ExecutionClient y ambos formularios reales con HTTP local sintético. Recorre el mensaje, preparación sin escritura, revisión explícita, respuesta perdida después de crear y reintento idéntico, enlace al registro, resolución explicada y respuesta perdida recuperada mediante GET. Comprueba que no se hace un segundo PATCH al consultar el estado, que un registro resuelto no vuelve a crearse y que la acción no aparece sin la capacidad requerida.

El diálogo y el seguimiento se verifican a 320/390/768/1280 píxeles. Las capturas están rotuladas como ensayo y contienen nombres/textos ficticios. Los resultados concretos de tests, lint, build, SHA y despliegue se registran en el PR #1 después de ejecutarlos. Un test controlado y un preview READY no acreditan recepción física de Meta, consentimiento de un cliente o migración de Production.

No se crearon trabajadores reales, empresas, mensajes, compras ni movimientos de inventario durante esta entrega. No se renovaron credenciales de Meta ni se habilitaron pagos. La conexión operativa física del piloto conserva su verificación independiente.

## Continuación del ciclo
La restricción recién creada aparece en los listados y conteos existentes de ProjectBlocker; la invalidación de campo permite refrescar el centro operativo. Registrar «faltan diez bolsas» no acredita una cantidad de stock ni emite una orden: presupuesto, materiales, compra y recepción deben usar sus dominios y aprobaciones propios. El vínculo al Gantt permite consultar la tarea sin cambiar sus porcentajes o fechas.

La procedencia se conserva en la auditoría y en la consulta desde el mensaje. No se agregó un enlace de lectura universal al WhatsApp original desde las tarjetas de ejecución: ese contenido continúa exigiendo permisos de conversación y evidencia. Compartir la tarjeta no concede dichos permisos.
