# S3 - WBS y tareas canonicas

## Objetivo

El Gantt historico usaba `ProjectSnapshot.state.tasks` como autoridad. S3 agrega `Task` canonica con revision CAS, codigo WBS, jerarquia y `TaskDependency`; la proyeccion legacy se conserva para compatibilidad y no se mezcla con registros canonicos.

## Contrato

- Todas las lecturas y escrituras canonicas estan limitadas por `organizationId` y `projectId`.
- `revision` incrementa en cada actualizacion; una version vieja devuelve conflicto y nunca pisa cambios nuevos.
- `parentId`, predecessor y successor deben pertenecer al mismo proyecto mediante FK compuesta.
- Las dependencias admiten FS, SS, FF y SF con `lagDays` acotado; el servicio rechaza ciclos antes de persistir.
- Toda mutacion crea `AuditLog` con actor, obra, entidad y revision.
- El Gantt consume tareas canonicas cuando existen. Su alta, edicion y baja usan `/api/tasks` con CAS; el boton de vaciado legacy queda oculto en modo canonico para evitar dos fuentes de verdad.

## APIs

- `GET /api/tasks?cursor=&limit=`: lectura paginada y sin metadata interna.
- `POST /api/tasks`: crea una tarea WBS; requiere `org:tasks:manage`.
- `PATCH /api/tasks/:taskId`: actualiza con `expectedRevision`; requiere `org:tasks:manage`.
- `DELETE /api/tasks/:taskId`: elimina solo tareas sin subtareas; dependencias se eliminan por FK y queda auditoria.
- `POST /api/tasks/dependencies`: agrega dependencia y valida ciclo; requiere `org:tasks:manage`.

La UI nunca decide el alcance: la autorizacion, el proyecto y el estado de solo lectura se validan en servidor.

## Migracion y gates

`20260724110000_canonical_tasks_wbs` agrega enums, columnas, checks, indices y FK compuestas. La UI del Gantt ya usa CAS y la misma API en modo canónico; eso no demuestra todavía el cutover de una obra productiva. La migración debe probarse en PostgreSQL 17 con fixtures legacy y cada obra debe pasar el checklist de paridad/rollback de `OPERATIONAL_TASKS.md` antes de retirar su writer histórico.

S3 todavia no incluye baseline aprobada, calendario de recursos, progreso con evidencia ni costos. Esas piezas siguen en S5-S10 y deben referenciar `Task.id`, no nombres libres ni claves del snapshot.
