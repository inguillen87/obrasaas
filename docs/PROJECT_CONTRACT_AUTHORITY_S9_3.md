# S9.3-CONTRACT · Autoridad contractual y SOV versionada

## Estado y límite

Este documento congela el contrato de dominio que debe implementarse antes de
S10. No afirma que existan todavía modelos, migración, permisos, API, UI,
verificador, E2E, Preview o Production para S9.3.

S9.3 crea una base contractual o **Schedule of Values (SOV)** por organización
y obra. Esa base fija qué tarea se valúa o queda explícitamente fuera de
reclamo, con qué unidad, cantidad contractual, importe, moneda, retención, regla
de redondeo futura, vigencia y autoridades. Aprobarla sólo la vuelve elegible
como input de S10: no crea un certificado, una conformidad financiera, un PDF
ni una referencia o estado de pago.

Los siguientes dominios no son intercambiables:

- `BudgetVersion`/`BudgetLine` son presupuesto y forecast internos. Pueden ser
  procedencia de análisis, pero no son SOV ni autoridad contractual.
- `SupplierInvoice` y la superficie histórica de cuentas por pagar son AP de
  proveedores. Sus estados, incluido `PAID`, no se pueden reutilizar para
  certificados de avance, conformidad financiera o pagos del contrato.
- S9.1 mide avance técnico y S9.2-MED sella su composición. Ninguno aporta
  precio, retención, autoridad económica ni aceptación contractual.
- S9.3 aporta la base contractual. S10 debe crear tres registros append-only
  separados: certificado, conformidad financiera y referencia externa de
  pago.

Quedan fuera de S9.3 impuestos, factura fiscal, anticipo, actualización por
índice, conversión de moneda, firma, PDF, contabilización, conciliación bancaria
y ejecución o confirmación de pagos.

## Autoridades de datos objetivo

La implementación debe usar autoridades propias, tenant-scoped y separadas:

- `ProjectContractHead`: una proyección CAS por organización y obra, con la
  versión vigente y, cuando corresponda, una candidata pendiente.
- `ProjectContractAuthorityVersion`: snapshot inmutable de las tres membresías
  designadas para la cadena posterior de S10.
- `ProjectContractAuthorityDecision`: decisión append-only que aprueba o
  rechaza esa designación mediante maker-checker.
- `ProjectContractVersion`: snapshot completo append-only de términos,
  vigencia, predecesora, autoridades, totales y digest.
- `ProjectContractLine`: línea SOV inmutable que enlaza de forma explícita una
  tarea canónica como `VALUED` o `NO_CLAIM`.
- `ProjectContractDecision`: decisión append-only de aprobación o rechazo de
  una versión por una membresía distinta de quien la preparó.

Los nombres fijan ownership, no acreditan implementación. Una futura migración
debe demostrar claves compuestas de organización/obra, relaciones coherentes y
una única versión vigente; no alcanza con validaciones de aplicación.

## SOV, tarea, unidad y base

Cada línea SOV v1 debe cumplir todos estos invariantes:

- pertenece a la misma organización, obra y versión contractual;
- enlaza exactamente una `Task` canónica de tipo `TASK`; la versión enumera
  todas las tareas canónicas y cada tarea aparece exactamente una vez;
- conserva el código y título snapshot de la tarea; ni texto libre ni posición
  visual sustituyen el `taskId`;
- `VALUED` define unidad y cantidad base contractuales propias, Decimal exactas,
  positivas y serializadas como strings canónicos, más un
  `contractAmountMinor` entero positivo;
- `NO_CLAIM` exige fundamento y conserva unidad, base e importe como `null`;
  nunca significa cantidad o dinero cero;
- el servidor/base de datos obtiene el total exclusivamente de las líneas
  `VALUED`; el cliente no envía ni corrige el total.

La SOV no nace de una medición aprobada. Al activarla, toda unidad/base S9.1 que
ya exista en el `TaskProgressMeasurementBalance` estable de la tarea debe
coincidir exactamente con la línea `VALUED`. Sólo se compara y congela
`unitCode + baseQuantity`: ni revisión ni acumulado forman parte del contrato.
La línea registra ese snapshot como `MATCHED`; si el balance aún no existe,
registra `UNESTABLISHED` y el contrato puede avanzar. S9.1 permanece
independiente y no recibe triggers ni mutaciones desde S9.3. S10 debe volver a
cruzar unidad/base; una diferencia posterior se deriva como `MISMATCHED` y
bloquea la certificación. Esto reconcilia dos autoridades sin volver a una
revisión de `TaskProgressMeasurement` la fuente del contrato.

Para evitar un snapshot partido mientras S9.1 aprueba en paralelo, S9.3 debe
adquirir los mismos advisory locks organización → obra → tareas, con tareas en
orden determinista, antes de leer balances y formar el candidato. Compartir el
lock no concede a S9.3 autoridad para escribir o bloquear funcionalmente S9.1.

La unidad o base de una versión aprobada no se edita. Una corrección o un cambio
contractual crea una versión completa siguiente y enlaza su predecesora; nunca
reescribe líneas consumidas por un certificado. Trabajo extra, una nueva tarea
o una base/importe diferente después de la vigencia requieren el change control
explícito de S19 antes de entrar en una SOV posterior.

## Dinero, retención y redondeo

Cada versión fija una única `currencyCode`, su `currencyMinorUnits`, un
`retentionBps` y `roundingPolicyVersion`:

- `currencyCode` es un código ISO 4217 permitido, en mayúsculas; no se infiere
  del tenant, del navegador, de `BudgetVersion` ni de una factura;
- `currencyMinorUnits` queda persistido mediante allowlist junto con la moneda;
  cambiarlo exige otra versión y nunca reinterpreta importes históricos;
- importes y total viajan por JSON como strings enteros canónicos en minor units
  y se persisten como `BIGINT`; JavaScript `Number`, floats, exponentes, comas y
  redondeo del cliente están prohibidos;
- `retentionBps` es un entero entre 0 y 10 000. Es un término porcentual, no un
  importe retenido, una deducción, una factura ni un pago;
- `roundingPolicyVersion` queda fijada como `CERT_RETENTION_HALF_UP_V1`: S10
  deberá calcular la retención sobre el importe certificado exacto y redondear
  a minor units, con empate alejándose de cero;
- `totalContractAmountMinor` es sólo la suma exacta de `contractAmountMinor` de
  líneas `VALUED`; es server-owned y no aplica retención ni calcula un neto;
- la política de ajuste v1 queda explícitamente en `NONE`;
- no hay precio unitario, cálculo cantidad × precio, conversión FX ni mezcla de
  monedas dentro de este primer contrato SOV.

S10 debe aplicar esa versión de redondeo de forma reproducible a las cantidades
certificables. En su primer alcance, cualquier ajuste monetario adicional se
limita a una **deducción explícita de monto positivo**, con código y fundamento;
no se aceptan montos negativos, adiciones implícitas, porcentajes mágicos ni un
motor de impuestos. La retención se calcula por separado con `retentionBps`.
S9.3 no persiste deducciones, adiciones, variaciones ni change orders.

## Autoridades, permisos y maker-checker

`ProjectContractAuthorityVersion` fija tres `TenantMembership` activas de la
misma organización. Cada una debe conservar además un `ProjectMembership`
`ACTIVE` para la obra exacta:

1. certificador contractual, con rol `DIRECTOR`;
2. conformador financiero, con rol `FINANCE`;
3. registrador de referencia externa, con rol `ADMIN`.

Las tres membresías son obligatorias y distintas entre sí. En bootstrap,
rotación, preparación, aprobación y futura referencia de pago se revalidan
dentro de la transacción tanto `TenantMembership` como el `ProjectMembership`
de la obra exacta. Revocación, cambio de rol, tenant/obra incorrectos o fin de
vigencia fallan cerrado. Un superadministrador sin ambas membresías activas no
sustituye ninguna autoridad.

La designación también tiene maker-checker propio. En el bootstrap, una
membresía `ADMIN` propone `ProjectContractAuthorityVersion` y una membresía
`DIRECTOR` distinta la aprueba mediante `ProjectContractAuthorityDecision`. Una
rotación posterior sólo puede ser preparada por el registrador `ADMIN` vigente
y aprobada por el certificador `DIRECTOR` vigente. La rotación queda bloqueada
mientras exista una versión contractual pendiente.

Cada contrato enlaza el ID exacto de una AuthorityVersion aprobada. Sólo su
certificador `DIRECTOR` designado puede preparar la versión contractual y sólo
su conformador `FINANCE` designado puede aprobarla; preparador y aprobador son
membership IDs distintos. El registrador `ADMIN` queda reservado para la futura
referencia externa de pago y no prepara contratos.

El permiso objetivo se separa por acción:

- contratos: `org:contracts:read`, `org:contracts:prepare`,
  `org:contracts:authorities:manage` y `org:contracts:approve`;
- S10: `org:certificates:read`, `org:certificates:certify`,
  `org:certificates:financial-conform` y
  `org:certificates:payment-reference`.

Cada decisión se toma con CAS sobre el head observado, idempotencia y
revalidación de membresía/rol dentro de la misma transacción. Un replay exacto
puede devolver el recibo original; la misma clave con otro comando falla. Una
respuesta ambigua se concilia antes de intentar otra mutación. Los permisos son
un contrato futuro de least privilege, no una afirmación de RBAC implementado.

## Vigencia, versión y digest

Una versión aprobada tiene un `effectiveFrom` civil explícito. La cadena y el
head determinan cuál está vigente; el cliente no puede promoverla enviando un
estado. Una nueva versión no recalcula ni invalida artefactos históricos que
apuntan a la versión anterior.

El digest SHA-256 se deriva de una serialización canónica que incluye, como
mínimo, organización, obra, versión, predecesora, vigencia, moneda/escala,
retención, política de redondeo, autoridades y todas las líneas ordenadas con su
task, estado, unidad, base, importe o fundamento. Total, hashes, versión y
timestamps son server-owned.

## Entrada exacta a S10

Un certificado futuro sólo puede consumir el par inmutable:

```text
ProjectProgressMeasurementCut exacto (S9.2-MED)
+ ProjectContractVersion aprobada y vigente (S9.3-CONTRACT)
```

La obra, organización, tareas, período y unidades deben reconciliar. Una línea
contractual `NO_CLAIM` se materializa así en el certificado, con cantidad e
importe `null` y fundamento; nunca se omite ni se transforma en cero. Una línea
S9.2 `MISSING` frente a una SOV `VALUED` bloquea el cálculo; S10 sólo puede
continuar si materializa un `NO_CLAIM` explícito con cantidad/importe `null` y
causa `TECHNICAL_MEASUREMENT_MISSING`. En ninguno de los casos la ausencia
significa “avance cero”, “monto cero” o aceptación tácita.

S10 queda dividido en tres autoridades y artefactos distintos:

1. **S10-CERT · Certificado contractual:** snapshot versionado que consume IDs
   exactos de cut y contrato, calcula importes y registra la decisión del
   certificador.
2. **S10-FIN · Conformidad financiera:** decisión append-only posterior,
   emitida por la membresía financiera designada; no modifica el certificado.
3. **S10-PAYREF · Referencia externa de pago:** registro append-only posterior
   de un identificador observado fuera de ObraSaaS, emitido por la tercera
   autoridad. No ejecuta, verifica, concilia ni prueba un pago.

Los tres actores son distintos. Corregir cualquiera de los dos primeros
artefactos crea una versión nueva; no se edita historia. El PDF contractual será
un artefacto privado, determinista y hasheado separado, y no forma parte de la
fundación S9.3.

No se admite un estado `PAID` en esta cadena. Tampoco se deriva pago desde una
referencia, una conformidad, una factura, un webhook ambiguo o la mera emisión
del certificado.

## Gates antes de cerrar S9.3

S9.3 permanece abierto hasta que existan y pasen, sobre el mismo SHA:

- esquema, migración, backfill/rollback documentado y verificador PostgreSQL;
- guards de inmutabilidad, tenant/obra, head CAS, vigencia y digest;
- allowlist moneda/escala, overflow, Decimal/minor units y vectores de redondeo;
- cobertura completa de tareas `VALUED`/`NO_CLAIM`, total derivado y rechazo de
  unidad/base incompatible con S9.1;
- maker-checker, autoridades distintas, membresía revocada y superadmin sin
  membresía;
- replay exacto/mutado y carreras de preparación/aprobación;
- pruebas negativas contra `BudgetVersion`, `BudgetLine`, `SupplierInvoice`,
  `Task.progress`, certificado, PDF, conformidad y cualquier estado de pago;
- API/UI privada, accesible y no cacheable, con conciliación de estado incierto;
- suite, lint, audit, build, PostgreSQL sin drift, CI autenticado y Preview
  exact-SHA. Production requiere un gate posterior y explícito.

Hasta entonces, este artefacto es el contrato de diseño de S9.3 y no una
declaración de entrega funcional, legal, contable o fiscal.
