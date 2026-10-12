# BINDX: transporte preparado para consulta civil

Estado: **preparación técnica, sin integración canónica ni conexión activada**. El cliente nuevo no está importado por un runtime, una ruta HTTP o la UI. No hay credenciales instaladas, consultas reales, cuenta contratada acreditada ni aceptación de BINDX/RENAPER. El flujo KYC actual conserva su revisión independiente.

## Contrato público consultado el 12 de octubre de 2026

[BINDX](https://developers.bindx.com/consulta-de-datos-renaper) enlaza [ApiStore](https://apistore.pcnt.io/), que identifica `https://apistore.pcnt.io` como origen de API y lo usa en ambos ejemplos. El entorno contratado requiere confirmación; **no hay origen predeterminado**.

Las operaciones implementadas, exclusivamente en el transporte de servidor, son:

| Operación | Contrato publicado |
| --- | --- |
| Login | `POST https://apistore.pcnt.io/v1/login/jwt`, JSON `username/password`; respuesta `token`, `expires_in` en la tabla pero ausente en el ejemplo. |
| Consulta civil | `GET https://apistore.pcnt.io/v1/information/person-renaper/{identification}/gender/{gender}`, `Authorization: JWT <token>`, género `F/M`. |

La referencia especifica esa plantilla aunque el ejemplo usa nombres de parámetros. Barcode muestra Bearer; es otro servicio, excluido. Bind PSP usa otro contrato y autenticación.

La respuesta publica nombres, apellido, ejemplar, fechas y código de fallecimiento. Las fechas son `String`; los ejemplos usan `DD/MM/YYYY`. No publica selfie, prueba de vida ni callback para esta consulta.

La implementación exige evidencia del esquema `apistore-renaper-civil-ddmmyyyy-v1`. Conserva las fechas y `codigo_fallecido` sin convertir este código en una afirmación de supervivencia. Proyecta únicamente `nombres`, `apellido`, `ejemplar`, `fecha_nacimiento`, `emision`, `vencimiento` y `codigo_fallecido`; descarta domicilio, CUIL, identificadores crudos y payload completo. Un formato distinto o error con HTTP 200 queda `UNKNOWN`. El resultado requiere revisión humana y no acredita al titular presente ni concede permisos.

## Configuración exclusivamente del servidor

`createBindxCivilDataClient()` queda en `CONTRACT_PENDING`, sin red. La configuración ausente, pendiente o incompleta nunca obtiene un token ni envía un DNI. El componente no lee ni cambia variables de entorno.

Para construir un transporte utilizable, código de servidor debe suministrar todos estos datos:

- Versión `bindx-civil-data-config-v1`, estado `CONFIRMED`, producto `RENAPER_CIVIL_DATA`, origen exacto y autenticación `JWT`.
- Credenciales privadas de ese producto, sin usar ejemplos de la documentación.
- `providerEvidence`: referencia y fecha de evidencia revisada que confirme producto, origen, entorno, autenticación y esquema de respuesta. Las banderas de configuración no prueban por sí mismas que exista esa evidencia: el futuro runtime debe obtenerlas de su configuración aprobada, nunca de un request.
- `renaperAgreement`: referencia y fecha confirmadas del convenio aplicable. La página de BINDX indica que las credenciales y el convenio con RENAPER deben gestionarse directamente; BINDX no otorga esas credenciales.
- Contexto privado de empresa, actor, persona, submission, UUID de operación, SHA256 del documento y DNI/género de esa submission. `lookup()` no admite payload ni permite reemplazar ese contexto.
- Consentimiento nuevo y específico `bindx-civil-data-consent-v1`, con referencia, fecha y digest del contexto completo. Los consentimientos actuales de OCR/OpenAI o análisis biométrico privado no habilitan este envío.
- `beforeExternal`, una función de servidor que revalide autoridad, empresa/persona/submission vigentes, bytes, convenio, evidencia y consentimiento actuales. Debe devolver `true` tras los controles canónicos; se ejecuta antes del login, antes del GET y antes de devolver datos privados. La integración real de esos controles todavía no existe en este componente.

`bindxCivilContextDigest(context)` permite ligar el consentimiento al contexto de servidor; no es una firma de proveedor, un recibo durable ni un identificador público. Cada resultado privado contiene `bindingDigest`, igual al digest de la configuración capturada, o `null` si la configuración no fue aceptada. Esto permite al futuro integrador correlacionar los hechos con la submission correcta sin devolver DNI ni IDs de actor. El resultado es inmutable. El cliente captura la configuración para evitar su modificación entre awaits. `readiness().available` indica sólo que esa configuración pasó las validaciones del transporte; `providerAcceptanceVerified` permanece `false`.

## Límites y recuperación

Se usa un único deadline de hasta 30 segundos para autorización, ambos requests y lectura de sus cuerpos. Se abortan operaciones y lectores; login está limitado a 16 KiB y consulta a 32 KiB, medidos sobre los bytes leídos. Los tamaños y límites de texto son protecciones técnicas de esta implementación, no cuotas ni prestaciones comerciales contratadas.

Sólo se admiten HTTP 200 y JSON válido para proyectar datos. El estado `OBSERVED` describe una respuesta privada recibida, con `identityCertified`, `biometricsVerified`, `livenessVerified` y `permissionsGranted` en `false`, y `requiresHumanReview` en `true`. Los errores tienen códigos propios acotados; nunca incluyen mensaje del proveedor, DNI, contraseña, token, URL consultada o cuerpo crudo. No hay logs del componente.

No se reintenta login, consulta, token expirado, timeout, error HTTP o esquema inesperado. Un segundo llamado al mismo cliente devuelve `OPERATION_ALREADY_ATTEMPTED` sin otra petición ni datos privados. Este guard vive sólo en memoria: **no garantiza exclusión entre procesos, instancias nuevas o crashes**. `queryAttempted` registra que se invocó el transporte del GET; no prueba entrega, ausencia de consumo, precio, financiación o cargo.

Quedan pendientes antes de montar o habilitar la función:

1. Producto y condiciones contratadas para consulta civil sin altas financieras, origen/entorno y esquema confirmados; costo, cuotas y capacidad no están aprobados.
2. Configuración canónica aprobada y consentimiento específico respaldados por recibos reales, sujetos a revocación; nunca banderas recibidas del navegador.
3. Operación durable, reserva y recibo ligado a empresa/persona/submission/documento/proveedor. La observación técnica debe conservarse aunque se revoque el acceso después del request, y la lectura privada exigir autoridad vigente. `UNKNOWN` debe bloquear repetición hasta una resolución acreditada; esta API pública no documenta una recuperación por UUID del cliente.
4. Integración con la revisión humana independiente, DTO público mínimo y pruebas de aislamiento/revocación/recuperación sobre almacenamiento canónico.
5. Pruebas autorizadas en el entorno contratado y aceptación real. Los tests actuales usan credenciales, sujetos, respuestas y HTTP sintéticos; no certifican conexión ni identidad.

## Productos y efectos excluidos

Este cliente no implementa ni invoca onboarding de Bind PSP, creación de solicitud PSP, cuenta, CVU, wallet, cierre de onboarding, pagos, invitaciones, biometría o endpoints HTTP nuevos de ObraSaaS. El [Registro único PSP](https://psp.bind.com.ar/developers/apis/crea-una-solicitud-de-onboarding) incluye apertura de cuenta/CVU al aprobarse. La [modalidad por partes](https://psp.bind.com.ar/developers/apis/guia-onboarding-en-partes) es otro posible producto para DNI/rostro, cuyo flujo se configura según contrato; no se habilita desde esta implementación.

Esta consulta ApiStore es síncrona: no se implementa ni inventa un callback. La [documentación general de PSP](https://psp.bind.com.ar/developers/general) describe callbacks sin seguridad adicional de aplicación por defecto y mTLS opcional; tampoco se inventa una firma HMAC para ellos.

No se encontró tarifa pública BINDX para esta función en el producto o la documentación consultados. La referencia económica previa ARS 130 más 30% (=ARS 169) es parcial y no demuestra el costo total de BINDX/KYC. Los abonos comerciales existentes y todos los permisos actuales quedan intactos.
