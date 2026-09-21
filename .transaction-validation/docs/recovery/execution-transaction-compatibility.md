# Ajuste de compatibilidad transaccional de ejecución

Fecha: 21/09/2026. Base: 4b6d6d05b21574bfa2469d6c6ae1a86e08444aa5.

## Hallazgo real
El ensayo integrado con PostgreSQL 17 y el adaptador pg completó sus 13 casos, pero el controlador emitió una advertencia por ejecutar otra consulta mientras la misma conexión ya estaba ocupada. Esa advertencia no se consideró un fallo del ensayo anterior ni prueba de pérdida de datos. Sí identifica un patrón que conviene retirar de los circuitos verificados.

## Corrección acotada
Se secuencian ocho grupos de lecturas que comparten una transacción en project-execution, task-assignments, crew-memberships y schedule-field-status. Cada expresión se espera antes de evaluar la siguiente. Se conservan las condiciones de consulta, filtros, límites, orden de resultados y contenido devuelto. Si falla una lectura, no se despachan las siguientes de ese grupo.

La lectura general que usa conexiones del pool fuera de una transacción conserva su paralelismo. Las operaciones simultáneas de distintos usuarios no se serializan globalmente. Los bloqueos por obra, revisiones, idempotencia, rollback y transacciones RepeatableRead/ReadCommitted permanecen como estaban. No se activa pipelining, no se cambian adaptadores, dependencias o planes y no se deshabilitan avisos del controlador.

La documentación del mantenedor explica que una transacción debe utilizar la misma conexión y que las lecturas dependientes deben esperarse en secuencia. No se promete una reducción de latencia ni un aumento de capacidad sin mediciones comparativas:
- https://node-postgres.com/features/transactions
- https://node-postgres.com/features/pipelining

## Regresiones
El verificador PostgreSQL existente conserva los 13 casos de dominio y cuatro pruebas de contención entre sesiones independientes, y ahora falla si vuelve a observar la advertencia de consulta superpuesta. No silencia warnings; registra el conteo observado en el informe. Los tests de estructura impiden reintroducir Promise.all con consultas del mismo objeto tx en esos cuatro módulos y comprueban que las consultas independientes del listado mantengan su concurrencia.

La validación exige suite completa, lint de afectados, reconstrucción por migraciones, ensayo PostgreSQL, cuatro circuitos de navegador y build antes de integrar. La salida concreta y el SHA final se registran en el PR #1 después de ejecutarlos. La prueba de base usa datos sintéticos sobre PostgreSQL real; los verificadores de interfaz siguen usando HTTP controlado y no son sesiones de Clerk o Meta reales.

## Publicación
Es una corrección del backend y su verificación, no una nueva pantalla comercial. No se considera desplegada por pasar Actions. El pase a Production conserva sus requisitos de configuración live, base aprobada, respaldo y prueba autenticada. No se cambia dominio ni se despliega desde este workflow de validación.
