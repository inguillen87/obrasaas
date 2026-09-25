# S11.A33 — Buscar y priorizar el seguimiento sin salir de la conversación

Base: `2c2eb18e0ed8670b275673036edd12338e111024` (A32). Mejora de lectura y navegación, no una ampliación de permisos ni del despacho.

## Experiencia terminada en código
El seguimiento incorpora búsqueda literal por texto operativo, tipo de formulario e identificador del registro. Ignora diferencias de mayúsculas, acentos y espacios; todas las palabras deben estar presentes. La entrada está limitada a 160 caracteres. No utiliza expresiones regulares ni construye HTML a partir de la consulta.

La búsqueda opera sólo sobre los veinte registros de la página autorizada, no sobre toda la conversación. Puede combinarse con los filtros anteriores. Sus conteos siguen describiendo la página completa y el contador de resultados indica cuántos registros coinciden con búsqueda y categoría. Una página sin coincidencias no oculta la paginación ni afirma que no haya pendientes en otras páginas.

«Requieren atención primero» muestra revisión de envío, enlaces vencidos, espera de respuesta y respuestas registradas, conservando el orden del servidor dentro de cada grupo. No infiere severidad de incidencias ni modifica prioridades de obra. «Más recientes» restaura el orden recibido, sin reinterpretar cursores ni fechas con el reloj del dispositivo.

Búsqueda y orden se conservan al paginar, actualizar o recuperarse de un error de lectura. Cerrar el seguimiento, cambiar de conversación/empresa/obra o perder conexión restablece la vista; no se persiste contenido ni consulta en localStorage o URL. Reconectar exige una lectura explícita, como en A30. El lanzador de mensajes, consentimientos e intentos de escritura inciertos no se remonta por estas opciones.

## Presentación y accesibilidad
Vista previa breve del mensaje en la tarjeta; el cuerpo completo y su explicación de estado permanecen en «Ver mensaje y registro». Las etiquetas de aceptación/entrega/respuesta siguen separadas. No se anuncian partes, pagos o ingresos aprobados a partir de una respuesta.

Controles con etiquetas, foco visible y botón de limpieza que devuelve el foco al campo. Enter no envía formularios ni navega; Escape limpia únicamente la búsqueda cuando tiene contenido. En móvil, entrada/select usan al menos 16 px, los controles tienen área táctil y la lista usa el desplazamiento de la pantalla en lugar de otro scroll encerrado dentro de ella.

## Invariantes
Sólo se indexan campos de la proyección privada mínima ya autorizada: body, messageId y nombre de formulario. No se consultan otras páginas por cada tecla, no se transmiten términos a analytics/URLs y no se usan metadata privada, teléfonos, tokens o mensajes de otros chats. Una respuesta inválida mantiene la vista no disponible en vez de producir un falso resultado vacío exitoso.

La lógica de presentación no modifica los datos de entrada, el cursor, la hora de observación o los estados de dominio. Se mantienen todos los controles de servidor existentes y se retiran resultados ante errores o respuestas de otra conversación.

## Aceptación
Nuevas pruebas puras para consulta literal/acento, límites, búsqueda profunda en el cuerpo permitido, combinación de categoría, orden estable, página vacía/inválida y ausencia de mutaciones. El navegador de seguimiento conserva sus escenarios anteriores y añade búsqueda, orden, errores, foco, consulta privada no indexada, paginación y tamaños 320/390/768/1280. La aceptación S9.2 amplía su recorrido móvil con sesiones Clerk y PostgreSQL de ensayo para comprobar búsqueda/orden sin peticiones nuevas ni escrituras.

Los resultados del árbol y despliegue exactos se registran en PR #1. Las pruebas controladas no acreditan entrega física, renovación de la cuenta piloto, dispatcher o producción. Sin dependencias, migraciones, endpoints o permisos nuevos.

## Integración con el redactor y corrección de aceptación
El primer candidato pasó los componentes aislados, pero la aceptación con Clerk detectó que la búsqueda estaba anidando un formulario dentro del formulario real del redactor. La vista dejaba de conservar el selector tras pulsar Enter. Se conservó el fallo del SHA inicial `09763e9`; no se amplió el timeout ni se retiró el paso de teclado.

La barra usa ahora una región de búsqueda sin elemento form. Enter en su campo se cancela de forma local para no ejecutar el envío implícito del redactor; Escape sólo limpia la búsqueda activa. La regresión controlada monta el seguimiento dentro de un redactor con un borrador y botón de envío, exige cero formularios anidados y cero invocaciones de submit. El recorrido autenticado mantiene Enter y comprueba explícitamente que búsqueda y selector sigan disponibles.

Esta corrección no cambia el botón de envío real ni sus controles. Un campo de búsqueda no equivale a redactar una respuesta de WhatsApp. La aceptación corregida y su nuevo SHA se deben comprobar antes de declarar cerrada A33.
