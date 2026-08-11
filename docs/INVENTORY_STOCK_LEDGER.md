# Ledger de existencias y puesta en stock

## Alcance de S12.2A

S12.2A convierte una inspección de recepción vigente en existencia física
`on-hand` mediante una acción explícita, tenant-scoped y auditable. No confunde
estos estados:

| Estado | Significado | Autoridad |
| --- | --- | --- |
| Recibido | Hay remito POSTED y cantidad registrada contra una OC | `GoodsReceipt` |
| Aceptado | La inspección física/documental clasificó una cantidad como `ACCEPTED` en una ubicación | `GoodsReceiptInspection` vigente |
| En existencia | Un putaway explícito creó asientos positivos en el ledger | `InventoryLedgerEntry` |
| Requerido por una tarea | Una revisión S12.2B declara material y cantidad | `TaskMaterialRequirementRevision`; DB/build verificado en Preview, no cambia el ledger |
| Reservado/disponible para una tarea | Toda la BOM vigente tiene una reserva exacta sobre stock coherente | [Ledger S12.2C](./TASK_MATERIAL_RESERVATIONS.md); gate técnico y boundary multirrol verificados en Preview, journey exitoso pendiente |

Una foto, un email, un compromiso `FULFILL`, una descripción parecida o una
fecha cercana nunca crean stock ni identidad de material.

Un `SupplierCommitment` es **PROMESA, NO RESERVA**. Su fecha o cantidad no
reduce `InventoryBalance`, no asigna existencia a una tarea y no demuestra que
una BOM esté cubierta.

## Autoridades canónicas

- `InventoryItem`: identidad de material por obra, código único y unidad base
  contractual. La unidad conserva exactamente la escritura de la línea de OC;
  no hay conversión implícita.
- `PurchaseOrderLineInventoryBinding`: vínculo append-only entre una línea de
  compra y un material canónico. Una línea no puede cambiar de identidad después
  de generar movimiento.
- `InventoryTransaction`: cabecera inmutable `RECEIPT_PUTAWAY` o `REVERSAL`, con
  actor, hora servidor, idempotency key y fingerprint.
- `InventoryLedgerEntry`: asientos exactos `Decimal(14,3)`; cada putaway incluye
  todas y sólo las disposiciones `ACCEPTED` del head vigente.
- `InventoryBalance`: proyección mantenida por PostgreSQL. La aplicación no puede
  editarla como una segunda fuente de verdad.

El JSON legacy `stockpiles` no se backfillea ni se interpreta como ledger. Su
retiro requiere un cutover separado después de ofrecer lectura y workflows
equivalentes.

## Flujo operativo

1. El remito se registra como `POSTED` y se concilia explícitamente con el
   compromiso; no se usa FIFO.
2. La inspección vigente particiona exactamente cada cantidad en `ACCEPTED`,
   `DAMAGED`, `REJECTED` o `QUARANTINED` y fija una ubicación.
3. El usuario con `org:inventory:manage` selecciona un material de la misma
   unidad para cada línea aceptada o crea su identidad canónica.
4. Un único POST registra todo el conjunto aceptado. Cantidad, ubicación,
   snapshots y alcance se derivan en servidor; el cliente no los envía.
5. PostgreSQL valida el conjunto completo al cierre de la transacción y actualiza
   `InventoryBalance` bajo locks de proyecto y material/ubicación.
6. Para corregir o revertir esa inspección hay que revertir antes el putaway.
   La reversión crea el espejo negativo exacto y falla si dejaría stock negativo.
7. Un putaway revertido no se reutiliza: una nueva entrada exige una nueva versión
   de inspección, preservando toda la historia.

## Contratos de API

### Catálogo

- `GET /api/inventory-items?active=true`
- `GET /api/inventory-items?active=all&limit=100&cursor=...` para recorrer
  activos e inactivos mediante keyset opaco `(code,id)`, sin offsets ni scope
  aportado por el cliente;
- `POST /api/inventory-items`
- permiso de lectura: `org:inventory:read`
- permiso de escritura: `org:inventory:manage`
- scope, actor e idempotencia son server-owned.

El POST admite exactamente `code`, `name` y `baseUnit`. La UI toma `baseUnit`
de la línea de compra elegida y el servidor preserva su caso y espacios internos.
Si la carga inicial del ledger falla, la inspección permanece bloqueada y ofrece
un reintento autoritativo dentro del panel; nunca habilita la edición por asumir
que no existe un putaway.

### Putaway y reversión

- `GET /api/inventory-transactions?sourceInspectionId=...`
- `POST /api/inventory-transactions`

Putaway:

```json
{
  "kind": "RECEIPT_PUTAWAY",
  "sourceInspectionId": "inspection-id",
  "bindings": [
    {
      "purchaseOrderLineId": "purchase-line-id",
      "inventoryItemId": "inventory-item-id"
    }
  ]
}
```

Reversión:

```json
{
  "kind": "REVERSAL",
  "reversesTransactionId": "putaway-id",
  "reason": "Motivo auditado"
}
```

No existen campos cliente para cantidad, ubicación, tenant, proyecto, actor,
saldo ni timestamps. Cada mutación exige `Idempotency-Key`; un replay con otro
contenido falla cerrado.

## Defensas de base de datos

La migración `20260802170000_inventory_stock_ledger` agrega:

- FKs compuestos de tenant/obra y acciones `RESTRICT`;
- límite de materiales activos bajo advisory lock;
- shape checks por tipo de transacción y asiento;
- rechazo explícito de cero, negativos impropios y `NUMERIC NaN`;
- tablas históricas append-only y protección contra `TRUNCATE`, con triggers
  `ENABLE ALWAYS`;
- verificación diferida de completitud/biyectividad del bundle;
- fence inspección → putaway → reversión;
- balance no negativo y proyección DB-owned;
- ausencia deliberada de backfill inferido.

El verificador dedicado comprueba checksum aplicado, catálogo PostgreSQL,
constraints, índices, funciones/triggers y smokes rollback-only.

## Evidencia de validación de S12.2A

El commit `4760a50` pasó `2003/2003` pruebas, lint, build, validación Prisma y
audit local. El deployment `dpl_8rwZw537MiYbRsPNuvYniTg4NQcP` llegó a `Ready`,
detectó 115 migraciones, aplicó `20260802170000_inventory_stock_ledger` y ejecutó
el verificador dedicado sobre la base Preview. Los smokes sin sesión sobre la URL
inmutable y el alias no mostraron respuestas `5xx`.

El corte reproducible está en [evidencia Preview `4760a50`](./evidence/2026-08-02-preview-4760a50.md).
La validación remota de este corte S12.2A no sustituye el recorrido UI
autenticado por rol, que sigue pendiente, ni acredita Resend, Meta, S12.2B,
reservas o Production. La evidencia separada de S12.2B se registra más abajo.
Production no fue modificada.

## Relación con S12.2B y S12.2C

La [BOM versionada por tarea](./TASK_MATERIAL_REQUIREMENTS.md) existe mediante
`TaskMaterialRequirementRevision` y `TaskMaterialRequirementLine`. Publica
snapshots inmutables del material, unidad y cantidad requerida, o declara
explícitamente `NO_MATERIALS_REQUIRED`.

S12.2B no escribe `InventoryLedgerEntry` ni `InventoryBalance`, no consume
existencia y no crea reservas. Sus migraciones, verificador y build tienen
[evidencia Neon/Vercel Preview](./evidence/2026-08-09-preview-054a82c.md).

[S12.2C](./TASK_MATERIAL_RESERVATIONS.md) agrega una autoridad separada de
reserva: `InventoryAvailability` proyecta `onHand`, `reserved` y `available`, y
un ledger append-only reserva o libera toda la revisión de BOM. No modifica el
`onHand`; además, la reversión del ledger físico falla si intentara dejarlo por
debajo de lo reservado. La migración 120, sus carreras PostgreSQL y el gate
rollback-only de Neon tienen [evidencia del commit
`fc71fbe`](./evidence/2026-08-11-preview-fc71fbe.md). El mismo corte comprobó
boundaries de tres roles y rechazo seguro; todavía falta materializar una
reserva/liberación válida y probar negativos cross-tenant.

## Próximos cortes

- **S12.2B/S12.2C - gates técnicos y boundary multirrol en Preview:** recorrer
  publicación de BOM y reserva/liberación válida, completar el rol restante y
  negativos cross-tenant; el smoke actual acredita sesión y permisos, no éxito
  funcional del flujo de materiales.
- **S12.2D:** consumo, devolución, transferencia y ajuste aprobable; readiness
  derivado sin mutar automáticamente `Task.status`.
- **Hardening de volumen:** antes de habilitar consumos masivos, agrupar la
  proyección por sentencia/clave de stock y probar carreras con dos conexiones
  PostgreSQL reales; el diseño row-level actual es correcto, pero prioriza
  claridad e invariantes por encima del costo en lotes grandes.
- **Hardening de idempotencia del catálogo:** antes de aplicar retención o
  limpieza sobre `AuditLog`, mover la operación/fingerprint de creación de
  materiales a un fence tipado y único por obra. Hoy el lock de proyecto y la
  transacción evitan duplicados, pero el replay no debe depender para siempre
  de conservar el log genérico.
- **Cutover legacy:** convertir el panel `stockpiles` en sólo lectura y finalmente
  retirarlo cuando el ledger cubra paridad, migración explícita y rollback.

`onHand` continúa significando sólo existencia física. `AVAILABLE` puede
derivarse ahora únicamente cuando la BOM vigente queda completamente reservada;
no es promesa de abastecimiento, ejecutabilidad de la tarea, consumo,
certificación ni pago. No existen todavía sustitución, reserva parcial o FIFO.
