# Importación revisada de cronogramas

El cronograma PDF o imagen se convierte en un borrador persistente dentro de la obra autorizada. La aplicación agrega las tareas revisadas al `Task` canónico que ya usa el Gantt de la cuenta. Cada tarea comienza en `BACKLOG`, con avance `0`, y guarda la referencia a la fuente y al recibo. Las tareas existentes conservan sus fechas, estado y avance. Este flujo no reemplaza un cronograma existente, no certifica avance y no crea un motor o una base paralelos.

## Permisos y decisiones

`workspace.projectOperation` verifica la sesión de producción de Clerk, pertenencia activa, organización, obra activa, alcance y asignación vigente. `ADMIN`, `DIRECTOR` y `SITE_MANAGER` pueden subir, consultar y corregir borradores. Sólo `ADMIN` y `DIRECTOR` pueden aplicar o descartar. Cada decisión exige una revisión vigente y un motivo. La interfaz exige además confirmar la revisión de la fuente, las filas y sus fechas antes de aplicar.

La fuente se registra con consentimiento `plan-document-openai-v1`, SHA-256, bytes y tipo. Los bytes del documento consentido constituyen toda la entrada de IA. No se incluye información de trabajadores ni de otros módulos. El archivo permanece privado en el adaptador Vercel Blob existente y puede descargarse sólo después de verificar nuevamente el acceso. Las respuestas públicas no exponen rutas de Blob, claves ni el lease de procesamiento.

## Límites y extracción

- PDF hasta 3 MiB; PNG, JPEG o WebP hasta 2 MiB; cuerpo multipart limitado antes de procesarlo.
- Hasta 50 tareas por fuente. Un resultado truncado o por encima del límite falla completo. La salida estructurada y cada fila se validan en el servidor.
- Inicio y fin requieren fechas calendario inequívocas. Si faltan año, escala o fechas legibles, quedan vacíos y con una observación. La aplicación queda bloqueada hasta corregir y resolver cada duda.
- La firma y el tipo del archivo se verifican como frontera de entrada. Esto no constituye una decodificación completa del PDF o imagen ni un análisis de malware. La revisión de legibilidad del proveedor y la revisión humana siguen siendo necesarias.
- El estado previo del cronograma compara hasta 5.000 tareas canónicas. Si la obra supera ese número, la operación falla completa antes del proveedor; nunca se compara una selección silenciosa.

La integración solicita el modelo `gpt-4o` ya usado por la visión del proyecto, con Responses API, archivo PDF o entrada de imagen y `json_schema` estricto. Verifica el `response.model` observado: acepta el alias `gpt-4o` o un snapshot con fecha de esa misma familia; un modelo mini, otro modelo o un valor ausente fallan. Conserva por separado el modelo solicitado y el observado en la procedencia y en la comprobación del proveedor. Solicita `store:false`, tiene tiempo y tamaño de respuesta limitados y no reintenta la solicitud de IA automáticamente. El contrato se verificó en la documentación oficial de [entradas de archivo](https://developers.openai.com/api/docs/guides/file-inputs) y [salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs).

## Persistencia, aplicación y recuperación

El `AuditLog` existente guarda la fuente, el consentimiento, el lease, la extracción original y las correcciones. Al aplicar, el bloqueo canónico de la obra serializa la decisión; el servidor revalida la revisión del borrador y la huella del cronograma completo. Un cambio concurrente del cronograma requiere generar otro borrador sobre el estado vigente. El lote de tareas y el recibo de decisión se confirman en una sola transacción. Si falla el recibo, todo el lote se revierte.

El mismo `operationId` y los mismos datos recuperan el resultado previo. La huella usa campos y filas normalizadas en orden canónico: reordenar las claves JSON mantiene el mismo recibo. Los datos cambiados con ese identificador se rechazan. Además, una fuente SHA-256 ya aplicada en esa obra se rechaza incluso con otro identificador u otro administrador. El guard se ejecuta dentro del bloqueo de proyecto; dos administradores no pueden aplicar dos lotes del mismo archivo. Este rechazo no reutiliza el recibo privado de otro actor.

`GET /api/identity/plan-import` consulta borradores o recupera un intento sin repetir IA ni escrituras. La recuperación del recibo incluye la foto de las tareas al aplicar y sus valores canónicos actuales; no revierte un avance registrado después. El navegador conserva sólo la referencia de intento y contexto en `sessionStorage`, sin bytes del archivo ni filas extraídas. Una extracción interrumpida no se reinicia automáticamente: se puede consultar y descargar su fuente confirmada y realizar un nuevo intento explícito. Un archivo ya aplicado queda protegido contra una segunda aplicación.

Después de aplicar o recuperar un recibo, la cuenta consulta nuevamente el workspace canónico para cargar juntos la primera página, el total y el cursor. No suma tareas a partir de su ausencia en la página cargada: una tarea importada puede estar fuera de las primeras 100 y ya incluida en el total. Si esta lectura falla, conserva el recibo confirmado y ofrece repetir sólo la consulta. La lectura valida obra, alcance y generación de contexto antes de mostrar el resultado.

La creación de una tarea y su recuperación después de recargar usan la misma lectura canónica, con mensajes de tarea. La recuperación general entrega el contexto de su referencia al workspace para comprobar la obra correspondiente. Mientras se consulta el cronograma, no se inicia otra creación desde el panel.

## Evidencia local

`node --test tests/production-plan-import.test.mjs` verifica entrada, consentimiento, esquema, fechas ambiguas, rechazo completo y fronteras HTTP. `scripts/verify-plan-import-postgres.mjs` exige `CUTOVER_TEST_DISPOSABLE=1` y una conexión loopback a `/obrasaas_cutover_ci`, crea una base aleatoria y elimina sólo esa base. Verifica autorización canónica, revisión editable, lote atómico, replay, fallo del recibo, cambio de cronograma, cambio de pertenencia durante IA, guard de fuente entre administradores, 50 filas completas, integridad privada y límite del cronograma existente.

`scripts/verify-plan-import-ui.mjs` monta el componente real en Next.js local y verifica consentimiento, edición, fechas dudosas, aprobación, recuperación y permisos a 320, 390, 768 y 1280 px. Sus sesiones, respuestas de IA y Blob son sintéticas. Estas pruebas no acreditan una sesión real de Clerk, una extracción real de OpenAI, almacenamiento Blob real, publicación ni aceptación de Victoria. La validación real de esos pasos debe registrarse por separado.

`scripts/verify-workspace-plan-recovery-ui.mjs` monta además `AccountWorkspace` y el panel reales a 390 y 1280 px. Comprueba un total canónico de 151 con la tarea importada fuera de la primera página, aplicación y recuperación después de recargar, paginación completa, fallo y reintento de lectura sin repetir el POST, rechazo de obra o alcance distintos y descarte de respuestas tardías al cambiar contexto o desmontar.

El mismo verifier comprueba `TaskCreatePanel` y su journal reales: recuperación desde el panel de una tarea ya incluida en el total y recuperación de un recibo tras recargar, con la tarea fuera de la primera página y total 151. La recuperación hace únicamente consultas; no vuelve a crear la tarea.

## Comprobación real del proveedor con documentos sintéticos

El prebuild incluye `scripts/verify-plan-import-live.mjs`. La comprobación requiere la opción exacta `OBRASAAS_RUN_PLAN_IMPORT_CHECK=synthetic-plan-v1`, `VERCEL_ENV=production`, el proyecto Vercel ya fijado de ObraSaaS y `NEXT_PUBLIC_APP_URL=https://obrasaas.com`. Usa la clave configurada del proyecto. Sin la opción registra `NOT_REQUESTED` y cero solicitudes; un control solicitado con contexto inválido, clave ausente, rechazo del proveedor, salida incierta o fechas/filas distintas falla con código de salida 1.

La entrada está fijada a `scripts/fixtures/plan-import-synthetic-v1.pdf` (PDF válido creado con jsPDF) y `plan-import-synthetic-v1.png` (imagen real legible del mismo Gantt). Sus hashes, tamaños y dos filas esperadas están fijados en el checker; se verifican ambos archivos antes de la primera solicitud. La prueba hace una solicitud OpenAI por formato, sin reintentos y sin entradas de usuarios. Los registros contienen sólo estado, proveedor, modelo, cantidad de filas, hashes y `syntheticOnly=true`, `businessWrites=0`. Su pase acredita esas dos extracciones sintéticas del proveedor; la revisión, aplicación y aceptación de un cronograma real siguen siendo pasos independientes.
