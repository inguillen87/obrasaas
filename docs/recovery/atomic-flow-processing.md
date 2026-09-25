# S11.A31 - Persistencia atomica de incidencias Flow

Base: 98b671fb2e5d0997f743493d6e853d90c63fb705. Conserva A29/A30. Esta fase prueba el contrato real entre cola durable, lease, consumo de formulario, motor, snapshot, mensajes y recibo de aplicacion. No agrega pantallas ni activa un canal.

El nuevo verificador usa Prisma y PostgreSQL reales en una base vacia de loopback expresamente autorizada. Carga el cliente por la ruta existente de la aplicacion; no reemplaza delegados de base ni emula transacciones. La preparacion crea organizaciones, obras y participantes sinteticos, conexiones sin access token y un formulario firmado con secreto exclusivo de ensayo. El emisor HTTP esta bloqueado dentro de ese proceso.

Se verifican persistencia de recibo y lectura vinculada, reaplicacion y concurrencia con la misma lease, duplicados de ingreso, rollback al fallar la escritura final de appliedAt y recuperacion del mismo intento. La falla tardia se inyecta mediante un trigger temporal de ensayo limitado al evento exacto; debe deshacer sesion, snapshot y ambos mensajes antes de reintentar.

Se comprueban lease equivocada, evidencia de token alterada, un telefono compartido entre dos empresas, conexion deshabilitada y trabajador inactivo. Este ultimo queda en cuarentena sin consumir el formulario o ejecutar el motor. Las identidades de telefono del fixture usan el camino legacy explicito, no acreditan alta ni revocacion de identidades canonicas cifradas.

Los mensajes automaticos permanecen como efectos durables pendientes de despacho. Aceptar/aplicar un evento no se presenta como entrega fisica. No se ejecuta el dispatcher ni se firma una peticion HTTP como si proviniera de Meta. Tampoco se acredita la normalizacion HTTP, la cola externa, la ubicacion GPS o un trabajador real. Estas fronteras y el piloto fisico conservan verificaciones propias.

La suite se incorpora al matrix PostgreSQL independiente. El entry point rechaza base remota, sin consentimiento, puerto/nombre distinto y entornos Preview/Production antes de cargar Prisma. No carga .env, no usa credenciales reales ni escribe sobre otra base. Los resultados finales se registran con SHA en PR #1 despues de ejecutar; esta documentacion no es una afirmacion de aprobacion.

Sin nuevas dependencias, migraciones, tablas o permisos de aplicacion. Las fuentes y pruebas existentes no se reemplazan. Dado el espacio limitado de C:, la compilacion de cierre se ejecuta en CI sin instalar otra copia local de dependencias.
