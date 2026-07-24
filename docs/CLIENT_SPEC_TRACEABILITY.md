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
| SPEC-OBJ-02 | Geolocalización y tiempo real | Reformular | La app usa lecturas GPS puntuales y declara que no hace seguimiento continuo (`dashboard-client.js:2224-2230`) | Hora servidor, accuracy, geocerca, consentimiento y excepción; nunca presentarlo como tracking o identidad infalible | S1-S2 |
| SPEC-OBJ-03 | Operar 100% vía WhatsApp | Reformular | WhatsApp e Inbox existen; dashboard, aprobaciones y reportes requieren web autenticada | WhatsApp captura/notifica; web/PWA gobierna y ofrece fallback. Una caída de Meta no bloquea administración ni lectura | R0, S15-S16, S20 |
| SPEC-OBJ-04 | WhatsApp chatbot con integraciones web/app | Parcial | Arquitectura híbrida ya implementada por contrato, pero falta WABA real y offline | Validar inbound/outbound/Flows en teléfono real y completar PWA sobre APIs canónicas | R0, S20 |

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
| SPEC-PER-05 | DNI, obra social, ART y certificaciones | Parcial | Certificado médico protegido y redacción clínica existen; el legajo laboral no | Vault restringido, tipos, versión, vencimiento, retención, descarga auditada y alerta; nunca en snapshot/inbox general | S14-S15 |
| SPEC-PER-06 | Acta de inicio firmada por las partes | Ausente | No existe documento/versión ni firma de negocio | Definir jurisdicción y nivel jurídico; integrar proveedor con identidad, intención, hash, versión y timestamp. No fabricar firma propia | S13-S14, R0 |
| SPEC-PER-07 | Flujo diario “Hola” → almuerzo → “Chau” | Parcial | WhatsApp reconoce comandos de ingreso, pausa, reanudación y salida sobre una máquina idempotente contextual por jornada/obra | Validar wording real con la clienta, teléfono/WABA, expiración y fallback; sumar schedule/excepciones en S2 | S1-S2, R0 |

Decisión pendiente explícita: foto en entrada/salida no se elimina silenciosamente. La socia y la revisión legal deben definir necesidad, propósito, acceso, retención y alternativa manual; GPS sigue siendo evidencia puntual, no biometría ni tracking.

## Módulo 2 - Planificación y tareas

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-PLN-01 | Gantt ideal con tareas, plazos y responsables | Parcial | Gantt, dependencias, ciclos, CAS y proyección `Task`; snapshot sigue como writer (`OPERATIONAL_TASKS.md:5`) | WBS, baseline/revisiones, fechas forecast/real y responsable por ID; cero drift antes de retirar writer legado | S3 |
| SPEC-PLN-02 | Asignar tareas a equipos con anticipación | Parcial | Responsable actual se persiste por nombre; workers existen | Equipo/cuadrilla canónica, asignación versionada, vigencia y acuse/notificación durable | S4, S15 |
| SPEC-PLN-03 | Plan real adaptativo por avances/retrasos | Reformular | Existen Gantt y propuestas, no motor de impacto | Calcular escenario/camino afectado y requerir aprobación; baseline nunca se reescribe | S6 |
| SPEC-PLN-04 | Pendiente y motivo de lo no ejecutado | Parcial | `isDelayed`, incidentes y demoras existen | Blocker con causa, owner, evidencia, impacto y fecha de recuperación | S4-S6 |
| SPEC-PLN-05 | Certificación de avance para quincena | Ausente | Hay porcentaje/aprobación operativa, no medición ni certificado contractual | Separar cantidad medida, aprobación técnica, certificado, conformidad financiera y referencia de pago | S9-S10 |
| SPEC-PLN-06 | Asignación → WhatsApp → evidencia → validación | Parcial | Las primitivas existen separadas | Orquestación durable por estados; ninguna notificación o retry duplica la operación | S4-S6, S15, R0 |

## Módulo 3 - Reportes y avances

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-AVA-01 | Avance con foto/video y GPS | Parcial | Media privada, hash y ubicación existen como eventos separados | `ProgressEvidence` une tarea/WBS, autor, hora, ubicación, media y hashes bajo un ID | S5 |
| SPEC-AVA-02 | IA estima porcentaje por foto | Reformular | No hay visión productiva; IA actual es textual/transcripción opt-in | Piloto por tipología, ground truth, rango/confianza y abstención; una foto aislada nunca certifica | S17 |
| SPEC-AVA-03 | Director aprueba/corrige estimación | Parcial | Existe bandeja de propuestas con precondiciones; no hay corrección visual/medición | Aprobar/corregir/rechazar con motivo y evidencia; mismo control para texto, audio y foto | S5, S9, S17 |
| SPEC-AVA-04 | Certificado de avance | Ausente | Sólo existe reporte semanal | Artefacto privado, versionado, inmutable y reproducible ligado a período, WBS, medición y aprobadores | S10 |
| SPEC-AVA-05 | Reporte semanal automático con fotos/gráficos | Parcial | PDF A4 real con hash bajo demanda; no persiste artefacto ni fotos aprobadas | Programar, persistir snapshot/artefacto, historial, publicación y distribución autorizada | S10, S15-S16 |
| SPEC-AVA-06 | Reporte de retrasos y causa | Parcial | Clasificación/propuesta de demora e incidentes existen | Canonizar causa, impacto, owner y recuperación; reporte y Gantt consumen el mismo registro | S4-S6 |
| SPEC-AVA-07 | Reporte de faltantes para avanzar | Parcial | Riesgos de stock e incidentes existen | Blocker ligado a tarea, material, cantidad y fecha necesaria | S4, S11 |
| SPEC-AVA-08 | Avance validado actualiza plan y habilita certificación | Reformular | La actualización operativa y el certificado no están conectados | Aprobación actualiza forecast; una medición posterior inicia certificación. Nunca habilita pago automáticamente | S6, S9-S10 |

### Riesgo P0 vigente - avance textual

Un audio accionable crea una propuesta, pero un comando textual permitido a capataz/jefe modifica directamente `task.progress` en `src/lib/whatsapp/obra-engine.js:706-714`. Hasta S5, el estado correcto es **Parcial**: texto, audio y foto no comparten aún la misma aprobación. S5 debe eliminar ese bypass o convertirlo en propuesta con precondición/idempotencia antes de incorporar IA visual o certificación.

## Módulo 4 - Materiales y proveedores

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-MAT-01 | Materiales requeridos según tarea | Ausente | Tareas y acopios no comparten BOM | Requerimiento/BOM versionado por WBS, unidad, cantidad y fuente; sugerencia explicable | S11 |
| SPEC-MAT-02 | Pedido u orden a proveedor | Ausente | No hay proveedor, cotización ni orden canónica | Requisición → comparación/selección → OC aprobada; nunca compra automática | S11 |
| SPEC-MAT-03 | Recepción con foto y remito firmado | Parcial | Recepción manual suma stock y acepta referencia textual | `GoodsReceipt`, entregas parciales, líneas aceptadas/rechazadas, remito/evidencia, OC, proveedor y receptor | S12 |
| SPEC-MAT-04 | Registrar faltantes de entrega | Ausente | Stock bajo no compara pedido contra recibido | Diferencia por línea de OC, daño/exceso/rechazo, pendiente, owner y SLA | S12, S15 |
| SPEC-MAT-05 | Stock actualizado | Parcial | Catálogo actual sólo contiene nombre, unidad, actual, mínimo, máximo y estado (`stockpiles.js:81-97`) | Saldo derivado de ledger de recepción, consumo, transferencia y ajuste por ubicación | S12 |
| SPEC-MAT-06 | Recepción marca tarea “con materiales disponibles” | Reformular | No existe readiness material-tarea | Derivar readiness de BOM y recepciones confirmadas; foto/OCR sólo crea borrador y nunca habilita una tarea por sí solo | S12 |

## Módulo 5 - Documentación técnica

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-DOC-01 | Carga de planos PDF/DWG | Ausente | Adjuntos de conversación no forman repositorio documental | Documento, disciplina, número, revisión, permisos, antivirus y preview; DWG mediante proveedor/conversión | S13 |
| SPEC-DOC-02 | Nueva versión de plano | Ausente | No hay `Document`/`DocumentVersion` | Revisiones inmutables, vigente/superseded, comparación e issues ligados a versión | S13 |
| SPEC-DOC-03 | Alerta automática de cambios | Ausente | No hay dominio documental ni outbox general | Evento de revisión, destinatarios por obra/rol/disciplina, entrega/lectura y acuse | S13, S15 |
| SPEC-DOC-04 | Consulta rápida desde WhatsApp | Ausente | Inbox/media existe, no búsqueda documental | Consulta permission-aware y enlace firmado/expirable a revisión vigente | S13, S15, R0 |

## Módulo 6 - Tareas no contempladas e imprevistos

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-EXT-01 | Registrar tarea extra | Ausente | Incidencias/propuestas son primitivas reutilizables, no un `ExtraWork` | Registro canónico con causa, WBS, impacto preliminar, estado y aprobación | S6 |
| SPEC-EXT-02 | Inicio/fin con foto y GPS | Ausente | No hay sesión temporal de trabajo extra | START/FINISH idempotentes, evidencia, ubicación y duración reproducible | S6 |
| SPEC-EXT-03 | Registrar vicio oculto | Parcial | Puede capturarse como incidencia genérica | Clasificación, alcance contractual, owner, evidencia, impacto y workflow de cambio | S5-S6, S19 |
| SPEC-EXT-04 | Foto, GPS y descripción | Parcial | Evidencia y geolocalización existen por canales separados | Un registro compuesto conserva fuente, WBS/tarea, lugar, tiempo y hashes | S5 |
| SPEC-EXT-05 | Director valida y suma al plan real | Ausente | Existen propuestas genéricas, pero no alta/aprobación completa de trabajo extra | Aprobación crea tarea/revisión o change request; impacto en baseline/presupuesto requiere workflow posterior | S6-S7, S19 |

## Módulo 7 - Caja chica

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-CASH-01 | Registrar gasto por usuario interno | Ausente | Sólo hay resumen presupuestario en snapshot | Fondo/ledger por obra, custodio, moneda, actor, estado y política por rol | S8 |
| SPEC-CASH-02 | Foto de ticket/factura | Ausente | Storage privado es reutilizable, pero no existe dominio gasto | Evidencia vinculada, hash, proveedor, fecha fiscal, OCR opcional y detección de duplicado | S8 |
| SPEC-CASH-03 | Categorizar gasto | Ausente | No hay categorías/cost codes operables | Categoría tenant + WBS/cost code, corrección y auditoría | S7-S8 |
| SPEC-CASH-04 | Saldo en tiempo real | Ausente | `budget.total/executed` no es caja | Saldo derivado de apertura, gasto, reposición, devolución, ajuste y cierre | S8 |
| SPEC-CASH-05 | Cargar gasto y descontar saldo automáticamente | Reformular | Una asignación mutable no es conciliable ni segura | Empleado propone; custodio revisa; segundo rol aprueba sobre umbral; movimiento inmutable e idempotente | S8 |

## Módulo 8 - Dashboard, reportes y certificaciones

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-REP-01 | PDF semanal para Cliente y Equipo Líder | Parcial | Reporte tenant-aware y PDF real; asistencia deriva del ledger completo, paginado y con zona histórica | Artefacto reproducible persistido, programación, publicación, distribución y portal externo | S10, S15-S16 |
| SPEC-REP-02 | Dashboard con avance, pendientes, gastos y asistencia | Parcial | Hoy/Gantt/asistencia/riesgos/stock existen; costos y caja no son canónicos | KPIs con definición/fuente/frescura, drill-down y vistas por rol | S7-S10, S16 |
| SPEC-REP-03 | Historial de certificaciones/quincenas | Ausente | No existe certificación canónica | Historial por período, versión, estado, aprobadores, importe y PDF | S10 |

## Alertas y notificaciones

| ID | Evento original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-ALT-01 | Falta de entrada a horario → Director | Ausente | No hay turno esperado ni outbox | Derivar de calendario/tolerancia; una alerta activa, deduplicada y resoluble | S2, S15 |
| SPEC-ALT-02 | Tarea retrasada → Director + Cliente | Parcial | Indicador/incidencia internos existen | Director recibe evento durable; Cliente sólo comunicación aprobada/configurable | S6, S15-S16 |
| SPEC-ALT-03 | Material no llegó → Compras + Director | Ausente | No hay OC/ETA/recepción conciliada | Detectar OC vencida o entrega parcial; owner y escalamiento | S11-S12, S15 |
| SPEC-ALT-04 | Cambio de plano → usuarios de obra | Ausente | No hay revisión documental ni outbox | Notificar sólo roles/disciplina autorizados, con revisión y acuse | S13, S15 |
| SPEC-ALT-05 | Caja bajo umbral → Administrador | Ausente | No hay fondo/ledger | Umbral por fondo/moneda, deduplicación y resolución por reposición/cierre | S8, S15 |
| SPEC-ALT-06 | Quincena por certificar → Director | Ausente | No hay período/certificación canónicos | Crear borrador una vez, vencimiento, owner y escalamiento | S10, S15 |

Todas las alertas salen de un outbox durable. Toasts, polling o un envío directo dentro de la mutación no cumplen el requisito.

## Requerimientos técnicos

| ID | Requisito original | Estado | Evidencia y decisión | Gap / criterio de aceptación | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-TEC-01 | WhatsApp Business API | Externo pendiente | Meta Cloud API, Embedded Signup, webhooks, Inbox y Flows tienen contrato y pruebas; falta WABA real/App Review (`WHATSAPP_META.md:140-154`) | Inbound/outbound/estados/ambos Flows/retry/expiración/fallback en teléfono y tenant reales | R0 |
| SPEC-TEC-02 | Geolocalización GPS | Parcial | Coordenadas, accuracy y geocerca se validan (`geo.js:25-57`) | Aplicar a jornada/trabajo extra con consentimiento, excepción y copy anti-spoof | S1-S2, S6 |
| SPEC-TEC-03 | Nube para fotos/videos | Externo pendiente | Vercel Blob privado/Cloudinary autenticado y pruebas contractuales existen; ambiente, retención y DR no están demostrados | Configuración real, acceso tenant-scoped, límites/tipos, borrado, restore y degradación probados | S0, R0, S23 |
| SPEC-TEC-04 | IA de imágenes | Reformular | No hay visión productiva | Adapter tras benchmark, dataset/ground truth, confianza/abstención y revisión humana | S17 |
| SPEC-TEC-05 | Base relacional | Parcial | Neon/Prisma tiene 23 modelos; tareas, stock, costos y documentos siguen parcial o totalmente fuera de un dominio canónico | Migración/backfill/verificador y APIs canónicas por vertical | S3-S14 |
| SPEC-TEC-06 | Generación PDF | Parcial | PDF semanal real; faltan certificado e historial documental | Artefactos privados, persistidos, versionados y reproducibles | S10, S13 |
| SPEC-TEC-07 | Notificaciones push | Reformular | No hay push/outbox; manifest no equivale a PWA | Priorizar centro in-app + WhatsApp/email gobernados; push web sólo si el piloto demuestra necesidad | S15, S20 |

## Definiciones del PDF

| ID | Definición original | Estado | Evidencia y decisión | Criterio objetivo | Secuencia |
| --- | --- | --- | --- | --- | --- |
| SPEC-DEF-01 | Tarea: unidad asignada a empleado/equipo | Parcial | Existe `Task`, pero el writer canónico sigue en snapshot | WBS/ID, equipo/responsable, baseline, estado y dependencias canónicos | S3-S4 |
| SPEC-DEF-02 | Avance: porcentaje de completitud | Parcial | Existe `progress` 0-100 | Guardar método, cantidad base/ejecutada, evidencia, autor y aprobación; porcentaje solo no certifica | S5, S9 |
| SPEC-DEF-03 | Certificación: documento que valida avance para pago | Reformular | No existe certificado; la definición mezcla validación y pago | Separar medición, certificado contractual, conformidad y referencia de pago | S9-S10 |
| SPEC-DEF-04 | Tarea no contemplada: trabajo extra necesario | Ausente | Incidente genérico no equivale a trabajo extra | `ExtraWork` con causa, impacto, aprobación y eventual change request | S6, S19 |
| SPEC-DEF-05 | Vicio oculto: problema que retrasa el plan | Parcial | Puede capturarse como incidente | Tipo, evidencia, ubicación, owner, impacto y reserva contractual | S5-S6, S19 |
| SPEC-DEF-06 | Remito: documento de recepción | Parcial | Sólo existe referencia textual opcional en recepción básica | Documento/evidencia unido a `GoodsReceipt` y reconciliado contra OC | S12 |

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
| SPEC-NEXT-02 | Elegir bot puro, web+WhatsApp o híbrida | Implementado | Decisión: híbrida; WhatsApp captura/notifica, web gobierna y PWA cubre conectividad intermitente | Mantener una sola fuente de verdad y fallback por canal | S0, S15-S16, S20 |
| SPEC-NEXT-03 | Elegir Twilio/Vision/Firebase/Node | Parcial | Meta Cloud API directa y stack Next.js/Node/Postgres/Prisma/Clerk/Vercel definidos; visión pendiente de benchmark | No migrar ni sumar proveedor sin problema/evidencia; adapter de visión tras piloto | R0, S17, S22 |
| SPEC-NEXT-04 | Diseñar base con entidades principales | Parcial | Núcleo SaaS y operativo existe; faltan dominios canónicos definidos en esta matriz | Modelo/migración/API/autoridad por sprint, con backfill, verificador y rollback | S1-S19 |
| SPEC-NEXT-05 | Empezar MVP con una obra piloto | Externo pendiente | No existe evidencia de piloto real aprobado | Obra, responsables, consentimiento, datos iniciales, ambiente, soporte, métricas y criterio de salida definidos | R0 y carril piloto |

## Capacidades profesionales omitidas por el PDF

| ID | Requisito adicional | Estado | Evidencia / decisión | Secuencia |
| --- | --- | --- | --- | --- |
| PRO-01 | Tenancy, RBAC, alcance por obra y auditoría | Implementado | Base real; continuar defensa, gobierno y pruebas negativas | Continuo, S23 |
| PRO-02 | Idempotencia, concurrencia y recuperación de proveedores | Parcial | Cobertura contractual amplia en WhatsApp; dispar en Stripe/otros y sin WABA real | S0, R0, S23 |
| PRO-03 | CI, migraciones gobernadas y E2E por rol | Parcial | CI y gate de migraciones están implementados localmente y el drift UUID fue corregido; ejecución remota, smoke portable y E2E core siguen abiertos | S0 |
| PRO-04 | Observabilidad, SLO, alertas y runbooks | Parcial | Analytics/health puntuales; sin cobertura operacional integral | S0, S23 |
| PRO-05 | Backup, restore, RPO/RTO y borrado verificable | Ausente | Sin restore drill integral comprobado | S0, S23 |
| PRO-06 | Offline con resolución de conflictos | Ausente | Manifest/estado online no son offline | S20 |
| PRO-07 | QA/QC, RFI, submittal y no conformidades | Ausente | No intentar cuatro demos: S18 selecciona una vertical QA/QC; S19 implementa change control acotado; RFI, submittal y transmittal quedan explícitamente en backlog | S18-S19; resto backlog |
| PRO-08 | API/webhooks e integración ERP/BIM/BI | Ausente | No hay API pública versionada | API/scopes/webhooks y una integración priorizada por piloto | S22 |
| PRO-09 | Accesibilidad, rendimiento y type safety | Parcial | Hay prácticas aisladas, sin gates suficientes | Gates progresivos desde S0 y certificación en S23 | S0, S23 |
| PRO-10 | Localización, zona horaria, unidades y moneda | Parcial | Mayormente `es-AR`; organization guarda país/zona | Locale/unidades/moneda por tenant/obra; journeys regionales elegidos | S21 |
| PRO-11 | Presupuesto, comprometido, real, forecast y cambios | Ausente | Sólo total/ejecutado en snapshot | Ledger/códigos/versiones canónicos antes de certificación, compras y change control | S7, S9-S12, S19 |

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
