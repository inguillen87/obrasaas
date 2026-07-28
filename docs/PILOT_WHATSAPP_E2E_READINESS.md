# Piloto WhatsApp E2E - readiness y gates

Fecha de corte: 2026-07-28

## Estado operativo del corte

- La rama `codex/platform-ux-foundation` usa una rama Neon aislada y ya recorrió las migraciones anteriores y sus verificadores PostgreSQL. La migración H3.1 está agregada localmente pero aún no fue desplegada ni verificada allí; Production no fue modificada.
- El importador Meta está apagado para Preview global y habilitado sólo en esta rama. Su allowlist, token de verificación del webhook y secretos de IA están limitados a la misma rama.
- Falta ingresar `META_APP_SECRET`, generar un token temporal nuevo en Meta, redesplegar y mover el dominio estable de Preview al despliegue actual. El panel de Meta mantiene una reautenticación humana pendiente; ninguna contraseña se captura ni automatiza.
- Después de ese redespliegue todavía hay que crear o seleccionar un tenant externo con obra, administrador no-superadmin y operario preautorizado. Un contacto desconocido continúa en cuarentena y no se auto-habilita por declarar un nombre.
- El primer smoke real habilitable es H1: plantilla outbound, respuesta inbound, estados, webhook firmado y asistencia con ubicación. H2 agrega foto privada y comentario. H5 no se considera cerrado hasta recorrer en UI una baseline ya inmutable, generar un forecast revisado y mostrar sus deltas Gantt; el motor determinista ya está entregado, pero no se acopla automáticamente a una foto.

## Decisión de canal

La vía principal es Meta WhatsApp Cloud API con el número de prueba que ofrece Meta y un celular propio habilitado como destinatario de prueba. Es la única vía que valida la arquitectura real de ObraSaaS: webhooks firmados, estados, media, plantillas, WhatsApp Flows, Data Endpoint e Embedded Signup. La cantidad concreta de destinatarios que muestre el panel se trata como una condición de esa cuenta, no como una garantía contractual fija de Meta.

Twilio Sandbox queda como fallback. El endpoint legado actual responde `410` y reactivarlo exigiría un adaptador aislado de entrada/salida, media, firmas, estados e idempotencia. Aun así, Twilio no probaría los Flows/Data Endpoints nativos de Meta, por lo que no reemplaza el piloto Meta.

Evidencia externa disponible al corte: en la cuenta Meta de ObraSaaS están presentes la app dedicada y el caso de uso WhatsApp; Meta asignó un número de prueba y se verificó un celular propio como destinatario. Una ejecución histórica generó un token temporal y Meta aceptó una solicitud outbound de plantilla. El panel actual exige generar una credencial temporal nueva; la anterior no se considera reutilizable. No se copian en este repositorio identificadores, teléfonos ni valores secretos.

Ese resultado histórico acredita sólo aceptación outbound en el entorno de prueba. No acredita entrega, inbound, eventos de estado, webhook firmado, Flows, aislamiento sobre un tenant real ni mensajería bidireccional end-to-end. Para el piloto aislado se admite un token temporal recién generado, guardado como secreto y con vencimiento operativo explícito; para una liberación sostenida se exige un System User token con permisos mínimos y rotación gestionada. Ninguna credencial temporal se considera apta para Production.

## Qué está implementado para probar localmente o por contrato

Las operaciones dependientes de Meta no pueden recorrerse end-to-end hasta completar H1.

- Dashboard interno: tenant, obra, cuadrilla, tareas, Gantt, Inbox, asistencia y aprobaciones.
- Operario previamente creado y ligado a su teléfono dentro de una obra.
- Entrada, pausa, regreso y salida con hora de servidor, GPS fresco, accuracy, geocerca e idempotencia.
- El pin de ubicación enviado como mensaje de WhatsApp no incluye una precisión confiable y no se acepta como presencia verificada. El ingreso/salida usa un enlace seguro ligado a la operación para obtener una lectura puntual con `accuracy` y `capturedAt`; la geocerca aporta evidencia de plausibilidad, no triangulación criptográfica ni prueba de quién sostiene el dispositivo.
- Recepción de texto, audio, imagen, video y documentos; media privada con SHA-256.
- Propuestas de avance por texto/audio que requieren aprobación y no reescriben el Gantt directamente.
- Respuestas automáticas con claim y settlement durables, correlación exacta por tenant/obra/conexión/remitente y política anti-duplicado: un intento ambiguo queda `unknown` y requiere revisión humana, nunca auto-reenvío.
- Vinculación desde Inbox de una foto Meta autorizada a una tarea canónica como `ProgressEvidence`, con permisos, idempotencia y revisión.
- Evaluación visual opt-in con un adapter de Vision, rango o abstención, derivado sin metadatos y revisión humana CAS. OpenAI es el candidato primario y una ejecución histórica controlada confirmó abstención ante un render BIM que no era evidencia física; no se reactiva ninguna llamada hasta elegir una clave de piloto. Las ejecuciones `RUNNING` tienen lease persistente: un crash se recupera una sola vez a `FAILED`, queda auditado y una respuesta tardía no puede pisarlo; el reintento es explícito con otra clave.
- H3.1 local: invitación desde Inbox, Flow y sesión pre-operario, aviso fijado en `INIT`, submit autenticado, acuse terminal, readiness fail-closed, cola CRM, decisión administrativa y purga del claim transitorio.

No debe presentarse todavía como completo: la nueva cadena foto → evidencia → evaluación visual está implementada, probada y sus migraciones se verificaron en la rama Neon aislada del Preview, pero todavía no fue recorrida con una foto entrante real de Meta. La ubicación sigue siendo un evento separado y no está correlacionada automáticamente con la foto; baseline inmutable y forecast determinista existen, pero una revisión visual no los muta ni los invoca automáticamente. H3.1 ya incluye localmente el Flow especializado y la pantalla CRM, pero su migración/deploy de Preview y el E2E de Meta siguen pendientes. Los destinos de cobro conservan su base cifrada y auditada, pero aún requieren su Flow/UI, comprobante privado y un proveedor confiable de titularidad bancaria.

## Hitos de prueba

### H0 - Demo interna gobernada (disponible)

Datos server-owned: empresa, obra, geocerca, horario, tareas y Carlitos precargado. Se comprueban permisos, asistencia, propuesta/aprobación, Inbox y dashboard sin proveedor externo.

### H1 - Meta test number: asistencia real básica

Evidencia parcial ya obtenida:

- app Meta y caso de uso presentes en la cuenta revisada;
- número de prueba asignado y un celular propio verificado como destinatario;
- una prueba histórica generó un token temporal y Meta aceptó una solicitud outbound de plantilla, sin que eso pruebe entrega ni que esa credencial siga vigente;
- rama Neon aislada creada y migraciones anteriores verificadas contra PostgreSQL; la migración H3.1 queda fuera de esa evidencia hasta ejecutar su `migrate deploy` y verificador;
- flags y allowlist del importador limitados únicamente a `codex/platform-ux-foundation`; el flag global de Preview permanece desactivado.

Gate de salida aún pendiente:

- App Secret y un token temporal nuevo configurados como secretos exclusivos de la rama; para Production, reemplazarlos por credenciales permanentes de System User;
- webhook HTTPS configurado y validado con una solicitud inbound firmada por Meta y eventos de estado reales;
- redesplegar el Preview con las variables finales y apuntar el dominio estable de prueba a ese despliegue, sin mover Production;
- tenant externo, obra, administrador no-superadmin y trabajador de prueba cargados en Neon, con el teléfono normalizado y aislamiento cross-tenant probado;
- storage privado recorrido con media entrante real en el ambiente del piloto;
- inbound, outbound correlacionado, estados, retry y ambos Flows probados end-to-end;
- ingreso, almuerzo, regreso y salida visibles en dashboard.

Estimación condicional: 2 a 4 días hábiles desde que las credenciales permanentes, Vercel y el tenant real del piloto estén disponibles. Esta prueba no incluye foto de asistencia, autoalta, cobro ni IA visual.

### H2 - Foto + comentario + GPS como evidencia canónica

Base local completada:

- imagen de WhatsApp almacenada de forma privada;
- caption/comentario conservado con la evidencia;
- selector de tarea canónica en Inbox con permisos mínimos;
- creación idempotente de `ProgressEvidence`, integridad SHA-256 y pruebas de replay/cross-tenant;
- revisión humana en Progreso y entrega privada server-side de la fuente Meta.
- las subidas desde dashboard usan una reserva server-owned de un solo uso y sólo exponen `uploadId`; la evidencia Meta permanece anclada al mensaje y a la conexión autorizados.

Gate de salida aún pendiente:

- redesplegar el Preview final y recorrer storage con una imagen Meta real; el esquema y las migraciones ya están verificados en Neon aislado;
- ejecutar el recorrido con inbound Meta real y observarlo en Inbox/Progreso;
- ligar una ubicación fresca al mismo contexto operacional sin inferir GPS desde metadatos de la imagen;
- definir si la selección de tarea final será Inbox, Flow o ambas, y probar reintento/offline;
- desplegar e invocar el cron autenticado de limpieza ya configurado, observar sus métricas/backlog, completar retención/purga y ejecutar smoke de descarga privada para ambos adapters de storage. Vercel sólo lo agenda automáticamente en Production; Preview requiere llamada manual;
- respetar el máximo actual de 4 MiB en rutas serverless; un piloto con archivos mayores necesita carga directa autorizada al storage, no un aumento nominal del formulario.

Estimación residual: 2 a 4 días hábiles desde H1 y un Preview con secretos/storage listos; no es una fecha hasta que esas dependencias existan.

### H3 - Onboarding simple y seguro del operario

Flujo: contacto desconocido -> cuarentena -> invitación o preautorización administrativa -> nombre/apellido y aviso de privacidad -> confirmación de obra -> aprobación -> identidad activa.

El número prueba control del canal, no identidad civil. Teléfonos compartidos o conflictos requieren revisión asistida. Nadie queda habilitado sólo por escribir "soy Carlitos".

Base H3.1 implementada y probada localmente: claim de un solo uso con token almacenado sólo como hash, un claim abierto por obra/remitente aun con varias conexiones, captura de identidad cifrada, sesión/Flow pre-operario que no presupone un `Worker`, submit autenticado, acuse terminal exacto, readiness fail-closed, cola CRM, revisión administrativa, enlace a `WorkerChannelIdentity`, CAS, idempotencia y ledger de decisiones.

`privacyPresentedAt` demuestra que el Data Endpoint sirvió `INIT` con la versión fijada del aviso; no demuestra lectura ni comprensión humana. El aviso y el circuito laboral requieren revisión legal antes de probar con trabajadores reales.

La expiración/purga periódica elimina el bundle sensible del claim transitorio y deja auditoría sin PII. No es un DSAR integral: `WorkerPerson`, `WorkerChannelIdentity`, `Worker`, conversaciones, mensajes y backups quedan para otro sprint. `Conversation.externalId` todavía conserva internamente el teléfono raw y es deuda de privacidad pendiente.

Gate de salida: ejecutar migración y verificador H3.1 en Preview, desplegar y observar el cron, completar la revisión legal y recorrer invitación → Flow → acuse → CRM → decisión con Meta real. Hasta entonces H3 sigue **en progreso**.

### H4 - Datos de cobro y comprobante

Base ya disponible: validación estricta de CUIL, CBU, CVU y alias; consentimiento de privacidad versionado; cifrado AES-256-GCM con AAD; keyring rotatable; fingerprint HMAC por tenant; serialización enmascarada; API autenticada tenant-scoped; revisión maker-checker-activator; ledger append-only; y esquema Prisma con migraciones gobernadas y verificadas en Neon aislado. Esta base no equivale todavía a un perfil operativo: el verificador bancario permanece cerrado con `503` hasta integrar un proveedor confiable de titularidad y faltan Flow/UI y comprobante privado.

Antes de producción también hay que retirar la autoridad del teléfono legado en texto plano de `Worker` mediante dual-read, backfill verificado y una fase contract que lo vuelva nullable. Durante una rotación de la clave HMAC, la API deberá buscar las huellas de ambas claves y serializar la deduplicación con una transacción/lock estable; el índice por `fingerprintKeyId` sólo evita carreras dentro de una misma clave.

El objetivo del hito es completar esos componentes y mantener los valores completos fuera de logs, snapshots, Inbox común y prompts de IA. ObraSaaS registra/exporta la instrucción inicialmente; no mueve dinero automáticamente.

El objetivo de H4 es entregar el comprobante mediante plantilla y enlace privado de corta duración; ese recorrido todavía no está implementado E2E. `DELIVERED` no equivale a firma ni conformidad.

Estimación: 1 a 2 sprints, condicionada a revisión laboral, privacidad, retención y proveedor de firma.

### H5 - Visión con revisión humana + escenario Gantt

La IA describe el elemento (por ejemplo, mampostería parcial), propone un rango de avance, confianza, evidencia y abstención. Nunca certifica ni cambia el cronograma por sí sola. El Director aprueba/corrige y recién entonces se genera un escenario de forecast; la baseline permanece inmutable.

Base local completada: modelo Prisma/migración gobernados, provider registry, adaptador OpenAI Responses, sanitización binaria/EXIF, tenant opt-in con CAS entre administradores, recheck de suscripción/autorización en la última frontera, rutas idempotentes, un solo análisis abierto por evidencia, estados de fallo seguros y revisión humana CAS. Una lectura obsoleta puede rechazarse con trazabilidad para liberar un intento nuevo. Una ejecución histórica controlada con `gpt-5.6-sol` se abstuvo correctamente frente a un render BIM y no inventó avance; las llamadas siguen deshabilitadas hasta que se decida la credencial de piloto. Qwen3-VL y GLM-5V son challengers visuales; GLM-OCR y GLM-5.2 son especialistas OCR/texto, y GLM-5.2 nunca recibe fotos. HF/Z.ai sólo tienen pruebas de contrato.

Gate pendiente: cerrar smoke UI de baseline/forecast en Preview, elegir credencial de Vision, foto Meta real, UI/journey E2E, dataset y benchmark calibrado, observabilidad de costo/latencia y controles de datos/DPA/retención del proveedor. El esquema y las migraciones visuales ya fueron verificados en Neon aislado. `store:false` no equivale a ZDR y `detail:original` requiere opt-in justificado. La revisión visual actual no muta `Task` ni crea todavía el forecast, deliberadamente.

Contrato técnico y benchmark: [AI_VISUAL_EVALUATION.md](./AI_VISUAL_EVALUATION.md).

Estimación: prototipo controlado en un sprint; nivel productivo comparables con líderes del mercado requiere 2 a 4 sprints adicionales para dataset, ground truth, evaluación por tipología, observabilidad y criterios de abstención.

### H6 - Piloto integral por roles

Operario real + administrativo + Director + cliente externo con permisos mínimos, reporte semanal reproducible, asistencia, evidencia, forecast, comprobantes, alertas, degradación de proveedor, restore y pruebas cross-tenant.

Ventana honesta: 6 a 10 semanas de trabajo focalizado desde H1, siempre que Meta, credenciales, revisión legal y proveedores no bloqueen gates. No se anuncia como listo antes de completar H5.

## Escenario de aceptación del piloto

Este es el recorrido objetivo de aceptación H6; los pasos de forecast y comprobante no están disponibles hoy.

1. El administrativo crea la empresa, obra, geocerca, horario y tareas.
2. Invita a Carlitos y aprueba su identidad de canal.
3. Carlitos escribe desde su WhatsApp y el sistema lo reconoce sólo dentro de esa obra.
4. Registra entrada con GPS fresco; fuera de geocerca queda en revisión, no como presencia verificada.
5. Envía una foto y comentario; la evidencia queda privada y ligada a una tarea.
6. IA propone descripción/rango con posibilidad de abstenerse.
7. Director aprueba/corrige; se crea un escenario, no se reescribe la baseline.
8. Dashboard e Inbox reflejan cada estado y su auditoría.
9. El pago se registra por circuito autorizado y Carlitos recibe un enlace privado al comprobante si dio opt-in.
10. El cliente sólo ve artefactos publicados y nunca datos laborales/bancarios del operario.
