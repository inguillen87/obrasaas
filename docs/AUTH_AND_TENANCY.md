# Autenticación y tenancy

## Estado operativo

- Aplicación Clerk exclusiva de ObraSaaS.
- Preview y el alias estable `https://obrasaas.vercel.app` usan la instancia dedicada **development**; no se habilitan claves de producción hasta contar con dominio propio.
- Google Sign-In y email verificado están habilitados.
- La membresía a una organización es obligatoria.
- Clerk crea la primera organización durante el alta y la deja activa en la sesión.
- Cada usuario nuevo puede crear como máximo **una** organización. Puede ser invitado a otras, pero no multiplicar trials propios.
- El backend crea bajo demanda el tenant y la membresía. Sólo los roles con alcance de portfolio pueden crear la obra inicial automáticamente.
- El webhook Clerk de producción pública verifica la firma y exige que el `instance_id` firmado coincida exactamente con `CLERK_EXPECTED_INSTANCE_ID` antes de tocar Neon; acepta únicamente eventos de identidad/organización/membresía y conserva un registro idempotente de procesamiento.
- El payload firmado se conserva sólo mientras el evento necesita procesamiento o reintento. Al completarlo se redacta y quedan únicamente la identidad técnica del evento, su tipo, estado, intentos, timestamps y una huella HMAC-SHA256 v1 de los bytes verificados, ligada a key ID/instancia/ID/tipo bajo el dominio `obrasaas:clerk-webhook:verified-body:v1`; no se duplican PII ni secretos.
- `CLERK_WEBHOOK_EVIDENCE_SECRET` es independiente de `CLERK_WEBHOOK_SIGNING_SECRET` y exige al menos 32 caracteres. `CLERK_WEBHOOK_EVIDENCE_KEY_ID` usa la forma versionada `clerk-webhook-evidence-vN`; cada rotación incrementa ese ID y conserva el par histórico exclusivamente en el keyring del gestor de secretos durante la retención forense aprobada, no en el runtime ni en Neon.

## Superadmin y tenants

- La identidad canónica registrada de plataforma es la única autorizada como superadmin; su dirección no se publica en esta documentación, no se configura por entorno y no puede reemplazarse en un deploy.
- `OBRASAAS_INTERNAL_CLERK_ORG_ID` identifica explícitamente el workspace interno y evita contarlo como cliente.
- El script `npm run clerk:internal-org` nunca elige la primera membresía de Clerk: exige ese ID explícito o exactamente una organización ya marcada con `public_metadata.internal=true`.
- Si el ID no pertenece al superadmin, falta una organización interna inequívoca o hay más de una marcada, el script aborta sin modificar ninguna organización tenant.
- Todos los demás usuarios operan dentro del tenant activo de Clerk.
- Cada consulta y mutación sensible se vuelve a acotar por organización y proyecto en el backend.

## Sincronización y corte a Clerk Production

- Usuario y organización se sincronizan por su ID Clerk actual. Un email verificado o una metadata privada coincidente **no** autorizan por sí solos a reemplazar ese ID en runtime.
- Cada acceso tenant y cada webhook de membresía verifican la membresía vigente en Clerk antes de activarla. Una baja o un evento fuera de orden no puede reactivar acceso, y una re-invitación nunca hereda el rol operativo histórico de una membresía deshabilitada.
- Cada organización Clerk guarda `obrasaasDatabaseOrganizationId` en metadata privada. Ese vínculo estable preserva el mismo tenant, sus obras y su suscripción durante un cambio futuro de instancia.
- Eliminar un usuario en Clerk conserva `PlatformUser` y la auditoría histórica; deshabilita sus membresías tenant y accesos por obra.
- Un cambio de IDs development → production requiere un manifiesto local `clerk-cutover*.json`, ignorado por Git y con cobertura completa de usuarios y organizaciones vinculados.
- `npm run clerk:organization-links -- --plan <archivo>` prepara y valida los vínculos privados en la instancia production. La mutación exige `--apply --confirm-instance <ins_...>`.
- `npm run clerk:cutover -- --plan <archivo>` valida instancia production, emails verificados, organización interna, cardinalidad, membresías/roles exactos y ausencia de colisiones. El apply exige además `--confirm-webhooks-frozen --confirm-identity-writes-frozen`, toma un advisory lock, vuelve a leer Clerk production y Neon bajo el lock, y ejecuta todos los rebinds con compare-and-swap dentro de una transacción serializable.
- Sesión, webhooks, despliegues con claves antiguas y toda mutación de usuarios, organizaciones, invitaciones o membresías en Clerk production deben permanecer congelados durante el corte. El webhook production se habilita sólo después del commit y de actualizar `OBRASAAS_INTERNAL_CLERK_ORG_ID`.

El manifiesto no contiene secretos, pero sí identificadores operativos y no se versiona. Debe incluir **todas** las identidades Clerk vinculadas en Neon:

```json
{
  "targetInstanceId": "ins_PRODUCTION",
  "users": [
    {
      "platformUserId": "id_interno_neon",
      "expectedPreviousClerkUserId": "user_DEVELOPMENT",
      "nextClerkUserId": "user_PRODUCTION"
    }
  ],
  "organizations": [
    {
      "organizationId": "id_tenant_neon",
      "expectedPreviousClerkOrganizationId": "org_DEVELOPMENT",
      "nextClerkOrganizationId": "org_PRODUCTION"
    }
  ]
}
```

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
