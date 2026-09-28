# Revisión privada de identidades con contexto

Base: `9f553a2f62582d787a5c7c4efbcb5e57188905e0`. La hoja anterior mostraba referencias y ordinales, insuficientes para reconocer empresas, obras y personas. Esta entrega añade contexto de nombres leído del origen autorizado, sin cambiar permisos runtime, migraciones ni las reglas del ejecutor de ensayo.

## Uso
`npm run release:review-identities -- --expected-host <host-neon-exacto> --private-context local --output .vercel/revision-con-contexto`

El comando requiere la variable existente `CUTOVER_AUDIT_DATABASE_URL`, el host exacto, revisión Git limpia y la opción explícita de contexto privado. Rechaza ejecución dentro de Vercel. No carga secretos de archivos ni los imprime. La conexión conserva TLS verificable y la lectura `REPEATABLE READ READ ONLY` del auditor anterior.

El lector obtiene opcionalmente nombres de Organization, Project, Worker y Task en esa misma transacción. Con la opción deshabilitada el contrato y las consultas del auditor original se mantienen. Los nombres históricos proceden del JSON ya leído. No se consultan columnas de DNI, teléfonos, correos, cuentas, claves ni direcciones. No se incluye el contenido de mensajes o comprobantes. Los propios nombres son datos privados y podrían contener texto introducido por usuarios: no se afirma anonimización.

Sólo `review.html` incluye los nombres. `manifest.json`, el archivo exportado y `check.json` contienen referencias, huellas y agregados. La carpeta se crea debajo de `.vercel`, sin sobrescribir archivos anteriores y conservando los controles de rutas/enlaces simbólicos del escritor existente.

## Flujo de revisión
La hoja empieza por empresas, luego obras y por último trabajadores/tareas. Incluye búsqueda por nombre/referencia, filtros por tipo/estado, nombres del destino con su empresa y obra, referencias de origen, candidatos por ID separados de coincidencias nominales y aviso de nombres históricos repetidos.

No selecciona candidatos. Una coincidencia nominal no prueba identidad ni autoriza fusionar registros. Las identidades distintas con nombres iguales se mantienen distintas. Las pertenencias declaradas en la fuente se muestran cuando resuelven a otras referencias; su ausencia no se completa con la obra activa.

Para proponer un vínculo dependiente, primero se revisa su padre. Los destinos se filtran por esa pertenencia. Cambiar el destino/decisión del padre retira las propuestas dependientes y exige revisarlas nuevamente. Se solicita contraste documental explícito; marcarlo registra una declaración del operador, NO verifica su identidad, la evidencia externa ni autoridad de migración.

El borrador puede exportarse y luego importarse en una hoja de la misma observación. Exportar omite nombres. Se avisa antes de salir con cambios sin exportar. Si hay una selección incompleta, la exportación se detiene y explica qué falta; no se promete autosave ni recuperación de una pestaña cerrada. Cambiar la observación o estructura de una importación se rechaza antes de alterar las elecciones locales.

## Revalidación e interoperabilidad
Guardar la propuesta exportada dentro de `.vercel` y volver a ejecutar el comando con `--review .vercel/identity-decisions.json` y otra carpeta `--output`.

Se cotejan nuevamente el texto fuente completo, catálogo, migraciones, código/política y el contexto mostrado. Renombrar un destino invalida la observación aunque sus IDs no hayan cambiado. Las huellas incluyen el nombre completo normalizado, también más allá de los 160 caracteres visibles. Dos nombres distintos con igual prefijo truncado no se consideran coincidencia nominal.

Si la propuesta es estructuralmente completa y el contexto sigue vigente, la salida añade `validated-plan.json`, compatible con el comprobador/ejecutor anterior. Si sigue pendiente no genera ese archivo. Todos los controles de pertenencia, duplicados, identidad exacta y concurrencia del planificador y del ensayo se conservan. `importAuthorized`, `executionAllowed` y `reviewIdentityVerified` siguen en falso: el archivo no aprueba importaciones.

## Contención y pruebas
El HTML usa CSP con hashes de los bloques locales, sin conexiones ni formularios enviados. Las etiquetas se insertan como texto y los datos embebidos se escapan. El navegador no recibe credenciales de base.

La suite verifica renombres, nombres repetidos, campos ajenos, pertenencias, exportaciones sin nombres y compatibilidad del plan. PostgreSQL 17 desechable prueba la lectura opcional en la misma transacción. El navegador prueba búsqueda, propuestas por padres, retirada de hijos, reimportación y cuatro anchos. CI sólo usa fixtures sintéticos.

Los nombres del archivo real permanecen locales. No publicar ese HTML en GitHub, Vercel o artifacts. Las huellas son controles de cambios, no firmas de identidad ni anonimización. Referencia de CSP: https://www.w3.org/TR/CSP/ .
