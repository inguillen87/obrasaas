# Plan revisable de vínculos históricos

Este bloque convierte la auditoría de conciliación en una propuesta verificable de correspondencias. No importa filas ni reabre el panel. No declara que una elección local sea una aprobación autenticada.

## Generar y revisar
`npm run release:plan-legacy -- --expected-host <host-neon-productivo-exacto> --output .vercel/revision-identidades`

Reutiliza `CUTOVER_AUDIT_DATABASE_URL`, la validación TLS/host y la lectura PostgreSQL `REPEATABLE READ READ ONLY`. Exige revisión Git confirmada y sin cambios tracked. No usa el lector runtime que agrega defaults. El resultado privado contiene `manifest.json`, `check.json` y `review.html`, en una carpeta nueva debajo de `.vercel`, sin sobrescribir evidencias anteriores.

La hoja HTML funciona localmente, sin red, CDN, cookies de sesión ni API keys. Permite filtrar por empresa/obra/trabajador/tarea, proponer un destino y una pertenencia, o diferir con un motivo. Ningún candidato viene seleccionado. Muestra referencias, grupo de fuente y ordinal, no nombres, documentos, teléfonos, importes ni IDs originales. Esos localizadores deben contrastarse con la fuente autorizada; no bastan por sí mismos para reconocer una persona o aprobar su pertenencia. Cambiar una selección padre exige revisar sus dependientes.

La exportación es un JSON de propuesta, no una firma. Guardarlo dentro de `.vercel` y volver a contrastar:
`npm run release:plan-legacy -- --expected-host <host-neon-productivo-exacto> --review .vercel/mapping-decisions.json --output .vercel/revision-revalidada`

## Controles de la propuesta
La lectura nueva debe coincidir con las huellas del texto fuente íntegro, catálogo, historial de migraciones, versión de código y política. Un mensaje nuevo también invalida la observación anterior. Requiere cobertura completa sin duplicados, claves de esquema exactas y motivos conocidos. No acepta acciones de importación ni indicadores de autorización manipulados.

Los destinos deben existir y ser del tipo correcto. Un ID canónico exacto no puede apuntarse a otro. Las obras requieren una empresa histórica revisada; trabajadores/tareas requieren una obra revisada de la misma fuente. Se cotejan empresa y obra contra el catálogo y los vínculos declarados del registro. No permite fusionar varios registros históricos en uno ni reinterpretar automáticamente el proyecto seleccionado como propietario de todo el historial. Conflictos, duplicados, faltantes y decisiones diferidas quedan visibles y bloquean los pasos de ensayo.

Cuando las selecciones estructurales están completas, genera pasos `LINK_REFERENCE_ONLY` ordenados empresa → obra → trabajador/tarea, con claves deterministas para preparar el futuro ensayo. Esto NO es un importador idempotente implementado ni una garantía de escritura/replay en base: no existe comando `apply`, no hay DML en este bloque y `executionAllowed`/`importAuthorized` permanecen en falso. Mensajes, KYC, recibos, certificados, importes y campos históricos restantes no se convierten en objetos aprobados.

Las huellas sin clave son detectores de cambios, no firmas ni anonimización resistente frente a un atacante con el origen. La identidad y autoridad del revisor siguen sin verificarse. El informe local no sustituye la futura aceptación autenticada de migración.

## Pruebas y operación
Tests puros y de archivos cubren cambios de observación, pertenencia cruzada, destinos inválidos, cobertura, duplicados, límites, redacción y archivos existentes/simbólicos. La prueba PostgreSQL sólo acepta una base local desechable explícita; utiliza fixtures sintéticos y comprueba ausencia de escrituras del planificador. La prueba de navegador exporta y vuelve a validar propuestas sintéticas, verifica cuatro anchos, CSP y cero red. La normalización LF evita romper los hashes CSP al editar en Windows.

Exit 0 al generar significa borrador creado, no aprobado. Una revalidación con pendientes termina con exit 2; fallos de integridad o lectura terminan con exit 1 y códigos opacos. La consola sólo muestra agregados. Una carpeta previa nunca se reemplaza. Los permisos de archivos dependen del sistema operativo; `.vercel` no debe compartirse ni publicarse. Los cambios de credenciales, dominio, permisos runtime, base productiva y protección Vercel quedan fuera de este corte.
