# S11.A5.1 — Menú interactivo de campo y acciones existentes

Base: `7e99ebd283eaa1065d473f360f38b239cbc76192`. Fecha: 19/09/2026.

## Circuito implementado
El saludo simple, «menú» o «ayuda» de un participante autorizado preparan una respuesta de lista interactiva de Meta. La lista se construye según su rol y la obra de destino. Incluye jornada, evidencia, incidencia, propuesta de avance, demora, datos de cobro y licencia únicamente cuando la matriz de permisos lo permite. No añade opciones para adjudicar, transferir fondos o aprobar automáticamente avances.

«Mi jornada» abre un segundo menú con ingreso, pausa, regreso, salida y vuelta al menú principal. Abrir ese menú no ficha al trabajador. Elegir una acción invoca el mismo dominio de asistencia utilizado por el comando de texto correspondiente: ingreso pendiente de GPS, pausa/regreso sobre una jornada válida y salida que conserva el requisito de ubicación. No hay un nuevo endpoint que escriba fichajes directamente.

«Informar incidente» utiliza el circuito existente y pide detalles; elegir el botón no fabrica un incidente. El mensaje posterior con la descripción entra al motor actual y sus controles. Evidencia, avance y demora muestran instrucciones antes de registrar o proponer. Datos de cobro y licencia mantienen sus formularios protegidos; la selección no ejecuta pagos.

## Identidad y autoridad
Las opciones tienen identificadores versionados y un namespace derivado de empresa, obra, participante y número de destino. Un menú copiado de otro ámbito no se interpreta aquí. El namespace no es secreto, una firma o una credencial: la autoridad proviene del webhook verificado y del resolver canónico actual, no del conocimiento de una opción.

El motor utiliza el identificador exacto, nunca el título visible suministrado por el cliente como comando. Un texto alterado como «avance 100%» no puede reemplazar una selección de evidencia. Opciones desconocidas, versiones ajenas, contextos distintos, roles insuficientes y selecciones mezcladas con ubicación/medios se rechazan sin una acción de negocio. Los otros dominios de Flow y botones existentes se conservan.

Antes de materializar el menú saliente se consulta nuevamente la obra, conexión y participante actuales. Las filas se recalculan con el rol actual; un participante revocado no recibe un menú nuevo. Al elegir una opción se vuelven a comprobar los permisos, sin heredar autorizaciones de un mensaje viejo. No se concede acceso por enviar «hola» desde un número desconocido.

## Entrega durable
El resultado del webhook conserva un descriptor pequeño de menú, no una credencial, payload arbitrario o lista de datos privados. El envelope no admite combinar un menú con un Flow, recibo privado o enlace seguro en el mismo despacho. Su recuperación exige conservar la obra original.

El sender consulta la credencial cifrada del número y tenant exactos; no recurre a un token global para este nuevo tipo de envío. Usa la reserva y liquidación de entrega automática existentes. Una aceptación sin identificador del proveedor es incierta. Un error o una respuesta perdida no disparan un texto de respaldo ni otro menú que pudieran duplicar la entrega. Un reintento consulta la reserva y su resultado antes de enviar.

Las respuestas textuales y envelopes anteriores siguen soportados. Un build o un payload bien formado no demuestran recepción por Meta. El nuevo sender no renueva credenciales vencidas ni publica un Flow automáticamente.

## Validación y evidencia
Los tests ejecutan el normalizador de Meta, motor de mensajes, contrato del envelope y despachador automático reales con dependencias externas controladas. Se prueban contexto cruzado, cambio de rol, títulos manipulados, revocación, token vencido, falta de scope, aceptación sin ID, rechazo y resultado incierto. La prueba de asistencia usa el dominio real y una base controlada: el botón de ingreso crea una solicitud pendiente, la confirmación GPS se ensaya aparte, pausa/regreso usan la misma jornada y elegir salida no la cierra sin ubicación.

`node scripts/verify-native-field-menu.mjs` renderiza el payload de lista en un navegador local con rótulo de ensayo. No es una captura de WhatsApp Web ni prueba de entrega a un celular. Permite recorrer menú → jornada → menú → incidente → registro con el normalizador y el motor actuales; las acciones y el estado permanecen en memoria de esa prueba. Comprueba cuatro anchos y rechazo de una opción emitida antes de cambiar el rol.

La entrega depende de una credencial vigente y un participante autorizado de la obra. Esta implementación no obtiene un token nuevo ni registra personas automáticamente. El estado de Vercel, suite y smoke se consigna con el SHA de la entrega en el PR. El estado del piloto físico no se presume actualizado por pruebas locales.

## Continuación
Cerrar el ensayo con el número real: pedir «menú» desde un participante autorizado, comprobar la lista recibida, abrir la jornada, registrar ubicación mediante el circuito protegido y verificar cada entrega en el historial del tenant. Después ampliar partes/materiales y procesamiento de medios utilizando las mismas identidades y controles. No convertir la selección del menú en autorización para pagos, compras, modificaciones directas del Gantt o acceso a otras obras.
