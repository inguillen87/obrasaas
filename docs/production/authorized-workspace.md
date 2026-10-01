# Obras y cronograma de la cuenta autenticada

## Alcance implementado
`/cuenta` conserva la sesión personal verificada y la marca v3. Agrega un selector oficial de organizaciones y un espacio que consulta proyectos y tareas del registro canónico de PostgreSQL. No copia ni abre el agregado histórico `obrasaas_app_state`, ni sustituye falta de permisos/datos con los ejemplos de `/demo`.

El endpoint exacto `/api/identity/workspace` verifica el mismo JWT RSA de Clerk (emisor, origen autorizado, algoritmo y vencimiento) y obtiene el contexto de organización sólo después de esa verificación. Soporta claims oficiales v1 y v2; claims contradictorios o impersonación no obtienen ámbito empresarial. Los claims no crean usuarios, empresas, roles o pertenencias. La API personal `/api/identity/session` sigue sin devolver identificadores o roles.

Cada petición busca la pertenencia canónica vigente del usuario, organización y rol Clerk. ADMIN y DIRECTOR ven los proyectos activos de su organización; SITE_MANAGER, FINANCE y AUDITOR requieren además una pertenencia de proyecto activa. Sólo ADMIN, DIRECTOR y SITE_MANAGER pueden planificar fechas. El navegador no decide ninguna de esas autorizaciones. Se excluye la organización interna.

Los datos se presentan en un cronograma por tarea con fechas previstas, estado y porcentaje REGISTRADO. Un porcentaje registrado no acredita revisión visual, KYC, certificación de avance o conformidad contractual. Una tarea sin fechas no recibe fechas ficticias. La vista indica la cantidad de registros y pagina las tareas sin descartarlas silenciosamente.

## Cambio de planificación
El responsable puede editar inicio/fin previstos, con motivo obligatorio. Cada solicitud lleva un UUID de operación, el contexto consultado y la revisión original exacta de PostgreSQL, conservando seis dígitos de microsegundos. Una versión antigua se rechaza; no se sobreescribe por un 'último guardado gana'.

La transacción vuelve a verificar y bloquear las filas de autorización, el proyecto y la tarea. Actualiza sólo startsAt, endsAt y updatedAt de Task; registra antes/después y motivo en AuditLog con actor y organización. No modifica progreso, estado, horas, dependencias, empleados o seguros. Un fallo del recibo revierte el cambio.

Repetir una misma solicitud confirmada recupera su mismo recibo, no una segunda escritura. Una clave usada con un cuerpo distinto da conflicto. Si se pierde la confirmación del commit, la interfaz conserva el intento y permite consultar su recibo. Un recibo todavía no observado NO se presenta como rollback definitivo, y no se reenvía automáticamente.

El servidor exige origen canónico para POST, JSON limitado, contexto firmado y pertenencias vigentes. No almacena tokens, roles o operaciones pendientes en localStorage. Los cambios de usuario u organización desmontan la vista anterior. Las respuestas tardías de una obra anterior no reemplazan la selección actual. Todo dato privado y recibo se devuelve con no-store.

## Aceptación ejecutada antes de publicar
El código funcional del SHA 02165a9e48975fdb9908db0ee97e2340cce34fdc aprobó los workflows 36799249840 (control completo de producción) y 36799249846 (workspace).

`verify-workspace-postgres.mjs` usa un PostgreSQL17 local y una base efímera exclusiva. Prueba separación entre empresas/proyectos, roles de lectura/edición, revocación antes y durante la transacción, concurrencia de reintentos, conflicto de versiones, rollback al fallar auditoría, recuperación tras confirmación de commit perdida y paginación. El script rechaza Neon, Vercel y bases que no sean expresamente desechables. No tocó datos productivos.

`verify-workspace-ui.mjs` compila y ejecuta el componente real en un servidor aislado e intercepta exclusivamente respuestas API SINTÉTICAS. Probó 320,390,768,1280 px, guardado con recibo, conservación del porcentaje, lectura sin botón de escritura, ausencia de pertenencia, obra vacía, resultado incierto, conflicto y cambio de selección con respuesta tardía. Cero pageerrors y sin desbordamiento horizontal en esas comprobaciones. Capturas y pruebas están en el artefacto `workspace-acceptance-36799249846`.

Se revisaron las capturas de escritorio y móvil. Esa evidencia no equivale a una sesión de empleado en producción, una escritura sobre una obra real o una recepción de WhatsApp. La aceptación productiva autenticada y la selección de los participantes siguen separadas.

## Preservación y puesta en producción
No requiere migraciones ni crea filas de negocio por desplegar. Utiliza únicamente las tablas canónicas existentes verificadas con lecturas de esquema. La conexión es perezosa, pequeña y con TLS verificado; no hay fallback al archivo local, otra URL de base o fixtures.

El bloque incluye por ascendencia las correcciones previas de Meta del SHA a28ac964. No genera ni cambia access tokens, App Secret, Verify Token o números. La correspondencia de prueba pendiente y la firma de recepción deben resolverse en la configuración del mismo producto; esta funcionalidad no declara cerrado ese canal.

`/api/health` expone sólo el SHA de despliegue cuando Vercel lo informa con formato válido, la versión funcional y el requisito de pertenencia. No consulta la base ni acredita vigencia de proveedor por mirar una variable.

## Pendiente del piloto de campo
Vincular y aceptar los participantes concretos del piloto, roles operativos de trabajadores, captura/revisión privada de KYC, jornada con ubicación/sector, recepción de evidencia multimedia, propuesta y aprobación de cantidades y su actualización del progreso real. La planificación manual de fechas NO sustituye ese recorrido. No reasignar registros históricos ambiguos ni dar un rol por coincidencia de teléfono o nombre.
