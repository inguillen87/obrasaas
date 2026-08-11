# PRO-05B.1 — plano de control de decisiones del titular

## Estado verificable

PRO-05B.1 está implementado y técnicamente verificado en CI, PostgreSQL 17 y
Vercel/Neon Preview para el commit
`871cf2fa940084ad791b7febce494cf57be2e2d6`. La
[evidencia reproducible](./evidence/2026-08-11-preview-871cf2f.md) fija CI,
deployment, migraciones, smokes y límites.

Es un plano de **revisión no ejecutable**. Registra evidencia mínima, estados,
holds y decisiones candidatas cuya aprobación queda `SEALED_BLOCKED`; no
ejecuta un DSAR ni constituye un dictamen legal. Toda respuesta conserva
`executionAllowed: false`.

## Autoridad y aislamiento

- requiere sesión, organización activa, permiso
  `org:privacy:requests:manage` y una membresía tenant `ADMIN` activa en la base;
- un `SUPERADMIN` de plataforma sólo entra si además cumple esa membresía DB;
- no resuelve ni exige una obra: el control pertenece al tenant y la consola
  declara `Sin contexto de obra`;
- un recurso de otro tenant es indistinguible de ausente;
- la navegación a `/dashboard/privacy` es un anchor nativo visible sólo a quien
  tiene autoridad; `AUDITOR` no lo recibe;
- no usa analytics, `localStorage` ni `sessionStorage` en esta superficie.

La página reautoriza en servidor antes de renderizar. El proxy elimina cualquier
header sensible enviado por el cliente y sólo marca internamente el path exacto
`/dashboard/privacy`.

## Ledger de revisión

La migración aditiva es
`20260811160000_data_subject_decision_control_plane`. Agrega entidades
tenant-scoped y append-only para:

1. eventos de verificación, representación o revocación del solicitante;
2. revisiones de jurisdicción, fecha límite y versiones de política/matriz;
3. holds por ítem o categoría y sus eventos de revisión/liberación;
4. conjuntos de decisión versionados y decisiones por ítem;
5. maker-checker con administradores distintos, CAS y replay exacto.

El manifiesto de prueba conserva 9 ítems pendientes de revisión, de los cuales
8 son brechas de cobertura. Sólo un ítem `COVERAGE_BLOCKER` puede quedar con
acción `UNRESOLVED`; `blockerCount` no se presenta como cobertura completa.

El ledger no persiste cuerpos, documentos, email, teléfono, CUIL, CBU/CVU,
alias, dirección ni localizadores crudos. Los DTO de la consola no devuelven
hashes, fingerprints, secretos ni PII.

## Operaciones y ambigüedad

Las mutaciones requieren `Idempotency-Key` de 8 a 128 caracteres y payload
estricto. El operador debe ingresar de forma explícita los métodos, versiones,
fechas, bases y políticas; la UI no los prellena desde IA, fotos, WhatsApp ni
datos históricos.

La consola:

- usa un reducer central y bloquea selección, refresh y paginación durante una
  operación en curso o incierta;
- no aplica resultados optimistas ni reintenta automáticamente un POST;
- conserva la misma operación y la misma clave sólo en memoria si el resultado
  es ambiguo;
- ante timeout, 503, JSON/DTO inválido después de 2xx o conciliación fallida,
  habilita únicamente un GET de conciliación;
- descarta respuestas obsoletas mediante `AbortController` y secuencia.

Un banner permanente declara que esta fase no ejecuta acciones sobre datos.

## Evidencia Preview y límite del smoke

El deployment inmutable
`https://obrasaas-saas-phmytfe45-marcelos-projects-c26aa499.vercel.app` quedó
`Ready` con 121 migraciones sin pendientes, PRO-05A/B.1 verdes y build 88/88.

El smoke autenticado fue sólo lectura:

- `ADMIN` abrió la consola y encontró la cola vacía;
- `AUDITOR` recibió el boundary restringido y no vio navegación;
- sin sesión, `/dashboard/privacy` devolvió 404;
- no hubo POST ni mutación.

Por lo tanto, el corte acredita acceso, aislamiento y estado vacío, pero no un
expediente poblado, la secuencia maker-checker completa ni negativos
cross-tenant. En los 30 minutos posteriores hubo cero eventos
`error`/`fatal` y cero HTTP `5xx` para ese deployment exacto; no es una
afirmación global de observabilidad.

## Qué sigue abierto

- aprobar entidad legal responsable, domicilio, contacto operativo y matriz de
  retención por profesionales autorizados;
- recorrer con datos sintéticos verificación, revisión legal, holds, decisión y
  maker-checker, incluidos conflictos y cross-tenant;
- implementar PRO-05C: adapters idempotentes por dominio para acceso,
  corrección, restricción, portabilidad, anonimización o eliminación;
- implementar PRO-05D: propagación a storage/Meta/IA, recibos de proveedores,
  backups, tombstones y restore drill;
- definir retención y seudonimización del propio ledger de privacidad.

No se movió ni certificó un alias estable y no hubo deploy ni smoke de
Production. Trabajadores reales, piloto de obra real, DSAR ejecutable y
Production continúan en **NO-GO**.
