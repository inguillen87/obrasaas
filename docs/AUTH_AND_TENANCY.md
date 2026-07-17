# Autenticación y tenancy

## Estado operativo

- Aplicación Clerk exclusiva de ObraSaaS.
- Preview y el alias estable `https://obrasaas.vercel.app` usan la instancia dedicada **development**; no se habilitan claves de producción hasta contar con dominio propio.
- Google Sign-In y email verificado están habilitados.
- La membresía a una organización es obligatoria.
- Clerk crea la primera organización durante el alta y la deja activa en la sesión.
- Cada usuario nuevo puede crear como máximo **una** organización. Puede ser invitado a otras, pero no multiplicar trials propios.
- El backend crea bajo demanda el tenant y la membresía. Sólo los roles con alcance de portfolio pueden crear la obra inicial automáticamente.

## Superadmin y tenants

- `guillen.marce@gmail.com` es la única identidad de superadmin de plataforma; no se configura por entorno ni se puede reemplazar en un deploy.
- `OBRASAAS_INTERNAL_CLERK_ORG_ID` identifica explícitamente el workspace interno y evita contarlo como cliente.
- El script `npm run clerk:internal-org` nunca elige la primera membresía de Clerk: exige ese ID explícito o exactamente una organización ya marcada con `public_metadata.internal=true`.
- Si el ID no pertenece al superadmin, falta una organización interna inequívoca o hay más de una marcada, el script aborta sin modificar ninguna organización tenant.
- Todos los demás usuarios operan dentro del tenant activo de Clerk.
- Cada consulta y mutación sensible se vuelve a acotar por organización y proyecto en el backend.

## Roles

ObraSaaS mantiene los roles operativos en su propia base de datos:

- Administrador
- Director de obra
- Jefe de obra
- Administración
- Auditor

Clerk conserva la autoridad de pertenencia y el rol base `org:admin` / `org:member`. Los roles operativos de ObraSaaS no deben depender de un add-on pago de Clerk para funcionar.

## Acceso por obra

- Superadmin, Administrador y Director tienen alcance de portfolio completo dentro de su tenant.
- Jefe de obra, Administración y Auditor requieren una asignación `ProjectMembership` activa por cada obra.
- Un integrante nuevo empieza sin obras implícitas; un Administrador define su alcance desde **Equipo y permisos**.
- El selector, el portfolio, las mutaciones y los deep links aplican el mismo filtro en servidor. Una cookie antigua nunca concede acceso.
- Cambiar entre un rol de portfolio y uno restringido, desactivar o reactivar una membresía invalida asignaciones latentes.
- Archivar una obra desactiva sus asignaciones. Los cambios de rol, alcance y archivo quedan auditados.
- Las escrituras de alcance usan control de concurrencia: una pantalla desactualizada recibe `409 PROJECT_ACCESS_STALE` y no pisa cambios más nuevos.

## Invitaciones

- Sólo un Administrador del tenant o el superadmin puede invitar y revocar accesos.
- La invitación dura 7 días y siempre queda acotada a la organización activa.
- Clerk recibe únicamente `org:admin` o `org:member`.
- El rol operativo deseado viaja en metadata y se persiste en Neon desde el webhook de Clerk o, como recuperación, durante el primer acceso.
- Un `org:member` nunca puede elevarse a Administrador por metadata; ante una inconsistencia entra como Auditor.
- La creación y la revocación quedan registradas en `AuditLog`.
- El redirect del preview apunta explícitamente a `https://obrasaas-preview.vercel.app/dashboard`.

## Regla de costos

Las funciones marcadas como add-on son gratuitas para probar en la instancia de desarrollo. No deben habilitarse ni contratarse en producción sin aprobación explícita y un cliente que cubra ese costo.

En particular:

- no promover la instancia Clerk a producción sobre un dominio `*.vercel.app`;
- no comprar dominio desde este proyecto;
- no activar Unlimited organization memberships en producción;
- mantener los colaboradores de campo sin cuenta Clerk cuando operen exclusivamente por WhatsApp/webview;
- evaluar límites superiores sólo para clientes Enterprise y trasladar el costo al contrato.

## Flujo esperado

1. La persona inicia el alta en `/sign-up`.
2. Clerk verifica el email o Google y crea la primera organización.
3. El fallback seguro redirige a `/dashboard`.
4. `getPlatformAccess()` sincroniza usuario, organización y membresía. Un Administrador/Director obtiene el portfolio; un rol restringido entra sólo a sus obras asignadas.
5. El tenant comienza un trial de 14 días sin tarjeta.
6. Invitaciones posteriores respetan el redirect original de Clerk; el fallback no lo sobrescribe.
