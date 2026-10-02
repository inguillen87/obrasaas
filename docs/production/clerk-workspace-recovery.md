# Sesión activa y recuperación del espacio de trabajo

Este bloque extiende el transporte de sesión existente a los módulos del espacio
de trabajo. No crea otro motor de identidad, permisos, recibos ni procesamiento.
El comprobante de publicación, CI y aceptación humana se registra por separado,
asociado al commit publicado; este documento describe el comportamiento.

## Empresa y obra correctas en cada pestaña

Las consultas, operaciones, recibos y descargas usan un token fresco de Clerk de
la pestaña activa. Una cookie compartida que cambió desde otra pestaña no puede
reemplazarlo. Sin el proveedor de sesión de la pestaña, la petición no se envía.
El servidor sigue comprobando la firma, la pertenencia, el rol y el alcance de
la obra en cada petición.

Esto alcanza tareas y planificación, participantes e identidad privada,
invitaciones y autoservicio, jornada y evidencia, incidencias y materiales,
compras, vinculación de participantes a WhatsApp, preparación y autorización de
Meta y consulta operativa.

Los archivos privados se obtienen mediante una consulta autorizada antes de
crear una URL temporal del navegador. Los tokens de sesión no van en enlaces,
parámetros, nombres de archivo ni almacenamiento del navegador. El QR conserva
su comprobante propio de sector; no es una credencial de sesión.

## Esperas y confirmaciones

La renovación de sesión tiene un máximo de 15 segundos. Cada petición completa,
incluida la lectura del cuerpo, tiene un plazo acotado; las operaciones de
proveedor conservan sus plazos mayores. Al desmontar el módulo o cambiar de
cuenta se cancelan las peticiones pendientes. Un token que llega después no
puede iniciar un envío de la pantalla anterior.

Hay dos resultados distintos:

- Si falló la sesión antes de enviar la primera operación, se informa el fallo
  y se conserva lo escrito. El usuario puede volver a intentar explícitamente.
- Si la petición salió y se perdió la confirmación, se conserva su identificador
  y sus datos. Se consulta el recibo antes de reenviar. Una falla de sesión en
  ese reenvío no descarta el intento previo incierto.

No hay reenvíos automáticos de operaciones, invitaciones ni códigos de Meta.
El transporte no decide que una transacción desconocida se perdió.

## Alta de una constructora

El perfil firmado que acredita el correo tiene una vida breve. Tras comprobar
que el alta no se observa y que el servidor permite crear, un reenvío explícito
obtiene un perfil fresco. Conserva el mismo identificador y el mismo comando:
empresa, obra y tareas. La renovación de identidad no cambia el contenido de
la solicitud ni permite apropiarse de una empresa existente.

Una falla del proveedor de acceso no se presenta como prueba de que el correo
no está verificado. Si existe incertidumbre por un envío anterior, se conserva
el intento para consultar el recibo.

## Decisiones sobre participantes

Un conflicto de revisión conserva el fundamento y bloquea el guardado. El
responsable puede consultar el registro vigente sin cancelar el borrador,
revisar el estado y confirmar expresamente que quiere continuar. Si la decisión
ya no corresponde al estado actual, el formulario no la habilita. El servidor
vuelve a comprobar la revisión al guardar.

Una aprobación de avance confirmada comunica inmediatamente la tarea aprobada
al cronograma. Si falla la actualización posterior del listado de campo, el
recibo sigue visible y se pide actualizar la consulta; no se revierte ni se
repite la decisión confirmada.

## Referencias de producto y límite de la comparación

La separación entre acceso de empresa, rol y participación por proyecto se
contrastó con [Manage Project Members de Autodesk](https://help.autodesk.com/cloudhelp/ENU/Docs-Admin/files/project-administration/Manage_Project_Members.html)
y [Project Directory de Procore](https://support.procore.com/products/online/user-guide/project-level/directory).
Son referencias documentales de permisos e invitaciones, no pruebas ejecutadas
contra sus productos ni una afirmación de equivalencia funcional.

## Qué acredita la validación

Las pruebas locales de navegador usan los componentes reales con respuestas y
sesiones controladas. Cubren permisos visibles, borradores, conflictos, tokens,
abortos, recibos, descargas y tamaños de pantalla. Las pruebas de transacciones
usan PostgreSQL desechable. CI, Preview y producción se documentan con su commit
y resultado real.

Estos controles no acreditan la entrega de un correo a un participante nuevo,
su aceptación real, el uso físico del teléfono, la revisión humana de un
documento real ni el circuito completo de una obra por WhatsApp. Esos pasos
siguen siendo aceptación humana y de proveedor independiente.
