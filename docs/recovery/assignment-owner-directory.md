# S11.A18 — Directorio paginado de responsables de la obra

Base: `f684ce092feb97f1040f6ce05e86c870a6922234`. Mantiene agenda A16 y recuperación A17.

## Circuito funcional
El planificador conserva la consulta inicial de hasta 100 personas y 100 cuadrillas. Si el resultado está truncado, «Abrir directorio completo» permite recorrer todas las opciones activas de esa obra, de 30 en 30, o buscar por palabras del nombre. La consulta es explícita; escribir no dispara peticiones por tecla. Enter busca, no guarda el formulario de planificación.

Cada página está ordenada por nombre e ID y usa un cursor de continuación, sin offset creciente ni descarga completa del directorio. La búsqueda no distingue mayúsculas; las tildes se respetan. %, _ y barra inversa se tratan como texto literal, no como comodines. No se promete búsqueda difusa o una instantánea inmutable entre páginas: cambios externos pueden cambiar el orden; una búsqueda nueva empieza desde el inicio.

Elegir una persona/cuadrilla fuera de las primeras 100 la incorpora como selección explícita al formulario. No crea registros, permisos o asignaciones. Fechas y explicación se conservan; revisión de coincidencias y consentimiento siguen siendo obligatorios. La elección pertenece a la fuente/actividad/tipo consultados; refrescar las fuentes invalida esa elección adicional, conserva el ID del borrador como no disponible y exige volver a verificarlo en el directorio.

## Alcance de lectura
GET `/api/execution/assignments/owners` exige sesión, permisos execution:read y tasks:read, cabeceras de contexto coherentes con la sesión y una actividad canónica en esa obra. La revisión de Task debe coincidir. Sólo devuelve ID y nombre: no lee/exporta teléfonos, documentos, sueldos ni legajos completos. Las respuestas y errores son private/no-store.

El cursor vincula consulta, tipo, empresa, obra y revisión para impedir usos accidentales fuera de la búsqueda. No es una firma ni una autorización. Incluso un cursor alterado no reemplaza los filtros de empresa/obra ni los permisos del servidor. Se limita tamaño del cursor, texto y filas; la consulta pide 31 para devolver 30 e indicar continuación sin hacer un count global.

Los errores de red permiten reintentar sólo esa lectura. Las respuestas ajenas o malformadas no ofrecen selección. Una Task modificada deriva al recuperador A17. Cerrar/cambiar el contexto aborta la consulta y descarta respuestas tardías.

## Exclusión entre búsquedas y escrituras
Abrir el directorio retira revisión y consentimiento e invalida la consulta de coincidencias anterior. No se puede confirmar mientras el directorio está abierto, tampoco mediante un submit programático. Cerrarlo no restaura automáticamente la aprobación anterior: hace falta revisar de nuevo. Durante una escritura en curso o incierta no se puede abrir ni seleccionar en el directorio, y una respuesta tardía no puede reemplazar el estado del intento. Un POST incierto conserva su clave y cuerpo originales.

## Pruebas y operación
`assignment-owner-directory.test.js` y `assignment-owner-directory-handlers.test.js` cubren paginación, límites, aislamiento, cursores, palabras literales, permisos y caché. La ruta conecta expresamente getPlatformAccess y forma parte del inventario exhaustivo de rutas privadas (134); no se cambian ni amplían las excepciones públicas del Proxy.

El verificador PostgreSQL exige la conexión desechable local ya existente y usa 137 personas/73 cuadrillas sintéticas, sin credenciales de la aplicación. Se incorpora también como tercera suite independiente del workflow permanente de contratos PostgreSQL.

El verificador UI monta Planner real y los servicios reales con HTTP/base/identidad controlados: selección más allá de 100, navegación, borrador, errores, recuperación y guardado tras consentimiento. Retiene una respuesta antigua del directorio hasta después de una escritura cuya respuesta se pierde; comprueba recuperación del mismo intento, una asignación/auditoría y ausencia de reemplazo por la lectura tardía. No acredita Clerk ni una constructora real.

El candidato anterior `ef23f14` falló el inventario de rutas antes de los pasos SQL/UI/build. Ese fallo y su evidencia se conservan en el PR; el éxito sólo corresponde al árbol final realmente validado.

La validación completa del árbol, build, regresiones previas y publicación se registra por SHA en PR #1. Esta fase incorpora un endpoint de lectura y UI; no cambia esquema, dependencias, permisos de roles, lógica de escritura, Gantt, nómina o activos de Meta. Production y el recorrido autenticado del SHA actual conservan sus requisitos propios. La copia de Windows no se modifica cuando Desktop Commander está desconectado.
