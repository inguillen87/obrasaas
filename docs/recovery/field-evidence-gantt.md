# Evidencia de campo y Gantt: una lectura coherente

## Entrega y fuentes
Se integra /api/schedule/field-status al cronograma existente. Lee tareas canónicas, ProgressEvidence, DailyLog y, sólo con permiso y membresía, TaskProgressMeasurementBalance. No crea otro sistema de avance ni modifica Task.progress, fechas, dependencias, líneas base, pagos o certificados.

El esquema de mediciones establece que su proyección cuantitativa está separada del porcentaje operativo de Task. La interfaz conserva esa separación: muestra avance operativo y avance medido aprobado, con cantidades, unidad y revisión. El porcentaje medido usa la aritmética decimal existente; no se infiere de contar fotos ni se redondea un 99.9999% a 100%.

El alcance coincide con la intención del plan maestro de conectar medios de terreno con tareas y Gantt. La existencia del plan no se usa como prueba de integración completada de WhatsApp o de análisis automático de todos los formatos.

## Circuito visible
Cada tarea del Gantt muestra sus partes/evidencias y, cuando existe una medición aprobada accesible, su porcentaje medido. El panel Campo → Evidencia → Avance reúne conteos de captura y revisión, fecha de verificación y acceso al registro de origen. Sus totales se limitan a la página de hasta 50 tareas: no se presentan como totales globales. Los partes sin tarea se informan aparte, sin asignarlos por inferencia.

Desde una evidencia se puede abrir su tarea en el cronograma y sus mediciones existentes. El enlace inverso abre la bitácora filtrada por esa tarea, resuelta en servidor en la obra activa. La recarga y paginación conservan el filtro. La evidencia y las evaluaciones visuales existentes continúan con sus permisos y decisiones humanas.

## Actualización automática, no publicidad de latencia cero
La consulta se renueva cada 10 segundos mientras el panel está visible y en línea. Errores temporales aumentan el intervalo hasta 60 segundos. Entre pestañas del mismo origen, una escritura confirmada publica una invalidación sin contenido privado: el receptor vuelve a consultar su backend autorizado. No se comparte ni se toma como autoridad un porcentaje, imagen o registro enviado por otra pestaña.

El ETag evita reenviar el cuerpo cuando no cambió, pero cada petición vuelve a autorizar y comprobar los datos. No es caché compartida. Cambio de contexto, pérdida de acceso o recurso no disponible retiran la instantánea y detienen la consulta desde esa instancia. Fallos temporales distinguen información anterior de una verificación vigente.

Esto es polling acotado con aceleración entre pestañas, no push de servidor entre dispositivos ni un SLO de tiempo real certificado. No se agregan WebSockets, proveedores pagos o procesos 24/7. Una evolución a gran escala requerirá medir carga y sustituir el sondeo por un canal de eventos duradero, preservando estas comprobaciones.

## Seguridad y consistencia
Las cabeceras de contexto son condiciones comparadas con la sesión, no autoridad. Se exigen permisos de tareas y ejecución antes de Prisma. La lectura de cantidades requiere además membresía y permiso de mediciones. Las consultas de datos se limitan a empresa/obra/tareas visibles y usan una transacción RepeatableRead. No se devuelven nombres de empleados, mensajes, rutas de archivos privados ni descripciones de evidencias en este canal.

La selección de un recurso de otra obra no recae en la primera tarea. Los endpoints de archivos y mediciones conservan sus controles independientes. No se cambian los requisitos maker-checker de las mediciones ni se convierte una aprobación de imagen en certificación de cantidad.

## Verificación
Pruebas de dominio: aislamiento, consulta acotada, agregación por tarea, balance decimal, medición sobre base rechazada, ausencia de datos, identidad de respuesta y ninguna escritura. Pruebas del handler: permisos, contexto obligatorio, 304 con reautorización, acceso revocado, filtros inválidos y mensajes de error sin datos internos. Contratos del filtro de bitácora y enlaces cruzados.

scripts/verify-field-gantt-ui.mjs monta el panel y Gantt reales con HTTP sintético. Comprueba una invalidación desde otra pestaña, rechazo de señal de otra empresa, una actualización posterior mediante sondeo, avance medido distinto del operativo, respuestas condicionales, retirada de la capa al revocar acceso y reflow a 320/390/768/1280 px. No es una medición de latencia entre celulares físicos ni una prueba productiva de roles diferentes.

## Próximos cierres del mismo circuito
1. Canal Meta de la app ObraSaaS: recepción firmada y durable, identidad de remitente, empresa/obra y tarea correctas; prueba bidireccional del backend, no sólo envíos desde consola.
2. Audios: transcripción real con fuente conservada, selección de tarea y propuesta estructurada; confirmar cantidades y fechas ambiguas antes de modificar avance.
3. Imágenes: usar la evaluación visual existente con contexto y revisión humana, sin introducir porcentajes ficticios. Conservar abstención, versión de modelo y procedencia.
4. Videos: carga privada, límites y extracción controlada de fotogramas; no afirmar que cada video ya se analiza íntegramente. Su evidencia vinculada sí puede aparecer en el estado de campo una vez persistida.
5. Cronograma: cálculo determinista del pronóstico con observaciones revisadas y duración restante; la línea base publicada se mantiene. El progreso técnico se obtiene de las mediciones autorizadas, no de premiar cantidad de archivos.
6. Tiempo real y offline: medir carga y latencia, agregar entrega durable de eventos y cola offline por identidad/obra con reintentos idempotentes, sin reenviar acciones a otra sesión.

Los medios que envíe Victoria se tratarán como evidencia privada con contexto y validación; no como entrenamiento automático ni como autorización para alterar una línea base. No se incorporaron personas, credenciales, datos de otra aplicación ni imágenes externas en esta entrega.
