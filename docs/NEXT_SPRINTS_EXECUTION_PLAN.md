# ObraSaaS · plan de sprints de profesionalización

Este plan mantiene la secuencia del PDF y separa capacidades operativas de capacidades financieras. Cada sprint debe cerrar con migración verificable, pruebas de concurrencia, permisos y evidencia de uso; un endpoint compilado no cuenta como salida.

## Corte base: 2 de agosto de 2026 · actualización S9.3: 12 de agosto de 2026

El estado se expresa por nivel de evidencia: código y pruebas locales, migración en Preview aislado, journey UI en Preview y E2E externo. No se usa “desplegado” como sinónimo de “operativo con un proveedor real”.

- las validaciones locales relevantes, lint y build de Next 16.2.11 están verdes en el worktree; este dato no acredita despliegue, migración remota ni E2E de proveedor;
- las migraciones y verificadores de baseline/forecast fueron aprobados en el Preview aislado de la rama `codex/platform-ux-foundation`; Production permanece fuera del alcance;
- el commit `0a00f37` quedó `Ready` en Vercel Preview: se detectaron 100 migraciones sin pendientes y pasaron los verificadores de H3.1, media y dispatch/costo de IA; el corte conserva [deployment IDs, timestamps y smokes sanitizados](./evidence/2026-07-29-preview-0a00f37.md), pero no acredita aún los journeys UI autenticados ni la ejecución observada del cron;
- el commit `4760a50` quedó `Ready` en Vercel Preview: el release detectó 115 migraciones, aplicó y verificó `20260802170000_inventory_stock_ledger`, y el mismo corte local pasó `2003/2003` pruebas, lint, build, Prisma y audit. La [evidencia S12.2A](./evidence/2026-08-02-preview-4760a50.md) acredita migración, invariantes, build y smokes sin sesión; no acredita UI autenticada, Resend, Meta ni Production;
- el commit `054a82c` quedó `Ready` en Vercel Preview: el release detectó 117 migraciones sin pendientes, verificó conjuntamente `20260802180000_task_material_requirements` y `20260809090000_task_material_requirement_eligibility_not_null`, y completó el build. La [evidencia S12.2B](./evidence/2026-08-09-preview-054a82c.md) acredita contrato DB y build, no journey UI/API autenticado, reservas, Meta, Resend ni Production. Todos los estados S12.2B conservan `available: false`;
- el commit `b4fac3c` quedó `Ready` en Vercel Preview con 119 migraciones sin pendientes. El corte [reconcilia Prisma/PostgreSQL](./evidence/2026-08-09-preview-b4fac3c.md) sin renombrar objetos físicos: 77 `map:`, un índice scoped concurrente y una FK de propiedad validada con cascada. CI PostgreSQL 17 aprobó todos los verificadores y drift cero; Neon repitió catálogo/cascada mediante conexión dedicada con TLS `verify-full`. Esto fortalece el release, pero no sustituye el journey autenticado, Meta real, S12.2C ni Production;
- en el corte histórico `edeea82`, el deployment quedó `Ready` y el alias estable
  fue cortado entonces al mismo artefacto; ese dato no afirma su destino actual.
  El release detectó 119 migraciones sin pendientes, aprobó la reconciliación
  estructural y ejecutó PRO-05A contra Neon antes del `prisma generate`
  gobernado y del build Next 88/88. CI PostgreSQL 17 también lo exigió y cerró
  sus tres jobs. La [evidencia PRO-05A.1](./evidence/2026-08-10-preview-edeea82.md)
  acredita ese gate y un smoke AUDITOR acotado; no acredita DSAR ejecutable,
  matriz completa de roles, cross-tenant, Meta real, S12.2C ni Production;
- el commit `fc71fbe` quedó `Ready` en un deployment Preview inmutable, sin mover ni certificar un alias estable. El release detectó 120 migraciones sin pendientes, aprobó S12.2C en modo rollback-only, volvió a ejecutar PRO-05A y completó el build 88/88. CI PostgreSQL 17 cerró sus tres jobs y ejecutó cuatro carreras disposable con cleanup exacto, `2172/2172` pruebas y drift cero. La [evidencia S12.2C](./evidence/2026-08-11-preview-fc71fbe.md) agrega un smoke sintético acotado `AUDITOR → DIRECTOR → SITE_MANAGER → AUDITOR`, con rol/grant restaurados y cero `error`/`fatal` o `5xx` en la ventana observada. No acredita una reserva/liberación exitosa, matriz completa, cross-tenant, Meta, trabajadores reales ni Production;
- el commit `871cf2f` agregó PRO-05B.1 y quedó `Ready` en el deployment Preview inmutable `dpl_Fj7zRe66SrNtaeLXQSXhESjygPSs`, sin mover ni certificar un alias. El release detectó 121 migraciones sin pendientes, volvió a ejecutar PRO-05A, aprobó PRO-05B.1 en rollback-only con carreras disposable desactivadas y completó 88/88. CI `31511714114` terminó 3/3 con `2230/2230`, PostgreSQL 17 disposable, status y drift cero. El [smoke PRO-05B.1](./evidence/2026-08-11-preview-871cf2f.md) comprobó acceso `ADMIN`, rechazo `AUDITOR`, signed-out 404 y cero `error`/`fatal`/`5xx`, todo read-only y sin POST. No acredita DSAR ejecutable, cross-tenant, trabajadores reales, alias ni Production;
- el commit `cc5aa21` cerró el gate técnico S9.2-MED. CI `31539591755` terminó 3/3 con 123 migraciones, carreras PostgreSQL de replay exacto/mutado, dos selladores, corrección y archivado, cleanup exacto, `2347/2347`, lint, audit cero, build 90/90 y Browser 2/2. El deployment Preview inmutable `dpl_4p2bcbwyznb4afZ8XetL2GrZWF51` quedó `READY`, sin mover alias: detectó 123 migraciones sin pendientes, aprobó S9.2 rollback-only con carreras disposable desactivadas y completó 90/90. Los [smokes y límites](./evidence/2026-08-11-preview-cc5aa21.md) son públicos/read-only; no hubo sesión autenticada, POST S9.2, mutación manual ni Production;
- el commit `dcb44b9` cerró el gate funcional autenticado S9.2-E2E. CI `31549498945` terminó 4/4: PostgreSQL 17 aplicó 123 migraciones y quedó sin drift; Quality aprobó `2388/2388`, lint, audit cero y build 90/90; Browser público cerró 2/2; y el job autenticado cerró 2/2 con seis actores sintéticos de Clerk Development en dos tenants y una base `obrasaas_e2e` descartable. El journey cubrió maker-checker S9.1, seal/replay/stale S9.2, roles negativos, cross-tenant y lectura UI final. El deployment Preview inmutable `dpl_5PTCAS3wbhgniZe8Ss5oi41NbFgv` quedó `READY`, con 123 migraciones sin pendientes, verificador rollback-only, carreras no solicitadas, build 90/90 y cuatro GET públicos `200`; no hubo auth, POST, alias, mutación manual ni Production. La [evidencia exacta](./evidence/2026-08-11-preview-dcb44b9.md) mantiene separados ambos ambientes;
- el commit `21ce752` implementó S9.3-CONTRACT y quedó `READY` en el Preview
  inmutable `dpl_2cmWjw8AtEqLquafAZBXWbHSeHRW`. El release detectó 124
  migraciones sin pendientes, aprobó S9.3 rollback-only con flag descartable
  final `0`, completó 93/93 y obtuvo cuatro GET públicos `200`, sin
  `error`/`fatal` ni `5xx`. CI `31558109020` ya tiene verdes PostgreSQL 17,
  Quality (`2446/2446`, lint, audit cero, build 93/93), Browser público y el
  journey autenticado S9.2 + S9.3. El E2E verificó fixtures Clerk Development
  sin drift y cerró S9.2 2/2 y S9.3 2/2 sobre PostgreSQL descartable. El [corte
  exacto](./evidence/2026-08-12-preview-21ce752.md) cierra técnicamente S9.3. No
  hubo auth/POST en Preview, alias ni Production;
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

- PRO-05A está implementado y su gate técnico fue verificado en Preview como una base deliberadamente no destructiva: caso por tenant, sujeto `WORKER_PERSON`, atestación de autoridad ADMIN que no se presenta como identidad verificada, discovery `REPEATABLE READ READ ONLY`, catálogo v1 fijado, manifiesto/ítems append-only, HMAC sin IDs fuente, replay exacto y límites de 20 casos por actor/100 por organización por hora;
- el catálogo v1 sólo admite `DISCOVERY_BLOCKED` y exige blockers para grafo laboral, conversaciones, media, derivados/proveedores de IA, JSON/auditoría y backup/restore. Ningún endpoint exporta, corrige, restringe, anonimiza ni elimina;
- el [plano PRO-05B.1](./DATA_SUBJECT_DECISION_CONTROL_PLANE.md) ya incorpora eventos de identidad o representación proporcional, revisión de jurisdicción/plazo, holds acotados, decisión por ítem, CAS, replay y maker-checker en un ledger no-store. Su migración `20260811160000_data_subject_decision_control_plane`, PRO-05A y el historial completo de 121 migraciones quedaron verdes en PostgreSQL 17 y Vercel/Neon Preview en el [corte `871cf2f`](./evidence/2026-08-11-preview-871cf2f.md);
- el smoke autenticado fue deliberadamente read-only: `ADMIN` abrió la consola no ejecutable y vio cola vacía; `AUDITOR` recibió el boundary restringido y no vio navegación; sin sesión el path devolvió 404. No hubo POST, expediente maker-checker completo ni prueba cross-tenant. `executionAllowed` continúa `false`;
- PRO-05C debe agregar adapters idempotentes por dominio y PRO-05D propagación a storage/Meta/IA, backups, tombstones y restore drill. PRO-05B.1 prepara decisiones; no exporta, corrige, restringe, porta, anonimiza ni elimina;
- antes de datos reales también deben aprobarse entidad legal responsable, domicilio, mapa responsable/encargado, contacto operativo y retención del propio ledger. El detalle y las invariantes están en [PRO-05A](./DATA_SUBJECT_RIGHTS_FOUNDATION.md).

## S20 — campo offline confiable

- bandeja de operaciones `queued/syncing/synced/blocked`;
- bloqueo por trabajador y operación lógica para evitar doble START/FINISH;
- selector o subida directa de evidencia privada;
- replay, conflicto y recuperación de dos pestañas;
- piloto con conectividad intermitente y verificador PostgreSQL.

## Ola financiera

### S7 — presupuesto y costos canónicos (base local; hardening pendiente)

Ya existen `BudgetVersion`, `BudgetLine` y `BudgetEntry` con clases `COMMITMENT/ACTUAL/FORECAST`. Faltan cost codes gobernados, cambios aprobados, reconciliación/cutover, Preview y E2E; ningún escenario modifica costos por sí solo. Este presupuesto es interno y no se reutiliza como contrato/SOV S9.3.

### S8 — caja chica (base local; hardening pendiente)

Fondo, custodio validado por membresía, movimientos, comprobantes privados, idempotencia, deduplicación acotada, saldo derivado y dos aprobadores distintos desde `100000` ya existen localmente. Faltan umbral configurable por tenant, separación maker-checker respecto del creador, reposición/cierre/conciliación, Preview y E2E.

### S9.1 — medición de avance (gate técnico completo; API maker-checker verificada, UI dedicada pendiente)

Unidad, cantidad base, ejecutada, método, período, evidencia, revisión y aprobación ya están implementados en un ledger separado de `Task.progress`. El [corte `46c744c`](./evidence/2026-08-11-preview-46c744c.md) pasó PostgreSQL 17 con carreras y cleanup, 122 migraciones sin drift, 2294 pruebas y Preview rollback-only `READY`. S9.2-E2E recorrió por API una v1 creada por `DIRECTOR`, rechazó su autoaprobación, obtuvo aprobación `ADMIN`, y luego una corrección v2 creada por `SITE_MANAGER` y aprobada por `DIRECTOR`. Falta el journey UI dedicado de toda S9.1; un porcentaje sin unidad ni período no es medición válida.

### S9.2-MED — corte técnico quincenal reproducible (gate técnico y funcional autenticado completos)

El [corte técnico S9.2-MED](./PROGRESS_MEASUREMENT_CUTS_S9_2.md) ya sella por obra y quincena cerrada un snapshot inmutable de todas las tareas canónicas, derivado en servidor y reproducible por hash. Cada línea queda como `MEASURED` o `MISSING`; ausencia nunca significa cantidad cero. Versiona correcciones sin reescribir historia, exige replay idempotente y doble CAS del head/candidato, y restringe el sellado a `ADMIN`/`DIRECTOR` activos. El [corte `cc5aa21`](./evidence/2026-08-11-preview-cc5aa21.md) verificó DB, carreras, cleanup, CI y Preview rollback-only; el [corte `dcb44b9`](./evidence/2026-08-11-preview-dcb44b9.md) agregó el journey API/UI autenticado sobre Clerk Development y PostgreSQL descartable: seis actores, maker-checker, roles negativos, cross-tenant, seal v1/v2, replay exacto/mutado/tardío y transición `STALE`. El Preview del mismo SHA permaneció read-only. Este artefacto sigue siendo técnico e interno; no contiene importes, retenciones, impuestos, PDF contractual, conformidad financiera ni estado de pago. S9.3-CONTRACT es el prerrequisito contractual separado de S10.

### S9.3-CONTRACT — autoridad contractual y SOV (cerrado técnicamente)

El [contrato canónico S9.3](./PROJECT_CONTRACT_AUTHORITY_S9_3.md) está
implementado como una autoridad distinta de presupuesto, medición y AP:
head/versión/líneas/decisiones propios; todas las tareas como `VALUED` o
`NO_CLAIM`; moneda y escala persistidas; importe facial en minor units;
`retentionBps`; `CERT_RETENTION_HALF_UP_V1`; vigencia y digest; y tres
membresías activas distintas para certificar, conformar financieramente y
registrar una referencia externa. La designación y el contrato tienen
maker-checker, CAS, idempotencia, replay y conciliación de resultados ambiguos.
La API/UI privada aplica alcance tenant/obra y least privilege. `BudgetVersion`/
`BudgetLine`, `SupplierInvoice`, `Task.progress`, certificado, PDF, conformidad
y pago quedan fuera.

El commit `21ce752` cerró esquema/migración/guards/verificador, RBAC, API/UI,
idempotencia/CAS, carreras PostgreSQL, E2E autenticado Development y Preview
exact-SHA. CI terminó 4/4; S9.3 recorrió setup + journey 2/2 y gobernó autoridad
y SOV completa a través de los roles exactos de la obra. No se acredita
Production ni validez legal, contable o fiscal.

Antes de ampliar a S10, un hardening P2 corto debe secuenciar las lecturas que
hoy se lanzan en paralelo sobre un mismo cliente transaccional de identidad.
`pg@8.22.0` todavía las serializa y los journeys cerraron verdes, pero el patrón
está deprecado y debe eliminarse antes de adoptar `pg@9`; no reabre los
invariantes ni el cierre funcional de S9.3.

### S10 — certificación, conformidad y referencia de pago (contrato S10-CERT Fase 1 congelado; backend pendiente)

S10 empieza sólo después de que S9.3 tenga una versión aprobada verificable y se divide en tres incrementos sin compartir estados:

1. **S10-CERT:** el [contrato Fase 1](./PROJECT_CERTIFICATES_S10_CERT.md) está congelado y el backend sigue pendiente. El certificado versionado consume un cut S9.2 y una versión/autoridad S9.3 exactos. `MISSING` sobre una línea `VALUED` bloquea preparación y aprobación; jamás se convierte en `NO_CLAIM`, avance cero o monto cero. La primera política admite sólo deducciones explícitas de monto positivo y calcula importes/retención acumulados con reglas versionadas.
2. **S10-FIN:** conformidad financiera append-only por la membresía `FINANCE` designada; no edita el certificado.
3. **S10-PAYREF:** referencia externa append-only por la tercera autoridad; no ejecuta, concilia ni prueba pago y nunca crea `PAID`.

El PDF contractual privado, determinista y hasheado es un artefacto posterior separado. El [runbook rotulado históricamente S10](./S10_PAYABLES_RUNBOOK.md) queda como legacy/AP de proveedores y no se reutiliza para ninguna de estas tres fases.

### S11/S12 — compras, stock, BOM y reserva (gate técnico y boundary multirrol; journey funcional pendiente)

Proveedor, OC aprobada, fecha/ventana prometida, vista quincenal, recepción parcial, remito privado y factura/match existen. OC, compromiso, recepción y conciliación usan cantidades exactas. La asignación explícita append-only `GoodsReceiptLine → SupplierCommitmentLine` no usa FIFO ni backfill. La inspección vigente particiona exactamente cada línea entre aceptado, dañado, rechazado y cuarentena; correcciones/reversiones conservan historia, ubicación y actor. El cierre final deriva faltante y cantidad aceptada sólo de evidencia vigente. El deployment `dpl_ATmLy3oypBeNvSi7dXbMRM5zpQaY` quedó `Ready` con 114 migraciones y el verificador de inspección sobre PostgreSQL real. S12.2A agrega catálogo canónico, vínculo inmutable de línea, putaway atómico, reversión exacta y saldo on-hand DB-owned; el deployment `dpl_8rwZw537MiYbRsPNuvYniTg4NQcP` quedó `Ready` tras aplicar la migración 115 y pasar su verificador dedicado en Preview. S12.2B agrega la [BOM inmutable por tarea](./TASK_MATERIAL_REQUIREMENTS.md), CAS sobre el head, cantidades exactas, historial cursorado y modo explícito sin materiales. El deployment `dpl_9ugPgHs1yRL2Yg9c9F11jk2LAGvZ` quedó `Ready` con 117 migraciones sin pendientes y el verificador 116+117 aprobado. S12.2C agrega la [reserva/liberación exacta](./TASK_MATERIAL_RESERVATIONS.md) del bundle completo: la migración 120, las cuatro carreras PostgreSQL, el gate Neon rollback-only y el build quedaron [verificados para `fc71fbe`](./evidence/2026-08-11-preview-fc71fbe.md). El smoke multirrol confirmó límites de acceso y rechazo seguro; falta una reserva/liberación exitosa con datos sintéticos, el rol restante y negativos cross-tenant. No acredita Resend, Meta, personas reales ni Production.

Orden ejecutable del siguiente bloque:

1. **completo en Preview:** asignación explícita, append-only y tenant-scoped `GoodsReceiptLine → SupplierCommitmentLine`, sin FIFO ni backfill inferido;
2. **completo en Preview:** estados derivados separados para recepción (`UNALLOCATED/PARTIALLY_ALLOCATED/FULLY_ALLOCATED`) y compromiso (`NOT_RECEIVED/PARTIALLY_RECEIVED/FULLY_RECEIVED`), sin mutar `Task.status`;
3. **completo en Preview:** aceptación, daño, rechazo y cuarentena exactos; inspección versionada con actor/ubicación; cierre/reversión explícitos del faltante final y paginación por cursor de más de 500 remitos;
4. **código y migración verificados en Preview; UI autenticada pendiente:** material canónico por obra, vínculo append-only de la línea de OC, putaway de todas y sólo las disposiciones `ACCEPTED`, reversión espejo y balance on-hand derivado del ledger. La cantidad/ubicación son server-owned, no hay backfill ni conversión de unidad;
5. **código, migraciones y build verificados en Preview; UI autenticada pendiente:** S12.2B publica una cadena inmutable de requerimientos/BOM por tarea, o `NO_MATERIALS_REQUIRED`, con scope server-owned, CAS, idempotencia, snapshots y cantidades exactas. `SupplierCommitment` se muestra sólo como **PROMESA, NO RESERVA**;
6. **gate técnico completo y boundary multirrol en Preview; journey exitoso pendiente, S12.2C:** reserva/liberación exacta de la revisión vigente y del bundle completo. `AVAILABLE` sólo deriva si todas las líneas quedan reservadas sobre stock coherente; no implica ejecutabilidad, certificación ni pago;
7. **siguiente gate P0:** consumo, devolución, transferencia y ajuste aprobable antes de retirar el snapshot legacy de acopio; no hay sustitución, reserva parcial ni FIFO;
8. alerta interna durable a Compras/Director cuando fecha y cantidad aceptada incumplen la promesa;
9. journey funcional autenticado, rol restante, negativos cross-tenant, Resend
   real y E2E por rol antes de Production. S12.1,
   S12.2A, las migraciones 116+117 de S12.2B y la migración 120 de S12.2C ya
   pasaron sus verificadores separados en Preview. El smoke actual prueba
   sesión, permisos y rechazo seguro, pero no sustituye el recorrido de éxito.

Sigue faltando la requisición previa a la BOM, además de consumo, devolución, transferencia, ajuste, sustitución, reserva parcial, cotización/selección, evidencia fotográfica tipada/firma de recepción y UI multi-partida. Tampoco existe FIFO: ubicación y cantidades se eligen explícitamente. La ampliación de la socia ya está cubierta como base por fechas de material o servicio, calendario civil por quincenas 1-15/16-fin, snapshot `.ics` y recordatorio configurado por defecto siete días antes. No es sincronización viva y el envío real sigue gated por Resend, dominio/remitente verificado, cron/webhook observados y E2E. Contratos: [ledger S12.2A](./INVENTORY_STOCK_LEDGER.md), [BOM S12.2B](./TASK_MATERIAL_REQUIREMENTS.md) y [reserva S12.2C](./TASK_MATERIAL_RESERVATIONS.md). Evidencias remotas: [inspección/faltantes `b0ba0f8`](./evidence/2026-08-02-preview-b0ba0f8.md), [ledger on-hand `4760a50`](./evidence/2026-08-02-preview-4760a50.md), [DB/build S12.2B `054a82c`](./evidence/2026-08-09-preview-054a82c.md) y [S12.2C `fc71fbe`](./evidence/2026-08-11-preview-fc71fbe.md). La última incluye boundaries autenticados de tres roles, pero ninguna acredita el journey funcional completo, Production o trabajadores reales.

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
