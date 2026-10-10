# Presentación de identidad desde el teléfono

Desde la web, el participante activo presenta el frente del documento y una fotografía del rostro; puede agregar el dorso con su aviso y consentimiento específicos. La cámara sugerida es la trasera para el documento y la frontal para el rostro; el navegador y el dispositivo determinan si ofrecen captura directa. La persona revisa cada imagen, elige **Usar imagen revisada**, lee los avisos correspondientes y da su consentimiento antes de presentar. Otro responsable autorizado consulta todas las imágenes del conjunto y registra su decisión; el titular no puede aprobar su propia presentación.

La lectura asistida y la comparación facial privada son opcionales y requieren autorizaciones independientes. Presentar imágenes no ejecuta esos análisis ni aprueba la identidad. Las señales obtenidas no acreditan prueba de vida, autenticidad documental ni identidad civil. El dorso no se envía a OpenAI ni se usa para comparación facial.

Los nuevos desafíos de WhatsApp requieren frente, dorso y selfie, con autorización independiente del dorso y confirmación final. El participante escribe desde su propio teléfono registrado al WhatsApp receptor de la empresa. Las presentaciones y desafíos históricos conservan sus requisitos originales de dos imágenes cuando corresponda; no se agrega un dorso retroactivo ni se reemplaza un código ya preparado.

## Preparación y límites

La presentación usa el motor existente `field-media-preparation.mjs`, con un límite local de **1 MiB por imagen**. JPEG, PNG y WebP son compatibles. HEIC requiere guardar una copia JPEG desde el teléfono. El original admite hasta **20 MiB, 24 millones de píxeles y 12.000 píxeles por lado**. Se leen hasta 256 KiB de encabezado para comprobar esos límites antes de decodificar. Encabezados desconocidos, incompletos o fuera de esos límites se rechazan; una foto con encabezado válido también debe decodificarse correctamente antes de habilitar su revisión.

Si el original ya está dentro de 1 MiB y no se gira, se conserva su contenido exacto. Una foto mayor o girada se prepara como copia JPEG, con orientación aplicada y lado máximo de 2.560 píxeles. La pantalla informa los bytes de la copia y del original y la reducción real. La persona puede conservar el original mediante un enlace local; no se sobrescribe. Comprimir no garantiza que un documento se lea bien: la revisión visual explícita sigue siendo necesaria.

La web prepara copias de hasta **1 MiB por imagen**. El servidor admite hasta **2 MiB por imagen privada** y mantiene el presupuesto normal de **4 MiB por cuerpo KYC**. El endpoint de participantes admite hasta **9 MiB** sólo para una presentación válida con dorso y su consentimiento completo; no amplía el presupuesto de otros endpoints. Estos límites no cambian permisos, almacenamiento privado ni revisión humana.

## Privacidad y recuperación

Las vistas previas y el enlace al original usan URL temporales del navegador. No son enlaces públicos ni una subida automática. Se liberan al cambiar o descartar la imagen, cancelar el formulario, desmontar el contexto o perder permiso de consulta. La cancelación invalida resultados tardíos; el decodificador alternativo también revoca su URL temporal inmediatamente si se aborta.

Los archivos y las imágenes codificadas del borrador permanecen en memoria del formulario. No se guardan en localStorage ni IndexedDB. Un envío sin respuesta confirmada conserva el mismo intento en esa sesión para consultar su recibo; esa consulta no presenta otra solicitud. Recargar o cerrar la página no restaura los archivos originales ni la copia: se debe comprobar el estado canónico antes de iniciar otra presentación. No se ofrece una cola offline de documentos.

## Evidencia y límites de aceptación

Las unidades y el navegador local usan imágenes e identidades sintéticas. El navegador prueba los componentes reales, canvas nativo, encabezados y orientación EXIF, copia grande, revisión y consentimiento explícitos, cancelación, cambio de contexto, errores 401/403 y consulta del mismo recibo. Las respuestas HTTP de esos recorridos son controladas y se validan con la función canónica `participantKycInput`; no equivalen a aceptación de Clerk, almacenamiento de un documento real o aprobación humana.

Quedan por aceptar en teléfonos físicos la captura trasera/frontal, la orientación y memoria en Safari/Chrome, la legibilidad de documentos reales, los permisos del sistema y la revisión por un responsable autorizado.
