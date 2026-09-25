# S11.A32 - Ingreso HTTP firmado, lote durable y rechazo recuperable

Base: `5c5099fda6153619a965c5637253eb3a797cfb83`. Conserva A29/A30/A31.

## Correcciones
El verificador de firma requiere exactamente `sha256=` y 64 caracteres hexadecimales. La firma correcta seguida de `=extra` ya no se acepta por truncamiento del encabezado. Esto no elimina la necesidad del secreto: la prueba no demuestra una falsificacion sin la clave.

Un cuerpo firmado con colecciones malformadas recibe un 400 opaco antes de almacenar cualquier evento. Un fallo de almacenamiento recibe 503 con codigo estable `META_WEBHOOK_PERSISTENCE_UNAVAILABLE`, sin echo de SQL/datos del proveedor ni ACK `received:true`. Solo se registra trabajo after() despues de una persistencia exitosa. El reintento mantiene la identidad idempotente existente.

Las respuestas JSON propias de esta ruta tienen private/no-store y nosniff. No se cambia la ruta publica, el secreto configurado, las credenciales del proveedor, permisos o politicas de producto. No se reduce el control de bytes o de actualizaciones. Se conserva el rechazo antes de parsear de las firmas invalidas.

## Aceptacion SQL/HTTP
`verify-signed-webhook-ingress-postgres.mjs` rechaza targets fuera del PostgreSQL desechable 127.0.0.1:5432/obrasaas_execution_ci antes de cargar Prisma. No lee .env ni usa configuracion de un cliente. Abre un adaptador HTTP en loopback, pasa el stream recibido al handler POST real y utiliza firma, lectura acotada de bytes, normalizador, registro de conexiones, almacenamiento de lote y PostgreSQL reales.

Solo captura `next.after` y el punto de despacho: permite verificar que existe trabajo diferido despues de guardar, pero NO acredita el scheduler de Next/Vercel ni ejecuta envios. El cliente de prueba usa TCP local; fetch externo esta prohibido. Se utiliza una clave de firma sintetica, no la clave real de Meta.

Cubre desafio de alta, firma alterada/ausente/extendida, dominio de token equivocado, UTF-8/JSON invalidos, Unicode/espacios/chunks, limites existentes de cuerpo y actualizaciones, mismo remitente en dos empresas, mensajes/estados, duplicados concurrentes, canales desconocidos/deshabilitados/pausados y suscripcion bloqueada. Una falla SQL inyectada en la segunda fila comprueba rollback completo del lote, respuesta 503 y reintento sin duplicados.

El caso Flow empieza en el JSON nfm_reply firmado, comprueba eliminacion del token portador y descripcion privada del sobre persistido, obtiene el evento desde la cola, revalida su alcance y ejecuta el orquestador atomico y motor. La incidencia final se consulta por su recibo exacto. ACK, efecto de negocio y entrega al trabajador siguen siendo hechos distintos.

## Limites y continuidad
No es una llamada desde Meta, ni test de TLS/proxy/Vercel, identidad canonica cifrada, dispatcher completo, respuestas fisicas o credenciales comerciales. El permiso temporal y las transacciones de A31 permanecen. No hay cambios de esquema/dependencias, ni nueva instalacion local por falta de espacio en C:. Build y base real se prueban en CI; cada resultado se documenta por SHA antes de publicar.

Guia Next instalada y documentacion oficial de Route Handlers/after consultadas. Las paginas de Meta devolvieron 429 durante esta revision; no se actualizo el protocolo o limites a partir de fuentes secundarias.
