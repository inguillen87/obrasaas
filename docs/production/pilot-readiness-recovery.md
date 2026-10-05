# Preparación del piloto: recuperación, menú y seguimiento

Este bloque usa los módulos de obra, recibos, inbox y procesador existentes.
Conserva la base de negocio, el motor de permisos y el modelo CRM canónicos. Su
publicación, CI y aceptación se registran por commit en un comprobante independiente.

## Recuperar una confirmación después de recargar

Antes de enviar una operación de planificación, tareas, participantes/KYC,
registro de obra, fotografías, jornada, evidencia, compras o preparación de
WhatsApp, el navegador conserva únicamente la referencia necesaria para
consultar el recibo: ámbito, obra, UUID, recurso y fecha; las fotografías agregan
el ID del registro. La bandeja agrega acción e ID del evento.

No se conservan JWT, credenciales, códigos de autorización, PIN, imágenes,
archivos, textos, coordenadas ni el cuerpo del formulario. La referencia no
concede acceso. Después de identificar al usuario y obtener el ámbito vigente,
se muestran únicamente sus referencias de las obras autorizadas. Un cambio de
rol o empresa no migra los intentos a un ámbito diferente.

Las referencias tienen una única persistencia en IndexedDB del navegador.
Una transacción de lectura y escritura comprueba los pendientes y reserva el
intento; se espera su confirmación antes de obtener el token o enviar la operación.
Web Locks mantiene además la coordinación entre pestañas del mismo origen.
Sin almacenamiento, confirmación de la transacción o bloqueo disponible, la
operación nueva se detiene antes del envío. La espera comparte la cancelación y
el plazo del transporte existente.

Las referencias de la versión anterior en localStorage se transfieren una vez
por ámbito, con la misma validación estricta y sin copiar campos del formulario.
La transferencia confirmada no elimina datos de otras aplicaciones o ámbitos.
Una marca durable evita reimportar una referencia antigua después de haber
comprobado su recibo. Una estructura inesperada o un conflicto detiene la
operación; no se borra ni reinicializa el almacenamiento para aparentar recuperación.

Al publicar esta transición, cerrar o recargar las pestañas que todavía ejecuten
la versión anterior antes de comenzar el piloto. La marca de migración no permite
reimportar escrituras posteriores de ese código antiguo en localStorage. No se
afirma convivencia de ambas versiones ni se presenta la migración como cola offline.

Las otras pestañas reciben sólo un aviso de invalidación, sin identificadores ni
datos privados, y consultan de nuevo sus referencias autorizadas. Volver a enfocar
la cuenta también actualiza la consulta. Las respuestas de una lectura anterior
no reemplazan la lectura más reciente ni entran en otra empresa.

La reserva no depende de que una caché localStorage de otro renderer ya se haya
actualizado. La [planificación de transacciones de IndexedDB](https://w3c.github.io/IndexedDB/#transaction-scheduling)
define la serialización y visibilidad de transacciones con ámbitos solapados.
Esto conserva referencias de recibos; no agrega una cola de formularios ni adjuntos offline.

Un recibo confirmado elimina su referencia exacta. Una falla antes del primer
envío permite descartarla; esa misma falla durante un reintento no elimina el
intento incierto anterior. `NOT_OBSERVED`, procesamiento pendiente, invitación
incierta o denegación de la consulta conservan la referencia. No hay vencimiento
que declare perdido un envío ni reenvío automático. Un UUID nuevo en el mismo
módulo/obra queda bloqueado hasta comprobar el anterior. La reconciliación
canónica de una invitación y su revocación explícita siguen disponibles.

La consulta global hace sólo GET. La revocación local observada permite cerrar
la alerta de participación sin afirmar entrega o revocación remota del correo.
El alta de empresa, la aceptación de invitación y el vínculo de WhatsApp siguen
consultando sus estados canónicos; no se inventa un recibo genérico para ellos.

**Límite:** se recupera la consulta de resultado y se conserva la protección del
intento. No se reconstruyen los campos ni los archivos de un formulario cerrado.
Si todavía no se observa un recibo, la referencia permanece pendiente y no se
genera otro UUID para simular una recuperación.

La recuperación de planificación también corrige su contrato real: el GET de
un recibo encontrado devuelve `saved:true`, coherente con el guardado y la
validación de la interfaz. La prueba de PostgreSQL pierde el ACK de un COMMIT
real y obtiene el resultado mediante el handler real, sin otra escritura.

## Menú y plantillas de WhatsApp

El menú presenta sólo las acciones permitidas para la participación vigente.
Una solicitud directa o un formulario iniciado antes de revocar un permiso
obtiene una respuesta explicativa y no ejecuta la operación denegada. Las
decisiones de avance y KYC siguen requiriendo al responsable autorizado.

La revisión de plantillas guarda un turno y una versión en la metadata canónica.
Antes de crear y al confirmar se comprueban conexión, WABA, credencial, intento,
definición y versión. Una consulta antigua no puede reemplazar una observación
nueva. Un resultado incierto borra el estado de aprobación actual; la última
observación confirmada se conserva sólo como historial explícito.

La creación y aprobación de plantillas en la WABA cliente y su entrega real
requieren el circuito del proveedor. En este bloque inicial, `canSend:false` no se presenta como envío
disponible. Los menús dentro de la conversación usan el transporte canónico
existente. No se crearon plantillas ni se enviaron mensajes reales durante estas
pruebas. No se cambiaron tokens, app, WABA ni número demo.

## Bandeja y seguimiento de la obra

La bandeja privada tiene acceso propio desde la obra, agrupación visual por
remitente, historial, filtros, búsqueda sobre las páginas consultadas y
paginación por cursor. Mensajes, estados del proveedor y avisos permanecen
distintos. Los conteos corresponden a las páginas cargadas, sin métricas
globales inventadas ni identidad inferida por coincidencia de teléfono.

Se reutiliza `WebhookEvent`, su contenido cifrado, su prueba de origen, el
procesador y las revisiones canónicas. ADMIN/DIRECTOR vuelven a acreditar su
pertenencia y obra en servidor. El cursor se comprueba contra el canal de esa
obra antes de consultar eventos anteriores.

La revisión se confirma con la auditoría del actor, obra, evento y UUID exactos.
Procesar un evento no crea un recibo ficticio: se consulta su estado durable,
indicando expresamente que `EVENT_PROCESSED` no atribuye ese procesamiento al
UUID del administrador. Una respuesta general HTTP 200 no confirma ninguna de
estas dos operaciones.

**Alcance de la bandeja:** atención y seguimiento operativo del equipo de una
obra. La bandeja anterior se reemplaza por esta única interfaz; no incorpora
composer manual ni exportación de cuerpos privados. El bloque posterior de
[CRM de la constructora](./constructor-crm.md) adopta cuentas y oportunidades del
modelo enterprise y acredita su publicación y aceptación por separado.

## Validación y aceptación

Las nuevas pruebas cubren transacciones reales en PostgreSQL desechable,
consultas de recibos después de COMMIT, carreras de plantillas, paginación y
aislamiento, revisión exacta, cancelación y pérdida de respuesta. Los recorridos
de navegador usan componentes reales con servicios controlados, recarga y
reapertura, dos pestañas concurrentes, almacenamiento bloqueado, permisos y
cuatro tamaños de pantalla. Los scripts nuevos están incorporados al CI.

La [aplicación de referencia oficial de Meta](https://github.com/fbsamples/business-messaging-sample-tech-provider-app)
documenta Embedded Signup, plantillas y recepción como capacidades distintas.
No se utiliza su ejemplo como evidencia de permisos, aprobación o entrega en
esta aplicación. El SDK histórico de Meta está archivado y no se agregó como
dependencia de runtime.

Implementado, probado, publicado y aceptado son estados separados. El ingreso
humano, correo de invitación, KYC real, geolocalización/QR del teléfono y recorrido
de obra por WhatsApp permanecen pruebas independientes. Tampoco la presencia de
variables de configuración demuestra Advanced Access o el alta de cualquier
cliente. MuniControl no forma parte de este bloque.

El bloque posterior de [recordatorio autorizado de jornada](./manual-template-reminder.md) agrega un envío manual específico con consentimiento, reserva durable y estados firmados; su implementación y publicación se acreditan por separado.

## Compras: autorización vigente, recibo y conflicto

Un resultado de compra se confirma antes de retirar la referencia del navegador: ámbito, obra, UUID, recibo durable, acción y pedido deben coincidir. El recibo mínimo se obtiene de AuditLog versión1 existente, actor/organización y operación determinista; no requiere migrar metadata histórica ni crear otro motor. Un cuerpo incompleto o cruzado conserva la referencia y no habilita un segundo envío. La recuperación global aplica la misma validación después de recargar.

Una denegación vigente oculta proveedores, importes, entregas, decisión y borrador. Sólo queda la referencia mínima del intento ya despachado. «Cerrar consulta y conservar referencia» permite volver a consultar el contexto sin hacer ACK; un borrador ocultado no se reconstruye ni reenvía. La falta de token antes de despachar sigue conservando el borrador local y no crea un recibo ficticio.

Ante conflicto, «Consultar pedido vigente» usa GET requestId de un solo pedido autorizado, sin barrer páginas. Conserva campos y motivo, compara estado/importe vigente y exige «Revisé el pedido vigente y quiero continuar». La nueva decisión usa un UUID nuevo y la revisión consultada. Si la transición dejó de ser válida, no se habilita confirmar la acción anterior. requestId es mutuamente excluyente con after/operationId; la frontera canónica por actor/empresa/obra no cambia.
