# Dominio y acceso personal de producción

Dominio propio: `obrasaas.com`. Se conserva Namecheap como registrador, Cloudflare Free como DNS autoritativo y el proyecto Vercel `obrasaas-saas`. No se cambia proveedor de hosting ni se trasladan bases.

Delegación: `byron.ns.cloudflare.com` y `gemma.ns.cloudflare.com`. En Cloudflare los registros web/autenticación son DNS-only: A raíz `216.150.1.1` y `216.150.16.1`; CNAME www `ade73e3d4f6cadf2.vercel-dns-016.com`. www redirige 308 a la raíz. Se preservaron MX y SPF preexistentes, sin contratar un buzón.

La aplicación Clerk existente ObraSaaS tiene una instancia Production nueva, separada de Development: `ins_3JyUDcOoJ4VPW8D75Dkzzyc6J0m`. Sus cinco CNAME son los emitidos por Clerk para Frontend API, Account Portal y correo/DKIM. No se reutilizan las instancias, OAuth o claves de otros productos. Google Production queda deshabilitado mientras carezca de credenciales propias; email/contraseña se conserva.

## Integración del sitio
Se instala el SDK oficial @clerk/nextjs 7.9.7 y localizaciones 4.20.0. El proveedor se limita al grupo de rutas de identidad. Sign-in y sign-up son rutas catch-all para los pasos de verificación. La configuración exige el dominio y la clave pública exactos de ObraSaaS, secreto live, ID esperado y authorized parties restringidas al origen canónico.

Faltar configuración no crea un proyecto keyless ni abre el panel: mantiene el aviso de acceso restringido. El formato de una clave no comprueba sus credenciales contra Clerk. Errores del proveedor no conceden acceso ni revelan detalles internos.

`/cuenta` verifica `auth()` en el servidor antes de mostrar la cuenta. UserButton permite gestionar la propia sesión. Se muestra expresamente que empresa, obra y permisos operativos todavía deben vincularse. No consulta ni importa datos históricos, no asigna roles automáticamente y no considera la organización activa del navegador como autoridad para el agregado legacy.

La barrera actual de APIs de negocio se mantiene independiente: una sesión Clerk no sustituye INTERNAL_API_SECRET ni habilita `/api/state`. La clave de servicio nunca va al cliente. Las rutas de identidad en dominios antiguos se llevan al dominio canónico durante Production.

## Configuración y límites
Variables de Production: NEXT_PUBLIC_APP_URL, clave pública, CLERK_EXPECTED_INSTANCE_ID, CLERK_AUTHORIZED_PARTIES y rutas/redirecciones. El secreto privado debe instalarse directamente mediante un canal autorizado del proveedor o el panel Vercel; nunca pegarse en un chat. La integración connectable de Clerk no logró aprovisionar el proyecto existente; no se considera sincronizada por aparecer instalada.

Se conserva el portal alojado de Clerk durante la transición. No se configura un webhook de producción hacia un endpoint que aún no tenga validación de firma y persistencia adecuadas. Los sincronizadores de identidades/organizaciones de la rama enterprise, sus migraciones y la conciliación de datos son un cierre separado.

## Verificación
Pruebas puras: configuración estricta, ausencia de secretos en resultados, rutas precisas y rechazo de falsa sesión. CI: suite previa, lint, auditoría de dependencias, build y controles de contención. Pruebas sin credenciales reales validan el modo no configurado, no una sesión autenticada de usuario.

Antes de declarar el ingreso completo: confirmar la clave Production, desplegar esa configuración y recorrer alta/verificación/login/logout con una cuenta real. El hecho de que DNS y HTTPS estén verificados no prueba ese circuito ni autoriza acceso empresarial.

Referencias: https://clerk.com/docs/nextjs/getting-started/quickstart ; https://clerk.com/docs/nextjs/guides/users/reading ; https://vercel.com/docs/domains/set-up-custom-domain .
