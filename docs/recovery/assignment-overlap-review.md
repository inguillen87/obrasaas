# S11.A12 — Revisión de coincidencias antes de planificar

Base: 4fe0687cda61636977603d5e7d77e52f7679c195. Fecha: 20/09/2026.

## Alcance
El planificador consulta las asignaciones planificadas/en curso de la misma obra y las participaciones en cuadrillas. Muestra coincidencias antes de guardar y requiere un criterio de coordinación cuando hay advertencias. Es una ampliación del circuito de ejecución existente, no un cálculo de nómina o disponibilidad laboral.

Se compara el mismo responsable directo y personal compartido entre cuadrillas según los períodos registrados. No se comparan identidades de otras empresas u obras ni se utilizan teléfonos, documentos o fotografías para equiparar personas.

## Fechas y significado
Las asignaciones se comparan por días de planificación UTC, incluidos inicio y fin. Las participaciones de cuadrilla conservan su intervalo: inicio incluido y final excluido. Un vínculo finalizado exactamente antes de la ventana no genera una coincidencia por sí solo.

Las participaciones repetidas de una persona se agrupan para no multiplicar alertas. Dos cuadrillas requieren un integrante compartido cuyos períodos coincidan con ambas asignaciones. Esto no demuestra doble jornada ni incumplimiento laboral.

Una propuesta sin fechas completas exige reconocer esa falta de datos. Una cuadrilla sin integrantes registrados para el período queda con dotación no verificada. Nunca se presentan como capacidad disponible confirmada.

## Consulta y guardado
El nuevo POST `/api/execution/assignments/review` sólo consulta. Exige sesión, lectura de ejecución/tareas, cabeceras de contexto y cuerpo acotado. Lee las fuentes en RepeatableRead. No modifica estados, fechas ni asignaciones.

El guardado del planificador exige una revisión confirmada y vuelve a leer las fuentes dentro del bloqueo transaccional de proyecto. Una huella diferente impide crear el registro y pide revisar de nuevo sin perder el formulario. La huella es un cotejo de contenido, no una firma digital ni una concesión de permisos.

Si hay coincidencias o datos insuficientes, el administrador debe explicar cómo coordinará los trabajos o completará la información. Esta explicación no permite eludir permisos, duplicados exactos, revisiones obsoletas o estados de sólo lectura.

Se reutilizan el creador y los recibos existentes. Si un intento ya creó la asignación, repetir su cuerpo/clave devuelve el mismo registro antes de analizar la planificación posterior. Cambiar la explicación con la misma clave se rechaza. La revisión y el criterio aceptados se guardan en la auditoría de creación; si ésta falla, se revierte la escritura.

La API genérica de ejecución conserva su contrato legacy. La revisión obligatoria corresponde al planificador revisado, no a una restricción SQL global frente a escrituras externas.

## Consultas acotadas
Se permiten hasta 1.000 asignaciones pertinentes y 3.000 participaciones. Una fila adicional detecta exceso: el resultado falla explícitamente en lugar de truncarse como un cero saludable. La interfaz muestra hasta ocho coincidencias e informa el total. No calcula disponibilidad entre obras, licencias, feriados, turnos u horas pactadas.

## Experiencia del administrador
La revisión está dentro de Planificar asignación. Cambiar actividad, responsable o fechas invalida el resultado anterior. La consulta es explícita para evitar sondeos costosos mientras se escribe. El resultado distingue coincidencia por responsable directo, personal compartido y datos incompletos. Los enlaces llevan a la actividad y sus asignaciones, respetando el aviso de cambios locales sin guardar.

Los avisos usan texto además del color, fechas día/mes/año, controles táctiles y un panel móvil desplazable. Una respuesta de otra obra, un conjunto incompleto o fechas malformadas no habilitan la confirmación. Un fallo temporal conserva el borrador; no genera asignaciones automáticas.

La consulta se restringe a los recursos relacionados: participaciones del responsable o de su cuadrilla, otras cuadrillas de esas personas y asignaciones directas o de esos equipos dentro del período. No recorre por defecto todas las asignaciones de todas las obras. Los intervalos repetidos se fusionan antes de comparar para evitar multiplicar alertas y trabajo por cada episodio.

## Pruebas y evidencia
`tests/assignment-overlap-review.test.js` ejercita la comparación, bordes inclusivos de días, final excluido de participaciones, personal compartido, fechas incompletas, consultas acotadas, cambios entre revisión y guardado, replay, motivo de coordinación, rollback y conservación de tarea. El adaptador de base comprueba scope y límites, pero no reemplaza una prueba de concurrencia entre conexiones PostgreSQL reales.

`verify-assignment-overlap-ui.mjs` utiliza Planner, servicio de revisión, creador transaccional y HTTP reales del ensayo con un adaptador de base controlado y datos sintéticos. Recorre alerta, justificación, cambio de fechas, cambio concurrente simulado, rechazo sin escritura, nueva revisión, respuesta perdida tras guardar y recuperación del mismo intento. También comprueba falta de fechas, respuesta de otra obra y 320/390/768/1280 px.

Las pruebas de asignaciones previas incorporan la nueva revisión obligatoria antes del mismo ciclo de estados. Se mantienen las regresiones de integrantes y restricciones. No se incorporan dependencias ni migraciones; no se asignan personas reales ni se envía WhatsApp en estas pruebas. El commit, build, preview y comprobaciones públicas se registran separadamente en el PR #1. El pase a producción y la respuesta física del canal continúan requiriendo su validación propia.
