# Roadmap de producto y profesionalización

**Corte de evidencia:** 11 de agosto de 2026

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
| Commit/CI reproducible | El commit `dcb44b9` cerró CI `31549498945` 4/4. PostgreSQL 17 aplicó 123 migraciones y aprobó S9.1/S9.2-MED, status y drift cero; Quality aprobó `2388/2388`, lint, auditoría de producción sin vulnerabilidades y build Next.js 16.2.11 de 90 páginas; Browser público cerró 2/2; el job autenticado cerró 2/2 con seis actores Clerk Development, dos tenants y PostgreSQL descartable. El [corte S9.2-E2E](./evidence/2026-08-11-preview-dcb44b9.md) fija jobs, journey y límites. El [gate técnico `cc5aa21`](./evidence/2026-08-11-preview-cc5aa21.md) y los cortes [S9.1 `46c744c`](./evidence/2026-08-11-preview-46c744c.md), [PRO-05B.1 `871cf2f`](./evidence/2026-08-11-preview-871cf2f.md) y [S12.2C `fc71fbe`](./evidence/2026-08-11-preview-fc71fbe.md) permanecen como evidencia histórica independiente |
| Último Preview reproducible | El deployment inmutable `dpl_5PTCAS3wbhgniZe8Ss5oi41NbFgv` del commit `dcb44b9` quedó `READY`: Neon detectó 123 migraciones sin pendientes, S9.2-MED pasó rollback-only con carreras descartables no solicitadas, PRO-05B.1 quedó verde y el build cerró 90/90. Los cuatro smokes públicos read-only dieron `200`; en los cuatro eventos runtime exactos hubo nivel `info`, método GET y cero `error`, `fatal` o `5xx`. El journey autenticado mutante corrió sólo en CI Development descartable: no hubo auth, POST S9.2, alias ni Production en Preview ([evidencia](./evidence/2026-08-11-preview-dcb44b9.md)) |
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

ObraSaaS ya es una base SaaS real; no es sólo una maqueta. Tiene tenancy B2B, roles operativos, alcance por obra, auditoría, proyectos, Gantt, WhatsApp persistente, Flows gobernados, aprobaciones humanas, evidencia privada, asistencia y reportes PDF. Prisma, lint, build y la suite local permanecen como gates de cada corte. Baseline/forecast, la medición técnica cuantitativa S9.1 y el corte técnico quincenal reproducible S9.2-MED fueron verificados en Preview aislado; S9.2 agregó un journey autenticado completo en CI Development descartable, mientras la UI dedicada de S9.1 permanece pendiente. El puente local revisión visual → observación inmutable → forecast/Gantt todavía requiere aplicar su nueva migración y recorrer el journey autenticado en Preview.

Eso todavía no demuestra una operación Enterprise con clientes reales. Los principales límites actuales son la falta de validación externa con un WABA real, Clerk sobre instancia development, journeys E2E operativos insuficientes, convivencia temporal entre WBS canónica y snapshot legacy, equipos/blockers/costos/certificación incompletos y dominios profesionales pendientes en documentos, calidad, contratos, stock y colaboración externa.

### Matriz de capacidades

| Dominio | Estado | Evidencia actual | Decisión |
| --- | --- | --- | --- |
| Tenancy, roles y alcance por obra | Confirmado | Clerk Organizations, permisos en servidor, `ProjectMembership` y pruebas negativas | Conservar; preparar gobierno de Platform Admin y futura defensa en profundidad |
| Portfolio y onboarding | Confirmado | Alta/configuración/archivo de obras, límites por plan y puesta en marcha | Medir tiempo hasta primera obra operativa |
| Gantt y tareas | Motor en Preview; puente visual/Gantt local | WBS `Task`/`TaskDependency`, CAS, baseline inmutable/versionada, forecast determinista y Gantt canónico; una planificación relativa sobrevive aunque la obra aún no tenga calendario. Una decisión humana sobre evidencia revisada puede crear una observación append-only y comparación baseline/forecast por tarea | Aplicar/verificar la migración H5, cerrar smoke UI autenticado, ejecutar cutover legacy con cero drift y completar responsables/equipos/blockers antes de conectar costos contractuales |
| Medición técnica de avance | S9.1 y S9.2-MED verificados en CI PostgreSQL 17 y Preview; S9.2-E2E autenticado cerrado en Development descartable | El [ledger cuantitativo S9.1](./PROGRESS_MEASUREMENTS_S9_1.md) conserva unidad, base, cantidad ejecutada, evidencia aprobada, Decimal exacto y maker-checker. El [corte S9.2-MED](./PROGRESS_MEASUREMENT_CUTS_S9_2.md) sella todas las tareas canónicas de la obra/quincena como `MEASURED` o `MISSING`, con composición server-owned, versión, hashes, replay y doble CAS. Seis actores en dos tenants recorrieron maker-checker, roles negativos, cross-tenant, seal/replay/stale y lectura UI; ninguno de los artefactos modifica `Task.progress`, baseline, forecast, presupuesto, certificado ni pago | Completar el journey UI dedicado de S9.1. [S9.3-CONTRACT](./PROJECT_CONTRACT_AUTHORITY_S9_3.md) debe crear la autoridad contractual/SOV separada; S10 sólo podrá consumir el par exacto corte técnico + versión contractual. S9.2 no es certificado ni instrucción de pago |
| WhatsApp e Inbox | Confirmado por contrato; externo pendiente | Meta Cloud API directa como camino primario; app/caso de uso presentes; test number asignado, un celular propio verificado, outbound histórico aceptado y test oficial firmado `messages v25.0` recibido por Preview con HTTP 200. Firma, idempotencia, leases, Inbox, Flows operativos, Flow pre-operario H3.1, media privada y vínculo foto→`ProgressEvidence` están cubiertos localmente | El test del panel no prueba entrega ni E2E. Faltan challenge y tráfico inbound/estados reales, credencial del tenant importada cifrada, todos los Flows, storage y conexión real; Twilio no sustituye esos gates |
| IA visual y OCR | Infraestructura Preview gobernada; foto/E2E pendientes | `VisualProgressAssessment`, opt-in tenant, lease recuperable, sanitización, rango/abstención y revisión CAS; OpenAI `gpt-5.6-sol` es la ruta primaria gobernada, Terra es shadow explícito y HF/Z.ai permanecen como challengers por contrato. La credencial dedicada, presupuesto diario, esquema/recibo durable y verificadores de concurrencia/rollback están desplegados y verdes en Neon Preview; un smoke no personal confirmó visión y usage/cache completo | Probar una foto Meta real y un benchmark consentido antes de cualquier claim productivo; cerrar DPA/ZDR o retención aceptada, replay/conciliación autenticados y nunca certificar/pagar/reprogramar desde una foto |
| Propuestas y aprobación humana | Confirmado | Avance, demora e incidente crítico con decisión auditada | Extender el patrón a diarios, calidad, costos y cambios |
| Asistencia y salud | Parcial | Ledger canónico con ingreso, pausas, salida, GPS conservador, idempotencia, jornada y reporte; evidencia médica aislada | Completar S2 (turnos, tolerancia, excepciones y corrección aprobada) y el gate legal; no venderlo como nómina |
| Identidad laboral y destino de cobro | H3.1 Preview; H4 local con constancia privada, Meta pendiente | H3.1 incluye Flow pre-operario, aviso fijado, acuse terminal, CRM/readiness y purga transitoria; `d6b29b9` aplicó sus migraciones en Neon aislado y quedó `Ready`. H4 agrega consentimiento específico, re-atestación, CRM enmascarado, Data Endpoint terminal, caller inbound fail-closed, reconciliación DB-only y [constancia privada](./WORKER_PAYMENT_PRIVATE_RECEIPT.md) sólo por opt-in. El acceso vence a los 15 minutos; bearer y enlace no se persisten, el PDF se genera sin storage y ninguna superficie de constancia recibe el dato completo | Completar smoke H3.1; desplegar/verificar H4 en Neon y Vercel Preview; recorrer Meta E2E, expiración y PDF; definir reenvío fuera de ventana con plantilla `UTILITY`; integrar titularidad. La constancia no es pago y esta entrega no cierra PRO-05 |
| Privacidad y derechos del titular | PRO-05A y plano de control PRO-05B.1 verificados en Preview; ejecución deshabilitada | [PRO-05A](./DATA_SUBJECT_RIGHTS_FOUNDATION.md) conserva discovery read-only y bloqueado. El [plano PRO-05B.1](./DATA_SUBJECT_DECISION_CONTROL_PLANE.md) agrega eventos de identidad/representación, revisiones legales, holds, decisión por ítem, CAS, replay y maker-checker en una consola exclusiva de `ADMIN`; el [corte `871cf2f`](./evidence/2026-08-11-preview-871cf2f.md) verificó DB, CI, Preview y boundaries read-only `ADMIN`/`AUDITOR`. `executionAllowed` permanece `false`: no exporta, corrige, restringe, porta, anonimiza ni elimina | Aprobar entidad/matriz legal y recorrer POST sintético maker-checker; implementar adapters PRO-05C y propagación/backup/tombstone/restore PRO-05D antes de trabajadores reales. PRO-05B.1 no es un DSAR ejecutable |
| Incidencias y seguridad | Parcial | Captura y propuestas; el modelo relacional no es el workflow canónico | Crear propietario, SLA, causa, acciones correctivas y cierre |
| Materiales y stock | S12.2A/B/C con gate técnico en Preview y boundary multirrol; journey exitoso pendiente | [Ledger on-hand](./INVENTORY_STOCK_LEDGER.md), [BOM por tarea](./TASK_MATERIAL_REQUIREMENTS.md) y [reserva exacta](./TASK_MATERIAL_RESERVATIONS.md) separan recepción, existencia, requerimiento y reserva. S12.2C reserva o libera el bundle completo, con CAS, idempotencia, ledger append-only y carreras PostgreSQL reales. El smoke multirrol confirmó permisos y rechazo seguro, no una reserva real. `AVAILABLE` sólo significa BOM vigente completamente reservada sobre stock coherente | Recorrer reserva/liberación con BOM y stock sintéticos, rol restante y negativos cross-tenant; luego diseñar consumo, devolución, transferencia y ajuste. No hay reserva parcial, sustitución ni FIFO. `SupplierCommitment` sigue siendo **PROMESA, NO RESERVA** |
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
| CI y E2E | Parcial con gate S9.2 autenticado reproducible | El corte `dcb44b9` aprobó `2388/2388`, Prisma, lint, build 90/90, auditoría sin vulnerabilidades, PostgreSQL 17 con 123 migraciones/drift cero, Playwright público 2/2 y autenticado 2/2. S9.2-E2E usó seis actores Development, dos tenants y DB descartable; Preview repitió rollback-only sin carreras ni POST | Completar S9.1 UI, POST maker-checker de privacidad y journeys core/Meta/media/storage/visión. El cross-tenant de S9.2 está cubierto, no así una matriz global de todas las superficies; CI verde no equivale a operación real o Production |
| Internacionalización | No implementado | UI y formatos mayormente `es-AR` | Agregar español regional, portugués, zona horaria y multimoneda sin mezclar fiscalidad |

Fuentes internas principales: [autenticación y tenancy](./AUTH_AND_TENANCY.md), [ledger de asistencia](./ATTENDANCE_LEDGER.md), [contrato transitorio de tareas](./OPERATIONAL_TASKS.md), [constancia privada H4](./WORKER_PAYMENT_PRIVATE_RECEIPT.md) y [estado verificable de Meta](./WHATSAPP_META.md).

## Gates P0 antes de declarar producción comercial

Estos gates pueden avanzar en paralelo, pero ninguno se reemplaza con una captura o una prueba unitaria.

| Gate | Evidencia de salida | Estado al 11/08/2026 |
| --- | --- | --- |
| Especificación de la clienta trazada | Requisito, decisión, secuencia y criterio de aceptación por cada ítem | 92 IDs únicos integrados (80 SPEC + 12 PRO); validación con la socia y casos de prueba detallados pendientes por vertical |
| Calidad automatizada | CI remota verde con instalación exacta, lint, suite completa, auditoría, build y smokes público/autenticado | `dcb44b9`: `2388/2388`, Prisma, lint, auditoría con cero vulnerabilidades, build 90/90, PostgreSQL 17 con 123 migraciones/drift cero, S9.1/S9.2-MED, S12.2C, PRO-05A/B.1, Playwright público 2/2 y S9.2 autenticado 2/2; CI GitHub `31549498945` terminó 4/4 verde |
| Journey operativo E2E | Admin crea obra/trabajador/tarea, aprueba propuesta y descarga reporte; roles restringidos fallan correctamente | Parcial: S9.2-E2E ya cubre seis actores, maker-checker, tres roles sin sellado, dos tenants, negativos cross-tenant, seal/replay/stale y UI final sobre Clerk Development/PostgreSQL descartable. Aún no cubre alta de trabajador, flujo core completo, descarga de reporte, proveedores externos ni POST de privacidad |
| WhatsApp real | Embedded Signup, inbound/outbound, estados, Flows operativos y pre-operario, reintento, expiración y fallback en teléfono real | Test number asignado, celular propio verificado, outbound histórico aceptado y test oficial firmado del panel recibido con HTTP 200. No es bidireccional/E2E: faltan publicación/revisión aplicable, credencial cifrada del tenant, challenge y tráfico inbound/estados reales, Flows y conexión real |
| Identidad productiva | Dominio propio, Clerk Production, cutover y rollback ensayados, alta/invitación/baja verificadas | Pendiente externo |
| Billing coherente | Checkout explícitamente deshabilitado o intención idempotente, UI, consentimiento, términos, precios y webhooks reconciliados | Cerrado por defecto; versiones exactas requeridas; intención durable, concurrencia, UI y webhook pendientes |
| Salud operacional | Errores, backlog, latencia y proveedores con señal, correlación, redacción y alerta accionable | Parcial; primer control de cron en esta rama |
| Migraciones gobernadas | Postgres efímero, `migrate deploy`, estado, diff sin drift, smoke y rollback documentados | CI PostgreSQL 17 aprobó 123 migraciones y los gates S9.1/S9.2-MED, S12.2C y PRO-05A/B.1 en `dcb44b9`; cerró `migrate status` y drift cero. El job autenticado aplicó aparte las 123 migraciones a `obrasaas_e2e` descartable. Vercel/Neon Preview detectó las mismas 123 sin pendientes y aprobó S9.2 rollback-only y PRO-05B.1, con carreras no solicitadas. Promoción atómica/drenaje y Production siguen pendientes; no admitir pods v1/v2 balanceados |
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
- Postgres 17 efímero y Neon Preview: `validate`, las 121 migraciones actuales, estado sin pendientes, verificadores semánticos y smoke rollback-only verdes en `871cf2f`; `fc71fbe` y `0a00f37` permanecen como evidencia histórica de sus respectivos gates;
- checkout cerrado por defecto y request estricto; no habilitarlo sin intención durable, idempotencia, consentimiento verificable y reconciliación;
- E2E autenticado de los journeys críticos y denegaciones por tenant/obra/rol;
- observabilidad mínima, correlation ID y runbooks de migración/incidente/rollback.

**Salida:** checks remotos verdes y requeridos, migración idempotente, fallas de proveedor visibles y ningún camino comercial habilitado por accidente.

Estado de esta iteración:

- implementados localmente: CI base, E2E público sin secretos Clerk, artefactos Playwright, health de recuperación WhatsApp, gate de checkout, gate de migraciones, corrección de drift UUID y trazabilidad del PDF;
- verificados para `871cf2f`: `2230/2230` tests, Prisma válido/generado, lint, build 88/88, auditoría de dependencias de producción sin vulnerabilidades, PostgreSQL 17 con 121 migraciones/drift cero, CI GitHub 3/3 y Vercel/Neon Preview `Ready`; el smoke PRO-05B.1 comprobó boundaries read-only `ADMIN`/`AUDITOR`, mientras POST maker-checker, journey core, cross-tenant y E2E externo siguen abiertos. El boundary multirrol S12.2C se conserva en `fc71fbe`;
- seguridad de tooling: `@prisma/dev` queda temporalmente fijado a Valibot 1.4.2 mediante override acotado por el advisory vigente; retirarlo cuando Prisma publique el pin corregido y mantener auditadas por separado las dependencias exclusivas de desarrollo;
- pendientes internos de S0: proteger formalmente la rama con CI requerida, completar E2E autenticado/core y cross-tenant, observabilidad integral y runbooks completos.

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
| S9.3-S10 | SOV contractual, moneda/minor units, unidades, retención, redondeo, tres autoridades, cadena de aprobación y significado jurídico del certificado |
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
| S9.1 | Medición de avance | unidad/cantidad base/ejecutada, método, período, evidencia, corrección y aprobación | verificado en CI/Preview; un porcentaje aislado no es medición y cada línea tiene base y trazabilidad |
| S9.2-MED | Corte técnico quincenal | snapshot inmutable de todas las tareas canónicas de la obra y período como `MEASURED` o `MISSING`, con hash, versión, replay y doble CAS | verificado en CI/Preview; una corrección posterior no reescribe el corte y exige una versión nueva. No contiene dinero ni certificación |
| S9.3-CONTRACT | Autoridad contractual y SOV | [head/versión/líneas/decisiones propios](./PROJECT_CONTRACT_AUTHORITY_S9_3.md); todas las tareas `VALUED` o `NO_CLAIM`, moneda/escala, importe en minor units, retención bps, redondeo y autoridades versionadas | pendiente de implementación; maker-checker y tres membresías activas distintas, sin reutilizar `BudgetVersion`, `SupplierInvoice`, certificado ni pago |
| S10 | Certificación en tres fases separadas | certificado consume cut S9.2 + contrato S9.3 exactos; luego conformidad financiera append-only; luego referencia externa de pago append-only; PDF privado determinista separado | corregir crea versión; `MISSING` bloquea el cálculo hasta un `NO_CLAIM` explícito con null y causa; certificado/conformidad/referencia nunca crean `PAID` ni ejecutan o prueban pago |
| S11 | Proveedores y compras | vendor, requisición/BOM por WBS, cotización, selección y OC versionada/aprobada | solicitar/aprobar son roles distintos; ninguna sugerencia IA compra automáticamente |
| S12 | Recepción y stock ledger | entregas parciales, remito/evidencia, aceptado/rechazado, consumo/transferencia/ajuste y readiness | duplicado no suma; faltante queda abierto; conformidad sólo alimenta revisión financiera |

Quedan fuera: nómina, impuestos, contabilidad general, cuentas por pagar automáticas y ERP fiscal propio.

Estado S9.1/S9.2-MED actualizado al 11 de agosto de 2026: el [ledger de mediciones](./PROGRESS_MEASUREMENTS_S9_1.md) y el [corte técnico quincenal](./PROGRESS_MEASUREMENT_CUTS_S9_2.md) quedaron verificados sobre 123 migraciones en PostgreSQL 17 y Vercel/Neon Preview en el [corte técnico `cc5aa21`](./evidence/2026-08-11-preview-cc5aa21.md). El [corte funcional `dcb44b9`](./evidence/2026-08-11-preview-dcb44b9.md) agregó CI 4/4 y un E2E autenticado con seis actores Development en dos tenants: maker-checker, roles negativos, cross-tenant, seal v1/v2, replay, `STALE` y lectura UI. Esa mutación ocurrió sólo sobre PostgreSQL descartable; Preview permaneció read-only. S9.2 conserva ausencias como `MISSING`, nunca como cantidad cero, y no crea importes, certificado, PDF contractual, conformidad financiera, estado de pago ni mutación de `Task.progress`. S10 permanece separado y pendiente.

Estado S9.3-CONTRACT: su [contrato de diseño](./PROJECT_CONTRACT_AUTHORITY_S9_3.md) está congelado como prerrequisito de S10, pero la vertical permanece abierta hasta implementar y verificar esquema, migración, guards, RBAC, API/UI y E2E. `BudgetVersion` continúa siendo presupuesto interno y el [runbook histórico de cuentas por pagar](./S10_PAYABLES_RUNBOOK.md) queda clasificado como legacy/AP; ninguno es reutilizable como SOV, certificado, conformidad o referencia de pago.

Estado S11/S12 actualizado al 11 de agosto de 2026: proveedor, OC, compromiso con fecha, calendario quincenal, cantidades exactas, recepción parcial y asignación explícita están verificadas en Preview. También quedaron verificadas la inspección versionada aceptado/dañado/rechazado/cuarentena, las ubicaciones tenant-scoped y el cierre/reversión append-only de faltantes. S12.2A suma el [ledger de existencias](./INVENTORY_STOCK_LEDGER.md): catálogo canónico, vínculo inmutable de línea, putaway completo de `ACCEPTED`, reversión exacta y saldo on-hand DB-owned. Su [migración, verificador, build y borde HTTP sin sesión](./evidence/2026-08-02-preview-4760a50.md) están validados en Preview; el recorrido UI autenticado sigue pendiente. S12.2B suma la [BOM/requerimiento versionado por tarea](./TASK_MATERIAL_REQUIREMENTS.md), historial inmutable, CAS del head y declaración explícita `NO_MATERIALS_REQUIRED`; sus [migraciones 116+117, verificador PostgreSQL y build](./evidence/2026-08-09-preview-054a82c.md) están verificados en Preview. S12.2C agrega la [reserva/liberación exacta](./TASK_MATERIAL_RESERVATIONS.md) de la BOM completa; su migración 120, cuatro carreras PostgreSQL, gate rollback-only de Neon y build quedaron [certificados para `fc71fbe`](./evidence/2026-08-11-preview-fc71fbe.md). El mismo artefacto aprobó un smoke sintético acotado de `AUDITOR`, `DIRECTOR` y `SITE_MANAGER`; faltan una reserva/liberación exitosa, el rol restante y negativos cross-tenant. `SupplierCommitment` es **PROMESA, NO RESERVA** y `AVAILABLE` significa únicamente material de la BOM vigente completamente reservado sobre existencia coherente; no prueba ejecutabilidad, avance, certificación ni pago. No existen consumo, devolución, transferencia, ajuste, sustitución, reserva parcial ni FIFO. Nada de este corte acredita Production ni habilita trabajadores reales.

La ampliación de la socia sobre coordinar tareas y proveedores ya queda trazada por fechas de material o servicio, calendario civil por quincenas 1-15/16-fin, exportación snapshot `.ics` y recordatorio configurado por defecto siete días antes. Esa base está en Preview, pero el `.ics` no es sincronización viva y el email real permanece gated hasta configurar Resend, verificar dominio/remitente y observar cron, webhook y entrega E2E. Tampoco constituye una reserva de materiales.

### Ola 3 — Documentos y colaboración externa

| Sprint | Vertical de salida | Incluye | Criterio de salida |
| --- | --- | --- | --- |
| S13 | Documentos y planos | `Document`/`Version`, disciplina, revisión, vigencia, PDF/DWG seguro, vínculos y búsqueda | sólo una revisión vigente; obsoletas inmutables; permisos y archivos privados probados |
| S14 | Legajos y firma integrada | vault DNI/obra social/ART/certificados, expiración/retención y acta con proveedor aprobado | rol común no enumera legajos; hash/identidad/intención/versiones verificables; sin firma casera |
| S15 | Outbox y notificaciones | evento, destinatario, preferencia, canal, entrega/lectura, retry, dead letter y escalamiento | alerta durable, deduplicada y observable aunque no haya pestaña abierta |
| S16 | Portal de Cliente | `ExternalPrincipal`/`ProjectAccessGrant`, publicación aprobada, enlaces expirables y revocación | no consume/infiere `TenantMembership`; sólo ve artefactos publicados de su obra |

Estado de identidad laboral/cobro al corte: H3.1 ya incluye invitación, Flow/sesión pre-operario, aviso fijado, acuse terminal, CRM/readiness, decisión y purga transitoria, además del dominio criptográfico y APIs tenant-scoped. El commit `d6b29b9` aplicó originalmente sus dos migraciones en Neon aislado; el gate posterior de `0a00f37` volvió a verificar el esquema completo de 100 migraciones y quedó `Ready`. Eso no acredita todavía smoke UI/runtime, cron observado ni E2E Meta, y no implica despliegue en Production. `privacyPresentedAt` prueba que `INIT` sirvió el aviso, no lectura humana; el copy requiere revisión legal antes de trabajadores reales. La purga H3.1 no es DSAR integral y quedan fuera `WorkerPerson`, `WorkerChannelIdentity`, `Worker`, mensajes y backups; también sigue pendiente retirar el teléfono raw interno de `Conversation.externalId`.

H4 ya suma localmente consentimiento específico append-only por destino/canal, re-atestación legacy, panel CRM enmascarado, Flow companion de un solo uso, Data Endpoint terminal, caller inbound determinístico y reconciliación DB-only. La intención `PAYMENT_DESTINATION` sólo habilita emisión para resolución `CANONICAL`, persona/canal verificados, obra activa y referencia publicada; la sesión genérica y companion nacen dentro de la misma transacción del webhook. El POST a Meta sigue ocurriendo después del commit bajo el journal anti-duplicado, sin falsa atomicidad DB–Meta. La transición excepcional `UNCERTAIN → SUCCEEDED` exige un destino ya persistido con tenant, reserva, HMAC, tipo/fingerprint, claves de operación, canal y consentimiento exactos; no reejecuta bridge, proveedor ni WhatsApp.

El incremento local `13400` agrega la [constancia privada de recepción](./WORKER_PAYMENT_PRIVATE_RECEIPT.md). El opt-in queda fijado en la companion y ligado al HMAC; `false` o ausencia conservan compatibilidad. Después del resultado terminal se persiste sólo un registro enmascarado y un descriptor opaco. El bearer se reconstruye en memoria después de ganar el claim de entrega, viaja únicamente en `#token=...` y vence a los 15 minutos. La webview elimina el fragmento antes del primer request y el PDF se genera bajo demanda sin guardarse en storage. Ni la webview ni el PDF muestran CBU, CVU o alias completos. Esta constancia sólo acredita recepción para revisión: no acredita titularidad, validación bancaria, activación, transferencia ni pago.

Las cinco migraciones H4 `13000/13100/13200/13300/13400` ya pasan juntas desde cero en PGlite descartable, y el delta completo supera pruebas, Prisma, lint y build locales. Aun faltan PostgreSQL real/Neon Preview, smoke H4 en Vercel Preview, publicación/Meta E2E, expiración/revocación observadas y proveedor confiable de verificación bancaria. El reenvío fuera de la ventana de atención y la plantilla `UTILITY` correspondiente siguen pendientes. Por lo tanto, H3 y H4 de [readiness del piloto WhatsApp](./PILOT_WHATSAPP_E2E_READINESS.md) siguen **en progreso**, no están en Production y no deben presentarse como funcionalidad disponible. La vigencia de 15 minutos no es borrado ni DSAR.

[PRO-05A](./DATA_SUBJECT_RIGHTS_FOUNDATION.md) conserva una base no destructiva con discovery `READ ONLY`, catálogo/manifiesto inmutables y blockers obligatorios. PRO-05B.1 ya agregó el plano de control de identidad/representación, plazos, bases, holds y decisión maker-checker; CI y el Preview de 121 migraciones del [corte `871cf2f`](./evidence/2026-08-11-preview-871cf2f.md) quedaron verdes y el smoke read-only comprobó acceso `ADMIN` y rechazo `AUDITOR`. Esto **no es un DSAR ejecutable**: la cola estaba vacía, no se hizo ningún POST y `executionAllowed` permanece `false`. PRO-05C debe implementar acciones idempotentes por dominio y PRO-05D, terceros, backups, tombstones y restore. Sin entidad legal/domicilio, matriz aprobada, E2E mutante sintético y esas fases no se habilitan datos de trabajadores reales.

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

La estrategia de integraciones abiertas se documenta en
[OPEN_CAPABILITY_GATEWAY.md](./OPEN_CAPABILITY_GATEWAY.md). El catálogo de una
comunidad es una fuente de descubrimiento, no una aprobación productiva. El
primer slice previsto es clima consultivo, sin mutar tareas, asistencia,
baseline, pagos ni certificaciones, y no desplaza los gates Meta/privacidad del
piloto.

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
