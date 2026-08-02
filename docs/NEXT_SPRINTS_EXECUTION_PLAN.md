# ObraSaaS · plan de sprints de profesionalización

Este plan mantiene la secuencia del PDF y separa capacidades operativas de capacidades financieras. Cada sprint debe cerrar con migración verificable, pruebas de concurrencia, permisos y evidencia de uso; un endpoint compilado no cuenta como salida.

## Corte de evidencia: 29 de julio de 2026

El estado se expresa por nivel de evidencia: código y pruebas locales, migración en Preview aislado, journey UI en Preview y E2E externo. No se usa “desplegado” como sinónimo de “operativo con un proveedor real”.

- las validaciones locales relevantes, lint y build de Next 16.2.11 están verdes en el worktree; este dato no acredita despliegue, migración remota ni E2E de proveedor;
- las migraciones y verificadores de baseline/forecast fueron aprobados en el Preview aislado de la rama `codex/platform-ux-foundation`; Production permanece fuera del alcance;
- el commit `0a00f37` quedó `Ready` en Vercel Preview: se detectaron 100 migraciones sin pendientes y pasaron los verificadores de H3.1, media y dispatch/costo de IA; el corte conserva [deployment IDs, timestamps y smokes sanitizados](./evidence/2026-07-29-preview-0a00f37.md), pero no acredita aún los journeys UI autenticados ni la ejecución observada del cron;
- falta cerrar el smoke UI de publicación de baseline y forecast en el tenant de prueba, porque el acceso local directo a la conexión Preview está deliberadamente protegido y no se sustituye con una conexión de Production;
- Meta, media entrante e identidad/cobro siguen siendo gates externos. La credencial dedicada de Vision, el presupuesto y el ledger gobernado ya están aislados/verificados en Preview; faltan gate de datos, foto real y journey autenticado.

## Entregado, con smoke UI Preview pendiente: S3.1/S6.1 — baseline y forecast controlado

- baseline inmutable y versionada sobre WBS canónica, con snapshots, hashes, auditoría, idempotencia y CAS;
- forecast determinista con dependencias FS/SS/FF/SF, lag, observaciones explícitas y fechas civiles reproducibles;
- una tarea creada antes de definir el calendario conserva `startDay` y duración relativos; al fijar el inicio de obra se rehidrata de forma atómica, sin perder la planificación;
- observación de avance inmutable derivada de una decisión humana, nunca del output bruto del modelo; puede alimentar un corte de forecast reproducible sin modificar la tarea, la baseline, una certificación ni un pago;
- compatibilidad legacy por obra hasta cutover demostrable con cero drift; siguen pendientes responsables/equipos por ID, blockers y change control contractual.

## Prioridad inmediata: H1/H2 — Meta, asistencia y evidencia real

- H1: webhook firmado, inbound/outbound correlacionado, estados, retry auditado y asistencia con geolocalización puntual reportada por el dispositivo en un tenant piloto aislado; la API del navegador no garantiza GPS, identidad ni presencia física;
- las respuestas automáticas ya usan un journal durable `prepared → sending → accepted|failed|unknown`: un timeout, `408/425/429/5xx`, 2xx sin WAMID o correlación local irresuelta nunca repite el POST a Meta; el E2E externo sigue pendiente;
- H2 local sólo se dispara para una imagen Meta de un remitente autorizado, no clasificada como médica y con comentario no vacío que comienza con `AVANCE:` o `PROGRESO:`. La misma transacción liga la sesión al `WhatsAppMediaAsset` exacto del webhook; no hay correlación por tiempo, EXIF, URL ni descriptor del cliente;
- el journal durable conserva únicamente `{ version, sessionId }`, sin bearer ni enlace. Después de ganar el claim de envío, el worker revalida tenant/obra/conexión/operario/asset y materializa el enlace sólo en memoria; una sesión vencida o con vigencia insuficiente produce un stale fallback sin secreto y conserva la foto sin ubicación;
- el bearer viaja en `#token=...` y se elimina del navegador antes del `INIT`. La webview no usa `sessionStorage`: conserva la operación ambigua sólo en memoria, la purga por deadline y, tras recargar, consulta al servidor. El operario puede consentir una lectura puntual o elegir `Continuar sin ubicación`; el opt-out CAS no escribe coordenadas ni afecta asistencia;
- H2 reserva cada `INIT`, captura y cancelación bajo un advisory lock y reloj autoritativo de PostgreSQL: la vía activa usa 12/min por sesión y 600/min por organización; enlaces terminales o vencidos quedan aislados en 6/min y 300/min, por lo que no consumen capacidad activa. Los buckets por vía y alcance son acotados/expirables, conservan sólo hashes, segundos agregados y rechazos, y responden `429 Retry-After` o fallan cerrados; no crean una fila por request. Es una defensa multi-instancia localmente probada, todavía no evidencia Neon/WAF;
- cierre H2 externo: aplicar y verificar `20260729100000_progress_evidence_location_capture` y su migración aditiva `20260729110000_progress_evidence_location_rate_limit` en Neon Preview —todavía no están aplicadas— y recorrer una foto Meta real → enlace → `INIT` → captura u opt-out → Inbox/Progreso en un celular. No existe aún evidencia Meta E2E real para este journey;
- antes de enviar o aceptar datos reales: callback HTTPS, secretos exclusivos del ambiente, allowlist de tenant/operario, matriz de retención, DSAR integral, backups/restores, purga verificable, rate limiting durable en webhook/descargas, WAF y runbook de incidentes;
- Twilio Sandbox queda sólo como contingencia de transporte: no valida WhatsApp Flows, Data Endpoint ni Embedded Signup de Meta.

## Vertical interna en consolidación: S5.1 + S17-A — foto canónica y visión gobernada

- foto Meta autorizada → selector WBS en Inbox → `ProgressEvidence` idempotente;
- integridad SHA-256, storage privado y revisión de evidencia;
- `VisualProgressAssessment` con provider registry, rango/abstención, lease persistente recuperable y revisión CAS;
- OpenAI es el candidato primario de Vision; Qwen3-VL/GLM-5V son challengers visuales y GLM-OCR/GLM-5.2 especialistas OCR/texto evaluables. No hay fan-out sobre evidencia real;
- la clave OpenAI dedicada, el presupuesto y el recibo inmutable ya están aislados/verificados en Preview; antes de usar datos reales deben recorrerse replay/worker y conciliación interna autenticados con comprobante recuperable, cerrar DPA/retención y mantener `detail:high` con prompt cache implícito deshabilitado. `RECONCILED_USAGE` permanece cerrado hasta derivar costo desde usage y pricing persistidos;
- faltan foto Meta real, dataset consentido, ground truth, benchmark, DPA/retención y observabilidad de costo/latencia;
- H5 está cerrado en código y pruebas locales: una revisión visual aprobada/corregida exige un punto humano y fundamento, materializa una observación append-only y genera un corte determinista con comparación baseline/forecast por tarea. La migración nueva, el journey autenticado en Preview y la foto Meta real siguen pendientes; no se mutan tareas, baseline, certificaciones ni pagos;
- las cargas web privadas siguen limitadas a 4 MiB; carga directa autorizada, checksum y finalización server-side quedan como cierre para videos/documentos mayores.

## H3.1/H4 — alta de operario y cobro seguro

- H3.1 está implementado en código y pruebas locales: invitación desde Inbox, sesión/Flow pre-operario, aviso fijado en `INIT`, submit autenticado, acuse terminal, readiness fail-closed, cola CRM, decisión administrativa y purga periódica del claim transitorio; sus dos migraciones nuevas ya fueron aplicadas y verificadas en Neon Preview con build remoto `Ready`;
- `privacyPresentedAt` acredita que el Data Endpoint sirvió el aviso, no lectura ni comprensión; el copy y el circuito laboral deben pasar revisión legal antes de trabajadores reales;
- la purga H3.1 no es un DSAR integral: `WorkerPerson`, `WorkerChannelIdentity`, `Worker`, conversaciones, mensajes y backups requieren otro sprint. El teléfono raw interno de `Conversation.externalId` también es deuda pendiente;
- cierre H3.1: completar smoke UI/runtime, observar cron/readiness, terminar revisión legal y completar Meta E2E. Esas evidencias funcionales y externas siguen pendientes;
- H4 tiene una base local avanzada: consentimiento específico append-only por destino/canal, re-atestación segura de registros legacy, panel CRM sólo enmascarado, Flow de cobro, companion de sesión de un solo uso, Data Endpoint terminal, replay exacto, fence `UNCERTAIN` y constancia privada por opt-in. El cron autenticado recupera un `PROCESSING` vencido sólo hacia `UNCERTAIN`, sin reenviar. El reconciliador DB-only puede avanzar `UNCERTAIN → SUCCEEDED` únicamente cuando encuentra un destino ya persistido ligado por tenant, reserva, HMAC, tipo/fingerprint, claves de operación, canal y consentimiento exactos; no recibe el formulario ni invoca bridge, proveedor, pago, WhatsApp o IA. Las cinco migraciones `13000/13100/13200/13300/13400` aplican juntas en PGlite descartable, pero todavía no fueron aplicadas ni verificadas en PostgreSQL real/Neon Preview;
- cierre H4: el caller inbound especializado ya existe localmente y emite la sesión genérica más su companion en la transacción del webhook sólo para identidad `CANONICAL` verificada; el POST a Meta queda fuera de esa transacción y conserva el journal anti-duplicado. El opt-in terminal exacto ya emite localmente un descriptor durable no secreto y materializa post-claim un enlace privado de 15 minutos hacia una webview/PDF enmascarados. Falta coordinar el cutover legacy antes de migrar; verificar las cinco migraciones, cron, reconciliación y constancia en Neon; desplegar y validar el build H4 en Vercel Preview; publicar plantilla/Flow en Meta; recorrer E2E; definir reexpedición/plantilla `UTILITY`; e integrar un proveedor confiable de titularidad. Una sesión sin resultado persistido o con procedencia inconsistente permanece `UNCERTAIN` para resolución auditada; nunca se verifica, activa, paga ni se reintenta un resultado ambiguo automáticamente desde IA o WhatsApp. Nada de esto acredita Production.

## PRO-05 — privacidad y derechos del titular

- PRO-05A está implementado localmente como una base deliberadamente no destructiva: caso por tenant, sujeto `WORKER_PERSON`, atestación de autoridad ADMIN que no se presenta como identidad verificada, discovery `REPEATABLE READ READ ONLY`, catálogo v1 fijado, manifiesto/ítems append-only, HMAC sin IDs fuente, replay exacto y límites de 20 casos por actor/100 por organización por hora;
- el catálogo v1 sólo admite `DISCOVERY_BLOCKED` y exige blockers para grafo laboral, conversaciones, media, derivados/proveedores de IA, JSON/auditoría y backup/restore. Ningún endpoint exporta, corrige, restringe, anonimiza ni elimina;
- la migración aditiva `20260729140000_data_subject_discovery_foundation` aplica desde cero junto con las 108 anteriores en PGlite. Su verificador conductual local prueba tenant scope, transacción read-only, hash UTC, cobertura fail-closed, consistencia terminal y append-only. Faltan PostgreSQL real/Neon Preview, deployment autenticado Vercel y smoke con datos sintéticos; no hay evidencia de Production;
- PRO-05B debe incorporar identidad o representación proporcional, jurisdicción, plazo, matriz de retención, decisión por ítem y holds acotados. PRO-05C agrega adapters idempotentes por dominio y PRO-05D propagación a storage/Meta/IA, backups, tombstones y restore drill;
- antes de datos reales también deben aprobarse entidad legal responsable, domicilio, mapa responsable/encargado, contacto operativo y retención del propio ledger. El detalle y las invariantes están en [PRO-05A](./DATA_SUBJECT_RIGHTS_FOUNDATION.md).

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

### S11/S12 — compras y recepción (inspección y faltantes en Preview; stock en curso)

Proveedor, OC aprobada, fecha/ventana prometida, vista quincenal, recepción parcial, remito privado y factura/match existen. OC, compromiso, recepción y conciliación usan cantidades exactas. La asignación explícita append-only `GoodsReceiptLine → SupplierCommitmentLine` no usa FIFO ni backfill. La inspección vigente particiona exactamente cada línea entre aceptado, dañado, rechazado y cuarentena; correcciones/reversiones conservan historia, ubicación y actor. El cierre final deriva faltante y cantidad aceptada sólo de evidencia vigente. El deployment `dpl_ATmLy3oypBeNvSi7dXbMRM5zpQaY` quedó `Ready` con 114 migraciones y verificador PostgreSQL real; no acredita UI autenticada, stock, Resend ni Production.

Orden ejecutable del siguiente bloque:

1. **completo en Preview:** asignación explícita, append-only y tenant-scoped `GoodsReceiptLine → SupplierCommitmentLine`, sin FIFO ni backfill inferido;
2. **completo en Preview:** estados derivados separados para recepción (`UNALLOCATED/PARTIALLY_ALLOCATED/FULLY_ALLOCATED`) y compromiso (`NOT_RECEIVED/PARTIALLY_RECEIVED/FULLY_RECEIVED`), sin mutar `Task.status`;
3. **completo en Preview:** aceptación, daño, rechazo y cuarentena exactos; inspección versionada con actor/ubicación; cierre/reversión explícitos del faltante final y paginación por cursor de más de 500 remitos;
4. **siguiente gate P0:** ledger de stock por ubicación, reserva, consumo, transferencia y ajuste; sólo esa evidencia puede derivar `AVAILABLE`;
5. BOM/requerimiento exacto por tarea antes de afirmar que todos sus materiales están disponibles;
6. alerta interna durable a Compras/Director cuando fecha y cantidad aceptada incumplen la promesa;
7. smoke autenticado, Resend real y E2E por rol antes de Production. La migración y sus carreras adversariales ya pasaron el verificador dedicado en Neon Preview.

Siguen faltando requisición/BOM por WBS, cotización/selección, evidencia fotográfica tipada/firma de recepción y UI multi-partida. El snapshot `.ics` y el email una semana antes ya están en Preview como base, pero Calendar sincronizado/revocable y entrega Resend observada permanecen abiertos. Evidencia del corte: [Preview `b0ba0f8`](./evidence/2026-08-02-preview-b0ba0f8.md).

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

El piloto no se numera como S23: avanza en paralelo como dependencia externa. Requiere tenant piloto, datos reales minimizados, checklist legal, retención/DSAR, backups/restores, purga demostrable, rate limiting distribuido/WAF, soporte, rollback, métricas de adopción y decisión de salida. No se habilita un piloto con trabajadores reales ni producción general por pasar solamente lint/build.

## Gates comunes de salida

1. Migración expand/backfill/contract y verificador semántico.
2. RBAC y aislamiento de tenant/proyecto probados.
3. Idempotencia, CAS y replay bajo carrera concurrente.
4. Auditoría de cada mutación y evidencia reproducible.
5. Lint, build, suite completa y prueba contra PostgreSQL real.
6. Runbook operativo, rollback y criterio explícito de no-go.
7. Retención, DSAR, backups/restores y purga verificados con datos sintéticos antes de incorporar datos laborales reales.
8. Rate limiting distribuido y WAF probados bajo múltiples instancias; límites sólo en memoria no satisfacen el gate.
