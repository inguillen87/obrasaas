# Meta: comprobar la app antes de vincular una obra

## Propósito y alcance
El Sprint 11 del plan maestro exige conectar el backend real a Meta y comprobar recepción, procesamiento y respuesta. La presencia de variables o un mensaje enviado desde la consola de Meta no demuestra ese circuito. Esta entrega incorpora un control previo dentro de Integraciones, sin crear otro menú ni duplicar la verificación de cuentas ya vinculadas.

La comprobación distingue: presencia de configuración local, autenticación real de la app ante Graph, configuración del callback de la app, vinculación de la obra y tráfico real. Sólo las tres primeras pertenecen a esta herramienta. El callback comparado es el general de la app: no resuelve ni modifica overrides específicos de una WABA.

## Comprobación de proveedor
La operación usa únicamente valores del servidor. Realiza como máximo dos GET a graph.facebook.com: identidad de la app y suscripciones. No recibe claves, IDs alternativos ni destinos desde el cliente. La credencial viaja en Authorization, no en el query; no se sigue una redirección ni una URL de paginación devuelta por el proveedor. Hay un plazo total y un límite de 64 KiB de respuesta.

Se compara el callback con el origen autorizado del entorno y /api/webhooks/whatsapp. Una app autenticada sigue siéndolo aunque la consulta posterior no permita confirmar el webhook; se separan ambos resultados. Un callback activo y coincidente no demuestra entrega, firma válida de mensajes entrantes, procesamiento ni asociación con una obra.

El resultado se reduce a códigos, estados y fecha de comprobación. No retorna secretos, tokens, URLs de callbacks ajenos, nombres de cuentas o mensajes de error crudos del proveedor. La existencia de META_APP_SECRET se muestra como presente sin verificar hasta una autenticación aceptada. El token de mensajería y la clave de app no se confunden.

## Autorización y auditoría
POST /api/integrations/whatsapp/preflight requiere administración de plataforma y permiso de integraciones de la obra activa. Las cabeceras de empresa/obra se comparan con la sesión; no conceden autoridad. Un administrador de una empresa sin autoridad de plataforma no puede consultar la credencial global.

La operación acepta sólo un objeto vacío, rechaza origen cruzado y query, y devuelve private/no-store. Antes de consultar Meta reserva una solicitud auditada bajo bloqueo de base por actor, limitada a tres por minuto entre organizaciones. El evento de resultado conserva sólo códigos públicos y su relación con la solicitud. No se informa como verificación completada si ese resultado no pudo auditarse.

No se regeneran claves, no se registra un número, no se suscriben aplicaciones, no se modifica un callback y no se envían mensajes. Los únicos registros escritos son las entradas de auditoría del diagnóstico. No hay cambios de datos de obra, nómina, compras o pagos.

## Interfaz
El panel usa los tokens Dark Obsidian de la aplicación, seis comprobaciones de configuración y dos resultados independientes. Presenta acciones concretas según el código de fallo, sin publicar credenciales. Las verificaciones se ejecutan sólo al pulsar el botón: no en cada carga ni periódicamente.

El estado anterior se retira al iniciar otra consulta y ante pérdida de contexto. Una respuesta incompleta o de otra obra bloquea la pantalla hasta volver a abrir el contexto autorizado. La salida cancela la petición del navegador. La pantalla nunca presenta estos resultados como prueba de un canal operativo.

## Pruebas
Las pruebas unitarias verifican autenticación, identidad, ausencia de configuración, origen de Preview, suscripción faltante/inactiva, campo messages, callback diferente, respuesta incompleta, timeout total, tamaño máximo y no divulgación del payload del proveedor. Se prueba que las peticiones externas son GET al host fijo y que no transportan secretos en la URL.

Los contratos del handler comprueban autoridad de plataforma, permisos de integración, contexto, origen, rechazo de parámetros/credenciales del cliente, límite de solicitudes y auditoría. El navegador controlado utiliza el panel real con HTTP sintético para comprobar presencia distinta de verificación, clics duplicados, rechazo de respuestas de otra obra y adaptación a 320/390/768/1280 px.

La consulta real de Meta y la prueba del preview se registran por separado en la entrega. Este diagnóstico no sustituye el Sprint 11 ni las pruebas físicas de mensajes del plan; tampoco altera los estados de salud guardados de conexiones ya existentes. El walkthrough documenta un grabador de audio simulado; no se declara una transcripción o entrenamiento por haber añadido esta comprobación.
