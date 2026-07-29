# ObraSaaS · plan de sprints de profesionalización

Este plan mantiene la secuencia del PDF y separa capacidades operativas de capacidades financieras. Cada sprint debe cerrar con migración verificable, pruebas de concurrencia, permisos y evidencia de uso; un endpoint compilado no cuenta como salida.

## Corte de evidencia: 28 de julio de 2026

El estado se expresa por nivel de evidencia: código y pruebas locales, migración en Preview aislado, journey UI en Preview y E2E externo. No se usa “desplegado” como sinónimo de “operativo con un proveedor real”.

- `npm test`: 1383/1383 verde; lint y build de Next 16.2.11 verdes en el worktree;
- las migraciones y verificadores de baseline/forecast fueron aprobados en el Preview aislado de la rama `codex/platform-ux-foundation`; Production permanece fuera del alcance;
- el commit `d6b29b9` quedó `Ready` en Vercel Preview: se detectaron 97 migraciones, las dos nuevas H3.1 se aplicaron en Neon aislado y todos los verificadores de migración pasaron; el corte conserva [deployment IDs, timestamps y smokes sanitizados](./evidence/2026-07-28-preview-d6b29b9.md), pero no acredita aún el smoke UI/runtime ni la ejecución observada del cron;
- falta cerrar el smoke UI de publicación de baseline y forecast en el tenant de prueba, porque el acceso local directo a la conexión Preview está deliberadamente protegido y no se sustituye con una conexión de Production;
- Meta, media entrante e identidad/cobro siguen siendo gates externos. La credencial dedicada de Vision ya fue elegida; faltan deploy del ledger gobernado, gate de datos y foto real.

## Entregado, con smoke UI Preview pendiente: S3.1/S6.1 — baseline y forecast controlado

- baseline inmutable y versionada sobre WBS canónica, con snapshots, hashes, auditoría, idempotencia y CAS;
- forecast determinista con dependencias FS/SS/FF/SF, lag, observaciones explícitas y fechas civiles reproducibles;
- una tarea creada antes de definir el calendario conserva `startDay` y duración relativos; al fijar el inicio de obra se rehidrata de forma atómica, sin perder la planificación;
- escenario derivado de una revisión humana, nunca del output bruto del modelo; ninguna foto crea forecast, certifica o aplica cambios;
- compatibilidad legacy por obra hasta cutover demostrable con cero drift; siguen pendientes responsables/equipos por ID, blockers y change control contractual.

## Prioridad inmediata: H1/H2 — Meta, asistencia y evidencia real

- H1: webhook firmado, inbound/outbound correlacionado, estados, retry auditado y asistencia GPS real en un tenant piloto aislado;
- las respuestas automáticas ya usan un journal durable `prepared → sending → accepted|failed|unknown`: un timeout, `408/425/429/5xx`, 2xx sin WAMID o correlación local irresuelta nunca repite el POST a Meta; el E2E externo sigue pendiente;
- H2: foto Meta + comentario → storage privado → `ProgressEvidence` → revisión humana, sin inferir identidad ni GPS desde la imagen;
- antes de enviar o aceptar datos reales: callback HTTPS, secretos exclusivos de Preview, allowlist de tenant/operario, retención y runbook de incidentes;
- Twilio Sandbox queda sólo como contingencia de transporte: no valida WhatsApp Flows, Data Endpoint ni Embedded Signup de Meta.

## Siguiente vertical interno: S5.1 + S17-A — foto canónica y visión gobernada

- foto Meta autorizada → selector WBS en Inbox → `ProgressEvidence` idempotente;
- integridad SHA-256, storage privado y revisión de evidencia;
- `VisualProgressAssessment` con provider registry, rango/abstención, lease persistente recuperable y revisión CAS;
- OpenAI es el candidato primario de Vision; Qwen3-VL/GLM-5V son challengers visuales y GLM-OCR/GLM-5.2 especialistas OCR/texto evaluables. No hay fan-out sobre evidencia real;
- la clave OpenAI dedicada ya está aislada; antes de reactivar llamadas deben desplegarse presupuesto, recibo inmutable, replay/worker y conciliación interna con comprobante recuperable, cerrar DPA/retención y mantener `detail:high` con prompt cache implícito deshabilitado. `RECONCILED_USAGE` permanece cerrado hasta derivar costo desde usage y pricing persistidos;
- faltan foto Meta real, dataset consentido, ground truth, benchmark, DPA/retención y observabilidad de costo/latencia;
- las cargas web privadas siguen limitadas a 4 MiB; carga directa autorizada, checksum y finalización server-side quedan como cierre para videos/documentos mayores.

## H3.1/H4 — alta de operario y cobro seguro

- H3.1 está implementado en código y pruebas locales: invitación desde Inbox, sesión/Flow pre-operario, aviso fijado en `INIT`, submit autenticado, acuse terminal, readiness fail-closed, cola CRM, decisión administrativa y purga periódica del claim transitorio; sus dos migraciones nuevas ya fueron aplicadas y verificadas en Neon Preview con build remoto `Ready`;
- `privacyPresentedAt` acredita que el Data Endpoint sirvió el aviso, no lectura ni comprensión; el copy y el circuito laboral deben pasar revisión legal antes de trabajadores reales;
- la purga H3.1 no es un DSAR integral: `WorkerPerson`, `WorkerChannelIdentity`, `Worker`, conversaciones, mensajes y backups requieren otro sprint. El teléfono raw interno de `Conversation.externalId` también es deuda pendiente;
- cierre H3.1: completar smoke UI/runtime, observar cron/readiness, terminar revisión legal y completar Meta E2E. Esas evidencias funcionales y externas siguen pendientes;
- H4 mantiene CUIL/CBU/CVU/alias en un dominio cifrado, enmascarado y auditado, nunca en Inbox o snapshots compartidos; faltan Flow/UI de cobro, proveedor confiable de titularidad y comprobante privado. Nunca se ejecuta un pago automático.

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
