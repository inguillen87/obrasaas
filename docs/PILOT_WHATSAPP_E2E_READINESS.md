# Piloto WhatsApp E2E - readiness y gates

Fecha de corte: 2026-07-26

## Decisión de canal

La vía principal es Meta WhatsApp Cloud API con el número de prueba que ofrece Meta y hasta cinco teléfonos propios registrados como destinatarios de prueba. Es la única vía que valida la arquitectura real de ObraSaaS: webhooks firmados, estados, media, plantillas, WhatsApp Flows, Data Endpoint e Embedded Signup.

Twilio Sandbox queda como fallback. El endpoint legado actual responde `410` y reactivarlo exigiría un adaptador aislado de entrada/salida, media, firmas, estados e idempotencia. Aun así, Twilio no probaría los Flows/Data Endpoints nativos de Meta, por lo que no reemplaza el piloto Meta.

Evidencia externa disponible al corte: en la cuenta Meta de ObraSaaS están presentes la app dedicada y el caso de uso WhatsApp; Meta asignó un número de prueba, se verificó un celular propio como destinatario, se generó un token temporal y Meta aceptó una solicitud outbound de plantilla. No se copian en este repositorio identificadores, teléfonos ni el valor del token.

Este resultado acredita sólo aceptación outbound en el entorno de prueba. No acredita entrega, inbound, eventos de estado, webhook firmado, Flows, aislamiento sobre un tenant real ni mensajería bidireccional end-to-end. También faltan credenciales permanentes de release gestionadas como secretos en Vercel. El token temporal debe revocarse o rotarse y sustituirse; no es una credencial apta para Preview o Production.

## Qué está implementado para probar localmente o por contrato

Las operaciones dependientes de Meta no pueden recorrerse end-to-end hasta completar H1.

- Dashboard interno: tenant, obra, cuadrilla, tareas, Gantt, Inbox, asistencia y aprobaciones.
- Operario previamente creado y ligado a su teléfono dentro de una obra.
- Entrada, pausa, regreso y salida con hora de servidor, GPS fresco, accuracy, geocerca e idempotencia.
- Recepción de texto, audio, imagen, video y documentos; media privada con SHA-256.
- Propuestas de avance por texto/audio que requieren aprobación y no reescriben el Gantt directamente.
- Vinculación desde Inbox de una foto Meta autorizada a una tarea canónica como `ProgressEvidence`, con permisos, idempotencia y revisión.
- Evaluación visual opt-in con OpenAI, rango o abstención, derivado sin metadatos y revisión humana CAS. Un smoke API controlado ya confirmó abstención ante un render BIM que no era evidencia física. Las ejecuciones `RUNNING` tienen lease persistente: un crash se recupera una sola vez a `FAILED`, queda auditado y una respuesta tardía no puede pisarlo; el reintento es explícito con otra clave.

No debe presentarse todavía como completo: la nueva cadena foto → evidencia → evaluación visual está implementada y probada localmente, pero no fue migrada ni verificada en Neon Preview ni recorrida con una foto entrante real de Meta. La ubicación sigue siendo un evento separado y no está correlacionada automáticamente con la foto; tampoco existe aún una baseline inmutable/forecast determinista derivado de la revisión. El onboarding y los destinos de cobro ya tienen servicios y API autenticada tenant-scoped, cifrado AAD, DTO enmascarado, idempotencia, CAS, permisos y decisiones maker-checker-activator auditadas. Esa persistencia todavía no fue desplegada ni verificada en una rama Neon aislada; además faltan el Flow especializado, la pantalla productiva y un proveedor confiable de titularidad bancaria.

## Hitos de prueba

### H0 - Demo interna gobernada (disponible)

Datos server-owned: empresa, obra, geocerca, horario, tareas y Carlitos precargado. Se comprueban permisos, asistencia, propuesta/aprobación, Inbox y dashboard sin proveedor externo.

### H1 - Meta test number: asistencia real básica

Evidencia parcial ya obtenida:

- app Meta y caso de uso presentes en la cuenta revisada;
- número de prueba asignado y un celular propio verificado como destinatario;
- token temporal generado y solicitud outbound de plantilla aceptada por Meta, sin que eso pruebe entrega.

Gate de salida aún pendiente:

- token temporal revocado o rotado y credenciales permanentes configuradas como secretos en Vercel;
- webhook HTTPS configurado y validado con una solicitud inbound firmada por Meta y eventos de estado reales;
- crear un Preview nuevo y comprobar que la integración Vercel-Neon genera una rama aislada, con identidad de base distinta de Production y migraciones verificadas;
- tenant, obra y trabajador reales cargados en Neon, con el teléfono normalizado y aislamiento cross-tenant probado;
- storage privado y migraciones verificadas en el ambiente del piloto;
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

- desplegar y verificar migraciones/storage en Neon Preview aislado;
- ejecutar el recorrido con inbound Meta real y observarlo en Inbox/Progreso;
- ligar una ubicación fresca al mismo contexto operacional sin inferir GPS desde metadatos de la imagen;
- definir si la selección de tarea final será Inbox, Flow o ambas, y probar reintento/offline;
- desplegar e invocar el cron autenticado de limpieza ya configurado, observar sus métricas/backlog, completar retención/purga y ejecutar smoke de descarga privada para ambos adapters de storage. Vercel sólo lo agenda automáticamente en Production; Preview requiere llamada manual;
- respetar el máximo actual de 4 MiB en rutas serverless; un piloto con archivos mayores necesita carga directa autorizada al storage, no un aumento nominal del formulario.

Estimación residual: 2 a 4 días hábiles desde H1 y un Preview con secretos/storage listos; no es una fecha hasta que esas dependencias existan.

### H3 - Onboarding simple y seguro del operario

Flujo: contacto desconocido -> cuarentena -> invitación o preautorización administrativa -> nombre/apellido y aviso de privacidad -> confirmación de obra -> aprobación -> identidad activa.

El número prueba control del canal, no identidad civil. Teléfonos compartidos o conflictos requieren revisión asistida. Nadie queda habilitado sólo por escribir "soy Carlitos".

Base local implementada: claim de un solo uso con token almacenado sólo como hash, un claim abierto por obra/remitente aun con varias conexiones, captura de identidad cifrada, revisión administrativa, enlace a `WorkerChannelIdentity`, CAS, idempotencia y ledger de decisiones. Sigue pendiente desplegar/verificar la migración y crear una sesión/Flow de onboarding ligada al claim que no presuponga un `Worker` ya existente.

Estimación: un sprint después de H2.

### H4 - Datos de cobro y comprobante

Base local ya disponible: validación estricta de CUIL, CBU, CVU y alias; consentimiento de privacidad versionado; cifrado AES-256-GCM con AAD; keyring rotatable; fingerprint HMAC por tenant; serialización enmascarada; API autenticada tenant-scoped; revisión maker-checker-activator; ledger append-only; y esquema Prisma con migraciones gobernadas. Esta base no equivale todavía a un perfil operativo: la migración no está desplegada ni verificada en Neon, el verificador bancario permanece cerrado con `503` hasta integrar un proveedor confiable de titularidad y faltan Flow/UI y comprobante privado.

Antes de producción también hay que retirar la autoridad del teléfono legado en texto plano de `Worker` mediante dual-read, backfill verificado y una fase contract que lo vuelva nullable. Durante una rotación de la clave HMAC, la API deberá buscar las huellas de ambas claves y serializar la deduplicación con una transacción/lock estable; el índice por `fingerprintKeyId` sólo evita carreras dentro de una misma clave.

El objetivo del hito es completar esos componentes y mantener los valores completos fuera de logs, snapshots, Inbox común y prompts de IA. ObraSaaS registra/exporta la instrucción inicialmente; no mueve dinero automáticamente.

El objetivo de H4 es entregar el comprobante mediante plantilla y enlace privado de corta duración; ese recorrido todavía no está implementado E2E. `DELIVERED` no equivale a firma ni conformidad.

Estimación: 1 a 2 sprints, condicionada a revisión laboral, privacidad, retención y proveedor de firma.

### H5 - Visión con revisión humana + escenario Gantt

La IA describe el elemento (por ejemplo, mampostería parcial), propone un rango de avance, confianza, evidencia y abstención. Nunca certifica ni cambia el cronograma por sí sola. El Director aprueba/corrige y recién entonces se genera un escenario de forecast; la baseline permanece inmutable.

Base local completada: modelo Prisma/migración gobernados, provider registry, adaptador OpenAI Responses, sanitización binaria/EXIF, tenant opt-in con CAS entre administradores, recheck de suscripción/autorización en la última frontera, rutas idempotentes, un solo análisis abierto por evidencia, estados de fallo seguros y revisión humana CAS. Una lectura obsoleta puede rechazarse con trazabilidad para liberar un intento nuevo. El smoke API controlado con `gpt-5.6-sol` se abstuvo correctamente frente a un render BIM y no inventó avance. Qwen3-VL y GLM-5V son challengers visuales; GLM-OCR y GLM-5.2 son especialistas OCR/texto, y GLM-5.2 nunca recibe fotos. HF/Z.ai sólo tienen pruebas de contrato.

Gate pendiente: migración/Preview, foto Meta real, UI/journey E2E, dataset y benchmark calibrado, observabilidad de costo/latencia, controles de datos/DPA/retención del proveedor y motor de escenario sobre baseline inmutable. `store:false` no equivale a ZDR y `detail:original` requiere opt-in justificado. La revisión visual actual no muta `Task` ni crea todavía el forecast, deliberadamente.

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
