# Cronogramas recibidos por WhatsApp

El canal transporta una fuente autorizada al mismo motor de importación de la web. Prepara un borrador privado; no ejecuta decisiones ni aplica tareas desde el chat.

## Recorrido

1. El participante debe tener cuenta, ficha propia activa, revisión de identidad aprobada, asignación a la obra y vínculo de WhatsApp firmado vigentes. El teléfono empresarial no identifica al autor. La cuenta limitada de revisión de Meta no puede importar, aunque una asignación de rol inconsistente la declare administradora.
2. En un canal empresarial, la persona elige y confirma la obra y después selecciona **Importar cronograma** en el menú. Administrador, Director y Jefe de obra pueden preparar la importación; las curvas de inversión requieren Administrador o Director.
3. Elige PDF/imagen, Excel mensual, partidas CyP o, si su rol lo permite, un perfil con curva. Envía el archivo respondiendo al mensaje vigente. Documentos sueltos o de otra obra no se descargan.
4. Tras recibir la referencia del archivo, lee el aviso y confirma **Extraer borrador**. PDF e imagen requieren autorización de almacenamiento privado y extracción con OpenAI; el Excel compatible se almacena en privado y se lee localmente, sin macros ni recálculo de fórmulas. Cancelar antes de autorizar no inicia descarga, almacenamiento o extracción.
5. El bot informa el resultado y ofrece el acceso a la obra y al borrador. La web conserva las acciones de comparar con la fuente, completar fechas, resolver observaciones, guardar correcciones y aplicar tareas. Las nuevas tareas empiezan con avance cero.

El enlace lleva únicamente los identificadores de la obra y del borrador. Los conserva al iniciar sesión, pero sólo abre el borrador después de comprobar el acceso canónico a la obra y consultar los permisos de revisión vigentes. Las invitaciones de participación o revisión tienen prioridad. La apertura hace consultas GET; no vuelve a extraer ni aplica tareas. Una fuente o corrección local y un recibo pendiente mantienen su contexto: para abrir luego el enlace se requiere una navegación nueva explícita.

## Archivos y alcance

El límite del producto es 3 MiB para documentos y 2 MiB para imágenes, comprobado contra metadata Graph, headers, stream y digest; una declaración del webhook no demuestra el tamaño real. La descarga usa exclusivamente una URL obtenida mediante el media ID en Graph, ligada al teléfono empresarial. No se siguen URLs o redirecciones recibidas en un documento o mensaje.

Se pide PDF, PNG/JPEG o XLSX por chat. El lector interno puede reconocer también XLSM y WebP si Meta entrega realmente esos MIME autorizados. No se promete que WhatsApp admita esos formatos en todos los recorridos: su documentación de medios enumera PDF/XLSX y JPEG/PNG; el XLSM compatible también puede cargarse desde la web. Fuente oficial: [colección de medios de Meta](https://www.postman.com/meta/whatsapp-business-platform/folder/13382743-ecb27be5-4d27-4763-bbee-6a8002c04bf3), consultada el 12 de octubre de 2026.

El límite de extracción es 50 tareas de PDF/imagen, 50 rubros mensuales o 200 partidas CyP. Cada perfil utiliza su consentimiento canónico. La curva monetaria representa inversión prevista; no acredita avance físico ni cantidades consumidas.

## Integridad y recuperación

- La referencia fija evento y digest de fuente, persona, rol, empresa, obra, binding, conexión, ruta/epoch y revisión de asignación. La referencia vive 15 minutos; cada fase externa vuelve a comprobar la autoridad y el lease del inbox.
- La elección de extracción debe corresponder al nonce y al prompt enviado al mismo remitente. Se comprueban el outbound sellado, su estado, su contenido y la fuente firmada original.
- Antes de la primera descarga se guarda un intento sellado con un operationId determinista por evento. La observación de ese intento precede a cualquier descarga, Blob o extracción.
- Un resultado ya guardado se consulta sin repetir llamadas externas. Un borrador pendiente, fallido o vencido se informa como tal; no se sustituye por otro operationId. Una referencia vencida sin reserva de importación se cierra explícitamente sin iniciar efectos.
- Una reserva histórica puede observarse después del vencimiento de la referencia usando el momento del consentimiento original y la autoridad actual. Esto no renueva el plazo ni permite nuevos trabajos externos.
- La prueba de una reserva preparada conserva el evento ante una revocación. Esa prueba no concede acceso, no manda archivos al proveedor y no autoriza una repetición; cualquier recuperación vuelve a comprobar la autoridad vigente.
- La reserva de respuesta existente sigue rigiendo los envíos: una respuesta incierta no justifica otro POST. No se amplía la ventana de respuesta de Meta.

El bridge de operaciones de campo conserva su rol restringido. Sólo la composición interna de importación recibe el rol canónico actual, y no expone una operación de decisión por chat. Los grants OWN, sus activos y el resto de sus límites se conservan; una reactivación diferente invalida el intento capturado. Development Pilot conserva el bloqueo de medios.

## Aceptación

Las pruebas con fixtures cubren el contrato y los efectos del software. La aceptación requiere comprobar el archivo real enviado por un Director desde su teléfono, el borrador visible desde su cuenta en la obra correcta y una revisión independiente antes de aplicar. El archivo de Nueva Esperanza recibido de Victoria no se aplica automáticamente a la obra UNQ.
