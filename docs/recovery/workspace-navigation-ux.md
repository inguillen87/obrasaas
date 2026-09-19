# Navegación de trabajo y Campo móvil

## Entrega
Buscador de secciones por nombre o actividad desde el menú, el encabezado móvil y Ctrl/Cmd+K. El catálogo se construye a partir de los accesos permitidos por el modelo de sesión; no consulta documentos, mensajes, contactos ni datos de otros proyectos. Soporta búsqueda sin tildes, varias palabras, vacío explicativo y navegación con teclado. No incorpora proveedores ni dependencias nuevas.

El buscador utiliza un diálogo modal, foco inicial en búsqueda, recorrido con flechas, contención de Tab, cierre con Escape y devolución del foco. La consulta se mantiene sólo en memoria, sin almacenamiento ni telemetría de términos. Los enlaces conservan la autorización de servidor existente; filtrar el menú no sustituye el control de acceso. No se hace prefetch masivo de los resultados.

Campo móvil conserva el circuito DailyLog existente. Incorpora cabecera contextual, acceso directo al formulario, selección de avance/faltante/incidencia/mejora mediante tarjetas con radios nativos y una secuencia visible de registrar, enviar a revisión y decidir. Los estados no son métricas de cumplimiento ni aprobaciones automáticas.

## Continuidad del trabajo
Los editores de Campo móvil e Inspecciones anuncian cambios pendientes y operaciones en curso al navegador de secciones y al selector de obra. Cancelar conserva el formulario y el proyecto; una operación en curso bloquea esa navegación. El comportamiento se suma a los avisos y protecciones ya existentes. No se afirma cobertura global de todos los formularios, del cambio de organización de Clerk ni del historial Atrás/Adelante del navegador.

## Verificación
Pruebas unitarias: filtrado estricto de accesos, sinónimos, acentos, términos múltiples, rutas inválidas, duplicados, navegación de privacidad y decisiones de salida.
`scripts/verify-workspace-ux.mjs` monta los componentes de cliente reales en un entorno HTTP local sintético: props de prueba, adaptador Link y respuesta de parte simulada. Comprueba búsqueda, ausencia de un acceso denegado, Escape con texto ingresado, foco/Tab, descarte cancelado, cambio de obra cancelado y envío de un único parte de ensayo. Comprueba reflow de Campo móvil y límites del diálogo a 320, 390, 768 y 1280 píxeles. No equivale a autorización del servidor, Safari físico ni a una certificación WCAG.

Las capturas sintéticas y resultados se escriben sólo bajo .vercel, fuera de Git. La verificación publicada debe documentarse por separado con revisión, entorno y pruebas realmente ejecutadas.

## Alcance preservado
Sin migraciones, cambios de credenciales, mensajes externos, pagos ni cambio de planes. Sólo rama de recuperación y preview; no se sustituye master. La integración bidireccional de WhatsApp, la carga física de fotos y el offline completo siguen siendo trabajos separados, no resultados de esta entrega.

Referencias técnicas: documentación local del Next.js instalado; https://nextjs.org/docs/app/api-reference/components/link; https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/.
