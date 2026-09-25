# S11.A34 — Seguimiento separado del redactor

Base: `81b3e2da653f360759602006d9889293fd16f22c`. La entrega organiza la lectura de formularios en un panel propio de la conversación; no añade endpoints ni funciones de envío.

## Circuito de usuario
Desde la cabecera de la conversación, «Seguimiento» abre un panel y consulta la primera página del historial autorizado. Es una sola acción explícita, no una consulta disparada al entrar a la bandeja. En escritorio aparece lateralmente; en móvil ocupa la pantalla, con cabecera y retorno siempre accesibles y un solo desplazamiento para la lectura.

La cabecera mantiene visibles el contacto y la obra. Se reutilizan el lector, búsqueda, filtros, orden, paginación y vínculos a respuesta/asistencia/incidencia de las fases anteriores. Sus conteos siguen limitados a la página consultada. «Volver a la conversación» cierra el panel y devuelve el foco al control que lo abrió.

El redactor y el lanzador de formularios permanecen montados fuera del panel. Consultar no cambia el texto del borrador, consentimientos o intentos pendientes de envío. Una respuesta de envío que llega mientras el panel está abierto pertenece a su conversación original, no al historial de lectura.

## Cierre, errores y cambios de contexto
Cerrar descarta las observaciones y aborta la consulta; volver a abrir pide una primera página nueva. Una respuesta tardía no reabre ni repuebla el panel. Un fallo de lectura permite consultar nuevamente; una denegación mantiene bloqueada la lectura sin impedir el cierre.

Cambiar empresa, obra, conversación o disponibilidad de red desmonta el panel. Reconectar no lo reabre ni consulta formularios automáticamente. La bandeja puede continuar sus refrescos anteriores de conversaciones/mensajes: esta entrega sólo evita lecturas automáticas del seguimiento. Los borradores conservan las reglas existentes de aislamiento y no se trasladan a otro tenant.

## Accesibilidad e integración
El panel usa dialog modal nativo, foco inicial en el título y navegación Tab/Shift+Tab contenida entre controles visibles/habilitados. Escape desde la búsqueda limpia primero sus términos; Escape sin términos cierra el panel. Enter sigue sin enviar ni propagar una respuesta desde la búsqueda.

El fondo queda inerte mientras se consulta. Se bloquea/restaura su desplazamiento al abrir/cerrar, desmontar o cambiar conectividad. Ni el diálogo ni el historial se anidan en el formulario de mensajes. La variante inline del lector permanece para los verificadores/consumidores existentes; el arranque expandido se usa sólo cuando el panel se monta tras una acción del usuario.

Referencia de diseño de accesibilidad: patrón Dialog (Modal) de WAI-ARIA APG, https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ . No se declara una auditoría de accesibilidad completa por cumplir estos casos.

## Verificación
Se amplía `verify-inbox-continuity-ui.mjs`: monta InboxClient completo con HTTP/identidad controlados, no un panel aislado. Comprueba lectura única, contacto/obra, foco, teclado, paginación, cierre durante la consulta, error/denegación/contexto ajeno, cambio de ámbito y red offline simulada en el contexto del navegador. Verifica continuidad del borrador, envío pendiente y resultado incierto junto a los escenarios anteriores del redactor. Todas las consultas del panel son GET; los tres POST capturados del verificador pertenecen a sus envíos sintéticos anteriores.

El nuevo bloque se incorpora al CI permanente. Los journeys S11-HISTORY/ATTENDANCE/INCIDENT siguen recorriendo sus registros reales de PostgreSQL desechable mediante la nueva entrada. S11-HISTORY añade apertura, foco, cierre y reapertura fresca fuera del redactor. Se preservan permisos, paginación, privacidad, lectura del origen y sign-out.

La primera prueba focal encontró salida del foco en el extremo de la tabulación; se añadió el ciclo explícito sin sustituir la modalidad nativa. La comprobación de red usa `BrowserContext.setOffline`, porque despachar un evento sin cambiar navigator.onLine no ejercitaba el código real. No se bajaron restricciones del servidor.

Resultados de build, CI autenticado y deployment se registran por SHA en PR #1. Los ensayos no acreditan transporte Meta, credenciales vigentes ni una interrupción física del dispositivo. Sin nuevas dependencias, migraciones, roles o promoción a Production. Dispatcher y piloto físico siguen con sus criterios propios.
