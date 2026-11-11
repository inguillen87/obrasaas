# Piloto con el número propio de la empresa

Guía operativa para poner en marcha una constructora real con su propio número de
WhatsApp, su equipo y su primera obra. Cada paso remite al circuito ya publicado en
`/cuenta`; nada de lo que sigue crea atajos ni relaja controles. Los valores privados
(tokens, claves, IDs de Meta) los carga el titular; ninguna herramienta de este
repositorio los imprime ni los guarda.

El piloto sigue **NO ACEPTADO** hasta completar en un teléfono real los recorridos de la
sección 9. Que una variable esté cargada no demuestra recepción de mensajes ni identidad.

## 0. Quién hace qué

| Rol en ObraSaaS | Persona | Puede |
| --- | --- | --- |
| ADMIN (`org:admin`) | titular de la empresa | crear la empresa, conectar el número, invitar, aprobar KYC, emitir mandatos, aplicar cronogramas |
| DIRECTOR o SITE_MANAGER ("Jefatura de obra") | jefa de obra | importar cronogramas, revisar avances; como DIRECTOR también aprueba y emite mandatos |
| Operario / Encargado (puesto de obra) | albañiles, capataces | por WhatsApp: entrada, pausa, salida, evidencia, incidencias, pedir/registrar material, proponer avance |

Las decisiones con control cruzado (ajustes de stock, consumos sin mandato, mandatos)
exigen un ADMIN o DIRECTOR **distinto** de quien pidió. Con dos responsables (titular
ADMIN y jefa de obra DIRECTOR) se cubren mutuamente.

## 1. Crear la empresa y la primera obra

1. Entrar a `https://obrasaas.com/sign-up`. El alta con email y contraseña y el código de
   verificación por email los envía Clerk (no hace falta Resend).
2. En `/cuenta`, crear la organización con el selector de organización. Quien la crea es
   `org:admin`.
3. En el panel de alta de empresa: nombre, primera obra y tareas iniciales opcionales.
   Empieza una prueba de 15 días; el plan se gestiona en **Plan y facturación**.
4. Declarar el teléfono de la empresa y contrastarlo con el número que devuelve la
   **Comprobación en Meta**. Por ejemplo, `+54 9 221 204 2975` se normaliza como
   `+5492212042975`. La declaración y la comprobación deben coincidir; no agregar ni
   quitar dígitos a ciegas para intentar superar una diferencia.

## 2. Preparar el número en Meta (Business Manager del titular)

1. Usar la app de Meta de ObraSaaS (la fijada en `src/lib/meta-channel-binding.mjs`) y una
   **WABA propia de la empresa**, distinta de la WABA del número de prueba.
2. Agregar el número en WhatsApp Manager y dejarlo registrado en Cloud API.
   - Si el número ya se usa en WhatsApp o WhatsApp Business, revisar primero el recorrido
     oficial de registro o migración que Meta ofrece para esa cuenta y su impacto en el
     servicio existente. No eliminar la cuenta del teléfono como paso automático de esta
     guía. La convivencia con la app Business (coexistence) usa otro recorrido y no se
     activa mediante esta política Own.
   - El PIN de dos pasos para `/register` no es el código SMS.
3. Crear un **usuario del sistema** (SYSTEM_USER) con acceso a la app y a la WABA, y
   generar un token con `whatsapp_business_management`, `whatsapp_business_messaging` y
   `business_management`. Anotar su vencimiento.
4. Anotar tres IDs numéricos: Business ID, WABA ID y Phone number ID.

## 3. Obtener los IDs internos (consulta de sólo lectura en Neon)

En la consola SQL de Neon (rama de producción), reemplazando el nombre de la empresa:

```sql
SELECT o.id AS "organizationId", o."clerkOrganizationId", u.id AS "actorId", u."clerkUserId",
       o.metadata->'companyPhoneDeclaration'->>'e164' AS "telefono",
       o.metadata->'companyPhoneDeclaration'->>'revision' AS "revision"
FROM "PlatformUser" u
JOIN "TenantMembership" m ON m."userId" = u.id
JOIN "Organization" o ON o.id = m."organizationId"
WHERE m."tenantRole" = 'ADMIN' AND m.status = 'ACTIVE' AND o.name ILIKE '%NOMBRE DE LA EMPRESA%';

SELECT id AS "projectId", name FROM "Project" WHERE "organizationId" = '<organizationId>';
```

El `actorId` y el `clerkUserId` deben ser los de quien va a conectar el número.

## 4. Cargar las variables de Production en Vercel

Variables que ya usa el canal y deben existir en Production: `META_APP_SECRET`,
`NEXT_PUBLIC_META_APP_ID`, `META_GRAPH_API_VERSION` (`vNN.0`), `META_CUSTOMER_VERIFY_TOKEN`
(32+ caracteres), la clave del vault (`META_CUSTOMER_CREDENTIALS_KEY` o
`WHATSAPP_CREDENTIALS_ENCRYPTION_KEY`, 32 bytes en base64), `CRON_SECRET` y
`META_CUSTOMER_JOB_SECRET` (procesamiento cada 5 minutos).

Nuevas para el número propio:

1. `META_OWN_COMPANY_ACCESS_TOKEN`: el token del usuario del sistema (Sensitive, sólo
   Production). No tiene fallback a otros tokens.
2. La política, generada sin red ni secretos con el mismo parser que usa producción:

   ```bash
   node scripts/prepare-own-company-policy.mjs \
     --source-head <SHA completo del deploy actual de Production> \
     --organization-id <organizationId> --actor-id <actorId> \
     --clerk-user-id <user_…> --clerk-organization-id <org_…> --project-id <projectId> \
     --business-id <Business ID> --waba-id <WABA ID> --phone-number-id <Phone number ID> \
     --phone "+54 9 221 204 2975" --phone-revision 1
   ```

   Imprime `OBRASAAS_META_OWN_COMPANY_RELEASE`, `OBRASAAS_META_OWN_COMPANY_POLICY` y
   `OBRASAAS_META_OWN_COMPANY_POLICY_REVIEW_SHA256`. Valida con el reloj actual y el parser
   de producción: una ventana vencida, una fecha futura o IDs inválidos producen un error
   sin imprimir configuración. `--help` muestra todos los argumentos.
3. Cargar esas tres variables y hacer **Redeploy del mismo commit** (sin cambiar el código).
   La política está atada a ese SHA: un deploy con otro commit la deja cerrada.
4. La ventana de administración dura como máximo 4 horas desde que se generó la política.
   Generarla justo antes de conectar. El canal ya activado sigue funcionando después de la
   ventana, hasta que vence el token, mientras quien lo activó siga siendo ADMIN activo y el
   teléfono declarado no cambie; si cambia cualquiera de los dos, el canal se cierra.

## 5. Conectar y activar el número

En `/cuenta` → **Número de la empresa**, con la sesión del ADMIN de la política:

1. **Comprobación en Meta**: muestra la app, la WABA y el número que ve el token, sin
   escribir nada.
2. **Conectar** (`CONNECT_OWN_NUMBER`): guarda el token cifrado. El canal queda preparado,
   todavía desactivado.
3. **Activar** (`ACTIVATE_OWN_NUMBER`): comprueba el registro y suscribe la WABA al
   callback `https://obrasaas.com/api/meta/customer-callback`.
4. Si un paso queda incierto (timeout), usar **Recuperar conexión pendiente** con el mismo
   intento. No repetir a mano.

Si aparece `COMPANY_CHANNEL_CATALOG_REQUIRED`, falta adoptar el esquema del canal en Neon:
`node scripts/adopt-company-channel-schema.mjs --dry-run --expected-project <id> --expected-team <id>`
con las variables de Production, y luego `--apply --expected-fingerprint <sha>` con el
fingerprint revisado del dry-run.

## 6. Plantillas

En **Plantillas** ("Revisar plantillas de nuestro WhatsApp"): preparar y enviar a Meta las
plantillas de utilidad que usa el sistema (invitación del participante, onboarding,
recordatorio de asistencia, pedido de evidencia, aviso de revisión de avance). Las
invitaciones por WhatsApp sólo salen con la plantilla en estado APPROVED.

## 7. Equipo, identidad y "HOLA"

1. **Jefa de obra**: invitarla por email desde **Equipo e identidad** (invitación de Clerk,
   vence a los 7 días) y asignarle Jefatura de obra o Dirección.
2. **Personal de obra**: agregar a cada persona con nombre, celular y puesto, y preparar
   la invitación por WhatsApp. La persona primero acepta la invitación y vincula su cuenta;
   el desafío de identidad sólo se habilita después de esa aceptación. Luego presenta
   frente y dorso del DNI y selfie desde el enlace o por chat (`IDENTIDAD <código>`).
   Si una entrega queda incierta, recuperar el mismo intento desde el panel antes de
   preparar otra invitación.
3. **Solicitudes desde WhatsApp**: si se habilita, una persona que no está cargada puede
   escribir `HOLA` al número de la empresa. El bot le pide nombre y apellido, puesto,
   email y confirmación, y la solicitud queda para que un responsable la admita o la
   rechace. Mientras espera esa decisión, puede escribir CANCELAR para retirar su
   solicitud pendiente. La retirada no revoca una admisión ya confirmada. Si las
   solicitudes están deshabilitadas, el mensaje queda en **Bandeja de mensajes** sin
   respuesta.
4. Quien ya está vinculado y verificado recibe, al escribir `HOLA` o `MENU`, la lista de
   obras autorizadas y después el menú de campo según sus permisos.
5. **Revisión de identidad**: aprobar o rechazar con un motivo (8 caracteres o más); quien
   revisa no puede ser la misma persona. Para pedir otras fotos: rechazar indicando qué
   falta y preparar un nuevo desafío `IDENTIDAD`. El análisis previo (lectura del DNI y
   comparación facial) es orientativo: no certifica identidad ni prueba de vida.

Requisitos: almacenamiento privado (`PRIVATE_MEDIA_PROVIDER=vercel-blob` con
`BLOB_READ_WRITE_TOKEN`), `OPENAI_API_KEY` para leer el DNI y
`OBRASAAS_BIOMETRIC_SERVICE_KEY` (64 hex) para la comparación facial. La consulta a
RENAPER vía BINDX existe pero está cerrada: no hay convenio ni credenciales.

## 8. Cronograma y materiales

**Cronograma desde PDF o imagen**: en **Cronograma** → Importar cronograma (PDF, PNG, JPG,
WEBP hasta 3 MB, o XLSX de las plantillas soportadas). Con consentimiento explícito, el
documento se analiza con OpenAI y vuelve como borrador de hasta 50 tareas con fechas.
Nada se crea hasta revisar y **Aplicar** (ADMIN o DIRECTOR). También se puede importar por
WhatsApp ("Importar cronograma"). El calendario de obra se actualiza solo cada ~45 s.

**Presupuesto desde CSV**: en el importador de **Cronograma**, seleccionar el
presupuesto CSV y cargar un archivo UTF-8 de hasta 3 MiB y 200 filas. La primera fila
debe contener exactamente:

```csv
pagina,codigo,descripcion,unidad_original,cantidad_original,precio_unitario_original,total_iva_incluido_original
```

El análisis es local y conserva los valores originales como texto. Requiere su
consentimiento específico y acceso ADMIN o DIRECTOR; permite consultar y descargar
la fuente sin crear tareas, calcular importes, aplicar una curva financiera ni mover
stock. Revisar la última fila y el origen de los valores antes de usar el presupuesto
para tomar decisiones. Un CSV de presupuesto no reemplaza un cronograma con fechas.

**Descuento de materiales**:

1. Cargar el catálogo (`ADD_MATERIAL`): cal, cemento, arena, ladrillos, con unidad
   (bolsa, m3, unidad…).
2. Dar stock inicial: recepción de compra o ajuste de entrada aprobado por otro
   responsable. No hay stock implícito.
3. Emitir un **mandato de ejecución** (ADMIN o DIRECTOR distinto del trabajador): tarea,
   sector, materiales, cupo total, máximo por informe y vencimiento de hasta 30 días.
4. El trabajador, por WhatsApp → **Registrar material**, informa cantidades exactas. El
   stock baja en la misma transacción y nunca queda negativo. Sin mandato, **Proponer
   consumo** espera la aprobación de un responsable.

## 9. Primer día en obra: qué probar en el teléfono

- [ ] Login y logout de titular y jefa de obra; cada uno ve sólo su empresa y obra.
- [ ] `HOLA` desde un número no cargado (con solicitudes habilitadas) → conversación de
      ingreso → admisión desde el panel.
- [ ] Onboarding por plantilla → identidad completa → aprobación → `HOLA` muestra obra y
      menú.
- [ ] Entrada, pausa y salida; foto de evidencia; incidencia; registro de material con
      mandato y verificación del stock en **Materiales**.
- [ ] Importar un cronograma real en PDF, revisar filas, aplicar y ver las tareas en
      **Cronograma**.
- [ ] Casos de error: permiso ajeno, reintento del mismo mensaje, sin señal. Ninguna
      pantalla debe informar algo que el servidor no confirmó.

## Límites conocidos de esta versión

- El disparador es `HOLA` exacto (sin signos ni texto extra).
- No hay una decisión "pedir más documentación": se rechaza con motivo y se prepara un
  nuevo desafío.
- La decisión de identidad no se notifica sola por WhatsApp.
- El número propio sirve para una sola empresa por política. Para clientes generales se usa
  Embedded Signup, con sus propias variables de habilitación.
