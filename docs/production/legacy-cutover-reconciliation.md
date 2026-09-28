# Conciliación histórica antes del pase enterprise

La evolución del esquema no importa por sí sola el JSON histórico a organizaciones, obras, trabajadores, tareas y registros canónicos. Esta herramienta identifica diferencias sin modificarlas. No sustituye autenticación productiva ni autoriza migraciones o importaciones.

## Implementación
`npm run release:audit-legacy -- --expected-host <endpoint-neon-exacto> --output .vercel/legacy-audit.json`

La conexión se toma sólo de `CUTOVER_AUDIT_DATABASE_URL`, nunca se imprime y no se acepta una URL como argumento. Se exige host Neon exacto, puerto estándar y TLS con certificado verificado. Las opciones URL desconocidas se rechazan. El comando debe ejecutarse desde una revisión confirmada, sin cambios tracked pendientes.

Un único cliente abre `REPEATABLE READ READ ONLY`, verifica el modo efectivo, limita tiempos y tamaños, consulta columnas explícitas y finaliza con ROLLBACK. No utiliza `getAppState`, que mezcla defaults y puede escribir al leer. No ejecuta DDL ni comandos de negocio. El JSON fuente se mantiene como texto PostgreSQL para la huella: no se reconvierten importes ni enteros grandes.

El reporte contiene inventario por campo conocido, conteos, diferencias de identidades/vínculos y huellas del estado completo y del catálogo. No incluye nombres, teléfonos, documentos, coordenadas, URLs de archivos, valores de proveedores ni IDs individuales. Campos desconocidos se contabilizan, sin exportar sus claves. No identifica por intuición datos como reales o demo.

La coincidencia de nombre, teléfono, el proyecto seleccionado y un externalId sin contexto no son autoridad de empresa/obra. Las coincidencias externas sólo se informan como candidatas. IDs compartidos en varias obras, datos sin vínculo explícito, identidades no conciliadas, campos incompatibles e históricos de certificación/KYC requieren revisión. No convierte afirmaciones históricas en aprobaciones canónicas.

`--compare .vercel/legacy-audit.json` compara otra observación con el informe anterior. La huella sin clave detecta cambios accidentales; **no es una firma ni prueba frente a un atacante que pueda reconstruir el informe**. El reporte nunca establece `importAuthorized=true`. Las huellas del catálogo cubren sólo IDs, vínculos y versiones consultadas, no cada columna de cada tabla.

## Resultados y errores
`AUDIT_COMPLETED` significa que la lectura y el diagnóstico terminaron. `migrationReadiness=BLOCKED` o `REVIEW_REQUIRED` conserva separados diagnóstico y autorización. Exit 0 no autoriza desplegar/importar; exit 2 indica que la comparación detectó cambios; exit 1 indica un fallo y no genera un informe parcial que aparente éxito.

El archivo debe ser nuevo, JSON y estar debajo de `.vercel`; no se sobreescribe un informe previo ni se versiona su contenido. La salida de consola contiene sólo agregados y códigos estables. Los errores no exponen mensajes del driver ni la URL.

## Pruebas y operación
Los tests `production-cutover-audit.test.mjs` cubren tipos, pertenencia, identidades duplicadas, ambigüedad, datos sensibles, huellas exactas, comparación, modos de lectura, límites y errores. `verify-cutover-readonly-postgres.mjs` usa únicamente PostgreSQL 17 local desechable habilitado expresamente: crea fixtures sintéticos, lee dos veces, coteja fuentes exactas y comprueba que la transacción finalizó.

CI ejecuta ambas capas además de la auditoría de dependencias, compilación estándar y pruebas de la barrera productiva. El reporte de la base real y los resultados de la entrega se registran en la continuidad del PR #4 después de ejecutarse, sin incluir filas privadas.

Este corte no reabre el panel ni promueve la base de ensayo. Siguiente paso: resolver los vínculos identificados con un manifiesto aprobado y un importador idempotente probado en copia aislada, además de completar identidad, proveedores y aceptación autenticada.
