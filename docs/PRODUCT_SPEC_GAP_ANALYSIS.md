# ObraSaaS - análisis de especificaciones y plan de profesionalización

## Alcance

Se contrastó el documento `Documento_Especificaciones_App_Obra.pdf` (versión 1.0, julio de 2026) contra el producto y el roadmap actuales. El PDF describe correctamente el núcleo operativo, pero todavía no define varios controles necesarios para operar de forma segura con múltiples obras, pagos y evidencia sensible.

## Lo que ya está cubierto

“Cubierto” describe la evidencia indicada, no equivale automáticamente a journey UI ni E2E externo. El corte de esta revisión es 29 de julio de 2026: se distingue código/pruebas locales, migración aislada en Preview, journey UI y proveedor externo real.

| Área del PDF | Estado actual | Evidencia del producto |
| --- | --- | --- |
| Asistencia con GPS, hora de servidor, estados pendientes y recuperación | Implementado | Ledger de asistencia, geocerca, frescura, idempotencia y cron de expiración |
| Tareas, dependencias y avance real | Motor verificado en Preview; puente visual/Gantt local | WBS canónica, grafo DAG, baseline inmutable/versionada, forecast determinista FS/SS/FF/SF, snapshots auditados e idempotencia. Una revisión visual aprobada/corregida puede originar una observación append-only y un forecast comparado por tarea sin mutar el plan. La migración y journey H5 todavía requieren Preview |
| Caja chica y aprobaciones | Parcial, base local no desplegada | `CashFund`/`CashMovement`, custodio validado por membresía, moneda, idempotencia, deduplicación acotada, comprobante privado y saldo derivado existen. Desde `100000` hay dos aprobaciones distintas con CAS; faltan política de umbral configurable por tenant, separación maker-checker respecto del creador, Preview y E2E |
| Materiales, proveedores, órdenes y recepción | Base local implementada en gran parte | Proveedores, órdenes, recepciones parciales, remitos privados y estado automático; faltan BOM/requisición, rechazo/daño y validación externa |
| Facturas y control de tres vías | Base local implementada en gran parte | Facturas, vencimientos, evidencia privada y match pedido-recepción-factura; faltan excepciones operativas, Preview y E2E |
| Dashboard operativo y financiero | Implementado | Dashboard de compras, cuentas a pagar y caja chica |
| WhatsApp como canal operativo | Implementado por contrato; E2E externo pendiente | Meta Cloud API directa como vía primaria; test number asignado, celular propio verificado, outbound histórico aceptado y test oficial firmado `messages v25.0` recibido con HTTP 200 en Preview. Esto no prueba entrega ni bidireccionalidad. La app sigue sin publicar y el negocio no verificado; faltan tenant conectado, inbound/estados reales y Flows publicados |
| Foto de avance y lectura visual | Infraestructura gobernada en Preview; puente H5 local; foto/E2E pendientes | Foto Meta autorizada → `ProgressEvidence` por tarea; `VisualProgressAssessment` con integridad, opt-in, revisión humana y `AI Dispatch Plan` de una sola ruta con reserva/liquidación diaria por tenant. La respuesta se guarda como recibo inmutable antes de proyección/costo y puede reanudarse sin redispatch. Tras la revisión, una decisión humana separada puede crear una observación append-only y un forecast determinista; nunca muta plan, certificación o pago. La credencial OpenAI dedicada, el presupuesto y el ledger/recibo ya pasaron Neon Preview, pero la migración H5 no. Sol es primario y Terra shadow explícito; Qwen3-VL/GLM-5V quedan fuera de datos reales hasta su gate contractual. Faltan conciliación autenticada, foto Meta real, benchmark consentido y DPA/retención |
| Identidad laboral y destino de cobro | H3.1 verificado en Preview; H4 local, emisión/Meta pendientes | El alta ya incluye Flow pre-operario, aviso fijado, acuse terminal, CRM y purga transitoria; sus migraciones pasaron Neon Preview. H4 agrega consentimiento específico append-only, re-atestación legacy, panel CRM enmascarado, Flow companion de un solo uso, Data Endpoint terminal y reconciliación DB-only `UNCERTAIN → SUCCEEDED` sólo con procedencia exacta ya persistida; no reintenta efectos. Sus cuatro migraciones `13000-13300` sólo pasaron PGlite local. Faltan orquestador de emisión, Neon y Vercel Preview para H4, publicación/Meta E2E, comprobante privado y verificación bancaria confiable; no hay evidencia de Production |
| Auditoría, correlación y observabilidad | Parcial | Helper central y `x-request-id`; falta persistir correlación en todas las mutaciones heredadas |

## Gaps críticos del documento

### 1. Acta de inicio y documentación laboral

El PDF pide acta de inicio firmada, DNI, obra social, ART y certificaciones. Ya existen el esquema/migración de expediente y acta, versiones, hashes, lifecycle, lecturas tenant-scoped y claves de storage server-owned. Faltan upload productivo, antivirus, retención/borrado, descargas auditadas y proveedor de firma.

**Sprint D1 - expediente y acta**

- Completar el expediente documental ya modelado con upload privado idempotente, antivirus, revisión y descargas auditadas.
- Integrar el acta ya modelada con un proveedor de firma/aceptación aprobado; no fabricar una firma propia.
- Alertar documentos próximos a vencer sin exponer datos sensibles al cliente.
- Definir retención y borrado lógico antes de aceptar documentos productivos.

### 2. Plan ideal vs. plan real y certificación de avance

La especificación conecta avance validado con pago quincenal. Las tareas y evidencias existen, pero debe cerrarse el agregado de certificación: corte, porcentaje aprobado, partidas, firmas y bloqueo de cambios posteriores.

**Sprint D2 - certificación contractual**

- Modelar períodos de certificación y líneas vinculadas a tareas/partidas.
- Separar sugerencia de IA, avance declarado, avance corregido y avance certificado.
- Requerir revisión del Director y aprobación económica separada para habilitar pago.
- Generar certificado inmutable con hash, versión, evidencia y correlación.
- Impedir certificar dos veces la misma partida y período.

### 3. Inventario y consumo de materiales

La base local de compras y recepción cubre OC, líneas y recepciones parciales; el roadmap la ubica en S11/S12. El PDF también requiere stock disponible y vinculación con tareas. Falta el ledger de inventario; no se debe calcular stock sumando documentos de forma ad hoc.

**Sprint D3 - inventario trazable**

- Crear movimientos de inventario inmutables: recepción, consumo, devolución, ajuste y merma.
- Mantener saldo por obra, depósito, material y unidad, con control de concurrencia.
- Vincular consumo a tarea y responsable; requerir motivo y evidencia para ajustes.
- Mostrar disponibilidad al asignar tareas y bloquear consumos imposibles.

### 4. Planos, versiones y cambios

El PDF exige PDF/DWG, versiones y alertas. No se debe mezclar documentación técnica con adjuntos generales: cada plano necesita versión, disciplina, estado vigente y comparación.

**Sprint D4 - documentación técnica**

- Registrar plano como agregado versionado con un único vigente por disciplina/alcance.
- Guardar evidencia privada, hash, autor, motivo del cambio y fecha efectiva.
- Emitir evento de cambio y notificación por obra, con lectura confirmada.
- Permitir consulta desde WhatsApp con enlace firmado y expiración.

### 5. Tareas no contempladas y vicios ocultos

Ya existe una base local explícita con `ExtraWorkRequest`, `ExtraWorkSession` y `ReplanScenario`, con decisión y auditoría. Baseline/forecast determinista ya existen en Preview aislado; todavía faltan UI/WhatsApp, tipificación contractual de vicio oculto, integración del impacto aprobado y change control antes de aplicar impacto al plan.

**Sprint D5 - extras e incidencias**

- Crear tareas extra con presupuesto/tiempo estimado, motivo y estado de revisión.
- Registrar vicio oculto separado de la tarea, con severidad, bloqueo, causa y resolución.
- Incorporar impacto aprobado al plan real sólo después de revisión.
- Mantener línea de tiempo y auditoría de cada cambio de alcance.

## Sprints de consolidación mundial/LatAm

1. **D0 - contrato de datos y producción segura (1 semana):** verificar migraciones en Neon, backups, ramas, límites, índices y política de rollback. Sólo lectura primero; staging antes de producción.
2. **D1 - expediente laboral y acta (2 semanas).**
3. **D2 - certificación de avance y pago (2-3 semanas).**
4. **D3 - inventario y consumo (2-3 semanas).**
5. **D4 - planos versionados y notificaciones (2 semanas).**
6. **D5 - extras, vicios e impacto en cronograma (2 semanas).**
7. **D6 - outbox de notificaciones (2 semanas):** WhatsApp, email y push con reintentos, deduplicación, preferencias, ventanas horarias y DLQ.
8. **D7 - IA gobernada (2 semanas):** operar el ledger de despacho/costo ya verificado en Preview, desplegar/verificar el puente H5, recorrer replay/conciliación autenticados, validar controles de datos/DPA/retención por proveedor, ejecutar benchmark visual OpenAI/Qwen3-VL/GLM-5V y evaluaciones separadas de GLM-OCR y GLM-5.2 para OCR/texto sobre gold sets consentidos, calibrar abstención/costo/latencia y conectar sólo decisiones humanas revisadas a observaciones/forecasts; nunca habilitar pagos, certificación o mutación de baseline automáticamente.
9. **D8 - hardening enterprise (2 semanas):** multiobra, exportación/portabilidad, auditoría completa con correlación, observabilidad, pruebas de carga, RPO/RTO y controles de privacidad.

## Criterios de aceptación transversales

- Todo cambio económico o contractual es idempotente, auditable, tenant-scoped y protegido por control de concurrencia.
- Toda evidencia es privada por defecto, con hash y entrega server-side autorizada o enlace firmado/expirable según el canal.
- Ninguna sugerencia de IA cambia estados contractuales sin decisión humana explícita.
- Todo evento de notificación tiene estado durable, reintentos acotados y trazabilidad.
- Toda migración se valida en staging, tiene rollback documentado y no se ejecuta sobre producción por inferencia.

## Decisión de arquitectura recomendada

WhatsApp debe permanecer como canal de captura, alertas y acciones breves. La web es la superficie de revisión, planificación, documentos, certificaciones y reportes. La base relacional y los ledgers son la fuente de verdad; Cloudinary/almacenamiento privado sólo guarda evidencia, nunca estados de negocio.

La vía primaria es Meta WhatsApp Cloud API directa porque valida webhooks firmados, estados, media, Flows, Data Endpoint e Embedded Signup. Twilio Sandbox queda como fallback opcional y requeriría un adaptador propio; no sustituye el piloto Meta. Meta ya asignó el número de prueba, verificó un destinatario propio, aceptó históricamente un outbound y entregó con éxito el test oficial firmado `messages v25.0` al Preview. Esto todavía no prueba entrega ni un canal operativo bidireccional. El bloqueo externo actual es publicar la app tras completar la verificación empresarial/revisión aplicable; luego deben importarse credenciales por tenant, recibir inbound/estados reales y publicar/probar los Flows. El token temporal no es credencial de release.
