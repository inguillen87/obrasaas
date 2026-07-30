# Roadmap de producto y profesionalización

**Corte de evidencia:** 29 de julio de 2026

**Rama de trabajo:** `codex/platform-ux-foundation`

**Estado:** especificación funcional v1.0 de la clienta integrada y contrastada contra el repositorio. La evidencia se separa entre código/pruebas locales, migración en Preview aislado, journey UI y E2E externo. No hubo deployment ni migración de aplicación en Production durante este corte; subsiste el incidente documentado de una posible sincronización de membresía causada por el webhook compartido de Clerk development ([evidencia](./evidence/2026-07-28-preview-c91cee0.md)).

## Propósito

Este documento convierte el estado real de ObraSaaS en un plan ejecutable. Distingue cuatro situaciones que no deben mezclarse:

- **Confirmado:** existe código de aplicación, autorización, persistencia y pruebas relevantes; no implica despliegue o proveedor real salvo indicación explícita.
- **Parcial:** existe una superficie útil, pero el dominio o el workflow todavía no es completo.
- **Pendiente de validación externa:** el contrato está implementado, pero depende de un proveedor o ambiente real.
- **No implementado:** es una capacidad de roadmap y no se debe presentar como disponible.

La especificación recibida el 23 de julio de 2026 fue revisada página por página y normalizada en [CLIENT_SPEC_TRACEABILITY.md](./CLIENT_SPEC_TRACEABILITY.md). Ese documento conserva el requisito original, el estado comprobado, la decisión de producto y el sprint objetivo. Este roadmap define la secuencia ejecutable; no interpreta como obligación literal formulaciones riesgosas como “100% WhatsApp”, certificación automática desde una foto o pago automático.

## Mapa de evidencia de este corte

| Capa | Estado comprobado |
| --- | --- |
| WIP local | 107/107 migraciones aplican en PGlite; las cuatro H4 `13000-13300` y su reconciliador sólo tienen evidencia local. El corte actual aprobó 1.730/1.730 pruebas, `prisma validate`, lint y build; esto no reemplaza la verificación pendiente en Neon/Vercel/Meta |
| Último Preview reproducible | 100 migraciones y commit `0a00f37` `Ready`, con alias, verificadores y smokes documentados ([evidencia](./evidence/2026-07-29-preview-0a00f37.md)) |
| E2E externo | WhatsApp bidireccional sobre tenant conectado, media real, foto de obra y journey visual siguen pendientes |
| Production | Sin deployment ni migración de estos cambios; se conserva aparte el incidente Clerk de posible sincronización de membresía ([evidencia](./evidence/2026-07-28-preview-c91cee0.md)) |

## Posicionamiento recomendado

> ObraSaaS convierte información de campo no estructurada en borradores y registros operativos gobernados, vinculados a su evidencia y sujetos a reglas de aprobación. WhatsApp es el canal; ObraSaaS es la fuente de verdad.

WhatsApp es una interfaz de captura y notificación; ObraSaaS debe ser la fuente de verdad. El diferencial no puede ser solamente “IA + WhatsApp”: Sienge ya publica consultas de planificación y cotizaciones por WhatsApp, y ObraFlow se presenta con reportes de campo por ese canal. La ventaja defendible es cerrar el circuito completo **campo → revisión → registro canónico → cronograma/costo → evidencia → comunicación**, sin reingreso manual y sin permitir que la IA ejecute acciones sensibles por su cuenta.

Política de automatización objetivo:

| Acción | Política |
| --- | --- |
| Consultar información autorizada | Automática, con fuente y alcance visibles |
| Estructurar un mensaje o crear un borrador | Automática, con confianza y evidencia enlazada |
| Modificar una operación | Requiere aprobación de un rol autorizado |
| Cambiar costo, pago, seguridad o contrato | Requiere validación reforzada según rol y monto/riesgo |

## Línea base comprobada

ObraSaaS ya es una base SaaS real; no es sólo una maqueta. Tiene tenancy B2B, roles operativos, alcance por obra, auditoría, proyectos, Gantt, WhatsApp persistente, Flows gobernados, aprobaciones humanas, evidencia privada, asistencia y reportes PDF. Prisma, lint, build y la suite local permanecen como gates de cada corte. Baseline/forecast fueron verificados en Preview aislado; el puente local revisión visual → observación inmutable → forecast/Gantt todavía requiere aplicar su nueva migración y recorrer el journey autenticado en Preview.

Eso todavía no demuestra una operación Enterprise con clientes reales. Los principales límites actuales son la falta de validación externa con un WABA real, Clerk sobre instancia development, journeys E2E operativos insuficientes, convivencia temporal entre WBS canónica y snapshot legacy, equipos/blockers/costos/certificación incompletos y dominios profesionales pendientes en documentos, calidad, contratos, stock y colaboración externa.

### Matriz de capacidades

| Dominio | Estado | Evidencia actual | Decisión |
| --- | --- | --- | --- |
| Tenancy, roles y alcance por obra | Confirmado | Clerk Organizations, permisos en servidor, `ProjectMembership` y pruebas negativas | Conservar; preparar gobierno de Platform Admin y futura defensa en profundidad |
| Portfolio y onboarding | Confirmado | Alta/configuración/archivo de obras, límites por plan y puesta en marcha | Medir tiempo hasta primera obra operativa |
| Gantt y tareas | Motor en Preview; puente visual/Gantt local | WBS `Task`/`TaskDependency`, CAS, baseline inmutable/versionada, forecast determinista y Gantt canónico; una planificación relativa sobrevive aunque la obra aún no tenga calendario. Una decisión humana sobre evidencia revisada puede crear una observación append-only y comparación baseline/forecast por tarea | Aplicar/verificar la migración H5, cerrar smoke UI autenticado, ejecutar cutover legacy con cero drift y completar responsables/equipos/blockers antes de conectar costos contractuales |
| WhatsApp e Inbox | Confirmado por contrato; externo pendiente | Meta Cloud API directa como camino primario; app/caso de uso presentes; test number asignado, un celular propio verificado, outbound histórico aceptado y test oficial firmado `messages v25.0` recibido por Preview con HTTP 200. Firma, idempotencia, leases, Inbox, Flows operativos, Flow pre-operario H3.1, media privada y vínculo foto→`ProgressEvidence` están cubiertos localmente | El test del panel no prueba entrega ni E2E. Faltan challenge y tráfico inbound/estados reales, credencial del tenant importada cifrada, todos los Flows, storage y conexión real; Twilio no sustituye esos gates |
| IA visual y OCR | Infraestructura Preview gobernada; foto/E2E pendientes | `VisualProgressAssessment`, opt-in tenant, lease recuperable, sanitización, rango/abstención y revisión CAS; OpenAI `gpt-5.6-sol` es la ruta primaria gobernada, Terra es shadow explícito y HF/Z.ai permanecen como challengers por contrato. La credencial dedicada, presupuesto diario, esquema/recibo durable y verificadores de concurrencia/rollback están desplegados y verdes en Neon Preview; un smoke no personal confirmó visión y usage/cache completo | Probar una foto Meta real y un benchmark consentido antes de cualquier claim productivo; cerrar DPA/ZDR o retención aceptada, replay/conciliación autenticados y nunca certificar/pagar/reprogramar desde una foto |
| Propuestas y aprobación humana | Confirmado | Avance, demora e incidente crítico con decisión auditada | Extender el patrón a diarios, calidad, costos y cambios |
| Asistencia y salud | Parcial | Ledger canónico con ingreso, pausas, salida, GPS conservador, idempotencia, jornada y reporte; evidencia médica aislada | Completar S2 (turnos, tolerancia, excepciones y corrección aprobada) y el gate legal; no venderlo como nómina |
| Identidad laboral y destino de cobro | H3.1 Preview; H4 local, emisión/Meta pendientes | H3.1 incluye Flow pre-operario, aviso fijado, acuse terminal, CRM/readiness y purga transitoria; `d6b29b9` aplicó sus migraciones en Neon aislado y quedó `Ready`. H4 agrega consentimiento específico, re-atestación, CRM enmascarado, Data Endpoint terminal y reconciliación DB-only de `UNCERTAIN` con procedencia exacta, sin replay de efectos; sus cuatro migraciones `13000-13300` sólo pasaron PGlite local | Completar smoke H3.1, orquestador H4, Neon y Vercel Preview, publicación/Meta E2E, titularidad y comprobante. La purga no es DSAR y el teléfono raw en `Conversation.externalId` sigue como deuda |
| Incidencias y seguridad | Parcial | Captura y propuestas; el modelo relacional no es el workflow canónico | Crear propietario, SLA, causa, acciones correctivas y cierre |
| Acopios | Parcial | Catálogo y niveles básicos | Migrar a ledger inmutable de recepción, consumo, ajuste y ubicación |
| Costos y rol Finance | Parcial, base local no desplegada | `BudgetVersion`, `BudgetLine` y `BudgetEntry` separan presupuesto, comprometido, real y forecast; hay dashboards de presupuesto, compras, cuentas a pagar y caja | Completar cambios aprobados, reconciliación, KPIs/drill-down, cutover sobre la misma WBS y validar Preview/E2E |
| Caja chica y comprobantes | Parcial, base local no desplegada | `CashFund`/`CashMovement`, saldo derivado, categoría, idempotencia y comprobante privado server-owned | Implementar umbral y segundo aprobador distinto, reposición/cierre/conciliación, Preview y E2E |
| Evidencia y adjuntos privados | Parcial; storage y lifecycle media verificados en Preview | `ProtectedUpload` de un solo uso, Blob privado y lifecycle durable de media WhatsApp `070000` ya pasaron el gate Neon/Vercel; progreso web, caja, recepción y factura cuentan con intent durable, scope, expiración, CAS, cuotas, hash y entrega server-side | Observar cron y descarga con media Meta real, completar alertas, retención/purga, restore, carga directa para más de 4 MiB y degradación de ambos adapters |
| Reporte semanal | Parcial | PDF real con hash y auditoría, generado al vuelo | Persistir artefacto y snapshot reproducible con historial y retención |
| Bitácora | Parcial | Agrega fuentes reales, pero recorta a eventos recientes | Cursor estable, filtros server-side y exportación completa con hash |
| Documentos, planos y versiones | No implementado | No hay modelo canónico | Construir control documental antes de RFI/submittal avanzados |
| QA/QC, inspecciones y no conformidades | No implementado | Sin workflow canónico | Compartir formularios, evidencia, responsable, SLA y cierre |
| RFI, submittal y transmittal | No implementado | Sin modelos ni rutas | Implementar después de documentos/versiones y notificaciones |
| Notificaciones durables | Parcial | `NotificationDelivery`, preferencias y deduplicación existen; faltan workers/proveedores y DLQ operacional completa | Completar entrega email/WhatsApp, métricas, retry/dead-letter, lectura y escalamiento |
| Portal de cliente/subcontratista | No implementado | No existe una experiencia externa gobernada | Agregar enlaces/portal con permisos mínimos y evidencia aprobada |
| Offline/PWA | No implementado | Manifest y estado online; sin service worker ni cola local | Diseñar sincronización y conflictos después de estabilizar APIs canónicas |
| API pública e integraciones | No implementado | Integraciones internas con proveedores; sin API pública versionada | API, scopes, rate limit, webhooks tenant y conectores antes de prometer ERP/BI |
| Billing | Parcial y cerrado por defecto | Backend Stripe/webhook; checkout exige flag exacto, entrada estricta y versiones vigentes, pero no hay intención/consentimiento durable ni control de concurrencia | Mantener deshabilitado hasta cerrar intención idempotente, UI, evidencia contractual, reconciliación y E2E |
| Observabilidad y operaciones | No suficiente | Analytics web anonimizado; sin APM, SLO, alertas ni DR probado | Es gate de producción, no mejora opcional |
| CI y E2E | En implementación | 1.538 tests locales, Prisma, lint, build y auditoría de producción verdes; E2E público separado y workflow CI agregados | Requiere ejecución remota verde y expansión a journeys autenticados/Meta/storage/visión |
| Internacionalización | No implementado | UI y formatos mayormente `es-AR` | Agregar español regional, portugués, zona horaria y multimoneda sin mezclar fiscalidad |

Fuentes internas principales: [autenticación y tenancy](./AUTH_AND_TENANCY.md), [ledger de asistencia](./ATTENDANCE_LEDGER.md), [contrato transitorio de tareas](./OPERATIONAL_TASKS.md) y [estado verificable de Meta](./WHATSAPP_META.md).

## Gates P0 antes de declarar producción comercial

Estos gates pueden avanzar en paralelo, pero ninguno se reemplaza con una captura o una prueba unitaria.

| Gate | Evidencia de salida | Estado al 28/07/2026 |
| --- | --- | --- |
| Especificación de la clienta trazada | Requisito, decisión, secuencia y criterio de aceptación por cada ítem | 92 IDs únicos integrados (80 SPEC + 12 PRO); validación con la socia y casos de prueba detallados pendientes por vertical |
| Calidad automatizada | CI remota verde con instalación exacta, lint, suite completa, auditoría, build y smoke público | 1.538/1.538, Prisma, lint, build, auditoría de dependencias de producción y migración/verificador PostgreSQL 17.5 verdes localmente; ejecución GitHub y E2E remoto pendientes |
| Journey operativo E2E | Admin crea obra/trabajador/tarea, aprueba propuesta y descarga reporte; roles restringidos fallan correctamente | Pendiente |
| WhatsApp real | Embedded Signup, inbound/outbound, estados, Flows operativos y pre-operario, reintento, expiración y fallback en teléfono real | Test number asignado, celular propio verificado, outbound histórico aceptado y test oficial firmado del panel recibido con HTTP 200. No es bidireccional/E2E: faltan publicación/revisión aplicable, credencial cifrada del tenant, challenge y tráfico inbound/estados reales, Flows y conexión real |
| Identidad productiva | Dominio propio, Clerk Production, cutover y rollback ensayados, alta/invitación/baja verificadas | Pendiente externo |
| Billing coherente | Checkout explícitamente deshabilitado o intención idempotente, UI, consentimiento, términos, precios y webhooks reconciliados | Cerrado por defecto; versiones exactas requeridas; intención durable, concurrencia, UI y webhook pendientes |
| Salud operacional | Errores, backlog, latencia y proveedores con señal, correlación, redacción y alerta accionable | Parcial; primer control de cron en esta rama |
| Migraciones gobernadas | Postgres efímero, `migrate deploy`, estado, diff sin drift, smoke y rollback documentados | Gate CI y drift UUID corregidos localmente; ejecución remota y smoke de promoción atómica/drenaje pendientes; no admitir pods v1/v2 balanceados |
| Backup, restauración y borrado | RPO/RTO, restore drill y ledger de exportación/borrado sobre todos los proveedores | Pendiente; la purga local H3.1 cubre sólo el claim transitorio, no `WorkerPerson`, canales, trabajadores, mensajes ni backups y no constituye DSAR |
| Gobierno de plataforma | Dos custodios, MFA/step-up y procedimiento break-glass para administración global | Pendiente |
| Seguridad, privacidad y legal por dominio | Threat model y revisión focal antes de datos laborales, finanzas, contratos, documentos sensibles, externos e IA | Pendiente; gates definidos en este roadmap |

Los dominios sensibles requieren revisión focal antes de implementarse y una revisión independiente antes del release que los exponga. El pentest y la validación legal especializada siguen siendo gates propios; este diagnóstico no los sustituye.

## Principios de secuenciación

1. **Verdad antes que marketing.** Una capacidad externa se publica sólo después de una prueba reproducible.
2. **Modelo canónico antes que offline o integraciones.** Sin APIs lossless, la sincronización sólo multiplica conflictos.
3. **Una WBS compartida.** Cronograma, avance, presupuesto, comprometido, real y forecast deben referirse a las mismas identidades.
4. **Borrador antes que mutación de IA.** La automatización crea propuestas; las políticas y los roles autorizan la acción.
5. **No construir un motor BIM.** Autodesk ya domina ese problema; ObraSaaS debe enlazar documentos/modelos e integrar proveedores.
6. **Participación externa con privilegio mínimo.** WhatsApp y enlaces seguros reducen fricción sin convertir el canal en fuente de verdad.
7. **Cada sprint deja un vertical utilizable.** Modelo, API, UI, permisos, auditoría, migración, observabilidad y pruebas salen juntos.

## Roadmap ejecutable

La cadencia candidata es de diez días hábiles por sprint. Sin capacidad de equipo, reglas contractuales cerradas ni métricas del piloto, esto no es una fecha comercial. Cada sprint de abajo tiene un solo vertical de salida; si no entra, se divide antes de empezar y no se oculta alcance como “carry-over”. La estimación de 4-6 semanas del PDF no contempla privacidad, migraciones, concurrencia, operación ni validaciones externas y no es defendible como compromiso.

### Sprint 0 — Ingeniería interna de readiness

**Objetivo:** impedir releases engañosas o silenciosamente rotas con controles que sí dependen del equipo.

- CI: Node 24, instalación exacta, lint, suite completa, auditoría, build, E2E público y artefactos de diagnóstico;
- Postgres 17 efímero y Neon Preview: `validate`, las 100 migraciones actuales, estado sin pendientes, verificadores semánticos y smoke rollback-only verdes; `070000`, `080000` y el hotfix `090000` atravesaron el gate remoto en `0a00f37`;
- checkout cerrado por defecto y request estricto; no habilitarlo sin intención durable, idempotencia, consentimiento verificable y reconciliación;
- E2E autenticado de los journeys críticos y denegaciones por tenant/obra/rol;
- observabilidad mínima, correlation ID y runbooks de migración/incidente/rollback.

**Salida:** checks remotos verdes y requeridos, migración idempotente, fallas de proveedor visibles y ningún camino comercial habilitado por accidente.

Estado de esta iteración:

- implementados localmente: CI base, E2E público sin secretos Clerk, artefactos Playwright, health de recuperación WhatsApp, gate de checkout, gate de migraciones, corrección de drift UUID y trazabilidad del PDF;
- verificados en este WIP local: 1.538/1.538 tests, Prisma válido/generado, lint, build, auditoría de dependencias de producción sin vulnerabilidades y migración/verificador desde cero en PostgreSQL 17.5; el gate Git/Vercel/Neon de `0a00f37` también quedó verde, mientras CI requerida y E2E autenticado/externo siguen abiertos;
- seguridad de tooling: `@prisma/dev` queda temporalmente fijado a Valibot 1.4.2 mediante override acotado por el advisory vigente; retirarlo cuando Prisma publique el pin corregido y mantener auditadas por separado las dependencias exclusivas de desarrollo;
- pendientes internos de S0: volver obligatoria la CI remota del repositorio, E2E autenticado/core, observabilidad integral y runbooks completos.

### Release Gate R0 — Dependencias externas, sin duración ficticia

R0 avanza en paralelo y no se declara cerrado por pasar un sprint:

| Gate | Evidencia necesaria |
| --- | --- |
| Identidad | dominio, Clerk Production, invitación/baja/cutover/rollback ensayados |
| WhatsApp | Conservar la evidencia parcial del test number, outbound histórico y test oficial firmado del panel; revocar/rotar el token temporal, importar cifrada la conexión del tenant y completar challenge más tráfico real firmado, WABA/número del tenant, revisión/publicación aplicable, inbound/outbound correlacionado, estados, Flows y reintentos. Meta directo es primario; Twilio sólo fallback |
| Datos | storage privado productivo; cron de limpieza de reservas desplegado y observado; backup, restore, retención y borrado verificados |
| Billing | `BillingCheckoutIntent` durable, lock/CAS, idempotencia Stripe, UI/versión aceptada y webhook reconciliado |
| Gobierno | owners, required checks, secretos rotables, incident response y aprobaciones legales aplicables |

No se ofrece producción comercial mientras un gate obligatorio para el alcance contratado siga abierto.

### Gates focalizados antes de dominios sensibles

La revisión legal, de privacidad y de seguridad no espera hasta S23:

| Antes de | Gate focalizado |
| --- | --- |
| S1-S2 | base laboral, proporcionalidad de foto/GPS, consentimiento, retención y excepciones |
| S7-S8 | segregación financiera, política de comprobantes, límites contables/fiscales y fraude |
| S9-S10 | contrato, unidades, retenciones, cadena de aprobación y significado jurídico del certificado |
| S13-S14 | clasificación documental, legajos sensibles, malware, retención y proveedor/nivel de firma |
| S16 | acuerdo de tratamiento y publicación de datos a actores externos |
| S17 | base legal/dataset, evaluación de riesgo y criterio de abstención de IA visual |
| cada release | revisión de amenazas del cambio y pruebas negativas; revisión independiente según riesgo |

S23 consolida y certifica controles ya revisados; no es la primera vez que se buscan riesgos.

### Ola 1 — Núcleo de campo canónico

| Sprint | Vertical de salida | Incluye | Criterio de salida |
| --- | --- | --- | --- |
| S1 | Ledger de asistencia | `CHECK_IN`, `BREAK_START`, `BREAK_END`, `CHECK_OUT`; hora servidor, GPS/accuracy, origen, evidencia y idempotency key | jornada reconstruible; sin pausas solapadas/doble cierre; replay y cruce de tenant fallan |
| S2 | Turnos y excepciones | calendario, tolerancia, tardanza, no-show, cierre pendiente, corrección aprobada y evento de alerta | presente/tarde/ausente deriva del schedule; horas y excepciones son reproducibles |
| S3 | WBS, tarea y baseline | WBS/código, dependencias, hitos, baseline/revisión, forecast/real, CAS, backfill y paridad | Motor y migraciones entregados en Preview aislado; falta smoke UI y cutover legacy con cero drift |
| S4 | Equipos y blockers | cuadrillas/responsables por ID, asignación versionada, bloqueo/causa/owner/recuperación | asignaciones no dependen de nombres libres; conflicto concurrente no pierde cambios |
| S5 | Bitácora, evidencia e incidencia | `DailyLog`, `ProgressEvidence`, `Incident`, media+GPS+task bajo un ID, owner/SLA/cierre | web/WhatsApp conservan evidencia y llegan al registro final sin reingreso ni fuga |
| S6 | Trabajo extra y replanificación | `ExtraWorkRequest`, `ExtraWorkSession`, vicio oculto, impacto preliminar y `ReplanScenario` | texto/audio/foto requieren la misma aprobación; ningún extra reescribe baseline/costo |

Estado local de S1 en esta iteración:

- implementado: ledger `AttendanceShift`/`AttendanceEntry`, máquina de estados completa, hora y zona del servidor, GPS puntual con `capturedAt` y control de frescura, idempotencia/CAS, enlaces firmados por acción y ligados a pending/jornada+revisión, WhatsApp, proyección restringida, bitácora y reporte semanal paginado;
- gobernado: migración expand/backfill/contract separada en pasos compatibles, verificador semántico, fixture legacy, bridge v1 con sunset y rollback sin destruir datos;
- aún abierto para cerrar S1 comercialmente: CI remota PostgreSQL, WABA/teléfono real, interrupción de red, observabilidad/runbook y decisión legal de GPS/foto/retención. La corrección append-only, turnos y excepciones fechadas pertenecen a S2.

### Ola 2 — Control económico y abastecimiento

| Sprint | Vertical de salida | Incluye | Criterio de salida |
| --- | --- | --- | --- |
| S7 | Presupuesto y costos canónicos | `BudgetVersion`, `CostCode`, `Commitment`, `Actual`, `Forecast`, `ApprovedChange`, WBS y moneda | presupuesto vigente = base + cambios aprobados; committed/actual/forecast reconcilian |
| S8 | Caja chica | fondo/custodio, ledger, comprobante, categoría, duplicado, umbral y doble aprobación | saldo deriva de movimientos; replay no descuenta dos veces; sin autoaprobación |
| S9 | Medición de avance | unidad/cantidad base/ejecutada, método, período, evidencia, corrección y aprobación | un porcentaje aislado no es medición; cada línea tiene base y trazabilidad |
| S10 | Certificación y reportes | certificado versionado, retenciones/ajustes, estado de pago separado, PDF/hash e informe semanal persistido | corregir crea versión; certificado no paga; re-descarga reproduce artefacto y SHA |
| S11 | Proveedores y compras | vendor, requisición/BOM por WBS, cotización, selección y OC versionada/aprobada | solicitar/aprobar son roles distintos; ninguna sugerencia IA compra automáticamente |
| S12 | Recepción y stock ledger | entregas parciales, remito/evidencia, aceptado/rechazado, consumo/transferencia/ajuste y readiness | duplicado no suma; faltante queda abierto; conformidad sólo alimenta revisión financiera |

Quedan fuera: nómina, impuestos, contabilidad general, cuentas por pagar automáticas y ERP fiscal propio.

### Ola 3 — Documentos y colaboración externa

| Sprint | Vertical de salida | Incluye | Criterio de salida |
| --- | --- | --- | --- |
| S13 | Documentos y planos | `Document`/`Version`, disciplina, revisión, vigencia, PDF/DWG seguro, vínculos y búsqueda | sólo una revisión vigente; obsoletas inmutables; permisos y archivos privados probados |
| S14 | Legajos y firma integrada | vault DNI/obra social/ART/certificados, expiración/retención y acta con proveedor aprobado | rol común no enumera legajos; hash/identidad/intención/versiones verificables; sin firma casera |
| S15 | Outbox y notificaciones | evento, destinatario, preferencia, canal, entrega/lectura, retry, dead letter y escalamiento | alerta durable, deduplicada y observable aunque no haya pestaña abierta |
| S16 | Portal de Cliente | `ExternalPrincipal`/`ProjectAccessGrant`, publicación aprobada, enlaces expirables y revocación | no consume/infiere `TenantMembership`; sólo ve artefactos publicados de su obra |

Estado de identidad laboral/cobro al corte: H3.1 ya incluye invitación, Flow/sesión pre-operario, aviso fijado, acuse terminal, CRM/readiness, decisión y purga transitoria, además del dominio criptográfico y APIs tenant-scoped. El commit `d6b29b9` aplicó originalmente sus dos migraciones en Neon aislado; el gate posterior de `0a00f37` volvió a verificar el esquema completo de 100 migraciones y quedó `Ready`. Eso no acredita todavía smoke UI/runtime, cron observado ni E2E Meta, y no implica despliegue en Production. `privacyPresentedAt` prueba que `INIT` sirvió el aviso, no lectura humana; el copy requiere revisión legal antes de trabajadores reales. La purga H3.1 no es DSAR integral y quedan fuera `WorkerPerson`, `WorkerChannelIdentity`, `Worker`, mensajes y backups; también sigue pendiente retirar el teléfono raw interno de `Conversation.externalId`.

H4 ya suma localmente consentimiento específico append-only por destino/canal, re-atestación legacy, panel CRM enmascarado, Flow companion de un solo uso, Data Endpoint terminal y reconciliación DB-only. La transición excepcional `UNCERTAIN → SUCCEEDED` exige un destino ya persistido con tenant, reserva, HMAC, tipo/fingerprint, claves de operación, canal y consentimiento exactos; no reejecuta bridge, proveedor ni WhatsApp. Sus cuatro migraciones nuevas `13000/13100/13200/13300` pasaron juntas PGlite local, no Neon Preview. Aún necesita el orquestador que emita y envíe el Flow, build/smoke H4 en Vercel Preview, publicación/Meta E2E, comprobante privado y proveedor confiable de verificación bancaria. Por lo tanto, H3 y H4 de [readiness del piloto WhatsApp](./PILOT_WHATSAPP_E2E_READINESS.md) siguen **en progreso**, no están en Production y no deben presentarse como funcionalidad disponible.

### Ola 4 — Inteligencia y operación avanzada

| Sprint | Vertical de salida | Incluye | Criterio de salida |
| --- | --- | --- | --- |
| S17 | Piloto de visión IA | dataset consentido, ground truth, adapter, rango/confianza/abstención, review y evals | una foto nunca certifica/paga; fuera de distribución deriva a humano; go/no-go medido |
| S18 | Una vertical QA/QC | inspección **o** no conformidad end-to-end, evidencia, owner, SLA, cierre y exportación | un workflow completo con E2E; restantes QA/RFI/submittal quedan visibles en backlog |
| S19 | Cambio contractual acotado | extra aprobado → solicitud de cambio → impacto plazo/costo → decisión reforzada | presupuesto/baseline cambian sólo tras aprobación; RFI/submittal/transmittal siguen backlog si no se priorizan |
| S20 | PWA offline | service worker, cola para asistencia/bitácora/evidencia, conflictos, adjuntos y limpieza | sin red/degradada pasa; conflicto no pisa versión; pérdida de dispositivo mitigada |

Una app nativa sólo se evalúa si S20 demuestra gaps concretos de background sync, cámara, GPS, push, MDM o stores.

### Ola 5 — LATAM, integraciones y Enterprise

| Sprint | Vertical de salida | Incluye | Criterio de salida |
| --- | --- | --- | --- |
| S21 | Configuración regional | locale, zona horaria, unidades, moneda, español regional y portugués priorizado | reportes reproducen configuración de obra; monedas no se mezclan implícitamente |
| S22 | API e integración piloto | API v1/OpenAPI, scopes/rate limit/idempotencia, webhooks y una integración ERP/BI/BIM | contrato versionado, credenciales rotables, replay/out-of-order seguros y runbook |
| S23 | Confiabilidad Enterprise | carga/capacidad, SLI/SLO, restore/PITR, Platform Admin, break-glass, WCAG y revisión independiente | cero críticos/altos abiertos; journeys por rol/tenant/móvil/carga; límites contractuales claros |

SSO/SCIM, más verticales QA/RFI/submittal, transmittals y conectores adicionales se priorizan por contrato después del primer vertical probado; no se simulan como demos incompletas.

## Definition of Done transversal

Un ítem no está terminado sólo porque existe una pantalla. Debe incluir:

- requisito y criterio de aceptación trazables;
- modelo/API/UI sin duplicar autoridad;
- autorización en servidor y pruebas negativas entre tenants, obras y roles;
- idempotencia, concurrencia, replay y orden fuera de secuencia cuando corresponda;
- auditoría con actor, origen, resultado y redacción de datos sensibles;
- migración, backfill, verificador, compatibilidad y rollback;
- errores observables, métricas, runbook y owner;
- experiencia responsive, teclado, lector de pantalla y estados vacíos/error/carga;
- tests unitarios/contrato, journey E2E y evidencia del proveedor si es externo;
- `npm run lint`, `npm test`, `npm audit --omit=dev`, `npm run build` y gates E2E verdes;
- documentación y copy comercial actualizados sin adelantar capacidades.

## Métricas de producto y operación

Primero se toma baseline durante el piloto; luego se fijan objetivos públicos. Métricas mínimas:

- tiempo desde alta hasta primera obra, primer trabajador y primer reporte válido;
- porcentaje de trabajadores invitados que completan un flujo sin soporte;
- tiempo mensaje → borrador estructurado → aprobación → registro final;
- tasa de duplicados, desambiguaciones, rechazos y correcciones de IA;
- antigüedad del webhook más viejo, terminales fallidos, bloqueos y estado de proveedores;
- tiempo medio de aprobación de avance, incidencia, costo y cambio;
- variación plan/real de plazo y presupuesto por WBS;
- sincronizaciones offline exitosas y conflictos por 1.000 operaciones;
- usuarios activos por rol, retención de obras y tickets de soporte por tenant;
- cobertura de journeys críticos, accesibilidad y errores por release.

Objetivos internos iniciales, todavía no SLA comercial: cero fuga entre tenants; 100% de acciones sensibles auditadas; cero mutación autónoma de costo/seguridad/contrato; backlog de webhooks visible y accionable; restauración ensayada antes del primer contrato productivo.

## Matriz de trazabilidad de la especificación

La matriz completa está en [CLIENT_SPEC_TRACEABILITY.md](./CLIENT_SPEC_TRACEABILITY.md). Cubre objetivo, roles, ocho módulos, alertas, requisitos técnicos, definiciones, fases, próximos pasos y capacidades profesionales omitidas por el PDF. Cada fila conserva ID estable, estado verificable, gap/criterio y secuencia.

Resumen de cobertura:

| Familia | Alcance | Sprints principales |
| --- | --- | --- |
| `SPEC-OBJ-*` | objetivo, geolocalización y arquitectura de canal | R0, S1-S23 |
| `SPEC-ROL-*` | Cliente, Equipo Líder y trabajadores de campo | S1-S20 |
| `SPEC-PER-*` | asistencia, jornada, legajos y acta | S1-S2, S14 |
| `SPEC-PLN-*` | Gantt, baseline, equipos, blockers y certificación | S3-S6, S9-S10 |
| `SPEC-AVA-*` | evidencia, avance, reportes e IA visual | S5-S6, S9-S10, S17 |
| `SPEC-MAT-*` | materiales, proveedores, compras, recepción y stock | S4, S11-S12 |
| `SPEC-DOC-*` | planos, versiones, alertas y consulta | S13, S15 |
| `SPEC-EXT-*` | imprevistos, vicios ocultos y trabajo extra | S5-S7, S19 |
| `SPEC-CASH-*` | caja chica, comprobantes y saldo | S7-S8 |
| `SPEC-REP-*` | dashboard, reportes y certificaciones | S7-S10, S15-S16 |
| `SPEC-ALT-*` | seis alertas pedidas | S2, S6, S8, S10-S16 |
| `SPEC-TEC-*` | WhatsApp, GPS, storage, IA, DB, PDF y push | S0, R0, S1-S23 |
| `SPEC-DEF-*` | definiciones operativas del documento | S3-S12, S19 |
| `SPEC-FAS-*` | cuatro fases y estimaciones originales | Reestimadas en S0/R0/S1-S23 |
| `SPEC-NEXT-*` | decisiones de arquitectura, stack y piloto | S0, R0, S1-S22 |
| `PRO-*` | gaps world-class no incluidos en la especificación | S0, R0, S7, S18-S23 |

Reglas de decisión:

- **Mantener:** ya existe y cumple; se enlaza evidencia y test.
- **Mejorar:** existe parcialmente; se explicita el delta.
- **Agregar:** falta y está alineado al posicionamiento.
- **Integrar:** otro proveedor resuelve mejor el núcleo, por ejemplo BIM o ERP fiscal.
- **Descartar/postergar:** no resuelve el problema objetivo, duplica autoridad o rompe la secuencia técnica.

Cada cambio de prioridad debe registrar motivo, dependencia, impacto y criterio de salida. La lista se reordena por riesgo de producción, valor del piloto y dependencia arquitectónica, no por cantidad de pedidos.

## Referencia competitiva vigente

- [Procore Platform](https://www.procore.com/platform) y [Procore AI Agents](https://www.procore.com/ai/agents): amplitud Enterprise, IA con permisos y revisión humana.
- [Autodesk Construction Cloud / Forma](https://construction.autodesk.com/) y [gestión de proyectos](https://construction.autodesk.com/workflows/construction-project-management/): BIM, documentos e integración diseño-construcción.
- [Fieldwire](https://www.fieldwire.com/) y [mobile/offline](https://www.fieldwire.com/support/fieldwire-on-mobile/): adopción de campo, planos, punch y trabajo sin conexión.
- [PlanRadar](https://www.planradar.com/us/platform/) y [gestión documental](https://www.planradar.com/product/construction-document-management/): documentación, QA/QC, tickets y trazabilidad.
- [Buildertrend](https://buildertrend.com/product-overview/): residencial, costos, cambios y experiencia de cliente/subcontratista.
- [Sienge Plataforma](https://sienge.com.br/sienge-plataforma/) y [WhatsApp en Construcompras](https://sienge.com.br/construcompras-integracao-whatsapp/): ERP LATAM y automatización por WhatsApp.
- [Enkontrol](https://enkontrol.com/erp-para-constructoras/): profundidad ERP para construcción e inmobiliario en México.
- [ObraFlow](https://obraflow.mx/): señal competitiva directa de captura de campo por WhatsApp en México.

La estrategia no es igualar la cantidad de módulos de Procore, el BIM de Autodesk ni la fiscalidad de cada ERP nacional. ObraSaaS debe ganar por adopción en campo, implementación rápida y trazabilidad desde el mensaje hasta una operación profesional y aprobada.
