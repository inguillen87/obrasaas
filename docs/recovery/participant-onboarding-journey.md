# S11.A4.1 — De la conversación al alta revisada y al acceso vigente

Base: e92f8375ac9bc9b7b25c09ebb25f310b9fac5b5d. Fecha: 19/09/2026.

## Circuito conectado
La bandeja conserva el contacto y muestra cuatro etapas: invitación, datos del trabajador, revisión y acceso vigente. Preparar una invitación no la envía; se exige una confirmación explícita antes de llamar al endpoint existente. El envío conserva sus controles de salud del canal, ventana de atención, sesión Flow, permisos e idempotencia. Una entrega incierta no genera otra invitación automáticamente.

Cuando el trabajador envía sus datos, la conversación puede abrir la solicitud exacta en Equipo mediante un identificador opaco. La consulta usa el mismo servicio de altas, siempre filtrado por organización, obra y membresía vigentes. No depende de que el alta aparezca en la primera página ni busca por teléfono en otras empresas. Los filtros ambiguos, repetidos o vacíos se rechazan antes de consultar.

La revisión fijada reutiliza las tarjetas, reglas de privacidad y decisión existentes. No aprueba datos sólo por figurar SUBMITTED: sigue requiriendo el recibo de WhatsApp verificado para aprobar. El rechazo sigue exigiendo motivo. La lista completa continúa disponible y se incorpora el regreso a Bandeja WhatsApp sin cambiar de empresa u obra.

Una respuesta de decisión debe coincidir con alta, obra, revisión, estado y resolución esperados antes de confirmar éxito. Ante una respuesta perdida se conserva el intento, se bloquea editar su contenido y se verifica la misma decisión. Ante conflicto se conserva el texto de la edición para que el usuario lo revise, sin sustituirlo por una aprobación nueva. Los cambios de navegación y cierre de pestaña protegen las decisiones no confirmadas.

El acceso a la cuadrilla después de aprobar vuelve a cargar el equipo desde el servidor, evitando un ancla hacia un trabajador que no estaba presente en los datos anteriores a la aprobación.

## Corrección de autoridad actual
La consulta anterior podía considerar autorizado un contacto con una claim histórica APPROVED y un Worker activo, aunque el canal canónico hubiese sido revocado. Ahora se vuelve a utilizar el resolver canónico actual del remitente, dentro de la empresa y obra de esa conversación; además se compara la persona, identidad de canal y vínculo de trabajador con los de la decisión histórica.

Un recibo terminal privado puede no contener el teléfono. En ese caso no se reintroducen datos en su payload ni se confía ciegamente en la decisión: el contacto se resuelve nuevamente desde la identidad de la conversación ya vinculada a esa invitación. Si se revocó o cambió la identidad, hay ambigüedad o el vínculo no coincide, la interfaz informa un acceso pendiente de revisión. Nunca se reactiva un canal por consultar un alta.

Esto corrige la presentación de autoridad y la elegibilidad de invitación; el procesador de eventos conserva sus verificaciones previas y continúa validando cada acción. La aprobación administrativa no certifica identidad civil ni garantiza disponibilidad del proveedor, entrega de mensajes o permiso de pagos.

## Superficies y archivos
- `src/lib/whatsapp/worker-onboarding-invitations.js`: estado actual, correlación exacta y proyección de acceso vigente sin duplicar el motor de identidad.
- `src/lib/whatsapp/participant-onboarding-progress.js`: contrato público y confirmación estricta de decisiones. No devuelve teléfonos, CUIL, tokens, datos cifrados o payloads privados de proveedor.
- `src/app/dashboard/inbox/contact-onboarding-progress.js` y `contact-onboarding-action.js`: etapas y consentimiento explícito dentro de la conversación.
- `src/lib/worker-onboarding.js`, API de listado y `worker-onboarding-client.js`: filtro exacto, conservación de decisiones, privacidad y mismo servicio de aprobación.

## Validación prevista y límites
Las pruebas de dominio cubren el acceso canónico actual frente a la decisión histórica, revocación y discrepancias de persona/obra/empresa. Las de API comprueban filtros exclusivos y scope de sesión. El verificador de navegador usa los componentes reales con HTTP e identidad controlados: abrir/preparar sin envío, consentir una invitación, recibir datos simulados, abrir el alta exacta, registrar una decisión cuya primera respuesta se pierde, recuperar el mismo intento, volver a la bandeja y retirar el indicador de autorización al simular revocación.

Las pruebas de recuperación no equivalen a emitir invitaciones reales ni a aprobar trabajadores reales. No se renovó una credencial Meta, publicó un Flow nuevo ni modificó datos de personas en esta implementación. Los resultados, SHA y deployment deben registrarse después de ejecutar la suite, lint, build y smoke. El estado READY de Preview no significa Production publicada.

## Próximo cierre operativo
Validar credencial vigente y Flow de alta real del número de obra; invitación a un contacto autorizado por el propietario; presentación de datos y privacidad; recibo verificado; decisión del responsable; primer mensaje de menú o parte autorizado, persistencia y respuesta entregada. Observar eventos y presupuesto por tenant sin repetir mensajes a todos los contactos como prueba.

No agregar una vía de alta que omita consentimiento, aprobación, revocación o aislamiento para sortear una configuración externa pendiente. El mismo teléfono en otra empresa mantiene su identidad, autorización e historial independientes. El teléfono no se convierte en DNI ni en permiso global.
