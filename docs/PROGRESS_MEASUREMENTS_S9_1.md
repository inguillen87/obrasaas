# S9.1 · Mediciones técnicas de avance

## Estado y límite

S9.1 incorpora una medición cuantitativa, revisable y auditable por tarea y
quincena civil. La medición conserva unidad, cantidad base, cantidad ejecutada
en el período, acumulado aprobado, método, fundamento y evidencia.

Este corte no es una certificación contractual y no habilita pagos. Tampoco
reescribe `Task.progress`, la baseline, el forecast, el presupuesto ni una
cuenta por pagar. S10 deberá consumir exclusivamente mediciones aprobadas y
agregar sus propias reglas legales, económicas, de retención y publicación.

## Autoridades de datos

- `Task` identifica la partida operativa. Un `MILESTONE` no es medible.
- `ProgressEvidence` aporta evidencia previamente aprobada de la misma tarea y
  obra. Una foto, una inferencia de IA o un porcentaje aislado nunca se
  convierten por sí solos en medición.
- `TaskProgressMeasurement` guarda cada propuesta como revisión inmutable.
- `TaskProgressMeasurementDecision` guarda la aprobación o rechazo como evento
  append-only de un actor distinto.
- `TaskProgressMeasurementHead` y `TaskProgressMeasurementBalance` son
  proyecciones gobernadas por PostgreSQL para CAS y acumulados exactos.

## Períodos, unidades y cantidades

El período sigue `CALENDAR_FORTNIGHT_V1`:

- primera quincena: día 1 al 15;
- segunda quincena: día 16 al último día civil del mes;
- la zona horaria de la organización define la fecha civil presentada, pero la
  base persiste como columnas `date` y no como un bloque móvil de catorce días.

Las cantidades usan `Decimal(18,4)` y viajan por JSON como texto canónico. No
se aceptan números JavaScript, coma decimal, exponente, signo positivo, valores
no finitos ni más de cuatro decimales. Las unidades iniciales admitidas son
`M`, `M2`, `M3`, `KG`, `T`, `L`, `UNIT`, `HOUR`, `DAY` y `LOT`.

La primera aprobación fija la unidad y la cantidad base técnica de la tarea.
S9.1 no permite cambiar esa base: una modificación futura exige change control
explícito. PostgreSQL deriva el acumulado y garantiza:

```text
base > 0
cantidad_del_período > 0
acumulado_anterior >= 0
acumulado = acumulado_anterior + cantidad_del_período
acumulado <= base
```

## Flujo y concurrencia

1. Un actor con `org:measurements:prepare` propone una medición y adjunta entre
   una y diez evidencias aprobadas de la tarea.
2. La propuesta queda pendiente; no existe actualización optimista de estados
   contractuales.
3. Otro `TenantMembership` activo con `org:measurements:approve` aprueba o
   rechaza. Maker y checker nunca pueden ser la misma membresía, incluso si el
   actor es administrador.
4. Una corrección crea una revisión nueva. Las propuestas, evidencias y
   decisiones anteriores no se editan ni eliminan.
5. Las quincenas se aprueban cronológicamente. Una corrección sólo puede
   reemplazar el último período aprobado, evitando rebases implícitos.

Las mutaciones requieren `Idempotency-Key`, fingerprint del body normalizado y
CAS del head observado. Un replay exacto devuelve el resultado original; la
misma clave con otro contenido falla con `409`. Las reservas de lock, las
revalidaciones de rol y los cálculos de saldo ocurren dentro de la misma
transacción PostgreSQL.

## Roles

| Rol | Leer | Preparar | Aprobar/rechazar |
| --- | --- | --- | --- |
| Administrador | Sí | Sí | Sí, salvo su propia propuesta |
| Director de obra | Sí | Sí | Sí, salvo su propia propuesta |
| Jefe de obra | Sí | Sí | No |
| Administración | Sí | No | No |
| Auditor | Sí | No | No |

Un superadministrador de plataforma sin membresía activa en el tenant no
sustituye la autoridad de obra.

## API y experiencia

- `GET /api/progress-measurements`: snapshot privado y no cacheable, limitado a
  la organización y obra activas.
- `POST /api/progress-measurements`: prepara una propuesta con body estricto e
  idempotencia obligatoria.
- `POST /api/progress-measurements/:measurementId/review`: aprueba o rechaza
  con CAS, idempotencia y maker-checker.
- `/dashboard/measurements`: superficie separada de la bitácora, con cantidad
  base, período, acumulado, restante, porcentaje derivado, evidencia y línea de
  decisiones.

El DTO público no incluye operation hashes, fingerprints internos ni detalles
de media privada. La pérdida de una respuesta POST entra en estado incierto y
se concilia mediante GET con la misma clave; nunca se reintenta automáticamente
una mutación ambigua.

## Criterio de salida

El corte sólo puede marcarse implementado cuando pasan:

- contratos Prisma/migración y verificador semántico;
- replay exacto y replay mutado;
- Decimal exacto, overflow y acumulado mayor a la base;
- tarea/evidencia cross-tenant y evidencia no aprobada;
- maker-checker, rol revocado y carreras de dos makers/dos checkers;
- orden cronológico, rechazo, corrección del último período y CAS stale;
- prueba de que ninguna mutación escribe `Task.progress`, presupuesto,
  certificado o pago;
- suite, lint, Prisma, build y PostgreSQL 17 sin drift;
- Preview exact-SHA antes de cualquier afirmación remota.

