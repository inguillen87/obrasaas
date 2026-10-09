# Presentación reactiva de identidad desde una solicitud admitida

Este bloque reduce la copia manual del código de identidad para una persona que
todavía no aceptó su cuenta. No completa el alta íntegra de un operario por chat.
No modifica los cierres generales de Meta ni las exclusiones del piloto de
desarrollo; un canal de ese piloto no admite este recorrido.

## Recorrido implementado

1. El teléfono personal envía una solicitud por el WhatsApp de la empresa. Un
   responsable admite esa solicitud y crea la ficha en la obra correcta.
2. El administrador envía la invitación canónica y registra la autorización
   explícita para contactar por WhatsApp. La invitación debe estar confirmada
   como `INVITE_SENT`; no alcanza con un intento de envío.
3. Mientras la cuenta sigue `INVITED`, `HOLA`, `ESTADO` o `MENU` ofrece
   **Presentar identidad**. Este primer botón no crea un desafío.
4. El clic correlacionado prepara los recibos canónicos de identidad y responde
   con **Iniciar identidad**. Ambos botones contienen sólo nonces; el código de
   identidad permanece cifrado en los recibos privados.
5. El segundo clic confirmado inicia el recorrido existente: autorización de
   imágenes y dorso, elecciones independientes de OCR/comparación facial,
   documento y selfie nueva. La presentación guarda evidencia privada y queda
   `PENDING_ACCOUNT_CLAIM`.

Los botones no son sesiones ni credenciales de acceso. Cada avance exige
remitente, empresa, canal, obra, ficha, autoridad del responsable, consentimiento
y mensaje saliente exactos. Sólo `SENT` o una observación posterior válida
confirma ese mensaje; `SEND_STARTED` y `SEND_UNKNOWN` no habilitan otro avance.
El máximo de los botones es 30 minutos desde el primer ofrecimiento y nunca se
extiende al consumirlo. Los relojes finales de las transacciones vuelven a
comprobar ese límite, la invitación, la ventana de respuesta y la lease.

## Coordinación con las invitaciones programadas

El traspaso reactivo sólo parte de `WAITING_CONFIGURATION`, sin desafío,
conversación, referencia saliente ni outbox del intento. Los procesos comparten
el bloqueo canónico del responsable y bloquean los proyectos en orden estable.
Después de obtener todos los bloqueos, releen la autoridad y la ficha.

El intento programado pasa a `CANCELED` con motivo `REACTIVE_HANDOFF`, conservando
su historial y el recibo causal. El desafío, los recibos `prepared` y
`PREPARE_KYC_CHAT`, el traspaso y la respuesta cifrada se confirman en la misma
transacción. Ningún estado `BLOCKED`, `PENDING`, intentado, incierto o enviado
se recicla mediante este recorrido.

## Acciones que todavía requieren cuenta o revisión humana

La persona debe aceptar la invitación recibida por correo mediante Clerk y la
cuenta autenticada de ObraSaaS. La adopción canónica del recibo transforma la
presentación en pendiente de revisión. Luego un responsable diferente de la
persona revisa la evidencia y ésta realiza su vinculación individual de canal.
Este bloque no aprueba la identidad, crea cuentas, concede permisos ni vincula
el teléfono de forma automática.

Este recorrido acotado debe presentarse **antes de aceptar la cuenta**. Si la
aceptación ocurre entre los botones, el botón anterior falla cerrado: no
reutiliza el desafío bajo un principal nuevo. El responsable debe consultar la
ficha vigente, cerrar el desafío pendiente mediante `CANCEL_KYC_CHAT` con razón
explícita y preparar uno nuevo con el recorrido canónico de cuenta activa. Lo
mismo aplica a un botón vencido: no se genera un segundo desafío por `HOLA`.
No se divulga de nuevo el código viejo por recuperación.

Una identidad individual ya vinculada y vigente puede operar por mensajes
firmados de WhatsApp sin mantener una sesión web abierta. Cada mensaje vuelve
a comprobar membresía, asignación, KYC aprobado, binding y permisos actuales en
`resolveWorkerChannelIdentity`; tener una solicitud admitida o una captura
pendiente no satisface ese contrato. No se cambia ese contrato aquí.

## Validación y límites

- Pruebas unitarias: cifrado, destinatario, nonce, contexto, confirmación,
  descubrimiento sin autoridad y fence temporal final.
- `verify-participant-reactive-onboarding-postgres.mjs` sólo acepta la fixture
  local `cutover_test@127.0.0.1:6549/obrasaas_cutover_ci` sin contraseña o el
  servicio PostgreSQL 17 de CI en `127.0.0.1:5432` con usuario y contraseña
  sintéticos `cutover_test`, siempre con `CUTOVER_TEST_DISPOSABLE=1` y sin
  contexto Vercel.
  Crea y elimina un esquema aleatorio; todas las personas, imágenes y llamadas
  a proveedores son sintéticas y el acceso de red inesperado produce error.
- Prueba los callbacks firmados, admisión, invitación, contacto consentido,
  botones, captura de tres imágenes, replay durable, denegaciones y espera real
  del bloqueo compartido. Los cruces temporales sustituyen únicamente el reloj
  devuelto por la consulta final de PostgreSQL; no afirman entrega de Meta.
- No prueba una cuenta humana, documentos reales, aprobación de Meta, aceptación
  de proveedor, uso físico del piloto ni publicación. Los recibos privados
  registran hashes del productor y fuentes de cada ejecución, sin sobrescribir
  resultados anteriores.
- El workflow `production-boundary.yml` ejecuta este productor con el servicio
  PostgreSQL 17 existente y conserva únicamente su recibo sanitizado. La
  configuración del paso no afirma que CI ya haya corrido para una revisión.
