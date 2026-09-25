# Traspaso operativo — WhatsApp por empresa

Fecha: 19/09/2026. Leé primero `PLAN_DE_IMPLEMENTACION_CODEX.md` y `tenant-owned-whatsapp-architecture.md` en esta carpeta. Este documento no contiene secretos ni acredita un despliegue distinto del que figure con SHA en el PR #1.

## Qué queda implementado en esta fase
- Preparación persistente por Project, bajo metadata.whatsappWorkspace de schemaVersion 2, con lectura del antecedente de Organization únicamente desde su obra original: nombre del asistente, intención de número (dedicado/app existente/proveedor existente), obra del canal y circuitos solicitados. Propiedad CUSTOMER y política REVIEW_REQUIRED fijas.
- GET/POST `/api/integrations/whatsapp/workspace`, con permiso de integraciones, lectura de obras, contexto de sesión, control de origen, revisión, preservación de metadata ajena y auditoría transaccional. No envía mensajes ni invoca Meta al guardar.
- Formulario dentro de Integraciones con los tokens del diseño, recuperación del mismo intento, conservación de borrador/conflicto y bloqueo de autorización ante cambios no guardados.
- La autorización dedicada existente recibe preparedRevision; se comprueba empresa/obra/preparación antes de Meta y de nuevo dentro de las dos transacciones de persistencia (conexión nueva y reconexión).
- Las opciones Business App y proveedor existente se pueden guardar, pero no ejecutan el registro API-only. Su activación requiere recorridos específicos pendientes. El usuario no debe perder el servicio anterior por elegir una tarjeta.

## Archivos de código
`src/lib/whatsapp/tenant-workspace-policy.js` contiene contratos públicos, opciones, validación, confirmación y mensajes seguros. `tenant-workspace.js` contiene lecturas/escrituras y guardas de autorización. `src/app/api/integrations/whatsapp/workspace/route.js` aplica sesión, permisos y límites del request.

`src/app/dashboard/integrations/tenant-whatsapp-workspace.js` y su CSS implementan el formulario; `integrations-client.js` conecta su estado al botón existente y conserva una revisión para el intento Meta. `src/app/api/integrations/whatsapp/embedded-signup/route.js` revalida la preparación sin devolver errores crudos de proveedores ni eliminar las guardas anteriores.

Pruebas: `tests/tenant-whatsapp-workspace.test.js`, `tests/tenant-whatsapp-workspace-route.test.js`, `tests/tenant-workspace-signup-binding.test.js` y `scripts/verify-tenant-whatsapp-workspace-ui.mjs`. También deben seguir pasando las pruebas existentes de Embedded Signup, errores públicos, permisos y leases. El número esperado de rutas protegidas se incrementa sólo por el nuevo handler.

## Estado que NO se debe dar por terminado
WhatsAppConnection sigue ligado a una obra. El nombre y los circuitos guardados no configuran todavía el runtime del modelo. No existe un setup link durable nuevo en esta fase, no se implementó coexistencia ni traspaso automático, no se migraron activos de ChatBoc y no se habilitó facturación gestionada. Los empleados y clientes externos necesitan sus propios accesos, no una promoción automática por mensaje.

No se renovó la credencial temporal del piloto al implementar esta preparación. La comprobación de estado de un proveedor, un mock de navegador y una respuesta real entregada son evidencias diferentes. No afirmar que el canal opera bidireccionalmente o con cientos de empresas por el resultado de una suite.

## Siguiente entrega recomendada
Prioridad aclarada por el usuario: números independientes por obra de cada empresa. Cerrar alta/roles de participantes y operación real; no exigir una migración a número compartido multiobra antes de ese piloto.

La siguiente secuencia permanece como opción futura de número compartido, no bloqueante:
1. Inventariar las dependencias de WhatsAppConnection.projectId y las constraints SQL. Diseñar y probar el registro organizacional y ChannelProjectBinding, sin duplicar secretos.
2. Implementar resolución de contexto de obra con participantes autorizados y pruebas de dos tenants/dos obras. No cambiar el ámbito de registros históricos al cambiar la obra activa.
3. Añadir la sesión durable de autorización/recuperación (nonce, TTL, recibos y reconciliación de código consumido) antes de ofrecer links de instalación delegados.
4. Incorporar la variante coexistente sólo tras confirmar el flujo oficial y su disponibilidad para esta app. Mantener migración de proveedor separada y reversible.
5. Activar un circuito de IA a la vez con su política publicada, presupuesto y fuente: primero parte revisable, después material solicitado y consulta de avance. Comprobar entrega y trazabilidad real con el piloto autorizado.

## Validación y despliegue
Trabajar sobre el HEAD observado de `codex/saas-recovery-20260917`; el PR #1 tiene otra rama de base y no representa por sí mismo una promoción a master. No hacer force push. Preservar cualquier cambio local ajeno.

Comandos de desarrollo, desde el repo: `npm test`; ESLint sobre los archivos afectados; `node scripts/verify-tenant-whatsapp-workspace-ui.mjs`; `npm run build`; `git diff --check`. El verificador usa Chrome en modo headless y HTTP local sintético, no credenciales de Meta. Capturas/resultados quedan bajo `.vercel/tenant-whatsapp-workspace-ui`.

La validación funcional publicada debe usar empresa cliente autorizada y obra correcta, guardar sin llamar a Meta, recargar, comprobar auditoría y demostrar bloqueo en otro tenant. Sólo probar autorización Meta con consentimiento del titular y activos correctos. Una credencial vencida no se resuelve apagando un control de salud.

El deploy de Preview no es Production. Mantener el preflight, identidad y SHA de migración, configuración live, resguardo y prueba autenticada como requisitos del pase. La evidencia final de cada versión debe enumerar lo ejecutado, lo simulado y lo no ejecutado con SHA/env; no reutilizar resultados antiguos como pruebas del código nuevo.

## Ampliación v3.1
Leer `worksite-numbers-and-participant-isolation.md`. La configuración de una obra no reemplaza la de otra. La respuesta a menú/ayuda se construye a partir de los permisos de campo existentes, dentro del número/obra ya resuelto. Pruebas adicionales en `tests/field-workers.test.js` y `tests/field-worker-menu.test.js`. No es una prueba de entrega física ni un menú de pagos administrativos para operarios.

## Continuación S11.A4.1: alta desde la conversación
Se agregó el seguimiento de la invitación, el enlace al alta exacta y la comprobación del acceso vigente frente a una aprobación histórica. El listado acepta `claimId` exclusivo dentro de la obra/tenant activos; el cliente usa el mismo endpoint de decisión, confirma su resultado y conserva el intento en respuestas inciertas. Consultar `participant-onboarding-journey.md` y ejecutar `node scripts/verify-participant-onboarding-journey-ui.mjs`. Ese verificador utiliza HTTP/identidad controlados, no mensajes de personas reales. No retirar los controles canónicos para permitir una nueva invitación tras una revocación.

## Continuación S11.A5.1: menú nativo de campo
Leer `native-whatsapp-field-menu.md`. Archivos nuevos: `field-interactive-menu.js` (catálogo, binding público, descriptor y contrato de lista) y `field-menu-delivery.js` (revalidación del participante antes de materializar). El motor, queue y dispatcher usan ese descriptor opcional; el sender exige credencial del tenant/número exactos. Las opciones de jornada delegan al dominio de asistencia; no crear otro sistema de fichaje. Verificador: `node scripts/verify-native-field-menu.mjs`, renderer local etiquetado con normalizador/motor reales y estado sintético. La entrega por Meta y la configuración vigente de Production se comprueban aparte. No reenviar texto ni lista automáticamente después de un resultado incierto.

## Continuación S11.A6: vigencia y recuperación del canal
Leer `whatsapp-credential-recovery.md`. La lectura de vigencia no renueva credenciales ni envía mensajes. El panel aplica aviso/deadline por obra sin perder la preparación y conduce a la autorización existente. Ejecutar `node scripts/verify-channel-recovery-ui.mjs`; usa componentes reales con identidad/HTTP controlados, no consentimiento Meta ni entrega física. Mantener pendientes las pruebas operativas y el pase de Production hasta verificarlos por separado.

## Continuación S11.A7: continuidad de respuestas en la bandeja
Leer `inbox-reply-continuity.md`. Los borradores y las solicitudes inciertas se conservan por conversación dentro de la instancia de empresa/obra/usuario, sin almacenamiento persistente nuevo. El sender canónico y su idempotencia siguen siendo la autoridad. GET/POST de mensajes añaden contexto verificable; una respuesta tardía o de otra conversación no se incorpora al historial visible. Ejecutar `node scripts/verify-inbox-continuity-ui.mjs`; usa InboxClient real con HTTP controlado, no envío a Meta. El número de tests y la publicación se consignan en el PR después de verificarlos. No confundir esta retención en memoria con sincronización offline ni con recuperación después de cerrar la pestaña.

## Continuación S11.A8: del mensaje a la restricción y su resolución
Leer `whatsapp-message-restrictions.md`. La bandeja permite convertir un texto autorizado o una transcripción ya completada en ProjectBlocker abierto con tarea y responsable elegidos por el administrador. Reutiliza el dominio de ejecución y registra procedencia/idempotencia; no crea compras ni altera el avance. El enlace exacto abre el seguimiento existente. Resolver exige una explicación y confirmación; una respuesta incierta se consulta con GET antes de repetir una escritura. Ejecutar `node scripts/verify-message-blocker-ui.mjs` y mantener la distinción entre esa prueba controlada, el preview y la operación física de Meta.

## Continuación S11.A9: restricciones vinculadas al cronograma
Leer `task-restrictions-in-schedule.md`. El estado de campo agrega una lectura agrupada por tarea dentro de la transacción existente; no altera porcentajes ni fechas. El Gantt muestra impedimentos activos y plazos registrados, la tarjeta abre ejecución por taskId y el Centro de operaciones abre cada blockerId exacto. El seguimiento y la resolución usan el dominio anterior. Ejecutar `node scripts/verify-schedule-restrictions-ui.mjs` y las regresiones de campo y restricciones. La validación del navegador es sintética; el despliegue y los registros físicos se acreditan aparte por SHA.

## Continuación S11.A10: planificación de responsables desde la obra
Leer `task-assignment-planner.md`. ExecutionClient integra el planificador de una persona o cuadrilla, confirmación idempotente y estados planificada/en curso/finalizada/cancelada. Reutiliza TaskAssignment y el creador transaccional del dominio de ejecución; los nuevos handlers exigen contexto y permisos. El Gantt lee conteos por tarea y enlaza al tablero. Finalizar no modifica el avance ni autoriza operaciones laborales o del canal. Ejecutar `node scripts/verify-task-assignments-ui.mjs` y las regresiones del Gantt; sus datos HTTP son sintéticos. La publicación y las comprobaciones autenticadas se registran por SHA en el PR, por separado de las pruebas locales.

## Continuación S11.A11: integrantes e historial de cuadrillas
Leer `crew-membership-lifecycle.md`. Desde ejecución, «Ver integrantes» permite consultar vigencias/historial, incorporar a una persona existente, cambiar su función interna y finalizar su participación con revisión y explicación. Reutiliza WorkTeamMember y el creador transaccional anterior. Encargado de cuadrilla no significa administrador y finalizar la participación no elimina el legajo ni sus asignaciones. Las nuevas rutas exigen contexto y permisos; incorporación incierta usa el mismo intento, cambios inciertos se verifican con GET. Ejecutar `node scripts/verify-crew-roster-ui.mjs` y las regresiones de asignaciones y restricciones. Sus personas y HTTP son sintéticos; la evidencia del preview y de Production debe comprobarse por separado y registrarse por SHA en el PR.

## Continuación S11.A12: coincidencias antes de asignar recursos
Leer `assignment-overlap-review.md`. El planificador revisa asignaciones directas y personas compartidas por cuadrillas dentro de la obra y período. No calcula disponibilidad contractual ni cruza identidades entre empresas. Las advertencias requieren coordinación explícita y se reevalúan bajo el bloqueo transaccional al guardar. Un cambio de fuente devuelve un conflicto recuperable conservando el formulario; un intento ya guardado sigue siendo idempotente. Se reutiliza el creador anterior, sin nuevas tablas. Ejecutar `node scripts/verify-assignment-overlap-ui.mjs` y las regresiones de asignaciones, cuadrillas y restricciones. Sus fuentes de datos son controladas; el despliegue y la operación real se documentan por SHA en el PR.

## Continuación S11.A14: reprogramar fechas de una asignación
Leer `assignment-reschedule.md`. La tarjeta conserva la misma asignación y su responsable al revisar/cambiar fechas previstas. Sólo PLANNED, revisión y motivo obligatorios, coincidencias verificadas nuevamente bajo transacción y recuperación por GET de respuestas inciertas. No modifica Task, avance, asistencia o WhatsApp. Ejecutar `verify-assignment-reschedule-postgres.mjs` y `verify-assignment-reschedule-ui.mjs` contra PostgreSQL desechable; la sesión del browser es sintética. Publicación y pruebas reales del canal siguen separadas.

## Continuación S11.A15: continuidad de creación y reprogramación
Leer `assignment-lifecycle-continuity.md`. El replay de creación verifica su recibo original y devuelve el estado vigente aunque las fechas hayan cambiado; no restaura el período ni duplica la asignación. Creación y reprogramación comparten la prohibición de duplicados exactos, comprobada nuevamente bajo bloqueo de proyecto. El rechazo conocido conserva el formulario editable; una respuesta incierta sigue requiriendo recuperación. Ejecutar `verify-assignment-continuity-ui.mjs` y `verify-assignment-continuity-postgres.mjs` con sus ámbitos de ensayo explícitos. No acreditar Clerk ni Production con esos resultados.

## Continuación S10.CERT-QA: archivado y preparación concurrentes
Leer `certificate-archive-race-verification.md`. Se identificó el rechazo PREPARER_REQUIRED 42501 cuando el archivado gana: la membresía queda activa, pero la condición de obra operable ya no se cumple. La corrección pertenece al verificador, no a las guardas SQL. Cinco órdenes obligatorios comprueban errores exactos y hechos/punteros; la variante focal repite quince casos fijos en una base local desechable. El entorno Clerk de CI requiere una rama autorizada y revisión humana; sus reglas no se modificaron. Consultar el PR para los resultados realmente ejecutados y el SHA integrado.

## Continuación Clerk E2E: rama de recuperación autorizada
Leer `clerk-recovery-branch-gate.md`. Tras autorización del usuario, CI y la política del entorno admiten exclusivamente `codex/saas-recovery-20260917` como tercera rama. Se mantienen el revisor obligatorio, la base PostgreSQL desechable, los secretos por paso y los tres journeys. No se aprueban ejecuciones automáticamente ni se cambian roles o credenciales productivas. Registrar en el PR el run y SHA exactos; distinguir revisión pendiente de un login probado. Esta sección actualiza la restricción de rama indicada en la entrega S10.CERT-QA, sin cambiar su evidencia histórica.

## Continuación: aceptación autenticada de asignaciones
El usuario delegó la aprobación del entorno de ensayo; el run `35816505410` completó S9.2/S9.3/S10 con Clerk Development y PostgreSQL aislado. Leer `authenticated-assignment-continuity.md`. La ampliación S11 reutiliza esas sesiones para creación/reprogramación móvil, recuperación idempotente, duplicados, sólo lectura y aislamiento. El resultado se acredita por su propio SHA/run en el PR; no confundir el éxito anterior con cobertura ejecutada de código nuevo. Una revisión explícita no modifica protecciones ni constituye una promoción productiva.

## Continuación S11.A16–A19: agenda, directorio y plantillas
La agenda A16, recuperación A17 y directorio A18 están descritos en `assignment-agenda.md`, `assignment-planner-recovery.md` y `assignment-owner-directory.md`. La revisión de contenido, solicitud explícita y recuperación de plantillas A19 está en `whatsapp-template-review.md`. El nombre/estado de plantilla consultados no equivalen a envío ni entrega; conservar la separación entre proveedor controlado y una cuenta real de Meta.

## Continuación S11.A20: observaciones vigentes del catálogo
Leer `whatsapp-template-catalog-consistency.md`. Las tarjetas de Integraciones retiran una aprobación histórica al comenzar/fallar una nueva consulta. Las respuestas atrasadas no reemplazan otra observación ni invalidan el canal por un error anterior; una confirmación parcial sólo verifica su blueprint. El botón «Formulario operativo» describe el Flow, no un envío. Ejecutar `verify-template-catalog-consistency-ui.mjs` y las regresiones de plantillas/canal/bandeja.

Desktop Commander volvió a estar disponible y el worktree de planificación fue actualizado por fast-forward desde `eaeaa1c` a `be88e2b`, preservando las otras copias. Se aprobó por delegación el run `35918766962` de `be88e2b`: S9.2/S9.3/S10-CERT pasaron con Clerk Development y PostgreSQL aislado. Es evidencia de ese SHA, no de commits posteriores.

La sesión real del titular en Preview comprobó app/callback y consultó el piloto autorizado: credencial temporal vencida, ventana cerrada y cero salidas del backend. No se renovó por fuera del circuito ni se mandaron mensajes. El paso de renovación fue bloqueado por la herramienta y se dejó sin ejecutar, sin buscar un canal alternativo para eludirlo. La evidencia actual de A20 y su publicación/autenticación se registra separada en el PR.

## Continuación S11.A21: envío revisado y recuperación por recibo
Leer `proactive-flow-confirmation.md`. La bandeja exige mensaje/destinatario revisados y valida toda la respuesta de envío; un 200 vacío o de otra conversación nunca acredita aceptación. GET de recibo del mismo intento conserva contexto/actor y no llama al proveedor ni escribe. Un resultado ausente sigue incierto, y un fallo del historial no reenvía. La decisión de riesgo conserva su Message ID y exige una respuesta válida antes de habilitar otro intento.

Ejecutar `node scripts/verify-proactive-flow-confirmation-ui.mjs` y las pruebas `proactive-flow-confirmation.test.js` / `whatsapp-proactive-flows.test.js`. El verificador se incorpora a CI público con proveedor/identidad/base inyectados; no cuenta como entrega física. La publicación y el cierre de issue #2 se documentan únicamente después de comprobar el SHA y el deployment. No modificar el canal piloto ni las guardas de Production para satisfacer un test.

## Continuación S11.A22: seguimiento persistido de formularios
Leer `proactive-flow-history.md`. La bandeja consulta Message y sus sesiones verificadas por conversación, con paginación de 20 y permiso de lectura vigente. Funciona tras recargar sin conservar la clave local A21; no es recuperación offline de borradores ni reenvío. Aceptación, entrega y respuesta registrada permanecen separados; una decisión manual no se presenta como rechazo del proveedor. GET history es independiente de la credencial de envío, no llama a Meta ni escribe. Ejecutar los verificadores `verify-proactive-flow-history-ui.mjs` y `verify-proactive-flow-history-postgres.mjs`, además del circuito A21. El cuarto job SQL utiliza su servicio PostgreSQL desechable separado. Registrar resultados y publicación con SHA en el PR; la prueba física de WhatsApp sigue siendo externa a los fixtures.

## Continuación S11.A23: priorización del seguimiento
Leer `proactive-flow-followup.md`. La vista A22 separa ausencia de respuesta vigente, enlace vencido, revisión del envío y respuesta registrada, con conteos exclusivos de la página observada. Conserva filtros durante paginación/actualización, indica el alcance de una página vacía y no hace consultas por filtrar. La clasificación usa observedAt, no el reloj del dispositivo. No modifica API, permisos, base, sender ni resolución. Ejecutar las nuevas pruebas de `proactive-flow-followup.test.js` y el verificador ampliado de historia. El enlace al registro de negocio y el piloto real siguen separados. En esta revisión una lectura exploratoria de los dominios fue bloqueada por la herramienta; no se repitió mediante otro canal y no se implementó una correlación por suposición.

## Continuación S11.A24: seguimiento autenticado comprobado
Leer `authenticated-flow-history.md`. El run 36069145046 de bbdbd1e completó S9.2/S11-HISTORY, S9.3 y S10-CERT con Clerk Development real y PostgreSQL aislado. El seguimiento acredita paginación 20+6, privacidad, aislamiento, uso móvil con recarga sin despacho y denegación tras sign-out; no acredita recepción física en Meta ni revocación administrativa de membresías.

Las correcciones del fixture no alteraron esquema ni permisos. Se conserva el fallo del harness SQL auxiliar 36069414112, cuyo diagnóstico no pudo leerse; no se cuenta como aprobado. La aceptación principal se apoya en su propia ejecución satisfactoria, no en ese harness. Las reglas de ensayo y de Production permanecen separadas.

El cierre documentado solicita un único Preview del SHA final y registra sus resultados en PR #1. La aprobación y comprobación del nuevo SHA deben ser explícitas. El enlace al parte/incidencia/fichaje, la autorización piloto y el pase productivo siguen pendientes de su propia evidencia.

## Continuación S11.A25: respuesta original correlacionada
Leer `correlated-flow-reply.md`. El historial ofrece una consulta explícita desde el envío a la sesión y mensaje entrante exactos. GET reply reutiliza la privacidad mínima de la bandeja y sus permisos; no busca por teléfono, no envía y no convierte la respuesta en un parte/fichaje aprobado. El nuevo verificador UI, seis casos SQL y el recorrido autenticado amplían los controles existentes. Publicación y resultados se acreditan por SHA; el enlace a registros de negocio y el piloto físico siguen separados.

## Continuación S11.A26: confirmación del parte ligada a origen e intento
Leer `message-report-bound-recovery.md`. El cliente calcula el ID determinista del parte y compara contexto, fuente y huella; preparar valida el recibo de auditoría del registro existente. La recuperación incierta consulta GET sin repetir la escritura y conserva el estado actual. Un fallo de origen se corrige sin perder borrador, con nueva revisión. Ejecutar unitarias, `verify-whatsapp-report-ui.mjs`, la nueva suite SQL y el journey autenticado integrado antes de declarar cerrada issue #3. No confundir esta preparación de texto/audio con un enlace universal desde respuestas de Flow a todos los registros de negocio.

## Continuación S11.A27: ingreso vinculado a la respuesta
Leer `flow-attendance-link.md`. El motor registra el AttendanceEntry exacto devuelto para shift-check-in, incluso si reutiliza un pendiente. La bandeja consulta ese recibo después de verificar respuesta/sesión, con permiso adicional de asistencia. No busca por fecha/teléfono, no reconstruye legacy, no completa ubicación ni aprueba horas. La lectura muestra registro y jornada actuales sin GPS o datos privados. Ejecutar pruebas de motor/contrato/ruta, `verify-flow-attendance-ui.mjs` y la suite SQL de historia ampliada antes de publicar; distinguir las identidades controladas del nuevo panel de los journeys Clerk existentes y del piloto Meta físico.

## Continuación S11.A28: ingreso vinculado con sesión real
Leer `authenticated-flow-attendance.md`. El journey S9.2 añade la consulta exacta de dos formularios que comparten un pendiente anterior, legacy sin backfill, permisos/acceso ajeno, recarga móvil y sign-out independiente. Preparación con dominio y Prisma reales, sin canal de envío; no es prueba del webhook completo ni GPS físico. El fixture exige base/socket/obra sintéticos, y su verificador SQL auxiliar comprueba reutilización, lecturas sin mutación y rollback por carga duplicada. El resultado del SHA final se acredita en el PR, sin trasladar automáticamente la aceptación de A27.
