# Autenticación y tenancy

## Estado operativo

- Aplicación Clerk exclusiva de ObraSaaS.
- El preview usa la instancia **development**; no se habilitan claves de producción hasta contar con dominio propio.
- Google Sign-In y email verificado están habilitados.
- La membresía a una organización es obligatoria.
- Clerk crea la primera organización durante el alta y la deja activa en la sesión.
- Cada usuario nuevo puede crear como máximo **una** organización. Puede ser invitado a otras, pero no multiplicar trials propios.
- El backend crea bajo demanda el tenant, la membresía y la primera obra en Neon.

## Superadmin y tenants

- `OBRASAAS_SUPERADMIN_EMAIL` identifica al único superadmin de plataforma.
- `OBRASAAS_INTERNAL_CLERK_ORG_ID` identifica el workspace interno y evita contarlo como cliente.
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

## Invitaciones

- Sólo un Administrador del tenant o el superadmin puede invitar y revocar accesos.
- La invitación dura 7 días y siempre queda acotada a la organización activa.
- Clerk recibe únicamente `org:admin` o `org:member`.
- El rol operativo deseado viaja en metadata y se persiste en Neon durante el primer acceso.
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
4. `getPlatformAccess()` sincroniza usuario, organización, membresía y obra inicial.
5. El tenant comienza un trial de 14 días sin tarjeta.
6. Invitaciones posteriores respetan el redirect original de Clerk; el fallback no lo sobrescribe.
