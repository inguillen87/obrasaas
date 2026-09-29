# Acceso personal con verificación criptográfica de Clerk Production

Base: `1689dde40044d367c2752d36fcc7564ca687353d`. El ingreso personal no necesita permisos para administrar usuarios. Se implementa la verificación manual de tokens documentada por Clerk, separada de su Backend API.

## No es un fallback de autenticación
Las páginas públicas de inicio/registro usan el SDK y la clave pública Production de ObraSaaS. La cuenta y `/api/identity/session` verifican su JWT en servidor con `jose` y claves públicas del único issuer permitido: `https://clerk.obrasaas.com/.well-known/jwks.json`. No se transfiere, copia ni reconfigura la clave administrativa privada. La configuración para Backend API conserva sus verificaciones anteriores y su estado pendiente.

Se exige RS256, typ JWT, kid acotado, firma verificable, issuer exacto, azp igual a `https://obrasaas.com`, sub de usuario y sid de sesión. exp/iat/nbf son obligatorios y enteros, con tolerancia de 5 segundos y ventana máxima de 5 minutos. No se aceptan sesiones pending, tokens para otra audiencia, algoritmos none/HS256 ni referencias de claves aportadas por el JWT. No se obtiene un issuer o URL de red desde el token.

JOSE gestiona caché y selección de claves: 5 minutos de caché, 10 segundos entre recargas por claves desconocidas y 5 segundos de timeout. Las claves rotadas se vuelven a consultar. Una clave/firma desconocida o un error no concede sesión. No se usa una clave stale indefinidamente ante fallos. Como con JWTs de sesión estándar, una revocación puede tardar hasta el vencimiento corto del token; no se promete una consulta administrativa de revocación por cada request.

Bearer explícito tiene prioridad y un Bearer malformado no recae a una cookie. La cookie `__session` se acepta una sola vez, acotada, sin interpretar marcadores de rol del navegador. Ningún encabezado `x-clerk-auth-*` se usa para autorizar la cuenta: no se utiliza `auth()` esperando cabeceras del middleware anterior.

## Superficies
- `/sign-in` y `/sign-up`: formularios oficiales de Clerk, no contraseñas procesadas por el servidor de ObraSaaS. La clave pública/instancia/origen siguen fijados; configuración incorrecta mantiene la pantalla restringida.
- `/cuenta`: verifica la firma y claims antes de devolver la página de cuenta; una petición anónima/ilegítima va a ingreso. Una falla del proveedor muestra estado sin habilitar datos.
- `/api/identity/session`: GET de resultado mínimo, sin claims completos, IDs de usuario/sesión, tokens o roles. 401 para falta de autenticación; 503 para configuración/proveedor no verificable; private/no-store.
- `/demo`: conserva sus ejemplos explícitos, públicos y sin datos de negocio.

Nada de esto habilita el agregado legacy, las APIs de trabajadores, ART, finanzas, asistencia o KYC. Una cuenta Clerk no se equipara a pertenencia aprobada a empresa/obra. El despliegue no cambia bases, secretos, DNS ni activos de marca. El Backend API administrativo y la recepción firmada de webhooks mantienen requisitos distintos.

## Aceptación
Pruebas criptográficas positivas/negativas con claves RSA sintéticas, más conservación de la suite previa y controles de acceso. El build/CI debe aprobar antes de publicar. La carga real de formularios y el circuito login/logout se registran sólo después de ejecutarse. Una cuenta sintética administrada por API no prueba entrega ni verificación de email de una persona; conservar esa distinción en la evidencia.

Fuentes oficiales: https://clerk.com/docs/guides/sessions/manual-jwt-verification ; https://clerk.com/docs/guides/sessions/session-tokens ; https://github.com/panva/jose . Se usa la revisión de JOSE ya resuelta en el proyecto, 5.10.0, ahora declarada directamente y auditada con el lockfile.
