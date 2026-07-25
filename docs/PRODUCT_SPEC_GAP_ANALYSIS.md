# ObraSaaS - análisis de especificaciones y plan de profesionalización

## Alcance

Se contrastó el documento `Documento_Especificaciones_App_Obra.pdf` (versión 1.0, julio de 2026) contra el producto y el roadmap actuales. El PDF describe correctamente el núcleo operativo, pero todavía no define varios controles necesarios para operar de forma segura con múltiples obras, pagos y evidencia sensible.

## Lo que ya está cubierto

| Área del PDF | Estado actual | Evidencia del producto |
| --- | --- | --- |
| Asistencia con GPS, hora de servidor, estados pendientes y recuperación | Implementado | Ledger de asistencia, geocerca, frescura, idempotencia y cron de expiración |
| Tareas, dependencias y avance real | Implementado en gran parte | Tareas operativas, grafo DAG, evidencias y revisión |
| Caja chica y aprobaciones | Implementado | Fondos, movimientos, duplicados semánticos, doble aprobación de alto valor y exportación |
| Materiales, proveedores, órdenes y recepción | Implementado en gran parte | S9: proveedores, órdenes, recepciones parciales, remitos privados y estado automático |
| Facturas y control de tres vías | Implementado en gran parte | S10: facturas, vencimientos, evidencia privada, match pedido-recepción-factura |
| Dashboard operativo y financiero | Implementado | Dashboard de compras, cuentas a pagar y caja chica |
| WhatsApp como canal operativo | Implementado por contrato; E2E externo pendiente | Meta Cloud API directa como vía primaria; test number asignado, celular propio verificado y solicitud outbound de plantilla aceptada con token temporal. Esto no prueba entrega ni bidireccionalidad; faltan credenciales permanentes en Vercel, webhook firmado, inbound, estados, Flows y tenant real |
| Identidad laboral y destino de cobro | Fundación local no desplegada | CUIL/CBU/CVU/alias validados, consentimiento versionado, cifrado AAD/keyring, fingerprint HMAC y DTO enmascarado; esquema Prisma y migraciones locales presentes, todavía no desplegados ni verificados en Neon; faltan API, Flow/UI y revisión |
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

S9 cubre compra y recepción, pero el PDF también requiere stock disponible y vinculación con tareas. Falta el ledger de inventario; no se debe calcular stock sumando documentos de forma ad hoc.

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

La especificación requiere inicio/fin con evidencia y su impacto en el plan. Falta un flujo explícito que no contamine silenciosamente el Gantt base.

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
8. **D7 - IA gobernada (2 semanas):** análisis asíncrono, consentimiento, retención, confianza, revisión humana obligatoria y métricas de precisión; nunca habilitar pagos automáticamente.
9. **D8 - hardening enterprise (2 semanas):** multiobra, exportación/portabilidad, auditoría completa con correlación, observabilidad, pruebas de carga, RPO/RTO y controles de privacidad.

## Criterios de aceptación transversales

- Todo cambio económico o contractual es idempotente, auditable, tenant-scoped y protegido por control de concurrencia.
- Toda evidencia es privada por defecto, con hash, enlaces firmados y expiración.
- Ninguna sugerencia de IA cambia estados contractuales sin decisión humana explícita.
- Todo evento de notificación tiene estado durable, reintentos acotados y trazabilidad.
- Toda migración se valida en staging, tiene rollback documentado y no se ejecuta sobre producción por inferencia.

## Decisión de arquitectura recomendada

WhatsApp debe permanecer como canal de captura, alertas y acciones breves. La web es la superficie de revisión, planificación, documentos, certificaciones y reportes. La base relacional y los ledgers son la fuente de verdad; Cloudinary/almacenamiento privado sólo guarda evidencia, nunca estados de negocio.

La vía primaria es Meta WhatsApp Cloud API directa porque valida webhooks firmados, estados, media, Flows, Data Endpoint e Embedded Signup. Twilio Sandbox queda como fallback opcional y requeriría un adaptador propio; no sustituye el piloto Meta. Meta ya asignó el número de prueba, verificó un destinatario propio y aceptó una solicitud outbound de plantilla con un token temporal; no se documentan sus valores. Esa aceptación no prueba entrega ni un canal operativo bidireccional. El token temporal no es credencial de release y debe revocarse o rotarse: antes del piloto faltan credenciales permanentes en Vercel, webhook firmado, inbound, estados, Flows, App Review y WABA/número del tenant real.
