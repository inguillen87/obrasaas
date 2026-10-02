# Presentación de identidad desde el teléfono

El participante activo puede tomar o elegir el frente del documento y una fotografía del rostro. La cámara sugerida es la trasera para el documento y la frontal para el rostro; el navegador y el dispositivo determinan si ofrecen captura directa. La persona debe revisar la orientación y legibilidad de cada imagen, elegir **Usar imagen revisada**, leer el aviso y dar su consentimiento antes de presentar. La aprobación sigue a cargo de otra persona autorizada. No se realiza reconocimiento biométrico, prueba de vida ni aprobación automática.

## Preparación y límites

La presentación usa el motor existente `field-media-preparation.mjs`, con un límite local de **1 MiB por imagen**. JPEG, PNG y WebP son compatibles. HEIC requiere guardar una copia JPEG desde el teléfono. El original admite hasta **20 MiB, 24 millones de píxeles y 12.000 píxeles por lado**. Se leen hasta 256 KiB de encabezado para comprobar esos límites antes de decodificar. Encabezados desconocidos, incompletos o fuera de esos límites se rechazan; una foto con encabezado válido también debe decodificarse correctamente antes de habilitar su revisión.

Si el original ya está dentro de 1 MiB y no se gira, se conserva su contenido exacto. Una foto mayor o girada se prepara como copia JPEG, con orientación aplicada y lado máximo de 2.560 píxeles. La pantalla informa los bytes de la copia y del original y la reducción real. La persona puede conservar el original mediante un enlace local; no se sobrescribe. Comprimir no garantiza que un documento se lea bien: la revisión visual explícita sigue siendo necesaria.

El límite local de 1 MiB mantiene dos imágenes en un cuerpo JSON inferior a 4 MiB. El servidor conserva sus límites existentes: **2 MiB por imagen privada y 4 MiB por cuerpo KYC**. Esta mejora no eleva esos límites ni altera permisos, consentimiento, almacenamiento privado o revisión humana.

## Privacidad y recuperación

Las vistas previas y el enlace al original usan URL temporales del navegador. No son enlaces públicos ni una subida automática. Se liberan al cambiar o descartar la imagen, cancelar el formulario, desmontar el contexto o perder permiso de consulta. La cancelación invalida resultados tardíos; el decodificador alternativo también revoca su URL temporal inmediatamente si se aborta.

Los archivos y las imágenes codificadas del borrador permanecen en memoria del formulario. No se guardan en localStorage ni IndexedDB. Un envío sin respuesta confirmada conserva el mismo intento en esa sesión para consultar su recibo; esa consulta no presenta otra solicitud. Recargar o cerrar la página no restaura los archivos originales ni la copia: se debe comprobar el estado canónico antes de iniciar otra presentación. No se ofrece una cola offline de documentos.

## Evidencia y límites de aceptación

Las unidades y el navegador local usan imágenes e identidades sintéticas. El navegador prueba los componentes reales, canvas nativo, encabezados y orientación EXIF, copia grande, revisión y consentimiento explícitos, cancelación, cambio de contexto, errores 401/403 y consulta del mismo recibo. Las respuestas HTTP de esos recorridos son controladas y se validan con la función canónica `participantKycInput`; no equivalen a aceptación de Clerk, almacenamiento de un documento real o aprobación humana.

Quedan por aceptar en teléfonos físicos la captura trasera/frontal, la orientación y memoria en Safari/Chrome, la legibilidad de documentos reales, los permisos del sistema y la revisión por un responsable autorizado.
