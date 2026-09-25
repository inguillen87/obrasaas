# S11 — Aceptación de asignaciones con sesiones Clerk

Base: `44131b1bfc0ff3d97b4a6b9b7dce01c25175a219`. Fecha: 23/09/2026.

## Control anterior cerrado
El usuario delegó expresamente la aprobación del job pendiente. Se aprobó sólo el entorno `clerk-development-e2e` del run `35816505410`, conservando sus revisores y protecciones; no se utilizó bypass ni se cambiaron secretos. El job `107039065865` completó los tres recorridos S9.2, S9.3 y S10-CERT con éxito. Son sesiones reales del proveedor Development con identidades de ensayo y PostgreSQL desechable, no usuarios productivos.

## Cobertura añadida
`e2e/s11-assignment-journey.js` amplía el recorrido S9.2 ya autenticado. Reutiliza sus sesiones y fixture; la función exige el destino aislado antes de acceder a la página o ejecutar una escritura. No crea usuarios Clerk, cambia roles, intercepta peticiones ni sustituye respuestas.

Comprueba desde la interfaz móvil de 390 px la creación de una asignación para una cuadrilla de ensayo, la advertencia explícita de dotación no confirmada, revisión/consentimiento, reprogramación y persistencia tras recargar. La intención inicial se recupera mediante el mismo cuerpo y clave idempotente y debe devolver el registro vigente sin restaurar las fechas anteriores.

Crea una segunda asignación mediante los endpoints reales y revisa el rechazo por período exacto duplicado. El motivo y los campos deben seguir disponibles. La coincidencia parcial requiere una nueva revisión y consentimiento antes de guardar.

El auditor debe poder leer pero no escribir. La interfaz no debe mostrar acciones de administración. Un actor de otra empresa no puede sustituir el contexto con cabeceras ni recuperar el ID en su propio ámbito. También se exige rechazar un contexto ausente, mantener dos registros exactos y conservar la revisión de Task y la integridad del corte previo.

La suite desactiva capturas, vídeo y trazas autenticadas según su configuración existente. No se publican cookies, sesiones, claves ni descriptores de identidad. Los nombres de pasos explican el circuito sin registrar credenciales.

## Ejecución y límites
Las pruebas originales mantienen sus assertions y el límite temporal existente. La ampliación utiliza la misma base efímera y no instala dependencias ni agrega migraciones. Los resultados reales del nuevo recorrido se registran en el PR con su SHA después de ejecutarlo; lint, parseo o el resultado anterior no acreditan esta ampliación.

Esta entrega añade cobertura de aceptación, no cambia reglas de negocio. Una sesión Development sobre localhost no demuestra el recorrido de un cliente en el Preview ni una entrega física de WhatsApp. Production conserva sus controles separados de configuración efectiva, identidad/respaldo de base y autorización de release.
