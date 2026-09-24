# S11.A24 — Seguimiento con sesión real y PostgreSQL: aceptación comprobada

Base funcional: `b8fd545c582840559a4a00e4ab2d151bfaaf9600` (A23).
Código de aceptación comprobado: `bbdbd1e542fb19271e9f9d64e0a405c846293d36`.
Árbol: `11f7111328b4cd1e6d930372e3628005c4217626`.

## Brecha cerrada
A22/A23 tenían navegador con identidad controlada y pruebas SQL separadas. A24 ejecuta el seguimiento con sesiones reales de Clerk Development, las rutas de aplicación sin sustituir y PostgreSQL 17 desechable en el mismo recorrido.

El job `107865757448` del run `36069145046` terminó success: S9.2 (que llama al nuevo journey), S9.3 y S10-CERT completaron correctamente. El entorno de ensayo fue aprobado explícitamente por delegación del propietario, sin cambiar revisores, reglas, roles o secretos. Este resultado pertenece a bbdbd1e; un release posterior debe comprobar su propia ejecución.

## Escenarios ejecutados por el journey
1. El administrador consulta 26 mensajes y sesiones persistidos, en páginas de 20 y 6, sin un canal WhatsApp de envío. Se verifican correlación, privacidad, respuesta, incertidumbre y decisión manual.
2. Otra empresa, contexto falsificado, cursor ajeno y cliente anónimo no reciben el historial; la conversación propia de la otra empresa continúa accesible. Un nombre igual no sustituye la identidad.
3. La bandeja móvil carga, filtra sin petición adicional, pagina y recupera los registros al recargar. No se emiten POST de formularios.
4. El cierre real de la sesión del director impide nuevas lecturas; otra sesión autorizada sigue consultando. Esto verifica sign-out, no revocación administrativa de una membresía.

Al final se comparan mensajes, sesiones y cantidad de auditorías. La prueba se ejecuta al terminar S9.2/S11, sin mocks de autenticación o respuestas HTTP. El éxito del paso S9.2 y su llamada obligatoria en el código acreditan el recorrido; no se afirma haber extraído un artefacto detallado del job autenticado en esta intervención.

## Aislamiento de la preparación
El helper exige aceptación explícita de ensayo, host y socket loopback, puerto coincidente, nombre exacto `obrasaas_e2e`, ámbitos sintéticos conocidos y ausencia de conexión de envío. La inserción es transaccional y no ignora colisiones. No crea identidades Clerk nuevas ni necesita credenciales de Meta.

Mensajes, teléfonos, referencias y estados son datos artificiales. Una sesión de autenticación real no transforma esos datos en una entrega física. Trace, vídeo y capturas permanecen desactivados en los proyectos Playwright autenticados.

## Correcciones y evidencia conservada
El primer intento (`36048781225`, 5b51a87) falló antes de los escenarios nuevos por usar `Conversation.lastMessageAt`, columna inexistente. Se corrigió el INSERT en e2fe6b8.

El segundo (`36049403410`, e2fe6b8) se detuvo por omitir `WhatsAppFlowSession.updatedAt` en SQL directo. bbdbd1e suministra ese timestamp y comprueba los INSERT contra los modelos actuales para detectar nombres inexistentes y valores @updatedAt omitidos. También exige el rechazo exacto del cursor ajeno: 400 + WHATSAPP_FLOW_HISTORY_CURSOR_INVALID, sin cambiar el contrato del servidor.

No se retiraron constraints ni controles de aislamiento. La suite local documentada para bbdbd1e completó 4.197 pruebas sin fallos u omisiones, incluidos 16 casos focales; lint y build completo aprobaron. CI del push `36069145046`, PR `36069147891` y las cuatro suites SQL de `36069147901` terminaron success en intento 1 para ese SHA. El job autenticado del PR se omite por diseño y no se cuenta dos veces.

La lectura de logs detallados del job autenticado fue bloqueada por la herramienta. La confirmación utiliza el estado final y pasos de GitHub, comprobados independientemente; no se declara descargado ni inspeccionado un log que no pudo leerse.

## Ensayo independiente: fallo no diagnosticado
El harness auxiliar `operations/auth-history-fixture-check-20260924`, commit 02deebb21ae08db17a712afa09f3af13aaac2809, tiene resultado failure en el run `36069414112`. Se observó el estado, pero la herramienta bloqueó la lectura de su diagnóstico. No se afirma que sus seis casos aprobaran ni se conoce la causa.

Ese harness temporal no está incluido en la rama de producto y no sustituye ni cancela la evidencia del journey autenticado real: este último ejecutó el helper actual y las rutas con PostgreSQL y aprobó. El fallo auxiliar queda pendiente de análisis, sin debilitar su prueba ni reejecutarlo para ocultarlo.

## Publicación y continuidad
La entrega de cierre publica esta guía y el handoff; no modifica el código de aplicación validado. El SHA final, estado Vercel y comprobaciones del deployment se registran en el PR después de ejecutarlas. No se traslada automáticamente la aprobación de bbdbd1e a una ejecución nueva.

Siguientes controles de producto: correlación exacta desde la respuesta al registro de negocio con permisos; autorización oficial del piloto y operación bidireccional con participante autorizado; configuración efectiva, identidad y respaldo de base antes de Production.

No se agregan endpoints, modelos, dependencias o permisos. No se renuevan credenciales, envían mensajes reales ni modifica tráfico productivo como parte de esta aceptación. El borrador local anterior se preservó fuera del worktree; no se descartó su contenido.
