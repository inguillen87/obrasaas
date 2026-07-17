# Tareas operativas: contrato y proyección

## Autoridad durante la transición

`ProjectSnapshot.state.tasks` sigue siendo la autoridad de escritura y el contrato compatible del Gantt, reportes, supervisor y propuestas de avance. La tabla `Task` es una proyección relacional administrada para consumidores que necesitan consultas acotadas, especialmente WhatsApp Flows y el portfolio.

No se superponen filas `Task` sobre una lectura del snapshot. Esa mezcla produciría versiones partidas y permitiría que un cliente con un ETag válido reescribiera tareas de otra versión.

La proyección administrada se reconoce por dos condiciones simultáneas:

- `externalId = snapshot:<clave de state.tasks>`;
- `metadata.source = project-snapshot-v1`.

Las filas legacy o manuales de `Task` no se convierten, cuentan ni eliminan como parte de esta proyección.

## Escritura atómica

Cada camino productivo que puede cambiar tareas ejecuta `synchronizeProjectTaskProjection` dentro de la misma transacción y después de adquirir el advisory lock del proyecto:

1. edición del Gantt mediante `/api/state` y CAS de `ProjectSnapshot.version`;
2. mensajes del simulador;
3. mensajes reales procesados desde el webhook de Meta;
4. aprobación o rechazo de propuestas operativas;
5. reprogramación de la fecha inicial de la obra.

La sincronización relee las filas administradas, repara drift, elimina las que ya no existen y actualiza solo las que cambiaron. Si falla una operación de `Task`, no se confirma el snapshot, la propuesta, el mensaje ni su auditoría.

El mapeo actual es:

| Snapshot | Proyección `Task` |
| --- | --- |
| clave del catálogo | `metadata.snapshotTaskId` y `externalId` namespaced |
| `name` | `title` |
| `progress` | `progress` y estado derivado |
| `assignee` | `assignee` |
| `startDay` + `duration` | `startsAt` y `endsAt` relativas a `Project.startsAt` |
| tarea completa | `metadata.snapshot` |
| versión que modificó la tarea | `metadata.projectStateVersion` |

`DONE` corresponde a 100%, `BLOCKED` a una tarea demorada, `IN_PROGRESS` a 1-99% y `READY` a 0%.

## WhatsApp Flow

El Data Endpoint lista exclusivamente tareas proyectadas del `projectId` autenticado. La opción que ve Meta contiene solo un ID opaco y un título; la referencia real de la tarea no se acepta desde el formulario.

Al confirmar, el servidor vuelve a resolver la opción y agrega `task_ref` del lado confiable. Esa referencia queda en la asistencia o incidencia junto con `workArea`. Si dos tareas comparten nombre, el selector agrega un sufijo estable para que el trabajador pueda distinguirlas, pero la identidad continúa siendo la clave del snapshot.

Una tarea eliminada deja de ser una opción válida de inmediato. Un submit viejo falla cerrado en lugar de vincularse por nombre a otra tarea.

## Backfill y despliegue

La migración `20260717050000_project_task_projection`:

- se ejecuta en una transacción explícita;
- toma los mismos advisory locks por proyecto que el runtime;
- acepta valores numéricos históricos y los normaliza al contrato actual;
- es idempotente por `(projectId, externalId)`;
- elimina solo proyecciones administradas huérfanas;
- preserva filas legacy y manuales.

Secuencia de release:

1. verificar código y migración;
2. desplegar la nueva aplicación y promover el alias estable;
3. aplicar la migración con el runtime nuevo ya activo;
4. comparar snapshot y proyección por proyecto;
5. ejecutar smoke tests de portfolio y Flow.

La prueba `npm run verify:task-migration` usa tablas temporales dentro de una transacción Serializable y fuerza rollback. No modifica las tablas productivas.

## Siguiente fase

`Task` no debe declararse fuente canónica hasta que exista una API de tareas lossless con CAS propio o compartido, dependencias normalizadas y Gantt escribiendo esa API. Hasta entonces, toda nueva mutación de tareas debe entrar por los caminos transaccionales descritos arriba.
