# PRO-05A — solicitudes de derechos y descubrimiento seguro

## Estado

PRO-05A es una base con gate técnico verificado en Preview, **no destructiva y
bloqueada por diseño**. Permite
registrar una solicitud de privacidad para una persona trabajadora, acreditar
qué administrador del tenant inició el inventario, descubrir una parte acotada
del grafo de datos y sellar un manifiesto inmutable. No verifica la identidad
del solicitante, no decide la base legal de cada dato, no exporta información,
no corrige ni ofrece portabilidad, y no elimina, anonimiza ni restringe
registros.

La migración aditiva es
`20260729140000_data_subject_discovery_foundation`. Su contrato aplica junto con
las 108 migraciones anteriores desde una base PGlite descartable. El verificador
conductual prueba discovery read-only, tenant scope, hash UTC, blockers,
consistencia terminal y evidencia append-only. En el corte
[`edeea82`](./evidence/2026-08-10-preview-edeea82.md) también quedó verde en CI
PostgreSQL 17 y en Vercel/Neon Preview sobre el esquema completo de 119
migraciones. Eso acredita el gate técnico de discovery; no acredita identidad
del solicitante, decisión legal, ejecución de derechos, piloto real ni
Production.

## Frontera de la API

`POST /api/tenant/privacy/requests` acepta únicamente:

```json
{
  "personId": "identificador-canónico-del-worker-person",
  "requestType": "ACCESS"
}
```

Los tipos iniciales son `ACCESS`, `CORRECTION`, `ERASURE`, `RESTRICTION`,
`PORTABILITY` y `OBJECTION`. La llamada requiere:

- sesión autenticada y organización activa;
- membresía tenant `ADMIN` activa tanto en la autorización web como dentro de
  la transacción autoritativa;
- `Idempotency-Key` de 8 a 128 caracteres;
- cuerpo JSON exacto de hasta 8 KiB, sin query string;
- clave HMAC exclusiva de discovery configurada en el servidor.

Un superadministrador de plataforma no sustituye por sí solo una membresía
administradora activa del tenant. La ruta tampoco resuelve ni crea una obra por
defecto: el caso pertenece a la organización y no a un proyecto.

El límite durable es de 20 casos nuevos por administrador y 100 por
organización en una hora. Un replay exacto no consume cupo y devuelve
`Idempotency-Replayed: true`. El resultado usa `private, no-store`, propaga un
único `x-request-id` y nunca devuelve localizadores internos, HMAC, valores
financieros, teléfonos, ciphertext, tokens o URLs firmadas.

## Máquina de estados actual

```text
RECEIVED
  -> AUTHORITY_ATTESTED
  -> DISCOVERING
  -> DISCOVERY_BLOCKED | DISCOVERY_FAILED
```

`AUTHORITY_ATTESTED` significa sólo que un administrador autenticado asumió la
autoridad para iniciar un inventario interno. No significa que la persona
titular haya sido identificada ni que un representante haya demostrado su
mandato. Por eso la respuesta pública declara explícitamente
`requesterIdentityVerified: false`.

El catálogo v1 no puede llegar a `DISCOVERED`: PostgreSQL sólo permite sellar
`BLOCKED` y exige el conjunto conocido de blockers. Así, agregar un hash
autoconsistente pero omitir un sistema nunca puede producir un falso
“completo”.

## Descubrimiento v1

El inventario corre en una transacción `REPEATABLE READ READ ONLY`, usa el reloj
de PostgreSQL y consulta familias tipadas con un límite de 100 registros por
familia. El manifiesto admite como máximo 1.024 ítems. Hoy consulta:

- persona e identidades de canal;
- vínculos de obra y claims de onboarding;
- elecciones de privacidad y decisiones sensibles;
- destinos y sesiones de cobro;
- constancias privadas de recepción.

Cada registro queda como `REVIEW_REQUIRED` y
`LEGAL_CLASSIFICATION_REQUIRED`. El catálogo v1 agrega blockers obligatorios
para relaciones operativas incompletas, conversaciones, media/storage,
derivados de IA y proveedores, JSON/auditoría no tipados y
backup/restore/tombstones. Los vínculos `Worker` y los claims de onboarding
también permanecen parciales.

Los ítems contienen compromisos HMAC de localización y versión, no el
identificador fuente. El manifiesto fija tenant, caso, catálogo, snapshot,
orden, conteos, fingerprint del request y hash de idempotencia. El hash
canónico normaliza todas las fechas a UTC.

## Invariantes de PostgreSQL

- claves foráneas compuestas fijan organización, sujeto, actor, caso e ítems;
- los actores deben ser membresías `ADMIN` activas del mismo tenant;
- el catálogo v1 y su SHA están fijados por constraint;
- los ordinales son contiguos y todos los ítems comparten el snapshot;
- el sellado valida conteos, blockers y SHA canónico antes del estado terminal;
- requests, manifiestos e ítems son append-only y no admiten `DELETE` ni
  `TRUNCATE`;
- los triggers críticos están `ENABLE ALWAYS` y las funciones fijan un
  `search_path` seguro;
- la relación terminal se valida de forma diferida para permitir insertar
  hijos antes de sellar el request dentro de una sola transacción.

La evidencia append-only también crea una obligación de diseño: antes de una
eliminación real hay que definir retención y seudonimización de este ledger para
que sus FKs crudas no bloqueen indefinidamente un derecho válido.

## Configuración

```dotenv
PRIVACY_DISCOVERY_FINGERPRINT_KEY_ID=privacy-discovery-hmac-v1
PRIVACY_DISCOVERY_FINGERPRINT_SECRET=
```

El secreto debe ser un valor base64url canónico de 32 a 64 bytes, generado para
esta finalidad y fuera del repositorio. No se reutilizan claves de WhatsApp,
OpenAI, cifrado de destinos, sesiones ni otros tenants. Rotar esta clave no
cambia la identidad durable de una operación idempotente.

## Qué falta para un piloto con personas reales

PRO-05 permanece abierto hasta completar:

1. **PRO-05B — decisión:** verificación proporcional de identidad o
   representación, jurisdicción, plazo aplicable, matriz de retención, base por
   ítem, holds acotados y revisión humana.
2. **PRO-05C — ejecución:** adapters idempotentes por dominio para acceso,
   corrección, restricción, portabilidad, anonimización o eliminación, sin
   eludir los ledgers protegidos.
3. **PRO-05D — terceros y restore:** recibos verificables de storage, Meta e IA,
   inventario de backups, tombstones y un simulacro de restauración que los
   reaplique antes de reabrir los datos.
4. Identificar y publicar la entidad legal responsable, domicilio, rol
   responsable/encargado por flujo y un contacto de privacidad operativo
   verificado; la implementación no inventa esos datos.
5. Recorrer el endpoint PRO-05A con un ADMIN sintético autorizado, incluyendo
   negativos por rol y cross-tenant. La migración y su verificador ya pasaron en
   PostgreSQL 17 y Neon Preview, pero ese gate no sustituye el E2E funcional ni
   autoriza información laboral real.

La arquitectura y alternativas evaluadas están en
[la propuesta de hardening](./security-hardening/pro-05/hardening.md). Ningún
TTL de enlace, purge aislado o `store: false` de un proveedor reemplaza estas
fases.

El smoke local se ejecuta sólo contra una conexión y schema dedicados:

```powershell
$env:DATA_SUBJECT_DISCOVERY_MIGRATION_DATABASE_URL = '<postgres-dedicado>'
$env:DATA_SUBJECT_DISCOVERY_MIGRATION_SCHEMA = 'public'
npm.cmd run verify:data-subject-discovery-migration
```

El verificador ignora `DATABASE_URL` deliberadamente y exige
`sslmode=verify-full` para un host remoto.
