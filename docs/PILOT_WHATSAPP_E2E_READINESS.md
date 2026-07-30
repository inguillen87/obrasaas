# Piloto WhatsApp E2E - readiness y gates

Fecha de corte: 2026-07-29

## Estado operativo del corte

- La rama `codex/platform-ux-foundation` usa una rama Neon aislada. El Preview nativo de Git para `0a00f37` quedó `Ready`, detectó 100 migraciones sin pendientes, aprobó los verificadores de media/IA y recibió el alias estable ([evidencia](./evidence/2026-07-29-preview-0a00f37.md)). No hubo deployment ni migración de aplicación en Production durante este corte; subsiste el incidente de posible sincronización de membresía por el webhook compartido de Clerk development ([evidencia](./evidence/2026-07-28-preview-c91cee0.md)).
- El importador Meta está apagado para Preview global y habilitado sólo en esta rama. Su allowlist, token de verificación del webhook y secretos de IA están limitados a la misma rama.
- El alias estable `https://obrasaas-preview.vercel.app` apunta a un redeploy `Ready`; `/privacy`, home y los rechazos fail-closed del webhook/cron respondieron correctamente. `META_APP_SECRET` ya está configurado como secreto exclusivo de la rama. El test oficial `messages v25.0` de Meta produjo un `POST /api/webhooks/whatsapp` 200; el payload de ejemplo fue rechazado internamente como conexión desconocida, que es el aislamiento esperado y evita contaminar un tenant.
- La app Meta continúa **sin publicar** y el negocio figura **no verificado**; el botón de publicación está deshabilitado. Esa verificación empresarial, la revisión/acceso que Meta aplique y la publicación son hoy el bloqueo externo exacto para inbound real. La documentación societaria debe ingresarla el titular autorizado, no el agente.
- El tenant externo y la obra piloto ya existen en Preview. Todavía hay que cargar un administrador no-superadmin, un operario preautorizado, importar la conexión Meta y completar el aislamiento cross-tenant. Un contacto desconocido continúa en cuarentena y no se auto-habilita por declarar un nombre.
- El primer smoke real habilitable es H1: plantilla outbound, respuesta inbound, estados, webhook firmado y asistencia con ubicación reportada por el dispositivo. H2 se activa únicamente para una imagen Meta cuyo comentario no vacío comienza con `AVANCE:` o `PROGRESO:`; liga el asset exacto del webhook a una opción de geolocalización puntual o a un opt-out explícito. Esa lectura no garantiza GPS, identidad ni presencia física. H4 (datos de cobro y comprobante) y H5 (revisión visual → observación inmutable → forecast/Gantt) siguen pendientes como journeys E2E, aunque H5 ya cuenta con cierre local por contrato y pruebas.

## Decisión de canal

La vía principal es Meta WhatsApp Cloud API con el número de prueba que ofrece Meta y un celular propio habilitado como destinatario de prueba. Es la única vía que valida la arquitectura real de ObraSaaS: webhooks firmados, estados, media, plantillas, WhatsApp Flows, Data Endpoint e Embedded Signup. La cantidad concreta de destinatarios que muestre el panel se trata como una condición de esa cuenta, no como una garantía contractual fija de Meta.

Twilio Sandbox queda como fallback. El endpoint legado actual responde `410` y reactivarlo exigiría un adaptador aislado de entrada/salida, media, firmas, estados e idempotencia. Aun así, Twilio no probaría los Flows/Data Endpoints nativos de Meta, por lo que no reemplaza el piloto Meta.

Evidencia externa disponible al corte: en la cuenta Meta de ObraSaaS están presentes la app dedicada y el caso de uso WhatsApp; Meta asignó un número de prueba, se verificó un celular propio como destinatario y el panel generó una credencial temporal. Además del outbound histórico aceptado, el test oficial del webhook `messages v25.0` llegó al Preview con HTTP 200. La credencial temporal no está documentada ni se considera importada en un tenant hasta completar el flujo cifrado de Integraciones. No se copian en el repositorio Meta App/WABA/Phone IDs, teléfonos ni valores secretos; los documentos de evidencia sí conservan SHA, URLs e identificadores técnicos no secretos necesarios para reproducibilidad.

La evidencia actual acredita aceptación outbound histórica y recepción de un test oficial firmado en el endpoint correcto. No acredita entrega al celular, inbound real, eventos de estado, Flows, aislamiento sobre un tenant conectado ni mensajería bidireccional end-to-end. Para el piloto aislado se admite un token temporal recién generado, persistido cifrado por conexión desde Integraciones y con vencimiento operativo explícito; para una liberación sostenida se exige un System User token con permisos mínimos y rotación gestionada. Ninguna credencial temporal se considera apta para Production.

## Qué está implementado para probar localmente o por contrato

Las operaciones dependientes de Meta no pueden recorrerse end-to-end hasta completar H1.

- Dashboard interno: tenant, obra, cuadrilla, tareas, Gantt, Inbox, asistencia y aprobaciones.
- Operario previamente creado y ligado a su teléfono dentro de una obra.
- Entrada, pausa, regreso y salida con hora de servidor, lectura puntual de geolocalización reportada por el dispositivo, `accuracy`, geocerca e idempotencia.
- El pin de ubicación enviado como mensaje de WhatsApp no incluye una precisión confiable y no se acepta como presencia verificada. El ingreso/salida usa un enlace seguro ligado a la operación para obtener una lectura puntual con `accuracy` y `capturedAt`; la API del navegador no garantiza que el sensor utilizado sea GPS y la geocerca aporta evidencia de plausibilidad, no triangulación criptográfica ni prueba de quién sostiene el dispositivo.
- Recepción de texto, audio, imagen, video y documentos; media privada con SHA-256.
- Propuestas de avance por texto/audio que requieren aprobación y no reescriben el Gantt directamente.
- Respuestas automáticas con claim y settlement durables, correlación exacta por tenant/obra/conexión/remitente y política anti-duplicado: un intento ambiguo queda `unknown` y requiere revisión humana, nunca auto-reenvío.
- Sólo una imagen Meta de un remitente ya autorizado, no clasificada como médica y con comentario explícito `AVANCE: ...` o `PROGRESO: ...` crea la sesión H2. La sesión queda vinculada en la misma transacción al `WhatsAppMediaAsset` exacto del webhook; no se correlaciona por tiempo, texto similar, URL, EXIF ni un asset indicado por el cliente.
- La respuesta durable conserva únicamente un descriptor `{ version, sessionId }`, nunca el bearer ni el enlace. Después de ganar el claim de envío, el worker revalida tenant/obra/conexión/operario/asset y reconstruye el enlace sólo en memoria. Si la sesión venció o no conserva vigencia suficiente, envía un fallback sin token ni URL y deja la foto disponible sin ubicación.
- El bearer viaja en el fragmento `#token=...`, que el navegador elimina con `history.replaceState` antes del `INIT`; no llega al request target, Server Component, referrer ni logs del servidor. La webview no usa `sessionStorage`: conserva el intento exacto sólo en memoria de la pestaña, lo purga al vencer y vuelve a conciliar el estado con `INIT` después de una recarga.
- La webview ofrece consentimiento específico o `Continuar sin ubicación`. La cancelación usa CAS `AWAITING_LOCATION → CANCELLED`, no persiste coordenadas y no descarta la foto. Una captura aceptada conserva `accuracy` y `capturedAt`; una lectura fuera de radio o sin geocerca exige revisión. El dashboard no expone coordenadas por defecto y ninguna lectura se presenta como GPS garantizado, identidad o asistencia.
- Vinculación desde Inbox de la foto Meta autorizada a una tarea canónica como `ProgressEvidence`, con permisos, idempotencia, consumo atómico de la captura opcional y revisión.
- Evaluación visual opt-in con un adapter de Vision, rango o abstención, derivado sin metadatos y revisión humana CAS. La clave dedicada de OpenAI ya fue elegida y aislada. El `AI Dispatch Plan` selecciona una sola ruta, reserva presupuesto diario antes de leer bytes y registra ruta/tokens/costo. La respuesta se conserva primero como recibo canónico inmutable: un crash posterior se reanuda sin reenviar la foto. Una falla pre-request libera la reserva; usage ausente o una salida post-request incierta conservan el bloqueo hasta conciliación para evitar cobro duplicado. El esquema y presupuesto piloto ya están en Preview, pero eso no habilita todavía fotos reales.
- H3.1: invitación desde Inbox, Flow y sesión pre-operario, aviso fijado en `INIT`, submit autenticado, acuse terminal, readiness fail-closed, cola CRM, decisión administrativa y purga del claim transitorio, con código/pruebas locales y migraciones verificadas en Neon Preview.

No debe presentarse todavía como completo: la cadena H2 local foto → opción de geolocalización u opt-out → evidencia está implementada por contrato y pruebas, pero las migraciones `20260729100000_progress_evidence_location_capture` y `20260729110000_progress_evidence_location_rate_limit` aún no fueron aplicadas en Neon Preview y no se recorrió una foto entrante real de Meta ni mensajería bidireccional E2E sobre el tenant. La geolocalización corrobora contexto; puede falsificarse y no prueba identidad ni presencia física. H5 ya conecta localmente una revisión humana aprobada/corregida con una observación append-only y un forecast determinista visible contra la baseline; no lo hace automáticamente ni muta el plan. Su migración y journey autenticado todavía no fueron verificados en Preview. H3.1 ya incluye el Flow especializado y la pantalla CRM; siguen pendientes el smoke UI/runtime, observar el cron y el E2E de Meta. H4 ya incorpora localmente un caller inbound fail-closed que emite sesión base/companion en la transacción del webhook, además del reconciliador DB-only y auditado para el único caso recuperable `UNCERTAIN → SUCCEEDED`, sin reejecutar el bridge ni un proveedor; todavía faltan cutover legacy coordinado, PostgreSQL real/Neon Preview, build H4 verificado en Vercel Preview, publicación/Meta E2E, comprobante privado y proveedor confiable de titularidad bancaria.

## Hitos de prueba

### H0 - Demo interna gobernada (disponible localmente; Preview parcial)

Datos server-owned: empresa, obra, geocerca, horario, tareas y operario de prueba precargado. Localmente se comprueban permisos, asistencia, propuesta/aprobación, Inbox y dashboard sin proveedor externo; el journey equivalente todavía no fue certificado completo en Preview.

### H1 - Meta test number: asistencia real básica

Evidencia parcial ya obtenida:

- app Meta y caso de uso presentes en la cuenta revisada;
- número de prueba asignado y un celular propio verificado como destinatario;
- una prueba histórica generó un token temporal y Meta aceptó una solicitud outbound de plantilla, sin que eso pruebe entrega ni que esa credencial siga vigente;
- `META_APP_SECRET` configurado en la rama Preview y test oficial `messages v25.0` recibido con HTTP 200 y aislamiento correcto del payload ficticio;
- rama Neon aislada creada; el Preview de `d6b29b9` detectó 97 migraciones, aplicó las dos nuevas y completó todos sus verificadores, con build remoto `Ready`;
- flags y allowlist del importador limitados únicamente a `codex/platform-ux-foundation`; el flag global de Preview permanece desactivado.

Gate de salida aún pendiente:

- completar la verificación empresarial y los requisitos de acceso/revisión de Meta hasta poder publicar la app;
- importar el token temporal desde Integraciones dentro de la conexión cifrada del tenant piloto; para Production, reemplazarlo por una credencial permanente de System User;
- validar challenge y recibir una solicitud **real** firmada por Meta más eventos de estado correlacionados; el test oficial de panel ya pasó, pero no reemplaza tráfico real;
- usar el tenant y la obra piloto ya creados; cargar administrador no-superadmin y trabajador de prueba, importar la conexión Meta y probar aislamiento cross-tenant con el teléfono normalizado;
- storage privado recorrido con media entrante real en el ambiente del piloto;
- inbound, outbound correlacionado, estados, retry y ambos Flows probados end-to-end;
- ingreso, almuerzo, regreso y salida visibles en dashboard.

Esfuerzo residual controlable estimado: 2 a 4 días hábiles una vez aprobados por Meta la verificación/revisión/publicación aplicables y disponibles la conexión, Vercel y el tenant piloto. Los tiempos externos de Meta no tienen una fecha controlable. Esta prueba no incluye foto de asistencia, autoalta, cobro ni IA visual.

### H2 - Foto + comentario + geolocalización opcional como evidencia canónica

Base local completada:

- imagen Meta almacenada de forma privada sólo después de validar y ligar el asset exacto del webhook;
- trigger explícito: remitente autorizado, contenido no médico y comentario no vacío que comienza con `AVANCE:` o `PROGRESO:`; una foto genérica, un prefijo vacío o un medio no Meta no abre H2;
- caption/comentario conservado con la evidencia;
- selector de tarea canónica en Inbox con permisos mínimos;
- creación idempotente de `ProgressEvidence`, integridad SHA-256 y pruebas de replay/cross-tenant;
- sesión de captura ligada desde su emisión al `mediaAssetId` exacto, con token firmado de corta duración almacenado sólo como hash;
- descriptor durable mínimo `{ version, sessionId }`, sin token ni enlace; el bearer y el enlace se reconstruyen sólo en memoria después de revalidar el contexto y ganar el claim de entrega;
- bearer en el fragmento `#token=...`, scrub síncrono antes de `INIT` y cero `sessionStorage`; la pestaña conserva sólo en memoria un reintento ambiguo y lo descarta al vencer o recargar;
- webview puntual con consentimiento específico y opt-out `Continuar sin ubicación`; la cancelación es CAS/idempotente, no escribe coordenadas y conserva la foto;
- lectura de geolocalización reportada por el dispositivo con `accuracy` y timestamp; no se promete GPS, presencia física, identidad ni sensor infalible;
- fallback stale sin bearer ni URL cuando la sesión venció o no tiene vigencia segura para enviarse;
- evidencia que copia procedencia y verificación de ubicación de forma inmutable; fuera de geocerca o sin geocerca queda `REVIEW_REQUIRED`, nunca “presencia verificada”;
- revisión humana en Progreso y entrega privada server-side de la fuente Meta;
- las subidas desde dashboard usan una reserva server-owned de un solo uso y sólo exponen `uploadId`; la evidencia Meta permanece anclada al mensaje y a la conexión autorizados.

Gate de salida aún pendiente:

- aplicar y verificar `20260729100000_progress_evidence_location_capture` y `20260729110000_progress_evidence_location_rate_limit` en la rama Neon aislada, sin tocar Production;
- recorrer el lifecycle `070000`, ya verificado en Neon aislado, con una imagen Meta real y observar la descarga privada;
- ejecutar el recorrido con inbound Meta real y observarlo en Inbox/Progreso; hoy no existe esa evidencia E2E;
- validar en un celular real `AVANCE:`/`PROGRESO:` + foto → enlace puntual → `INIT` → consentimiento o opt-out → selección de tarea en Inbox, incluidos refresh, enlace vencido, rechazo de permiso, stale fallback y conectividad intermitente;
- decidir con evidencia de piloto si la selección de tarea final seguirá en Inbox o también requerirá un Flow; ningún retry puede correlacionar por cercanía temporal ni duplicar la operación;
- antes de incorporar datos de trabajadores reales, aprobar y probar la matriz de retención, DSAR integral, borrado verificable, cobertura de backups/restores y purga observada de media, sesiones, mensajes y datos derivados;
- H2 ya limita `INIT`, captura y cancelación entre instancias mediante advisory lock y `clock_timestamp()` de PostgreSQL. La vía activa admite 12/min por sesión y 600/min por organización; replay terminal o enlace vencido usa una vía aislada de 6/min y 300/min que no agota la capacidad activa. Sus buckets son acotados/expirables, responden `429 Retry-After`, fallan cerrados y no generan auditoría por request. Falta verificarlo en Neon Preview, programar el barrido global de buckets inactivos, configurar WAF externo y cubrir webhook/descargas; un contador en memoria no cumple este gate;
- invocar el cron autenticado de limpieza en el ambiente aislado, observar sus métricas/backlog y ejecutar smoke de descarga privada para ambos adapters de storage. La mera configuración del cron no demuestra ejecución ni purga;
- respetar el máximo actual de 4 MiB en rutas serverless; un piloto con archivos mayores necesita carga directa autorizada al storage, no un aumento nominal del formulario.

Esfuerzo residual controlable estimado: 1 a 3 días hábiles desde H1 y con Preview, secretos y storage listos; no es una fecha calendario ni incluye demoras externas.

### H3 - Onboarding simple y seguro del operario

Flujo: contacto desconocido -> cuarentena -> invitación o preautorización administrativa -> nombre/apellido y aviso de privacidad -> confirmación de obra -> aprobación -> identidad activa.

El número prueba control del canal, no identidad civil. Teléfonos compartidos o conflictos requieren revisión asistida. Nadie queda habilitado sólo por escribir "soy Carlitos".

Base H3.1 implementada y probada localmente: claim de un solo uso con token almacenado sólo como hash, un claim abierto por obra/remitente aun con varias conexiones, captura de identidad cifrada, sesión/Flow pre-operario que no presupone un `Worker`, submit autenticado, acuse terminal exacto, readiness fail-closed, cola CRM, revisión administrativa, enlace a `WorkerChannelIdentity`, CAS, idempotencia y ledger de decisiones. Sus dos migraciones nuevas fueron aplicadas sobre Neon aislado y todos los verificadores pasaron durante el Preview `Ready` de `d6b29b9`; todavía no se ejecutó el smoke funcional.

`privacyPresentedAt` demuestra que el Data Endpoint sirvió `INIT` con la versión fijada del aviso; no demuestra lectura ni comprensión humana. El aviso y el circuito laboral requieren revisión legal antes de probar con trabajadores reales.

La expiración/purga periódica elimina el bundle sensible del claim transitorio y deja auditoría sin PII. No es un DSAR integral: `WorkerPerson`, `WorkerChannelIdentity`, `Worker`, conversaciones, mensajes y backups quedan para otro sprint. `Conversation.externalId` todavía conserva internamente el teléfono raw y es deuda de privacidad pendiente.

Gate de salida: completar smoke UI/runtime en Preview, observar el cron y sus métricas, terminar la revisión legal y recorrer invitación → Flow → acuse → CRM → decisión con Meta real. Hasta entonces H3 sigue **en progreso**.

### H4 - Datos de cobro y comprobante

Base previa disponible: validación estricta de CUIL, CBU, CVU y alias; cifrado AES-256-GCM con AAD; keyring rotatable; fingerprint HMAC por tenant; API autenticada tenant-scoped; revisión maker-checker-activator y ledger append-only. El incremento H4 actual agrega localmente consentimiento específico por destino/canal, re-atestación legacy, panel CRM sólo enmascarado, definición Flow, companion de sesión de un solo uso y Data Endpoint terminal. Sus estados normales son `OPEN → PROCESSING → SUCCEEDED|UNCERTAIN`; la migración `13300` agrega sólo la recuperación `UNCERTAIN → SUCCEEDED` mediante procedencia exacta ya persistida y reloj de PostgreSQL. El reconciliador compara tenant, reserva, HMAC, tipo/fingerprint del destino, claves de operación, actor/canal y consentimiento sin leer valores financieros y sin invocar bridge, proveedor o WhatsApp. Las cuatro migraciones `20260729130000`, `20260729131000`, `20260729132000` y `20260729133000` aplican juntas en PGlite descartable; todavía no se aplicaron ni verificaron en PostgreSQL real/Neon Preview ni en un deployment H4 de Vercel.

Si la reconciliación de base no puede completarse, el Data Endpoint responde `503` vacío con `Retry-After: 1`; el journal queda sin ciphertext y puede reclamarse inmediatamente en el siguiente request exacto. No existe una caché negativa de 24 horas para ese caso. Sólo una respuesta cifrada ya confirmada se convierte en tombstone y se reproduce byte a byte, evitando reutilizar el nonce AES-GCM.

El journey ya comienza localmente desde un texto inbound: la intención `PAYMENT_DESTINATION` abre el Flow sólo para una identidad `CANONICAL` con persona/canal verificados, obra activa y referencia publicada. La sesión base y companion quedan confirmadas antes de aplicar el evento; datos financieros pegados en el chat se redactan antes de la cola. Esto todavía no lo vuelve operativo en un WhatsApp real: el catálogo proactivo genérico no envía cobro y siguen pendientes despliegue H4, publicación de plantilla/Flow en Meta, E2E, proveedor confiable de titularidad —la verificación sigue cerrada con `503`— y comprobante privado.

Las migraciones H4 convierten los destinos legacy existentes en `LEGACY_REATTESTATION_REQUIRED`, por lo que no deben aplicarse aisladamente sobre un ambiente con datos reales: el corte debe desplegar emisor/Flow y plan de re-atestación en una ventana coordinada, medir el inventario previo y conservar rollback. Si un destino quedó confirmado antes de fallar el cierre terminal, el reconciliador local puede vincularlo sólo con prueba exacta y dejar auditoría; si no existe destino o la procedencia no coincide, la sesión permanece `UNCERTAIN` para revisión. H4 sigue cerrado para piloto por los gates externos y operativos, no por ausencia de ese reconciliador local.

Antes de producción también hay que retirar la autoridad del teléfono legado en texto plano de `Worker` mediante dual-read, backfill verificado y una fase contract que lo vuelva nullable. Durante una rotación de la clave HMAC, la API deberá buscar las huellas de ambas claves y serializar la deduplicación con una transacción/lock estable; el índice por `fingerprintKeyId` sólo evita carreras dentro de una misma clave.

El objetivo del hito es completar esos componentes y mantener los valores completos fuera de logs, snapshots, Inbox común y prompts de IA. ObraSaaS registra/exporta la instrucción inicialmente; no mueve dinero automáticamente.

El objetivo de H4 es entregar el comprobante mediante plantilla y enlace privado de corta duración; ese recorrido todavía no está implementado. `DELIVERED` no equivale a firma ni conformidad.

Esfuerzo de ingeniería estimado: 1 a 2 sprints después de cerrar revisión laboral, privacidad, retención y proveedor de firma; las aprobaciones externas no tienen plazo comprometible.

### H5 - Visión con revisión humana + forecast Gantt

La IA describe el elemento (por ejemplo, mampostería parcial), propone un rango de avance, confianza, evidencia y abstención. Nunca certifica ni cambia el cronograma por sí sola. El Director aprueba/corrige, elige un porcentaje puntual dentro del rango y deja fundamento; recién entonces se materializa una observación inmutable que puede alimentar un forecast. La baseline permanece inmutable.

Base local completada: modelo Prisma/migración gobernados, provider registry, adaptador OpenAI Responses, sanitización binaria/EXIF, tenant opt-in con CAS entre administradores, recheck de suscripción/autorización en la última frontera, idempotencia, revisión humana CAS y puente revisable hacia cronograma. Ese puente valida tarea, assessment, evidencia, SHA, revisiones, plan y fecha de captura; rechaza el override manual libre, persiste una observación append-only y muestra hasta 50 tareas con mayor desvío baseline/forecast sin exponer procedencia privada. La credencial dedicada ya fue elegida. El despacho Sol primario y Terra shadow explícito conserva plan/precio/presupuesto, correlativos, tokens y costo real; no hay fan-out ni fallback silencioso. Una ejecución histórica controlada con `gpt-5.6-sol` se abstuvo correctamente frente a un render BIM y no inventó avance. Qwen3-VL y GLM-5V son challengers visuales; GLM-OCR y GLM-5.2 son especialistas OCR/texto, y GLM-5.2 nunca recibe fotos. HF/Z.ai sólo tienen pruebas de contrato y permanecen fuera de evidencia real hasta revisar subprocesadores, DPA y retención.

Gate pendiente: aplicar y verificar la migración H5 en Neon Preview, recorrer en un journey autenticado revisión → decisión humana → observación → forecast → comparación Gantt, verificar replay y conciliación interna con prueba recuperable, cerrar controles de datos/DPA/retención de OpenAI, recibir una foto Meta real y ejecutar el benchmark calibrado. El ledger, sus recibos, el presupuesto piloto y la telemetría cache ya están verificados en Preview. `store:false` no equivale a ZDR; el piloto rechaza `original/auto/low`, usa `high` y desactiva las escrituras implícitas de prompt cache. El circuito H5 no muta `Task`, baseline, certificación ni pago.

Contrato técnico y benchmark: [AI_VISUAL_EVALUATION.md](./AI_VISUAL_EVALUATION.md).

Esfuerzo de ingeniería estimado: prototipo controlado en un sprint después de habilitar los gates externos; un nivel productivo comparable con líderes del mercado requiere 2 a 4 sprints adicionales para dataset, ground truth, evaluación por tipología, observabilidad y criterios de abstención.

### H6 - Piloto integral por roles

Operario real + administrativo + Director + cliente externo con permisos mínimos, reporte semanal reproducible, asistencia, evidencia, forecast, comprobantes, alertas, degradación de proveedor, restore y pruebas cross-tenant.

No se inicia con datos de trabajadores reales hasta contar con retención/DSAR/backups/purga verificables y rate limiting distribuido/WAF probado en las fronteras públicas. Estos controles son gates de entrada al piloto, no deuda diferible a Production.

Esfuerzo de ingeniería orientativo: 6 a 10 semanas de trabajo focalizado desde H1 una vez resueltos Meta, credenciales, revisión legal y proveedores. No es una promesa calendario y no se anuncia como listo antes de completar H5.

## Escenario de aceptación del piloto

Este es el recorrido objetivo de aceptación H6; forecast está disponible sólo localmente y el comprobante sigue pendiente. Ninguno está certificado todavía como journey externo.

1. El administrativo crea la empresa, obra, geocerca, horario y tareas.
2. Invita a Carlitos y aprueba su identidad de canal.
3. Carlitos escribe desde su WhatsApp y el sistema lo reconoce sólo dentro de esa obra.
4. Registra entrada con una lectura puntual de geolocalización reportada por su dispositivo; fuera de geocerca queda en revisión, no como presencia verificada.
5. Envía una foto con `AVANCE:` o `PROGRESO:` y comentario; puede adjuntar ubicación o continuar sin ella, y la evidencia queda privada y ligada a una tarea.
6. IA propone descripción/rango con posibilidad de abstenerse.
7. Director aprueba/corrige, elige un punto y fundamenta; se crea una observación inmutable y un forecast, sin reescribir la baseline.
8. Dashboard e Inbox reflejan cada estado y su auditoría.
9. El pago se registra por circuito autorizado y Carlitos recibe un enlace privado al comprobante si dio opt-in.
10. El cliente sólo ve artefactos publicados y nunca datos laborales/bancarios del operario.
