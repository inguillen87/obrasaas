# Tareas operativas: autoridad canónica y compatibilidad

Fecha de corte: 2026-07-26

## Dos modos explícitos, nunca una mezcla

Las obras nuevas o migradas a WBS usan filas `Task` con `metadata.source = canonical-task-v1` como autoridad de tareas. El Gantt, ejecución, evidencia, trabajo extra, Inbox y selectores de WhatsApp deben referenciar su `Task.id` opaco.

Las obras históricas pueden conservar temporalmente `ProjectSnapshot.state.tasks`. Su proyección compatible usa `metadata.source = project-snapshot-v1` y `externalId` namespaced. Esas filas no se presentan como WBS canónica y no se mezclan con las canónicas en una misma lectura o mutación.

Regla de modo:

- si una obra tiene tareas `canonical-task-v1`, el Gantt lee y escribe exclusivamente `/api/tasks` y `/api/tasks/:taskId` con CAS;
- si todavía no las tiene, el Gantt puede leer el snapshot/proyección legacy hasta ejecutar un cutover verificado;
- ninguna operación convierte una fila por nombre ni superpone ambos conjuntos;
- una referencia de Meta/Flow se vuelve a resolver dentro del `projectId`; nunca se acepta un nombre cliente como identidad.

## Contrato canónico

`Task` y `TaskDependency` aportan:

- alcance compuesto por proyecto y FK tenant-safe;
- `revision` CAS por tarea;
- código WBS, jerarquía, tipo tarea/hito, estado y progreso entero 0-100;
- inicio/fin absolutos y dependencias FS/SS/FF/SF con `lagDays`;
- rechazo de ciclos antes de persistir;
- auditoría de alta, edición, dependencia y baja;
- política de obra operativa: una obra finalizada/archivada queda sólo lectura.

Las APIs productivas son:

- `GET/POST /api/tasks`;
- `PATCH/DELETE /api/tasks/:taskId`;
- `POST /api/tasks/dependencies`.

El Gantt canónico usa esas APIs y no llama `/api/state` para editar tareas. Evidencia, blockers, asignaciones y extras usan `Task.id`, no claves de snapshot ni nombres libres.

## Compatibilidad legacy

Los caminos que todavía modifican un `ProjectSnapshot` llaman `synchronizeProjectTaskProjection` dentro de la misma transacción y bajo el advisory lock de la obra. La proyección `project-snapshot-v1` existe para que consumidores históricos mantengan consistencia mientras se retiran, no para crear una segunda autoridad.

El mapeo legacy conserva:

| Snapshot | Proyección compatible |
| --- | --- |
| clave de `state.tasks` | `metadata.snapshotTaskId` + `externalId` namespaced |
| `name` | `title` |
| `progress` | `progress` y estado derivado |
| `assignee` | `assignee` libre temporal |
| `startDay` + `duration` | `startsAt`/`endsAt` relativas a la obra |
| objeto completo | `metadata.snapshot` para reconciliación |

Un comando de avance por texto/audio ya no debe mutar ese snapshot directamente: crea `OperationalProposal` con precondición e idempotencia. La foto se convierte en `ProgressEvidence` y cualquier evaluación visual queda separada de la mutación del plan.

## Cutover por obra

El cutover no se infiere por deploy. Requiere:

1. congelar o serializar escrituras de la obra;
2. expandir `state.tasks` a WBS/tareas/dependencias canónicas con IDs nuevos y mapa auditable;
3. comparar títulos, fechas, progreso, responsables y dependencias;
4. cambiar Gantt y consumidores al modo canónico;
5. ejecutar smoke de Gantt, Flow, propuesta, evidencia, reporte y rollback;
6. retirar el writer legacy sólo después de demostrar cero drift.

La migración `20260724110000_canonical_tasks_wbs` crea el contrato relacional y su verificador; no fabrica una baseline aprobada ni autoriza por sí sola el cutover de Production.

## Baseline y forecast: alcance entregado y límites vigentes

`Task.startsAt/endsAt` representan el plan canónico vigente. Sobre la WBS canónica ya existen baseline inmutable/versionada, snapshots auditados, CAS/idempotencia y forecast determinista con dependencias FS/SS/FF/SF, lag y fechas civiles reproducibles. Una tarea creada antes de que la obra tenga fecha de inicio persiste `metadata.schedule` (`PROJECT_START`, `startDay`, duración); cuando se define o cambia el calendario, se rehidrata atómicamente sin perder su intención relativa.

Esto no habilita por sí solo cambios contractuales:

- la publicación de baseline y los cortes de forecast requieren sus operaciones auditadas; el smoke UI final en Preview sigue pendiente;
- `VisualProgressAssessment.baselineHash` detecta cambios del plan, pero la revisión visual no publica baseline ni crea forecast automáticamente;
- revisar una foto no modifica el Gantt, certifica avance ni habilita pagos;
- el cutover legacy, equipos/responsables por ID, blockers y change control aprobado siguen siendo verticales separados.

Presupuesto, medición, certificación y pago deben referenciar la misma WBS, pero conservan estados y aprobaciones separados.

## Reservas de archivos privados

Las cargas iniciadas desde dashboard usan una reserva `ProtectedUpload`: el navegador sólo recibe un `uploadId`; caja, recepción de bienes, facturas de proveedor y evidencia de progreso reclaman esa reserva mediante CAS dentro de la misma transacción que crea el registro. La identidad de storage se construye y valida únicamente en servidor. Los registros anteriores y la ingesta autorizada desde WhatsApp conservan su ruta compatible.

Antes de escribir en Vercel Blob o Cloudinary se persiste un intent
`UPLOADING` con proveedor e identidad esperada fijados, fingerprint, lease y
cuotas por actor/obra/organización. La llamada externa tiene timeout menor que
el lease; un reintento conserva la misma clave, proveedor e identidad. Un
descriptor devuelto fuera del prefijo nunca se elimina ni se adopta. Sólo una
respuesta que coincide con la identidad reservada puede pasar a `AVAILABLE`.

La eliminación usa `DELETE_PENDING` antes de contactar al proveedor, lease
propio, backoff y tombstone `DELETED`. El proyecto tiene FK `RESTRICT` mientras
exista la identidad de storage, para que un cascade no borre la única referencia
necesaria para limpiar el objeto. La política final de retención/purga de esos
tombstones sigue pendiente y debe preceder cualquier borrado físico de obra.

`GET /api/cron/protected-uploads` reserva y elimina en cupos separados de hasta
100 objetos por lote y drena hasta 10 lotes dentro de un presupuesto total de
45 segundos. Autentica `Bearer CRON_SECRET` y sólo devuelve métricas agregadas. Un fallo de
borrado produce HTTP 503; un backlog sin fallas conserva HTTP 200 pero marca
`status=degraded`. `vercel.json` lo agenda una vez al día a las `03:17 UTC`, una
frecuencia compatible con Hobby. Vercel Cron sólo programa Production: en
Preview el smoke debe invocarse manualmente con el secreto del ambiente. Código
y agenda locales no demuestran que el cron esté activo hasta desplegar y
observar al menos una ejecución real.

Las rutas serverless aceptan hoy como máximo `4 MiB` por archivo para permanecer
debajo del límite de cuerpo de Vercel Functions. Videos o documentos mayores
requieren una futura carga directa al storage con autorización corta, checksum,
finalización server-side y la misma reserva; no corresponde aumentar el límite
de la ruta actual y asumir que Vercel la recibirá.
