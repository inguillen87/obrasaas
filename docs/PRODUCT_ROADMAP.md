# Roadmap de producto y profesionalización

**Corte de evidencia:** 23 de julio de 2026

**Rama de trabajo:** `codex/platform-ux-foundation`

**Estado:** backlog base aprobado por evidencia del repositorio; pendiente de cruzar con la especificación de la clienta y socia.

## Propósito

Este documento convierte el estado real de ObraSaaS en un plan ejecutable. Distingue cuatro situaciones que no deben mezclarse:

- **Confirmado:** existe código productivo, autorización, persistencia y pruebas relevantes.
- **Parcial:** existe una superficie útil, pero el dominio o el workflow todavía no es completo.
- **Pendiente de validación externa:** el contrato está implementado, pero depende de un proveedor o ambiente real.
- **No implementado:** es una capacidad de roadmap y no se debe presentar como disponible.

La especificación mencionada por la clienta **no fue recibida todavía en este hilo**. Cuando llegue, cada requisito se incorporará a la matriz de trazabilidad al final de este documento. Hasta entonces, este roadmap es una base técnica y competitiva, no una interpretación inventada de ese material.

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

ObraSaaS ya es una base SaaS real; no es sólo una maqueta. Tiene tenancy B2B, roles operativos, alcance por obra, auditoría, proyectos, Gantt, WhatsApp persistente, Flows gobernados, aprobaciones humanas, evidencia privada, asistencia y reportes PDF. La suite contractual tiene 722 pruebas unitarias y de integración liviana.

Eso todavía no demuestra una operación Enterprise con clientes reales. Los principales límites actuales son la falta de validación externa con un WABA real, Clerk sobre instancia development, journeys E2E operativos insuficientes, estado centralizado en un snapshot JSON y dominios profesionales incompletos en costos, documentos, calidad, contratos, stock y colaboración externa.

### Matriz de capacidades

| Dominio | Estado | Evidencia actual | Decisión |
| --- | --- | --- | --- |
| Tenancy, roles y alcance por obra | Confirmado | Clerk Organizations, permisos en servidor, `ProjectMembership` y pruebas negativas | Conservar; preparar gobierno de Platform Admin y futura defensa en profundidad |
| Portfolio y onboarding | Confirmado | Alta/configuración/archivo de obras, límites por plan y puesta en marcha | Medir tiempo hasta primera obra operativa |
| Gantt y tareas | Parcial | Gantt con CAS y proyección relacional; `ProjectSnapshot.state.tasks` sigue siendo autoridad | Hacer `Task` y WBS canónicos antes de conectar costos |
| WhatsApp e Inbox | Confirmado por contrato; externo pendiente | Firma, idempotencia, leases, inbox, Flows y evidencia privada | Ejecutar los nueve gates con WABA real antes de afirmar E2E operativo |
| Propuestas y aprobación humana | Confirmado | Avance, demora e incidente crítico con decisión auditada | Extender el patrón a diarios, calidad, costos y cambios |
| Asistencia y salud | Parcial | Check-in, geocerca y evidencia médica aislada | Incorporar salida, turno, horas y excepciones; no venderlo como nómina |
| Incidencias y seguridad | Parcial | Captura y propuestas; el modelo relacional no es el workflow canónico | Crear propietario, SLA, causa, acciones correctivas y cierre |
| Acopios | Parcial | Catálogo y niveles básicos | Migrar a ledger inmutable de recepción, consumo, ajuste y ubicación |
| Costos y rol Finance | No suficiente | Sólo total/ejecutado en snapshot; permiso nominal sin superficie propia | Crear presupuesto, comprometido, real, forecast y cambios sobre la misma WBS |
| Reporte semanal | Parcial | PDF real con hash y auditoría, generado al vuelo | Persistir artefacto y snapshot reproducible con historial y retención |
| Bitácora | Parcial | Agrega fuentes reales, pero recorta a eventos recientes | Cursor estable, filtros server-side y exportación completa con hash |
| Documentos, planos y versiones | No implementado | No hay modelo canónico | Construir control documental antes de RFI/submittal avanzados |
| QA/QC, inspecciones y no conformidades | No implementado | Sin workflow canónico | Compartir formularios, evidencia, responsable, SLA y cierre |
| RFI, submittal y transmittal | No implementado | Sin modelos ni rutas | Implementar después de documentos/versiones y notificaciones |
| Notificaciones durables | No implementado | Polling, toasts y mensajes puntuales | Crear outbox, preferencias, entrega, lectura y escalamiento |
| Portal de cliente/subcontratista | No implementado | No existe una experiencia externa gobernada | Agregar enlaces/portal con permisos mínimos y evidencia aprobada |
| Offline/PWA | No implementado | Manifest y estado online; sin service worker ni cola local | Diseñar sincronización y conflictos después de estabilizar APIs canónicas |
| API pública e integraciones | No implementado | Integraciones internas con proveedores; sin API pública versionada | API, scopes, rate limit, webhooks tenant y conectores antes de prometer ERP/BI |
| Billing | Parcial | Backend Stripe y webhook; sin UI coherente ni pruebas específicas | Decidir activación o deshabilitar checkout; alinear precios, términos y consentimiento |
| Observabilidad y operaciones | No suficiente | Analytics web anonimizado; sin APM, SLO, alertas ni DR probado | Es gate de producción, no mejora opcional |
| CI y E2E | En implementación | 722 tests; E2E público separado y workflow CI agregados en esta rama | Requiere commit, ejecución remota verde y expansión a journeys autenticados |
| Internacionalización | No implementado | UI y formatos mayormente `es-AR` | Agregar español regional, portugués, zona horaria y multimoneda sin mezclar fiscalidad |

Fuentes internas principales: [autenticación y tenancy](./AUTH_AND_TENANCY.md), [contrato transitorio de tareas](./OPERATIONAL_TASKS.md) y [estado verificable de Meta](./WHATSAPP_META.md).

## Gates P0 antes de declarar producción comercial

Estos gates pueden avanzar en paralelo, pero ninguno se reemplaza con una captura o una prueba unitaria.

| Gate | Evidencia de salida | Estado al 23/07/2026 |
| --- | --- | --- |
| Especificación de la clienta trazada | Requisito, decisión, sprint y test de aceptación por cada ítem | Pendiente de recepción |
| Calidad automatizada | CI remota verde con instalación exacta, lint, 722+ tests, auditoría, build y smoke público | Implementado y verde localmente; ejecución GitHub pendiente |
| Journey operativo E2E | Admin crea obra/trabajador/tarea, aprueba propuesta y descarga reporte; roles restringidos fallan correctamente | Pendiente |
| WhatsApp real | Embedded Signup, inbound/outbound, estados, ambos Flows, reintento, expiración y fallback en teléfono real | Pendiente externo |
| Identidad productiva | Dominio propio, Clerk Production, cutover y rollback ensayados, alta/invitación/baja verificadas | Pendiente externo |
| Billing coherente | Checkout explícitamente deshabilitado o UI, consentimiento, términos, precios y webhooks reconciliados | Pendiente |
| Salud operacional | Errores, backlog, latencia y proveedores con señal, correlación, redacción y alerta accionable | Parcial; primer control de cron en esta rama |
| Migraciones gobernadas | Expand/backfill/contract, Postgres efímero, `migrate deploy`, smoke y rollback documentados | Pendiente |
| Backup, restauración y borrado | RPO/RTO, restore drill y ledger de exportación/borrado sobre todos los proveedores | Pendiente |
| Gobierno de plataforma | Dos custodios, MFA/step-up y procedimiento break-glass para administración global | Pendiente |

La revisión formal y exhaustiva de seguridad, el pentest y la validación legal especializada son gates posteriores específicos. Este diagnóstico no los sustituye.

## Principios de secuenciación

1. **Verdad antes que marketing.** Una capacidad externa se publica sólo después de una prueba reproducible.
2. **Modelo canónico antes que offline o integraciones.** Sin APIs lossless, la sincronización sólo multiplica conflictos.
3. **Una WBS compartida.** Cronograma, avance, presupuesto, comprometido, real y forecast deben referirse a las mismas identidades.
4. **Borrador antes que mutación de IA.** La automatización crea propuestas; las políticas y los roles autorizan la acción.
5. **No construir un motor BIM.** Autodesk ya domina ese problema; ObraSaaS debe enlazar documentos/modelos e integrar proveedores.
6. **Participación externa con privilegio mínimo.** WhatsApp y enlaces seguros reducen fricción sin convertir el canal en fuente de verdad.
7. **Cada sprint deja un vertical utilizable.** Modelo, API, UI, permisos, auditoría, migración, observabilidad y pruebas salen juntos.

## Roadmap ejecutable

Las duraciones propuestas son de diez días hábiles por sprint. Es un programa multitrimestre de catorce sprints, no una promesa comercial cerrada. Se reestima después de incorporar la especificación y observar el primer piloto. Los gates externos de Meta, dominio y proveedores pueden exceder un sprint y se siguen como carril paralelo.

### Sprint 0 — Verdad de producción y calidad continua

**Objetivo:** impedir releases engañosas o silenciosamente rotas y producir evidencia de readiness.

Entregables:

- workflow CI con Node 24, instalación exacta, lint, tests, auditoría de dependencias, build y E2E público;
- Playwright público independiente de secretos Clerk y browser portable;
- contrato de salud del recuperador de WhatsApp que diferencie solicitud exitosa de trabajo saludable;
- copy comercial alineado a capacidades activas, demo, roadmap y dependencias externas;
- decisión explícita sobre checkout Stripe hasta contar con UI y términos coherentes;
- runbook de ambientes, migraciones, WABA real, incidentes, restauración y borrado;
- observabilidad mínima: request/correlation ID, errores server, proveedor, backlog y alertas sin PII;
- journeys E2E Admin/Jefe/Finance/Auditor, incluyendo móvil de 390 px.

Criterio de salida:

- CI remota verde en la rama y obligatoria para integrar;
- una falla terminal/bloqueo/GC de webhook genera señal `workHealthy=false` y fallo visible del monitor;
- no hay claims públicos de multiempresa, ERP, BIM, billing o WhatsApp real que excedan la evidencia;
- cada gate externo tiene responsable, fecha, ambiente y registro sanitizado;
- no se declara producción mientras Clerk, WABA, billing, DR o E2E core sigan pendientes.

Estado de esta iteración:

- implementados en la rama: CI, E2E público desacoplado de Clerk, artefactos Playwright en fallos, señal de salud del cron, copy comercial honesto y este roadmap;
- verificados localmente: 722/722 tests, lint, auditoría sin vulnerabilidades, build de producción y 2/2 smoke tests públicos;
- pendiente para cerrar Sprint 0: primera ejecución remota, E2E autenticado/core, billing, observabilidad integral, migraciones gobernadas, DR y gates externos.

### Sprint 1 — WBS y tareas como núcleo canónico

**Objetivo:** retirar gradualmente la autoridad de escritura de `ProjectSnapshot.state.tasks`.

Entregables:

- `Task`, `TaskDependency`, WBS/código, hitos, baseline, fechas reales, prioridad, restricciones y responsable por ID;
- API lossless con CAS, validación de ciclos, filtros por obra y permisos por rol;
- adaptador transitorio de lectura/escritura para consumidores del snapshot;
- Gantt escribiendo la API canónica;
- migración, backfill idempotente, verificador de paridad y rollback.

Criterio de salida:

- todos los caminos productivos escriben la misma transacción canónica;
- cero drift en el verificador sobre datos de prueba representativos;
- una edición concurrente devuelve conflicto controlado y no pierde cambios;
- WhatsApp, aprobaciones, portfolio y reporte conservan identidad y resultado.

### Sprint 2 — Bitácora diaria e incidencias canónicas

**Objetivo:** reemplazar notas dispersas por dos workflows operativos completos y alertables.

Entregables:

- `DailyLog`, `Incident`, evidencia y estados canónicos;
- propietario, severidad, vencimiento, causa, acción correctiva básica y cierre;
- relación con proyecto, WBS/tarea, autor, ubicación y evidencia;
- outbox mínimo para incidentes críticos con deduplicación, reintento y escalamiento;
- captura web/WhatsApp como propuesta revisable, todavía sin agente autónomo ni form builder.

Criterio de salida:

- un reporte de campo llega a revisión y registro final sin perder su evidencia;
- un crítico genera una notificación durable aunque ninguna pestaña esté abierta;
- permisos negativos, duplicados, reintentos y cruces de tenant están probados;
- dashboard y reporte consumen la fuente relacional, no una copia divergente.

### Sprint 3 — IA gobernada para captura de campo

**Objetivo:** estructurar texto, audio y foto sin ocultar incertidumbre ni conceder capacidad de mutación autónoma.

Entregables:

- esquemas de salida por intención, fuente original, campos inciertos y confianza visible;
- borradores de diario, incidencia y avance bajo feature flag;
- cola de aprobación, corrección y rechazo con versión de configuración/modelo auditada;
- evaluaciones de fuga entre tenants, permiso, alucinación, duplicado y prompt injection;
- handoff humano y fallback determinista cuando la extracción no es confiable.

Criterio de salida:

- ninguna propuesta modifica cronograma, seguridad, costo o contrato sin autorización;
- el revisor puede contrastar cada campo contra su evidencia;
- las correcciones quedan registradas y alimentan métricas de calidad;
- los umbrales se fijan con datos del piloto, no con afirmaciones comerciales.

### Sprint 4 — Costos y control económico conectado

**Objetivo:** dar al rol Finance una superficie real sin permitirle editar Gantt o RRHH.

Entregables:

- `CostCode`, presupuesto base/versiones, comprometido, real, forecast y moneda;
- UI y API exclusivas para Finance; Auditor de sólo lectura;
- importación/exportación CSV validada y trazabilidad hacia WBS, proveedor y aprobación;
- orden de cambio básica con impacto antes de aprobar;
- decisión de catálogo Stripe, Price IDs, idempotencia/reconciliación y auditoría de billing.

Criterio de salida:

- presupuesto + cambios aprobados = presupuesto vigente con fórmula reproducible;
- comprometido, real y forecast se reconcilian por WBS y período;
- Finance puede operar costos y no puede mutar planificación;
- cambios contractuales o sobre umbral requieren validación reforzada.

Quedan fuera de este sprint: contabilidad general, nómina, impuestos locales, multimoneda transaccional y un ERP fiscal propio.

### Sprint 5 — Stock como ledger

**Objetivo:** reemplazar contadores mutables por movimientos auditables.

Entregables:

- movimientos de recepción, consumo, transferencia y ajuste;
- depósito, proveedor, referencia, costo y entregas parciales;
- mínimos y alertas deduplicadas;
- conciliación con capturas WhatsApp y evidencia.

Criterio de salida:

- el stock actual se deriva del ledger y cada ajuste tiene actor y motivo;
- dos recepciones repetidas no duplican inventario;
- una transferencia conserva origen, destino y balance;
- reporte y alertas usan la misma fuente canónica.

Procurement avanzado, órdenes de compra automáticas y maquinaria quedan fuera.

### Sprint 6 — Asistencia, turnos y seguridad de campo

**Objetivo:** completar el control de presencia sin presentarlo como nómina o HR integral.

Entregables:

- check-in/check-out, turno, horas, excepción y aprobación;
- reglas de geocerca, duplicados, fichaje tardío y corrección auditada;
- permisos separados para datos médicos y de seguridad;
- conciliación con WhatsApp/webview y reportes.

Criterio de salida:

- horas trabajadas se reproducen desde eventos y excepciones aprobadas;
- no se puede fichar en otra obra o reutilizar una sesión vencida;
- datos médicos siguen siendo invisibles para roles no autorizados;
- la UI diferencia control de obra de liquidación de sueldos.

### Sprint 7 — Documentos, planos y versiones

**Objetivo:** construir la base documental previa a RFI, submittal, QA y offline.

Entregables:

- documento, carpeta, versión, revisión, aprobación, vigencia y permisos;
- preview y vínculo con obra, WBS/tarea, incidencia y evidencia;
- plano versionado y anotación/issue básico;
- reporte semanal persistido como artefacto privado, inmutable y reproducible;
- búsqueda permission-aware y retención documentada.

Criterio de salida:

- nunca se confunde una revisión obsoleta con la vigente;
- cada issue referencia versión, ubicación, responsable y evidencia;
- el PDF descargado posteriormente reproduce el SHA registrado;
- móvil y escritorio pasan pruebas de permisos, accesibilidad y tamaño.

### Sprint 8 — Workflow contractual o QA acotado

**Objetivo:** validar una vertical profesional sobre la base documental, sin intentar construir todos los módulos juntos.

Entregables:

- primitivas compartidas de numeración, revisión, responsable, SLA, evidencia y cierre;
- **una** vertical prioritaria definida por la especificación/piloto: RFI, submittal o inspección/no conformidad;
- comentarios, historial, exportación y dashboard de vencimientos;
- borradores de IA basados sólo en documentos autorizados, con citas y aprobación.

Criterio de salida:

- cada cambio de estado conserva actor, versión y motivo;
- una respuesta sólo usa documentos visibles para ese rol;
- la vertical elegida tiene E2E completo, no tres demos parciales;
- los otros workflows permanecen explícitamente en backlog.

### Sprint 9 — Notificaciones y portal externo acotado

**Objetivo:** dar participación externa sin abrir el tenant ni crear un portal genérico prematuro.

Entregables:

- centro de notificaciones durable, preferencias, lectura, deduplicación y escalamiento;
- un rol externo y un workflow ya estable, idealmente el elegido en Sprint 8;
- enlaces seguros con scope mínimo, expiración, revocación y auditoría;
- resúmenes WhatsApp aprobados y exportaciones completas con hash.

Criterio de salida:

- un invitado no puede enumerar otra obra, documento o versión;
- vencimientos y escalaciones no dependen de una pestaña abierta;
- ningún resumen externo incluye datos no aprobados o restringidos;
- revocar acceso corta sesiones y enlaces activos.

### Sprint 10 — Offline de campo acotado

**Objetivo:** operar con conectividad intermitente sobre workflows ya canónicos.

Entregables:

- PWA con service worker y cola offline para incidentes, asistencia y evidencia;
- almacenamiento local acorde al riesgo, expiración y limpieza remota/operativa;
- estrategia explícita de conflicto, reintento, adjuntos e idempotencia;
- telemetría de sincronización sin contenido sensible.

Criterio de salida:

- captura y sincronización se prueban sin red y con red degradada;
- conflictos nunca pisan silenciosamente una versión más nueva;
- una pérdida de dispositivo tiene mitigación y política de retención;
- el alcance offline excluido queda visible en la UI.

### Sprint 11 — Localización y configuración regional

**Objetivo:** retirar constantes `es-AR` sin fingir que existe fiscalidad pan-LATAM completa.

Entregables:

- infraestructura de locale, zona horaria, unidades y moneda por tenant/proyecto;
- español regional y portugués en journeys priorizados;
- catálogos traducibles y formatos server/client consistentes;
- pruebas de nombres, acentos, DST, separadores y monedas.

Criterio de salida:

- idioma, moneda y fecha no dependen de constantes globales;
- un reporte reproduce la zona horaria y moneda de la obra;
- no se mezclan importes de monedas distintas sin conversión explícita;
- requisitos fiscales nacionales permanecen en integraciones especializadas.

### Sprint 12 — API pública e integración prioritaria

**Objetivo:** integrar una vertical real sin prometer reemplazar ERP o BIM.

Entregables:

- API v1 inicialmente acotada, contrato OpenAPI, scopes, rate limits e idempotencia;
- webhooks salientes firmados, reintentos, dead letter y replay;
- **una** integración elegida por demanda del piloto: ERP/contable, BI o proveedor documental/BIM;
- importación/exportación con mapping, validación y reconciliación.

Criterio de salida:

- pruebas de compatibilidad protegen el contrato versionado;
- credenciales son rotables y de alcance mínimo;
- duplicados y eventos fuera de orden no corrompen estado;
- la integración tiene owner, SLO, runbook y estado visible.

### Sprint 13 — Certificación de confiabilidad y gobierno Enterprise

**Objetivo:** demostrar a escala los controles construidos desde Sprint 0; no agregarlos recién al final.

Entregables:

- pruebas de carga, límites, SLO/SLI y tableros por proveedor;
- restore drill, PITR, RPO/RTO e incidente simulado con tiempos reales;
- gobierno de Platform Admin, MFA/step-up, custodios y break-glass verificados;
- defensa adicional de tenant, auditoría append-only y rotación de claves;
- SSO/SCIM sólo si existe demanda contractual;
- typecheck progresivo, división de clientes monolíticos y budgets de rendimiento;
- WCAG 2.2 AA automatizada, pruebas visuales y revisión formal de seguridad independiente.

Criterio de salida:

- objetivos de disponibilidad y backlog se miden antes de publicar SLA;
- cero hallazgos críticos/altos abiertos en el release candidato;
- journeys críticos pasan por rol, tenant, móvil, accesibilidad y carga objetivo;
- limitaciones, capacidad máxima y procedimiento de incidentes son contractualmente claros.

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

Al recibir el material de la clienta, no se copia directamente al backlog. Se normaliza y se decide con evidencia:

| ID | Requisito exacto | Persona/problema | Evidencia actual | Gap | Decisión | Sprint | Test de aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CLI-001 | Pendiente de recepción | — | — | — | Analizar | — | — | Pendiente |

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
