# S11.A7 — Continuidad de respuestas por conversación

Base: 2429337bd4676af53854d5c8768663da53e20f2e. Fecha: 19/09/2026.

## Defectos comprobados en el cliente anterior
El efecto de cambio de conversación borraba el texto y la referencia del envío incierto. Además, una respuesta tardía del POST podía actualizar el historial que estuviera seleccionado en ese momento. Un HTTP 200 con un payload incompleto podía pasar por la rama que limpiaba el borrador. No se investigó ni se afirma un incidente de exposición real: son defectos del código corregidos con casos controlados.

## Circuito implementado
Cada conversación conserva su borrador, resultado y solicitud pendiente en un store efímero de esa instancia de bandeja. Cambiar de chat no los borra ni cambia su destinatario. La instancia se remonta al cambiar empresa, obra o usuario; no existe un mapa global de todos los tenants.

El store admite hasta 40 conversaciones retenidas. Si alcanza el límite, sólo descarta entradas sin texto, sin solicitud pendiente y sin envío en curso. Nunca expulsa silenciosamente trabajo pendiente. Los datos no se almacenan en cookies, localStorage, IndexedDB ni en una nueva tabla. Cerrar o recargar puede perder el texto: la interfaz lo explica y activa el guard de navegación y el aviso antes de salir existentes.

Al escribir se muestra destinatario y obra. Las tarjetas de conversación indican borrador, enviando, por confirmar o acceso a revisar. Copiar es una acción explícita del usuario; descartar pide confirmación y sólo elimina el borrador local, no mensajes del servidor. Los botones principales de volver y enviar usan SVG inline, sin depender de una fuente de iconos externa.

## Envío y recuperación
El clic toma una reserva síncrona local para evitar dobles envíos antes del render de React. Captura el cuerpo, la conversación, empresa, obra y clave de idempotencia. La respuesta sólo actualiza el historial visible si sigue siendo la conversación de origen; el resultado de otra conversación queda en su entrada, no en la seleccionada.

El endpoint existente conserva el sender canónico, permisos, ventana de atención, verificación del canal, límites y recibos transaccionales. La respuesta añade un envelope con empresa, obra, conversación y clave del request que el servidor autorizó. El cliente compara ese envelope y exige un identificador de mensaje saliente y un estado conocido antes de limpiar el texto. No interpreta un 200 vacío como éxito.

Se rechazan headers de contexto contradictorios, claves de idempotencia diferentes entre header y body, obra duplicada en query y POST de origen cruzado. Los headers de contexto se comparan cuando están presentes para mantener la compatibilidad; no reemplazan la autoridad de sesión y la verificación de obra ya existentes.

Un timeout, error de red o respuesta incompleta conserva el mismo intento y detiene la edición de ese mensaje hasta verificarlo. No se reenvía automáticamente, no se genera otra clave y no se usa una plantilla como fallback. Un fallo confirmado permite una operación nueva únicamente con acción y confirmación explícitas. Un cambio de acceso/contexto bloquea los reintentos y conserva el texto para copiarlo.

## Estado de entrega y lectura
Preparado, enviando y desconocido son estados sin confirmación final, no mensajes entregados. Aceptado por Meta y enviado no equivalen a entregado o leído. La interfaz diferencia cada estado y etiqueta el recibo como «Último envío» para no confundirlo con un nuevo borrador.

Un mensaje pendiente con ID puede resolverse desde el historial autorizado sin reenviar. El recibo conocido progresa de aceptado a enviado/entregado/leído sin retroceder ante una respuesta anterior. No se deduce lectura humana a partir de la aceptación de la API. Los estados que el historial no confirma permanecen pendientes.

## Lectura y contexto
El GET de mensajes devuelve su empresa, obra y conversación. La pantalla comprueba esa identidad, el controlador de la solicitud vigente y la conversación seleccionada después de leer el JSON. Una respuesta obsoleta se descarta; un contexto ajeno retira el historial de esa vista, muestra el error incluso durante la actualización periódica y bloquea un envío pendiente.

La cabecera del listado puede seguir mostrando una previsualización procedente de su propia consulta autorizada. Retirar el historial de una conversación no afirma que se borraron todos los datos del workspace ni que se revocó la sesión global. Cada endpoint mantiene sus controles independientes.

## Pruebas
`tests/inbox-composer-continuity.test.js` ejecuta el store y el contrato de respuesta con aislamiento de conversación/instancia, doble clic, respuesta tardía, capacidad acotada, rechazo de contexto, progresión de estados, recuperación idéntica y descarte. Se amplía `tests/whatsapp-inbox.test.js` usando el handler real con el sender controlado, no una nueva función de envío ajena al dominio.

`scripts/verify-inbox-continuity-ui.mjs` monta InboxClient real con servidor HTTP local y contactos sintéticos. Recorre dos borradores, cambio de chat durante un POST demorado, respuesta aceptada y entrega posterior, 200 incompleto y verificación con el mismo intento, copia, cancelación de descarte, bloqueo de historial ajeno y limpieza al remontar otro contexto. Comprueba 320/390/768/1280 píxeles y errores de página. El fixture sustituye las fuentes de Next por Arial en el mismo scope raíz y no carga iconos externos; los iconos críticos de volver/enviar sí son los SVG del componente.

Los resultados finales de suite, lint, build y despliegue se registran por SHA en el PR #1. Este ensayo no envía WhatsApp reales ni acredita una sesión multiusuario de clientes. No se renovaron credenciales Meta ni se procesaron fotos de Victoria. El piloto físico y Production se verifican por separado.

## Continuación
Esta mejora completa la recuperación dentro de la misma bandeja; no equivale al modo offline-first del Sprint 14. Persistir borradores o envíos fuera de la pestaña requiere una fase específica con retención, identidad, consentimiento de almacenamiento y recuperación ante sesión cambiada. No introducir una cola automática de envíos como supuesto efecto de conservar un borrador.
