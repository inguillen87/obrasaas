# S10-CERT Fase 1 - certificado contractual gobernado

Estado: **contrato de implementación congelado; backend pendiente**.

Este documento define la primera fase técnica de certificación de avance. Su
objetivo es convertir un corte técnico S9.2-MED y una SOV contractual S9.3
exactos en un snapshot monetario reproducible, revisado por la autoridad
contractual designada. No acredita validez legal, fiscal o contable y no
representa una factura, una conformidad financiera, un PDF firmado ni un pago.

## Límite de la fase

S10-CERT Fase 1 incluye exclusivamente:

- candidato derivado íntegramente en PostgreSQL;
- propuesta operativa no vinculante por un `SITE_MANAGER` activo de la obra;
- decisión append-only por el `DIRECTOR` certificador exacto de la autoridad
  contractual aprobada;
- versiones inmutables por obra y quincena;
- cantidades, importes y retención exactos, en minor units y sin `Number`;
- replay idempotente, CAS, hashes, locks y verificador PostgreSQL 17;
- API privada de lectura, propuesta y decisión.

Quedan fuera de esta fase:

- S10-FIN y cualquier conformidad financiera;
- S10-PAYREF, conciliación o referencia externa de pago;
- PDF, firma, sello, numeración fiscal, impuestos, IVA, tipo de cambio y
  facturación;
- cuentas a pagar, `SupplierInvoice`, `BudgetVersion`, `BudgetLine` y estados
  `PAID`;
- UI productiva, automatización desde IA/fotos y Production.

## Autoridades de entrada

Un candidato consume únicamente este par inmutable y del mismo tenant/obra:

```text
ProjectProgressMeasurementCut.current exacto (S9.2-MED)
+ ProjectContractVersion.current APPROVED exacta (S9.3-CONTRACT)
```

También fija la `ProjectContractAuthorityVersion` aprobada enlazada por esa
versión contractual. El cliente no puede enviar líneas técnicas, cantidades
acumuladas, importes derivados, totales, hashes ni IDs alternativos.

Al preparar y al **aprobar**, el servidor revalida bajo lock:

1. organización, obra y quincena civil exactas;
2. cut igual al `currentCutId` de su head y todas sus líneas inmutables;
3. contrato igual al `currentVersionId`, autoridad exacta aprobada y ausencia
   de propuestas contractuales o de autoridad pendientes;
4. cobertura uno a uno de todas las tareas de cut y SOV;
5. unidad y `baseQuantity` idénticas para cada línea `VALUED`;
6. digests de cut, contrato, autoridad y candidato;
7. membresías tenant y project activas de los actores exactos.

La revalidación de actores no es un `EXISTS` sin protección. Cada comando toma
`FOR SHARE` o `FOR UPDATE` —nunca sólo `FOR KEY SHARE`— sobre las filas
`TenantMembership` y `ProjectMembership` relevantes, ordenadas primero por
membership ID y luego por project-membership ID, y conserva esos locks hasta
commit. Prepare bloquea al maker; APPROVE bloquea maker y certifier; REJECT
bloquea al certifier; CANCEL bloquea certifier, registrar y, si corresponde, al
fallback. Así un cambio concurrente de rol/status o un DELETE de acceso no
puede entrar después de la validación y antes de la decisión.

Antes del primer certificado también se exige que
`contract.authorityVersionId == contractHead.currentAuthorityVersionId`. Una
autoridad ya reemplazada no puede certificar por el solo hecho de seguir
enlazada a una SOV histórica. Tras el primer approval, book fija los dos IDs y
el guard cross-domain bloquea ambas rotaciones hasta S19.

El puntero `currentCutId` no demuestra por sí solo que el corte siga fresco:
S9.1 puede aprobar una corrección después del último seal. Prepare y approve
toman, en orden de `taskId`, los advisory locks S9.1 de la unión de **todas**
las tareas canónicas del cut target y de cada certificado current aprobado.
Bajo esos locks reconstruyen el candidato S9.2 vivo de cada uno de esos
períodos, incluido el target, y exigen para cada período:

- cero mediciones pendientes de review en el período;
- `liveCandidateSha256 == cut.candidateSha256`;
- conteos, estados y hashes de línea idénticos.

Después de los task locks, prepare y approve toman también los
`progress-measurement-cut:scope` de **todos** los períodos con certificado
current aprobado más el período target, ordenados por `periodStart`. Recién
entonces comparan cada cutId/hash y cada candidato vivo rederivado contra el
cut que consumió su certificado. Un cut histórico stale bloquea aunque su head
todavía conserve el mismo `currentCutId`; no hace falta esperar un reseal para
derivar `HISTORICAL_RESTATEMENT_REQUIRED`. Así una corrección S9.1 o un reseal
histórico no pueden entrar entre el scan y el commit.

Un cut desactualizado bloquea con `CERT_TECHNICAL_CUT_STALE` hasta crear la
nueva versión S9.2. Todos los locks se conservan hasta commit, de modo que una
aprobación S9.1 o un reseal S9.2 no puede entrar entre la validación y la
decisión S10.

## Ausencia no es cero

Las únicas derivaciones permitidas son:

| SOV S9.3 | cut S9.2 | resultado S10-CERT |
| --- | --- | --- |
| `NO_CLAIM` | `MEASURED` o `MISSING` | línea `NO_CLAIM`; cantidades e importes `null`; conserva el fundamento contractual |
| `VALUED` | `MEASURED` compatible | línea `VALUED`; cálculo server-owned |
| `VALUED` | `MISSING` | blocker `CERT_TECHNICAL_MEASUREMENT_MISSING`; no se puede preparar ni aprobar |
| `VALUED` | `MEASURED` incompatible | blocker `CERT_CONTRACT_TECHNICAL_BASIS_MISMATCH`; no se puede preparar ni aprobar |

`VALUED + MISSING` jamás se convierte en `NO_CLAIM`, avance cero o monto cero.
Las únicas salidas son un nuevo cut técnico compatible o un change control
contractual futuro fuera de esta fase.

## Vigencia y acumulado inicial

`effectiveFrom <= certificate.periodStart` no alcanza para autorizar un primer
certificado acumulado. Para cada línea `VALUED`, PostgreSQL deriva la primera
`periodStart` de una medición S9.1 aprobada que contribuye a la cantidad
acumulada del cut. Esa fecha se guarda y entra al hash como
`technicalCumulativeOriginPeriodStart`.

La derivación recorre hasta la quincena certificada los
`approvedMeasurementId` **vigentes** de cada head S9.1 y toma el primer período
con `periodQuantity > 0`. No considera decisiones aprobadas ya sustituidas por
una corrección posterior del mismo head.

El contrato debe cumplir:

```text
contract.effectiveFrom <= technicalCumulativeOriginPeriodStart
```

Si no lo cumple, el candidato queda bloqueado con
`CERT_RETROACTIVE_CONTRACT_BASIS`. La fase no recorta cantidades históricas ni
infiere un offset contractual. El primer certificado puede reconocer avance
acumulado previo sólo cuando la vigencia contractual lo cubre expresamente.

## Política monetaria exacta

Todos los importes persistidos son `BIGINT` minor units. HTTP los representa
como strings decimales canónicos. Las cantidades son `DECIMAL(18,4)` y también
salen como strings. Ningún cálculo monetario usa JavaScript `Number`.

La versión de cálculo inicial es:

```text
CERT_CUMULATIVE_GROSS_HALF_UP_V1
```

Por cada línea `VALUED`:

```text
cumulativeGrossMinor = HALF_UP(
  contractAmountMinor * cumulativeQuantity / baseQuantity
)

certificateIncrementGrossMinor =
  cumulativeGrossMinor - previousApprovedCumulativeGrossMinor
```

`previousApprovedCumulativeGrossMinor` proviene del último certificado aprobado
de una quincena anterior. En el primer certificado vale cero. Una corrección de
la misma quincena vuelve a usar como base el certificado aprobado anterior a
esa quincena, no la versión que corrige.

PostgreSQL rechaza:

- cantidades negativas o por encima de la base;
- `cumulativeGrossMinor` menor que el certificado aprobado de la quincena
  cronológica anterior. Una corrección sí puede bajar respecto de
  `supersedesApprovedVersionId`, siempre que el nuevo incremento desde el
  período anterior siga siendo mayor o igual a cero;
- `certificateIncrementGrossMinor < 0`;
- overflow de `BIGINT` en línea o total;
- moneda, escala o política distintas de la versión contractual fijada.

## Retención sin drift de redondeo

La retención no se redondea por línea ni se suma período por período. Se deriva
sobre el total acumulado y luego por diferencia:

```text
cumulativeGrossTotalMinor = SUM(line.cumulativeGrossMinor)

certificateIncrementGrossTotalMinor =
  cumulativeGrossTotalMinor
  - previousApprovedCumulativeGrossTotalMinor

certificateIncrementGrossTotalMinor =
  SUM(VALUED line.certificateIncrementGrossMinor)

cumulativeRetentionMinor = HALF_UP(
  cumulativeGrossTotalMinor * contract.retentionBps / 10000
)

certificateIncrementRetentionMinor =
  cumulativeRetentionMinor - previousApprovedCumulativeRetentionMinor
```

Ambas formas de derivar `certificateIncrementGrossTotalMinor` deben coincidir
exactamente. Los `SUM` se ejecutan como `NUMERIC`, se validan antes de convertir
a `BIGINT` y el worker rechaza overflow, delta bruto negativo o
`certificateIncrementRetentionMinor < 0`.

La política queda identificada como:

```text
CERT_CUMULATIVE_RETENTION_HALF_UP_V1
```

No se compara ese nombre con el término S9.3 como si fueran el mismo enum. El
certificado congela el `roundingPolicyVersion` contractual exacto
`CERT_RETENTION_HALF_UP_V1` y aplica el mapping allowlisted:

```text
CERT_RETENTION_HALF_UP_V1
  -> CERT_CUMULATIVE_RETENTION_HALF_UP_V1
```

Cualquier término contractual desconocido bloquea el candidato. Ambos
identificadores entran al hash para que una futura política no reinterprete
historia.

Esto evita que múltiples redondeos quincenales pierdan o agreguen minor units.
`retentionBps = 0` sigue siendo un término explícito, no una ausencia.

## Deducciones y neto

La propuesta puede incluir una lista acotada de deducciones del incremento
certificado. Cada
deducción exige código, razón y `amountMinor > 0`; se persiste append-only y
entra al fingerprint y al digest. No se admiten porcentajes, importes negativos,
adiciones, impuestos, FX ni conceptos implícitos.

Fase 1 admite como máximo 50 deducciones. `code` usa 1..64 caracteres seguros,
`reason` 1..1000 y cada minor amount debe caber en signed `BIGINT`; códigos
duplicados dentro de una versión son inválidos. El máximo de líneas técnicas es
el mismo límite server-owned de S9.2/S9.3: 5000, sin truncado silencioso.

```text
certificateIncrementDeductionsMinor = SUM(deduction.amountMinor)

certificateIncrementNetMinor =
  certificateIncrementGrossTotalMinor
  - certificateIncrementRetentionMinor
  - certificateIncrementDeductionsMinor
```

El neto debe ser mayor o igual a cero. Este resultado no es una conformidad ni
una instrucción, ejecución o prueba de pago.

## Modelo de persistencia

### `ProjectCertificateBook`

Una proyección mutable por organización y obra, gobernada sólo por funciones
SQL. Mantiene:

- `latestVersionSequence BIGINT`, contador DB-owned que prepare incrementa bajo
  `FOR UPDATE`; asigna `projectSequence` sin huecos por rollback y replay o
  decisiones no vuelven a incrementarlo;
- el tuple conjunto `pinnedContractHeadId`, `pinnedContractVersionId` y
  `pinnedAuthorityVersionId` después del primer certificado aprobado;
- `latestApprovedPeriodStart` y `latestApprovedCertificateVersionId`;
- `pendingCertificateVersionId`, único globalmente por obra;
- `revision`, timestamps y FKs tenant/project exactas.

El book aporta un CAS global para orden cronológico, pin contractual y una sola
propuesta pendiente sin reconstruir estado desde el ledger.

### `ProjectCertificatePeriodHead`

Una proyección por organización, obra y `periodStart`, con `periodEnd`,
`currentApprovedVersionId`, `latestVersionId` y `revision`. La versión actual
siempre es aprobada; una propuesta o rechazo no sustituye la vigente.

### `ProjectCertificateVersion`

Ledger append-only full-snapshot. Incluye, como mínimo:

- `projectSequence BIGINT` global de obra y `periodVersion INT` dentro del
  período;
- `predecessorId`, siempre la última tentativa del mismo período, para una
  cadena lineal que incluye aprobaciones, rechazos y cancelaciones;
- `supersedesApprovedVersionId`, la versión aprobada vigente del mismo período
  que una corrección reemplaza (nullable en la primera tentativa);
- `previousApprovedCertificateVersionId`, la vigente aprobada del período
  cronológico anterior y base de las fórmulas acumuladas;
- IDs y hashes exactos de book/head, cut, contrato y autoridad;
- período target, `coverageFrom`, `coverageThrough`, moneda/escala y versiones
  de políticas;
- conteos y totales acumulados/del incremento certificado;
- `candidateSha256`, `certificateSha256`, revisiones CAS y maker;
- hash de operation key, request fingerprint y timestamp server-owned.

### `ProjectCertificateLine`

Una línea inmutable por tarea/version. Congela estado contractual, IDs y hashes
de las líneas S9.2/S9.3, unidad/base, cantidades, origen acumulado, importes
previos/acumulados/del incremento certificado y `lineSha256`. `NO_CLAIM`
prohíbe cantidades e
importes no nulos.

### `ProjectCertificateDeduction`

Ledger hijo append-only, ordenado, con código/razón/importes exactos y hash de
línea. No referencia AP, facturas ni pagos.

### `ProjectCertificateDecision`

Decisión append-only uno a uno sobre una versión: `APPROVED`, `REJECTED` o
`CANCELLED`,
razón, checker, revisiones antes/después, snapshot del certificate hash,
operation hash/fingerprint y timestamp. No existe estado `PAID`.

`CANCELLED` nunca emite un certificado. Sólo existe cuando el certifier exacto
ya no puede ejecutar un `REJECT` válido por TenantMembership inactiva, rol
distinto de `DIRECTOR` o ProjectMembership inactiva/ausente. En ese caso el
registrar `ADMIN` exacto de la autoridad fijada puede cancelar con razón
obligatoria. Si DB demuestra además que ese registrar perdió status, rol o
acceso a la obra, el fallback no aprobatorio admite cualquier `ADMIN` con
TenantMembership y ProjectMembership activas en esa obra. El estado del maker
por sí solo nunca habilita `CANCEL`: mientras el certifier pueda rechazar, debe
cerrar por `REJECT`. La cancelación conserva actor, causa, hashes y recibo
append-only; sólo libera el pending y nunca mueve la versión aprobada.

`REJECT` no revalida la frescura monetaria del candidato: exige pending, CAS y
certificate hash exactos más el certifier activo, y siempre puede terminalizar
una propuesta que quedó stale. `CANCEL` aplica la misma separación con su
predicado de orfandad. Sólo `APPROVE` rederiva cut/contrato/autoridad/maker,
fórmulas y candidato completos. Así un reseal posterior a prepare no deja el
pending global wedged.

### `ProjectCertificateOperationReceipt`

Ledger común append-only de idempotencia para todos los comandos S10-CERT:
`PREPARE`, `APPROVE`, `REJECT` y `CANCEL`. Persiste organización, obra,
operation kind, hash de key, request fingerprint, actorMembershipId,
certificateVersionId, decisionId nullable, `bookRevisionAfter`,
`periodHeadRevisionAfter` y timestamp server-owned. Impone
`UNIQUE (organizationId, operationKeyHash)` **a través de todos los tipos de
operación**; uniques separados en Version y Decision no alcanzan para impedir
que una misma key se reuse entre prepare y decide.

`decisionId` es `null` si y sólo si `operationKind = PREPARE`; las otras tres
operaciones lo enlazan por FK composite a la decisión exacta. El lookup
replay-first consulta este ledger y reconstruye el receipt desde los facts; no
confía en una proyección cliente ni en buscar por separado dos tablas. Las
revisiones post-operación permiten que un replay tardío devuelva el mismo
recibo semántico aun cuando los heads ya hayan avanzado.

Todo el ledger, book y period heads son no-delete/no-truncate; hechos y
decisiones además son no-update. Triggers de write-scope `ENABLE ALWAYS`
protegen también cada `INSERT` de Version, Line, Deduction y Decision y sólo lo
aceptan dentro del worker gobernado con profundidad exacta; el mismo contrato
cubre `ProjectCertificateOperationReceipt`. No alcanza con
prohibir UPDATE/DELETE. Los heads aceptan cambios únicamente desde esos
comandos. DML directo, `session_replication_role=replica` y TRUNCATE fallan
cerrados y no pueden fabricar ni extender un snapshot.

La integridad tenant/obra no depende sólo de revalidación procedural. La
migración debe declarar tuples `UNIQUE` auxiliares y FKs composite exactas:

- `ProjectCertificateVersion` -> Book, PeriodHead y Cut por
  organización/obra/IDs. Su provenance contractual usa una única FK conjunta
  `(organizationId, projectId, contractHeadId, contractVersionId,
  authorityVersionId)` hacia un tuple `UNIQUE` de S9.3; no se permiten dos FKs
  separadas que puedan mezclar contrato y autoridad válidos pero no enlazados;
  `preparedByMembershipId` usa FK composite
  `(organizationId, preparedByMembershipId)` -> `TenantMembership`;
  sus tres cadenas
  `predecessorId`, `supersedesApprovedVersionId` y
  `previousApprovedCertificateVersionId` quedan scoped al book/período que
  corresponda;
- `ProjectCertificateLine` -> Version incluyendo `cutId` y
  `contractVersionId`; -> ProjectProgressMeasurementCutLine por
  organización/obra/**cutId**/task/línea; -> ProjectContractLine por
  organización/obra/**contractVersionId**/task/línea; y -> Task por
  organización/obra/task. Esos IDs redundantes están gobernados y atan cada
  línea al mismo par de snapshots de su versión padre;
- `ProjectCertificateDeduction` -> Version por organización/obra/version;
- `ProjectCertificateDecision` -> Version y Book/PeriodHead exactos, y actor ->
  TenantMembership por organización/membership;
- `ProjectCertificateOperationReceipt` -> Version y actor por scope exacto y,
  para decisiones, -> Decision por organización/obra/version/decision;
- Book y PeriodHead -> Organization/Project; todos sus current/latest/pending
  pointers vuelven al ledger con el mismo scope. El pin del Book usa una FK
  conjunta `(organizationId, projectId, pinnedContractHeadId,
  pinnedContractVersionId, pinnedAuthorityVersionId)` al mismo tuple S9.3.

No existe FK sólo por ID para una relación gobernada, salvo la composición
estructural explícita de Task: como `Task` no almacena `organizationId`, cada
línea declara simultáneamente `(organizationId, projectId) -> Project` y
`(projectId, taskId) -> Task`. Dado que `Project.id` es globalmente único,
ambas FKs juntas prueban exactamente tenant/obra/task sin introducir una
columna transversal redundante en Task. Las decisiones/guards SQL se suman a
estas FKs; no las sustituyen.

## Orden, correcciones y pinning

- Sólo puede existir una propuesta pendiente por obra, no una por período.
- El primer período aprobado puede capturar acumulado compatible con la
  vigencia contractual.
- Un período nuevo debe ser posterior a `latestApprovedPeriodStart`. La fase no
  permite insertar después una quincena histórica omitida.
- No se exige consecutividad porque S9.1 no interpreta ausencia de medición como
  avance cero. Si se saltean quincenas, el importe no se atribuye sólo al período
  target: `coverageFrom` es el día posterior al `periodEnd` del certificado
  cronológico anterior y `coverageThrough` es el `periodEnd` target. En el
  primer certificado, `coverageFrom` es el menor
  `technicalCumulativeOriginPeriodStart` de sus líneas `VALUED`. El DTO y ledger
  lo denominan siempre `certificateIncrement*`, nunca `period*`.
- Sólo se corrige la última quincena aprobada. Si existe un certificado posterior,
  la corrección queda bloqueada.
- Corregir crea una nueva versión full-snapshot; nunca reescribe hechos,
  decisiones, líneas o deducciones.
- Un rechazo o cancelación libera la propuesta global y conserva la versión
  aprobada vigente.
- Después del primer certificado aprobado, contrato y autoridad quedan fijados
  hasta S19 change control. S9.3 no puede proponer ni activar otra SOV o
  autoridad por una ruta lateral.
- Mientras existe una propuesta S10 pendiente, un guard cross-domain que toma
  `project-contract:scope` bloquea cualquier propuesta o decisión S9.3 de SOV o
  autoridad. Reject/cancel/approve libera ese fence o lo transforma en pin.

La transición de `Project` a `ARCHIVED` toma el mismo
`project-contract:scope` y un trigger `ENABLE ALWAYS` la rechaza si existe una
propuesta S10 pendiente o una propuesta S9.3 de contrato/autoridad pendiente.
El guard vive en PostgreSQL para cubrir API, scripts y DML lateral: no se puede
desactivar primero todas las `ProjectMembership` y dejar el pending sin actor
capaz de rechazar o cancelar.

Cambios de TenantMembership/ProjectMembership que puedan revocar actores
inspeccionan, mediante trigger con transition tables, **todos** los Book pending
afectados en orden de `projectId`, bloquean sus rows y evalúan el estado
post-cambio. Sólo rechazan la mutación si dejaría una propuesta sin ninguna
salida válida: certifier capaz de REJECT, o registrar/fallback capaz de CANCEL.
Esto evita write skew en updates bulk sin congelar una membresía que todavía
deja un closer autorizado.

El trigger `Task_project_contract_scope_guard` se reemplaza para observar
`type`, `metadata.source`, `code`, `title` y `revision`. Ante esos cambios toma
primero el advisory crudo `hashtextextended(projectId, 0)` y luego
`project-contract:scope`; no toma el advisory S9.1 después del row lock. La
entrada/salida del catálogo canónico sigue bloqueada por una SOV vigente; un
cambio sólo de snapshot se serializa y vuelve stale el cut hasta reseal, sin
congelar status, fechas, progreso, assignee, descripción ni metadata ajena a
`source`. El guard previo que pudiera necesitar el lock de task usa
`pg_try_advisory_xact_lock` y falla rápido, nunca espera con orden inverso.

Una corrección técnica S9.1/S9.2 nunca se bloquea ni se reescribe por existir un
certificado. Si cambia el cut de la última quincena certificada, el book deriva
`CORRECTION_REQUIRED` y bloquea el período siguiente hasta aprobar la nueva
versión del certificado. Si ya existe un certificado posterior, deriva
`HISTORICAL_RESTATEMENT_REQUIRED`: Fase 1 bloquea nuevos certificados y deriva
el caso a un flujo futuro de restatement/change control. La verdad técnica sigue
avanzando append-only; S10 no la congela para conservar una cifra financiera.

GET/readiness, prepare y approve no confían en un flag mutable eventual: bajo
los locks relevantes rederivan el candidato S9.2 vivo de cada período current
aprobado y comparan su hash/líneas, además de cada `cutId`/hash persistido,
contra el cut vigente de su period head. Sólo un mismatch o stale técnico en el
último período habilita la corrección Fase 1; cualquier mismatch o stale en un
período anterior deriva el blocker de restatement histórico, incluso si aún no
hubo reseal y `currentCutId` todavía apunta al cut anterior.

## Actores y permisos

Permisos nuevos:

- `org:certificates:read`;
- `org:certificates:prepare`;
- `org:certificates:certify`.

Matriz Fase 1:

- lectura: `ADMIN`, `DIRECTOR`, `SITE_MANAGER`, `FINANCE` y `AUDITOR`, siempre
  con TenantMembership y ProjectMembership activas en la obra exacta;
- propuesta: sólo `SITE_MANAGER` activo de la obra;
- decisión: sólo el `certifierMembershipId` `DIRECTOR` de la AuthorityVersion
  aprobada enlazada por el contrato exacto;
- cancelación no aprobatoria: registrar exacto sólo si el certifier no puede
  rechazar por status, rol o acceso de obra inválidos; fallback `ADMIN` activo
  de la obra sólo si también el registrar exacto es inválido;
- `ADMIN`, wildcard y superadmin no sustituyen a maker ni certifier en la capa
  de datos.

Maker y checker deben ser memberships distintas. Un `DIRECTOR` no prepara su
propio certificado y un `SITE_MANAGER` no lo aprueba. `APPROVE` revalida que el
maker siga activo y autorizado. El certifier puede `REJECT` una propuesta cuyo
maker fue desactivado para liberar el pending, pero nunca aprobarla.

La segregación posterior con la autoridad `FINANCE` pertenece a S10-FIN; no se
presenta como completada por S10-CERT.

## API privada

Superficie prevista:

```text
GET  /api/project-certificates?periodDate=YYYY-MM-DD
POST /api/project-certificates
POST /api/project-certificates/:certificateVersionId/decision
```

GET devuelve `no-store`: book, head del período, current/pending, historial
acotado, readiness, blockers, candidato server-owned y capabilities derivadas
en DB.

Un período ya aprobado cuyo cut y fuente técnica siguen idénticos devuelve
`readiness.state = UP_TO_DATE`, sin mode, blockers ni candidato y con prepare
denegado. No se presenta como `CORRECTION`: cambiar sólo deducciones no habilita
una nueva versión. Un POST directo en ese estado falla con
`PROJECT_CERTIFICATE_UNCHANGED` antes de escribir.

GET admite una única query `periodDate=YYYY-MM-DD`; parámetros desconocidos,
repetidos o fechas no canónicas fallan. POST de propuesta usa este body exacto:

```json
{
  "periodDate": "YYYY-MM-DD",
  "expectedBookRevision": 0,
  "expectedPeriodHeadRevision": 0,
  "expectedCurrentApprovedVersionId": null,
  "deductions": [
    { "code": "ANTICIPO", "reason": "Fundamento explícito", "amountMinor": "1" }
  ]
}
```

Las revisiones son integers PostgreSQL no negativos y el ID esperado es
nullable. `deductions` conserva orden/ordinal y reordenarla cambia el
fingerprint; admite máximo 50 códigos únicos con regex
`^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$`, razón trimmeada sin controles de 1..1000
caracteres y `amountMinor` string decimal canónico positivo dentro de signed
`BIGINT`. Prepare usa `Idempotency-Key` y no acepta cut/contrato/autoridad,
líneas, cantidades, hashes ni totales cliente.

POST de decisión toma el target sólo desde el path y usa este body exacto:

```json
{
  "expectedBookRevision": 1,
  "expectedPeriodHeadRevision": 1,
  "expectedCertificateDigest": "sha256-hex-exacto",
  "decision": "APPROVE",
  "reason": "Fundamento explícito"
}
```

`decision` admite exactamente `APPROVE|REJECT|CANCEL` y persiste
`APPROVED|REJECTED|CANCELLED`; razón sigue la misma regla textual 1..1000. Usa
`Idempotency-Key`. Campos extra o ausentes fallan antes de mutar.

La serialización usa allowlists exactas. IDs cross-tenant responden 404; permisos
insuficientes, 403; replay mutado o CAS/candidato stale, 409; contratos de
persistencia inválidos fallan cerrados sin filtrar SQL, PII ni hashes internos.

## Replay, locks y carreras

Cada lectura o mutación usa una única transacción secuencial
`ReadCommitted`; no se ejecuta `Promise.all` sobre el mismo cliente
transaccional. Ese aislamiento es deliberado: después de esperar advisory o
row locks, la sentencia siguiente debe observar el estado recién committed y
revalidarlo, sin conservar un snapshot anterior a la espera.

Orden canónico de locks:

1. advisory lock de operation key;
2. advisory crudo `hashtextextended(projectId, 0)`, idéntico a
   `lockProjectTransaction`;
3. `project-contract:scope:{org}:{project}`;
4. row locks de TenantMembership y ProjectMembership de los actores relevantes,
   en orden determinista y con modo que conflicte con UPDATE/DELETE;
5. locks S9.1 `{org}:{project}:{taskId}` de la unión de tareas canónicas del
   target y de todos los certificados current aprobados, en orden;
6. `progress-measurement-cut:scope:{org}:{project}:{periodStart}` de todos los
   períodos current aprobados más target, ordenados;
7. `project-certificate:scope:{org}:{project}`;
8. filas book, period head y ledgers.

No es necesario ni correcto hacer que S9.1/S9.2 dependan del ledger financiero.
S9.1 toma sólo sus task locks y S9.2 sólo su cut scope; ninguno espera luego un
lock contractual/certificate. S10 toma contract -> tasks -> cut -> certificate,
revalida todo y conserva los locks hasta commit. Por lo tanto no existe orden
inverso. S9.3 y los guards cross-domain comparten primero
`project-contract:scope`.

Después del operation lock y de verificar sesión, TenantMembership y
ProjectMembership **activas** para el tenant/obra exactos, el replay se resuelve
antes del rol mutable de la acción original, CAS, current pointers y candidato:

Cada fingerprint incluye como mínimo `operationKind`, organización, obra,
`actorMembershipId`, target/version ID, input normalizado y todos los CAS,
hashes, deducciones, decisión y razón aplicables. El receipt persiste el actor y
el replay exige `persistedActorMembershipId == callerMembershipId`; conocer una
key y payload ajenos no permite a otro miembro activo recuperar ese recibo. Las
keys de prepare, APPROVE, REJECT y CANCEL tampoco pueden colisionar entre tipos
de operación.

- misma key + mismo fingerprint devuelve el recibo histórico exacto, incluso
  después de aprobar, rechazar, rotar roles o avanzar el head;
- misma key + contenido distinto devuelve conflicto;
- una operación nueva revalida actores, heads, cut, contrato, políticas y hash
  dentro de la transacción.

Carreras mínimas del verificador disposable PostgreSQL 17:

- misma key exacta y misma key mutada;
- dos makers sobre el pending global;
- dos decisiones sobre la misma propuesta;
- aprobación contra corrección del cut;
- aprobación contra intento de rotación SOV/authority;
- corrección del último período contra propuesta del siguiente;
- revocación de maker/checker contra aprobación;
- archive de obra contra pending S10/S9.3;
- DML directo/replica/TRUNCATE contra cada ledger y proyección;
- cleanup exacto y restauración de todos los triggers.

Vercel ejecuta sólo journey rollback-only con carreras disposable desactivadas.
El verificador se llama exclusivamente
`verify:project-certificates-migration` y usa
`PROJECT_CERTIFICATES_MIGRATION_DATABASE_URL`,
`PROJECT_CERTIFICATES_MIGRATION_SCHEMA` y
`PROJECT_CERTIFICATES_DISPOSABLE_CONCURRENCY`; no reutiliza el verificador
legacy `verify:s10-migrations` de SupplierInvoice.

## Gates de aceptación de Fase 1

La fase backend sólo podrá declararse cerrada cuando exista evidencia exact-SHA
de:

1. migración Prisma/PostgreSQL 17, constraints/FKs/triggers y drift cero;
2. journey prepare -> approve -> siguiente período -> corrección, con recibos
   históricos inmutables;
3. casos `NO_CLAIM`, `MISSING`, basis mismatch, vigencia retroactiva, overflow,
   retención acumulada y deducciones;
4. races committed y cleanup exacto en CI disposable;
5. RBAC/cross-tenant y maker-checker autenticados;
6. Preview rollback-only, build y smokes públicos sin mutaciones privadas;
7. revisión final 0 P0/P1.

Ese cierre seguirá sin acreditar UI final, PDF, S10-FIN, S10-PAYREF, legalidad
del certificado, Production ni pago real.
