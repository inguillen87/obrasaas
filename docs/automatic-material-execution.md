# Ejecución de materiales bajo mandato

Este incremento agrega un backend al endpoint autenticado existente
`POST /api/identity/field-operations`. No requiere una tabla ni una migración
nueva. Conserva `PROPOSE_CONSUMPTION` y `DECIDE_CONSUMPTION` para consumos que no
tienen un mandato vigente.

## Contrato de autorización

`ISSUE_EXECUTION_MANDATE` sólo admite una cuenta web ADMIN o DIRECTOR vigente,
distinta de la cuenta individual del trabajador. Identifica un trabajador con
participación, permiso de reporte y KYC ya aprobado; una tarea y su revisión;
un sector; el hash del catálogo; materiales con unidad exacta, cupo total y
máximo por reporte; y vencimiento UTC de hasta 30 días. Tiene versión 1 y
revisión 1. Cambiar sus términos requiere emitir otro mandato y revocar el
anterior. `REVOKE_EXECUTION_MANDATE` conserva los términos y consumos anteriores,
registra al revocante y pasa a revisión 2. Cualquier ADMIN o DIRECTOR autorizado
de la obra puede revocarlo. El mandato no concede KYC, membresía ni permisos.

Los dos comandos requieren `reason`. Sus payloads completos y exactos se
validan en `field-execution-policy.mjs`; no admiten actor ni saldos enviados por
el cliente. La lectura dirigida usa el mismo endpoint GET, con exactamente
`projectId`, `scope` y `executionMandateId`. Un responsable puede inspeccionar el
mandato; el trabajador sólo puede leer el mandato de su propia cuenta con sus
permisos y KYC vigentes. La lectura conserva una transacción read-only.

## Aplicación real desde un reporte

`REPORT_EXECUTION` informa `reportId` (UUID v4 estable del hecho), `mandateId` y
su revisión, trabajador, tarea y revisión actual, sector, catálogo, entre 1 y
20 líneas con `lineId`, material, unidad y cantidad decimal en texto, evidencia
y motivo. La revisión de tarea del mandato conserva el estado revisado al
autorizarlo; cada ejecución exige la revisión actual de la misma tarea. Esto
permite reportes sucesivos tras actualizar una medición autorizada.

La transacción canónica conserva primero los locks de identidad/membresía del
emisor, después el Project, el mandato y la tarea. Vuelve a comprobar el rol,
admisión y asignación del emisor cuando corresponde, además de la identidad,
participación, permiso y KYC del reportero. Exige vigencia según reloj de
PostgreSQL antes de escribir y después de guardar el recibo. Cada material
debe estar activo en el catálogo actual y mantener su unidad. Cantidades y
saldos usan enteros escalados a tres decimales; líneas del mismo material se
suman antes de verificar stock y cupos. No crea stock de apertura ni permite
saldo negativo.

En una sola transacción guarda el saldo de `Project.metadata.materialInventory`,
un movimiento OUT canónico `material.inventory.moved` por línea, el uso de
cupo, la ejecución `field.execution.applied` y el recibo
`field.operation.recorded`. Un error revierte todo. `AuditLog` conserva el
actor real del reporte, el emisor del mandato y su compromiso de términos;
ninguna ejecución sustituye la identidad del trabajador por la del aprobador.

El `operationId` del sobre identifica el intento HTTP y su recibo. El
`reportId` identifica el hecho dentro de organización, obra y trabajador,
independientemente del canal o del UUID de intento; cada `lineId` queda
namespaced por ese hecho. Repetir el mismo hecho con otro intento devuelve la
ejecución anterior sin otro débito. Cambiar cualquier hecho con el mismo
`reportId` produce conflicto. El cliente debe persistir y reutilizar el
`reportId` y sus líneas al reintentar: otro `reportId` se considera otro hecho,
no se deduplica por similitud de texto ni por cantidades. No debe usarse un
UUID nuevo para ocultar un resultado desconocido.

Una respuesta COMMIT perdida se recupera con el GET existente por `operationId`
y con el reenvío exacto del mismo comando. El reporte ya aplicado se puede
recuperar aun después de vencer o revocarse el mandato, con los permisos
actuales del reportero; eso no autoriza hechos nuevos. Los recibos conservan
la medición original y devuelven la tarea actual por separado.

## Avance de tarea y Gantt

El consumo de bolsas no determina un porcentaje. `progress: null` descuenta
materiales sin modificar la tarea. Para aplicar avance en esa misma ejecución,
el mandato debe incluir `definitionId`, `baseline`, unidad de metrado, cupo y
máximo por reporte, iguales a la configuración canónica de la tarea. El reporte
incluye el modo DELTA o CUMULATIVE y una cantidad exacta a cuatro decimales, con
evidencia de esa cuenta, tarea y sector que ya tenga decisión APPROVE. PENDING,
REJECT y evidencia ajena no autorizan avance. No se aprueba evidencia al
ejecutar materiales.

El resultado actualiza la cantidad acumulada y el porcentaje derivado de esa
base, conserva fechas y metadatos ajenos, y mantiene BLOCKED. Registra una
`OperationalProposal` TASK_PROGRESS ya APPLIED cuya fuente explícita es
`field-execution-v1`, con el mandato como autorización previa. La tarea
canónica consultada por el Gantt recibe el avance; no se replanifican fechas,
dependencias ni se infiere duración a partir del consumo.

## Alcance de verificación

Los tests `production-field-execution-policy.test.mjs` y
`production-field-execution-store.test.mjs` prueban política, store canónico y
HTTP. El fixture rápido modela transacciones serializadas: sus resultados no
demuestran locks de PostgreSQL. `verify-field-execution-postgres.mjs` prepara el
ensayo SQL descartable con credenciales sintéticas, sin fallback a DATABASE_URL.
Su ejecución real queda pendiente donde no hay PostgreSQL local disponible.

Este incremento no agrega formularios de mandatos ni un diálogo nuevo de
WhatsApp. El backend web sí admite los tres comandos. El planner de WhatsApp
existente conserva las propuestas manuales y no emite REPORT_EXECUTION; su
adaptador normal aún no reenvía el hook beforeProject necesario para ese
comando. Intentar usar ese adaptador sin el hook falla cerrado. Una futura
integración de canal debe persistir el mismo reportId/líneas y reenviar ese
hook por la resolución canónica de identidad, sin fabricar un actor.

No se ha aplicado ninguna migración ni se ha publicado este incremento.
