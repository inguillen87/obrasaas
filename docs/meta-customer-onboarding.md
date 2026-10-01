# Alta Meta de clientes: implementación y límites de aceptación

Este bloque conserva la app, WABA, Test Number y transporte de demostración. No migra cuentas existentes ni reutiliza sus tokens para empresas cliente. Sólo habilita números nuevos dedicados; migración/coexistencia sigue requiriendo su circuito específico.

## Contrato durable

El recorrido usa la transacción canónica `workspace.integrationProject`, pertenencia y rol del servidor y el mismo perfil enterprise `whatsappWorkspace` ya adoptado. No incorpora otra base ni un motor de permisos. `Project.metadata.metaSignup` conserva el intento; `WhatsAppConnection` conserva la vinculación; `AuditLog` registra transiciones y `WebhookEvent` recibe el inbox privado.

`PREPARED → EXCHANGE_STARTED → CREDENTIAL_STORED → VERIFYING → REGISTRATION_REQUIRED / LINKED_PENDING_ACCEPTANCE`.

Antes del canje se guarda la reserva. El código se guarda únicamente como SHA-256. Después del canje se guarda inmediatamente el token cifrado, antes de verificar activos o suscribir la WABA. Un canje incierto queda `EXCHANGE_UNKNOWN`: consultar no vuelve a canjearlo, iniciar otro intento no lo pisa y cancelar no declara que desapareció del proveedor. Si el token no llegó a guardarse por rollback real del escrow, el mismo administrador puede confirmar una autorización nueva con motivo explícito. El intento anterior queda en `metaSignupHistory`, sin declarar revocación remota, y los códigos anteriores quedan bloqueados por digest. Un `EXCHANGE_STARTED` abandonado sólo permite reinicio después de vencer su lease de 60 segundos. Una credencial guardada se puede reconciliar sin obtener otro token. La verificación usa una lease de 60 segundos con identificador único y comprobación al confirmar.

El registro de un número requiere PIN de seis dígitos y consentimiento explícito. La reserva y el PIN cifrado se guardan antes del `register` remoto. Una respuesta perdida sólo habilita inspección de lectura; nunca otro `register` automático. Se respeta la ventana de 14 días posterior al signup. El PIN no es el OTP de SMS/llamada.

El cifrado adapta AES-256-GCM de `enterprise 1677ff7:src/lib/credentials.js`, con AAD adicional que vincula organización, obra, finalidad e identificador. Ni escrow ni token canónico salen en respuestas. Las claves no válidas fallan; no se deriva una clave débil de texto arbitrario. La API de Graph adapta inspección app/scopes/phone/WABA, appsecret proof y suscripción de `enterprise 1677ff7:src/lib/whatsapp/embedded-signup.js`, separando pasos para conservar resultados inciertos antes de cualquier siguiente efecto.

No se habilita `WhatsAppConnection.enabled`: la vinculación y la suscripción no prueban recepción, respuesta, permisos de participantes ni aceptación de campo.

## Recepción y catálogo

`/api/meta/customer-callback` verifica HMAC-SHA256 sobre bytes originales y exige el secret real de la misma app. Cada evento se vincula exclusivamente a una conexión cliente que pertenezca a una obra activa. La WABA y número demo se rechazan. El inbox persiste cifrado, separa mensajes y estados, usa claves estables y verifica conflictos de contenido. Las claves JSON se ordenan antes del digest del contenido; la firma sigue verificando los bytes originales. El ACK sale sólo después del commit. Un lote con activo no vinculado revierte por completo; un ACK perdido se recupera con deduplicación. Los locks se adquieren explícitamente `Project → WhatsAppConnection`; no se delega ese orden al plan de un JOIN. Los eventos se ordenan por clave para las inserciones concurrentes.

El callback cliente usa el override por WABA al suscribir una cuenta nueva. No cambia el callback general de la app ni la recepción demo. La bandeja privada del responsable permite clasificar eventos y registrar su seguimiento, únicamente con pertenencia canónica y rol `ADMIN` o `DIRECTOR`. El consumo conserva `applied:false`, `businessApplied:false`, `replySent:false` y `appliedAt=NULL`.

El procesamiento reserva una lease durable de 60 segundos en las columnas existentes de `WebhookEvent`; vuelve a comprobar permisos, tenant, conexión, AAD y digest antes de finalizar. Una lease vencida se recupera; un trabajador anterior queda rechazado por su token de lease. La clasificación se confirma una sola vez, con auditoría de referencias y códigos. La pérdida de respuesta se resuelve leyendo el estado. Una revisión humana requiere la revisión exacta de la fila y una clave de operación; repetirla recupera su auditoría. No se guardan cuerpos ni teléfonos en outcomes, auditoría o logs. El texto descifrado sólo sale por el endpoint privado autorizado.

Los estados de la bandeja son `PENDING → PROCESSED`, con resultado `REVIEW_REQUIRED` para mensajes y `OBSERVED` para estados/avisos. El responsable puede registrar `REVIEWED` como toma de conocimiento o derivación a participantes/obra. Eso no ejecuta un motor de negocio. Se extrajeron literalmente los contratos puros enterprise `classifyObraIntent`, `requestedAttendanceAction`, vocabulario de intenciones y parser de decisiones; no se copió ni invocó el motor de mutaciones o envíos.

El remitente se compara únicamente con el teléfono internacional exacto de la ficha de esta obra. Se comprueban participación, permiso correspondiente a la intención, pertenencia de cuenta y obra y KYC humano aprobado. La identidad del remitente es una observación del momento, nunca un grant ejecutable: no se bloquea la pertenencia de otro participante después de bloquear la obra, evitando invertir el orden de aceptación de invitaciones. El responsable sí conserva su autorización canónica comprobada en cada transacción. El esquema actual no contiene `WorkerPerson`/`WorkerChannelIdentity` con un vínculo de canal criptográficamente comprobable. Por eso incluso un participante vigente con KYC queda `CHANNEL_IDENTITY_UNVERIFIED` y su mensaje permanece en revisión. Un teléfono declarado, nombre, ubicación, texto «aprobar» o Flow enviado por el cliente no verifica el canal ni aprueba KYC, fichaje, cantidades o avance. No se crean propuestas de negocio o menús de envío mientras falte ese vínculo. La aplicación a los circuitos canónicos y una respuesta real siguen como gate de integración/aceptación de canal.

Las referencias a foto/video/audio recibidas siguen privadas y se muestran como archivo pendiente de procesamiento; no se descargan desde URLs del webhook ni se presentan como evidencia procesada. El circuito existente de evidencia de campo permite aportar archivos privados y verificables sin el teléfono nuevo.

El catálogo se obtiene con la credencial cliente y su WABA, con paginación completa y reconstrucción segura de cursores. No sigue URLs externas devueltas por Graph. Guardar `APPROVED` en un catálogo no acepta un circuito de campo.

Las plantillas operativas usan tres blueprints: invitación, pedido de información/evidencia y aviso de avance pendiente. La identidad incluye vínculo de conexión/WABA y digest del contenido, como el módulo enterprise de plantillas. La política `template-review-policy.js` fue reutilizada íntegramente: exige revisar nombre y SHA-256 exactos y confirmar. El recorrido durable `DRAFT → SUBMISSION_STARTED → SUBMITTED / SUBMISSION_UNKNOWN` guarda reserva antes de crear. Una respuesta perdida se recupera consultando el nombre remoto exacto, comprobando cuerpo, idioma e identidad y conservando la categoría que informa Meta. No reenvía `create` a ciegas. Ninguna prueba de esta sesión creó plantillas reales ni envió mensajes. La función de creación está habilitada únicamente para una WABA cliente aislada y tras una confirmación de su administrador.

## Configuración que debe acreditarse

- `NEXT_PUBLIC_META_APP_ID`: debe coincidir con la app actual.
- `META_CONFIG_ID` o `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID`: ID existente válido; ambos, si existen, deben coincidir.
- `META_APP_SECRET`: secret de la app actual. Su ausencia bloquea canje y firma; no se sustituye con token demo.
- `META_CUSTOMER_CREDENTIALS_KEY`: clave opcional propia de clientes, 32 bytes base64. Si no existe, se reutiliza `WHATSAPP_CREDENTIALS_ENCRYPTION_KEY` según contrato enterprise; ninguna clave existente se rota ni modifica.
- `META_GRAPH_API_VERSION`: versión explícita. No se inventa una versión a partir de defaults.
- `META_CUSTOMER_VERIFY_TOKEN`: secreto propio del callback de clientes; no modifica el verify token demo.
- `OBRASAAS_META_SIGNUP_RELEASE=customer-self-service-v1`: liberación operativa después de acreditar Advanced Access, configuración OAuth/dominios, callback HTTPS y campos requeridos. La variable por sí sola no constituye evidencia de revisión Meta.

La UI muestra preparación, disponibilidad de configuración, estado durable y aceptación por separado. Una respuesta perdida conserva el intento y ofrece comprobar estado antes de continuar. No conserva códigos ni credenciales en almacenamiento del navegador.

## Validación

- `node --test tests/production-meta-customer.test.mjs`: criptografía, gates, aliases, grants cruzados, ausencia de secretos en errores, catálogo y firmas/handshake.
- `node scripts/verify-meta-customer-postgres.mjs` con base local desechable explícita: transacciones reales, canje concurrente único, aislamiento, cancelación, recuperación, registro incierto, inbox cifrado, replay/conflict, rollback, pérdida de ACK, lease vencida y revocación. También callback firmado sintético, locks concurrentes P→C, clasificación privada, identidad no comprobada/revocada, KYC pendiente, review/idempotencia/revisión, lease recuperada con rechazo del trabajador vencido y contenido alterado oculto/rechazado. No hace llamadas reales a Meta.
- `node scripts/verify-meta-customer-ui.mjs`: componente real en Next/navegador con servicios y SDK interceptados, cuatro tamaños de pantalla, configuración pendiente, gating dedicado, resultado incierto, aislamiento de empresas, origen malicioso, revisión/recuperación de plantillas y recepción privada con clasificación incierta recuperada por GET y revisión explícita sin acción de negocio. Esta prueba no conecta una empresa real a Meta.
- Lint afectado limpio. El CI integral pertenece al bloque de integración raíz.

Implementado y probado localmente no significa publicado ni aceptado. La app/configuración Meta real, el número nuevo, registro/OTP real, catálogo real por nueva WABA, entrega/recepción real, identidad verificada del canal y consumo hacia el recorrido de campo permanecen gates separados. La clasificación y observación de inbox está implementada y se prueba con eventos firmados sintéticos; no acredita dichos gates. Los valores `[SENSITIVE]` de una exportación de Vercel son ocultaciones; su longitud no prueba el formato del secreto de runtime. La disponibilidad debe comprobarse a través del endpoint protegido desplegado y de la configuración efectiva del proveedor.

## Fuentes primarias consultadas

Las páginas directas de Meta devolvieron HTTP 429 en esta sesión; se contrastaron las colecciones oficiales de Meta:

- [Embedded Signup de Meta](https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup).
- [Cloud API: suscripción y activos](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api?entity=request-13382743-fefbaeb4-03b3-4628-946e-8619cd5a90aa).
- [Cloud API: registro y ventana de 14 días](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api?entity=request-13382743-54a0db90-5df9-41b8-aa91-b834711a56d5).
- [Plantillas por WABA](https://www.postman.com/meta/whatsapp-business-platform/request/qtgr0i7/get-all-templates-default-fields).
- [SDK oficial WhatsApp: verificación de firma](https://github.com/WhatsApp/WhatsApp-Nodejs-SDK/blob/main/website/docs/api-reference/webhooks/start.md).

La lectura de documentación no verifica permisos efectivos ni modifica una configuración remota.
