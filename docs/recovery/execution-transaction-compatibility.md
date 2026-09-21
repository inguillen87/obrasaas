# Compatibilidad transaccional del circuito de ejecución

Fecha: 21/09/2026. Base: 4b6d6d05b21574bfa2469d6c6ae1a86e08444aa5.

## Hallazgo y diagnóstico
El ensayo integrado con PostgreSQL 17 y el adaptador pg completó sus 13 casos, pero el controlador advirtió que se despachaba una consulta mientras la misma conexión seguía ocupada. No se detectó pérdida de datos ni se presenta esa advertencia como un incidente de clientes.

La primera corrección secuenció ocho grupos explícitos de Promise.all dentro de transacciones. Pasó los contratos funcionales, pero la advertencia persistió: la nueva guarda detuvo la integración. Un diagnóstico aislado identificó otra fuente: al cargar las relaciones task, worker y team de las asignaciones, el intérprete de Prisma enviaba consultas a Worker y WorkTeam mientras una consulta a Task aún estaba ejecutándose en la misma conexión.

La instrumentación de diagnóstico sólo observó tipos de sentencia, nombres de tablas y stacks sobre datos sintéticos. No se integra en el producto ni cambia resultados u orden de las consultas. Su lectura del atributo de diagnóstico activeQuery generó una advertencia propia que tampoco se confunde con el fallo funcional investigado.

## Corrección completa del camino verificado
Se secuencian ocho grupos de lecturas dentro de project-execution, task-assignments, crew-memberships y schedule-field-status. Cada expresión se espera antes de evaluar la siguiente, manteniendo condiciones, límites y resultados. Un fallo detiene las lecturas posteriores del grupo.

En assignment-overlap-review se conserva la consulta acotada de asignaciones y se leen sus etiquetas mediante tres lotes explícitos y secuenciales: tareas, personas y cuadrillas. Los IDs se deduplican, cada consulta se limita a los IDs necesarios dentro de la obra y no se hace una consulta por asignación. Una etiqueta faltante, repetida o de otra obra se rechaza como resultado no verificable. El resultado público y la forma de la huella de revisión se conservan para datos iguales.

La lectura general de ejecución fuera de una transacción conserva su paralelismo de pool. No se serializan globalmente las operaciones de los usuarios. Los bloqueos por obra, revisiones, idempotencia, rollback y niveles de aislamiento permanecen. No se activa pipelining, no se cambian adaptadores ni dependencias y no se suprimen warnings.

Fuentes primarias sobre el alcance de una conexión y secuencia de consultas:
- https://node-postgres.com/features/transactions
- https://node-postgres.com/features/pipelining

No se promete mejora de latencia o capacidad sin mediciones comparativas.

## Regresiones
El verificador conserva 13 casos de dominio y cuatro pruebas de contención entre conexiones independientes. Ahora falla si reaparece la advertencia de consultas superpuestas y reporta su conteo observado. Los tests de estructura previenen Promise.all con tx en los cuatro módulos. Las pruebas de etiquetas ejercitan secuencia, lotes de hasta 1.000 asignaciones, deduplicación, ausencia de consultas con lista vacía, rechazo de otra obra y corte ante un error intermedio.

La validación requiere suite completa, lint afectado, reconstrucción por migraciones, PostgreSQL real, cuatro circuitos de navegador y build antes de integrar. El resultado concreto y SHA se registran en el PR #1 después de ejecutarlos. Las pruebas de base usan datos sintéticos sobre PostgreSQL real; los navegadores siguen usando HTTP controlado y no son sesiones reales de Clerk o Meta.

## Publicación
Corrección de backend y su verificación, no una pantalla comercial nueva. Pasar Actions no equivale a estar desplegado. Production conserva requisitos propios de configuración, identidad de base, autorización de migración, respaldo y prueba autenticada. Esta fase no cambia dominios ni publica mediante el workflow de validación.
