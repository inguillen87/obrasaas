# Constancia privada de recepción del destino de cobro (H4)

**Estado:** implementación y pruebas locales completas; las 108 migraciones y el verificador semántico pasan juntos en PGlite descartable. Sin certificación todavía en PostgreSQL real/Neon Preview, Vercel Preview ni Meta E2E.

## Alcance del producto

La constancia confirma únicamente que ObraSaaS recibió un destino de cobro para revisión. No es un recibo de pago y no acredita titularidad, validación bancaria, activación del destino, transferencia ni pago.

El operario puede solicitarla mediante el opt-in opcional `receipt_delivery_requested` del Flow. Sólo el valor booleano `true` se normaliza como `receiptDeliveryRequested: true`, queda ligado al HMAC de la reserva y se fija en la companion. `false` o ausencia conservan la forma canónica histórica y no crean una constancia.

## Contrato de privacidad y entrega

1. La constancia sólo puede emitirse después de un resultado terminal `SUCCEEDED`, con coincidencia exacta de tenant, obra, sesión, operario, persona, canal, destino y webhook.
2. La persistencia conserva una referencia opaca, propósito, tipo, últimos cuatro caracteres cuando corresponde, timestamps, hash de integridad, hash del token y contadores de acceso. No conserva el CBU, CVU o alias completo dentro de la constancia.
3. El resultado durable del webhook conserva únicamente `{ version, receiptId }`. No persiste bearer, enlace ni texto con URL.
4. El acceso privado vence exactamente a los 15 minutos y admite como máximo cinco lecturas. Revocación, expiración o agotamiento cierran el acceso.
5. El token en claro no se guarda. Un candidato se descarta después de conservar su hash y se reconstruye de forma determinista únicamente después de ganar el claim durable de entrega automática.
6. El enlace coloca el bearer sólo en el fragmento `#token=...`; no lo incluye en query params. La webview elimina el fragmento antes del primer request, lo mantiene sólo en memoria y no usa `sessionStorage`.
7. Si al preparar el envío quedan menos de dos minutos de vigencia, o el acceso está vencido, revocado o agotado, se usa un fallback sin URL ni token.
8. La webview y el PDF reciben únicamente un DTO allowlisted y enmascarado. Para CBU/CVU pueden mostrar sólo los últimos cuatro caracteres; para alias no muestran ningún fragmento.
9. El PDF se genera dinámicamente después de autorizar cada solicitud. No se sube a Blob, Cloudinary ni otro storage y sus bytes no se persisten como artefacto.
10. Meta/WhatsApp necesariamente procesa el texto del mensaje que contiene el enlace y el dispositivo destinatario lo recibe. Un reenvío, copia o captura puede transferir el bearer mientras siga vigente; los 15 minutos, cinco accesos y revocación reducen ese riesgo, pero no lo eliminan. El piloto debe explicarlo y nunca pedir que el enlace se comparta.

El dato financiero completo continúa únicamente dentro del dominio financiero cifrado. Nunca se proyecta a la constancia, al descriptor durable, al enlace, a la webview, al PDF ni a la metadata de auditoría de entrega.

## Rotación de `WEBVIEW_TOKEN_SECRET`

La implementación actual usa una sola clave y la constancia no persiste una versión de clave. Una rotación entre la emisión y la materialización hace que la reconstrucción del bearer falle de forma cerrada y derive en el fallback sin URL; no expone el dato, pero puede impedir entregar una constancia todavía vigente.

Para Preview/piloto, la rotación debe detener nuevas emisiones, drenar workers y esperar al menos 15 minutos desde la última emisión antes de reemplazar la clave; luego se verifica explícitamente el fallback de enlaces anteriores y una emisión nueva. Para Production se requiere un keyring versionado con solapamiento y gate de retiro antes de permitir rotaciones sin ventana de drenaje. Hasta implementar ese keyring, una rotación inmediata es una intervención operativa con pérdida segura de accesos pendientes, no una operación transparente.

## Estado local y gates pendientes

El contrato local incluye el opt-in, su binding HMAC, la companion, el registro mínimo, emisión idempotente, descriptor no secreto, materialización post-claim, fallback stale, webview enmascarada y PDF dinámico. La migración `20260729134000_worker_payment_private_receipts` ya atraviesa desde cero las 108 migraciones y el verificador semántico en PGlite descartable. Todavía no tiene smoke comprobado en PostgreSQL real/Neon Preview, deployment H4 en Vercel Preview ni recorrido con Flow y mensajería Meta reales.

Siguen pendientes:

- publicar/probar el Flow y recorrer opt-in → recepción terminal → entrega → apertura → PDF con el tenant y teléfono piloto;
- verificar expiración, revocación, límite de accesos, replay, aislamiento cross-tenant y ausencia de secretos en logs del ambiente real;
- definir el reenvío o regeneración fuera de la ventana de atención de Meta y aprobar una plantilla `UTILITY` cuando sea obligatoria; hoy no existe ese journey operativo;
- observar fallbacks y métricas, y completar runbook de soporte;
- integrar un proveedor confiable de titularidad si se quiere afirmar validación bancaria; el comprobante no la reemplaza.

## Retención y PRO-05

Los 15 minutos son una vigencia de acceso, no una política de eliminación. El registro mínimo permanece para integridad y auditoría, y la generación dinámica evita almacenar el archivo PDF, pero todavía faltan matriz de retención, DSAR integral, cobertura de backups/restores y borrado verificable de datos laborales, mensajes, media y derivados. Por eso esta entrega no cierra PRO-05 ni habilita datos reales del piloto.

## Evidencia de implementación

- [Contrato de constancia privada](../src/lib/worker-payment-private-receipts.js)
- [Materialización segura para WhatsApp](../src/lib/whatsapp/worker-payment-receipt-delivery.js)
- [PDF dinámico y allowlisted](../src/lib/worker-payment-receipt-pdf.js)
- [Webview de constancia](../src/app/webview/worker-payment-receipt/page.js)
- [Migración local H4 de constancias](../prisma/migrations/20260729134000_worker_payment_private_receipts/migration.sql)
- [Readiness E2E del piloto](./PILOT_WHATSAPP_E2E_READINESS.md)
