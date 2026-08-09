# Reconciliación de drift Prisma/PostgreSQL

**Estado al 9 de agosto de 2026:** validado localmente; pendiente PostgreSQL 17,
Neon Preview y deployment Vercel del mismo commit. Production no fue tocado.

## Alcance

El gate de drift detectó 77 diferencias de nombre y dos diferencias
estructurales. Las 77 diferencias no cambian columnas, referencias, acciones ni
unicidad: `map:` conserva en Prisma los nombres físicos históricos. No se
renombran constraints ni índices en PostgreSQL, evitando locks y roturas de
verificadores u observabilidad durante un rolling deploy.

Los dos contratos estructurales se aplican por separado:

1. `20260809093000_purchase_order_line_scoped_identity` crea de forma
   concurrente la clave candidata `PurchaseOrderLine(projectId, id)`.
2. `20260809093100_task_assignment_project_ownership` agrega la propiedad
   directa `TaskAssignment(projectId) -> Project(id)` con
   `ON DELETE/UPDATE CASCADE`, primero `NOT VALID` y luego `VALIDATE`.

La separación es deliberada: si la validación de la FK falla, el índice ya
terminado no queda mezclado dentro del mismo registro de migración fallido.

## Preflight

Antes de `prisma migrate deploy` sobre una rama gobernada:

- confirmar que las migraciones 118 y 119 no figuren terminadas ni fallidas;
- verificar ausencia de transacciones largas o locks sobre `PurchaseOrderLine`,
  `TaskAssignment` y `Project`;
- comprobar que `PurchaseOrderLine_projectId_id_key` y
  `TaskAssignment_projectId_fkey` no existan;
- conservar `lock_timeout = 5s`; un timeout aborta la promoción y no se eleva
  automáticamente para forzar el cambio.

## Recuperación fail-closed

No usar `IF NOT EXISTS` ni `prisma migrate resolve` a ciegas.

- Si el índice concurrente falla, inspeccionar `pg_index.indisvalid` e
  `indisready`. Un índice inválido se elimina con `DROP INDEX CONCURRENTLY` en
  la rama afectada; recién después se marca la migración como rolled back y se
  reintenta.
- Si la FK falla después de `ADD CONSTRAINT`, inspeccionar `convalidated`,
  columnas, tabla objetivo y acciones. Si el contrato exacto ya está validado,
  puede marcarse aplicado sólo con evidencia de catálogo y checksum. Si quedó
  `NOT VALID`, validar en una ventana aprobada o eliminar esa constraint exacta,
  marcar rolled back y reintentar.
- Un fallo posterior del build no justifica revertir una migración válida. Se
  conserva el cambio aditivo y se corrige hacia adelante.

## Gate de aprobación

El corte sólo queda aprobado cuando el mismo commit demuestra:

1. replay limpio de las 119 migraciones en PostgreSQL 17;
2. verificadores conductuales y de catálogo verdes;
3. `prisma migrate status` sin pendientes;
4. `prisma migrate diff ... --exit-code` con código 0;
5. índice unique válido/listo y FK validada con cascada;
6. borrado de un fixture de proyecto que elimina tarea, equipo y asignación;
7. Vercel Preview `Ready` y smokes HTTP sin 5xx.

PGlite ya acredita localmente 119/119, catálogo/cascada y drift cero. Esa
evidencia acelera el feedback pero no sustituye PostgreSQL 17 ni Neon Preview.
