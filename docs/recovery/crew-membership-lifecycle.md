# S11.A11 — Integrantes y continuidad de las cuadrillas

Base: 7bdff7051f56404641a034e535fc292b0303e5c5. Fecha: 20/09/2026.

## Circuito implementado
La sección de ejecución tenía cuadrillas y asignaciones, pero sólo mostraba el conteo de todos sus vínculos históricos como «integrantes». Ahora permite consultar las participaciones vigentes, finalizadas y programadas de una cuadrilla, incorporar una persona activa ya registrada en la obra, cambiar su función interna y registrar el final de su participación sin borrar el historial.

La incorporación comienza en la hora del servidor; no admite retroactividad ni fechas elegidas por el cliente. Una participación programada por un circuito anterior se muestra en su filtro, pero no se edita anticipadamente por estas nuevas acciones. Las fechas se presentan en la zona horaria del dispositivo, indicada en la pantalla. Los conteos representan vínculos temporales en esa cuadrilla, no presentismo, capacidad disponible o cantidad de empleados activos de toda la empresa.

## Una sola fuente de datos
Se reutilizan WorkTeam, WorkTeamMember y Worker. El creador transaccional de miembros se extrajo de createExecutionRecord y la API legacy delega en él. No existe un segundo inventario de personas ni una tabla nueva. El formulario de alta de cuadrilla sigue siendo el existente; esta fase cierra el ciclo de sus integrantes.

La lectura de la cuadrilla y sus participaciones valida empresa/obra y utiliza RepeatableRead. Cada página devuelve hasta 50 participaciones con cursor por ID y filtro explícito; hasta 100 personas activas para seleccionar, indicando si la lista quedó truncada. No se devuelven teléfonos, DNI, salarios ni información médica. Los nombres y decisiones son datos privados del módulo de ejecución y conservan sus controles de acceso.

La incorporación exige permiso de gestión de ejecución y cabeceras de contexto comparadas con la sesión. Revalida cuadrilla, revisión, persona activa, estado de obra y suscripción dentro del bloqueo transaccional del proyecto. Se rechazan participaciones ya vigentes o programadas de esa persona en esa cuadrilla. No se bloquea su pertenencia a otra cuadrilla: resolver capacidad y solapamientos es una funcionalidad diferente y pendiente.

Un ID y un recibo deterministas por empresa/obra/cuadrilla/actor/intento conservan la idempotencia. Repetir el mismo intento devuelve el vínculo existente, incluso si finalizó; no lo reabre. Otro contenido con igual clave y una participación eliminada no se reparan silenciosamente. El registro y el recibo se crean en una transacción; si falla la auditoría no queda un alta sin documentar.

## Funciones internas y cierre
MEMBER se presenta como «Integrante» y LEAD como «Encargado de cuadrilla». Son funciones de organización del trabajo, no roles administrativos ni permisos del canal. Se pueden registrar varios encargados; no se implementó una regla de encargado único ni un cambio de permisos globales.

Cambiar la función o finalizar la participación exige revisión vigente, explicación y confirmación. La actualización y auditoría son atómicas. Cambiar función requiere persona/cuadrilla activas; finalizar permite cerrar el vínculo de una persona inactiva o cuadrilla archivada, siempre dentro de una obra y suscripción escribibles. El historial finalizado y las participaciones futuras no se reabren desde este circuito.

Finalizar no elimina al trabajador, no lo da de baja laboralmente, no cierra asignaciones a la cuadrilla, no modifica progreso, salarios o fichajes y no revoca ni concede permisos de WhatsApp. Esos dominios mantienen sus reglas. Una persona puede volver a incorporarse mediante un intento nuevo después de finalizar su vínculo anterior, que queda conservado.

## UX y recuperación
«Ver integrantes» abre un diálogo Dark Obsidian desde la tarjeta de la cuadrilla. Incorpora búsqueda local sobre las opciones autorizadas, filtros de vigencia/historial, navegación de páginas, función interna visible y la consulta de la última decisión para cada participación. La tarjeta inicial distingue participaciones registradas de una vigencia consultada; no llama «activos» a todos los registros históricos.

Preparar o consultar no escribe. Antes de confirmar se explica el efecto y lo que no cambia. Un alta con respuesta perdida conserva la misma clave/cuerpo para verificar el intento. Un cambio de función o finalización con respuesta incierta se recupera mediante GET antes de enviar otra escritura. Una revisión anterior no aplica dos veces el cambio.

Un payload incompleto, ambiguo o de otra cuadrilla/obra no se muestra como éxito ni como un roster vacío saludable. El diálogo retira datos ante una consulta no verificable. La explicación del cambio se conserva ante un fallo; salir exige confirmación. Los formularios sólo viven en esa pantalla: no se guardan borradores offline ni se agregan reenvíos automáticos. La ventana se remonta por contexto y cuadrilla y cancela consultas pendientes al cerrarse.

## Verificación
Los tests de dominio ejecutan el servicio, normalizadores y creador reales con un adaptador de PostgreSQL controlado: scope, roles exactos, revisiones, duplicados, programación histórica, replay, rollback, finalización y read-only. Los handlers se prueban con sesión/permisos controlados para rechazar contexto/origen/consultas no admitidos antes del acceso a la base.

`verify-crew-roster-ui.mjs` monta ExecutionClient y los componentes reales con servidor HTTP local y personas ficticias. Recorre lectura sin escritura, incorporación explícita, descarte cancelado, respuesta perdida después de guardar y repetición idéntica, cambio de función, finalización con respuesta perdida y recuperación GET sin repetir PATCH, historial después de recargar y rechazo de contexto ajeno. Revisa móvil/escritorio a 320/390/768/1280 píxeles. La evidencia de suite/lint/build y del despliegue se registra por SHA en el PR #1.

Este ensayo no da de alta personas reales, no prueba concurrencia entre conexiones reales de PostgreSQL y no envía WhatsApp. No se modifican dependencias o migraciones ni se presume que un Preview sea Production. La configuración live y la respuesta física del canal mantienen sus comprobaciones independientes.

## Siguiente prioridad
Capacidad y conflictos de planificación requieren períodos, carga y reglas explícitas. Los nombres de cuadrillas y sus integrantes no bastan para inferir disponibilidad o ampliar jornadas; no agregar porcentajes de productividad ni decisiones laborales automáticas a partir de estas participaciones.
