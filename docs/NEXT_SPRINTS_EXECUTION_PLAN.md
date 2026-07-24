# ObraSaaS · plan de sprints de profesionalización

Este plan mantiene la secuencia del PDF y separa capacidades operativas de capacidades financieras. Cada sprint debe cerrar con migración verificable, pruebas de concurrencia, permisos y evidencia de uso; un endpoint compilado no cuenta como salida.

## Sprint inmediato: S6.1 — campo offline confiable

- bandeja de operaciones `queued/syncing/synced/blocked`;
- bloqueo por trabajador y operación lógica para evitar doble START/FINISH;
- selector o subida directa de evidencia privada;
- replay, conflicto y recuperación de dos pestañas;
- piloto con conectividad intermitente y verificador PostgreSQL.

## Ola financiera

### S7 — presupuesto y costos canónicos

`BudgetVersion`, `CostCode`, `Commitment`, `Actual`, `Forecast`, moneda y cambio aprobado. El total vigente debe derivar de base más cambios aprobados; ningún escenario modifica costos por sí solo.

### S8 — caja chica

Fondo, custodio, movimientos append-only, comprobantes, duplicados, umbrales y doble aprobación. El saldo se calcula del ledger, nunca de un campo editable.

### S9 — medición de avance

Unidad, cantidad base, ejecutada, método, período, evidencia, revisión y aprobación. Un porcentaje sin unidad ni período no es medición válida.

### S10 — certificación y reportes

Certificado versionado, retenciones, ajustes, PDF/hash reproducible y estado de pago separado. Certificar nunca ejecuta un pago automáticamente.

### S11/S12 — compras, recepción y stock

Proveedor, requisición/BOM por WBS, cotización, selección, orden aprobada, recepción parcial, remito, rechazo, consumo, transferencia y readiness.

## Ola contractual y control

### S19 — change control

Extra aprobado → solicitud de cambio → impacto plazo/costo → aprobación reforzada → nueva versión de baseline/presupuesto. RFI, submittal y transmittal permanecen explícitos si el alcance los prioriza.

### S20 — experiencia de cuadrilla

WhatsApp/webview offline, asignación, evidencia, seguridad, consentimiento GPS, idioma y operación con baja conectividad.

### S21/S22 — observabilidad y calidad

Métricas de latencia, outbox, sincronización, errores por tenant, auditoría, runbooks, backups/restores y pruebas de carga.

### S23 — piloto y cutover

Tenant piloto, datos reales anonimizados, checklist legal, retención, soporte, rollback, métricas de adopción y decisión de salida. No se habilita producción general por pasar solamente lint/build.

## Gates comunes de salida

1. Migración expand/backfill/contract y verificador semántico.
2. RBAC y aislamiento de tenant/proyecto probados.
3. Idempotencia, CAS y replay bajo carrera concurrente.
4. Auditoría de cada mutación y evidencia reproducible.
5. Lint, build, suite completa y prueba contra PostgreSQL real.
6. Runbook operativo, rollback y criterio explícito de no-go.
