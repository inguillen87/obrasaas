# S11.A20 — Estados de plantillas basados en la consulta vigente

Base: `be88e2bca437a5de9d0c91c69b80b4f2c95017a3`.

## Regresión reproducida
Al fallar «Sincronizar», el diálogo A19 retiraba su confirmación, pero las tarjetas de Integraciones seguían mostrando «Aprobada por Meta» desde el catálogo anterior. La prueba de navegador ejecutada sobre la base conservó un badge aprobado después del error y falló antes de aplicar la corrección.

Además, la lectura iniciada al abrir la sección podía llegar después de una consulta del diálogo y reemplazar una observación más reciente. Un error viejo de credencial podía invalidar el canal después de que otra consulta hubiera terminado correctamente. Se prueba ambos órdenes, sin retirar el rechazo de errores vigentes.

## Observación local, no estado del proveedor
El catálogo tiene una generación local por consulta: pendiente, verificado, fallido o no verificado. Comenzar una operación retira la certeza de las tarjetas pero puede conservar datos anteriores en memoria. Sólo una respuesta válida de la generación actual permite recuperar el estado visible.

Una respuesta completa verifica sus entradas; una respuesta parcial de creación/reconciliación verifica únicamente su blueprint. Los demás registros conservados no heredan la aprobación. Un catálogo sin una versión no se confunde con «Sin solicitar» de una versión conocida sin registro remoto.

Cerrar una consulta pendiente, reemplazar el canal o fallar la consulta retira los indicadores aprobados. El icono acompaña a la presentación verificada, no a un APPROVED viejo almacenado en memoria ni a una plantilla de categoría diferente. Las tarjetas exponen un estado accesible para lector de pantalla.

La confirmación verde anterior de sincronización se retira al iniciar una consulta nueva. El estado del formulario se denomina «Formulario operativo», no «Listo para enviar»: disponibilidad del formulario y aprobación de plantilla son controles distintos.

Las generaciones no son versiones de Meta, tokens o permisos. No acreditan entrega, recepción o vigencia perpetua. El sender conserva su revalidación en servidor. Esta entrega no hace polling automático ni añade llamadas por cada render; ordena las consultas ya existentes.

## Pruebas
El reductor tiene pruebas de secuencia, cancelación, cambios de canal, respuestas parciales, inválidas, atrasadas y estados/categorías. `verify-template-catalog-consistency-ui.mjs` monta IntegrationsClient y TemplateReviewControl reales junto a los servicios de plantillas. Aísla únicamente los componentes no modificados de alta/vigencia y utiliza proveedor, HTTP y base controlados.

El navegador cubre el fallo reproducido, una respuesta antigua exitosa, un rechazo Graph antiguo después de una observación nueva, un error del diálogo, categoría distinta y anchos 320/390/768/1280 px. No envía WhatsApp ni crea plantillas reales. La validación y el deployment se acreditan con su SHA en el PR.

## Operación real observada antes del cambio
Se aprobó por delegación el entorno Clerk Development de `be88e2b`; S9.2, S9.3 y S10-CERT aprobaron. Desde la sesión real del titular en el Preview, el preflight confirmó app/callback y la lectura del piloto mostró autorización temporal vencida, ventana de respuesta cerrada y ausencia de respuesta del backend.

No se cambió el resolver del superadmin para convertir el workspace interno en cliente ni se eludieron controles de Meta. La navegación hacia la renovación fue bloqueada por la herramienta antes de completarla; no se intentó otro canal para ejecutar esa misma operación. No se generó/trasladó una credencial nueva ni se enviaron mensajes en ese diagnóstico.

Sin nuevas dependencias, migraciones, endpoints o cambios de roles/servidor. Las operaciones de mensajes, facturación y Production permanecen separadas.
