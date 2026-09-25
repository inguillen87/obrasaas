# S11.A23 — Priorizar el seguimiento por respuesta, vigencia y envío

Base: `8df25918561c6edee922247c1a7fe04881eb4612`. Extiende la vista de A22, sin modificar su API ni las operaciones de envío A21.

## Problema de operación
El filtro anterior «Revisar pendientes» evaluaba únicamente sending/unknown/failed o correlación no verificada. Una plantilla aceptada o entregada con enlace vencido sin respuesta quedaba fuera de ese filtro. No era un fallo del proveedor: faltaba distinguir los tipos de seguimiento de la página.

## Vista y criterios
Se reemplaza ese filtro ambiguo por cinco categorías con conteos de la página consultada: Todos, Sin respuesta, Enlace vencido, Revisar envío y Con respuesta. Las cuatro categorías específicas son excluyentes; su suma coincide con los registros de esa página, nunca con el total del historial.

- Sin respuesta: estado de envío reconocido, correlación verificada y enlace vigente a la hora de consulta, sin respuesta registrada. No confirma entrega.
- Enlace vencido: las mismas condiciones, pero la vigencia terminó a la hora de la observación. No significa que el destinatario no haya recibido el mensaje ni autoriza reenviar.
- Revisar envío: envío incierto, pendiente o fallido, decisión manual de riesgo o correlación/fechas que no permiten una clasificación verificada. No se inventa un vencimiento a partir de datos ausentes.
- Con respuesta: respuesta correlacionada y registrada entre el registro del mensaje y la observación, con estado coherente. No equivale a parte, fichaje, pago o avance aprobados.

El instante de referencia es observedAt, devuelto por el servidor en A22. No se usa el reloj del cliente para cambiar categorías ni hay temporizadores que den por vencido un enlace sin otra consulta. Las fechas de visualización mantienen la zona del dispositivo, indicada en pantalla; no interviene en la clasificación.

El filtro se conserva al ir a páginas anteriores/siguientes y al actualizar explícitamente. Una página sin coincidencias no se presenta como cero pendientes de toda la conversación y la paginación sigue disponible. Al cerrar/reabrir el panel o cambiar de conversación vuelve a Todos. Los cambios de filtro no crean peticiones, ni cargan el directorio completo o un contador global.

Los controles anuncian selección y cantidad, funcionan por teclado, describen el alcance de su interpretación y reinician el desplazamiento del listado al cambiar de categoría. No añaden acciones de reenviar, resolver, editar, aprobar ni borrar.

## Verificación
`proactive-flow-followup.test.js` verifica estados, límites temporales, correlación, conteos excluyentes, datos imposibles, páginas parciales, reloj observado y ausencia de mutaciones. La prueba de navegador existente se amplía sin retirar sus ocho escenarios anteriores: categorías con cero consultas nuevas, preservación del filtro en páginas sin coincidencias y actualización, y selección mediante teclado. Se repiten errores/contexto/red del historial y los circuitos de envío y plantillas.

El nuevo helper no consulta bases ni proveedores. Los datos vienen del endpoint A22 y sus permisos actuales; no hay nuevo contrato de servidor, permiso, modelo o integración. La validación real de SQL del historial se conserva en su suite permanente, separada del navegador con identidad/base controladas.

## Límites de esta fase
El vínculo entre una respuesta de formulario y su parte, incidencia o fichaje de negocio requiere correlación y autorización de ese dominio. No se crea un enlace por coincidencia de nombres, teléfonos o sólo por consumedAt. Ese enlace no forma parte de A23. La prueba bidireccional de Meta y el pase a Production siguen siendo verificaciones independientes de esta vista.

Sin nuevas dependencias, migraciones, credenciales, polling, llamadas al proveedor, envíos reales ni cambios de tráfico productivo. El SHA, resultados y deployment comprobados se registran en PR #1 después de ejecutarse.
