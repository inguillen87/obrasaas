# S11.A16 — Agenda operativa de asignaciones

Base de implementación: `eaeaa1c6e5122ec45f4a67b7234eb40667ac6386`.

## Uso

En Ejecución, el tablero de asignaciones incorpora cuatro filtros de planificación: fin previsto vencido, período que incluye la fecha elegida, inicios dentro de los siete días siguientes y fechas incompletas/inconsistentes. Las tarjetas existentes conservan consulta, decisiones auditadas y reprogramación. No es otra fuente de asignaciones ni un calendario con registros ficticios.

La fecha inicial proviene de la zona horaria configurada en la empresa, resuelta en el servidor y enviada como texto. Se puede cambiar la referencia o pedir explícitamente la fecha actual de la empresa. Sin una zona válida no se toma silenciosamente la del dispositivo: se solicita una fecha manual. La referencia queda visible y no avanza sola ni refresca datos de otros usuarios.

Los períodos previstos son días civiles, almacenados canónicamente a medianoche UTC. No se convierten a la zona del navegador, lo que podría desplazar un día. Una fecha inválida, un fin sin inicio, un período invertido o un timestamp legacy con hora no se reclasifica silenciosamente: entra en revisión. Las fechas incompletas se distinguen de las inconsistentes.

## Alcance y límites

Se utiliza únicamente el listado autorizado ya recibido para la obra (o la actividad enfocada). La proyección comprueba además projectId antes de contar o mostrar; esto es defensa de interfaz, no una sustitución de la autorización del servidor. Los conteos se calculan antes de la búsqueda y el filtro de estado; el texto explica su alcance. Los estados finalizada/cancelada se conservan en Todas y no generan alertas de trabajo pendiente.

Un fin previsto vencido no demuestra atraso físico ni incumplimiento. Un período que incluye un día no prueba asistencia ni disponibilidad laboral. No se calculan porcentajes, dotación suficiente, carga horaria, salarios, pagos ni certificaciones. Los inicios a más de siete días siguen en Todas; no se ocultan definitivamente ni se mezclan con fechas ausentes.

Buscar admite código de actividad, palabras de actividad/persona/cuadrilla y acentos omitidos. Los índices de nombres se construyen una vez por selección, en lugar de buscar cada nombre repetidamente por fila. Los resultados vacíos tienen una acción de limpieza explícita.

Los cambios manuales de filtros/fecha/búsqueda consultan el guard existente de cambios sin guardar: no desmontan una tarjeta con borrador sin confirmación; una operación en curso impide el cambio. El guard no implementa almacenamiento offline o persistencia del borrador al cerrar la pestaña.

## Validación

`tests/assignment-agenda.test.js` comprueba fechas civiles, zonas horarias, límites inclusivos, períodos inconsistentes, estados cerrados, otra obra, búsqueda, orden estable y ausencia de mutación. `scripts/verify-assignment-agenda-ui.mjs` utiliza Board, controles y tarjetas React reales con registros de ensayo, comprueba filtros, referencia, borradores y lectura sin acciones, sin llamadas a API; no acredita sesión Clerk ni datos de un cliente real. Revisa 320/390/768/1280 px y conserva evidencia de navegador controlado.

Los verificadores previos de planificación, coincidencias y continuidad deben seguir pasando. La suite completa, lint y build del lockfile se ejecutan en CI antes del commit de entrega. SHA, pruebas reales y publicación se registran en el PR después de comprobarlos. Los workflows temporales de validación no se incluyen en la aplicación.

No hay nuevas tablas, migraciones, dependencias, endpoints o permisos. No se modifican lógica de escritura, Gantt, asistencia, datos de otros productos ni configuración productiva. La promoción a Production conserva sus controles separados. En esta intervención el equipo remoto no estaba disponible; no se modificó su worktree. Antes de continuar allí, verificar cambios propios y sincronizar la rama sin hacer reset sobre trabajo ajeno.
