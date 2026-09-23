# S10.CERT-QA — Archivado frente a preparación de certificados

Base: `b7203e04cd0fb8a5afd8ca87836e2dbb55264221`. Diagnóstico y validación iniciados el 23/09/2026 UTC.

## Incidencia identificada

Run del PR `35811676616`, intento 1, job `107024419340`, paso `Verify project certificates on PostgreSQL 17`. El log leído mediante la acción autorizada de GitHub registra:

```
Archive-vs-pending loser was not controlled: code=42501 message=PROJECT_CERTIFICATE_PREPARER_REQUIRED: active SITE_MANAGER is required
```

No falló la aplicación de migraciones. El verificador simultáneo sólo admitía NOT_READY/PROJECT_ARCHIVED cuando ganaba el archivado. Omitía el rechazo previo de elegibilidad del preparador.

El worker de PREPARE toma el bloqueo transaccional de obra y luego comprueba `obrasaas_project_contract_membership_matches`. Ese helper requiere membresías activas y además `Project.status <> ARCHIVED`. Si el archivado gana, la persona conserva su rol/membresía, pero ya no cumple la condición de obra operable: se rechaza con PREPARER_REQUIRED y SQLSTATE 42501 antes de crear el certificado. El resultado depende del orden de las operaciones; repetir hasta verde no diagnostica esa diferencia.

Fuentes del código: `20260811200000_project_contract_authority_sov/migration.sql`, función de membresía; `20260812120000_project_certificates_s10_cert/migration.sql`, worker PREPARE y guard de archivado. No se cambian estas migraciones, funciones de autorización ni triggers productivos.

## Corrección del verificador, sin admitir errores genéricos

La política de ensayo coteja SQLSTATE, marcador exacto y estado final. PREPARER_REQUIRED sólo es aceptable con obra archivada, membresía SITE_MANAGER todavía activa, elegibilidad de obra retirada y ninguna versión o pendiente. Un error de rol en una obra activa, una membresía revocada, error de alcance, timeout, deadlock o duplicación SQL sigue haciendo fallar el ensayo.

Se comprueban las siete tablas de certificados: un archivado ganador no deja libros, cabezas, versiones, líneas, deducciones, decisiones ni recibos. Si gana PREPARE, queda exactamente un certificado, dos líneas del fixture (medida y sin reclamo), un recibo, punteros al mismo ID y revisiones 1. Las membresías, tarea, contrato y corte técnico se comparan antes/después sin cambios.

## Cuatro órdenes obligatorios

1. Inicio simultáneo, conservando la carrera original y admitiendo sólo el resultado contractual con un ganador.
2. Archivado dentro de una transacción abierta; PREPARE queda esperando el bloqueo real. El observador comprueba PID bloqueado, PID bloqueante mediante `pg_blocking_pids` y espera de tipo advisory. Al confirmar el archivado debe reproducirse el rechazo exacto 42501/PREPARER_REQUIRED, sin hechos residuales.
3. PREPARE mantiene abierta su transacción; el archivado debe rechazar con 40001/PROJECT_ARCHIVE_BUSY. Se confirma un solo certificado y la obra sigue activa.
4. PREPARE ya confirmado; el archivado debe rechazar con 55000/PROJECT_ARCHIVE_BLOCKED_BY_PENDING_GOVERNANCE. La restricción persistida no depende de que siga tomado un lock.

Los cuatro casos se ejecutan en el verificador permanente de CI. El ensayo focal `verify-certificate-archive-orders.mjs` exige base local desechable reconocida y ejecuta tres repeticiones fijas: doce resultados obligatorios, no reintentos hasta aprobar. Ante un fallo no se omite el caso. El cleanup existente, restringido a fixtures, debe restaurar sus triggers y no dejar residuos.

## Validación y alcance

Pruebas unitarias de política incluyen estados incoherentes y SQLSTATE/marcadores incorrectos. La validación SQL reproduce primero el fallo de la implementación anterior forzando únicamente el orden archivado→PREPARE en un harness temporal; no cambia el predicado anterior ni las funciones SQL. Después ejecuta el verificador corregido completo y los doce órdenes focales con PostgreSQL 17 aislado.

SHA, integridad del árbol, recuentos y resultados efectivos se registran en el PR tras ejecutarlos. Una prueba negativa esperada de la base anterior no es una ejecución aprobada de esa versión; demuestra la regresión que se corrige.

Esta entrega modifica verificadores, tests y documentación. No modifica módulos de negocio, rutas, permisos, tablas o datos productivos. El Preview de aplicación existente puede conservarse sin generar otra compilación pública sólo por cambiar el ensayo desechable. El pase a Production y el login autenticado mantienen sus requisitos propios.

## Acceso autenticado: restricción observada, no fallo desconocido

La configuración GitHub del entorno `clerk-development-e2e` contiene las dos credenciales de ensayo, sin leer sus valores. Sólo permite las ramas `master` y `codex/platform-ux-foundation` y exige revisión de `inguillen87`. El job de CI también limita esas ramas. La rama de recuperación está excluida por ambas reglas; no corresponde llamarlo falta de credenciales ni intentar saltarlo desde otra rama. No se cambiaron dichas políticas, revisores o secretos en esta entrega.

Fuentes primarias técnicas consultadas:
- https://www.postgresql.org/docs/17/transaction-iso.html
- https://www.postgresql.org/docs/17/xfunc-volatility.html
- https://www.postgresql.org/docs/17/functions-info.html

La lectura del error, el razonamiento sobre las funciones locales y la reproducción SQL son evidencias separadas. No se atribuye a esas fuentes públicas el comportamiento particular de ObraSaaS.
