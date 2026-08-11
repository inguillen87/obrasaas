# Reserva exacta de materiales por tarea

## Estado de evidencia de S12.2C

Estado al 11 de agosto de 2026: **contrato PostgreSQL, dominio, API, panel de
Compras y gates técnicos verificados en CI PostgreSQL 17 y Vercel/Neon
Preview** para el commit
`fc71fbe6724d2215363e57b942869537208c0df8`.

La migración 120,
`20260810150000_task_material_reservations`, quedó sin pendientes ni drift. CI
ejecutó las carreras con dos conexiones sobre una base PostgreSQL 17
descartable; Vercel ejecutó el mismo verificador contra la conexión Preview en
modo `rollback-only`. La [evidencia reproducible](./evidence/2026-08-11-preview-fc71fbe.md)
identifica el run, los jobs y el deployment exactos.

El mismo artefacto acredita un smoke autenticado sintético acotado de
`AUDITOR`, `DIRECTOR` y `SITE_MANAGER`, incluido rechazo seguro de requests
inválidos. No acredita todavía una reserva/liberación exitosa con BOM y stock
sintéticos, una matriz completa de roles, negativos cross-tenant, un alias
estable, Meta real, trabajadores reales ni Production.

## Alcance funcional

S12.2C permite reservar toda la [BOM vigente de una tarea](./TASK_MATERIAL_REQUIREMENTS.md)
contra existencia física del [ledger de stock](./INVENTORY_STOCK_LEDGER.md) y
liberar luego esa reserva mediante un espejo exacto.

- `RESERVE` cubre **todas y sólo todas** las líneas de la revisión de BOM
  vigente. Cada línea debe sumar exactamente su cantidad requerida.
- Una línea puede distribuirse entre varias ubicaciones activas, pero cada par
  línea/ubicación aparece una sola vez y el bundle completo admite como máximo
  1.000 asignaciones.
- `RELEASE` revierte el bundle activo completo, con cada asiento negativo ligado
  a su asiento original. No existe liberación parcial.
- Las cantidades viajan como texto `Decimal(14,3)` positivo. No atraviesan
  aritmética binaria del navegador.
- Tenant, obra, tarea y actor provienen de la sesión; el cliente no puede
  aportarlos.
- La tarea debe ser canónica, de tipo `TASK`, conservar la revisión de la BOM y
  admitir cambios operativos. Una tarea `DONE` no admite una reserva nueva, pero
  sí permite liberar una reserva ya activa.

No se deriva una reserva desde una promesa de proveedor, una OC, un remito, una
foto, OCR, IA, email, descripción parecida ni proximidad de fecha. Un
`SupplierCommitment` continúa siendo **PROMESA, NO RESERVA**.

## Estados y significado estricto de `AVAILABLE`

| Estado | Significado |
| --- | --- |
| `NOT_DEFINED` | La tarea no tiene una revisión de materiales vigente. |
| `NOT_REQUIRED` | La revisión vigente declara explícitamente `NO_MATERIALS_REQUIRED`. |
| `DEFINED_UNRESERVED` | Hay BOM vigente y coherente, sin una reserva activa completa. |
| `AVAILABLE` | Todas las líneas de la BOM vigente tienen una reserva activa exacta sobre stock existente, con material, ubicación y proyecciones coherentes. |
| `REVIEW_REQUIRED` | La BOM, tarea, material, ubicación o reserva dejaron de cumplir una condición representable de disponibilidad; falla cerrado con `available: false`. |

`AVAILABLE` significa únicamente **material de la BOM actual completamente
reservado**. No significa que la tarea sea ejecutable: no comprueba dependencias
del Gantt, cuadrilla, equipos, permisos, seguridad, clima ni documentación.
Tampoco mide avance, certifica, aprueba costos, habilita pago ni modifica
`Task.status`.

Si un material o una ubicación se inactivan, la lectura pasa a
`REVIEW_REQUIRED` y la liberación permanece habilitada para recuperar el sistema
sin fabricar una reserva. Si `InventoryAvailability` deja de coincidir
físicamente con `InventoryBalance`, el borde HTTP rechaza el contrato corrupto y
nunca expone `AVAILABLE`; no maquilla ese drift como un estado sano.

## Autoridades canónicas

| Autoridad | Responsabilidad |
| --- | --- |
| `TaskMaterialReservationTransaction` | Cadena append-only alternada `RESERVE → RELEASE → RESERVE…`, con versión, predecesor, actor, motivo, idempotencia, fingerprint y hora servidor. |
| `TaskMaterialReservationEntry` | Asientos exactos por línea, material y ubicación; una liberación referencia y espeja el asiento reservado. |
| `TaskMaterialReservationBalance` | Proyección DB-owned de requerido y reservado por línea de la revisión. |
| `TaskMaterialActiveReservation` | Head activo que impide publicar otra BOM o cerrar la obra mientras exista la reserva. |
| `InventoryAvailability` | Proyección DB-owned por material/ubicación: `onHand`, `reserved` y `available = onHand - reserved`, con revisiones de ambos ledgers. |
| `InventoryBalance` | Autoridad de existencia física `onHand`; no se reemplaza por la reserva. |

Las tablas históricas son append-only, rechazan `TRUNCATE` y usan triggers
`ENABLE ALWAYS`. Una columna generada de elegibilidad y una FK estructural
`TaskMaterialActiveReservation → Project` impiden cerrar la obra con reserva
activa aun en la carrera cierre/reserva. El ledger de inventario impide revertir
stock por debajo del piso reservado.

## Contrato HTTP y UI

### Lectura

`GET /api/tasks/{taskId}/material-reservations`

- exige conjuntamente `org:tasks:read` y `org:inventory:read`;
- no admite query params;
- obtiene scope desde la sesión y lee un snapshot `REPEATABLE READ`;
- devuelve tarea, revisión de BOM, head de reserva, readiness, saldos por línea,
  asignaciones y disponibilidad por ubicación;
- responde `Cache-Control: private, no-store, max-age=0`.

### Mutación

`POST /api/tasks/{taskId}/material-reservations`

- exige conjuntamente `org:tasks:manage` y `org:inventory:manage`;
- exige `Idempotency-Key` de 8 a 128 caracteres seguros;
- limita el body a 256 KiB;
- exige `expectedRequirementRevisionId`, `expectedReservationHeadId` y un motivo
  de 3 a 500 caracteres;
- usa CAS, fingerprint del request, orden determinista de locks y replay exacto;
- devuelve `201` para una mutación nueva y `200` para un replay idéntico.

Ejemplo de reserva completa:

```json
{
  "kind": "RESERVE",
  "expectedRequirementRevisionId": "bom-revision-id",
  "expectedReservationHeadId": null,
  "reason": "Material separado para frente norte",
  "allocations": [
    {
      "requirementLineId": "bom-line-id",
      "locationId": "location-id",
      "quantity": "125.750"
    }
  ]
}
```

Ejemplo de liberación completa:

```json
{
  "kind": "RELEASE",
  "expectedRequirementRevisionId": "bom-revision-id",
  "expectedReservationHeadId": "active-reservation-id",
  "reason": "Reprogramación aprobada de la tarea"
}
```

El panel de Compras carga la reserva sólo para elementos `TASK`, conserva una
clave de idempotencia por intento y bloquea cambiar de tarea, recargar o publicar
otra BOM mientras una mutación está en vuelo. Un resultado de replay no se toma
como readiness autoritativo: la UI vuelve a leer el snapshot. No se reintenta
automáticamente un POST ambiguo.

## Evidencia de concurrencia

El job PostgreSQL 17 del corte verificó cuatro carreras reales con dos
conexiones y cleanup exacto:

1. reserva de 6 contra reserva de 6 con `onHand = 10`: sólo una puede ganar;
2. reserva contra reversión de stock: nunca queda `reserved > onHand`;
3. cierre de obra contra reserva, deshabilitando el trigger amigable: la FK
   estructural conserva el invariante en ambos órdenes;
4. liberación contra reversión: la serialización permite liberar y protege el
   piso reservado mientras corresponde.

CI habilita esos commits sólo para `obrasaas_ci/public` en host local. El gate
de Vercel fuerza el flag disposable a `0`: verifica catálogo y comportamiento
rollback-only, pero no afirma haber ejecutado carreras mutantes sobre Neon. Ese
modo no persiste fixtures, aunque puede tomar locks transaccionales breves.

## Fuera de alcance y siguiente gate

S12.2C **no implementa**:

- consumo, devolución, transferencia, ajuste o merma;
- sustitución de un material de BOM por otro;
- reserva parcial de una línea o de una parte de la BOM;
- FIFO, backfill o selección automática de ubicación;
- requisición, cotización/selección, compra automática o confirmación externa;
- ejecutabilidad integral de la tarea, certificación o pago.

El siguiente corte de materiales debe diseñar consumo/devolución/transferencia y
ajuste aprobable sin reutilizar `RELEASE` como si fuese consumo. Antes de
personas reales también siguen abiertos el journey exitoso de reserva y
liberación, la matriz restante de roles y negativos cross-tenant, PRO-05B/C/D y
revisión legal, Meta E2E, retención/restore y gates del piloto. El estado
continúa **NO-GO para trabajadores reales y Production**.
