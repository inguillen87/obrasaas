# Número de WhatsApp de la empresa propia

Este recorrido usa el canal empresarial, la sesión firmada de Clerk y el vault
`tenant-aad-v2`. No usa Embedded Signup ni habilita clientes generales. El
piloto de desarrollo conserva su política y su límite de cuatro horas.

La configuración queda cerrada si falta cualquiera de estos valores privados:
`OBRASAAS_META_OWN_COMPANY_RELEASE=own-company-number-v1`,
`OBRASAAS_META_OWN_COMPANY_POLICY` y
`OBRASAAS_META_OWN_COMPANY_POLICY_REVIEW_SHA256`. El último valor es `digest`
del objeto con las claves, en este orden: `version`, `sourceHead`,
`organizationId`, `actorId`, `clerkUserId`, `clerkOrganizationId`, `projectId`,
`appId`, `businessId`, `wabaId`, `phoneNumberId`, `expectedPhoneE164`,
`companyPhoneRevision`, `issuedAt`, `expiresAt`. Version es 1; el SHA debe
coincidir con `VERCEL_GIT_COMMIT_SHA`, el target debe ser Production, el
administrador y la declaración deben ser canónicos y la vigencia máxima es
cuatro horas. Esta configuración requiere revisión y autorización propias;
la duración de un token no autoriza esa política ni la renueva.

La importación usa sólo `META_OWN_COMPANY_ACCESS_TOKEN`, sensible y exclusiva
de Production. No tiene fallback a `META_WHATSAPP_ACCESS_TOKEN` ni a
`WHATSAPP_TOKEN`; ambos tokens globales conservan sus usos anteriores.
Se reutilizan `META_APP_SECRET`, `NEXT_PUBLIC_META_APP_ID`, `META_GRAPH_API_VERSION`,
`META_CUSTOMER_VERIFY_TOKEN` y el vault existente. No se cambian los IDs
globales del canal Test ni las variables de autorización general. El token
debe ser SYSTEM_USER vigente, con los tres permisos solicitados y sólo
`public_profile` implícito opcional. Los scopes granulares vacíos sólo se
aceptan con la cadena completa de ownership: usuario app-scoped en
business/system_users, app y WABA propias, y teléfono exacto en la WABA.
Targets explícitos contradictorios, respuestas parciales/paginadas o una
vigencia del token inferior a la política cierran la autorización.

`GET /api/identity/company-channel?projectId=…&scope=…&discovery=OWN_NUMBER`
consulta esos assets sin escribir en DB ni en Meta. `CONNECT_OWN_NUMBER`
reserva un recibo antes de las consultas de proveedor y guarda el token
cifrado con AAD organización, proyecto ancla y phone_number_id. El canal
queda PREPARED, disabled/PENDING. `ACTIVATE_OWN_NUMBER` es una confirmación
separada: comprueba el registro y la suscripción, y reserva antes de todo
POST. Si Meta ya devuelve CONNECTED/CLOUD_API no se ejecuta `/register`.
El PIN de seguridad para un registro explícito no es el código SMS.

Reemplazar assets exige SUSPENDED, revisión exacta y ausencia de operaciones
pendientes. Conserva ID y ancla, guarda el historial cifrado, aumenta la
revisión y revoca las asignaciones/epochs anteriores. Los eventos y vínculos
previos conservan sus tuplas originales y no autorizan los nuevos assets.

Un timeout de POST o confirmación de commit incierta conserva el UUID original
para GET de lectura; no hay reenvío ni recuperación automática. Su observación
no activa el canal. ASSIGN y ACTIVATE corporativos son decisiones distintas;
los permisos y KYC individuales siguen siendo necesarios. Activar credenciales
no demuestra recepción de mensajes, identidad humana ni aceptación de campo.

Verificación local sintética: `node --test tests/production-own-company-number.test.mjs`
y `node scripts/verify-own-company-number-postgres.mjs` con la URL local
disposable y `CUTOVER_TEST_DISPOSABLE=1`. El harness rechaza hosts remotos,
targets Vercel y credenciales de administrador; crea y elimina su propia DB.

Una denegación OWN confirmada queda como observación durable sin efectos, o
como recuperación manual del recibo cifrado de un adjunto ya preparado. El
cron no vuelve a elegir esos casos; un timeout de ownership/proveedor sigue
siendo transitorio. Una reserva de envío previa nunca autoriza otro POST.
