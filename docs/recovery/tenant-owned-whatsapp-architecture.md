# ADR — WhatsApp propio por tenant y asistente de organización

Estado: decisión de arquitectura adoptada; implementación incremental. Fecha: 19/09/2026.
Solicitud explícita del propietario del producto: cada cliente autoriza su número, sus empleados le escriben a ese canal y el ecosistema se configura desde ObraSaaS con la mínima intervención técnica del cliente.

## Aclaración v3.1 — prioridad confirmada
El patrón inmediato es un número por obra, autorizado por su constructora; cada empleado utiliza su mismo número y se da de alta en cada ámbito. Compartir un número entre varias obras sigue como opción futura. No se exige el número de soporte de ObraSaaS ni la migración de la sección 5 para operar el patrón por obra. Los detalles de identidad y el cambio de preparación están en `worksite-numbers-and-participant-isolation.md`.

## 1. Decisión y límites
Se separan tres ámbitos: (a) número comercial de ObraSaaS para ventas/soporte; (b) números operativos autorizados por cada tenant; (c) plano técnico compartido que valida y enruta eventos. Un único endpoint técnico verificador puede recibir muchos canales registrados sin que exista un número común para todas las empresas.

El agente vive en el backend y opera mediante herramientas autorizadas. No depende de una sesión de WhatsApp Web del cliente ni de su celular encendido. El uso de «cerebro» significa contexto de empresa y coordinación de funciones, no permiso universal sobre personas, compras, liquidaciones o pagos.

La empresa conserva el control de sus activos de Meta y puede revocar a ObraSaaS. El alta utiliza autorización oficial de Meta. Las condiciones de coexistencia, verificación del negocio/número, revisión de la app y requisitos de facturación se comprueban para el caso real: no se presumen resueltos por ser Tech Provider.

## 2. Investigación externa vs. decisiones propias
**Publicado por Kapso:** cada cliente mantiene su Meta Business Portfolio y WABA; el SaaS crea un cliente, genera un setup link con expiración, recibe el resultado y usa APIs/webhooks. Su documentación separa modos dedicated/coexistence, reconexión de un número existente y facturación customer_managed/partner_managed. Un setup terminado no confirma por sí mismo que la facturación gestionada haya quedado habilitada.

**Publicado por Meta:** Embedded Signup permite incorporar clientes y gestionar cuentas con su autorización; el ecosistema distingue Tech Provider/Tech Partner y Solution Partner. La página de partners reserva compartir una línea de crédito a Solution Partners. La guía indexada de onboarding de usuarios Business App contempla su cuenta/número existentes; parte de la documentación detallada respondió HTTP 429 durante esta consulta.

**Decisión propia de ObraSaaS:** conservar la integración directa ya desarrollada con la app ObraSaaS y adoptar el patrón de alta contextual y gestión centralizada sin contratar ni instalar Kapso en esta fase. Una capa adaptadora podrá incorporar un proveedor externo si costo total, coexistencia, soporte o facturación lo justifican. No prometer que API directa siempre resulte más barata: hay costos operativos además de la tarifa por mensaje.

Fuentes primarias consultadas:
- https://kapso.com/platform
- https://docs.kapso.ai/docs/platform/setup-links/create-and-configure
- https://whatsappbusiness.com/partners/become-a-partner/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
- https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers

## 3. Identidad Meta de ObraSaaS y ChatBoc
Mantener ObraSaaS como aplicación identificable de este producto. El propietario informa Tech Provider en ChatBoc; antes de compartir infraestructura verificar portfolio empresarial, app propietaria, revisión/permisos, configuración de login, dominios, suscripciones y alcance de los tokens. No usar el Facebook personal de Marcelo como autenticación de servicio ni asumir que un permiso de otra app aplica aquí.

No importar activos de otros productos, ni reutilizar WABAs, teléfonos o claves de municipios/clientes ajenos. Una futura capa corporativa común se versionará y tendrá identificación de producto y app; los secretos se guardan en el entorno/vault correspondiente, no en documentos de traspaso ni payloads de frontend.

## 4. Modelo objetivo — todavía no migrado
| Entidad propuesta | Responsabilidad e invariantes |
| --- | --- |
| ProviderApplication | Producto, proveedor y app autenticadora; referencia de credenciales del servicio y capacidades verificadas. Sin usar cuentas personales como runtime. |
| TenantMessagingAccount | Empresa propietaria + WABA + aplicación/proveedor delegado. Impedir que la misma cuenta de negocio termine en tenants distintos sin un procedimiento explícito de transferencia. |
| TenantMessagingChannel | Número/phoneNumberId, cuenta, empresa, estado, cifrado y versión de autorización. Unicidad del destino en el registro operativo; varios canales por empresa admitidos por plan. |
| ChannelProjectBinding | Vínculos activos entre canal y obras del mismo tenant. No almacena otra copia del token. Incluye el alcance y auditoría de cambios. |
| MessagingParticipant | Identidad normalizada del remitente dentro del tenant/canal y vínculo al trabajador/usuario aprobado. La pertenencia a otra empresa no concede acceso aquí. |
| ConversationContext | Canal, participante y contexto de obra elegido; versión y caducidad. No reemplaza el control de permisos en cada acción. |
| IngressEnvelope | Evento validado: app/canal/tenant, identificador de Meta, participante y resolución de obra. Procedencia inmutable para reintentos y evidencia. |
| OnboardingSession | Intención del administrador, tenant, modo, revisión, expiración, nonce y estado de consentimiento. Referencia pública opaca, revocable, de un solo uso según etapa. |
| AgentConfigurationVersion | Nombre/política/herramientas/base documental permitida del asistente. Publicación explícita, versionada y distinta de la preparación comercial. |
| UsageLedger / TenantBudget | Medición y presupuestos de mensajes, IA, transcripción y almacenamiento; contabilización idempotente y alertas por tenant. |

Los nombres son de diseño: no se afirma que estas tablas existan en el schema actual. Reusar o extender las entidades actuales cuando sus invariantes coincidan. No construir dos bandejas o dos libros de obra en paralelo.

## 5. Migración opcional futura hacia un número compartido entre obras
1. Inventariar todas las consultas que usan WhatsAppConnection.projectId: webhooks, bandeja, assets, Flows, invitaciones, recibos, notificaciones, reportes y verificadores SQL. Aprobar un mapa de dependencias antes de cambiar claves.
2. Agregar entidades/vínculos y referencias opcionales con migración expansiva. Crear por cada conexión antigua una pertenencia de tenant y un único vínculo de obra, derivado de la FK existente, no de mensajes o nombres. Revisar duplicados/propiedad antes de activar tráfico.
3. Mantener compatibilidad de lecturas legacy detrás de un adaptador explícito; el registro nuevo es fuente de enrutamiento. Las escrituras duales, cuando sean necesarias, se hacen con transacción y reconciliación verificable, no con dos requests independientes.
4. Resolver eventos nuevos en tenant/canal; preservar sin cambios el tenant/proyecto de eventos históricos y de enlaces/documentos ya emitidos. Probar replay antes y después de cambiar contexto y de revocar un miembro.
5. Ensayar con dos empresas, dos obras por empresa y remitentes que participan en ambas. Habilitar primero una empresa piloto, observar errores/costos y recién ampliar. No mezclar bases de Preview/Production.
6. Retirar el camino legacy sólo después de demostrar paridad, pruebas negativas y una ruta de reversión. La unicidad actual de projectId no se elimina como atajo para reutilizar un número en varias filas.

## 6. Enrutamiento determinista antes de IA
Firma Meta válida → app receptora identificada → número/cuenta en el registro → tenant → participante autorizado → contexto permitido de obra → herramientas del dominio.

Sólo en la futura modalidad de número compartido, si hay varias obras posibles y no existe una selección vigente, mostrar solamente las opciones autorizadas y solicitar elección. Una mención ambigua en el texto no selecciona una empresa. Si el empleado cambia de obra, los mensajes anteriores conservan su origen y los pendientes no se reprocesan dentro de la nueva obra.

Las políticas nunca se toman de archivos o transcripciones aportados por un remitente. La IA puede proponer una clasificación, pero el servidor valida proyecto, rol, estado, versión, cantidad y autorización al ejecutar. Búsqueda documental, cachés, archivos privados y contexto del modelo deben incluir tenant y permisos; no se usa un índice común sin filtro de autorización.

## 7. Alta por botón y por enlace seguro
El flujo dedicado usa Embedded Signup del producto con una preparación guardada y versionada por tenant. Antes de contactar a Meta se verifica que el administrador siga en la empresa/obra correctas; antes de guardar la conexión se revalida que no cambió esa preparación. El código devuelto por Meta se intercambia en servidor, no se exponen claves de la app al navegador.

Evolución a setup links: crear una sesión opaca de corta duración vinculada al tenant y administrador invitado; limitar orígenes y destinos de retorno; comprobar autenticación al abrir; revalidar consentimiento al completar. Guardar sólo un hash del token del enlace y los recibos necesarios; no poner WABA/token/código de autorización en logs, analytics, URLs de retorno o capturas. Retirar el enlace al expirar/revocar/completar. Un secreto de enlace no reemplaza una membresía vigente.

Una respuesta incierta tras intercambio de código requiere reconciliación durable, no reutilizar un código OAuth consumido ni crear otra empresa. Estados de sesión sugeridos: PREPARED, AUTHORIZING, PROVIDER_PENDING, CONNECTED, VERIFICATION_REQUIRED, READY, REAUTH_REQUIRED, CANCELLED, EXPIRED. READY exige comprobar recepción, respuesta y participantes autorizados, no sólo un popup cerrado.

Coexistencia y traspaso de proveedor tienen recorridos propios. No llamar al registro dedicado de un número Business App hasta confirmar el soporte/capacidad adecuados. No desconectar el servicio anterior, borrar credenciales, mover titularidad o cambiar facturación como efecto secundario de elegir una tarjeta.

## 8. Equipo, IA y herramientas de construcción
El administrador incorpora trabajadores y roles con las entidades ya existentes. Invitación/QR expirable y revocable, aceptación del participante y asignación de obras antes de habilitar herramientas. El remitente desconocido queda en atención/no asignado; no recibe información privada por preguntar.

La preparación de circuitos no los activa. El catálogo inicial admite partes/evidencia, solicitudes de material y consultas de cronograma. El runtime deberá evaluar en cada invocación alcance del rol, política publicada del tenant, estado del recurso, límites y consentimiento del procesamiento externo. No existe una herramienta genérica «ejecutar cualquier SQL» para el modelo.

Texto/audio/video/foto se conserva como evidencia con procedencia; transcripción y extracción quedan identificadas como resultados del modelo. Datos ambiguos deben confirmarse. Una cantidad de bolsas visible no equivale a inventario ni una foto aprobada equivale a avance medido. Nómina, compras emitidas, certificaciones y pagos requieren sus aprobaciones específicas; el cliente no puede autorizar implícitamente todo con un solo interruptor «IA».

Handoff humano: responsable, estado, motivo y contexto conservado; suspender la automatización mientras corresponde. El agente debe responder con el registro y efecto confirmado, no con un éxito si sólo se encoló un trabajo. Los estados accepted/sent/delivered/read se distinguen de la finalización de la tarea de negocio.

## 9. Costos y operación de muchos tenants
Separar precio de suscripción SaaS, gasto de Meta, consumo de modelo/transcripción/visión, almacenamiento y costo de soporte. Arrancar con facturación de Meta a cargo de cada cliente cuando corresponda al camino aprobado. Sólo prometer facturación gestionada cuando esté habilitado el acuerdo aplicable. Un perfil Tech Provider no equivale a una línea de crédito concedida.

Controlar cuotas, concurrencia y reintentos por tenant; límites de archivos/duración, presupuesto de IA por periodo, alertas antes de agotar, colas con reparto justo y registro idempotente del consumo. Reutilizar resultados seguros por tenant/versión, evitar llamadas a Meta sólo por abrir secciones y usar plantillas/circuitos predefinidos cuando una ejecución determinista sea suficiente.

Evaluar proveedor opcional mediante costo total y necesidades reales; no reemplazar código propio por un BSP sin medir impacto de comisiones, facturación, elegibilidad y soporte. Tampoco sostener infraestructura propia costosa sólo por evitar una comisión. No se contrató ni instaló Kapso, no se compraron números ni se cambiaron planes en esta fase.

## 10. Pruebas que deben preceder a la comercialización multiobra
A y B con nombres de obra iguales; mismo remitente con roles distintos en ambas; número no registrado; firma inválida; sesión expirada; mezcla de callbacks; consentimiento revocado durante el popup; código consumido; pérdida de respuesta antes/después de persistir; miembro revocado; cambio de obra con tarea pendiente; duplicados y eventos fuera de orden; desconexión con mensajes en cola; budget agotado; restauración/migración. Registrar resultados por flujo, no convertir la cantidad de tests unitarios en una promesa de escala.

El corte de producción requiere configuración própria, credenciales vigentes, respaldo, autorización del SHA/identidad de base, migración ensayada y prueba autenticada del canal. No promover un Preview que apunta a la base piloto como sustituto de Production.
