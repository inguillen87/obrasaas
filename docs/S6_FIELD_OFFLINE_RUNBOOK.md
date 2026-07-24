# S6 · Operación de campo offline

## Estado implementado

- `ExtraWorkSession` registra START/FINISH con hora del servidor, GPS, precisión, estado y auditoría.
- `operationKey` es único por proyecto; los reintentos exactos devuelven replay y no duplican sesiones.
- El cierre valida que cada evidencia pertenezca al proyecto activo.
- La interfaz conserva hasta 20 operaciones pendientes por proyecto y reintenta al recuperar conectividad.

## Reglas operativas

1. El dispositivo captura ubicación antes de crear o encolar una operación. Nunca se inventa ubicación offline.
2. La operación encolada conserva el mismo `operationKey`, payload y evidencia; no se genera una clave nueva al reintentar.
3. Un replay confirmado se elimina de la cola. Un error de alcance o de negocio queda visible y no se reintenta silenciosamente.
4. START requiere un trabajo extra aprobado y un trabajador activo dentro del proyecto.
5. FINISH requiere una sesión abierta y evidencia ya cargada en almacenamiento privado.

## Pendiente antes de producción móvil

- Mostrar una bandeja de operaciones pendientes con estado `queued`, `syncing`, `synced` y `blocked`.
- Bloquear START/FINISH mientras exista una operación lógica pendiente para el mismo trabajador.
- Resolver conflictos desde una acción explícita del supervisor; nunca descartar payloads automáticamente.
- Añadir pruebas E2E de doble click, dos pestañas y reconexión durante una llamada.
- Verificar la migración `20260724190000_extra_work_sessions` contra PostgreSQL de CI y ejecutar un piloto con conectividad intermitente.
