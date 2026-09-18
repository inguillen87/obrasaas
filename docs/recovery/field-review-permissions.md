# Campo móvil: verificación y revisión separada

Se verificó el preview de Campo móvil mediante el ingreso normal con Google, selección explícita de una obra sintética, guardado de un faltante y apertura del mismo registro en la bitácora. PostgreSQL confirmó un DailyLog en DRAFT y un evento de auditoría. No se alteró stock ni se emitieron órdenes de compra.

## Separación de permisos
Crear y enviar partes conserva el permiso de ejecución. Aprobar o rechazar DailyLog y ProgressEvidence requiere además org:progress:review, asignado a DIRECTOR y al administrador de empresa con wildcard existente. SITE_MANAGER, FINANCE y AUDITOR no reciben ese permiso. La revisión de una evidencia exige además acceso a su contenido fuente.

La API comprueba estos requisitos antes de acceder a Prisma y rechaza solicitudes de origen cruzado. La interfaz usa la misma distinción: quien registra puede enviar, pero no ve los controles de decisión sin permiso. Los estados de la bitácora se muestran en español. Esta separación no introduce una regla de dos personas distintas; el administrador conserva su autoridad existente.

## Evidencia y límites
Las pruebas de autorización ejecutan el handler real con dependencias simuladas y el catálogo real de roles: denegación por rol, envío permitido a jefe de obra, normalización de estado, permiso adicional de evidencia, origen cruzado y respuestas privadas. No equivalen a una prueba de todos los roles con cuentas físicas distintas.

La PWA publicada dispone de formulario móvil e instalación, con una pantalla pública de contingencia sin conexión. La cola offline de partes/fotos y el circuito WhatsApp→backend→obra no se declaran completados en esta entrega. No se incorporaron personas reales ni se copiaron datos de una obra física al demo.

El despliegue permanece limitado al preview. No se cambian migraciones, credenciales, facturación ni el código de master.
