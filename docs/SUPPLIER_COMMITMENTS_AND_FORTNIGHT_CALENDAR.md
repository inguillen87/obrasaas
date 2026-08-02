# Compromisos de proveedores, calendario quincenal y recordatorios

## Estado y alcance

Estado al 2 de agosto de 2026: **implementado y verificado en Neon/Vercel Preview; pendiente de E2E autenticado, Resend real y Production**.

Este incremento cubre las ideas acordadas con la socia para:

- registrar la fecha o ventana prometida de una entrega de material o de la ejecución de un servicio;
- vincular ese compromiso con un proveedor, una orden de compra opcional y tareas de la WBS;
- organizar tareas y compromisos en quincenas civiles reales: días 1–15 y 16–fin de mes;
- exportar una instantánea de calendario compatible con clientes que acepten `.ics`;
- avisar por email al proveedor, por defecto siete días antes, cuando Administración haya confirmado el destino;
- mostrar el impacto operativo derivado sin modificar silenciosamente el estado de una tarea.

No cubre todavía una suscripción de calendario sincronizada, confirmación del email por el propio proveedor, inspección/aceptación de calidad, stock/reservas, alertas internas a Compras/Director, ni certificación contractual de avance. La asignación cuantitativa explícita entre compromiso y recepción ya existe en Preview, pero no equivale a aceptación física.

## Autoridades de datos

La funcionalidad evita crear una segunda verdad del plan o de la recepción:

| Responsabilidad | Autoridad | Regla |
| --- | --- | --- |
| Plan vigente y dependencias | `Task` y `TaskDependency` | Son la WBS canónica. El calendario sólo las lee. |
| Promesa externa de fecha | `SupplierCommitment` | Conserva proveedor, tipo, ventana civil, estado y revisión. |
| Compra aprobada | `PurchaseOrder` y `PurchaseOrderLine` | Un compromiso puede vincularse sólo con una OC aprobada o parcialmente recibida del mismo tenant, obra y proveedor. |
| Recepción real | `GoodsReceipt` y `GoodsReceiptLine` | Sigue siendo el registro de lo recibido. No se infiere desde un email ni desde el estado de un compromiso. |
| Conciliación documental | `GoodsReceiptCommitmentAllocation` | Ledger append-only de cantidades explícitamente asignadas, sin FIFO ni backfill; no afirma calidad ni disponibilidad. |
| Comunicación externa | `SupplierReminderDelivery` | Outbox durable y versionado; no es la autoridad de la fecha. |
| Historia del compromiso | `SupplierCommitmentEvent` | Evento inmutable por creación y transición. |
| Vista quincenal/exportación | `loadScheduleCalendar` | Read model derivado de WBS y compromisos; no persiste copias del plan. |

El readiness mostrado junto a una tarea (`AVAILABLE`, `EXPECTED_IN_TIME`, `ALIGNED`, `AT_RISK`, `BLOCKED`, `REVIEW_REQUIRED` o `ADMIN_ATTESTED`) es una **derivación informativa**. Nunca cambia `Task.status`, el progreso, una baseline ni un forecast. Una entrega material cerrada sólo por declaración administrativa usa `ADMIN_ATTESTED`, no `AVAILABLE`.

## Modelo funcional

### Tipos y vínculos

- `MATERIAL_DELIVERY`: entrega de material.
- `SERVICE_EXECUTION`: ejecución de un servicio por un proveedor.
- `REQUIRED_BEFORE_START`: el compromiso debe cumplirse antes de iniciar la tarea.
- `EXECUTES_TASK`: el proveedor ejecuta la tarea dentro de la ventana indicada.

La API admite hasta 50 vínculos de tareas y 200 partidas de OC por compromiso. La interfaz actual de Compras permite seleccionar una tarea opcional y una partida de la OC con cantidad exacta; todavía no permite cargar varias partidas en el mismo compromiso. Por lo tanto, la capacidad multi-partida de la API no debe presentarse aún como flujo completo de usuario.

Cuando se usan partidas desde UI o API, se valida que pertenezcan a la OC y que la suma de recepciones `POSTED` más compromisos activos no supere exactamente la cantidad ordenada. Las cantidades se conservan como texto decimal fijo; no atraviesan aritmética binaria `Number`.

### Máquina de estados

| Estado actual | Acciones válidas | Resultado |
| --- | --- | --- |
| `TENTATIVE` | `CONFIRM`, `RESCHEDULE`, `CANCEL` | Confirmado, tentativo reprogramado o cancelado. |
| `CONFIRMED` | `RESCHEDULE`, `MARK_AT_RISK`, `FULFILL`, `CANCEL` | Conserva confirmación al reprogramar o avanza al estado solicitado. |
| `AT_RISK` | `RESCHEDULE`, `FULFILL`, `CANCEL` | Conserva riesgo al reprogramar o pasa a terminal. |
| `FULFILLED` | Ninguna | Terminal. |
| `CANCELLED` | Ninguna | Terminal. |

La API permite crear un compromiso `TENTATIVE` o `CONFIRMED`; la UI actual crea siempre `CONFIRMED`. Reprogramar o cancelar exige motivo y una reprogramación debe cambiar al menos una fecha. Marcar como cumplida una entrega material exige que el administrador describa el remito, la recepción o la evidencia revisada.

Cada mutación exige:

- permiso `org:execution:manage` y alcance del tenant/obra activo;
- encabezado `Idempotency-Key`;
- `expectedRevision` para compare-and-swap en actualizaciones;
- bloqueo transaccional de la obra;
- evento de dominio y `AuditLog`;
- incremento de `scheduleRevision` sólo cuando cambia la ventana de fechas.

Las transiciones terminales, las revisiones y el evento correspondiente también están protegidos por constraints y triggers `ENABLE ALWAYS` en la migración.

### Conciliación material y límite de aceptación

Hoy `FULFILL` para `MATERIAL_DELIVERY` sigue siendo una decisión administrativa con motivo obligatorio y la serialización la identifica como `ADMIN_ATTESTED`. Separadamente, la conciliación explícita permite elegir una línea de remito `POSTED`, una línea comprometida compatible y una cantidad exacta. El servidor devuelve balances de recepción y compromiso incluso con asignación cero.

Esto significa:

- cada asignación conserva actor, fecha, cantidad, idempotencia, auditoría y scope compuesto;
- no se asigna por cercanía de fecha, FIFO ni inferencia histórica;
- un remito `VOIDED` deja de consumir cobertura y no puede volver silenciosamente a `POSTED`;
- `UNALLOCATED/PARTIALLY_ALLOCATED/FULLY_ALLOCATED` describen la línea recibida; `NOT_RECEIVED/PARTIALLY_RECEIVED/FULLY_RECEIVED` describen cobertura documental del compromiso;
- no corresponde describir esa cobertura como aceptada, disponible, OCR aprobado ni prueba jurídica;
- `AVAILABLE` permanece cerrado hasta inspección, stock, reserva y BOM por tarea.

## Calendario por quincenas

`GET /api/schedule/calendar` combina tareas canónicas y compromisos que intersectan el rango pedido.

- Sin `from`/`to`, el rango comienza en el día civil del tenant y termina 89 días después: **90 días inclusivos**.
- Se admiten rangos de 1 a 366 días.
- Cada quincena es 1–15 o 16–último día del mes; no es un bloque móvil de 14 días.
- Una tarea o compromiso que cruza quincenas aparece en cada bucket que intersecta.
- La pantalla de Compras muestra en cada quincena las tareas canónicas de los próximos 90 días junto con los compromisos del proveedor; si supera 5.000 tareas lo declara como truncado.
- Las fechas de WBS se leen como fechas civiles UTC-midnight para evitar desplazamientos al día anterior en Argentina.
- El JSON declara `truncated.tasks`, `truncated.commitments` y `truncated.any`.
- El calendario procesa hasta 5.000 tareas y 5.000 compromisos; si el resultado está truncado, la exportación `.ics` falla con `409 SCHEDULE_CALENDAR_TRUNCATED` en vez de entregar un archivo incompleto.

### Exportación `.ics`

`GET /api/schedule/calendar?format=ics` entrega una instantánea autenticada, privada y sin cache. La descarga que ofrece la UI usa el rango predeterminado de 90 días.

El archivo incluye eventos de día completo, UID estable, `SEQUENCE` basado en la revisión y `DTEND` exclusivo. Esto ayuda a reimportar una revisión, pero **no convierte el archivo en un calendario vivo**:

- no hay URL de suscripción revocable;
- no hay OAuth con Google Calendar, Microsoft 365 ni Apple Calendar;
- una importación previa no recibe automáticamente reprogramaciones o cancelaciones;
- el usuario debe descargar/importar una nueva instantánea o borrar/reconciliar la anterior según el cliente de calendario.

Una suscripción real necesita un feed tenant-scoped con credencial revocable, controles de publicación, política de cache, observabilidad y pruebas contra cada cliente soportado.

### Dependencias del Gantt

El read model conserva y usa dependencias tipadas `FINISH_TO_START`, `START_TO_START`, `FINISH_TO_FINISH` y `START_TO_FINISH`, con `lagDays`. Una edición ordinaria que no toca dependencias ya no elimina las aristas entrantes.

La UI actual del Gantt sólo permite marcar predecesores. Una relación nueva creada desde esa UI usa `FINISH_TO_START` con `lagDays = 0`; las relaciones tipadas existentes se preservan, pero todavía no existe un editor visual para cambiar tipo o lag. No debe afirmarse que toda la edición avanzada de dependencias está terminada.

## API y permisos

| Método y ruta | Permiso/autenticación | Contrato principal |
| --- | --- | --- |
| `GET /api/supplier-commitments` | Clerk + `org:execution:read` | Lista filtrable por `from`, `to`, `status` y `taskId`. |
| `POST /api/supplier-commitments` | Clerk + `org:execution:manage` | Crea un compromiso; body máximo 64 KiB e `Idempotency-Key` obligatorio. |
| `PATCH /api/supplier-commitments/:id` | Clerk + `org:execution:manage` | `CONFIRM`, `RESCHEDULE`, `MARK_AT_RISK`, `FULFILL` o `CANCEL`; body máximo 16 KiB, CAS e idempotencia. |
| `GET /api/goods-receipt-commitment-allocations` | Clerk + `org:execution:read` | Historial paginado y saldos completos acotados a una OC. |
| `POST /api/goods-receipt-commitment-allocations` | Clerk + `org:execution:manage` | Asignación exacta explícita; body máximo 16 KiB e `Idempotency-Key` obligatorio. |
| `GET /api/schedule/calendar` | Clerk + `org:execution:read` | JSON o `.ics`; rango y formato validados. |
| `GET /api/cron/supplier-reminders` | `Authorization: Bearer <CRON_SECRET>` | Worker acotado; no usa sesión Clerk. |
| `POST /api/webhooks/resend` | Firma Svix/Resend sobre body crudo | Inbox de eventos de entrega; máximo 256 KiB. |

Las respuestas de usuario y calendario usan `Cache-Control: private, no-store, max-age=0`. Cron y webhook son rutas públicas sólo en el sentido de red: fallan cerradas con su propia autenticación.

La vista inicial de Compras carga como máximo 500 compromisos y todavía no pagina. Ese límite debe cerrarse antes de certificar escala enterprise, aunque la exportación de calendario tenga un límite mayor y falle cerrada cuando lo excede.

## Recordatorios por email

### Consentimiento y destino

El email se copia desde el proveedor al crear el compromiso. Para activarlo, Administración debe marcar que verificó que ese destino es operativo y autoriza el aviso. Se guardan `reminderEmailConfirmedAt` y `reminderEmailConfirmedById`.

Esa marca es una **atestación operativa del administrador**. No demuestra que:

- el proveedor controla la casilla;
- el proveedor realizó doble opt-in;
- exista consentimiento comercial para campañas;
- la dirección sea legal o contractualmente válida.

Los mensajes implementados son transaccionales de coordinación de obra. Si el negocio requiere confirmación del proveedor, debe agregarse un flujo separado de verificación/aceptación y una política legal aplicable.

### Programación

- La UI programa exactamente siete días antes; la API admite entre 1 y 30 días.
- El aviso anticipado se agenda a las 09:00 de la zona horaria del tenant.
- Si al confirmar o reprogramar ya se está dentro de la ventana, se crea `LATE_SCHEDULED` para envío inmediato y el texto aclara que no fue un aviso anticipado.
- Un compromiso tentativo no programa el aviso hasta `CONFIRM`.
- Si un mensaje anterior pudo haber salido, reprogramar o cancelar crea una comunicación correctiva versionada.
- Una reprogramación dentro de la ventana evita duplicar simultáneamente un mensaje `RESCHEDULED` y otro `LATE_SCHEDULED`.

### Worker y frontera con el proveedor

`vercel.json` programa `/api/cron/supplier-reminders` cada 15 minutos. Cuando ese cron está desplegado y habilitado, la función declara 60 segundos de duración máxima; el worker reserva 45 segundos y procesa hasta cuatro filas por ejecución, una por vez.

Antes de llamar a Resend, el worker:

1. reclama atómicamente una fila con `FOR UPDATE SKIP LOCKED` (`PENDING/FAILED → CLAIMED`);
2. toma el bloqueo de la obra y vuelve a validar revisión de agenda, ventana aún vigente, estado, email confirmado sin cambios, proveedor activo, obra activa/en planificación y supresiones previas;
3. cancela la fila si el fence quedó obsoleto;
4. cruza la frontera de envío recién al pasar a `DISPATCHING`;
5. envía con la `providerIdempotencyKey` persistida.

Un lease vencido en `CLAIMED` puede volver a `PENDING` porque todavía no cruzó la frontera. Un lease vencido en `DISPATCHING` pasa a `UNCERTAIN`: puede haber llegado al proveedor y no se reintenta automáticamente.

Resend conserva la deduplicación de una clave idempotente durante una ventana limitada de 24 horas; por eso la aplicación persiste una clave determinista, pero no usa esa ventana como excusa para repetir un envío ambiguo. Véanse la [documentación de idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys) y la [API de envío](https://resend.com/docs/api-reference/emails/send-email).

### Estados de entrega y acción operativa

| Estado | Interpretación | Acción |
| --- | --- | --- |
| `PENDING` | Aún no corresponde o está listo para reclamar. | Esperar al cron. |
| `CLAIMED` | Reservado antes de la frontera del proveedor. | Un lease vencido se recupera de forma segura. |
| `DISPATCHING` | La llamada puede estar en curso. | No mutar el compromiso; un timeout pasa a `UNCERTAIN`. |
| `PROVIDER_ACCEPTED` | Resend aceptó el mensaje y devolvió ID. | No confundir con entrega. Esperar webhook. |
| `DELIVERY_DELAYED` | El proveedor informa demora. | Observar; no reenviar por este estado. |
| `DELIVERED` | Webhook de entrega aplicado. | Cerrar seguimiento técnico. |
| `FAILED` | Fallo definitivo clasificado como reintentable. | Reintento con `Retry-After` válido o backoff exponencial determinista. |
| `DEAD_LETTER` | Fallo no reintentable o seis intentos agotados. | Intervención humana. |
| `UNCERTAIN` | Resultado de transporte o dispatch ambiguo. | No reintentar a ciegas; reconciliar proveedor y decidir corrección. |
| `CONFLICT` | Resend rechazó por conflicto/idempotencia. | Revisar namespace, payload y trazas; no regenerar una clave para forzar el envío. |
| `BOUNCED`, `COMPLAINED`, `DELIVERY_FAILED`, `SUPPRESSED` | Incidente terminal del destino. | Corregir/autorizar el contacto. Envíos futuros a esa dirección se cancelan. |
| `CANCELLED` | Fila obsoleta por cambio de versión/fence/supresión. | No enviar. |

Los fallos HTTP 408, 429 y 5xx pueden reintentarse hasta seis intentos. Los demás fallos definitivos terminan en `DEAD_LETTER`. Una excepción de red, timeout o aceptación sin ID es `UNCERTAIN`, no `FAILED`.

### Webhooks

El endpoint verifica `svix-id`, `svix-timestamp` y `svix-signature` contra el body crudo mediante el SDK oficial. Durante una rotación controlada acepta el secreto actual y el anterior.

Los eventos se guardan en un inbox append-only antes de aplicarse. El mismo ID con otro contenido devuelve conflicto; eventos adelantados se conservan y se reconcilian cuando se persiste el ID del mensaje; los eventos fuera de orden respetan `occurredAt` y no degradan un estado con información más antigua. Resend entrega webhooks al menos una vez y puede hacerlo fuera de orden, por lo que esta reconciliación es parte del contrato, no una optimización. Véanse [verificación de firmas](https://resend.com/docs/webhooks/verify-webhooks-requests) y [semántica de webhooks](https://resend.com/docs/webhooks/introduction).

## Variables de entorno

| Variable | Obligatoria para enviar | Uso |
| --- | --- | --- |
| `SUPPLIER_REMINDER_EMAIL_ENABLED` | Sí, valor exacto `true` | Feature gate fail-closed. |
| `RESEND_API_KEY` | Sí | Credencial server-side de Resend. |
| `RESEND_FROM_EMAIL` | Sí | Remitente, por ejemplo `ObraSaaS <operaciones@subdominio.example>`. |
| `RESEND_VERIFIED_FROM_DOMAIN` | Sí | Dominio o dominio padre que debe coincidir con el remitente. |
| `RESEND_IDEMPOTENCY_NAMESPACE` | Sí | Namespace único por cuenta Resend y ambiente, máximo 64 caracteres. |
| `RESEND_WEBHOOK_SECRET` | Sí | Verificación del webhook firmado. |
| `RESEND_WEBHOOK_SECRET_PREVIOUS` | No | Sólo durante una rotación controlada. |
| `RESEND_REPLY_TO` | No | Dirección operativa de respuesta. |
| `CRON_SECRET` | Sí | Bearer independiente para los crons internos. |

La migración usa además las conexiones PostgreSQL gobernadas del proyecto (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`/`DIRECT_URL`). No se deben copiar claves en documentación, logs, capturas ni commits.

## Runbook de habilitación

### 1. Validación local

Desde el worktree de la rama:

```powershell
npm.cmd run db:generate
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

El verificador de migración no es estático: necesita PostgreSQL y la migración ya aplicada. Para una rama de Neon de prueba, después de `prisma migrate deploy`:

```powershell
$env:SUPPLIER_COMMITMENT_MIGRATION_DATABASE_URL = $env:DIRECT_URL
$env:SUPPLIER_COMMITMENT_MIGRATION_SCHEMA = "public"
npm.cmd run verify:supplier-commitment-migration
$env:GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_DATABASE_URL = $env:DIRECT_URL
$env:GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_SCHEMA = "public"
npm.cmd run verify:goods-receipt-commitment-allocation-migration
Remove-Item Env:SUPPLIER_COMMITMENT_MIGRATION_DATABASE_URL
Remove-Item Env:SUPPLIER_COMMITMENT_MIGRATION_SCHEMA
Remove-Item Env:GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_DATABASE_URL
Remove-Item Env:GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_SCHEMA
```

Los tests y verificadores estáticos no sustituyen la ejecución de la migración contra PostgreSQL/Neon.

### 2. Neon Preview

1. Crear o seleccionar una rama Preview aislada; no apuntar Preview a Production.
2. Configurar `DATABASE_URL`, `DATABASE_URL_UNPOOLED` y/o `DIRECT_URL` para la misma identidad de base.
3. Ejecutar el release gobernado (`npm.cmd run build:vercel`) o `prisma migrate deploy` dentro del procedimiento aprobado.
4. Ejecutar `verify:supplier-commitment-migration` contra la conexión directa.
5. Confirmar tablas, FKs compuestas, constraints civiles y triggers `ENABLE ALWAYS`.
6. Probar tenant equivocado, obra equivocada, OC de otro proveedor, replay idempotente y revisión CAS obsoleta.
7. Crear una recepción parcial y comprobar que no se puede sobrecomprometer una partida.

El build protegido de Vercel ya agrega este verificador después de `prisma migrate deploy`. En Production también exige identidad de base aprobada y que `OBRASAAS_PRODUCTION_MIGRATION_RELEASE_SHA` coincida con el commit del deployment.

### 3. Resend

1. Crear una integración/cuenta exclusiva del ambiente.
2. Verificar el dominio de envío y sus registros DNS; usar un subdominio transaccional dedicado si corresponde. Guía: [Resend Domains](https://resend.com/docs/dashboard/domains/introduction).
3. Crear el webhook `https://<host>/api/webhooks/resend` para `email.delivery_delayed`, `email.delivered`, `email.bounced`, `email.complained`, `email.failed` y `email.suppressed`.
4. Cargar API key, remitente, dominio, namespace y secreto del webhook en Vercel, con valores distintos por Preview/Production.
5. Mantener `SUPPLIER_REMINDER_EMAIL_ENABLED=false` hasta verificar firma, evento adelantado, replay, evento fuera de orden y supresión.
6. Rotar el secreto desplegando primero el nuevo como actual y el anterior en `RESEND_WEBHOOK_SECRET_PREVIOUS`; retirar el anterior sólo después de drenar eventos en vuelo.

La confirmación del dashboard de Resend y la presencia de DNS no prueban por sí solas la entrega al buzón: hace falta un envío controlado y su webhook correlacionado.

### 4. Vercel

1. Confirmar que el proyecto usa un plan que admite frecuencia de 15 minutos. Hobby admite crons, pero sólo una ejecución diaria; este `*/15` requiere un intervalo por minuto de Pro/Enterprise. Referencia: [uso y límites de Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing).
2. Configurar todas las variables sólo en los ambientes correctos.
3. Recordar que Vercel Cron ejecuta deployments de Production; para Preview, invocar el endpoint manualmente con el bearer del ambiente o usar una estrategia de staging explícita. Referencia: [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs).
4. Crear un compromiso de servicio de prueba a más de siete días, confirmar que existe una fila `UPCOMING` y adelantar la prueba en un ambiente descartable o con reloj controlado.
5. Invocar el cron y verificar `PROVIDER_ACCEPTED`; luego comprobar `DELIVERED` mediante webhook.
6. Repetir con 429, timeout, conflicto, bounce, complaint, webhook adelantado y reprogramación concurrente.
7. Configurar alertas sobre `status=degraded`, `UNCERTAIN`, `CONFLICT`, `DEAD_LETTER`, backlog y estados terminales de entrega.

Una invocación controlada desde PowerShell puede usar variables del proceso sin imprimir el secreto:

```powershell
$supplierCronHeaders = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Method Get -Uri "$env:OBRASAAS_BASE_URL/api/cron/supplier-reminders" -Headers $supplierCronHeaders
```

### 5. Gate de promoción

No habilitar Production hasta conservar evidencia de:

- migración y verificador exitosos en la base objetivo;
- lectura/escritura por rol y aislamiento cross-tenant;
- creación, replay, concurrencia y reprogramación auditada;
- `.ics` de 90 días importado en al menos los clientes de calendario soportados, con reimportación/cancelación documentadas;
- dominio/remitente verificado y email de prueba recibido;
- webhook firmado correlacionado con el `providerMessageId`;
- comportamiento `UNCERTAIN` sin reenvío automático;
- supresión posterior a bounce/complaint/failure;
- cron observado durante una ventana suficiente, sin backlog ni leases vencidos;
- owner, alerta y procedimiento para corrección manual;
- backup/restore y rollback de aplicación compatibles con la migración.

## Evidencia actual y pendientes

### Existe en el repositorio

- esquema Prisma y migración `20260801090000_supplier_commitments_and_calendar`;
- verificador de migración conectado al build gobernado;
- dominio, API, UI de Compras, calendario JSON/`.ics`, worker y webhook;
- aritmética exacta en OC, compromisos y recepciones, con saldos históricos server-owned y consultas acotadas a las 500 órdenes visibles;
- feature gate fail-closed, idempotencia, CAS, locks, fence de agenda y eventos auditados;
- pruebas unitarias/de contrato específicas para compromisos, Gantt, email, cron, webhook y migración.

### Evidencia de Preview al 2 de agosto de 2026

- rama `codex/platform-ux-foundation`, commit de despliegue `514c37d`;
- deployment Vercel Preview `dpl_FvYbKsfQYjhFY16VmPnZG5jPV7rX`, estado `Ready`;
- migración `20260801090000_supplier_commitments_and_calendar` aplicada sobre la rama Neon de Preview protegida por identidad;
- verificador semántico ejecutado contra PostgreSQL real: checksum/catálogo, relaciones de procurement, guards `ENABLE ALWAYS` y smoke rollback-only;
- build remoto completo: 82 páginas generadas y las rutas de calendario, compromisos, cron y webhook incluidas;
- smoke sin sesión: portada `200`, superficies privadas ocultas por Clerk, cron sin bearer `401` y webhook sin secreto `503`;
- consulta de logs posterior al despliegue sin errores de runtime.
- commit `d9bc2b5` desplegado como `dpl_BgdEVh9n3wJunmvrMSXw9GCBCaSK`, estado `Ready`; el preflight read-only del outbox pasó con 0 filas incompatibles antes de `prisma migrate deploy`, no hubo migraciones pendientes y los verificadores post-migración pasaron;
- smoke sin sesión del nuevo artefacto: portada `200`, Compras/API privadas ocultas por Clerk, cron de notificaciones sin bearer `401` y ninguna respuesta `5xx` observada.
- commit `3181807` desplegado como `dpl_GdrLvspbHK7ttZEA7EW88WGzX4Me`, estado `Ready`; aplicó/verificó las migraciones 112/113 de conciliación, incluido scope cross-tenant, exceso de `0.001`, append-only, remito `VOIDED` terminal y lock con dos conexiones;
- evidencia reproducible y límites del corte: [2026-08-02-preview-3181807.md](./evidence/2026-08-02-preview-3181807.md).

Esta evidencia certifica el artefacto y la migración de **Preview**. No certifica el envío de correo, el journey autenticado ni Production.

### No está certificado todavía

- migración aplicada y verificada en Neon Production;
- dominio real y remitente verificados en Resend;
- secreto/webhook real y ciclo accepted → delivered;
- ejecución real del cron de Vercel;
- smoke autenticado completo de la UI en Preview;
- E2E de permisos y concurrencia contra infraestructura real;
- feed de calendario sincronizado/revocable;
- confirmación del email por el proveedor;
- inspección/aceptación, excepciones y cierre final de faltantes;
- ledger de stock, reservas y BOM por tarea antes de `AVAILABLE`;
- paginación de la vista de más de 500 compromisos;
- alertas internas a Compras/Director y su escalamiento.

Hasta completar esos gates, la redacción correcta es **“funcionalidad desplegada y verificada en Preview, con correo externo deshabilitado”**, no “en producción” ni “proveedores notificados”.
