# Sprint C-2.2 — Presupuesto & costos sobre versiones y ledger reales

Base: Marketplace C-2.1 en `release/enterprise-unified-2026`. La ruta histórica `/costos` conserva un alias temporal a `/dashboard/budgets`; el destino ahora presenta presupuesto versionado y movimientos financieros con una jerarquía enterprise.

## Autoridad de datos
`BudgetVersion` y `BudgetLine` siguen siendo la autoridad del presupuesto. Crear una versión genera un borrador; sólo `activateBudget` puede volverla vigente mediante revisión optimista y transacción. Una activación reemplaza la versión activa anterior sin borrar historia.

Los KPIs se calculan únicamente con versiones cargadas: cantidad de versiones, borradores, versión vigente y total de sus líneas. No se inventan porcentajes de ahorro, inflación, CAC, margen o avance financiero.

## Monedas del ledger
`BudgetEntry` no almacena moneda directamente: la hereda de su `BudgetLine` y, por esa relación, de la `BudgetVersion`. La página ya carga presupuestos y movimientos juntos, por lo que C-2.2 resuelve esa moneda en servidor sin cambiar el endpoint público.

`LedgerSummary` agrupa COMMITMENT, ACTUAL y FORECAST por moneda. ARS y USD nunca se suman juntos. Un movimiento cuyo renglón no pueda vincularse a una versión cargada queda en «Moneda sin resolver» y no entra en totales ARS/USD. Esta separación es deliberada: mostrar un único total multi-moneda sería incorrecto.

## UX
Cabecera «Presupuesto & costos», resumen de cuatro KPIs, tarjetas de versiones con estado legible y total por moneda, y formulario de nueva versión colapsable. En móvil la tabla de líneas pasa a tarjetas verticales, inputs usan al menos 16 px y las acciones no generan overflow horizontal.

El ledger muestra totales por moneda y los veinte movimientos más recientes cargados. «Comprometido», «Real» y «Forecast» son categorías contables distintas del presupuesto aprobado; no se presentan como pagos ejecutados ni certificaciones.

## Calidad y mensajes
Se corrigieron mensajes de validación de `budget-entries.js` que contenían mojibake. El manifiesto de convergencia también se normalizó y una prueba impide reintroducir marcadores típicos de texto corrupto.

No se agregan migraciones, tablas, endpoints ni permisos. Tampoco se conecta ARCA, MercadoPago o eCheq en esta fase.

## Aceptación
Pruebas puras cubren totales de versiones, estado vigente, asociación línea→moneda, filas sin asociación y agrupación que impide mezclar ARS/USD. El navegador monta BudgetClient y LedgerSummary reales con HTTP controlado; comprueba creación de borrador, activación, totales separados y 320/390/768/1280 px.

La suite completa, lint de afectados y build deben pasar antes del commit. Los datos del navegador son sintéticos: no acreditan presupuesto real del usuario, integración fiscal ni movimientos bancarios.
