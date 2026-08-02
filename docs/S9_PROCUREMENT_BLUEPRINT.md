# S9 · Compras, proveedores y recepción

## Objetivo

Convertir una necesidad de obra en una orden trazable, recibir materiales contra esa orden y reflejar el compromiso económico en el ledger sin duplicar costos.

## Modelo propuesto

- `Supplier`: proveedor por organización, datos fiscales, moneda preferida, estado y términos de pago.
- `PurchaseOrder`: orden por obra con número humano, proveedor, moneda, estado (`DRAFT`, `SUBMITTED`, `APPROVED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`) y revisión CAS.
- `PurchaseOrderLine`: descripción, unidad, cantidad solicitada, precio unitario, código de costo y tarea canónica opcional.
- `GoodsReceipt`: recepción parcial o total con usuario, fecha, evidencia privada y revisión.
- `GoodsReceiptLine`: cantidades recibidas por línea; nunca permitir recibir más que lo ordenado sin una excepción aprobada.
- `GoodsReceiptCommitmentAllocation`: conciliación append-only y explícita entre una línea recibida y una línea comprometida; no usa FIFO y no implica aceptación de calidad.

## Invariantes de nivel enterprise

1. Toda orden pertenece a una organización y obra; el proveedor debe estar habilitado para esa organización.
2. Solo una revisión aprobada crea un `COMMITMENT` idempotente en el ledger presupuestario.
3. Aprobar, cancelar y recibir usan `expectedRevision` y dejan auditoría.
4. La suma recibida no puede superar la cantidad ordenada salvo permiso explícito y motivo obligatorio.
5. Precio, moneda y código de costo quedan congelados en la orden; cambios posteriores son una nueva revisión.
6. Las evidencias de recepción son privadas, tienen hash y se entregan mediante un endpoint autenticado que vuelve a validar tenant, obra y permiso; el navegador no recibe una URL del proveedor.
7. Una recepción conciliada no entra a stock hasta que una inspección vigente particione exactamente aceptado, dañado, rechazado y cuarentena.
8. `AVAILABLE` requiere además ledger, reserva y BOM versionado por tarea; nunca se deriva sólo de un remito, foto o `FULFILL` administrativo.

## Entrega por sprint

- S9.1: Supplier + permisos + API CRUD acotada a organización.
- S9.2: PurchaseOrder versionada, líneas y aprobación CAS.
- S9.3: compromiso idempotente con `BudgetEntry`.
- S9.4: recepción parcial, evidencia privada y conciliación explícita de cantidades — implementado en Preview; inspección de calidad en curso.
- S9.5: UI operativa, exportación y métricas de órdenes abiertas/recepción pendiente.

## Criterios de aceptación

- Dos organizaciones no pueden leer ni modificar proveedores u órdenes entre sí.
- Reintentos de aprobación o compromiso no duplican registros.
- Una orden aprobada aparece en presupuesto como compromiso y una recepción no vuelve a comprometerla.
- Todas las transiciones críticas son auditables y concurrentes.
