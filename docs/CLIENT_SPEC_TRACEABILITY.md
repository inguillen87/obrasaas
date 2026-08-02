# Trazabilidad de la especificación funcional de la clienta

## Fuente y alcance

- Documento: `Documento_Especificaciones_App_Obra.pdf`
- Versión declarada: 1.0, julio de 2026
- Extensión: 16 páginas
- SHA-256: `0E2A52D79E0F0875F16CC24E30049D1359BC85589A68A9814BE2B70D790DC3B5`
- Revisión: extracción de texto y revisión visual de las 16 páginas el 23 de julio de 2026

El PDF original no se incorpora al repositorio mientras no esté definida su clasificación y autorización de distribución; el hash permite comprobar que futuras revisiones usan exactamente la misma fuente.

La página 11 contiene caracteres de cajas y conectores rotos en el PDF original. Las relaciones se reconstruyeron desde los flujos textuales de las páginas 3 a 10; la geometría dañada no se tomó como requisito exacto.

Este documento conserva el pedido original, el estado comprobado, la decisión de producto, el criterio de aceptación y la secuencia objetivo. No convierte una formulación del PDF en una obligación literal ni presenta una primitiva reutilizable como un dominio terminado.

## Dictamen ejecutivo

La visión está bien orientada al problema: control de personal, avance, materiales, evidencia y dinero desde un canal familiar para campo. Para convertirla en producto profesional se aplican cuatro límites:

1. WhatsApp es canal de captura y notificación; la web/PWA es el sistema de registro, revisión y administración.
2. Una foto aislada no certifica un porcentaje. La IA sólo puede crear una sugerencia con fuente, incertidumbre y abstención.
3. Avances o retrasos producen propuestas de impacto; nunca reescriben silenciosamente una baseline aprobada.
4. Medición, certificación, conformidad financiera y pago son estados distintos. ObraSaaS no ejecuta un pago por inferencia.

Estado de los journeys pedidos: H2 tiene un contrato local de captura foto-primero con geolocalización opcional, pero su migración aún no fue aplicada en Neon Preview y no existe E2E real con Meta. H4 ya incorpora localmente consentimiento, CRM, Data Endpoint terminal, caller inbound con emisión atómica de sesión base/companion, reconciliación DB-only de un resultado `UNCERTAIN` respaldado por procedencia exacta y una [constancia privada](./WORKER_PAYMENT_PRIVATE_RECEIPT.md) sólo por opt-in: acceso de 15 minutos, token reconstruido post-claim y transportado en fragmento, dato completo excluido y PDF dinámico sin storage. Las cinco migraciones H4 `13000-13400` y el recorrido siguen sin smoke en Neon/Vercel Preview ni Meta E2E; la constancia no prueba titularidad, validación bancaria ni pago. H5 ya convierte localmente una revisión humana en una observación append-only y un forecast comparado contra baseline, sin mutarla; faltan migración y journey autenticado en Preview y E2E con foto Meta real.

Arquitectura objetivo:

> Campo por WhatsApp/PWA → evidencia inmutable → borrador estructurado → validación humana → registro canónico → impacto aprobado en plazo/costo → reporte y comunicación autorizada.

## Estados permitidos

La columna **Estado** usa exclusivamente:

- **Implementado:** existe el requisito concreto con persistencia, permisos y pruebas relevantes.
- **Parcial:** existe una parte real, pero no el workflow completo pedido.
- **Ausente:** no existe el dominio o vertical productivo verificable.
- **Reformular:** la intención es válida, pero implementarla literalmente sería riesgoso o incorrecto.
- **Externo pendiente:** el contrato de código existe, pero falta probar proveedor, credenciales o ambiente real.

Los calificadores pertenecen a evidencia/decisión, no al estado.

## Secuencia de referencia

| Hito | Alcance |
| --- | --- |
| S0 | Readiness interno: CI, migraciones, E2E, observabilidad, billing cerrado y restore inicial |
| R0 | Gates externos continuos: WABA, Clerk Production, dominio, storage y proveedores reales |
| S1 | Ledger de asistencia: entrada, pausas, salida, correcciones y evidencia |
| S2 | Turnos, tolerancias, tardanzas, ausencias y excepciones |
| S3 | WBS, tareas canónicas, baseline, revisiones y dependencias |
| S4 | Equipos, asignaciones, readiness y blockers |
| S5 | Evidencia de avance, bitácora e incidentes |
| S6 | Trabajo extra, impacto y replanificación aprobada |
| S7 | Presupuesto y costos canónicos |
| S8 | Caja chica y conciliación |
| S9 | Medición de avance |
| S10 | Certificación, reportes e historial |
| S11 | Procurement: requerimiento, cotización, selección y orden de compra |
| S12 | Recepción, remitos, faltantes, movimientos y stock |
| S13 | Repositorio documental, planos y revisiones |
| S14 | Legajos, vencimientos y firma mediante proveedor integrado |
| S15 | Outbox, notificaciones, reintentos y acuses |
| S16 | Portal Cliente con `ExternalPrincipal` + `ProjectAccessGrant`, no `TenantMembership` |
| S17 | Piloto de visión IA con ground truth, confianza y abstención |
| S18 | Una vertical QA/QC completa; alcance restante al backlog |
| S19 | Change control acotado para trabajo extra; RFI, submittal y transmittal permanecen en backlog salvo repriorización |
| S20 | PWA offline y resolución de conflictos |
| S21 | Regionalización: locale, zona, unidades, moneda y journeys elegidos |
| S22 | API versionada, webhooks y una integración priorizada |
| S23 | Readiness Enterprise: gobierno, seguridad, SLO, DR y performance |

R0 no es un sprint de duración prometida: sus dependencias externas avanzan con owner, ambiente y evidencia hasta cumplir los gates.

## Objetivo y plataforma

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-OBJ-01 | Orden, claridad, transparencia, efectividad y control del personal | Parcial | Dashboard, auditoría, asistencia y evidencia existen, pero varios dominios siguen en snapshot o ausentes | Definir KPIs verificables de adopción, control, tiempo y error; no prometer resultados económicos sin baseline | S0-S23 |
| SPEC-OBJ-02 | Geolocalización y tiempo real | Reformular | La app usa lecturas puntuales de geolocalización reportada por el dispositivo y el contrato/copy probado declara que no hace seguimiento continuo ni garantiza GPS | Hora servidor, `accuracy`, geocerca, consentimiento y excepción; nunca presentarlo como tracking, presencia o identidad infalible | S1-S2 |
| SPEC-OBJ-03 | Operar 100% vía WhatsApp | Reformular | WhatsApp e Inbox existen; dashboard, aprobaciones y reportes requieren web autenticada | WhatsApp captura/notifica; web/PWA gobierna y ofrece fallback. Una caída de Meta no bloquea administración ni lectura | R0, S15-S16, S20 |
| SPEC-OBJ-04 | WhatsApp chatbot con integraciones web/app | Parcial | Arquitectura híbrida implementada por contrato; Meta asignó número de prueba, verificó destinatario, aceptó outbound histórico y entregó el test oficial firmado `messages v25.0` al Preview, pero no existe circuito bidireccional sobre un tenant conectado ni offline | Completar verificación/publicación de la app, importar credencial cifrada por tenant y validar inbound/estados/Flows en teléfono real; completar PWA sobre APIs canónicas | R0, S20 |

## Roles

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-ROL-01 | Cliente que visualiza obra y reportes | Ausente | No existe principal externo ni portal | Crear `ExternalPrincipal` + `ProjectAccessGrant` o equivalente; no reutilizar Auditor, `TenantMembership` ni un asiento interno por defecto | S16 |
| SPEC-ROL-02 | Administrador/Compras | Parcial | `ADMIN` y `FINANCE` existen; Finance tiene permisos nominales de costos | Separar presupuesto, caja, compras, recepción y conformidad; quien solicita no autoaprueba sobre umbral | S7-S12 |
| SPEC-ROL-03 | Director de Obra/Arquitecta | Implementado | Rol `DIRECTOR`, portfolio, proyectos, propuestas, reportes e integraciones están autorizados | Mantener el rol; sus capacidades futuras de certificación, cliente y cambio se validan en sus dominios respectivos | S3-S19 |
| SPEC-ROL-04 | Empleado/capataz/ayudante por WhatsApp | Parcial | `Worker` por teléfono/obra y roles `WORKER/FOREMAN/SITE_MANAGER/SAFETY` (`field-workers.js:4-45`) | Completar jornada, equipos, evidencia agrupada, trabajo extra y offline; baja/reasignación debe cortar acceso | S1-S6, S20 |

Las tres categorías comerciales del PDF no son un modelo de autorización suficiente. El objetivo conserva usuarios tenant, personas externas y trabajadores de campo como actores distintos.

## Módulo 1 - Personal y asistencia

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-PER-01 | Entrada con foto, GPS y timestamp | Parcial | `CHECK_IN` canónico usa hora servidor, GPS+accuracy+`capturedAt`, consentimiento, frescura de dos minutos, geocerca conservadora, enlace ligado al pending e idempotencia (`attendance.js`, `attendance-client.js`) | La foto sigue sujeta a decisión legal/privacidad, retención y alternativa operativa; no habilitar biometría implícita | S1, R0 |
| SPEC-PER-02 | Salida con foto, GPS y timestamp | Parcial | `CHECK_OUT` cierra sólo la jornada/revisión firmada, exige GPS puntual fresco y queda en el mismo ledger/auditoría (`attendance.js`, `attendance/route.js`) | Resolver el mismo gate legal de foto y validar el journey en teléfono/WABA real | S1, R0 |
| SPEC-PER-03 | Inicio y fin de almuerzo | Parcial | `BREAK_START/BREAK_END` están implementados, no se solapan y la salida no cierra una pausa implícitamente | Agregar corrección append-only aprobada y reglas de turno en S2 | S1-S2 |
| SPEC-PER-04 | Presentes, ausentes y llegadas tarde | Parcial | Hay estados de presencia; no hay horario esperado | Turno/calendario, tolerancia, no-show idempotente y excepción auditada | S2, S15 |
| SPEC-PER-05 | DNI, obra social, ART y certificaciones | Parcial | Ya existen esquema/migración `WorkerDocument`, tipos, versiones, estados, hash, lectura tenant-scoped y storage server-owned; todavía no hay carga productiva ni antivirus | Completar vault, upload idempotente, vencimiento/retención, descarga auditada y alerta; nunca en snapshot/inbox general | S14-S15 |
| SPEC-PER-06 | Acta de inicio firmada por las partes | Parcial | Ya existen esquema/migración `ProjectStartAct`, participantes, versiones, hash, lifecycle y lectura tenant-scoped; falta proveedor de firma | Definir jurisdicción y nivel jurídico; integrar proveedor con identidad, intención, hash, versión y timestamp. No fabricar firma propia | S13-S14, R0 |
| SPEC-PER-07 | Flujo diario “Hola” → almuerzo → “Chau” | Parcial | WhatsApp reconoce comandos de ingreso, pausa, reanudación y salida sobre una máquina idempotente contextual por jornada/obra | Validar wording real con la clienta, teléfono/WABA, expiración y fallback; sumar schedule/excepciones en S2 | S1-S2, R0 |

Decisión pendiente explícita: foto en entrada/salida no se elimina silenciosamente. La socia y la revisión legal deben definir necesidad, propósito, acceso, retención y alternativa manual; GPS sigue siendo evidencia puntual, no biometría ni tracking.

## Módulo 2 - Planificación y tareas

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-PLN-01 | Gantt ideal con tareas, plazos y responsables | Parcial, motor y calendario quincenal en Preview | `Task`/`TaskDependency` son la autoridad canónica para el Gantt y usan revisión CAS; baseline inmutable/versionada y forecast determinista ya existen. El read model desplegado agrega quincenas civiles 1–15/16–fin de mes y exportación `.ics` autenticada. Las dependencias FS/SS/FF/SF y su lag se preservan, pero la UI sólo crea nuevas relaciones FS/0 | Cerrar smoke autenticado e importación `.ics`, agregar editor visual de tipo/lag y responsable por ID, y retirar el writer legacy sólo después de probar paridad/cutover. El `.ics` actual es snapshot de 90 días, no sync vivo | S3, S11, S15 |
| SPEC-PLN-02 | Asignar tareas a equipos con anticipación | Parcial | Responsable actual se persiste por nombre; workers existen | Equipo/cuadrilla canónica, asignación versionada, vigencia y acuse/notificación durable | S4, S15 |
| SPEC-PLN-03 | Plan real adaptativo por avances/retrasos | Parcial, motor base en Preview y puente H5 local | Forecast determinista con dependencias FS/SS/FF/SF, lag y baseline inmutable; una revisión visual gobernada puede materializar una observación inmutable y un corte con deltas por tarea. La planificación relativa se rehidrata al fijar el calendario de obra | Aplicar migración H5 y recorrer UI autenticada en Preview; completar camino afectado y change control. Baseline nunca se reescribe | S6 |
| SPEC-PLN-04 | Pendiente y motivo de lo no ejecutado | Parcial | `isDelayed`, incidentes y demoras existen | Blocker con causa, owner, evidencia, impacto y fecha de recuperación | S4-S6 |
| SPEC-PLN-05 | Certificación de avance para quincena | Ausente | Hay porcentaje/aprobación operativa, no medición ni certificado contractual | Separar cantidad medida, aprobación técnica, certificado, conformidad financiera y referencia de pago | S9-S10 |
| SPEC-PLN-06 | Asignación → WhatsApp → evidencia → validación | Parcial | Sólo una imagen Meta de remitente autorizado, no médica y con comentario no vacío `AVANCE:`/`PROGRESO:` abre H2. La misma transacción liga la sesión al `mediaAssetId` exacto del webhook; después, Inbox vincula esa foto a `ProgressEvidence`. La ubicación es opcional y la revisión visual queda separada | Aplicar la migración en Neon Preview y validar con Meta/celular real captura u opt-out, stale fallback, offline y forecast posterior; ninguna notificación o retry correlaciona por tiempo ni duplica la operación | S4-S6, S15, R0 |

## Módulo 3 - Reportes y avances

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-AVA-01 | Avance con foto/video y GPS | Parcial | `ProgressEvidence` une foto privada, hash, tarea, autor y hora. La sesión H2 liga el asset exacto a una opción de geolocalización reportada por el dispositivo o `Continuar sin ubicación`; el opt-out conserva la foto sin coordenadas. El bearer viaja en fragmento, se borra antes de `INIT` y no se usa `sessionStorage` | Aplicar/verificar la migración y probar Meta/celular/storage reales, stale fallback, expiración, offline, replay y cross-tenant. La lectura no garantiza GPS, identidad ni presencia; falta video | S5 |
| SPEC-AVA-02 | IA estima porcentaje por foto | Reformular | Adapter gobernado con rango o abstención, derivado sin metadatos y smoke controlado de `gpt-5.6-sol`; la clave dedicada, ruta/presupuesto/costo y el contrato persistente de recibo/replay ya están verificados en Preview. El replay autenticado sigue pendiente. Usage ausente conserva `costPending`; `store:false` no satisface ZDR por sí solo | Dataset consentido, ground truth, privacidad/DPA/retención, benchmark visual OpenAI/Qwen3-VL/GLM-5V por tipología y evals separadas de GLM-OCR/GLM-5.2 para OCR/texto; una foto aislada nunca certifica | S17 |
| SPEC-AVA-03 | Director aprueba/corrige estimación | Parcial, puente H5 local | `VisualProgressAssessment` conserva resultado, revisión CAS y corrección/rechazo con motivo. Una revisión aprobada/corregida exige después un punto entero dentro del rango y fundamento humano; se guarda como observación append-only antes del forecast. Una recuperación ganadora antes del dispatch evita la llamada; después de esa frontera, un recibo durable puede aplicar una respuesta tardía sin redispatch | Aplicar/verificar H5 en Preview y recorrer UI, replay y conciliación autenticados; unificar políticas de texto/audio/foto sin confundir revisión visual con medición contractual | S5, S9, S17 |
| SPEC-AVA-04 | Certificado de avance | Ausente | Sólo existe reporte semanal | Artefacto privado, versionado, inmutable y reproducible ligado a período, WBS, medición y aprobadores | S10 |
| SPEC-AVA-05 | Reporte semanal automático con fotos/gráficos | Parcial | PDF A4 real con hash bajo demanda; no persiste artefacto ni fotos aprobadas | Programar, persistir snapshot/artefacto, historial, publicación y distribución autorizada | S10, S15-S16 |
| SPEC-AVA-06 | Reporte de retrasos y causa | Parcial | Clasificación/propuesta de demora e incidentes existen | Canonizar causa, impacto, owner y recuperación; reporte y Gantt consumen el mismo registro | S4-S6 |
| SPEC-AVA-07 | Reporte de faltantes para avanzar | Parcial | Riesgos de stock e incidentes existen | Blocker ligado a tarea, material, cantidad y fecha necesaria | S4, S11 |
| SPEC-AVA-08 | Avance validado actualiza plan y habilita certificación | Reformular, H5 local | Una decisión humana sobre una revisión visual puede crear una observación inmutable y un forecast revisable con deltas contra baseline. No actualiza el plan, no crea una medición contractual y el certificado sigue separado | Verificar el journey H5 en Preview; una medición posterior y autorizada inicia certificación. Nunca habilita pago automáticamente | S6, S9-S10 |

### Riesgo P0 de avance textual - cerrado localmente

Texto y audio accionables crean `OperationalProposal` con precondición, idempotencia y confirmación; el branch textual ya no modifica `task.progress` ni el Gantt directamente. La foto se vincula a `ProgressEvidence` y su lectura visual exige revisión humana. H5 agrega una transición explícita desde esa revisión hacia una observación inmutable y un forecast, pero los tres canales aún terminan en registros de aprobación diferentes y no deben presentarse como medición/certificación unificada.

## Módulo 4 - Materiales y proveedores

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-MAT-01 | Materiales requeridos según tarea | Ausente | Tareas y acopios no comparten BOM | Requerimiento/BOM versionado por WBS, unidad, cantidad y fuente; sugerencia explicable | S11 |
| SPEC-MAT-02 | Pedido u orden a proveedor | Parcial en Preview | Proveedores, OC y líneas canónicas existen. OC y compromisos usan cantidades `Decimal(14,3)` exactas como texto, los importes de OC usan centavos exactos y la UI permite comprometer una partida y cantidad sin pasar por `Number`. `SupplierCommitment` agrega fecha/ventana y vínculo opcional con OC/tarea | Recorrer UI por rol; completar requisición → comparación/selección → OC, edición multi-partida y segregación. Nunca compra automática | S11 |
| SPEC-MAT-03 | Recepción con foto y remito firmado | Parcial en Preview | `GoodsReceipt` admite líneas parciales exactas, impide sobre-recepción, actualiza la OC y vincula remito privado. El ledger asigna cantidades recibidas al compromiso sin FIFO. La inspección versionada particiona exactamente aceptado/dañado/rechazado/cuarentena, conserva actor y snapshot de ubicación, y bloquea mutaciones históricas; el listado pagina más de 500 remitos | Completar firma jurídica, retención productiva, evidencia fotográfica tipada y E2E autenticado por rol | S12 |
| SPEC-MAT-04 | Registrar faltantes de entrega | Parcial en Preview; Resend y alerta interna pendientes | El cierre `FINAL_DELIVERY` deriva cantidad aceptada y faltante sólo de asignaciones e inspecciones activas; una corrección exige reversión explícita y todo queda append-only. Fecha prometida, riesgo y recordatorio externo permanecen versionados | Agregar owner/SLA, alerta durable a Compras/Director y evidencia Resend real; recorrer cierre/reversión autenticados | S11-S12, S15 |
| SPEC-MAT-05 | Stock actualizado | Parcial en Preview; UI autenticada pendiente | S12.2A agrega catálogo/ubicación tenant-scoped, vínculo inmutable de línea, putaway atómico desde todas y sólo las disposiciones `ACCEPTED`, ledger append-only, reversión espejo y balance on-hand DB-owned. No backfillea el JSON legacy ni acepta cantidad/ubicación del cliente. La [migración 115, el verificador, el build y los smokes sin sesión](./evidence/2026-08-02-preview-4760a50.md) pasaron en Preview | Recorrer putaway/reversión en UI autenticada por rol; agregar consumo, devolución, transferencia, ajuste y cutover legacy con rollback. No afirmar Production | S12 |
| SPEC-MAT-06 | Recepción marca tarea “con materiales disponibles” | Reformular; aceptación y on-hand en Preview, `AVAILABLE` cerrado | Un compromiso vinculado a una tarea deriva readiness sin modificar `Task.status`. La recepción `ACCEPTED` sólo pasa a existencia física tras putaway explícito; S12.2A todavía no reserva contra una BOM. `FULFILL` administrativo sigue siendo `ADMIN_ATTESTED`, nunca `AVAILABLE` | Implementar BOM versionado y reserva/liberación exacta. Sólo cantidad aceptada, on-hand y reservada suficiente puede derivar `AVAILABLE`; foto/OCR nunca habilita por sí solo | S12 |

### Extensiones acordadas con la socia después del PDF

Estas ideas se recibieron después de la especificación 1.0 y se separan para no atribuirlas falsamente al documento original. El contrato técnico y los gates se detallan en [SUPPLIER_COMMITMENTS_AND_FORTNIGHT_CALENDAR.md](./SUPPLIER_COMMITMENTS_AND_FORTNIGHT_CALENDAR.md).

| ID | Idea de producto | Estado | Evidencia y límite | Gate de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SOC-OPS-01 | Organizar tareas por quincenas y asociarlas a un calendario | Parcial en Preview | La pantalla de Compras agrupa las tareas canónicas de los próximos 90 días y los compromisos en quincenas reales 1–15/16–fin de mes; el mismo read model entrega JSON y `.ics` autenticado. La migración y el build pasaron en Preview; declara truncamiento y el export falla cerrado si perdería datos | Recorrer UI autenticada e importar/reimportar en clientes soportados. No llamarlo sincronización: no hay feed revocable ni OAuth | S3, S15, R0 |
| SOC-PROC-01 | Registrar fecha prometida de material/aberturas o servicio y hacerla visible al equipo | Parcial en Preview | `SupplierCommitment` registra proveedor, tipo, ventana, OC/tarea opcionales, estados, CAS, idempotencia y eventos. La UI captura cantidad exacta, concilia recepción, inspecciona por ubicación y cierra/revierte faltantes con historia; los remitos tienen paginación cursorada | Completar smoke por rol, UI multi-partida y vínculo con stock/reserva; la disponibilidad continúa fail-closed y no muta la tarea | S11-S12, R0 |
| SOC-PROC-02 | Enviar al proveedor un email una semana antes de ejecutar el servicio | Código en Preview, externo pendiente | Outbox dedicado, cron cada 15 minutos, envío Resend con idempotencia persistida, estados inciertos fail-closed y webhook firmado. Rutas y build están en Preview, pero las variables Resend aún no están configuradas. La UI fija siete días; la marca de email es atestación de Administración, no doble opt-in del proveedor | Verificar dominio/remitente, webhook, cron y ciclo accepted/delivered en staging; probar timeout, 429, bounce, complaint, supresión, reprogramación y owner de incidentes antes de Production | S15, R0 |

## Módulo 5 - Documentación técnica

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-DOC-01 | Carga de planos PDF/DWG | Ausente | Adjuntos de conversación no forman repositorio documental | Documento, disciplina, número, revisión, permisos, antivirus y preview; DWG mediante proveedor/conversión | S13 |
| SPEC-DOC-02 | Nueva versión de plano | Parcial | Existe contrato de dominio para tipo, revisión, SHA-256 y lifecycle `DRAFT -> ISSUED -> SUPERSEDED`; falta persistencia `Document`/`DocumentVersion` | Revisiones inmutables persistidas, única vigente, comparación e issues ligados a versión | S13 |
| SPEC-DOC-03 | Alerta automática de cambios | Ausente | No hay dominio documental ni outbox general | Evento de revisión, destinatarios por obra/rol/disciplina, entrega/lectura y acuse | S13, S15 |
| SPEC-DOC-04 | Consulta rápida desde WhatsApp | Ausente | Inbox/media existe, no búsqueda documental | Consulta permission-aware y enlace firmado/expirable a revisión vigente | S13, S15, R0 |

## Módulo 6 - Tareas no contempladas e imprevistos

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-EXT-01 | Registrar tarea extra | Parcial, base local | `ExtraWorkRequest` conserva causa, tarea, impacto preliminar, estado, revisión y decisión auditada | Integrar UI/journey, change control contractual, Preview y E2E | S6, S19 |
| SPEC-EXT-02 | Inicio/fin con foto y GPS | Parcial, base local | `ExtraWorkSession` implementa START/FINISH idempotentes, GPS inicial/final, duración y evidencia vinculada | Completar UI/WhatsApp, reglas laborales, offline y E2E | S6, S20 |
| SPEC-EXT-03 | Registrar vicio oculto | Parcial | Puede capturarse como incidencia genérica | Clasificación, alcance contractual, owner, evidencia, impacto y workflow de cambio | S5-S6, S19 |
| SPEC-EXT-04 | Foto, GPS y descripción | Parcial | Evidencia y geolocalización existen por canales separados | Un registro compuesto conserva fuente, WBS/tarea, lugar, tiempo y hashes | S5 |
| SPEC-EXT-05 | Director valida y suma al plan real | Parcial, base local | El Director puede decidir `ExtraWorkRequest` y evaluar `ReplanScenario`; baseline/versiones existen, pero la aprobación todavía no crea change request contractual ni impacta presupuesto | Aprobación crea tarea/revisión o change request; impacto en baseline/presupuesto requiere workflow posterior | S6-S7, S19 |

## Módulo 7 - Caja chica

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-CASH-01 | Registrar gasto por usuario interno | Parcial, base local | `CashFund`/`CashMovement` operan por obra con custodio, moneda, actor, ledger auditado e idempotency key | Completar permisos finos, reposición/cierre/conciliación, Preview y E2E | S8 |
| SPEC-CASH-02 | Foto de ticket/factura | Parcial, base local | Comprobante privado mediante reserva `ProtectedUpload` server-owned y `uploadId`; descriptor cliente prohibido, MIME/magic bytes/SHA-256 y entrega autorizada | Agregar datos fiscales, OCR opcional, retención/restore y smoke real | S8 |
| SPEC-CASH-03 | Categorizar gasto | Parcial, base local | `category` acotada ya se persiste y audita | Catálogo tenant, cost code/WBS, corrección y gobierno | S7-S8 |
| SPEC-CASH-04 | Saldo en tiempo real | Parcial, base local | `cashBalance` deriva el saldo sólo de movimientos aprobados | Cerrar semántica contractual de apertura, ajuste, devolución, cierre y conciliación concurrente | S8 |
| SPEC-CASH-05 | Cargar gasto y descontar saldo automáticamente | Reformular | El movimiento entra `PENDING_APPROVAL`, es idempotente y se decide con CAS. Desde `100000` exige dos aprobadores distintos y sólo impacta saldo al finalizar; el umbral aún es fijo y el creador no está separado del primer aprobador | Hacer el umbral configurable por tenant, registrar maker y prohibir que apruebe su propio gasto; conservar movimiento inmutable e idempotente | S8 |

## Módulo 8 - Dashboard, reportes y certificaciones

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-REP-01 | PDF semanal para Cliente y Equipo Líder | Parcial | Reporte tenant-aware y PDF real; asistencia deriva del ledger completo, paginado y con zona histórica | Artefacto reproducible persistido, programación, publicación, distribución y portal externo | S10, S15-S16 |
| SPEC-REP-02 | Dashboard con avance, pendientes, gastos y asistencia | Parcial | Hoy/Gantt/asistencia/riesgos/stock y dashboards relacionales de presupuestos, compras, cuentas a pagar y caja existen | KPIs unificados con definición/fuente/frescura, forecast/cambios, drill-down, vistas por rol y validación externa | S7-S10, S16 |
| SPEC-REP-03 | Historial de certificaciones/quincenas | Ausente | No existe certificación canónica | Historial por período, versión, estado, aprobadores, importe y PDF | S10 |

## Alertas y notificaciones

| ID | Evento original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-ALT-01 | Falta de entrada a horario → Director | Ausente | No hay turno esperado ni outbox | Derivar de calendario/tolerancia; una alerta activa, deduplicada y resoluble | S2, S15 |
| SPEC-ALT-02 | Tarea retrasada → Director + Cliente | Parcial | Indicador/incidencia internos existen | Director recibe evento durable; Cliente sólo comunicación aprobada/configurable | S6, S15-S16 |
| SPEC-ALT-03 | Material no llegó → Compras + Director | Parcial en Preview | OC y recepción parcial/completa existen; `SupplierCommitment` agrega fecha prometida y riesgo derivado, y el outbox desplegado queda fail-closed hasta configurar Resend. Todavía no existe alerta interna durable a Compras/Director ni detección automática de incumplimiento por cantidades recibidas | Comparar fecha/cantidad comprometida con recepciones reales, crear un único evento interno deduplicado con owner, resolución y escalamiento, y validar el email externo en Resend real | S11-S12, S15 |
| SPEC-ALT-04 | Cambio de plano → usuarios de obra | Ausente | No hay revisión documental ni outbox | Notificar sólo roles/disciplina autorizados, con revisión y acuse | S13, S15 |
| SPEC-ALT-05 | Caja bajo umbral → Administrador | Parcial | Fondo/ledger existen; no hay política de umbral ni evento durable/outbox | Umbral por fondo/moneda, deduplicación y resolución por reposición/cierre | S8, S15 |
| SPEC-ALT-06 | Quincena por certificar → Director | Ausente | No hay período/certificación canónicos | Crear borrador una vez, vencimiento, owner y escalamiento | S10, S15 |

Todas las alertas salen de un outbox durable. Toasts, polling o un envío directo dentro de la mutación no cumplen el requisito.

## Requerimientos técnicos

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-TEC-01 | WhatsApp Business API | Externo pendiente | Meta Cloud API directa es el camino primario; app/caso de uso, test number, destinatario y outbound histórico existen. `META_APP_SECRET` está en Preview y el test oficial firmado `messages v25.0` respondió 200 con aislamiento correcto. La app sigue sin publicar y el negocio no verificado; no hay inbound/estados/Flows ni H2 E2E con tráfico Meta real (`WHATSAPP_META.md`) | Completar verificación/publicación, importar credencial cifrada por tenant y probar inbound/outbound correlacionado, estados, ambos Flows, H2, retry y expiración en teléfono real; Twilio no sustituye gates nativos | R0 |
| SPEC-TEC-02 | Geolocalización GPS | Parcial | Jornada, trabajo extra y H2 validan coordenadas, `accuracy`, timestamp y geocerca con lecturas puntuales consentidas; H2 además ofrece opt-out sin coordenadas. El copy declara que la lectura la reporta el dispositivo, puede falsificarse, no garantiza GPS y no activa tracking continuo | Aplicar la migración H2 en Neon Preview y validar permisos, opt-out, scrub del fragmento antes de `INIT`, cero `sessionStorage`, expiración/stale fallback y celular real; mantener alternativa manual y minimización de acceso | S1-S2, S5-S6 |
| SPEC-TEC-03 | Nube para fotos/videos | Externo pendiente | Vercel Blob privado/Cloudinary autenticado, `ProtectedUpload` server-owned y lifecycle durable de media WhatsApp `070000` ya están verificados en Preview; validación binaria, intent durable y cron autenticado están implementados | Observar ambiente/cron y media Meta real, completar retención, restore, DR, carga directa para más de 4 MiB y degradación | S0, R0, S23 |
| SPEC-TEC-04 | IA de imágenes | Reformular | OpenAI tiene un smoke API controlado y el dispatch/ledger/recibo durable está verificado en Preview; Qwen3-VL/GLM-5V son challengers visuales y GLM-OCR/GLM-5.2 especialistas OCR/texto probados sólo por contrato. No hay fan-out | Verificar privacidad/DPA/retención, replay/conciliación autenticados, dataset/ground truth, benchmark, calibración/abstención y journey Meta real antes de producción | S17 |
| SPEC-TEC-05 | Base relacional | Parcial | Prisma ya cubre un núcleo relacional amplio; documentos, calidad, contratos y stock profesional siguen incompletos. Se evita un contador manual porque cambia con cada vertical | Migración/backfill/verificador y APIs canónicas por vertical | S3-S14 |
| SPEC-TEC-06 | Generación PDF | Parcial | PDF semanal real; faltan certificado e historial documental | Artefactos privados, persistidos, versionados y reproducibles | S10, S13 |
| SPEC-TEC-07 | Notificaciones push | Reformular | No hay push/outbox; manifest no equivale a PWA | Priorizar centro in-app + WhatsApp/email gobernados; push web sólo si el piloto demuestra necesidad | S15, S20 |

## Definiciones del PDF

| ID | Definición original | Estado | Evidencia y decisión | Criterio objetivo | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-DEF-01 | Tarea: unidad asignada a empleado/equipo | Parcial | `Task` es la autoridad canónica; baseline versionada y forecast ya existen, y `ProjectSnapshot` conserva compatibilidad/writer legacy sólo para obras en ese modo | Completar cutover, responsable/equipo por ID y demostrar cero drift | S3-S4 |
| SPEC-DEF-02 | Avance: porcentaje de completitud | Parcial | Existe `progress` 0-100 | Guardar método, cantidad base/ejecutada, evidencia, autor y aprobación; porcentaje solo no certifica | S5, S9 |
| SPEC-DEF-03 | Certificación: documento que valida avance para pago | Reformular | No existe certificado; la definición mezcla validación y pago | Separar medición, certificado contractual, conformidad y referencia de pago | S9-S10 |
| SPEC-DEF-04 | Tarea no contemplada: trabajo extra necesario | Parcial, base local | `ExtraWorkRequest` y `ExtraWorkSession` cubren solicitud, decisión y ejecución trazable; falta el change request contractual | Causa, impacto, aprobación, ejecución y eventual change request sobre baseline/presupuesto | S6, S19 |
| SPEC-DEF-05 | Vicio oculto: problema que retrasa el plan | Parcial | Puede capturarse como incidente | Tipo, evidencia, ubicación, owner, impacto y reserva contractual | S5-S6, S19 |
| SPEC-DEF-06 | Remito: documento de recepción | Parcial | Evidencia privada ligada a `GoodsReceipt` y reconciliada contra OC mediante reserva server-owned | Completar firma jurídica/OCR, retención productiva y E2E | S12 |

## Fases originales del PDF

Estas filas conservan las estimaciones recibidas como hipótesis. No son compromisos aceptados.

| ID | Fase original | Estado | Evaluación | Sustitución trazable |
| --- | --- | --- | --- | --- |
| SPEC-FAS-01 | MVP: asistencia, tareas, foto y caja en 4-6 semanas | Reformular | Mezcla cuatro dominios y omite seguridad, privacidad, tenancy, migración y operación | S0/R0; S1-S5; S8, reestimados con capacidad y piloto |
| SPEC-FAS-02 | Control: Gantt real, certificación, materiales y extras en +4 semanas | Reformular | WBS, medición, procurement y change control tienen dependencias y modelos distintos | S3-S4, S6-S7, S9-S12 |
| SPEC-FAS-03 | IA, reporte, dashboard y alertas en +4 semanas | Reformular | IA visual requiere dataset/evaluación; alertas requieren outbox y Cliente requiere principal externo | S10, S15-S17 |
| SPEC-FAS-04 | Escalado: multiobra, facturación y app nativa en +8 semanas | Reformular | Multiobra ya existe; integración fiscal y native no son la misma iniciativa | S16, S20-S23; native sólo tras demostrar gaps de PWA |

## Próximos pasos originales

| ID | Próximo paso del PDF | Estado | Evidencia y decisión | Salida requerida | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-NEXT-01 | Revisar y ajustar el documento juntos | Parcial | Revisión técnica completada; reglas de negocio siguen pendientes con la socia | Resolver preguntas de cliente, turnos, caja, certificación, firma, compras, IA y offline; registrar decisiones | Antes de cada vertical |
| SPEC-NEXT-02 | Elegir bot puro, web+WhatsApp o híbrida | Implementado | Decisión: híbrida; WhatsApp captura/notifica y la web gobierna. El manifest/estado online actual no constituye PWA offline ni cubre conectividad intermitente | Mantener una sola fuente de verdad y fallback por canal; implementar cola/sincronización/conflictos recién en S20 | S0, S15-S16, S20 |
| SPEC-NEXT-03 | Elegir Twilio/Vision/Firebase/Node | Parcial | Meta Cloud API directa es primaria y Twilio queda como fallback no habilitado. Stack Next.js/Node/Postgres/Prisma/Clerk/Vercel definido. OpenAI es primario visual; HF Qwen y GLM-5V/OCR/texto quedan registrados por capacidad | Completar piloto Meta y benchmark visual; implementar Twilio sólo si una contingencia concreta lo justifica. Sólo OpenAI tuvo smoke API; ningún challenger recibe evidencia real sin benchmark y revisión contractual | R0, S17, S22 |
| SPEC-NEXT-04 | Diseñar base con entidades principales | Parcial | Núcleo SaaS y operativo existe; faltan dominios canónicos definidos en esta matriz | Modelo/migración/API/autoridad por sprint, con backfill, verificador y rollback | S1-S19 |
| SPEC-NEXT-05 | Empezar MVP con una obra piloto | Externo pendiente | No existe evidencia de piloto real aprobado | Obra, responsables, consentimiento, datos iniciales, ambiente, soporte, métricas y criterio de salida definidos | R0 y carril piloto |

## Capacidades profesionales omitidas por el PDF

| ID | Requisito adicional | Estado | Evidencia / decisión | Secuencia |
| --- | --- | --- | --- | --- |
| PRO-01 | Tenancy, RBAC, alcance por obra y auditoría | Implementado | Base real; continuar defensa, gobierno y pruebas negativas | Continuo, S23 |
| PRO-02 | Idempotencia, concurrencia y recuperación de proveedores | Parcial en Preview | Además de WhatsApp, los recordatorios de proveedores usan outbox, clave Resend persistida, claim atómico, bloqueo/fence de obra y webhook append-only. Un dispatch ambiguo pasa a `UNCERTAIN` y no se reintenta a ciegas; el contrato pasó build/migración real en Preview. Resend sigue sin configurar y conflicto, bounce, complaint, failure y supresión requieren E2E | S0, R0, S15, S23 |
| PRO-03 | CI, migraciones gobernadas y E2E por rol | Parcial en Preview | El deployment `dpl_GdrLvspbHK7ttZEA7EW88WGzX4Me` ejecutó el preflight del outbox con 0 incompatibilidades, aplicó/verificó 113 migraciones y cerró conciliación contra PostgreSQL real. Dos builds previos fallaron cerrados por incompatibilidad de verifier y un bug de `FOUND`/SQL dinámico antes de llegar a `Ready`. Build y smokes sin sesión pasaron; smoke autenticado portable y E2E core siguen abiertos | S0 |
| PRO-04 | Observabilidad, SLO, alertas y runbooks | Parcial en Preview | El cron de recordatorios expone métricas sanitizadas y estado `healthy/degraded`; existe [runbook específico](./SUPPLIER_COMMITMENTS_AND_FORTNIGHT_CALENDAR.md). El deployment no mostró errores de runtime, pero todavía no hay ejecución real del cron, alertas conectadas, SLO ni evidencia Resend | S0, S15, S23 |
| PRO-05 | Retención, DSAR, backup/restore, RPO/RTO y borrado verificable | Parcial local, discovery-only | [PRO-05A](./DATA_SUBJECT_RIGHTS_FOUNDATION.md) agrega caso tenant-scoped, atestación ADMIN distinta de verificar al solicitante, catálogo/read-only discovery, manifiesto inmutable, replay, rate limit y blockers obligatorios; `140000` aplica desde cero con las 108 migraciones previas y su verificador conductual pasa en PGlite. V1 sólo puede terminar `DISCOVERY_BLOCKED` y no ejecuta acciones. Faltan PRO-05B/C/D: identidad/representación, matriz/holds, adapters por dominio, proveedores, backups/tombstones y restore drill, además de entidad legal responsable y verificación Neon/Vercel | Gate previo a datos laborales reales; S0, S23 |
| PRO-06 | Offline con resolución de conflictos | Ausente | Manifest/estado online no son offline | S20 |
| PRO-07 | QA/QC, RFI, submittal y no conformidades | Ausente | No intentar cuatro demos: S18 selecciona una vertical QA/QC; S19 implementa change control acotado; RFI, submittal y transmittal quedan explícitamente en backlog | S18-S19; resto backlog |
| PRO-08 | API/webhooks e integración ERP/BIM/BI | Ausente | No hay API pública versionada | API/scopes/webhooks y una integración priorizada por piloto | S22 |
| PRO-09 | Accesibilidad, rendimiento y type safety | Parcial | Hay prácticas aisladas, sin gates suficientes | Gates progresivos desde S0 y certificación en S23 | S0, S23 |
| PRO-10 | Localización, zona horaria, unidades y moneda | Parcial | Mayormente `es-AR`; organization guarda país/zona | Locale/unidades/moneda por tenant/obra; journeys regionales elegidos | S21 |
| PRO-11 | Presupuesto, comprometido, real, forecast y cambios | Parcial, base local | Existen `BudgetVersion`, `BudgetLine`, `BudgetEntry` y clases `COMMITMENT/ACTUAL/FORECAST` | Faltan cambios aprobados, reconciliación completa, cutover y Preview antes de certificación/compras/change control | S7, S9-S12, S19 |
| PRO-12 | Identidad laboral y destino de cobro protegidos | Parcial local | El módulo valida CUIL/CBU/CVU/alias, conserva aviso versionado, cifra con AAD/keyring y serializa enmascarado. H4 incorpora consentimiento específico, re-atestación legacy, CRM enmascarado, companion Flow de un solo uso, Data Endpoint terminal y reconciliador DB-only `UNCERTAIN → SUCCEEDED`. El opt-in de constancia queda ligado al HMAC y fijado en la companion; sólo entonces puede emitirse un registro mínimo con acceso de 15 minutos. El bearer no se persiste, se reconstruye post-claim y viaja sólo en fragmento; la webview y el PDF dinámico nunca reciben el dato completo. La [constancia privada](./WORKER_PAYMENT_PRIVATE_RECEIPT.md) acredita únicamente recepción para revisión, no titularidad, validación bancaria, activación, transferencia ni pago. Todo este incremento y la migración `13400` siguen con evidencia local | Desplegar/verificar H4 en Neon y Vercel Preview, publicar/probar el Flow y la entrega en Meta E2E e integrar proveedor de titularidad. El reenvío fuera de la ventana de Meta y su plantilla `UTILITY` siguen pendientes. No afirmar piloto, Production ni cierre de PRO-05 | Piloto H3-H4, S14, R0 |
| PRO-13 | Rate limiting distribuido y WAF en fronteras públicas | Parcial local | H2 reserva cada `INIT`/captura/cancelación con advisory lock y reloj PostgreSQL. La vía activa usa 12/min por sesión y 600/min por organización; enlaces terminales/vencidos quedan aislados en 6/min y 300/min sin consumir la cuota activa. Buckets acotados/expirables por vía y alcance compactan segundos/rechazos sin una fila por request; hay `429 Retry-After`, falla cerrada y cero bearer, body, coordenadas o IP | Aplicar/verificar en Neon Preview; sumar barrido global de expirados, WAF externo, observabilidad y pruebas de ráfaga/degradación. Webhook y descargas todavía requieren su propio límite durable antes del piloto real | R0, S23 |

## Decisiones pendientes de la socia/cliente

1. ¿El Cliente ve sólo artefactos publicados o alguna operación en vivo?
2. ¿Qué contrato, unidad, retención y cadena de aprobación define medición/certificación?
3. ¿Qué horarios, tolerancias, turnos y convenios aplican a tardanza/ausencia?
4. ¿Foto en entrada/salida es necesaria y proporcional? ¿Quién accede y cuánto se retiene?
5. ¿Qué documentos laborales son indispensables y quién puede verlos?
6. ¿Qué jurisdicción/nivel/proveedor se usará para firma electrónica o digital?
7. ¿Quién abre/repone caja, qué monedas existen y qué umbrales requieren doble aprobación?
8. ¿La orden es previsión, solicitud interna o compromiso contractual?
9. ¿Qué tipologías tienen ground truth suficiente para evaluar visión?
10. ¿Qué alertas puede recibir el Cliente sin revisión previa?
11. ¿Qué conectividad tiene la obra piloto y qué operaciones deben funcionar offline?
12. ¿Qué dato de identidad laboral es obligatorio, quién verifica CUIL/titularidad y qué doble control rige cambios de CBU/CVU/alias y envío de comprobantes?

## Criterio de trazabilidad y cierre

Cada requisito debe terminar en:

1. modelo y autoridad de datos;
2. persona/principal y permiso explícitos;
3. API/acción idempotente y auditable;
4. estados/transiciones válidas;
5. experiencia WhatsApp, web y offline según corresponda;
6. evidencia de aceptación positiva, permiso denegado, duplicado, concurrencia y proveedor degradado;
7. métrica, señal operacional, owner y runbook;
8. copy que no prometa más que la evidencia liberada.

El orden de implementación y los criterios de salida viven en [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md). La secuencia sólo se considera sincronizada cuando ambos documentos usan los mismos IDs, sprints y decisiones.
