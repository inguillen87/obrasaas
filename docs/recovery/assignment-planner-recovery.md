# S11.A17 — Recuperación del planificador sin perder el borrador

Base: `184781b1f22d34cc9b87570730d522c513e16343`, que ya incluye la agenda S11.A16. Esta entrega no modifica esa agenda ni los contratos de escritura del servidor.

## Operación
Un fallo transitorio al consultar la actividad ofrece «Volver a consultar la actividad» dentro de la misma ventana. Es exclusivamente otro GET, no una planificación nueva. Fechas, selección y explicación se conservan también si una actualización posterior falla.

Un duplicado exacto confirmado o una revisión de coincidencias desactualizada devuelve el formulario a edición y elimina la aceptación anterior. Se puede corregir sin cerrar el diálogo. Un cambio confirmado de revisión de Task o de disponibilidad del responsable exige «Actualizar actividad y responsables» antes de volver a revisar. La consulta carga la versión vigente sin reemplazar silenciosamente lo escrito; si el responsable ya no aparece en las opciones se indica y se impide confirmar hasta resolver la selección.

Cada consulta o conflicto conocido invalida revisión y consentimiento. Se conservan la explicación y las fechas; no se reutiliza una aceptación vieja para datos nuevos. La búsqueda sigue limitada a las opciones de la consulta existente: esta entrega no añade un directorio paginado ni elimina su límite de 100 resultados por tipo.

## Seguridad de recuperación
Sólo se descarta la clave de un intento ante un rechazo confirmado anterior a la escritura: los códigos de duplicado, revisión, tarea y responsable deben llegar con su HTTP 409 correspondiente. Los errores de validación HTTP 400/422 también exigen revisión y aceptación nuevas.

Un corte de red, timeout, 5xx o respuesta de guardado no conciliable mantiene el mismo cuerpo y clave para la acción explícita «Verificar el mismo intento». No se ofrece recargar la fuente como sustituto de resolver ese resultado. No se envían POST o PATCH automáticamente. Los conflictos de integridad, alcance y autorización permanecen bloqueados. Una fuente de otra obra o una respuesta inválida no habilita el planificador.

No se crea almacenamiento persistente de borradores: cerrar la pestaña sigue siendo distinto de volver a consultar dentro del diálogo. No se modifica Task, Gantt, avance, asistencia, remuneraciones, mensajes o permisos. Sin nuevas dependencias, endpoints, tablas ni migraciones.

## Validación
`assignment-planner-recovery.test.js` prueba la clasificación exacta y conserva errores desconocidos como inciertos. `verify-assignment-planner-recovery-ui.mjs` monta React y los servicios de dominio reales con HTTP/base controlados: consulta fallida, duplicado real, Task cambiada, nueva consulta que falla, conservación del borrador, consentimiento nuevo, respuesta perdida tras guardar y denegación de fuentes ajenas. Comprueba 320/390/768/1280 px. No equivale a Clerk ni a un cliente en Preview.

Antes de integrar se ejecutan suite completa, lint, build y regresiones de agenda, planificación, coincidencias y continuidad en CI aislado sin secretos. El historial de código y el árbol exacto validado se registran en el PR junto a los resultados efectivos. La publicación usa una única entrega agrupada de Preview; Production conserva sus verificaciones separadas.

El escritorio remoto no estaba conectado en esta intervención. No se modificó su copia local. Al retomar allí, comprobar cambios ajenos antes de sincronizar, sin reset destructivo.
