# S11.A30 — Historial y respuestas después de un corte de conexión

Base aislada: `6f77f652e1a03de549c602c6bdb1945655b8cde6` (A28). A29 sigue siendo un candidato independiente, no incluido en esta corrección.

## Regresión reproducida antes de corregir
La consulta de historia y la respuesta montada directamente conservaban su estado React al pasar offline. Ocultaban los datos durante el corte, pero los mostraban otra vez al reconectar, sin una nueva lectura. El ensayo reprodujo tres registros del historial y una respuesta marcados como verificados, con el mismo conteo de peticiones anterior al corte. La prueba anterior sólo contaba envíos/peticiones al reconectar; no verificaba que el historial siguiera vacío.

## Corrección
La identidad de los dos componentes de lectura incluye la disponibilidad de red declarada por su padre. Una transición descarta la observación y ejecuta el cleanup de su consulta; cerrar, abortar o completar después no puede poblar la nueva instancia. Al volver online, el operador debe abrir otra vez el seguimiento y consultar la respuesta. No se ejecuta una lectura automática ni se reutiliza el dato previo como si estuviera vigente.

Es una pantalla de lectura: se reinician página, filtro y panel abierto al cortar la conexión. No se alteran el formulario de envío, el intento de POST, borradores, partes, consentimientos, credenciales o recuperación de escrituras inciertas. No se incorpora almacenamiento offline ni se interpreta el evento online como prueba de acceso a Internet, sesión válida o disponibilidad de Meta. Cada consulta explícita vuelve a atravesar los controles del servidor.

La clave usa serialización de la tupla de contexto para evitar ambigüedad al combinar identificadores. El valor omitido de online conserva el comportamiento por defecto de conexión disponible; sólo false declara offline, como en las llamadas actuales.

## Verificación
`verify-flow-read-connectivity-ui.mjs` monta History y Reply reales, una respuesta anidada y el handler/servicios existentes de A28. Utiliza identidad, HTTP y base controlados. Incluye resultados ya cargados, respuestas tardías de éxito/error, actualización del texto entre lecturas, deshabilitación offline, denegación de autorización después de reconectar y 320/390/768/1280 px. Compara mensajes y sesiones antes/después y exige cero escrituras y cero peticiones al reconectar.

Los verificadores anteriores de historia y respuesta se amplían para exigir historial vacío y reapertura explícita; no se retiran sus escenarios de privacidad, paginación y correlación. El nuevo circuito entra al CI permanente junto a ellos. La aprobación autenticada del commit se comprueba por separado; esta prueba nueva no es un evento físico de conectividad ni mensajería Meta.

## Candidato A29 preservado
El run `36084197162` del candidato `39a8256` terminó failure en el paso PostgreSQL. La lectura agrupada del diagnóstico y de sus fuentes fue bloqueada por la herramienta, sin ejecutar. No se repitió esa operación por otra vía. A29 permanece en su rama y en los 23 archivos staged originales; no se promueve sin revisar el error.

Esta entrega se trabaja en un worktree nuevo desde A28, sin incluir ni modificar A29. Antes de continuar ese candidato se debe incorporar esta corrección a su nueva base y repetir su validación: no publicar su árbol viejo, que eliminaría este arreglo. Los resultados concretos, SHA y estado de Vercel se registran en PR #1 después de comprobarlos.

Sin dependencias, migraciones, endpoints o permisos nuevos. Sin mensajes a personas ni promoción de Production.
