# Acceso de oficina para revisión de WhatsApp

El acceso de revisión permite a una cuenta Auditor consultar la configuración guardada de una conexión de empresa y los eventos elegidos por el administrador. La invitación no habilita envío de mensajes, gestión del canal, documentos de operarios ni los módulos ordinarios de obra.

## Recorrido del revisor

1. Un administrador vigente invita el correo del revisor desde la obra que tiene asignado el canal COMPANY. Define la caducidad del acceso.
2. El revisor acepta la invitación de Clerk con ese correo verificado, ingresa por el inicio de sesión normal y selecciona la organización correspondiente. Abre `/cuenta?oficina=<invitationId>` y acepta el acceso de lectura.
3. El administrador consulta el acceso vigente y comparte explícitamente la configuración para esa invitación. Una invitación pendiente no permite esta acción. Puede compartir un saludo recibido cuya firma y contenido seguro se verifican desde el origen guardado.
4. El revisor abre la obra en Mis obras. Ve la conexión compartida y los eventos seleccionados. Puede actualizar la consulta; no dispone de envío ni gestión.

El administrador puede retirar la configuración compartida sin revocar todo el acceso. Revocar la invitación deshabilita la pertenencia del revisor a esa obra. La revisión debe hacerse con la cuenta Auditor y su sesión normal; no requiere entregar credenciales de administrador.

Cuando Mis obras confirma el acceso limitado de oficina, la guía ofrece cuatro pasos: comprobar la organización, actualizar Mis obras, abrir la obra asignada y consultar conexión y eventos. La guía sólo mueve el foco hacia esos controles; aceptar la invitación y consultar el panel requieren acciones del revisor. Una marca personal de revisión o la selección de la obra no acreditan su contenido ni la aceptación de Meta. Los cambios de cuenta, organización o sesión descartan la observación anterior y las marcas de la guía.

## Contrato de lectura y selección

`GET /api/identity/office-review?projectId=<obra>&scope=<contexto>&view=review` devuelve `connection:null` y `canObserveConfiguration:false` hasta que exista una selección explícita para la invitación aceptada de la cuenta actual. Cuando existe, devuelve exclusivamente:

| Campo | Significado |
| --- | --- |
| `version` | Versión 1 de la proyección. |
| `connectionRef`, `wabaRef`, `phoneNumberRef` | Referencias opacas vinculadas a la organización, sin los identificadores crudos de Meta. |
| `connectionStatus`, `enabled`, `mode` | Configuración guardada: CONNECTED, habilitada y COMPANY. |
| `channelRevision`, `assignmentRevision` | Revisiones de la conexión y su asignación a la obra. |
| `observedAt` | Hora del servidor de base de datos de la selección explícita. |
| `evidenceOrigin` | `STORED_AUTHORIZED_CONNECTION`. |

La proyección excluye token, cifrado, número visible, nombre de empresa verificado y metadata privada. El DTO completo conserva `readOnly:true`, `canSend:false` y `canManage:false`.

Las acciones `SHARE_CONNECTION` y `WITHDRAW_CONNECTION` usan el mismo contrato privado de `office-review`: proyecto, contexto vigente, UUID de operación y payload cerrado. Compartir exige `{invitationId,connectionId,confirmReadOnlyConfiguration:true}`; retirar exige `{invitationId,reason}`, con una razón de 8 a 400 caracteres. Cada acción tiene recibo durable. El mismo UUID con otro payload se rechaza; una confirmación perdida se consulta con el UUID original antes de volver a operar. Repetir un compartir histórico no revierte un retiro posterior.

La selección se serializa por invitación y registra una revisión monótona. Está vinculada al recibo original, al grant aceptado, al usuario, a la pertenencia, a la conexión y a ambas revisiones. Dos auditores de la misma obra requieren selecciones independientes para ver la configuración.

## Vigencia y límites de evidencia

Cada lectura vuelve a verificar sesión, organización, rol AUDITOR de la cuenta, pertenencia activa a la obra, caducidad según el reloj de base de datos, invitación no revocada, emisor ADMIN vigente y responsable ADMIN vigente de la selección. También requiere canal habilitado CONNECTED, modo COMPANY, asignación activa y revisiones coincidentes. Los cambios de esos datos invalidan la lectura anterior. Un origen histórico de participación de operario sigue bloqueando este acceso de oficina.

La conexión muestra configuración persistida; no realiza una nueva consulta a Meta y no acredita por sí sola la autorización actual del proveedor, la aprobación de App Review ni la entrega de mensajes. `observedAt` indica cuándo se seleccionó esa configuración, no cuándo Meta la verificó.

Los eventos compartidos se reducen a un saludo seguro con firma comprobada y sus estados correlacionados de procesamiento, respuesta y entrega. No incluyen remitente, destinatario, texto, documento, identificador de mensaje ni contenido cifrado. Un estado `read` recibido de Meta se presenta como observación del proveedor; no demuestra lectura física ni aceptación humana del producto.

## Verificación técnica

Las suites `tests/production-office-review*.test.mjs` cubren política, contratos HTTP, proyecciones, autorización, recibos y continuidad del origen. `scripts/verify-office-review-postgres.mjs` ejecuta el store real y SQL real con el esquema canónico en un esquema aleatorio de la base local descartable `obrasaas_cutover_ci`; no crea otra base ni usa producción. Exige `CUTOVER_TEST_DISPOSABLE=1`, conexión localhost y rol `cutover_test`.

El verificador comprueba dos auditores en la misma obra, selección independiente, ausencia de efectos durante lectura, repetición de UUID, rollback, confirmación perdida de COMMIT, serialización concurrente, retiro y revocación, aislamiento de organización/proyecto, roles y revisiones actuales, caducidad y cambios del origen firmado. Rechaza llamadas de red no controladas y registra hashes de fuentes, revisión de Git y eliminación del esquema en `.vercel/office-review-evidence/postgres.json`.

`scripts/verify-office-review-ui.mjs` monta los paneles y estilos reales con respuestas locales interceptadas en anchos de 320, 390, 768 y 1280 píxeles. Comprueba la selección explícita por invitación, el retiro, la recuperación de recibos sin repetir la acción, la ausencia de envío en el revisor y el descarte de respuestas tardías, rechazos y configuraciones fuera del contrato. Registra fuentes, capturas y limpieza del fixture en `.vercel/office-review-evidence/ui.json`. `scripts/verify-onboarding-guide-ui.mjs` verifica también los cuatro pasos de oficina y el reinicio de su observación en cambios de contexto. Ambas pruebas de interfaz usan identidad sintética y no acreditan un login real ni aceptación humana.

El informe PostgreSQL declara explícitamente identidad y sesión sintéticas, cero llamadas al proveedor y ausencia de login real, aceptación de Meta, entrega real y aceptación humana. Implementación, prueba técnica, publicación y recorrido real del revisor son estados independientes. El login normal y el recorrido de App Review deben comprobarse después con la cuenta autorizada y evidencia real.
