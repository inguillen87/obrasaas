# Piloto WhatsApp E2E - readiness y gates

Fecha de corte: 2026-07-24

## Decisión de canal

La vía principal es Meta WhatsApp Cloud API con el número de prueba que ofrece Meta y hasta cinco teléfonos propios registrados como destinatarios de prueba. Es la única vía que valida la arquitectura real de ObraSaaS: webhooks firmados, estados, media, plantillas, WhatsApp Flows, Data Endpoint e Embedded Signup.

Twilio Sandbox queda como fallback. El endpoint legado actual responde `410` y reactivarlo exigiría un adaptador aislado de entrada/salida, media, firmas, estados e idempotencia. Aun así, Twilio no probaría los Flows/Data Endpoints nativos de Meta, por lo que no reemplaza el piloto Meta.

Evidencia externa disponible al corte: en la cuenta Meta de ObraSaaS están presentes la app dedicada y el caso de uso WhatsApp; Meta asignó un número de prueba, se verificó un celular propio como destinatario, se generó un token temporal y Meta aceptó una solicitud outbound de plantilla. No se copian en este repositorio identificadores, teléfonos ni el valor del token.

Este resultado acredita sólo aceptación outbound en el entorno de prueba. No acredita entrega, inbound, eventos de estado, webhook firmado, Flows, aislamiento sobre un tenant real ni mensajería bidireccional end-to-end. También faltan credenciales permanentes de release gestionadas como secretos en Vercel. El token temporal debe revocarse o rotarse y sustituirse; no es una credencial apta para Preview o Production.

## Qué puede probarse hoy

- Dashboard interno: tenant, obra, cuadrilla, tareas, Gantt, Inbox, asistencia y aprobaciones.
- Operario previamente creado y ligado a su teléfono dentro de una obra.
- Entrada, pausa, regreso y salida con hora de servidor, GPS fresco, accuracy, geocerca e idempotencia.
- Recepción de texto, audio, imagen, video y documentos; media privada con SHA-256.
- Propuestas de avance por texto/audio que requieren aprobación y no reescriben el Gantt directamente.

No debe presentarse todavía como completo: el simulador web no adjunta una imagen real; la foto de WhatsApp no se convierte aún en `ProgressEvidence` asociado a una tarea; no existe autoalta ni perfil de cobro operativo; no existe visión productiva ni forecast derivado de evidencia. Ya existen un módulo criptográfico local para normalizar identidad/CUIL y destinos CBU/CVU/alias, cifrarlos con AAD tenant/subject-scoped y emitir DTO enmascarado, además del esquema Prisma y migraciones locales para identidad y destinos de cobro. Esa persistencia todavía no fue desplegada ni verificada en Neon y faltan API tenant-scoped, Flow y pantalla productiva.

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
- tenant, obra y trabajador reales cargados en Neon, con el teléfono normalizado y aislamiento cross-tenant probado;
- storage privado y migraciones verificadas en el ambiente del piloto;
- inbound, outbound correlacionado, estados, retry y ambos Flows probados end-to-end;
- ingreso, almuerzo, regreso y salida visibles en dashboard.

Estimación condicional: 2 a 4 días hábiles desde que las credenciales permanentes, Vercel y el tenant real del piloto estén disponibles. Esta prueba no incluye foto de asistencia, autoalta, cobro ni IA visual.

### H2 - Foto + comentario + GPS como evidencia canónica

Gate de salida:

- imagen de WhatsApp almacenada de forma privada;
- caption/comentario y ubicación ligados al mismo evento;
- desambiguación/Flow para elegir tarea;
- creación idempotente de `ProgressEvidence`;
- revisión humana en Inbox/Progreso;
- URL privada expirable y pruebas de replay/cross-tenant.

Estimación: un sprint de 5 a 8 días hábiles después de H1.

### H3 - Onboarding simple y seguro del operario

Flujo: contacto desconocido -> cuarentena -> invitación o preautorización administrativa -> nombre/apellido y aviso de privacidad -> confirmación de obra -> aprobación -> identidad activa.

El número prueba control del canal, no identidad civil. Teléfonos compartidos o conflictos requieren revisión asistida. Nadie queda habilitado sólo por escribir "soy Carlitos".

Estimación: un sprint después de H2.

### H4 - Datos de cobro y comprobante

Base local ya disponible: validación estricta de CUIL, CBU, CVU y alias; consentimiento de privacidad versionado; cifrado AES-256-GCM con AAD; keyring rotatable; fingerprint HMAC por tenant; serialización enmascarada; y esquema Prisma con migraciones locales para identidad laboral y destinos de cobro. Esta base no equivale a un perfil operativo: la migración no está desplegada ni verificada en Neon y todavía faltan API tenant-scoped, permisos específicos, revisión/doble control, Flow/UI y auditoría de cambios.

Antes de producción también hay que retirar la autoridad del teléfono legado en texto plano de `Worker` mediante dual-read, backfill verificado y una fase contract que lo vuelva nullable. Durante una rotación de la clave HMAC, la API deberá buscar las huellas de ambas claves y serializar la deduplicación con una transacción/lock estable; el índice por `fingerprintKeyId` sólo evita carreras dentro de una misma clave.

El objetivo del hito es completar esos componentes y mantener los valores completos fuera de logs, snapshots, Inbox común y prompts de IA. ObraSaaS registra/exporta la instrucción inicialmente; no mueve dinero automáticamente.

El comprobante se entrega mediante plantilla y enlace privado de corta duración. `DELIVERED` no equivale a firma ni conformidad.

Estimación: 1 a 2 sprints, condicionada a revisión laboral, privacidad, retención y proveedor de firma.

### H5 - Visión con revisión humana + escenario Gantt

La IA describe el elemento (por ejemplo, mampostería parcial), propone un rango de avance, confianza, evidencia y abstención. Nunca certifica ni cambia el cronograma por sí sola. El Director aprueba/corrige y recién entonces se genera un escenario de forecast; la baseline permanece inmutable.

Estimación: prototipo controlado en un sprint; nivel productivo comparables con líderes del mercado requiere 2 a 4 sprints adicionales para dataset, ground truth, evaluación por tipología, observabilidad y criterios de abstención.

### H6 - Piloto integral por roles

Operario real + administrativo + Director + cliente externo con permisos mínimos, reporte semanal reproducible, asistencia, evidencia, forecast, comprobantes, alertas, degradación de proveedor, restore y pruebas cross-tenant.

Ventana honesta: 6 a 10 semanas de trabajo focalizado desde H1, siempre que Meta, credenciales, revisión legal y proveedores no bloqueen gates. No se anuncia como listo antes de completar H5.

## Escenario de aceptación del piloto

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
