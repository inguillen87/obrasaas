# Campo móvil — preparación de piloto

## Alcance
Entrada /dashboard/campo para personal de oficina/capataz con sesión y permisos existentes. No crea una identidad de operario ni habilita acceso por conocer un número de teléfono.

El parte admite avance, faltante, incidencia y mejora. Crea un DailyLog en DRAFT y su AuditLog en la misma transacción, reutilizando la bitácora existente. No altera stock, costos, mediciones ni emite órdenes. Tipo y sector se conservan en el parte; la categoría y la huella de solicitud también quedan en la auditoría.

/api/field/reports deriva empresa y actor de la sesión, exige permiso de ejecución y verifica que el proyecto enviado coincida con el activo. El ID y recibo de operación están ligados a empresa/obra/actor/clave. Un reintento idéntico devuelve el mismo parte; cambiar contenido con esa clave se rechaza. Un parte eliminado no se recrea silenciosamente. La exclusión y el estado de obra usan el bloqueo transaccional de proyecto existente.

El móvil explica guardando, confirmado y sin confirmar. Ante respuesta incierta conserva la solicitud para reintentar la misma operación. El borrador permanece sólo en memoria: no se promete recuperación tras cerrar o refrescar. Los enlaces de esta pantalla y la salida del navegador advierten sobre trabajo pendiente. La foto utiliza el formulario y almacén privado de evidencia existentes, asociado a una tarea.

## PWA acotada
Manifest con identidad estable y apertura en Campo móvil. Instalación cuando el navegador la ofrece e instrucciones manuales como alternativa. El service worker sólo almacena /offline.html: no cachea APIs, páginas autenticadas, fotos, salarios, credenciales ni documentos. Una navegación de aplicación sin red obtiene la página pública con estado 503; no se confunden errores HTTP del servidor con falta de red. Las actualizaciones se aplican mediante confirmación, sin recarga automática mientras se escribe.

Esto no implementa aún la cola IndexedDB ni Background Sync de partes/fotos. La aplicación requiere conexión para confirmar escrituras. El módulo informa ese límite explícitamente.

## Verificación
Pruebas nuevas de normalización, fechas, scope, autoridad no aceptada desde cliente, idempotencia, rollback, replay después de revisión y rutas. Contratos de manifest, caché y headers. Scripts/verify-field-pwa.mjs verifica en Chrome aislado el service worker real: sólo página pública en caché, API no disponible offline, navegación offline 503, recuperación 200 y reflow a 320/360/390 px. Es una fixture sintética, no una prueba de usuarios reales ni Safari/Android físicos.

Antes de publicar: suite completa, lint, build y diff-check. Después: ingreso real, parte demo, persistencia y navegación a la bitácora en el preview del commit. No se requieren migraciones nuevas en esta entrega.

## Paso a obra real
Faltan identificación de obra y responsable, participantes confirmados y conexión bidireccional del backend WhatsApp con los activos de ObraSaaS. Mantener datos sintéticos separados y limitar inicialmente el piloto a comunicación operativa con revisión humana. No introducir liquidaciones, biometría, documentación médica o autorizaciones de pago como prueba informal.
