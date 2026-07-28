# ObraSaaS - análisis de especificaciones y plan de profesionalización

## Alcance

Se contrastó el documento `Documento_Especificaciones_App_Obra.pdf` (versión 1.0, julio de 2026) contra el producto y el roadmap actuales. El PDF describe correctamente el núcleo operativo, pero todavía no define varios controles necesarios para operar de forma segura con múltiples obras, pagos y evidencia sensible.

## Lo que ya está cubierto

“Cubierto” describe el repositorio local; no equivale a despliegue, migración Preview ni E2E externo. El corte de esta revisión es 28 de julio de 2026: se distingue código/pruebas locales, migración aislada en Preview, journey UI y proveedor externo real.

| Área del PDF | Estado actual | Evidencia del producto |
| --- | --- | --- |
| Asistencia con GPS, hora de servidor, estados pendientes y recuperación | Implementado | Ledger de asistencia, geocerca, frescura, idempotencia y cron de expiración |
| Tareas, dependencias y avance real | Implementado y verificado en Preview aislado; journey UI pendiente | WBS canónica, grafo DAG, baseline inmutable/versionada, forecast determinista FS/SS/FF/SF, snapshots auditados e idempotencia. Una tarea sin calendario conserva planificación relativa y se rehidrata al definir el inicio de obra |
| Caja chica y aprobaciones | Parcial, base local no desplegada | `CashFund`/`CashMovement`, custodio validado por membresía, moneda, idempotencia, deduplicación acotada, comprobante privado y saldo derivado existen. Desde `100000` hay dos aprobaciones distintas con CAS; faltan política de umbral configurable por tenant, separación maker-checker respecto del creador, Preview y E2E |
| Materiales, proveedores, órdenes y recepción | Base local implementada en gran parte | Proveedores, órdenes, recepciones parciales, remitos privados y estado automático; faltan BOM/requisición, rechazo/daño y validación externa |
| Facturas y control de tres vías | Base local implementada en gran parte | Facturas, vencimientos, evidencia privada y match pedido-recepción-factura; faltan excepciones operativas, Preview y E2E |
| Dashboard operativo y financiero | Implementado | Dashboard de compras, cuentas a pagar y caja chica |
| WhatsApp como canal operativo | Implementado por contrato; E2E externo pendiente | Meta Cloud API directa como vía primaria; test number asignado, celular propio verificado y solicitud outbound de plantilla aceptada con token temporal. Esto no prueba entrega ni bidireccionalidad; faltan credenciales permanentes en Vercel, webhook firmado, inbound, estados, Flows y tenant real |
| Foto de avance y lectura visual | Contrato y migraciones verificados en Preview aislado; E2E externo pendiente | Foto Meta autorizada → `ProgressEvidence` por tarea; `VisualProgressAssessment` con integridad, opt-in, lease recuperable, rango/abstención y revisión humana. OpenAI es candidato primario, Qwen3-VL/GLM-5V challengers visuales y GLM-OCR/GLM-5.2 especialistas OCR/texto. La activación API espera una decisión explícita de credencial; faltan foto Meta real, benchmark consentido, DPA/retención y observabilidad. Nunca certifica, paga ni reprograma por sí sola |
| Identidad laboral y destino de cobro | H3.1 local; Preview/Meta pendientes | El alta ya incluye Flow pre-operario, aviso fijado, acuse terminal, CRM y purga transitoria; CUIL/CBU/CVU/alias conservan cifrado AAD/keyring, DTO enmascarado y APIs tenant-scoped. Falta migrar/desplegar H3.1 en Preview, revisión legal y Meta E2E; cobro todavía necesita Flow/UI, comprobante privado y verificación bancaria confiable |
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
8. **D7 - IA gobernada (2 semanas):** elegir y aislar la credencial de piloto, activar la vertical visual ya verificada por contrato, validar controles de datos/DPA/retención por proveedor, ejecutar benchmark visual OpenAI/Qwen3-VL/GLM-5V y evaluaciones separadas de GLM-OCR y GLM-5.2 para OCR/texto sobre gold sets consentidos, calibrar abstención/costo/latencia y conectar sólo resultados revisados a escenarios; nunca habilitar pagos, certificación o mutación de baseline automáticamente.
9. **D8 - hardening enterprise (2 semanas):** multiobra, exportación/portabilidad, auditoría completa con correlación, observabilidad, pruebas de carga, RPO/RTO y controles de privacidad.

## Criterios de aceptación transversales

- Todo cambio económico o contractual es idempotente, auditable, tenant-scoped y protegido por control de concurrencia.
- Toda evidencia es privada por defecto, con hash y entrega server-side autorizada o enlace firmado/expirable según el canal.
- Ninguna sugerencia de IA cambia estados contractuales sin decisión humana explícita.
- Todo evento de notificación tiene estado durable, reintentos acotados y trazabilidad.
- Toda migración se valida en staging, tiene rollback documentado y no se ejecuta sobre producción por inferencia.

## Decisión de arquitectura recomendada

WhatsApp debe permanecer como canal de captura, alertas y acciones breves. La web es la superficie de revisión, planificación, documentos, certificaciones y reportes. La base relacional y los ledgers son la fuente de verdad; Cloudinary/almacenamiento privado sólo guarda evidencia, nunca estados de negocio.

La vía primaria es Meta WhatsApp Cloud API directa porque valida webhooks firmados, estados, media, Flows, Data Endpoint e Embedded Signup. Twilio Sandbox queda como fallback opcional y requeriría un adaptador propio; no sustituye el piloto Meta. Meta ya asignó el número de prueba, verificó un destinatario propio y aceptó una solicitud outbound de plantilla con un token temporal; no se documentan sus valores. Esa aceptación no prueba entrega ni un canal operativo bidireccional. El token temporal no es credencial de release y debe revocarse o rotarse: antes del piloto faltan credenciales permanentes en Vercel, webhook firmado, inbound, estados, Flows, App Review y WABA/número del tenant real.
