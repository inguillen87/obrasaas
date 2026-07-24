# S15 - Outbox de notificaciones

`NotificationDelivery` es la cola durable, tenant-scoped y deduplicada para notificaciones in-app, email y WhatsApp.

- La clave única `(recipientId, channel, eventKey)` evita duplicados en reintentos.
- Los estados `PENDING`, `PROCESSING`, `SENT`, `FAILED`, `DEAD_LETTER` y `READ` permiten operación observable.
- El claim incrementa intentos con una condición CAS; los fallos aplican backoff y terminan en dead-letter después de ocho intentos.
- Blockers `HIGH` y `CRITICAL` generan entregas `IN_APP` para miembros activos de la obra dentro de la misma transacción.
- El outbox no afirma entrega al proveedor: todavía requiere worker, preferencias de canal, proveedor de email/WhatsApp, lectura y escalamiento.

El verificador CI comprueba que la migración exista y conserve la tabla e índices de deduplicación. La primera entrega productiva debe agregar un worker con lease, métricas, dead-letter visible y runbook de replay.
