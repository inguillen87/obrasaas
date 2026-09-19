# Canales por obra e identidad privada por empresa

Decisión del propietario del producto aclarada el 19/09/2026. Base de este cambio: 5b4cea6e3586780e62142bb85764d0db4a5a1850.

## Modelo operativo prioritario
Una constructora administra los números que autoriza y puede conectar un número distinto para cada obra. Un trabajador usa su mismo WhatsApp para comunicarse con cualquiera de esas obras o con otra constructora. El número de destino identifica el canal y la obra; no es necesario preguntar al trabajador en qué empresa trabaja cuando el destino ya es inequívoco.

El número comercial de ObraSaaS no es necesario para este circuito y no recibe partes de los tenants. Compartir un único número entre varias obras de una empresa queda como modalidad futura opcional, no como requisito previo para operar números separados. No se crea una WABA nueva por cada obra por defecto: la pertenencia del número a la cuenta autorizada se comprueba en el alta existente.

## Identificación no equivale a identidad legal ni acceso automático
El teléfono/identificador del proveedor sirve para reconocer un contacto en el canal. No sustituye al DNI, CUIL, identidad verificada ni legajo. Puede cambiar, revocarse o pasar a otra persona: el historial debe seguir ligado a la identidad interna estable de ese tenant, con cambio de contacto verificado.

Una misma persona puede tener registros independientes en dos empresas. Dentro de la misma empresa, sus asignaciones y roles por obra son explícitos. Estar autorizado en A no da acceso a B; la baja en una obra no elimina una asignación válida en otra. No copiar perfiles, datos bancarios, recibos o historial de un empleador a otro por coincidencia de teléfono.

La privacidad es aislamiento entre clientes, no invisibilidad absoluta del número para Meta o para la empresa autorizada. No prometer anonimato ante el servicio de mensajería. La interfaz sólo debe presentar los datos permitidos en el contexto actual.

El código existente usa WorkerPerson/WorkerChannelIdentity dentro de una organización y Worker como vínculo de obra. Las huellas de búsqueda incluyen la organización; el mismo teléfono no da la misma huella de cliente en las pruebas criptográficas. El resolver vuelve a comprobar estado, revocación y asignación de obra. Estas propiedades se ensayan sin cambiar claves ni autorizar automáticamente a nadie.

## Defecto del alta anterior corregido
La preparación del asistente se almacenaba como un único objeto de Organization y reservaba una «primera obra». Preparar una segunda obra reemplazaba esa elección. Ese comportamiento no corresponde al uso de números separados solicitado.

Ahora cada obra guarda su preparación bajo Project.metadata.whatsappWorkspace, schemaVersion 2: nombre, tipo de número, circuitos deseados y revisión independientes. El JSON de Organization no se reescribe. La preparación legacy de schemaVersion 1 sigue leyéndose sólo desde la obra que ya indicaba. Si se modifica esa preparación, la nueva versión se guarda en Project y la anterior queda intacta como antecedente.

El formulario fija el destino a la obra abierta. No lista ni cambia otras obras desde el mismo guardado. El servidor comprueba que body.initialProjectId coincide con la obra de la sesión y guarda únicamente en ese Project. El nombre del campo se conserva para compatibilidad del contrato; ya no significa un valor único para toda la empresa.

Se mantienen la comprobación de empresa, bloqueo de organización para serializar la preparación/autorización, revisión optimista del Project, auditoría atómica y validación antes de Meta y dentro de la transacción de guardado. Actualizar la obra B no invalida la revisión de la obra A. Una respuesta perdida sólo recupera el mismo guardado; no genera otro evento ni reactiva un canal.

La lectura devuelve únicamente la obra actual y no expone la preparación de otras obras. Una obra archivada/finalizada conserva la consulta, pero no habilita una autorización nueva. No se crea un canal por guardar el formulario. Las conexiones existentes, participantes, mensajes y credenciales no se modifican como efecto secundario.

## Menú operativo por rol
La respuesta a «menú»/«ayuda» del motor de mensajes utiliza la matriz de intenciones existente. Identifica la obra y el rol, y anuncia sólo comandos admitidos para ese rol. Permite encontrar jornada, evidencia, incidentes, avances autorizados, demoras según rol, datos de cobro propios y licencia mediante su circuito privado.

«Datos de cobro» no equivale a efectuar un pago. Un operario no recibe opciones administrativas para adjudicar licitaciones o transferir fondos. No se anuncian como listas las funciones aún no conectadas. Ocultar una opción no es el control de seguridad: el servidor conserva la validación de cada intención al ejecutarse.

El menú de esta fase es una respuesta textual contextual del backend, no un nuevo WhatsApp Flow interactivo ni un agente que active todos los módulos automáticamente. El envío y la entrega real siguen sujetos a credenciales válidas y a las verificaciones del canal.

## Verificación
Se amplían pruebas sobre el resolver canónico existente con el mismo teléfono en dos empresas y tres obras: huellas separadas, roles distintos, revocación en una empresa sin revocar la otra, baja de una obra sin perder otra y ausencia de alta automática por coincidencia de teléfono. Se usan criptografía real y almacenamiento controlado; no son altas de trabajadores reales en Meta.

Las pruebas de preparación cubren dos obras con revisiones independientes, lectura legacy sólo en el origen, migración bajo demanda del perfil al Project sin borrar el antecedente, rechazo de metadata contradictoria y guardado idempotente. Se amplía el navegador controlado para cambiar entre obras, comprobar que una no recibe el perfil de la otra y conservar consentimientos/recuperación.

Se ejecuta el motor real para mensajes de ayuda de tres roles sin mutar asistencia, incidencias ni avance. No se hacen llamadas a Meta ni pagos en ese ensayo. Los resultados concretos de suite, build y deployment se registran en el PR con SHA, separados de la prueba física pendiente del canal.

## Continuación del plan
Priorizar el alta/autorización de participantes y el circuito de terreno completo en un número por obra. Luego ampliar materiales, ubicación/horarios y documentos con las políticas de cada módulo. Pagos empresariales, licitaciones, firma y certificación mantienen decisiones específicas. La modalidad de un número compartido entre varias obras se diseña aparte y no bloquea el lanzamiento de la modalidad por obra.

No se cambiaron las fuentes v2.4 adjuntas ni el walkthrough: son antecedentes del alcance y los roles. Esta nota y el plan v3.1 expresan la aclaración nueva y lo implementado en esta rama. No convierten las afirmaciones de demo o legales de esos antecedentes en verificaciones de producción.
