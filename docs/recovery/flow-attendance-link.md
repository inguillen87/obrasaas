# S11.A27 — Del formulario de ingreso al registro de asistencia

Base: `34e5d55afa421240fb1886d7ddb2e7b9f11a09e6`.

## Vínculo explícito del backend
El procesador de respuestas `shift-check-in` registra en el mensaje entrante un recibo mínimo del AttendanceEntry que devuelve `ensurePendingGeoAttendance`: versión, entryId, proyecto, trabajador y sesión. No utiliza un identificador aportado en el formulario. El módulo puede devolver un pendiente existente: el recibo conserva ese registro, no inventa uno nuevo ni busca por teléfono/fecha.

Los efectos del ingreso y el mensaje se guardan por el escritor de webhook transaccional existente. No cambia el protocolo de consumo, la idempotencia, la geocerca, las credenciales o la entrega. Los datos del recibo no contienen ubicación ni tokens. Las respuestas previas sin recibo no se rellenan ni se reconstruyen retrospectivamente.

## Consulta operativa
Bandeja → Seguimiento de formularios → Consultar respuesta vinculada → **Consultar ingreso vinculado**. La opción se presenta para una respuesta de ingreso correlacionada y un usuario con permiso de asistencia. GET `mode=attendance` exige ambos permisos: conversaciones y asistencia, junto con contexto y origen vigentes.

Se reutiliza la cadena exacta envío → sesión consumida → mensaje recibido. Después se valida el recibo y se consulta el AttendanceEntry del mismo proyecto/trabajador. Su jornada, cuando existe, se verifica por id, proyecto y trabajador. Cada lectura usa un único snapshot RepeatableRead. Un ID de otro ámbito, estado incoherente, recibo inválido o mensaje no disponible devuelve indisponibilidad, no otro registro.

Se muestran el identificador del ingreso, su fecha y verificación actual; cuando corresponde, la jornada actual y su fecha laboral. El plazo de ubicación se calcula con la ventana del dominio existente y la hora del servidor. Un pendiente pasado de plazo se explica como vencido por tiempo, sin modificar el estado almacenado. Presencia, geocerca, identidad, horas pagables y nómina siguen siendo controles distintos.

**Abrir control de asistencia** lleva a la sección general; no se presenta como filtro automático ni enlace a una jornada exacta. El registro exacto se consulta en este panel. No hay edición, aprobación, cancelación, GPS, anexos, datos médicos o nómina desde la bandeja.

## Recuperación y privacidad
La consulta es explícita y no depende de una credencial Meta vigente. Actualizar retira los resultados anteriores. Fallar, cerrar o cambiar conversación descarta respuestas tardías. Pasar offline desmonta el estado de consulta; reconectar no consulta ni reutiliza un resultado. Revocación detectada bloquea nuevas consultas. Una falta de vínculo legacy se distingue de una respuesta no procesada y de un registro inconsistente.

El permiso de UI no autoriza el endpoint: el servidor revalida por separado antes de abrir la base. No hay coordenadas, teléfonos, documentos, texto del mensaje ni claves de sesión en el DTO de asistencia. La consulta no manda WhatsApp, completa ingresos, cambia jornada o escribe auditoría.

## Verificación y límites
Pruebas de motor: recibo del registro nuevo, reutilización del pendiente exacto, ausencia de vínculo en respuestas vencidas y rechazo de identidades incongruentes. El lector/contrato/ruta prueba alcance, privacidad, revocación, ausencia legacy, estado actual, reloj y respuestas inválidas.

`verify-flow-attendance-ui.mjs` monta ProactiveFlowReply, el panel nuevo, las rutas y servicios reales con identidad/base/HTTP de ensayo; cubre doce escenarios, cuatro anchos y cero escrituras de red. El verificador SQL amplía la suite de historia sobre PostgreSQL desechable: entrada real del dominio, lectura exacta, vencimiento observado sin escritura, recibo ajeno, ausencia legacy y aislamiento. El estado de jornada completada se verifica en el contrato y navegador con datos controlados; esta ampliación no simula una ubicación física.

Las suites autenticadas existentes se ejecutan por el SHA publicado, pero no equivalen a una nueva prueba física de este ingreso. La nueva trayectoria no debe declararse probada con Meta por pasar CI. Los resultados, artefactos y publicación se registran en el PR.

Sin nuevas tablas, dependencias, roles o rutas públicas. No se modificó Production, no se renueva la autorización piloto y no se migran activos de otros productos. La correlación de incidencias y otras clases de registros permanece como un tramo posterior.
