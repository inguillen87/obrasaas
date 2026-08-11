# S9.2-MED · Corte técnico quincenal reproducible

## Estado y límite

S9.2-MED sella por organización, obra y quincena civil cerrada una versión
inmutable de la composición técnica aprobada en S9.1. El candidato se deriva
íntegramente en PostgreSQL: el cliente no envía tareas, mediciones, cantidades
ni hashes de línea.

El corte es interno y técnico. No es un certificado contractual, una valuación,
una aprobación de cliente, un PDF publicable ni una instrucción de pago. No
contiene precios, moneda, impuestos, retenciones, ajustes, importe certificado,
conformidad financiera ni estado de pago. Tampoco modifica `Task.progress`, la
baseline, el forecast, el presupuesto, una factura o una cuenta por pagar.

S10 deberá crear autoridades y reglas contractuales/económicas propias. Puede
consumir un corte técnico sellado, pero no convertir su head o su estado en un
certificado por equivalencia implícita.

## Autoridades de datos

- `Task` aporta todas las tareas canónicas `TASK` de la obra, identificadas por
  `metadata.source = canonical-task-v1`. Un corte nunca se trunca: si supera
  5000 tareas, falla cerrado.
- `TaskProgressMeasurementHead`, `TaskProgressMeasurement` y
  `TaskProgressMeasurementDecision` aportan exclusivamente la medición S9.1
  aprobada vigente para la tarea y el período.
- `ProjectProgressMeasurementCutHead` es la proyección CAS por obra/quincena;
  apunta a la versión vigente y conserva su revisión.
- `ProjectProgressMeasurementCut` guarda cada versión append-only, su
  predecesora, conteos, actor, hashes y recibo idempotente.
- `ProjectProgressMeasurementCutLine` congela cada tarea, su revisión y su
  estado técnico en esa versión.

Organización, obra y actor son server-owned. El cliente elige una fecha civil,
pero el servidor la normaliza a una quincena canónica cerrada y rechaza cualquier
forma o alcance alternativos. Una membresía global o un superadministrador sin
membresía activa en el tenant no sustituyen la autoridad de la obra.

## Período y candidato

El período usa `CALENDAR_FORTNIGHT_V1`:

- primera quincena: día 1 al 15;
- segunda quincena: día 16 al último día civil del mes;
- la zona horaria de la organización determina si la quincena ya cerró;
- sólo se puede leer o sellar un período cuyo fin sea anterior al día civil
  actual del tenant.

La lectura construye una sola composición ordenada por ID de tarea. Cada tarea
canónica produce exactamente una línea:

- `MEASURED`: congela la medición aprobada vigente, unidad, cantidad base,
  cantidad del período, acumulado, método, fundamento, revisión, conteo/hash de
  evidencia y decisión aprobatoria;
- `MISSING`: congela la ausencia de una medición aprobada y el snapshot de la
  tarea. No persiste una cantidad cero ni un porcentaje cero.

Un candidato no se puede sellar si hay una medición pendiente de decisión o si
ninguna tarea tiene medición aprobada. Una obra archivada puede conservar su
historial, pero no crear una versión nueva.

El readiness es server-owned: `REVIEW_PENDING` indica una decisión S9.1
pendiente; `EMPTY`, ninguna medición aprobada; `READY`, un primer candidato
listo para sellado; `UP_TO_DATE`, composición idéntica a la versión vigente; y `STALE`,
composición nueva que exige otra versión.

## Integridad, versiones y correcciones

Cada línea tiene `lineSnapshotSha256`. El candidato tiene un hash de la lista
ordenada de tarea + hash de línea; el corte persistido agrega versión,
predecesor, actor y timestamp UTC a su digest de integridad. La serialización de
fechas y Decimals es canónica y no depende de `TimeZone` o `DateStyle` de la
sesión.

El primer sellado crea la versión 1. Si una corrección S9.1 o una revisión de
tarea cambia la composición, la lectura devuelve `STALE`; un sellado autorizado
crea la versión siguiente y enlaza el predecesor. La versión anterior, sus
líneas y hashes no se actualizan ni eliminan. Si la composición no cambió, el
servidor rechaza crear una versión redundante.

## Idempotencia y concurrencia

`POST /api/progress-measurement-cuts` exige:

- `Idempotency-Key` estable;
- `periodDate`;
- `expectedHeadCutId`, incluido `null` para la primera versión;
- `expectedCandidateToken` devuelto por el GET autoritativo.

El fingerprint liga operación, tenant, obra, actor, período y ambos CAS. Un
replay exacto devuelve el recibo original; reutilizar la clave con otro comando
falla con conflicto. El seal adquiere locks en orden operación →
obra/período → proyecciones y revalida membresía, proyecto, head y candidato
dentro de la misma transacción.

Dos selladores sobre el mismo candidato no crean dos versiones. Una corrección
o archivado concurrentes invalidan la operación observada y obligan a releer. La
UI conserva una sola clave/body ante una respuesta ambigua, concilia primero
con GET y nunca fabrica una nueva mutación automática.

## Frontera de escritura PostgreSQL

La superficie pública invoca `obrasaas_progress_measurement_cut_seal`, que
inserta en la vista de comando `ObrasaasProgressMeasurementCutSealCommand`. Su
trigger `INSTEAD OF` ejecuta el worker gobernado; el worker no se puede invocar
directamente en el nivel superior.

Los guards de Cut, Line y Head están `ENABLE ALWAYS`, verifican profundidad y
scope exactos y rechazan DML directo, update/delete y truncate. El modo replica
no genera hechos: al omitir el trigger ordinario de la vista sólo puede devolver
una fila virtual/null sin recibo válido, y Cut/Line/Head permanecen sin cambios.
Este contrato cubre DML de la aplicación; un propietario con capacidad DDL para
alterar funciones o deshabilitar triggers queda fuera de esa frontera y exige
gobierno operativo separado.

## Roles

| Rol | Leer | Sellar |
| --- | --- | --- |
| Administrador | Sí | Sí, con membresía activa |
| Director de obra | Sí | Sí, con membresía activa |
| Jefe de obra | Sí | No |
| Administración | Sí | No |
| Auditor | Sí | No |

La API aplica el permiso antes de parsear o acceder a persistencia, vuelve a
validar el rol dentro de PostgreSQL y nunca acepta tenant u obra desde URL/body.

## API y experiencia

- `GET /api/progress-measurement-cuts?periodDate=YYYY-MM-DD`: snapshot privado,
  no cacheable y autoritativo del candidato, head, último corte y readiness.
- `POST /api/progress-measurement-cuts`: seal estricto con body máximo de 16 KiB,
  idempotencia y doble CAS.
- `/dashboard/measurements`: pestaña semántica **Corte técnico**, montada para
  no perder una operación incierta al navegar; abre la última quincena cerrada,
  compara candidato/versión y muestra ausencias de forma explícita.

No hay actualización optimista del head. Cambiar de período, ocultar la pestaña
o recibir un GET viejo no puede reemplazar el snapshot autoritativo de otra
quincena. Los estados de carga/error/vacío, teclado, labels y layout móvil están
cubiertos por contratos dedicados.

## Estado verificado al 11 de agosto de 2026

El commit `cc5aa2190cfac278db77a933b09ecdd89c5d68e5` pasó CI 3/3. PostgreSQL 17
aplicó 123 migraciones y verificó rollback, replay exacto/mutado, dos selladores,
corrección y archivado concurrentes, cleanup exacto, `migrate status` al día y
drift `No difference detected.` La suite aprobó 2347/2347, lint, auditoría de
producción sin vulnerabilidades, build Next.js 16.2.11 de 90/90 páginas y
Browser público 2/2.

El deployment Preview inmutable `dpl_4p2bcbwyznb4afZ8XetL2GrZWF51` quedó
`READY` con 123 migraciones sin pendientes y el verificador S9.2 rollback-only
con `PROGRESS_MEASUREMENT_CUTS_DISPOSABLE_CONCURRENCY=0`. El build cerró 90/90,
los cuatro smokes públicos dieron `200` y en los ocho eventos runtime exactos
observados no hubo `error`, `fatal` ni `5xx`. La [evidencia exacta](./evidence/2026-08-11-preview-cc5aa21.md)
no acredita un journey autenticado, un POST S9.2 en Preview, un alias estable ni
Production.

## Residual y siguiente fase

- Pendiente: recorrer GET → seal → replay → corrección → nueva versión con
  actores autenticados y datos sintéticos de Preview, incluyendo roles de
  lectura y negativos cross-tenant.
- Pendiente S10: modelo contractual/económico, estados y aprobadores propios,
  retenciones/ajustes/impuestos, PDF/hash reproducible, publicación privada e
  historial; el pago continúa separado.
- Fuera del corte: alias, Production, clientes/trabajadores reales, Meta E2E y
  cualquier afirmación legal, contable o fiscal.

## Criterio de salida técnico

S9.2-MED queda cerrado como gate técnico porque pasaron:

- contrato Prisma/migración, relaciones tenant-scoped y guards append-only;
- candidato completo `MEASURED`/`MISSING`, sin convertir ausencia en cero;
- período civil cerrado, timezone del tenant y obra archivada fail-closed;
- idempotencia, replay exacto/mutado, doble CAS y versión sin reescritura;
- carreras de dos selladores, corrección y archivado con cleanup exacto;
- prueba de no mutación de `Task.progress`, dinero, certificado o pago;
- RBAC, contrato API/UI, estados inciertos, accesibilidad y mobile;
- suite, lint, audit, build, PostgreSQL 17 sin drift y Preview exact-SHA.

El journey autenticado pendiente es un gate funcional posterior y debe seguir
declarado como tal; no invalida el cierre técnico ni permite presentar S9.2 como
certificación o Production.
