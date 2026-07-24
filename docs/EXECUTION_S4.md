# S4 - Cuadrillas, asignaciones y blockers

## Resultado

S4 agrega un dominio relacional para la ejecucion de obra:

- `WorkTeam` y `WorkTeamMember` reemplazan la asignacion informal por nombre libre;
- `TaskAssignment` vincula una persona o equipo a una `Task` canonica, con estado, vigencia y revision;
- `ProjectBlocker` vincula un bloqueo opcionalmente a una tarea, owner persona/equipo, severidad, SLA (`dueAt`) y resolucion auditada;
- todas las relaciones llevan `projectId` en la FK para impedir cruces de obra;
- el dashboard `/dashboard/execution` permite crear equipos, abrir blockers y resolverlos con CAS;
- el endpoint `/api/execution` devuelve una proyeccion minima y el endpoint de blocker exige `expectedRevision`.

## Reglas

- una asignacion debe tener persona o equipo;
- una tarea asignable debe ser WBS canonica;
- un blocker nuevo no nace resuelto;
- resolver exige texto de resolucion y timestamp de servidor;
- cerrar o reabrir un blocker incrementa revision y deja auditoria;
- una persona no puede repetirse en el mismo equipo activo sin cerrar su membresia anterior.

## Gaps deliberados

La migracion no convierte automaticamente `ProjectSnapshot.incidents` ni asignaciones antiguas: primero se debe ejecutar un backfill revisado por obra. Tampoco se presenta todavía como nómina, control de capacidad ni calendario de recursos; esas capacidades requieren reglas laborales y disponibilidad explícitas.

Antes de producción: ejecutar la migración en PostgreSQL 17, verificar FK compuestas, probar concurrencia CAS y completar E2E por rol/obra. El verificador CI es `npm run verify:project-execution-migration`.
