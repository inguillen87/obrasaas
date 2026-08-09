# BOM versionada y requerimientos de materiales por tarea

## Estado de evidencia de S12.2B

Estado al 9 de agosto de 2026: **contrato PostgreSQL, migraciones 116+117,
verificador dedicado y build verificados en Neon/Vercel Preview**. El deployment
`054a82c` quedó `Ready` después de detectar 117 migraciones sin pendientes y
verificar conjuntamente `20260802180000_task_material_requirements` y
`20260809090000_task_material_requirement_eligibility_not_null`.

La [evidencia reproducible](./evidence/2026-08-09-preview-054a82c.md) acredita la
capa DB/build de S12.2B. No acredita journey UI/API autenticado por rol, reserva
de stock, email Resend real, Meta E2E ni operación productiva. No hubo deployment
ni migración en Production por este corte.

## Alcance y límite de autoridad

S12.2B permite que una persona autorizada publique una definición explícita,
versionada e inmutable de los materiales requeridos por una tarea canónica. La
revisión activa puede declarar uno de dos modos:

- `MATERIALS_REQUIRED`: una a 200 líneas de materiales canónicos activos, cada
  una con cantidad exacta `Decimal(14,3)` y nota opcional;
- `NO_MATERIALS_REQUIRED`: declaración explícita sin líneas, siempre acompañada
  por un motivo auditado.

No se infiere una BOM desde una orden de compra, una promesa de proveedor, una
descripción parecida, una foto, OCR, IA, email, recepción, existencia física ni
el JSON legacy de acopios. Tampoco se modifica automáticamente `Task.status`, el
Gantt, una baseline, un forecast, una certificación, un costo o un pago.

### Estados que deben permanecer separados

| Concepto | Autoridad actual | Qué prueba | Qué no prueba |
| --- | --- | --- | --- |
| Requerimiento de la tarea | `TaskMaterialRequirementRevision` y `TaskMaterialRequirementLine` | Qué material y cantidad exige una revisión de la tarea | Stock, compra, entrega o reserva |
| Promesa de proveedor | `SupplierCommitment` | Una fecha o ventana prometida para material o servicio | Asignación de stock o cobertura de la BOM; es **PROMESA, NO RESERVA** |
| Existencia física | `InventoryLedgerEntry` e `InventoryBalance` | Cantidad `on-hand` ingresada mediante putaway explícito | Disponibilidad para una tarea |
| Reserva y disponibilidad | S12.2C, todavía no implementado | Cantidad exacta reservada contra una revisión de BOM | No puede inferirse en S12.2B |

El read model de S12.2B sólo expone `NOT_DEFINED`, `NOT_REQUIRED`,
`REVIEW_REQUIRED` o `DEFINED_UNRESERVED`. Todos devuelven `available: false`.
`AVAILABLE` permanece cerrado hasta S12.2C.

## Modelo canónico e inmutabilidad

### `TaskMaterialRequirementRevision`

Cada publicación conserva:

- tenant, obra y tarea obtenidos del contexto autenticado;
- `version` y `predecessorId`, formando una única cadena lineal por tarea;
- modo, cantidad declarada de líneas, motivo, actor y hora servidor;
- snapshot de revisión, código, título y fechas de la tarea;
- `operationKey` y fingerprint del request para replay exacto.

La primera revisión es la única raíz y debe ser versión 1. Cada sucesora extiende
el head vigente exactamente en una versión. Una tarea con historial no puede
eliminarse ni perder su identidad canónica.

### `TaskMaterialRequirementLine`

Cada línea conserva el ID del `InventoryItem`, cantidad exacta y snapshots de
código, nombre y unidad contractual. La FK compuesta liga también
`unitSnapshot` con `InventoryItem.baseUnit`; no existe conversión implícita. Un
material puede aparecer una sola vez por revisión y debe estar activo y dentro
de la misma obra al publicar.

Si luego se inactiva un material, la historia no cambia: la revisión pasa a
`REVIEW_REQUIRED` y exige intervención humana para publicar una sucesora.

## Flujo operativo en Compras

1. El servidor entrega hasta 5.000 tareas canónicas completas. La UI las busca y
   pagina de a 100; si el resultado está truncado, bloquea apertura y edición en
   vez de operar sobre un catálogo incompleto.
2. Al abrir una tarea, la UI carga en paralelo y bajo demanda el head/historial,
   el catálogo completo de materiales activos y los compromisos de proveedor
   vinculados.
3. Un lector puede consultar la revisión activa, historial y contexto. Publicar
   exige conjuntamente `org:tasks:manage` y `org:inventory:manage`.
4. Las cantidades se mantienen como texto decimal exacto desde el input hasta el
   body; no pasan por `Number`, `parseFloat` ni `parseInt`.
5. El POST usa el `expectedActiveRevisionId` obtenido del head autoritativo. Un
   conflicto `409` obliga a recargar antes de construir otro intento.
6. La UI conserva la misma `Idempotency-Key` para el mismo payload hasta una
   respuesta exitosa. Un resultado ambiguo no genera reintento automático.
7. Cada publicación crea una revisión; el historial es sólo lectura y se recorre
   mediante cursor opaco ligado al tenant, obra y tarea.

Los compromisos se muestran únicamente como contexto con la leyenda **PROMESA,
NO RESERVA**. No se cruzan descripciones ni cantidades para afirmar que una
línea de BOM está cubierta.

## Contrato HTTP

### Lectura

`GET /api/tasks/{taskId}/material-requirements?limit=20&cursor=...`

- requiere `org:tasks:read` **y** `org:inventory:read`;
- `limit` admite 1 a 100 y vale 20 por defecto;
- el cursor es keyset, opaco y ligado al scope/tarea;
- devuelve la tarea, head autoritativo, readiness, historial y paginación;
- responde con `Cache-Control: private, no-store, max-age=0`.

### Publicación

`POST /api/tasks/{taskId}/material-requirements`

- requiere `org:tasks:manage` **y** `org:inventory:manage`;
- exige `Idempotency-Key` de 8 a 128 caracteres seguros;
- admite como máximo 128 KiB;
- tenant, obra, tarea de alcance y actor son server-owned.

Ejemplo con materiales:

```json
{
  "expectedActiveRevisionId": "current-revision-id",
  "kind": "MATERIALS_REQUIRED",
  "reason": "Ajuste conforme al replanteo aprobado",
  "lines": [
    {
      "inventoryItemId": "inventory-item-id",
      "quantity": "125.750",
      "notes": "Sector norte"
    }
  ]
}
```

Declaración explícita sin materiales:

```json
{
  "expectedActiveRevisionId": null,
  "kind": "NO_MATERIALS_REQUIRED",
  "reason": "Tarea administrativa sin consumo físico",
  "lines": []
}
```

No se aceptan campos de scope/actor ni cantidades JSON numéricas. Reutilizar una
clave con otro contenido falla cerrado.

## Defensas de base de datos

La migración local agrega:

- FKs compuestas tenant/obra/tarea y acciones `RESTRICT`;
- identidad canónica estructural: `Task.materialRequirementEligible` es una
  columna `GENERATED STORED`; la revisión sólo admite snapshot `true` y una FK
  triple impide borrar o descanonizar la tarea incluso ante escrituras SQL
  concurrentes, sin depender sólo de la visibilidad del trigger;
- lock transaccional por tarea y por material;
- validación DB del autor como membresía activa;
- snapshot autoritativo de tarea e inventario;
- raíz única, cadena lineal y extensión exclusiva del head;
- bundle diferido exacto: el modo y `lineCount` deben coincidir con las líneas;
- cantidad positiva, rechazo de `NUMERIC NaN` y máximo de 200 líneas;
- tablas append-only, protección contra `TRUNCATE` y triggers `ENABLE ALWAYS`;
- guardas que impiden borrar o descanonizar una tarea con historia;
- ausencia deliberada de backfill o inferencia desde fuentes existentes.

El script `scripts/verify-task-material-requirements-migration.mjs` está ligado al
checksum de la migración, ejecuta verificaciones de catálogo y comportamiento
rollback-only, y está incorporado al preflight de `scripts/vercel-build.mjs`.
Su presencia local no demuestra que ya haya corrido sobre Neon Preview.

## Relación con la ampliación solicitada por la socia

La necesidad de registrar cuándo llegará un material o cuándo debe ejecutarse un
servicio ya está representada por `SupplierCommitment` con ventana civil y
vínculo opcional a tarea/OC. La pantalla agrupa tareas y promesas en quincenas
reales **1-15** y **16-fin de mes**, y permite exportar un snapshot `.ics` de 90
días. El formulario configura por defecto el recordatorio siete días antes.

Esa base está verificada en Preview, con las limitaciones documentadas en
[Compromisos de proveedor y calendario quincenal](./SUPPLIER_COMMITMENTS_AND_FORTNIGHT_CALENDAR.md):
el `.ics` no es sincronización viva y el email real sigue cerrado hasta configurar
Resend, verificar dominio/remitente, observar cron/webhook y recorrer entrega,
bounce, complaint, supresión y fallas. Nada de ese circuito reserva materiales.

## Evidencia local y gates pendientes

La suite focal ejecutada en este corte cubre 27 casos en:

- `tests/task-material-requirements.test.js`;
- `tests/task-material-requirements-route.test.js`;
- `tests/task-material-requirements-migration-contract.test.js`;
- `tests/task-material-requirements-migration-verifier-contract.test.js`;
- `tests/task-material-requirements-ui.test.js`.

Estado de los gates:

1. **completo en Preview:** las 117 migraciones fueron detectadas sin pendientes
   en la base aislada;
2. **completo en Preview:** el verificador dedicado aprobó conjuntamente
   `20260802180000_task_material_requirements` y
   `20260809090000_task_material_requirement_eligibility_not_null`;
3. **completo en Preview:** el build del commit `054a82c` llegó a `Ready`;
4. **pendiente:** recorrer el panel y las APIs con roles de lectura y gestión,
   publicación, replay, conflicto, material inactivo,
   `NO_MATERIALS_REQUIRED` e historial;
5. **pendiente S12.2C:** conservar `available: false` hasta implementar y
   verificar reserva/liberación exacta;
6. **pendiente antes de Production:** promoción, rollback y evidencia específica
   de ese ambiente. Production no fue modificada por este corte.

## Siguiente corte: S12.2C

S12.2C debe agregar reserva/liberación exacta contra una revisión inmutable de
BOM, con cantidad reservada derivada del ledger, idempotencia, CAS, locks,
auditoría, concurrencia PostgreSQL real y regla explícita para sustituciones.
Sólo después podrá calcularse `AVAILABLE`; la reserva no debe mutar
automáticamente `Task.status`.
