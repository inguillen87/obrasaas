# WhatsApp: de texto o transcripción a parte vinculado

## Alcance implementado
La bandeja de WhatsApp ofrece Preparar parte desde este mensaje para texto entrante operativo autorizado. Para audio, requiere una transcripción que ya figure como completada en el backend. La acción consulta nuevamente origen y permisos; no transcribe un archivo nuevo, no llama a un modelo de IA, no interpreta videos y no afirma que el canal esté habilitado por mostrar este botón.

El editor permite elegir una tarea canónica de la obra, escribir título y resumen revisado y confirmar que se verificó el contexto. Copiar el texto de origen al borrador es una acción explícita. Se crea un DailyLog en DRAFT con el autor original, fecha civil de la empresa y tarea elegida. Su revisión sigue el circuito de la bitácora existente. No se incrementa avance, no se modifican fechas, no se emiten compras ni mensajes salientes.

La vinculación al Gantt utiliza la invalidación de campo existente después de una respuesta confirmada. No se crea otro inventario de partes ni un segundo porcentaje de avance.

## Identidad, fuente y permisos
GET y POST requieren sesión, lectura de conversaciones, lectura de evidencia fuente, gestión de ejecución y lectura de tareas. Empresa, obra y actor proceden de la sesión. Las cabeceras de contexto se comparan con ella; no otorgan permisos. Se rechazan orígenes cruzados, parámetros de consulta y campos adicionales del JSON.

La fuente se resuelve por mensaje y conversación en la obra activa. Debe ser entrante, canal WhatsApp, proveedor Meta, autorizada, no simulada ni en cuarentena y con autor de la misma obra. Los reportes médicos y fuentes no utilizables se excluyen mediante la política de privacidad existente. Esto no equivale a un detector universal de datos personales.

La vista previa aplica el mismo ocultamiento de enlaces privados y credenciales de la bandeja. El resumen publicado rechaza material que esa política ocultaría, además de los contenidos médicos detectados. El mensaje original no se modifica ni se vuelca completo a la auditoría.

La huella de la fuente fija contenido, tipo, autor, fecha, zona horaria y contexto. Si cambian entre preparación y guardado, no se crea un parte a partir de una revisión obsoleta. La fecha del parte no se toma del reloj o JSON del navegador.

## Reintentos y trazabilidad
Un ID determinista por empresa/obra/conversación/mensaje impide generar varios partes del mismo origen. El recibo de creación se registra en AuditLog dentro de la misma transacción con bloqueo de proyecto. Contiene referencias y huellas, no el cuerpo ni la transcripción. La relación con la fuente es de trazabilidad auditada; no se incorpora una clave foránea nueva ni una firma certificada.

El mismo contenido puede verificarse de nuevo sin duplicar parte o auditoría, incluso desde otra sesión autorizada. Otro contenido para el mismo origen recibe un conflicto. Un reintento no revierte el estado aprobado ni recrea silenciosamente un parte eliminado. Un fallo de auditoría revierte la creación.

## Experiencia de uso
Diálogo Dark Obsidian con contexto, texto de origen separado del resumen revisado, selección de tarea, confirmación explícita y salida segura. El encabezado y la salida permanecen visibles en móvil mientras se desplaza el formulario. Se distingue texto recibido de transcripción ya procesada; un audio sin transcripción completa no ofrece una conversión ficticia.

El diálogo se aloja fuera de la lista paginada de mensajes para no desaparecer al actualizarla. Antes de salir se advierte sobre cambios locales. No hay cola offline. Ante resultado incierto se conserva la misma solicitud y clave, se bloquea la edición para verificarla sin duplicación y se ofrece copiar el borrador. Una respuesta incompleta no se presenta como éxito. Un conflicto de origen o permisos requiere revisar el estado, sin reintento automático.

## Verificación y límites
Las pruebas del dominio usan transacciones simuladas con rollback para fuente, privacidad, fecha, idempotencia, cambios posteriores, pertenencia de tarea, estado del proyecto y fallo de auditoría. Las pruebas del handler ejecutan la autorización y comparación real de contexto con sesión y dominio controlados; no sustituyen una matriz física con varios usuarios.

scripts/verify-whatsapp-report-ui.mjs monta el diálogo y lanzador reales con mensajes y HTTP sintéticos. Comprueba apertura/cancelación sin escribir, revisión humana obligatoria, texto y transcripción diferenciados, fuente ya utilizada, respuesta upstream incierta después de crear y verificación con la misma solicitud, respuesta incompleta, origen cambiado, acceso denegado y adaptación a 320/390/768/1280 px. La prueba de respuesta incierta es un HTTP 502 controlado, no una medición de pérdidas de red en celulares físicos.

Esta entrega no agrega fixtures a la base operativa, mensajes inventados a una conversación real, trabajadores, claves ni activos de Meta. La conexión WhatsApp de la obra demo sigue siendo un prerrequisito por validar: una cuenta visible o una entrega desde la consola de Meta no demuestran recepción por el backend SaaS.

## Relación con el plan maestro
Avanza el circuito del Sprint 11: mensaje de campo → registro operativo → tarea. No declara terminadas la recepción física bidireccional, la nueva transcripción de audio ni la actualización automática de avance descritas en ese sprint. El avance exige su medición y decisión correspondientes. Las fotos y audios futuros de Victoria no se han procesado ni usado para entrenamiento en este cambio.

La entrega no requiere nuevas tablas, migraciones o dependencias. Compilar, ejecutar la suite y verificar el navegador antes del commit; publicar sólo el preview de recuperación. Registrar en el PR el commit, resultados y alcance de cualquier comprobación autenticada, separado de las pruebas sintéticas.
