# S11.A6 — Vigencia de la autorización y recuperación del mismo canal

Base revisada: b189ab5bc54df9a3ab7b6089657b3432b87ff376. Continúa el Sprint 11 del plan y preserva los números propios por obra, la preparación del tenant, el alta de participantes y el menú nativo de campo existentes.

## Mejora entregada
Integraciones incorpora «Vigencia y recuperación de WhatsApp». Muestra fecha de vencimiento informada, fecha de la última verificación con Meta y una acción según el estado: comprobar la autorización o preparar la reautorización del mismo canal. Una credencial vencida o rechazada no se presenta como operativa sólo porque la fila conserve CONNECTED. Una autorización sin fecha no se denomina permanente.

La recuperación conduce al formulario guiado que ya existe: no crea otra organización, no importa otro número ni inicia OAuth automáticamente. Preparar el formulario no llama a Meta. El administrador conserva el consentimiento explícito y todas las comprobaciones de preparación, empresa/obra y revisión del endpoint de Embedded Signup. Las variantes Business App/proveedor existente continúan bajo sus restricciones actuales; no se convierten silenciosamente al flujo dedicado.

## Lectura acotada y aislamiento
GET /api/integrations/whatsapp/lifecycle exige permiso de integraciones en modo lectura y compara ambas cabeceras de contexto con la sesión. No admite destinos por query. La consulta se limita a la obra y organización autorizadas y devuelve únicamente estados y fechas; no incluye tokens cifrados/claros, identificadores de Meta, nombres de personas ni errores crudos del proveedor. La ausencia de conexión no busca otra cuenta por defecto. Las respuestas son private/no-store.

Es un endpoint de lectura de datos existentes. No descifra, verifica credenciales contra Meta, renueva autorizaciones, registra empleados, migra tablas ni envía mensajes. El botón «Verificar con Meta» delega al endpoint de verificación previo, con decisión explícita. No se alteró la política de envíos ni el control de salud del backend por implementar esta lectura.

## Tiempo y recuperación
Se advierte el vencimiento cuando la fecha informada está dentro de las próximas 24 horas. La caducidad es inclusiva: la autorización se considera vencida al alcanzar esa fecha. Se conserva el intervalo de 15 minutos de la verificación remota existente; superarlo ofrece volver a comprobar, no pedir otra clave de app.

Mientras Integraciones está visible y en línea, se consulta cada 60 segundos. Un reloj local avanza desde la hora observada por el servidor usando tiempo monotónico; permite advertir el vencimiento sin esperar una recarga ni otra consulta. Las fechas de inicio del equipo no se utilizan para conceder vigencia. El endpoint y el backend siguen siendo la autoridad; este reloj es una restricción adicional de interfaz, no un mecanismo de seguridad de servidor.

Los estados ambiguos, caducados o sin lectura confirmada no habilitan acciones de Flows/plantillas. Una lectura fallida conserva la preparación y el PIN en el formulario existente; no los guarda en almacenamiento local ni los transmite al endpoint de estado. Una respuesta de otra obra o acceso revocado bloquea la recuperación desde esa instancia y pide recargar; no cambia el destino automáticamente.

El nombre CURRENT significa verificación de credencial reciente, no garantía de canal operativo, entrega de mensaje, respuesta de IA o finalización de tarea. `providerVerifiedByThisRead` permanece false. Un aviso visible no es una notificación proactiva: no se agregan email, cron ni WhatsApp saliente.

## Validación y límites
Tests puros: instante de vencimiento, aviso 24 h, antigüedad de verificación, valores malformados, snapshot legacy frente a uno nuevo, ausencia de vencimiento, no mutación/no exposición y comparación estricta de empresa/obra. Tests del handler: permiso, contexto, consulta acotada, errores privados y sólo lectura. Contratos de integración: se mantiene el formulario actual y las guardas de Graph; no se reemplaza el control del servidor por el panel.

`scripts/verify-channel-recovery-ui.mjs` monta el panel nuevo y el componente guiado existente con un host y HTTP controlados. Comprueba vencimiento sin recarga y sin GET adicional, acción de recuperación, autorización sólo con clic explícito, conservación del formulario, fallo temporal, contexto ajeno, respuesta incompleta y adaptación a 320/390/768/1280 px. No inicia un consentimiento Meta real ni utiliza números/personas reales.

El proceso CI debe ejecutar suite completa, lint, build y verificador de navegador antes de integrar. Su resultado, SHA y entorno se registran en el PR #1. El despliegue y la prueba física siguen como evidencias separadas. No se desactivan los prerrequisitos de Production ni la autorización de migración para publicar este cambio.

Referencias: código existente de channel-health y Embedded Signup; documentación oficial de implementación de Meta: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation . La consulta de esa página devolvió 429 en esta sesión; no se atribuyen a ella capacidades nuevas ni se modifica su protocolo de consentimiento en esta entrega.
