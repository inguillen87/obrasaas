# Almacenamiento privado de imágenes: sin degradación pública

Base: `9f553a2f62582d787a5c7c4efbcb5e57188905e0`. Se corrige el adaptador legacy `blobStorage.js`, invocado por `/api/webview/kyc`. La protección actual de páginas y APIs se mantiene; este cambio no habilita acceso empresarial ni modifica decisiones biométricas, permisos o migraciones.

## Fallo eliminado
El adaptador anterior intentaba `access: public` cuando el proveedor rechazaba el modo privado. También devolvía textos `IMAGE_PENDING_UPLOAD`/`UPLOAD_FAILED` como si fueran URLs guardadas y registraba URLs/mensajes de proveedor en consola. Ya no existe ninguna de esas salidas. Los errores de almacenamiento son tipados y opacos, con `success=false` y `verified=false` en la respuesta del handler.

## Configuración y entrada
Se exige seleccionar explícitamente `PRIVATE_MEDIA_PROVIDER=vercel-blob` y una credencial configurada, o un almacén conectado con OIDC de Vercel. Eso es presencia de configuración, no prueba de autorización de la credencial. La operación real del SDK sigue teniendo que funcionar; no hay fallback a otro proveedor o almacén público.

Antes de llamar a servicios externos se comprueba la identidad de referencia, ambas imágenes y el cuerpo JSON. Se limita cada imagen a 2 MiB y el cuerpo a 4 MiB, incluyendo streaming sin confiar en Content-Length. Base64 canónico, cabeceras JPEG/PNG/WebP y tipo declarado deben concordar. Esta comprobación de firma binaria no sustituye un decodificador de imágenes, un análisis antimalware ni verificación biométrica.

La ruta conserva su restricción y añade verificación del servicio dentro del handler antes de leer el body. El almacenamiento de ambas imágenes se confirma antes de cargar o mutar el estado de aplicación. Un fallo de Blob no puede guardarse como un placeholder en el registro.

## Privacidad, comprobación y reintento
Las rutas privadas dependen de la referencia legacy y del contenido de las dos imágenes, sin incluir el ID original o nombre de archivo. Son localizadores deterministas, no anonimización ni un mecanismo de autorización por empresa/obra. No se presenta este namespace legacy como RBAC multi-tenant.

Cada objeto se solicita exclusivamente como privado, sin sobrescritura. Se valida la identidad de la respuesta y se realiza una lectura autenticada sin caché, cotejando ruta, tipo, longitud y SHA-256 de los bytes. Un resultado público, ruta diferente, respuesta parcial o contenido cambiado se rechaza.

Si una escritura pierde su respuesta, sólo se vuelve a leer el mismo objeto privado. Un reintento idéntico reutiliza los objetos confirmados. Si falla la segunda imagen, no se devuelve un par exitoso; la primera puede quedar en el almacén para reintentar. No se borra automáticamente un objeto que otro intento concurrente podría estar usando. Blob no ofrece aquí una transacción de dos imágenes, y este bloque no implementa limpieza de huérfanos ni conciliación de archivos históricos.

No se registran imágenes, URLs privadas, IDs originales, credenciales ni errores crudos del proveedor. El acceso a los objetos sigue requiriendo autorización; devolver una URL privada a un consumidor interno no lo convierte en un visor empresarial terminado.

## Validación
Pruebas unitarias con adaptador inyectado: privado obligatorio, configuración ausente, formatos, tamaños, validación completa previa, recibos alterados, bytes alterados, concurrencia, pérdida de confirmación y fallo parcial/reintento. Recorrido construido de Next: cuatro solicitudes KYC inválidas autenticadas con credencial sintética fallan antes de contactar a IA, Blob o base, además de las denegaciones anónimas previas.

El store existente `obrasaas-private-evidence` (`store_rQqvMytLSTDWR1fp`) se inspeccionó por metadatos de Vercel: privado, disponible, región gru1 y conectado sólo a ObraSaaS en production/development. No se ha convertido el store de Preview ni usado recursos de otro producto. La inspección de metadatos no equivale a una prueba autenticada de subida/descarga con las credenciales productivas. En este bloque no se crean imágenes de prueba en ese store ni se leen archivos de clientes.

Fuentes de contrato: https://vercel.com/docs/vercel-blob/private-storage y la definición de get/put del SDK @vercel/blob instalado. La validación final de CI, SHA, despliegue y cualquier ajuste del selector se registra en el cierre de entrega; no se declara el SaaS reabierto por esta corrección.
