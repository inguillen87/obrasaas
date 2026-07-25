# WhatsApp Cloud API, Embedded Signup y Flows

## Alcance y aislamiento

ObraSaaS usa una app de Meta dedicada. La aplicación no comparte credenciales, WABA, números, claves de cifrado ni sesiones de Flow con otras plataformas.

La integración primaria es **Meta WhatsApp Cloud API directa**. Twilio Sandbox queda únicamente como fallback de contingencia para pruebas acotadas: el endpoint legado está retirado y reactivarlo requeriría un adaptador aislado; además, no validaría WhatsApp Flows, Data Endpoints ni Embedded Signup y por eso no reemplaza el piloto Meta.

- `NEXT_PUBLIC_META_APP_ID` identifica la app de Meta usada por ObraSaaS.
- `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID` identifica su configuración de Embedded Signup.
- Cada tenant conecta su propio WABA, número y token mediante Embedded Signup.
- Las credenciales de Cloud API se cifran con la clave dedicada `WHATSAPP_CREDENTIALS_ENCRYPTION_KEY` y siempre se resuelven dentro de la organización autorizada.
- El webhook general está implementado en `/api/webhooks/whatsapp`.
- Cada conexión recibe un Data Endpoint opaco independiente en `/api/webhooks/whatsapp/flows/{opaqueEndpointId}`.

En la cuenta de Meta revisada para ObraSaaS ya están presentes la app dedicada y el caso de uso de WhatsApp. Meta también asignó un número de prueba, se verificó un celular propio como destinatario, se generó un token temporal y Meta aceptó una solicitud outbound de plantilla. Esta documentación omite deliberadamente App IDs, WABA IDs, Phone Number IDs, teléfonos y el valor del token.

La evidencia anterior prueba únicamente que Meta aceptó ese envío outbound en su entorno de prueba; no prueba entrega, inbound, eventos de estado, webhook firmado, Flows, aislamiento sobre un tenant real ni un circuito bidireccional end-to-end. Todavía faltan credenciales permanentes gestionadas como secretos en Vercel y una conexión tenant-scoped de liberación. El token temporal no es una credencial de release: debe revocarse o rotarse y sustituirse antes de Preview o Production, sin copiarlo al repositorio, logs ni documentación.

## Activación y salud verificables

La existencia de una fila `WhatsAppConnection` no equivale a un canal operativo. Integraciones presenta una progresión auditable de cinco etapas:

1. `Plataforma`: App ID, App Secret, configuración de Embedded Signup, token de webhook y cifrado de credenciales presentes;
2. `Cuenta`: token vigente, los permisos `whatsapp_business_management` y `whatsapp_business_messaging`, teléfono registrado y estado del proveedor verificados;
3. `Webhook`: la app ObraSaaS aparece realmente en `/{WABA}/subscribed_apps`;
4. `Envío y recepción`: existe al menos un mensaje entrante firmado persistido y una salida correlacionada con un `providerMessageId` aceptado por Meta;
5. `Flows`: endpoint cifrado sano y al menos un Flow publicado.

Los estados públicos son `UNCONFIGURED`, `READY_TO_CONNECT`, `ACCOUNT_LINKED`, `WEBHOOK_PENDING`, `OPERATIONAL` y `DEGRADED`. `OPERATIONAL` exige evidencia real en ambos sentidos; nunca se deriva sólo de datos guardados durante Embedded Signup. Un Flow pendiente no invalida un canal de mensajes ya operativo, pero un endpoint de Flow explícitamente degradado sí se presenta como una incidencia separada.

- `GET /api/integrations/whatsapp/health` devuelve únicamente la proyección sanitizada y diagnósticos tenant-scoped, sin tokens, secretos ni IDs del proveedor.
- `POST /api/integrations/whatsapp/health` revalida token, permisos, pertenencia del teléfono y suscripción directamente contra Graph API, persiste un snapshot sanitario seguro y audita el resultado.
- Embedded Signup rechaza tokens que no tengan ambos permisos operativos, confirma la suscripción con una lectura posterior y vuelve a consultar el teléfono después de registrarlo.
- Los errores de token, suscripción, calidad, plantillas o endpoint producen acciones concretas y nunca se maquillan como `Conectado`.

## Contrato de WhatsApp Flows

Los blueprints actuales usan:

- Flow JSON `7.3` para la definición de pantallas;
- Data API `4.0` para el intercambio dinámico con el Data Endpoint;
- `data_exchange` solo cuando el Flow almacenado fue provisionado con canal de datos;
- `navigate` para Flows estáticos anteriores, sin convertirlos implícitamente.

El backend implementa `INIT`, `BACK`, `data_exchange`, `ping` y el acuse de errores de salud. Los datos de organización, proyecto, trabajador, Flow y pantalla no se aceptan como autoridad desde el cliente: se vuelven a resolver desde la conexión y la sesión persistida. El Data Endpoint entrega contexto y opciones; la mutación de negocio definitiva sigue entrando por el evento terminal `nfm_reply` del webhook general.

Las áreas de trabajo se obtienen de la [proyección transaccional de tareas](OPERATIONAL_TASKS.md). El ID del selector es opaco y `task_ref` se agrega únicamente después de resolver esa opción dentro del proyecto autenticado; el formulario no puede aportar ni reemplazar esa referencia.

La referencia de protocolo es la [guía oficial para implementar el Flow Endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/implementingyourflowendpoint/) y el historial de versiones está en el [changelog oficial de WhatsApp Flows](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/changelog/). Meta también publica ejemplos interoperables en [WhatsApp Flows Tools](https://github.com/WhatsApp/WhatsApp-Flows-Tools).

## Data Endpoint por conexión

El UUID expuesto en la URL sirve únicamente para localizar la conexión; no es una credencial ni reemplaza las validaciones criptográficas. El orden de validación del `POST` es:

1. leer el cuerpo HTTP original, con un máximo de 64 KiB;
2. validar `x-hub-signature-256` con `META_APP_SECRET` sobre esos bytes, antes de consultar la base o intentar descifrar;
3. resolver el endpoint opaco y su conexión activa;
4. reservar idempotentemente el hash exacto de la solicitud;
5. descifrar el sobre de Meta y autenticar la sesión del Flow;
6. generar y cifrar la respuesta con la misma sesión criptográfica.

Una firma Meta inválida responde `432`. La incompatibilidad de la clave RSA responde `421`. Una sesión de Flow expirada o inválida responde `427` dentro del canal cifrado cuando el sobre pudo descifrarse. Las respuestas exitosas son texto Base64 sin JSON exterior, tal como requiere Meta.

La implementación limita atómicamente cada conexión a 600 solicitudes nuevas por minuto y usa un lease de 12 segundos para evitar procesadores concurrentes. Un fallo sin respuesta cifrada funciona como caché negativa durante 24 horas y luego puede recuperarse. Cuando ya existe una respuesta cifrada, el hash y su ciphertext pasan a ser un tombstone criptográfico: se reproducen byte a byte y no se eliminan sólo por `expiresAt` mientras la versión RSA correspondiente siga `ACTIVE` o `RETIRING`. Esto evita reutilizar el nonce AES-GCM obligatorio del protocolo con otro plaintext. La función tiene un máximo operativo de 10 segundos. No llama a OpenAI, Cloudinary ni otros servicios ajenos al contrato del Flow durante ese camino síncrono.

El GC usa `garbageCollectWhatsAppFlowEndpointRequests` en lotes acotados y por endpoint. Puede eliminar cachés negativas y leases vencidos después de 24 horas. Un registro que ya contiene ciphertext sólo es elegible cuando su versión RSA está `REVOKED`, o `RETIRING` ya vencida, y pasó además una gracia de 10 minutos para drenar handlers que hubieran cargado el keyring antes del retiro. Las versiones `ACTIVE`, `STAGED`, `RETIRING` vigentes, las versiones desconocidas y los tombstones sin `keyVersion` se conservan. El cron de recuperación lo invoca cada minuto en modo best-effort, con un máximo de 2 endpoints y 250 filas por endpoint; `hasMore=true` deja el remanente para la ejecución siguiente sin agregar latencia al Data Endpoint.

## Cifrado y rotación de claves

Cada `WhatsAppConnection` tiene su propio par RSA de 2048 bits. Meta cifra la clave de sesión con RSA-OAEP/SHA-256 y el payload con AES-128-GCM; la respuesta reutiliza esa clave de sesión y usa el IV invertido según el protocolo oficial.

La clave privada RSA nunca se persiste en claro. Se envuelve con AES-256-GCM usando un KEK independiente de las credenciales de Cloud API:

```dotenv
WHATSAPP_FLOW_ENDPOINT_KEK_ID=flow-kek-v1
WHATSAPP_FLOW_ENDPOINT_KEK_REGISTRY_JSON={"flow-kek-v1":"BASE64_DE_32_BYTES_ALEATORIOS"}
```

Reglas operativas:

- el ID activo debe existir en el registro y apuntar a exactamente 32 bytes aleatorios codificados en Base64;
- nunca se deben copiar valores reales a este documento, logs, tickets o respuestas de API;
- durante una rotación puede existir una clave `ACTIVE` y, como máximo, una `RETIRING` aún vigente por conexión;
- mientras esa clave `RETIRING` siga vigente no se crea ni se sube una nueva rotación; al vencer, se revoca dentro del mismo lock transaccional antes de generar la siguiente `STAGED`;
- el keyring del Data Endpoint puede incluir temporalmente la única `STAGED`, incluso sin `uploadedAt`, para recuperar el crash posterior al registro en Meta; la readiness y la promoción del Flow siguen exigiendo una clave `ACTIVE` verificada;
- las entradas KEK antiguas se conservan hasta que todas las claves privadas que dependen de ellas hayan sido reenvueltas;
- `WHATSAPP_FLOW_TOKEN_SECRET` es otro secreto independiente, usado para vincular la sesión persistida al tenant, Flow, proyecto y destinatario correctos.

## Provisionamiento reversible

Desde Integraciones, el provisionamiento de un Flow dinámico:

1. crea o recupera el endpoint y la clave RSA dedicados de la conexión;
2. registra la clave pública en el número de WhatsApp Business;
3. vuelve a leerla desde Meta y exige `signature_status=VALID` antes de activarla;
4. configura el borrador con `endpoint_uri` y `application_id`;
5. sube el Flow JSON `7.3` con Data API `4.0`;
6. vuelve a consultar el borrador y verifica que el canal de datos corresponda al endpoint esperado.

Los Flows pertenecen al WABA en Meta, no al número individual. Por eso ObraSaaS crea un nombre técnico opaco y estable derivado del endpoint de cada conexión, persiste el Flow ID propietario y lo reconcilia por ese ID antes de cualquier búsqueda por nombre. Dos teléfonos o tenants dentro del mismo WABA obtienen Flows diferentes y no pueden reconfigurar el `endpoint_uri` del otro.

El proceso opera sobre borradores y se puede repetir o corregir sin publicar. No publica automáticamente, no reemplaza un Flow ya `PUBLISHED` y no convierte de forma silenciosa un Flow estático. Esto es deliberado: Meta vuelve inmutable un Flow publicado, por lo que la aprobación y publicación final deben hacerse explícitamente desde Meta. Las operaciones oficiales equivalentes están documentadas en [Create Flow](https://www.postman.com/meta/whatsapp-business-platform/request/slhc240/create-flow), [Set Encryption Public Key](https://www.postman.com/meta/whatsapp-business-platform/request/94vddj5/set-encryption-public-key), [Get Encryption Public Key](https://www.postman.com/meta/whatsapp-business-platform/request/ybbffdo/get-encryption-public-key), [Get Flow](https://www.postman.com/meta/whatsapp-business-platform/request/ze1wmk6/get-flow) y [Publish Flow](https://www.postman.com/meta/whatsapp-business-platform/request/wcidrlg/publish-flow).

Cada registro lifecycle incluye el `whatsappBusinessId` propietario. Antes de configurar un Flow, ObraSaaS exige verlo dentro de `/{WABA_ACTUAL}/flows` por ID exacto y nombre scoped; nunca usa un ID persistido para consultar o mutar recursos fuera del WABA conectado. Embedded Signup, provisionamiento y desconexion comparten un lease atomico por conexion: un lease vigente devuelve `409` antes de ejecutar efectos remotos. Si el refresh cambia el WABA o el `phoneNumberId`, su commit elimina las referencias activas, pendientes y del endpoint de la metadata, registra `identityChanged=true` en auditoria y deja el keyring persistido sin activarlo hasta un nuevo provisionamiento verificado.

El listado recorre todas las páginas de `/{WABA_ACTUAL}/flows` mediante cursores y reconstruye cada solicitud contra `graph.facebook.com`; nunca sigue una URL de paginación arbitraria. El nombre scoped determinístico y el lease durable impiden dos altas iniciales concurrentes desde ObraSaaS. Si Meta creó un DRAFT pero falla el commit local, la compensación sólo intenta `DELETE` después de volver a probar en el WABA actual el ID exacto, el nombre scoped exacto y el estado `DRAFT`; un Flow publicado o cuya pertenencia no se confirma nunca se elimina.

La metadata separa el outbound activo (`whatsappFlows`) del candidato pendiente (`whatsappFlowDrafts`). El Flow publicado anterior sigue en uso mientras el candidato espera que Meta lo marque `PUBLISHED`. Solo tras validar el Data Endpoint, la app de Meta y la clave, el candidato pasa a activo y deja de figurar como pendiente. Crear o actualizar un borrador nunca interrumpe el outbound vigente.

## Webhook general

El webhook general procesa los campos que el backend conoce:

- `messages`, incluidas respuestas `nfm_reply` y estados de entrega;
- `account_update`;
- `account_review_update`;
- `phone_number_name_update`;
- `phone_number_quality_update`;
- `message_template_status_update`.

El challenge `GET` compara `hub.verify_token` en tiempo constante. Cada `POST` valida `x-hub-signature-256` sobre el cuerpo original con `META_APP_SECRET`. El ingreso persiste los eventos de forma idempotente antes de responder; el procesamiento operativo usa leases y recuperación de pendientes. Un `phone_number_id` o WABA desconocido no obtiene acceso a otra organización.

No deben agregarse nuevas suscripciones hasta contar con consumidor, persistencia idempotente y pruebas para ese contrato.

## Estado verificable en el repositorio

Implementado:

- decisión de proveedor: Cloud API directa como camino primario y Twilio como fallback no habilitado;
- Embedded Signup tenant-scoped y preservación de metadata de Flows al actualizar una conexión;
- readiness de seis estados con revalidación remota, evidencia bidireccional y endpoint de salud tenant-scoped;
- blueprints `Incidencia de obra` y `Fichaje y seguridad` en Flow JSON `7.3`;
- Data API `4.0` con endpoint opaco, HMAC previo al descifrado y separación por conexión;
- cifrado RSA-2048/AES-GCM, keyring cifrado con KEK y ventana de rotación;
- autenticación de sesión contra los datos persistidos del tenant;
- control de concurrencia, límite de tamaño, rate limit y replay idempotente;
- provisionamiento de borradores con verificación de clave y configuración remota;
- envío interactivo de Flows publicados con `data_exchange` o `navigate` según su metadata;
- fallback a texto cuando el Flow publicado no está disponible;
- ausencia deliberada de publicación automática.

Esta lista describe el código y sus pruebas de contrato. Como evidencia externa separada, Meta ya asignó el número de prueba, verificó un destinatario propio y aceptó una solicitud outbound de plantilla con un token temporal. Eso no afirma entrega ni que un WABA/tenant real haya completado el circuito; tampoco acredita que las credenciales permanentes estén instaladas en Vercel Preview o Production.

## Pendiente para validar con un WABA real

Antes de afirmar que WhatsApp Flows está operativo end-to-end para un cliente hay que completar, en este orden:

1. revocar o rotar el token temporal usado en la prueba y sustituirlo por credenciales permanentes de release con el alcance mínimo necesario;
2. cargar en Vercel `META_APP_SECRET`, `META_VERIFY_TOKEN`, `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID`, `WHATSAPP_CREDENTIALS_ENCRYPTION_KEY`, `WHATSAPP_FLOW_TOKEN_SECRET` y el registro KEK para los ambientes necesarios, sin exponer sus valores; el token permanente de cada tenant debe persistirse sólo cifrado mediante el flujo previsto;
3. definir `NEXT_PUBLIC_APP_URL` con una URL HTTPS estable y desplegar las migraciones del keyring y de solicitudes del Data Endpoint;
4. verificar el callback del webhook general y sus seis campos suscritos con solicitudes reales firmadas por Meta; persistir al menos un inbound y los eventos de estado correlacionados con un outbound aceptado;
5. completar Embedded Signup con el WABA y número del tenant real del piloto; el número de prueba asignado por Meta no cierra este gate;
6. ejecutar el provisionamiento desde Integraciones y comprobar en Meta la clave pública `VALID`, `endpoint_uri`, `application_id`, Flow JSON `7.3`, Data API `4.0` y el estado de salud del endpoint;
7. recorrer ambos Flows en un teléfono real, incluyendo reintento, expiración, respuesta `nfm_reply`, persistencia tenant-scoped y fallback;
8. aprobar y publicar manualmente los Flows desde Meta y luego enviar el Flow publicado mediante Cloud API;
9. completar App Review, permisos avanzados y el paso a modo Live cuando Meta lo exija para tenants externos.

El envío de un Flow publicado puede contrastarse con la colección oficial [Send Published Flow by ID](https://www.postman.com/meta/whatsapp-business-platform/request/1i6xpic/send-published-flow-by-id). Hasta que las pruebas anteriores se ejecuten con un WABA real, el estado correcto es **implementado y validado por contrato, pendiente de validación externa end-to-end**.
