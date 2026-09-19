# PLAN MAESTRO DE IMPLEMENTACIÓN — OBRASAAS

Versión 3.0 · Continuidad de producto y arquitectura · 19 de septiembre de 2026.
Repositorio: inguillen87/obrasaas. Rama de trabajo: `codex/saas-recovery-20260917`.
Base inspeccionada al iniciar esta fase: `9859890f2d6ed479946185eb8d847bda1e04e4aa`.

## 1. Decisión de producto aprobada por Marcelo
**Cada empresa cliente autoriza su propia cuenta y número WhatsApp. Sus empleados escriben a ese número. ObraSaaS procesa dentro del tenant, con obras, personas, documentos, herramientas y permisos separados.** El número comercial de ObraSaaS se usa para ventas y soporte: no es la bandeja común de partes privados de todas las constructoras.

La experiencia buscada es plug-and-play: preparar empresa/asistente → autorizar con Meta → incorporar equipo → comprobar una operación → activar los circuitos autorizados. No se solicitan contraseñas de Facebook, claves de aplicación, WABA IDs ni tokens manuales al cliente. La autorización del titular, las verificaciones que Meta exija y el consentimiento aplicable no se omiten ni simulan.

El agente es un servicio del backend, no un proceso que dependa del celular encendido o WhatsApp Web. El teléfono es el canal y la identidad comercial. Una conexión aceptada no demuestra respuesta del agente, entrega o acceso correcto a una obra.

## 2. Cómo leer este plan y las fuentes anteriores
El plan v2.4 y el walkthrough aportados en el proyecto describen 14 módulos y los sprints 9–14. Se preservan como antecedentes de alcance, no como evidencia de que todo el SaaS real esté terminado. Sus rótulos «100%», referencias legales y métricas de simulación no se trasladan automáticamente al producto comercial.

Este archivo se incorpora a la rama de recuperación porque no estaba presente allí al comenzar esta fase. No se editó ni sustituyó el documento original adjunto. El código, las migraciones, los verificadores y la evidencia con SHA del PR determinan el estado observado. La documentación de un proveedor es una capacidad publicada, no una prueba contratada ni una garantía sobre nuestra cuenta.

Referencias para trabajar: `docs/recovery/competitive-cycles-roadmap.md`, `docs/recovery/friendly-whatsapp-onboarding.md`, `docs/recovery/tenant-owned-whatsapp-architecture.md`, `docs/recovery/production-configuration-preflight.md`, `docs/recovery/security-dependency-release.md` y el PR #1. No leer variables con secretos para construir un resumen.

## 3. Estado y stack de esta rama
Next.js 16.3.5, React 19, Prisma/client 7.9.0 y PostgreSQL; confirmar package.json y package-lock.json antes de actualizar. Dark Obsidian y tokens de `src/lib/design-system.js`. Las versiones antiguas del v2.4 no son la fuente del lockfile actual.

Existe Embedded Signup, aislamiento por empresa, almacenamiento cifrado de credenciales, recepción persistida, bandeja, revisión, mediciones y lectura del Gantt. La conexión técnica actual `WhatsAppConnection` tiene `projectId` único: **un número conectado a una obra**, no un canal multiobra resuelto. El límite no debe ocultarse ni arreglarse duplicando el token en cada obra.

La fase anterior probó recepción del piloto, pero el estado consultado seguía con autorización temporal vencida y sin salida registrada. No se considera cerrada la prueba bidireccional ni el pase a Production. La versión y prueba concretas de cada nueva entrega se registran después de ejecutarlas.

## 4. Infraestructura y marcas: una decisión explícita
Se mantiene la app ObraSaaS como integración activa de este producto. La condición Tech Provider que el usuario informa para ChatBoc puede aprovecharse mediante una infraestructura empresarial compartida sólo después de comprobar app, permisos, dominios, portfolio y autorizaciones aplicables. No se presume que se transfieran a otra app por usar la misma cuenta personal de administrador.

Compartir infraestructura no significa compartir datos, números, WABAs, presupuestos ni privilegios entre productos. No migrar activos de ChatBoc, Junín, NexID u otras empresas para destrabar ObraSaaS. Una eventual capa común de Meta debe exponer adaptadores explícitos `product=OBRASAAS` y `product=CHATBOC`, con app/secret/routing identificados. Marcelo/inguillen es administrador humano, no la credencial del runtime.

## 5. Roadmap de entrega — conservar Sprints 9 a 14
| Fase | Entrega / criterio de cierre | Estado de referencia |
| --- | --- | --- |
| S9 · Persistencia | Usar modelos actuales y transacciones reales; sin fixtures en indicadores operativos. Probar guardado, recarga, edición concurrente y aislamiento. | Base implementada; ampliar la cobertura por circuito. |
| S10 · Roles | Administradores, dirección, compras, capataces y operarios según permisos reales. Inversores/clientes externos sólo ven información publicada de su unidad/obra. | Base de control implementada; no equiparar membresía de plataforma con participante de WhatsApp. |
| S11.A1 · Preparación del tenant | Nombre del asistente, número dedicado/app existente/proveedor existente, primera obra y circuitos deseados. Persistencia por empresa, revisión, consentimiento, retorno seguro al botón Meta. | Tramo de esta entrega; validar por SHA antes de llamarlo publicado. |
| S11.A2 · Canal de empresa multiobra | Registrar cuenta/número del tenant una sola vez, enlazar obras autorizadas y resolver contexto por participante. Migración expansiva desde el vínculo actual a una obra. | Pendiente; no está implementado por guardar una primera obra. |
| S11.A3 · Alta y recuperación autoservicio | Embedded Signup robusto y sesión durable; coexistencia cuando corresponda; traspaso asistido; expiración/revocación; reanudar sin duplicados. | Flujo dedicado existente + protección de preparación; coexistencia, links de instalación y sesiones durables pendientes. |
| S11.A4 · Equipo | Invitar por enlace/QR seguro, roles y proyectos, alta por propietario, revocación efectiva. El teléfono que escribe no obtiene permisos automáticamente. | Reutilizar onboarding de trabajadores existente; cerrar UX comercial y prueba física. |
| S11.A5 · Agente de construcción | Texto/audio/imagen/video → intención y contexto → propuesta/acción permitida → fuente → resultado/entrega. Handoff humano y conocimiento privado. | Recepción y módulos base existen; cerrar interpretación, herramientas y pruebas por formato. |
| S11.A6 · Operación de SaaS | Métricas por tenant, límites, retención, exportación, desconexión, salud del canal, facturación de uso y soporte. | Implementación incremental; no vender SLA de cientos de empresas sin medir. |
| S12 · Fiscal y abastecimiento | CAE y tipos documentales correctamente separados; compras/recepción/stock/costo trazables. Regla fiscal respaldada por fuente vigente. | Conservar módulos reales y verificar integraciones externas antes de declararlas oficiales. |
| S13 · Cobros | Suscripción SaaS separada de pagos/anticipos/cuotas de cada obra; conciliación y permisos. | Pendiente cierre comercial completo; no activar cobros por configurar WhatsApp. |
| S14 · Offline y móvil | Cola por identidad/tenant/obra con idempotencia, expiración, conflictos y archivos privados; pruebas en Android/iPhone y red de obra. | El fallback PWA no acredita operación offline completa. |

## 6. Experiencia objetivo para el cliente
Entrar a su empresa → elegir primera obra y asistente → «Conectar WhatsApp» → autorizar cuenta y número en Meta → volver a ObraSaaS con estado confirmado → incorporar empleados → probar un parte → habilitar los circuitos listos.

La interfaz separa «preparado», «autorizado», «mensaje recibido», «respuesta entregada» y «agente habilitado». No se usan porcentajes ficticios para rellenar la activación. El contenido sensible del negocio no viaja en URLs, logs ni herramientas de soporte no autorizadas.

Para un estudio que ya usa WhatsApp Business, ofrecer coexistencia antes que exigir abandonar la app. Mientras no esté habilitada y verificada, guardar la intención y explicar el próximo paso; no ejecutar el camino dedicado que pudiera modificar el canal existente. Para una empresa con otro proveedor, un traspaso planificado preserva continuidad, capacidad de revertir y propiedad de los activos.

## 7. Propiedad y modelo de dominio objetivo
El diseño está detallado en `docs/recovery/tenant-owned-whatsapp-architecture.md`. Usar un registro de conexiones por empresa y un vínculo explícito de obras; no duplicar secretos por proyecto. Mantener la identidad del proveedor/aplicación y del producto que recibe cada evento. Varias empresas pueden compartir infraestructura técnica, no un único número ni credenciales de cliente.

Conectar un número no autoriza a cada persona que lo conoce. El mismo remitente puede participar en distintas empresas y obras: se identifica dentro del canal de destino y sólo se muestran sus membresías vigentes. Ninguna selección textual del usuario o inferencia de la IA puede reemplazar una comprobación del servidor.

Los registros históricos conservan su tenant y obra de origen aunque luego cambie la obra activa de una conversación. Una foto recibida, un audio transcrito o una propuesta aprobada no se convierten por sí solos en certificación de avance físico ni autorización de pago.

## 8. Criterios de aceptación de cada entrega
Cada acción debe tener origen, tenant/obra, permisos, versión, estado inicial, validación, confirmación, efecto comprobado, recuperación y auditoría. Los estados cargando/sin datos/no autorizado/conflicto/respuesta incierta deben ser distinguibles. Un webhook aceptado no equivale a una acción completada; un envío aceptado no equivale a entrega.

Pruebas mínimas: guardado y recarga, intento idéntico sin duplicados, rechazo de otro tenant/obra, miembro revocado, cambios concurrentes, cierre de pestaña con trabajo sin guardar, red interrumpida, ausencia de datos y errores que no expongan secretos. En las integraciones de Meta: rechazo antes del proveedor cuando el contexto es inválido y segunda verificación transaccional antes de guardar una conexión.

Para multiobra: mismo nombre de tarea en dos obras, remitente presente en dos empresas, selección de obra y cambio de contexto mientras hay trabajo en cola. Para IA: evidencia insuficiente, inyección de instrucciones en mensajes/documentos y respuestas que no deben revelar datos ajenos. Para pagos y certificados: usar los contratos exactos del módulo, no atajos por chat.

## 9. Operación, costes y comercialización
Preferir el camino directo ya existente de Meta sin agregar un BSP por defecto. Medir costo total de mensajería/IA/archivos/infraestructura/soporte por tenant antes de prometer precios. Un adaptador opcional de proveedor permite incorporar ventajas de coexistencia, facturación o operación cuando compense su costo.

La administración del tenant ve consumo, límites y estados de su propio servicio. La plataforma ve salud y soporte con acceso auditado, no privilegios invisibles sobre el contenido de todos los clientes. Versionar políticas del agente, conservar recibos de ejecución y ofrecer exportación/desconexión con límites de retención explícitos.

No ofrecer mensajería ilimitada ni tiempos de activación garantizados sin medir los requisitos externos. No confundir Tech Provider con habilitación de crédito/facturación en nombre del cliente. Los costes y tarifas externas se consultan en fuentes vigentes al definir planes.

## 10. Publicación y continuidad
Build primero, commit después. Ejecutar suite, lint de afectados, pruebas de navegador/DB relevantes y `npm run build`. Registrar SHA, entorno y resultado, y usar un despliegue agrupado. Mantener Dark Obsidian, español de Argentina y rutas operativas. No convertir restricciones de permisos en HTTP 200 ficticios para cumplir el antiguo listado de rutas.

No introducir secretos en el repo o documentos de traspaso. No forzar un merge a master ni promover Preview saltando la identidad de base/configuración Production. El preflight de release, autorización de migración por SHA y respaldos vigentes se mantienen. Un experimento del navegador con HTTP sintético debe etiquetarse como tal y no presentarse como onboarding físico de Meta o de una constructora real.

Este turno incorpora la preparación por empresa y su validación conectada al flujo de autorización existente. Los campos del nombre/circuitos son configuración preparatoria: no activan runtime IA ni empleados por guardarse. No hay migración de WhatsAppConnection a cuenta multiobra en esta entrega. Consultar el PR y `docs/recovery/HANDOFF_TENANT_WHATSAPP.md` para la evidencia final.

## 11. Prompt de traspaso para Codex, Claude u otro agente
«Trabajás en ObraSaaS, repo inguillen87/obrasaas. Leé AGENTS.md, este plan v3, el ADR tenant-owned-whatsapp-architecture y el handoff. La decisión aprobada es número/cuenta de WhatsApp autorizados por cada tenant, empleados con permisos y obras separadas; no una bandeja común en el número comercial. El agente corre en el backend. El control técnico puede ser común, los datos y autorizaciones no. Antes de modificar, verificá git status, SHA, rama, esquema y últimas pruebas. No des por hecho que el v2.4 o el walkthrough prueban el estado productivo. No toques ChatBoc ni muevas activos Meta entre productos sin un procedimiento autorizado y verificado. Conservá lo implementado, explicá los límites actuales y cerrá un circuito con pruebas, build y evidencia por entorno. La prioridad pendiente es migración expansiva al registro de canales por tenant y enrutamiento multiobra, junto a sesión durable de alta/recuperación y prueba real del canal; no más pantallas sin backend.»
