# Inspecciones: circuito guiado y continuidad de trabajo

## Alcance del cambio
La vista ahora explica el siguiente paso según estado y permisos, muestra controles pendientes antes de enviar y conserva los textos en español. No sustituye validaciones del dominio ni declara aprobaciones automáticas.

Protecciones de UX: confirmación antes de descartar un borrador o dictamen, advertencia de salida del navegador, historial que no sobrescribe la edición, prevención de solicitudes simultáneas de escritura y listado con error/actualización separados del resultado del guardado. Las respuestas antiguas del listado no reemplazan una consulta más reciente.

Cada registro guardado tiene un enlace con `?inspection=...`. El servidor resuelve ese identificador únicamente dentro de la empresa y obra autorizadas; un recurso ajeno o inexistente devuelve no encontrado. La selección se conserva al recargar.

La consulta al volver a enfocar la ventana actualiza el listado, no sobrescribe el formulario. Se muestra la hora de consulta y se informa cuando el listado revela una versión más reciente. Esto no se presenta como una suscripción push ni una garantía de tiempo real.

## Evidencia del circuito base
Se completó en el preview, mediante una sesión de navegador autenticada, una inspección sintética con creación, guardado, envío, observación, reapertura, corrección, nuevo envío y aprobación. La consulta de PostgreSQL confirmó el estado final y las ocho revisiones. No corresponde a una certificación de una obra física y no demuestra por sí sola aislamiento de todos los roles en navegador.

La evidencia de mensajería de Meta corresponde a pruebas desde la consola de la app autorizada. No acredita todavía que el backend SaaS reciba y procese los mensajes de extremo a extremo.

## Verificación de esta entrega
Ejecutar la suite completa, ESLint, build y prueba de enlace directo después de desplegar. Las pruebas nuevas de presentación cubren pendientes, criterios, justificaciones, cambios sin guardar, estados finales y lenguaje visible. No se cambian modelos ni migraciones PostgreSQL.

La publicación se limita a la rama y base de preview de recuperación. No sustituye las 14 interfaces de master ni modifica producción.
