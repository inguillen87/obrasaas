# Clientes y oportunidades de la constructora

Se adopta `CrmAccount` y la validación del CRM enterprise de `1677ff7`. La tabla
existente describe prospectos comerciales de la plataforma. Su `organizationId`
relaciona un prospecto con una organización compradora; no representa al dueño
de la ficha. No se importa ese historial por coincidencias de nombre o contacto.

La ampliación agrega `ownerOrganizationId` y una revisión entera monotónica.
Los prospectos anteriores conservan propietario NULL y quedan excluidos del
CRM de una constructora. Un registro de constructora conserva `organizationId`
NULL. El esquema exige esa separación, la existencia del propietario y una
revisión positiva. El código anterior de administración comercial no se habilita
como una ruta de clientes: permanece tras el límite de servicios legacy. Antes
de restaurarlo, sus consultas de plataforma deberán filtrar propietario NULL.

## Uso y permisos

En **Mi cuenta → Abrir obra → Clientes**, la administración de la empresa puede
registrar cliente u oportunidad, contacto, correo, teléfono, actividad, origen,
etapa, próximo seguimiento y notas. Las fichas son de toda la empresa; la obra
seleccionada proporciona el contexto autorizado de la consulta y del recibo.
Dirección y operarios no adquieren gestión comercial por sus permisos de obra.

Se consultan páginas de 20 registros. **Buscar clientes** consulta toda la empresa
por nombre, contacto, correo o teléfono; se aplica sólo al confirmar la búsqueda.
El texto admite hasta 120 caracteres, sin caracteres de control. `%` y `_` son
literales, no comodines. La comparación no distingue mayúsculas de minúsculas;
las tildes siguen siendo significativas. El total indica coincidencias y las
páginas anterior y siguiente conservan el filtro.

El cursor se valida para la empresa, obra, filtro y ficha; no concede permisos.
Cada consulta verifica la autorización canónica vigente. Las páginas reflejan
el estado al consultarlas y pueden cambiar si otra persona modifica fichas.
Se conserva el límite de consulta existente de seis segundos, sin cambios de
esquema ni índices. Escribir una búsqueda no consulta automáticamente ni envía
mensajes de WhatsApp.
No hay contactos de ejemplo. Se conservan las etapas existentes con etiquetas
en español. Los campos de usuarios y valor mensual del CRM de ventas de SaaS no
se presentan como presupuestos de construcción.

Una ficha de contacto no verifica el teléfono, concede permisos, autoriza
WhatsApp ni genera un empleado o una obra. Guardar o cambiar su etapa tampoco
envía mensajes, acepta una licitación ni factura una venta. Esta entrega cubre
contactos y seguimiento básico; presupuestos, cotizaciones y automatizaciones
comerciales requieren sus propios flujos autorizados.

## Cambios y recuperación

El servidor deriva el propietario y el actor de la pertenencia canónica vigente.
No acepta identificadores de dueño ni de cliente SaaS suministrados por el
navegador. Usa la transacción de organización existente, con rol ADMIN, scope,
obra activa y controles de revocación. Un cambio conserva la obra activa mediante
su bloqueo compartido y bloquea la ficha al actualizar su revisión.

Cada modificación guarda un recibo `AuditLog` atómico para actor, empresa, obra,
UUID y contenido normalizado. El mismo UUID recupera su resultado; cambiar el
contenido con ese UUID se rechaza. Un error de auditoría revierte la ficha. La
respuesta perdida después de COMMIT se recupera por GET, sin otro guardado.
La revisión del recibo acredita la versión guardada; la ficha actual puede tener
una revisión posterior.

La interfaz valida el resultado antes de retirar la referencia de recuperación.
Un conflicto conserva el borrador, consulta la ficha vigente y requiere revisión
explícita antes de guardar con un nuevo UUID y la revisión actual. Una respuesta
incierta conserva el intento y bloquea nuevos guardados en ese módulo. Recargar
restaura sólo referencias mínimas: los datos de contacto y el borrador no se
guardan en almacenamiento del navegador.

## Adopción del esquema

`scripts/adopt-constructor-crm-schema.mjs` ejecuta una consulta de sólo lectura
por defecto. Aplicar requiere contexto Production, proyecto/equipo esperados y
la huella del catálogo revisado. La adopción es aditiva, atómica, con límites de
espera y consulta; no reasigna ni borra registros. Se comprueban tipos, claves,
índices, restricciones y privilegios antes y después. Una estructura inesperada
se rechaza. Un resultado incierto exige otra consulta; no acredita COMMIT.

El prebuild de Production exige el esquema adoptado y los permisos necesarios
mediante una consulta de catálogo de sólo lectura. Preview y compilaciones
locales registran que ese control no se ejecutó. El runtime también falla
cerrado ante esquema o privilegios incompatibles.

## Evidencia y límites

Los controles usan PostgreSQL desechable con organizaciones reales de ensayo,
el normalizador enterprise adoptado y la transacción canónica de ObraSaaS. La
interfaz se comprueba con componentes reales y respuestas/sesión controladas
a 320, 390, 768 y 1280 píxeles. Estos resultados no acreditan un cliente real ni
aceptación humana. Implementación, pruebas, adopción del esquema, publicación y
aceptación se registran por separado en el comprobante de la versión publicada.
