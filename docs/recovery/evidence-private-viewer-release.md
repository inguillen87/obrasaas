# Evidencia privada: consulta en la bitácora y circuito verificado

## Implementación consolidada
La imagen guardada se abre dentro de la bitácora con su obra, tarea, descripción, versión y estado. El visor ofrece ampliar, reducir, ajustar, acceso al original autorizado y retorno al registro. No ejecuta una aprobación ni modifica el avance por mostrar una imagen.

Sólo se consultan archivos al abrir el visor. La lectura envía el contexto de empresa/obra de la pantalla y mantiene la sesión y los permisos del servidor. Los endpoints manual y de procedencia WhatsApp comparan las cabeceras de contexto cuando están presentes. No sustituyen RBAC ni conceden autoridad desde datos del navegador; se conserva la compatibilidad documentada de clientes sin cabeceras.

Las referencias se limitan al recurso interno de la evidencia. El visor sólo decodifica tipos de imagen admitidos, limita la transferencia a 8 MiB y comprueba el tamaño recibido cuando hay metadatos. PDF, video u originales más grandes conservan su acceso existente, sin presentarse como imágenes. Los datos no se envían a optimizadores externos ni se agregan a la caché offline. Las URLs blob se liberan al cerrar o sustituir el visor y la lectura se cancela al desmontar.

Se conserva una sola implementación EvidenceViewer. La alternativa superpuesta se retiró sin reemplazar los cambios paralelos. La verificación detectó y corrigió un desbordamiento de 2 px a 320 px: el marco de imagen ahora incluye sus bordes dentro de su ancho.

## Pruebas y límites
Las pruebas de política/rutas usan permisos, almacenamiento y sesiones controladas. El ensayo Chrome monta componentes reales con HTTP sintético: lectura bajo demanda, contexto, tipo/tamaño, autorización denegada, imagen decodificada, zoom y ajuste, texto pendiente conservado, Escape/Tab/foco, liberación de objetos y adaptación a 320/390/768/1280 px. No equivale a certificar dispositivos físicos o todas las rutas de la plataforma.

El circuito de archivo real se prueba aparte mediante UI autenticada: PNG existente de marca identificado como ensayo, tarea demo, transferencia privada, creación de ProgressEvidence, apertura del original y decisión humana con nota de prueba. PostgreSQL permite comprobar identidad de reserva, estado, auditoría, tamaño y digest de origen. El ensayo no representa fotografía ni avance de una obra física. La aprobación de la imagen no modifica el porcentaje de su tarea.

No se prueban aquí recepción WhatsApp, llamadas de IA, cámara física ni cola offline. No se crean operarios reales ni se modifica master/producción, planes o capacidad. No hay nuevas migraciones ni proveedores. El release y las comprobaciones realmente ejecutadas quedan registrados por separado en el PR.

Referencias técnicas: documentación local de Next.js; W3C APG Dialog Modal Pattern; MDN URL.revokeObjectURL.
