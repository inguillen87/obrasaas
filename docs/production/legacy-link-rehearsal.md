# Ejecutor de ensayo de correspondencias históricas

Base: `64ce9003669ccd2b68b1d47c2329325021701e2c`. Implementa persistencia, recuperación y reversión del registro de referencias que el planificador aún no tenía. Su efecto es `REFERENCE_LEDGER_ONLY`: no importa datos de negocio ni acredita la identidad o autoridad del revisor.

## Destino explícito, fuera de producción
`release:rehearse-links` acepta únicamente el host no pooled de la copia restaurada `br-green-rice-ac9ugond`, base `neondb`. El host `ep-late-boat-acakm3wb.sa-east-1.aws.neon.tech` fue cotejado con Neon al preparar este bloque. No es una credencial. Otra rama, otra base, el servidor productivo y ejecutar el comando desde Vercel se rechazan.

Una sustitución de endpoint exige revisar el allowlist del código. Antes de cada ejecución operativa debe confirmarse con el proveedor que ese endpoint sigue asignado a la copia aislada. El CLI no cambia ramas, ni convierte su comprobación de host en una autorización emitida por Neon.

`CUTOVER_REHEARSAL_DATABASE_URL` es la única conexión del ejecutor, con TLS verificable. No utiliza `DATABASE_URL` como fallback, no carga archivos de secretos y no imprime conexiones. El código no se importa desde rutas web.

## Modos
El modo predeterminado `check` usa `--branch`, `--review` y `--output`. Revalida la propuesta con una lectura `REPEATABLE READ READ ONLY`. No crea el registro de ensayo. Entradas y resultados permanecen debajo de `.vercel`, sin sobrescribir archivos previos.

El modo `record` requiere además una `--operation-key` estable. Rechaza selecciones pendientes, pertenencias cruzadas o una observación cambiada. Sólo si la propuesta es estructuralmente completa, crea ejecuciones, referencias ordenadas y recibos en `obrasaas_link_rehearsal_v1`. No escribe en Organization, Project, Worker, Task, estado JSON, mensajes ni migraciones.

La transacción escritora mantiene locks SHARE sobre las fuentes mientras una segunda conexión toma la observación realmente de sólo lectura. Un advisory lock transaccional serializa el registro. Hay límites de espera y restricciones PostgreSQL de padre/hijo, orden y unicidad. Todos los cambios del registro se confirman juntos o se revierten juntos.

El modo `revert` utiliza el recibo anterior (`--receipt`, archivo `check.json`) y otra clave estable. La reversión es lógica: marca REVERTED y deja cero referencias activas en ese ensayo. Conserva referencias y eventos; no deshace datos de obra porque nunca los escribió. No existe modo de aplicación productiva.

## Recuperación
Una clave liga tipo de operación, destino y contenido. El mismo intento recupera el recibo persistido; cambiar su contenido se rechaza. Otra clave tampoco duplica un plan ya registrado. La lectura comprueba cantidad, orden y huellas del registro y eventos. Estas huellas son controles de integridad, no firmas resistentes a un administrador de base.

Si se pierde la respuesta al COMMIT, el resultado queda sin confirmar: no hay reenvío automático. Repetir la misma clave permite recuperar lo confirmado o ejecutar el intento que no alcanzó el commit. Un recibo histórico sigue recuperable tras cambiar la fuente, pero declara `sourceRevalidated=false`, no una validación nueva. Repetir un registro revertido no lo reactiva.

Si falla el informe local después del commit, se informa `REHEARSAL_REPORT_FAILED_RECOVER_SAME_KEY` sin afirmar que la base haya revertido. Se recupera con la misma clave/manifiesto y una carpeta de salida nueva. Los errores son opacos. La revisión Git y la política siguen ligadas al manifiesto; un plan no ejecutado debe regenerarse si cambia su código de origen.

## Informe y aceptación
El resultado privado incluye el manifiesto, `check.json` y un HTML local sin scripts, formularios ni red. Distingue registro, recuperación y reversión, cuenta referencias activas e identifica revisión y recibo. No presenta nombres, teléfonos, documentos ni IDs originales ni confunde el resumen con aceptación autenticada.

La suite pura verifica el destino, comandos, límites, flags, recibos, errores e informe. El ensayo PostgreSQL 17 sólo acepta una base LOCAL DESECHABLE y fixtures sintéticos. Prueba persistencia real, concurrencia, rollback parcial incluso de esquema, respuesta perdida antes/después del commit, replay, fuente cambiada, bloqueo de escritura concurrente, reversión y detección de referencias alteradas. Sus cambios de fixture se restauran; ese verificador no acepta Neon ni producción.

El informe de navegador utiliza un recibo persistido de ese ensayo, a 320/390/768/1280 y sin red. También se ejecutan la suite productiva previa, auditoría de dependencias, lint, build y controles posteriores del dominio estable. Los resultados efectivos, SHA y CI se registran al cerrar, sin atribuirle las pruebas de la rama enterprise distinta.

Fuente técnica: PostgreSQL 17, https://www.postgresql.org/docs/17/sql-lock.html y https://www.postgresql.org/docs/17/explicit-locking.html. La creación del registro de ensayo no es una migración Prisma ni se ejecuta durante el build de Vercel.

La revisión de las 24 correspondencias reales sigue siendo un requisito independiente. El desarrollo no inventa decisiones para cerrar ese requisito; si el manifiesto real continúa pendiente, el ejecutor se detiene antes de escribir.
