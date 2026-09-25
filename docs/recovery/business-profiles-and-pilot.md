# Perfiles de organización y preparación del piloto multiempresa

## Entrega
Puesta en marcha incorpora un perfil operativo persistente por organización: constructora, estudio/arquitecto independiente, consultora/gerenciadora, desarrolladora/grupo inversor, comitente/propietario u organismo público. El ámbito admite obra privada, pública o ambas. Se utiliza la página y los permisos existentes; no se crea otro menú, otra entidad de cliente ni un motor paralelo.

La selección se guarda en Organization.metadata.businessProfile con esquema y revisión. Afecta la orientación inicial de toda la organización, no sólo de la obra seleccionada. Los accesos recomendados se calculan usando permisos reales y rutas existentes. Un perfil público no aplica automáticamente reglas fiscales, contractuales o normativas; no cambia la línea base ni habilita licitaciones o funciones todavía no implementadas.

## Organización y participante no son lo mismo
Una organización operadora puede administrar varias obras; la identidad de un comprador, inversor individual, consultor invitado o comitente participante requiere permisos específicos sobre los datos publicados para esa persona. Este cambio no crea roles de comprador/inversor ni concede acceso ADMIN o AUDITOR. El AUDITOR existente tiene lecturas internas: no se usa como sustituto de un portal de transparencia.

La incorporación de clientes reales debe seguir verificando empresa independiente, membresía, obra permitida, roles y datos que pueden publicarse. Los datos de prueba de la organización interna no se convierten en una empresa externa para eludir las condiciones de importación del piloto Meta.

## Escritura y aislamiento
GET/PATCH /api/tenant/business-profile utiliza organización, actor y proyecto desde la sesión. Requiere lectura de proyectos y, para modificar, administración de miembros de esa organización con permiso de escritura. Compara las cabeceras de contexto, rechaza query/origen cruzado y limita el cuerpo. No acepta roles, planes, metadatos arbitrarios ni IDs de autoridad en el JSON.

Se bloquea la fila de organización dentro de una transacción, se lee su revisión y se actualiza con comparación de updatedAt. Se preservan los demás metadatos, incluida la configuración de IA y la condición interna. Un perfil desconocido no se reemplaza por defaults. El evento de auditoría sólo registra tipos, ámbito, revisión y actor; si falla, se revierte la operación.

Una respuesta perdida puede verificarse con la misma selección/revisión: si ya se aplicó exactamente, se devuelve el perfil existente sin otra escritura ni auditoría. Una selección diferente sobre una revisión obsoleta genera conflicto. El cliente confirma identidad, elecciones y versión antes de presentar éxito; no cambia la UI por una respuesta genérica HTTP 200.

## Experiencia de uso
Tarjetas táctiles en Dark Obsidian, nombres claros, estados configurado/pendiente/guardando/confirmado/conflicto y enlaces por actividad. Se protege la selección ante navegación o recarga. Una respuesta incierta conserva el intento sin reenvío automático; un conflicto ofrece consultar la versión actual mediante confirmación de descarte. Los roles de consulta ven el perfil sin poder modificarlo.

El perfil no se suma a los seis hitos funcionales existentes como evidencia ficticia de producción. Persistir el tipo de organización no demuestra que todo el flujo de esa actividad o el portal del comprador esté cerrado.

## Validación y publicación
Pruebas de dominio y handler verifican scope, permisos negativos, metadatos preservados, concurrencia, auditoría, respuestas incompletas y recuperación. El navegador controlado usa el componente real con HTTP e identidades sintéticas; prueba selección, guardado, permisos, reintento idéntico, conflictos y 320/390/768/1280 px. No equivale a clientes físicos distintos ni a una certificación de aislamiento de todos los módulos.

No se agregan tablas, migraciones, dependencias, cobros o planes. La validación de producción continúa separada: canales reales, matriz de accesos, backups, reversión, datos aislados y recorridos autenticados. Los resultados del build/despliegue y las verificaciones reales se registran por SHA en el PR.
