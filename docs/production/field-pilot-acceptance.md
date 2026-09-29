# Primer piloto de campo: identidad y medios sin resultados simulados

Pedido: probar ObraSaaS en una obra real con albañiles y encargados; el usuario facilitará el número de WhatsApp Business. Base de este corte: 8398dbe01fb9a3aa5f80f92cb82fecf54cd32699, con marca v3 restaurada. Este cambio no revierte logos, identidad personal Clerk, almacenamiento privado ni controles existentes.

## Problema encontrado antes de habilitar empleados reales
El KYC legacy convertía faltas de proveedor, resultados incompletos y datos faltantes en puntajes, DNI/CUIL, aprobación de identidad y asistencia. El camino DNI de WhatsApp también inventaba una póliza de ART y marcaba registros como verificados. No hay evidencia en esta revisión de que estos caminos hayan sido usados con personas reales; tampoco se revalidan ni corrigen silenciosamente los cinco registros históricos.

Se elimina esa autoaprobación. El endpoint antiguo de KYC mantiene autenticación de servicio, límite de cuerpo, validación privada de imágenes y verificación de enlace cuando se presenta, pero devuelve KYC_REVIEW_WORKFLOW_REQUIRED sin escribir imágenes, legajos, permisos, seguros o presentismo. Esto es una corrección de integridad, no un KYC terminado. Un flujo canónico de captura, autorización por obra y revisión humana/verificador especializado deberá sustituir el anterior antes de abrirlo a personas.

El helper facial ya no consulta un modelo de propósito general ni fabrica match/liveness; devuelve campos desconocidos y revisión requerida. Leer el texto de un DNI no autentica una persona. Una fotografía estática no es prueba de vida. `voiceEnrolled` recibido del cliente no demuestra enrolamiento de voz.

## Fotos y audios
La extracción de DNI no inventa identidad, CUIL ni porcentajes y declara EXTRACTED_UNVERIFIED. El análisis fotográfico exige una respuesta completa y una foto identificada como obra; su resultado es consejo pendiente de revisión, nunca un comprobante de archivo, aprobación de seguridad o avance confirmado. Se descartan flags arbitrarios del proveedor.

Los wrappers de audio comparten una implementación con límites, MIME/extensión coherentes, timeout, respuesta acotada, errores opacos y sin registrar transcripciones en consola. Una transcripción no identifica al hablante ni registra asistencia. Español es el valor predeterminado; inglés sólo es una opción explícita para ensayos.

No se cambió el proveedor ni los modelos existentes (gpt-4o y whisper-1). Los archivos OGG/Opus de Meta todavía necesitan aceptación con el canal real. Si el download o la transcripción falla, el webhook no procesa un comando vacío ni informa éxito; responde sin confirmación de procesamiento. La firma de ingreso previa se mantiene. El autorregistro DNI legacy se detiene, sin crear legajos ni seguros y sin borrar la inscripción pendiente.

Los flujos financieros y GPS legacy no se certifican con este cambio. El pase enterprise debe usar ámbito/actor/obra, permisos y recibos canónicos; no basta con poner una clave o el número para abrir el agregado histórico a trabajadores.

## Pruebas del corte
Pruebas de contrato e integración HTTP local: proveedor ausente, respuesta incompleta/truncada, documentos no legibles, flags inyectados, tipos/longitudes, errores de red, audio vacío, imagen irrelevante y par de imágenes válido que no puede provocar autoaprobación ni escritura. Se conservan las pruebas positivas previas del uploader privado y la suite productiva.

Ensayo opcional `OBRASAAS_RUN_PILOT_MEDIA_CHECK=synthetic-media-v1`: sólo build Production del proyecto ObraSaaS y origen propio. Hace una transcripción de un WAV sintético en inglés (Microsoft Zira, no una grabación personal) y exige reconocer "two bags" y "cement". Envía un PNG sintético que sólo contiene un rótulo de prueba a las rutas de análisis para comprobar que no se acepta como DNI/foto de obra. Usa las credenciales del build sin exportarlas; no escribe datos de negocio. Es una prueba de protocolo/modelo, no del español de campo, ruido, acentos, micrófonos ni WhatsApp. La prueba no corre por defecto.

## Cierres pendientes antes del primer piloto
1. Ingreso Clerk en el dominio propio: configurar la clave live de la instancia correcta mediante el panel seguro y probar login/logout real. La transferencia automática de ese secreto quedó bloqueada; no se elude el control ni se solicitan claves por chat.
2. Empresa y obra piloto explícitas, director/encargado designados y trabajadores invitados con roles de mínimo permiso. No reasignar las correspondencias históricas pendientes por intuición.
3. Captura de identidad con información al trabajador, almacenamiento privado y revisión auditable; la asistencia se registra por un circuito distinto, no por subir un DNI.
4. Número Business propio, WABA/phone ID, permisos y firma; luego audio español, foto, ubicación y casos de error en un teléfono real, verificando persistencia, no sólo mensajes de respuesta.
5. Recibos, permisos ajenos, reintentos, desconexión y salida de sesión: ninguna pantalla puede informar un resultado que el backend no confirmó.

El estado del piloto sigue NO ACEPTADO hasta esos recorridos. La evidencia de CI/modelos sintéticos no reemplaza la aceptación real.

Fuentes técnicas primarias consultadas: https://clerk.com/docs/guides/development/deployment/vercel ; https://developers.openai.com/api/docs/guides/images-vision ; https://developers.openai.com/api/docs/guides/speech-to-text .

El primer ensayo real confirmó la transcripción sintética pero no cerró el caso negativo de visión con un píxel. Se cambia el fixture a un rótulo PNG legible, sin documentos/personas ni obra, y se agrega el estado HTTP opaco del proveedor al diagnóstico. No se relajan las condiciones de rechazo de identidad ni se cuenta el intento incompleto como aprobado.
