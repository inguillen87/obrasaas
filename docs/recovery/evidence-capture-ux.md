# Evidencia de obra: captura, contexto y recuperación

## Entrega
Se reemplaza el formulario mínimo de evidencia por un panel de captura con contexto de obra, tarea canónica, selección de archivo y cámara nativa opcional, vista previa local, nombre/tamaño, descripción y persona informada independiente del autor de la bitácora. No se sube un archivo al seleccionarlo ni se presenta su miniatura como evidencia ya guardada.

Se conserva el dominio ProgressEvidence, las reservas ProtectedUpload y sus controles del servidor. No hay nuevos modelos, migraciones o almacenamiento paralelo. El flujo distingue preparación, transferencia privada, vinculación con tarea, confirmación y revisión. Los formatos/tamaños no admitidos se explican antes del envío; la validación de bytes del servidor se conserva.

Ante fallo de red, timeout o respuesta incompleta, la interfaz no confirma el registro. Conserva el intento y bloquea la modificación del archivo/tarea para reintentar la misma operación, sin repetir una transferencia ya confirmada. Un cambio posterior de datos limpia la indicación de guardado anterior. La selección queda sólo en memoria: no es una cola offline ni recuperación después de cerrar la pestaña.

## Contexto y permisos
El editor envía la empresa y obra que estaba mostrando; ambas se comparan con la sesión antes de acceder a datos. Son condiciones de coincidencia, nunca autoridad suministrada por el cliente. Las APIs mantienen compatibilidad con clientes anteriores sin esas cabeceras, que siguen usando su sesión y permisos existentes. El componente se remonta por empresa/obra/actor para evitar reutilizar estado de un contexto anterior.

La aprobación sigue separada de la captura y requiere los permisos ya establecidos. La persona indicada en el formulario no sustituye la identidad autenticada de quien registra. El archivo no se abre mediante una URL pública ni se cachea en el service worker.

## Evidencia de pruebas
Pruebas unitarias de MIME, límites, respuestas incompletas, timeout, errores HTTP y comparación de contexto. El script verify-evidence-capture-ux.mjs ejecuta ProgressClient real en Chrome con servidor y datos sintéticos locales: selector nativo, preview blob local, rechazo de SVG, una transferencia, fallo simulado al registrar, reintento idéntico, un registro visible y controles de aprobación ausentes para el rol de captura. Comprueba el panel a 320/390/768/1280 píxeles y errores de página.

Estos ensayos locales no certifican almacenamiento productivo, WhatsApp, Android/iOS físicos ni aislamiento de todos los roles con cuentas distintas. La prueba publicada debe registrarse aparte con resultado real y commit. No se generaron invitaciones, mensajes externos ni efectos económicos mediante esta entrega.

Referencias técnicas consultadas: documentación local de Next.js instalado; MDN input type=file (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file); límites de Vercel Functions (https://vercel.com/docs/functions/limitations).
