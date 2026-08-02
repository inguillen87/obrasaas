# Benchmark competitivo de procurement y planificación

Fecha de revisión: 2 de agosto de 2026.

Este documento usa únicamente documentación oficial de producto. “No evidenciado” significa que la capacidad no apareció en los recorridos oficiales revisados; no prueba que sea inexistente en todos los planes, regiones o configuraciones.

## Lectura ejecutiva

ObraSaaS ya cubre en Preview el primer eslabón pedido por la socia: fecha o ventana prometida por proveedor, vínculo con tareas, vista por quincena, exportación `.ics` y un outbox externo que permanece deshabilitado hasta configurar Resend.

La brecha competitiva prioritaria ya no es mostrar esa fecha. Es cerrar, sin fuentes paralelas, la cadena:

```text
OC → compromiso → envío → recepción física por partida
   → disponibilidad verificada → tarea ejecutable → factura
```

Estado del P0 al 2 de agosto de 2026: OC, compromisos y recepciones ya usan cantidades decimales exactas; el total de OC se calcula en enteros escalados y los saldos recibidos se derivan en servidor desde el historial `POSTED` completo de las órdenes visibles. El P0 **no está cerrado**: falta asignación explícita e inmutable entre recepción y compromiso, excepciones de calidad y un ledger de disponibilidad/reserva.

## Comparación

| Plataforma | Capacidad oficial relevante | Aprendizaje para ObraSaaS |
| --- | --- | --- |
| Procore | Los submittals calculan hitos desde la fecha requerida en obra y lead times de fabricación, envío y revisión. Scheduling soporta FS/SS/FF/SF, lag, ruta crítica y lookaheads. Materials concilia PO, shipment y receipt por línea/UOM, incluidos faltantes, sobrantes, daños y rechazo. | Es la referencia funcional para el motor de procurement impulsado por cronograma y la recepción cuantitativa. ObraSaaS no debe declarar material disponible desde una atestación administrativa. |
| Autodesk Build | Submittals registra fechas requeridas, lead time y revisión multi-etapa. Schedule importa planificadores externos, muestra Gantt/ruta crítica y compara versiones. Assets aporta estados e identificación QR/NFC. | Reforzar workflows versionados de revisión y el vínculo entre plan, objetos y responsables. No se evidenció en lo revisado una conciliación PO-línea-recepción equivalente a Procore Materials. |
| Fieldwire | Submittals combina lead time, on-site date, audit trail y colaboración con destinatarios externos. Calendar ofrece vistas operativas y feed hacia Google Calendar. Formularios móviles soportan cantidades, fotos, firma y aprobación. | La colaboración de proveedor debe funcionar sin crear una cuenta compleja. El feed revocable y los formularios móviles son superiores a un snapshot estático, pero no sustituyen una conciliación de cantidades. |
| Buildertrend | Purchase Orders incorpora aprobación/firma del proveedor y enmiendas versionadas. Schedule ofrece dependencias, lead/lag, baseline, ruta crítica y publicación. Subcontratistas pueden confirmar disponibilidad; Bills usa OCR vinculado a PO. | Copiar la simplicidad de confirmación/reprogramación y la separación borrador/publicado. La recepción financiera por OCR no debe confundirse con aceptación física del material. |

## Prioridad de producto

### P0 — Recepción cuantitativa por línea de OC

- cantidades decimales exactas por unidad de medida — implementado y verificado en Preview para OC, compromiso y recepción;
- entregas parciales y asignación explícita a compromisos, nunca FIFO implícito;
- faltante, sobrante, dañado, rechazado y aceptado;
- foto/remito privado, lugar, receptor y revisión;
- finalización inmutable con corrección/reversión append-only;
- `AVAILABLE` sólo cuando todas las partidas requeridas están conciliadas.

### P1 — Procurement gobernado por el cronograma

- fecha requerida en obra;
- lead times separados: aprobación, fabricación, transporte y recepción;
- cálculo hacia atrás de “ordenar antes de”;
- holgura y semáforo de riesgo recalculados al mover el Gantt;
- impacto sobre tarea derivado, sin mutar silenciosamente su estado.

### P1 — Confirmación externa sin cuenta

- enlace firmado por email y, después de certificar Meta, WhatsApp;
- confirmar, rechazar o proponer nueva fecha;
- comentario y evidencia opcional;
- idempotencia, expiración, replay y timeline auditado;
- una propuesta externa nunca modifica el plan sin aprobación interna.

### P1 — Calendario publicable y revocable

- reemplazar el snapshot `.ics` de 90 días por feed revocable/rotativo;
- filtros por obra, proveedor, responsable y quincena;
- timezone civil explícito;
- estados borrador/publicado y alcance por destinatario;
- mantener export estático como fallback interoperable.

### P1 — “Se puede / no se puede ejecutar”

- cruzar materiales aceptados, dependencias, cuadrilla, equipos y permisos;
- explicar cada bloqueo con su fuente y frescura;
- alertar a Compras/Jefe de Obra/Director con owner, acuse, resolución y escalamiento;
- no sumar porcentajes entre unidades incompatibles;
- no certificar avance ni habilitar pago automáticamente.

## Gates de calidad

1. Una sola autoridad para OC, compromiso, recepción y tarea.
2. Aislamiento por tenant/obra también en FKs y guards PostgreSQL.
3. Cantidades exactas `Decimal(14,3)` sin aritmética `Number`.
4. Replay idéntico y conflicto ante payload mutado.
5. Prueba concurrente en PostgreSQL real y migración rollback-only verificada.
6. E2E por roles y proveedor externo antes de Production.
7. Corrección, anulación y reapertura auditables antes de afirmar disponibilidad real.

## Fuentes oficiales

- Procore: [crear submittal y Schedule Information](https://support.procore.com/products/online/user-guide/project-level/submittals/tutorials/create-a-submittal), [dependencias de Scheduling](https://support.procore.com/products/online/user-guide/project-level/scheduling/tutorials/manage-activity-dependencies), [Materials](https://support.procore.com/products/online/materials-user-guide-with-project-financials), [finalizar recepciones](https://support.procore.com/products/online/materials-user-guide-with-project-financials/review-and-finalize-receipts).
- Autodesk Build: [crear submittals](https://help.autodesk.com/cloudhelp/ENG/Build-Submittals/files/work-submittals/Create_Submittal.html), [Schedule](https://help.autodesk.com/cloudhelp/ENU/Build-Schedule/files/About_Schedule.html), [notificaciones de Submittals](https://help.autodesk.com/cloudhelp/ENU/Build-Submittals/files/admin-submittals/Submittals_Notifications.html), [Assets](https://help.autodesk.com/cloudhelp/ENU/Build-Assets/files/getting-started/About_Assets.html).
- Fieldwire: [workflow de Submittals](https://help.fieldwire.com/hc/en-us/articles/7160473659419-Introduction-to-the-Submittals-Workflow-in-Fieldwire), [vista Calendar](https://help.fieldwire.com/hc/en-us/articles/115000864183-How-do-I-use-the-Calendar-view), [Google Calendar](https://help.fieldwire.com/hc/en-us/articles/29679815833105-Integrations-Tab-Google-Calendar), [Custom Forms](https://help.fieldwire.com/hc/en-us/articles/360021924912-Introduction-to-Custom-Forms-and-Templates).
- Buildertrend: [Purchase Orders](https://buildertrend.com/help-article/purchase-orders-overview/), [Schedule](https://buildertrend.com/help-article/schedule-overview/), [Advanced Scheduling](https://buildertrend.com/help-article/advanced-schedule-overview/), [calendar feeds](https://buildertrend.com/help-article/project-management-settings/), [Purchase Orders y Bills](https://buildertrend.com/help-article/purchase-orders-bills-overview/).
