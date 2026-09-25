# S11.A13 — Cierre integrado de ejecución con PostgreSQL real

Base inspeccionada: 93deca173ef38f79db4c2c8e6242057e6f52c95c. Fecha: 21/09/2026.

## Objetivo
Verificar conjuntamente los servicios de cuadrillas, asignaciones revisadas, restricciones y lectura del cronograma usando Prisma y PostgreSQL 17 reales. Las pruebas de interfaz anteriores usan HTTP controlado; esta fase agrega una evidencia distinta: persistencia, bloqueo simultáneo entre conexiones y restricciones SQL efectivas.

## Entorno estrictamente desechable
El verificador `scripts/verify-execution-release-postgres.mjs` sólo acepta `EXECUTION_RELEASE_DATABASE_URL` apuntando a 127.0.0.1:5432, base `obrasaas_execution_ci` y esquema public. Exige `EXECUTION_RELEASE_DISPOSABLE=true`, rechaza un entorno declarado Production y no usa como alternativa DATABASE_URL ni archivos .env. También verifica el nombre real de la base y exige que no tenga empresas u obras antes de crear las fixtures.

La base se levanta como servicio temporal del job de GitHub Actions. Se reconstruye a partir de las migraciones existentes; no contiene clientes o trabajadores reales. Las fixtures incluyen dos empresas y tres obras con etiquetas iguales y claves diferentes. No se deducen identidades a partir de nombres o teléfonos.

## Cobertura del circuito
Se usan dos PrismaClient independientes con el adaptador PostgreSQL instalado. Antes de las carreras, un tercer cliente retiene temporalmente el mismo advisory lock de la obra y observa que ambas conexiones esperan ese lock en PostgreSQL. Después se libera la transacción y se comprueba el resultado. Lanzar dos promesas sin observar concurrencia real no se presenta como suficiente evidencia.

Los casos ejercitan: alta idempotente simultánea de integrantes, decisiones con igual revisión, creación revisada simultánea de una asignación, cambio de origen entre revisión y guardado, aislamiento entre empresa y obra, historial terminado y restricciones junto al Gantt. Los servicios son los de la aplicación, no adaptadores falsos de base.

Para comprobar atomicidad de la auditoría se utiliza un actor sintético inexistente. La clave foránea real de AuditLog debe rechazar la inserción y revertir el alta o el cambio previo dentro de esa transacción. No se desactivan restricciones, no se crean disparadores especiales ni se cambia el código de negocio para provocar el fallo. Un intento SQL directo de enlazar una persona de otra obra debe fallar específicamente por su FK de alcance, no por cualquier error.

El cierre verifica que finalizar participaciones o asignaciones no elimina personas, no altera progreso/fechas de tareas y no autoriza operaciones de WhatsApp, salarios o asistencia. El ensayo de servicios no sustituye la autenticación HTTP de Clerk: las pruebas de handlers y sus permisos se mantienen en la suite normal.

## Uso
En una base local descartable vacía, después de aplicar las migraciones del repositorio, establecer las variables específicas anteriores y ejecutar:

```sh
npx tsx scripts/verify-execution-release-postgres.mjs
```

El resultado queda en `.vercel/execution-postgres-release.json` o en la ruta explícita `EXECUTION_RELEASE_PROOF_PATH`. Incluye casos, sesiones independientes, contención observada y estado de migraciones. No exporta credenciales ni una copia del repositorio. Las fixtures permanecen únicamente hasta que el servicio descartable se destruye al terminar el job. No ejecutar contra un túnel hacia bases de clientes.

## Criterio de cierre y límites
Un caso fallido o un número de conexiones esperando menor al exigido impide declarar la fase aprobada. Antes del commit de aplicación se ejecutan suite completa, lint afectado, este ensayo, regresiones móviles y build. La prueba SQL y los resultados de UI se conservan separados y se registran por SHA en el PR #1.

Esta prueba no es un ensayo de cientos de tenants, una restauración de la base de producción, una sesión real de Meta ni una certificación de seguridad. `providerVerified`, `authenticatedHttpVerified` y `productionDeployed` permanecen false en su reporte. La configuración live, respaldo, autorización del SHA/identidad de base, migración del destino real y prueba autenticada del canal siguen siendo condiciones propias del pase a Production.
