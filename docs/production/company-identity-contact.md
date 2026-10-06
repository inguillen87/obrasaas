# Identidad canónica y contacto opcional

El identificador Clerk firmado identifica al actor. El correo verificado demuestra el contacto actual de esa cuenta, pero no autoriza apropiarse de un actor, sus roles o sus empresas previas. Dos principals de instancias distintas pueden tener el mismo contacto sin ser la misma identidad canónica.

## Comportamiento del alta

`company-onboarding-store.mjs` busca primero el actor por clerkUserId. Conserva cualquier actor encontrado y su perfil. Si no existe y su correo firmado está ocupado por otro subject, crea un actor nuevo TENANT_USER con primaryEmail NULL. El registro histórico, su correo, SystemRole, memberships y auditoría permanecen intactos. El actor nuevo obtiene únicamente el ADMIN de la organización nueva que administra en la sesión firmada y la pertenencia a su primera obra.

La prueba de perfil sigue siendo obligatoria: firma Production, audiencia/purpose exclusivos, correo verificado booleano, mismo subject de la sesión, expiración y ausencia de impersonación. Un correo del formulario no sustituye esa prueba. La auditoría registra el origen de identidad, que el correo fue verificado, si se almacenó y un digest de la observación; no guarda el JWT ni expone el correo omitido en el recibo HTTP. Ese digest es trazabilidad, no un mecanismo de autorización.

Si el esquema sigue exigiendo un contacto no NULL, el intento se revierte y conserva el conflicto de identidad. El build y el onboarding no ejecutan migraciones.

## Adopción explícita del contrato

La herramienta `scripts/adopt-company-contact-schema.mjs` exige proyecto/equipo/origen Production exactos y TLS del contrato canónico. Su modo por defecto es DRY_RUN y abre una transacción READ ONLY que inspecciona catálogo y cuenta agregadamente actores/superadministradores, sin devolver registros nominales ni tomar locks exclusivos. Más de un SUPERADMIN aborta la adopción sin deduplicar, reasignar o actualizar filas. El total de actores permite revisar el tamaño de la tabla antes del índice y la validación del CHECK.

El manifiesto muestra el SQL exacto, la huella del catálogo, las invariantes preservadas y la reversión. Cada índice incluye sus flags pg_index en la huella; los UNIQUE de contacto/Clerk y el parcial de SUPERADMIN deben ser indisunique, indisvalid e indisready. Una definición UNIQUE presente pero inválida o no lista se rechaza. No imprime el correo protegido dentro del CHECK, credenciales ni IDs de usuarios. Guarda una copia privada dentro de `.vercel/private/company-contact-migration/`.

APPLY exige `--apply` y `--expected-fingerprint` del preflight revisado. Antes de ejecutar DDL adquiere un lock limitado y verifica otra vez el contrato y los counts agregados. En una única transacción conserva el índice UNIQUE de contacto, el UNIQUE de Clerk y el CHECK histórico correo reservado ↔ SUPERADMIN; añade un CHECK que prohíbe SUPERADMIN con contacto NULL, un UNIQUE parcial de systemRole WHERE SUPERADMIN y luego permite NULL en primaryEmail. Sólo ese cambio de columna, ese guard y ese índice son nuevos. No actualiza valores, sujetos, roles, grants o memberships.

DROP NOT NULL solo sería inseguro: PostgreSQL permite CHECK UNKNOWN y el UNIQUE permite varios NULL. Además, el CHECK histórico normaliza el correo mientras su UNIQUE compara texto crudo; sin el índice por rol serían posibles variantes de mayúsculas o espacios. El guard y el índice adicionales mantienen un único superadministrador con contacto obligatorio y protegido. Las pruebas reales de PostgreSQL rechazan SUPERADMIN NULL y segundos SUPERADMIN con contacto igual, en mayúsculas o con espacios, conservando ambas restricciones originales.

La reversión se ejecuta en una transacción: SET NOT NULL, eliminación sólo del nuevo guard y, al final, del nuevo índice parcial. Requiere que no exista ningún actor con contacto NULL. Después de un alta legítima con contacto omitido, el rollback del esquema queda bloqueado hasta una decisión deliberada sobre esos contactos. No se borran actores, no se inventan correos y no se reasignan identidades para forzar la reversión. Un rollback de aplicación conserva las empresas y permisos canónicos existentes.

## Dependencias y validación

Las consultas de autorización canónica siguen resolviendo por clerkUserId y membership vigente. En las fuentes actuales, primaryEmail se usa en el alta de empresas, el store de participantes y su proveedor. No se usa como llave de autoridad en CRM o facturación.

Los listados de participantes muestran un nombre neutral cuando no hay contacto. ASSIGN_EXISTING exige el subject exacto, pertenencia vigente y correo verificado actual en Clerk; compara el contacto almacenado cuando existe y revalida su valor al tomar el lock. Una cuenta sin contacto no permite saltar un fallo del proveedor o una revocación. Las invitaciones mantienen la coincidencia exacta con el correo verificado de la invitación y la aceptación oficial; un actor canónico existente se conserva por su subject sin adoptar otro actor que comparta correo. Un usuario sin actor previo sigue sujeto al bloqueo de colisión de invitaciones.

`verify-company-onboarding-postgres.mjs` usa PostgreSQL desechable con enum SUPERADMIN y CHECK equivalentes al catálogo Production. Comprueba preflight, huella, adopción idempotente, histórico SUPERADMIN/2 memberships/auditoría intactos, nuevo TENANT_USER con contacto NULL, aislamiento, plan vacío, carrera/replay, rollback y prueba de perfil obligatoria. `verify-participants-postgres.mjs` comprueba contacto NULL, fallo del proveedor y cambio de contacto durante preflight. Los JWT se prueban con claves sintéticas y verificadores reales; ninguna de estas pruebas equivale al alta humana de Production.

Estado de esta entrega: herramienta y comportamiento implementados; adopción del esquema y alta humana de Production pendientes de revisión y ejecución explícitas.
