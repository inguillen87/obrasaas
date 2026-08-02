# S15 - Outbox de notificaciones

`NotificationDelivery` es la entrega durable, tenant-scoped y deduplicada por destinatario y canal. No reemplaza al evento o caso operativo que origina la alerta.

## Contrato de inbox

- La clave única `(organizationId, recipientId, channel, eventKey)` permite reutilizar una clave de evento en tenants distintos sin colisiones.
- Una fila `IN_APP` queda disponible para el usuario en la misma transacción que la crea. Por eso nace en `SENT`, con `sentAt`; no depende del cron para aparecer.
- Leer una notificación sólo completa `readAt`. El estado de entrega permanece `SENT` y no se destruye evidencia de cómo llegó al inbox.
- La creación valida una membresía activa dentro de la organización. Para una notificación de obra también exige que la obra pertenezca al tenant y que el destinatario tenga acceso directo o de portfolio.
- El FK compuesto `(organizationId, projectId)` impide persistir una entrega vinculada a una obra de otro tenant.
- La migración `20260802120000_notification_outbox_p0` normaliza filas `IN_APP` legacy y conserva su lectura mediante `readAt`. El valor enum `READ` queda sólo para compatibilidad histórica y el código nuevo no lo escribe.

## Worker y leases

`/api/cron/notifications` está autenticado con `CRON_SECRET` y Vercel lo programa cada 15 minutos en Production. Su función actual es conciliar filas legacy y leases, no entregar filas `IN_APP` nuevas.

- Un lease `PROCESSING` vencido de `IN_APP` puede reconciliarse a `SENT`: la fila durable ya estaba disponible en el inbox y no existe una frontera externa.
- Un lease vencido de `EMAIL` o `WHATSAPP` termina en `DEAD_LETTER`. Es un resultado potencialmente ambiguo y no se reintenta automáticamente.
- Filas legacy `PENDING` o fallos confirmadamente reintentables conservan claim CAS, backoff y máximo de ocho intentos.

El cron sólo corre sobre deployments de Production. La frecuencia de 15 minutos requiere un plan de Vercel compatible con más de dos crons e intervalos subdiarios.

## Límites pendientes

- No existe todavía un dispatcher general certificado para email o WhatsApp, ni inbox de webhooks por proveedor.
- `quietHours` se persiste pero todavía no gobierna despachos externos.
- `NotificationDelivery` no modela owner, reconocimiento colectivo, resolución o escalamiento; esos estados deben vivir en el dominio de la alerta.
- Production requiere migración verificada, observabilidad del cron, dead-letter visible y un runbook de conciliación manual.
