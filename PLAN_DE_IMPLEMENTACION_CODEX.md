# Plan de implementación ObraSaaS: autoservicio del cliente y operación real

## Regla de salida

**Una empresa cliente debe conectar y administrar su WhatsApp desde ObraSaaS sin intervención habitual del fundador ni del equipo técnico.** Es requisito de salida del producto, no una función opcional posterior. El cliente no copia tokens, WABA IDs, App Secret, comandos cURL ni variables de entorno.

El responsable de la empresa sí realiza las acciones personales que exige Meta: ingresar en su cuenta, elegir o crear su portafolio/WABA, autorizar permisos, verificar el número cuando corresponda y aceptar las condiciones aplicables. Automatizar la plataforma no permite suplantar ese consentimiento. La intervención de soporte queda reservada a incidencias reales (restricciones, disputa de titularidad o migraciones excepcionales), no al camino normal.

El plan anterior se conserva en `docs/history/PLAN_2026-09-25_UNVERIFIED.md`. Sus etiquetas de módulos completos, simulador real, miles de tests y grado bancario **no son prueba de funcionamiento de extremo a extremo**. No se reutilizan como estado actual. Tampoco se equipara un hash con firma digital cualificada, GPS con triangulación interior, ni un ejemplo de ART con una cobertura verificada.

## Base real y continuidad

Repositorio único: `inguillen87/obrasaas`. Dominio principal: **obrasaas.com**. Base del corte integral del 1 de octubre: **2e6edee85726231b25cb845b7884bd100741ef5f**. Mantener separados Chatboc, MuniControl y los demás productos.

Conservar sesión personal Clerk, marca v3, almacenamiento privado, rechazo de respuestas simuladas y ámbito canónico de empresas/obras. El alta de una empresa en Clerk no concede automáticamente acceso a todos los trabajadores, obras o registros históricos.

La rama enterprise `1677ff72773c95140535603093e5cb8624d1f063` contiene piezas reutilizables de Embedded Signup, preparación por obra, revisiones de plantillas, participantes y operaciones. **Existencia en esa rama no implica publicación o aceptación en el dominio principal.** Reutilizar contratos y migrar cortes integrados; no publicar esa rama completa a ciegas ni mantener motores de fichaje paralelos.

## Estados de evidencia obligatorios

El corte integral incorpora participantes e invitaciones, presentación privada de identidad con revisión humana, jornada y sectores/QR, evidencia privada, propuestas de cantidades/avance, compras/recepciones y pendientes auditados. Embedded Signup usa estados durables, credenciales cifradas aisladas e inbox firmado y catálogo/solicitud de plantillas por WABA. Se adaptaron contratos enterprise a las tablas canónicas existentes; no se creó otro motor ni se aplicó una migración a Production. Las pruebas controladas y sus límites figuran en `docs/production/integral-worksite.md`. Su estado de publicación se verifica por SHA/deployment en el PR; la aceptación humana y las llamadas de autorización a Meta continúan siendo evidencias separadas.

Cada función debe indicar por separado: código implementado, prueba automatizada con fuente/identidad controladas, revisión publicada en Production y aceptación con un cliente real. Sólo la última permite afirmar que el cliente ya completó ese circuito.

| Circuito | Evidencia disponible al revisar la base | No demostrado por esa evidencia |
| --- | --- | --- |
| Cuenta y cronograma | Código publicado, SHA observado, pruebas aisladas de permisos/planificación/recibos | Operación de cada empleado real o aprobación del avance mediante evidencia |
| Número demo de Meta | Un hello_world aceptado con HTTP 200 y wamid usando el token existente y el destinatario que generó Meta | Entrega/lectura, recepción firmada por ObraSaaS o funcionamiento multicliente |
| Plantillas | Catálogo y controles en código; hello_world/en_US aprobado en la WABA de prueba | Aprobación de todo el catálogo en cada WABA cliente, entrega de cada idioma/versión |
| Embedded Signup cliente | Componentes y backend en la rama enterprise | Alta de una empresa externa completada autónomamente en Production |
| Preparación por empresa/obra | Se integra en este corte utilizando el schemaVersion 2 y reglas existentes | Consentimiento Meta, registro del número, activación de los circuitos elegidos |

Los estados verificados deben apuntar al SHA, entorno y recibo/run concretos en el PR. No declarar en el plan un despliegue que todavía no fue comprobado.

## Identidad del canal y credenciales

Para el piloto se conserva la app **ObraSaaS**, el Test Number **+1 555-153-3706**, WABA **2046153882937995**, Phone Number ID **1225843560610854** y app ID **1665088767899217**. No crear otro número ni regenerar el token para repetir ensayos. La correspondencia argentina observada en Meta se guarda explícitamente para ese destinatario; no se modifica globalmente la identidad de los empleados.

**La credencial fija del piloto no es la credencial de todas las empresas.** Cada autorización cliente debe producir y almacenar su acceso empresarial separado, cifrado y vinculado a su WABA/número/empresa/obra. La aplicación de Meta y su configuración pertenecen al proveedor; las WABAs y números del cliente conservan su titularidad. Ningún fallo de una conexión debe usar como fallback el token o número de la demo u otro cliente.

La habilitación propia de la plataforma es un trabajo único del proveedor: validar permisos y modo de la app, configuración Embedded Signup vigente, dominio autorizado, App Secret, verificación de callbacks, cifrado y políticas de retención. La aprobación del programa Tech Provider/Tech Partner y los permisos de esta app se verifican por separado; una etiqueta comercial o una aprobación de otra app no demuestra que esta integración esté operativa.

No prometer tokens eternos. Observar su vigencia, revocaciones y permisos; conducir al responsable por una reautorización dentro del producto cuando Meta la requiera, sin intercambio manual de secretos.

## P0. Alta autogestionada de una empresa

1. **Preparación del cliente:** iniciar sesión, seleccionar su empresa y obra, elegir nombre del asistente, uso previsto y tipo de número. Guardado persistente, control de revisiones, recibo y recuperación. No cambiar el servicio anterior al guardar.
2. **Autorización Meta:** botón dentro de ObraSaaS que abre Embedded Signup. Estado/nonce y operación durables vinculados al usuario, empresa, obra, revisión preparada y modo elegido. Validar origen y formato de eventos del SDK; no confiar sólo en un postMessage con IDs.
3. **Finalización servidor:** canjear el código sólo en servidor; verificar app, permisos, WABA, número y propiedad de la autorización; guardar la credencial cifrada para su ámbito. Revalidar pertenencia y preparación antes de persistir. Manejar código consumido, cancelación, expiración, pérdida de respuesta y recuperación sin dar por conectado un resultado incierto.
4. **Activación técnica:** suscribir la WABA, comprobar número y registro aplicable, verificar callback firmado y receptor duradero, deduplicar lotes y conservar recibos. No marcar listo por guardar una fila de WhatsAppConnection.
5. **Plantillas del cliente:** aplicar el paquete elegido a ESA WABA, leer su estado por nombre/idioma/versión, mostrar revisión/rechazo/pausa y corregir sin intervención técnica normal. No clonar una aprobación desde la WABA de prueba. La creación, aprobación y entrega son comprobaciones independientes.
6. **Prueba guiada:** el cliente envía y recibe un mensaje, una foto y un audio; ObraSaaS relaciona mensajes/estados/recibos con el canal y obra correctos. Distinguir accepted/sent/delivered/read. Ningún resultado incierto dispara otro envío sin control.
7. **Administración:** cambiar responsable autorizado, recuperar una conexión, mostrar vigencia y retirar el acceso a ObraSaaS sin borrar el negocio, la WABA o los mensajes ajenos. Auditar operaciones y revalidar autorizaciones.

### Tres caminos, no un único registro destructivo

- **Número dedicado Cloud API:** el cliente verifica y autoriza un número suyo. ObraSaaS completa las operaciones servidor aplicables; no debe exigir comandos o tokens manuales.
- **Ya usa WhatsApp Business App:** coexistencia sólo después de verificar la elegibilidad y el flujo aprobado para esta app. Conservar la app cuando el flujo lo permita. No reenviar una selección de coexistencia al registro API-only ni pedir que desinstale la app como atajo.
- **Otro proveedor/API existente:** diagnosticar titularidad, restricciones y compatibilidad antes de un traspaso explícito. Mantener el canal anterior hasta confirmar el cambio; no desvincular al guardar una intención ni presentar migración como coexistencia.

**Criterio de salida P0:** dos empresas de prueba autorizadas e independientes completan el alta desde sus navegadores sin fundador/técnico en el recorrido normal. Pruebas negativas: empresa A no puede conectar, leer plantillas, enviar o revocar los activos de B. Cancelar o repetir no crea conexiones duplicadas ni expone credenciales. La prueba del número demo no sustituye esta aceptación.

## P1. Personas y campo, sobre el canal autorizado

- Invitaciones y vinculación del wa_id a operario, encargado, arquitecto/director y dueño, con empresa/obra, permisos concretos y revocación. Un rol escrito en el mensaje no da autoridad; el dueño/comitente no es automáticamente superadmin.
- KYC privado con información al participante, documento/selfie, lectura de datos separada de verificación, revisión y resolución autorizada. No inventar liveness, puntajes biométricos, ART ni identidad aprobada. El alta no ficha horas.
- Entrada, pausa, regreso y salida con hora de servidor, posición y precisión, estado de revisión y sector. GPS/geocerca más sector o QR de zona, sin llamarlo triangulación interior. No confirmar horas por falta de señal o duplicar eventos.
- Evidencia foto/video/audio privada y vinculada a mensaje, participante, obra, sector y tarea. Estados de recepción/procesamiento/rechazo reales y límites de tamaño/retención. Audio español y ruido de obra se prueban físicamente, no se acreditan con un audio sintético en inglés.
- Propuesta de cantidad/avance a partir de evidencia y resolución humana autorizada. Sólo una decisión persistida actualiza el avance de la tarea/Gantt. Planificar fechas no certifica avance. Preservar origen, revisión, cantidades, unidades y recibos ante reintentos.

**Criterio de salida P1:** cuatro participantes reales autorizados completan identificación, fichaje y envío de evidencia; el responsable revisa y el dueño ve el registro y avance correctos. Repetir mensajes, perder conexión, revocar roles y cruzar obra no duplica ni filtra operaciones.

## P2. Operación sostenible, antes de vender como producto autónomo

Panel de estado por cliente/número, errores accionables sin secretos, tiempos de procesamiento, colas/reintentos, vencimientos y plantillas; observabilidad y límites de gasto por empresa; restauración probada, auditoría y procedimiento de incidente. La intervención de soporte queda medida y vinculada a una causa, no oculta detrás de un botón Conectar.

Después de P0/P1: ampliar módulos comerciales, compras, certificaciones, facturación y offline con aceptación propia. No introducir otro módulo para ocultar que el cliente todavía necesita asistencia para activar o usar el canal.

## Entrega actual de preparación: alcance estricto

Se reutilizan `tenant-workspace-policy.js` y `project-workspace-profile.js` de enterprise. La API protegida `/api/identity/whatsapp-setup` y el panel dentro de Mis obras permiten a ADMIN/DIRECTOR guardar la preparación **de esa obra**, conservar metadata ajena y recuperar el recibo. No capturan ni muestran credenciales.

Se muestran separados preparación, autorización, registro del número, plantillas, recepción/respuesta y aceptación de campo. El botón de autorización permanece deshabilitado mientras no exista un recorrido publicado/aceptado. **Esta entrega no da por terminado P0.** No cambia los tokens ni publica falsamente un alta cliente exitosa.

## Fuentes y continuidad técnica

Contratos de origen: `src/lib/whatsapp/tenant-workspace-policy.js`, `project-workspace-profile.js`, `embedded-signup.js` y rutas de integraciones de la revisión enterprise indicada. Autoridad productiva: sesión verificada más tablas canónicas de pertenencias, nunca estado global demo.

Documentación primaria: programa de partners de WhatsApp (`https://business.whatsapp.com/partners/become-a-partner`), colección oficial Meta de Embedded Signup en Postman (`https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup`) y documentación de Embedded Signup/plantillas en Meta. Revalidar las versiones y capacidades aplicables antes de habilitar cada camino. Los permisos concretos de la app ObraSaaS requieren evidencia de su panel, no una afirmación genérica.

## Corte de apertura de empresa desde cero

Se integra el alta canónica de una constructora nueva antes del teléfono: sesión org:admin, correo acreditado por una prueba firmada de Clerk, confirmación de empresa/primera obra y tareas explícitas. Todo con recibo atómico y recuperación; no se reasigna una organización existente ni se copian datos demo. Se agrega Nueva tarea al cronograma para que la obra vacía pueda comenzar a planificarse.

La plantilla de perfil `obrasaas-bootstrap-v1` está configurada por la CLI oficial en Production, con lifetime60s; no sustituye ni rota claves administrativas y no elimina verificaciones. La aceptación de código/SQL/UI se documenta en `docs/production/new-constructor-onboarding.md` y en el PR del bloque. La aceptación con un cliente físico sigue pendiente hasta ejecutarla; no se marca P0 completo.

El número nuevo se incorporará por el consentimiento y la verificación propios de Embedded Signup. El OTP no equivale a permisos de toda la plataforma, aprobación automática de plantillas ni módulos comerciales terminados. Esta entrega prepara empresa/obra/tareas; los restantes cierres P0/P1 permanecen abiertos de forma explícita.
