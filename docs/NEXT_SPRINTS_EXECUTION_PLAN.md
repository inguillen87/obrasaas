# ObraSaaS · plan de sprints de profesionalización

Este plan mantiene la secuencia del PDF y separa capacidades operativas de capacidades financieras. Cada sprint debe cerrar con migración verificable, pruebas de concurrencia, permisos y evidencia de uso; un endpoint compilado no cuenta como salida.

## Corte activo: S5.1 + S17-A — foto canónica y visión gobernada

- foto Meta autorizada → selector WBS en Inbox → `ProgressEvidence` idempotente;
- integridad SHA-256, storage privado y revisión de evidencia;
- `VisualProgressAssessment` con provider registry, rango/abstención, lease persistente recuperable y revisión CAS;
- OpenAI visual primario; Qwen3-VL/GLM-5V como challengers visuales y GLM-OCR/GLM-5.2 como especialistas OCR/texto explícitos; ninguno se invoca por fan-out;
- despliegue Neon Preview, smoke Meta real, controles de datos/DPA/retención y observabilidad de costo/latencia todavía pendientes;
- cargas web privadas limitadas a 4 MiB; carga directa autorizada, checksum y finalización server-side quedan como cierre para videos/documentos mayores;
- ninguna foto muta Gantt, certifica, paga o valida asistencia.

## Siguiente vertical: S3.1/S6.1 — baseline y forecast controlado

- baseline inmutable/versionada sobre WBS canónica;
- fechas plan/forecast/real separadas y motor determinista de dependencias;
- escenario derivado de una revisión humana, nunca del output bruto del modelo;
- comparación reproducible, impacto/camino afectado y aprobación antes de aplicar;
- conservar compatibilidad legacy por obra hasta cutover con cero drift.

## S20 — campo offline confiable

- bandeja de operaciones `queued/syncing/synced/blocked`;
- bloqueo por trabajador y operación lógica para evitar doble START/FINISH;
- selector o subida directa de evidencia privada;
- replay, conflicto y recuperación de dos pestañas;
- piloto con conectividad intermitente y verificador PostgreSQL.

## Ola financiera

### S7 — presupuesto y costos canónicos (base local; hardening pendiente)

Ya existen `BudgetVersion`, `BudgetLine` y `BudgetEntry` con clases `COMMITMENT/ACTUAL/FORECAST`. Faltan cost codes gobernados, cambios aprobados, reconciliación/cutover, Preview y E2E; ningún escenario modifica costos por sí solo.

### S8 — caja chica (base local; hardening pendiente)

Fondo, custodio validado por membresía, movimientos, comprobantes privados, idempotencia, deduplicación acotada, saldo derivado y dos aprobadores distintos desde `100000` ya existen localmente. Faltan umbral configurable por tenant, separación maker-checker respecto del creador, reposición/cierre/conciliación, Preview y E2E.

### S9 — medición de avance

Unidad, cantidad base, ejecutada, método, período, evidencia, revisión y aprobación. Un porcentaje sin unidad ni período no es medición válida.

### S10 — certificación y reportes

Certificado versionado, retenciones, ajustes, PDF/hash reproducible y estado de pago separado. Certificar nunca ejecuta un pago automáticamente.

### S11/S12 — compras y recepción (base local; hardening pendiente)

Proveedor, orden aprobada, recepción parcial, protección contra sobre-recepción, remito privado y factura/match existen localmente. Faltan requisición/BOM por WBS, cotización/selección, rechazo/daño/exceso, consumo/transferencia/readiness, Preview y E2E.

## Ola contractual y control

### S19 — change control

Extra aprobado → solicitud de cambio → impacto plazo/costo → aprobación reforzada → nueva versión de baseline/presupuesto. RFI, submittal y transmittal permanecen explícitos si el alcance los prioriza.

### S21 — regionalización

Locale, zona horaria, unidades, moneda y portugués priorizado. Reportes reproducen la configuración de la obra y nunca mezclan monedas implícitamente.

### S22 — API e integración piloto

API v1/OpenAPI, scopes, rate limit, idempotencia, webhooks y una integración ERP/BI/BIM priorizada por el piloto.

### S23 — confiabilidad Enterprise

Métricas/SLO, outbox, sincronización, errores por tenant, auditoría, runbooks, backups/restores, pruebas de carga, accesibilidad y revisión independiente.

## Release Gate R0 + H0-H6 — piloto y cutover

El piloto no se numera como S23: avanza en paralelo como dependencia externa. Requiere tenant piloto, datos reales minimizados, checklist legal, retención, soporte, rollback, métricas de adopción y decisión de salida. No se habilita producción general por pasar solamente lint/build.

## Gates comunes de salida

1. Migración expand/backfill/contract y verificador semántico.
2. RBAC y aislamiento de tenant/proyecto probados.
3. Idempotencia, CAS y replay bajo carrera concurrente.
4. Auditoría de cada mutación y evidencia reproducible.
5. Lint, build, suite completa y prueba contra PostgreSQL real.
6. Runbook operativo, rollback y criterio explícito de no-go.
