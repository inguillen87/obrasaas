# Alta de una constructora nueva, antes de contar con su teléfono

Base revisada: `16a70b5bd71fbdbfb457106f701dbc125876201b`. Este bloque cierra la creación canónica de empresa/primera obra y tareas. No etiqueta la conexión Meta, KYC, jornada o módulos económicos como terminados.

## Recorrido disponible

1. El cliente inicia sesión y verifica el correo en Clerk. Crea o selecciona su organización usando el componente oficial que ya existe en Mi cuenta. No necesita credenciales de un desarrollador.
2. Sólo un administrador de ESA organización, con el rol autenticado en el token firmado, puede iniciar el alta. Una organización ya vinculada no se reasigna ni vuelve a darse de alta. Las cuentas sin pertenencia a una empresa existente no se autoelevan.
3. Confirma nombre de empresa, nombre de primera obra y dirección opcional. Puede dejar el plan vacío o escribir hasta25 tareas iniciales y fechas previstas. No se generan etapas, empleados, mensajes, importes o progreso de ejemplo.
4. El servidor crea Organization, PlatformUser cuando corresponda, TenantMembership ADMIN para ese creador y esa empresa, Project, ProjectMembership y únicamente las tareas indicadas. No asigna SystemRole de superadministrador. Las suscripciones quedan con los defaults TRIAL/TRIALING del esquema y vencimiento de ensayo a14días; no se crea una suscripción externa ni se cobra nada.
5. La misma transacción registra el recibo. El usuario abre Mis obras, consulta el cronograma y agrega más tareas con Nueva tarea. Cada tarea nueva nace BACKLOG y progreso0, sin horas o cumplimiento implícitos.

## Identidad verificada, sin trasladar claves privadas

Se configuró, mediante la CLI oficial de Clerk y únicamente en la instancia Production de ObraSaaS, la plantilla adicional `obrasaas-bootstrap-v1`, lifetime60s. No cambia los tokens de sesión existentes, factores, correo, contraseñas o secretos de la aplicación.

La creación exige DOS comprobaciones: sesión ordinaria firmada con la organización activa y org:admin; y prueba de perfil firmada por Clerk para la audiencia exclusiva `https://obrasaas.com/company-onboarding`, propósito `new-constructor-profile`, versión1 y el mismo sub. Esa prueba contiene el correo primario del usuario y email_verified booleano real. No se toma un correo del formulario como identidad ni se genera uno de relleno.

Ambos JWT se verifican contra las claves públicas del emisor Production ya fijado. Algoritmo, firma, audiencia, sub, vida útil y campos de la prueba se comprueban en servidor. No se acepta impersonación en la prueba ni se usa para otorgar autoridad a otras rutas. El código de frontend solicita los tokens oficiales con getToken; no muestra ni persiste ninguno en localStorage.

Una colisión con el correo/usuario histórico se rechaza sin fusionar. El perfil previo de un PlatformUser existente no se sobreescribe por completar otra empresa. La organización declarada por el usuario debe coincidir exactamente con el contexto firmado de la solicitud, incluso al cambiar de pestaña.

## Persistencia, concurrencia y límites

Se conservan los contratos canónicos de las tablas reales de Production, revisadas por information_schema, índices y triggers. No se ejecuta Prisma migrate ni se cambia el esquema. Conexión perezosa al pool actual, TLS verificado.

Los intentos se serializan por usuario/organización y por correo al crear usuarios. IDs internos aleatorios, claves únicas existentes, recibo por usuario+organización+UUID, fingerprint del contenido y transacción única impiden crear dos empresas con la misma autorización. Si una conexión falla después del commit, la consulta de recibo permite recuperar el resultado sin una segunda creación. Un usuario o membership revocado no se reactiva al recuperar el intento.

Hay un límite de tres altas nuevas por usuario en24h, comprobado dentro de la transacción, sin sustituir los límites del proveedor. Ningún dato financiero, worker, canal WhatsApp o registro global de la demo se importa al crear la obra.

## Tareas después del alta

`/api/identity/task-creation` usa sesión firmada, pertenencia canónica y el mismo permiso de planificación. Alta explícita de título y fechas opcionales; no admite progreso ni roles en el body. Cuenta con recibo, recuperación y rechazo de una clave repetida con otro contenido. El propietario/usuario de otra empresa no puede consultar o crear en la obra ajena.

Los cambios de fechas posteriores usan el cronograma auditado publicado en el bloque anterior. Una tarea recién creada y una foto no acreditan avance ejecutado. Los recibos de planificación y creación están separados.

## Prueba reproducible antes del número

`verify-company-onboarding-postgres.mjs` usa PostgreSQL17 LOCAL DESECHABLE. Abre dos clientes sintéticos aislados, una empresa con cero tareas y otra con plan inicial, valida acceso inmediato al workspace y cronograma, creación posterior de tareas, concurrencia, conflicto, recuperación tras commit con respuesta perdida, revocación y rollback de TODO el alta si falta auditoría. No usa Neon ni credenciales de empleados.

`verify-company-onboarding-ui.mjs` usa los componentes reales con servicios HTTP interceptados y datos sintéticos. A320/390/768/1280 prueba alta vacía, alta con tarea, apertura del workspace, nueva tarea, confirmación perdida recuperada y rechazo de un correo no verificado. No equivale a ingreso humano real en Production ni a una verificación de número Meta.

## Qué requiere el número nuevo

El número debe estar bajo control del cliente y poder recibir el código por SMS o llamada según la opción admitida por Meta. El cliente autoriza en Embedded Signup su portafolio, WABA y número. El código OTP demuestra control del número, no otorga por sí solo todos los permisos ni completa la configuración de ObraSaaS.

La app de proveedor sigue siendo ObraSaaS, pero los activos y credenciales resultantes del cliente son independientes del número de prueba. No se compra ni registra otro número antes de recibir el autorizado. No se generan códigos ficticios ni se marca un número verificado sin respuesta del proveedor.

**La autorización Meta completa de clientes sigue pendiente en la versión base.** También siguen pendientes invitación/vinculación operativa de empleados, revisión KYC, horas por sector, evidencia y aprobación de avance, y módulos económicos de cada empresa. La apertura canónica y el cronograma no convierten estos pendientes en módulos listos.

Para la prueba física deben verificarse por separado: autorización/OTP real, conexión de esa WABA, callback firmado persistido, primera respuesta y estado de entrega. Si falta la configuración de plataforma para hacerlo, no se compensa pidiendo tokens al cliente ni se promete que un número nuevo lo solucionará.

Fuentes primarias consultadas: Clerk, Session tokens/JWT templates/Organization management; Meta, Embedded Signup y colección oficial WhatsApp Business Platform. Verificar siempre los permisos y requisitos concretos de la app antes de generalizar el alta a cualquier cliente.

## Prueba del emisor real de identidad
Se verificó la plantilla de perfil contra Clerk Production usando un acceso oficial de un solo uso para la cuenta técnica de QA ya existente (ningún empleado). La sesión firmada y el token de perfil pasaron sus verificadores reales, incluido email_verified booleano. Se eliminó únicamente la organización temporal creada para esa comprobación y se cerró la sesión; no hubo registros de negocio productivos. Esta prueba no verifica recepción de email por un nuevo usuario humano.

El prebuild de esta entrega también incluye un chequeo opt-in de esquema: una transacción explícitamente READ ONLY consulta exclusivamente columnas y privilegios de las siete tablas requeridas usando el entorno de Production. El resultado efectivo se registra después de ejecutarlo. No se utilizan registros personales ni DML y un build ordinario no lo ejecuta sin el marcador.
