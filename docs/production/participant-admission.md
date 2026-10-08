# Admisión operativa de participantes por obra

Aceptar una invitación crea y conserva la cuenta, la asignación y sus recibos
históricos. No admite al participante a tareas, cronograma, campo, sectores,
inventario, importación de planes, compras ni resúmenes de portfolio.

## Autoridad canónica

`workspace-store.mjs` aplica el control antes de leer datos operativos o ejecutar
el callback de un módulo. `participant-admission.mjs` identifica el vínculo por
`Worker.metadata.participant.clerkUserId` dentro de la organización canónica.
Los recibos de aceptación o asignación conservan ese origen aunque el registro
sea eliminado o pierda su vínculo; esa pérdida no transforma al participante en
una cuenta de oficina.

Una cuenta ligada a un participante requiere `ProjectMembership` vigente y su
propia ficha en cada obra. La ficha debe estar activa y superar el verificador
existente `assertApprovedParticipantKyc`: presentación y consentimiento válidos,
revisión humana por otro actor y recibos canónicos de presentación y revisión.
Se conservan los contratos existentes de dos imágenes y de dorso autorizado;
las capturas previas a la cuenta mantienen sus recibos de aceptación y adopción.
OCR, comparación facial, roles de oficina y recibos históricos no sustituyen
esa aprobación actual.

Una cuenta `DIRECTOR` ligada a un participante también está sujeta a este control.
La aprobación en A no admite B, ni autoriza una obra sin asignación o sin ficha
propia. Una vez admitida en A, conserva sus permisos legítimos de `DIRECTOR` para
revisar a otros participantes de A. La cuenta de oficina sin vínculo conserva
el comportamiento de su rol. Un administrador canónico de empresa conserva
administración, bootstrap y revisión; la operación de campo de su ficha propia
sigue los controles estrictos existentes de participante.

La participación propia de ese administrador verifica también los recibos
canónicos de presentación y revisión, antes de registrar campo o adjuntar
evidencia, y al recuperar un POST o consultar su recibo. Un estado `APPROVED`
aislado no alcanza. La consulta de recuperación conserva su transacción de
sólo lectura sin locks de `Worker`; no se reenvía una operación ni se modifica
el historial para comprobar el respaldo de la identidad.

Pendiente, rechazada, corrupta o revocada la aprobación de una ficha cuya
asignación sigue vigente, el acceso operativo devuelve HTTP 403 con
`PARTICIPANT_KYC_REVIEW_REQUIRED`. La falta o revocación de la asignación o de la
obra se rechaza antes con `WORKSPACE_PROJECT_UNAVAILABLE`. No se modifican roles,
asignaciones, permisos configurados ni hashes de recibos por aprobar un KYC.

La operación escrita conserva locks de identidad/cuenta y vuelve a resolver el
vínculo después de bloquear la obra. `ASSIGN_EXISTING` toma `FOR UPDATE` de la
identidad y después de la cuenta, en consultas separadas antes del lock de la
obra destino, como JOIN; así una
vinculación nueva en B no puede aparecer a mitad de una operación admitida como
oficina en A. No cambia datos o roles de la cuenta al tomar ese lock.

## Autoservicio privado

`participantIdentityOperation` es una composición exclusivamente de servidor:
el `Symbol` que selecciona su propósito permanece cerrado en `workspace-store`.
No existe un flag de consulta, cuerpo HTTP, rol declarado ni valor serializable
que habilite la excepción. Usa la misma identidad verificada, organización,
asignación y transacción que el acceso ordinario.

Sólo `participant-store` usa esa composición para consultar la ficha propia,
presentar KYC, descargar sus imágenes, recuperar el recibo propio y retirar su
autorización de contacto. `identityOnly` se deriva en el servidor. Mientras no
haya admisión, una cuenta `DIRECTOR` recibe sólo sus registros, sin directorio
de cuentas, bandeja de altas, acciones de gestión, archivos o revisión ajena.
`assertOwnParticipant` revalida el vínculo y la asignación incluso al recuperar
un recibo. Los bytes privados se revalidan después de la lectura de almacenamiento.
La retirada de consentimiento permanece disponible para el titular.

El listado conserva la proyección mínima `{id, name, status}` de las obras
asignadas para llegar al KYC propio. La interfaz distingue el 403 canónico y
monta sólo el panel privado. La aprobación se observa al volver a consultar el
servidor; no se infiere desde OCR, una respuesta tardía o un recibo del navegador.

## Portfolio y paginación

El portfolio primero consulta candidatos autorizados sin leer `Task`, verifica
la admisión de cada obra y sólo agrega tareas de los IDs admitidos. Los pendientes
no producen conteos, fechas ni consultas de tareas. Conserva páginas de 50 y el
cursor del último registro admitido. Escanea lotes de 51 candidatos, con máximo
de 100 lotes por petición; si no puede completar la página dentro de ese límite,
rechaza con 503 en vez de devolver un cierre o cursor engañoso. Toda la lectura
usa una misma transacción canónica de sólo lectura.

## Evidencia de regresión y límites

Antes del cambio, la regresión PostgreSQL de un JOIN real en dos obras falló
porque `workspace.read` devolvía tareas sin KYC humano. Se conserva el script
original y el log de ese fallo en evidencia privada. La ampliación del harness
conserva los grupos existentes y comprueba autoservicio con imágenes sintéticas,
denegación antes de consultas operativas, aprobación por otro actor, A admitida
sin B, `DIRECTOR` pendiente y admitido, falta de asignación/ficha, corrupción del
recibo y revocación. Los tests de servidor también verifican páginas mixtas y
ausencia de agregados para pendientes.

Esta evidencia local no demuestra publicación, entrega de WhatsApp ni aceptación
de identidad real. No se utilizan documentos de clientes ni proveedores reales.
