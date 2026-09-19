# Piloto: empresa real y validación de credenciales

## Comprobación ejecutada
El titular completó la configuración de slugs en Clerk y el alta. Se verificó en PostgreSQL la organización «Empresa piloto ObraSaaS», la obra «Obra piloto - Marcelo y Victoria», una membresía activa y el trial vigente. No se repitió el alta ni se copió la demo interna.

Se seleccionaron esos destinos y el único activo permitido de Meta en el importador publicado. Una consulta real a Graph comprobó el teléfono y su pertenencia a la WABA. La solicitud de importación se ejecutó una vez desde la sesión autenticada.

El backend devolvió PILOT_IMPORT_VALIDATION_FAILED. El log estructurado identificó META_PILOT_TOKEN_EXPIRY_REQUIRED: la validación inicial del token pasó, pero el importador no obtuvo un vencimiento temporal admitido. No es el error anterior de Clerk ni requiere regenerar el secreto de la app. La reserva permaneció PENDING y deshabilitada, sin credencial cifrada persistida ni conexión activa.

## Corrección del diagnóstico
La API mantiene el código público existente y agrega diagnosticCode sólo para seis rechazos locales conocidos de MetaIntegrationError con status 403: vigencia temporal ausente, token vencido, vigencia insuficiente, app no validada, permisos insuficientes y teléfono fuera de la cuenta. Los demás errores siguen usando la respuesta genérica existente.

El cliente reconstruye el mensaje desde el mismo vocabulario cerrado. No refleja textos, tokens, URLs o detalles internos recibidos del proveedor. Una causa que exige corregir datos deshabilita el reenvío idéntico hasta editar el formulario y confirmar nuevamente. Una interrupción incierta conserva la misma clave y contenido del reintento, sin reintentos automáticos nuevos.

No se cambian validación de vencimiento, permisos, allowlist, reservas, exclusión mutua, idempotencia o cifrado. No se habilita una reserva pendiente directamente por SQL. La mejora explica el rechazo; no acredita recepción ni respuesta real de WhatsApp.

## Acción de credencial y límite
Se utilizó Generar token en el panel de pruebas de la app autorizada. La herramienta bloqueó la lectura y traslado de la credencial recién generada; ese traslado no se completó ni se buscó otro canal para eludirlo. Su importación requiere pegarla directamente en el formulario de la plataforma. No se afirma que ese nuevo token tenga vencimiento válido hasta que el backend lo compruebe.

Las claves no se incorporan al repositorio o documentación. Los archivos auxiliares de diagnóstico quedan fuera del conjunto de archivos a integrar. No se enviaron mensajes a terceros ni se registraron trabajadores.

## Arquitectura comercial recomendada, todavía no implementada por esta entrega
Separar el número comercial de ObraSaaS para ventas, alta, soporte y cobro SaaS de los canales operativos de los clientes. Para constructoras, recomendar cuenta WhatsApp Business y número propios conectados mediante Embedded Signup, conservando la identidad comercial, los permisos y el consumo por tenant. Meta presenta Embedded Signup como mecanismo de onboarding de clientes para Tech Providers: https://business.whatsapp.com/partners/become-a-partner/ (consulta pública 19/09/2026).

Un número compartido operado por ObraSaaS puede evaluarse para estudios pequeños, siempre presentado como asistente de la plataforma y con selección explícita de empresa/obra, membresías verificadas y contexto de conversación con vencimiento. No debe inferir el tenant de un texto o confiar sólo en el teléfono del remitente: una misma persona puede trabajar para varias empresas.

La implementación actual del canal vincula un phoneNumberId a un projectId único. Atender varias obras con un número de una empresa necesita una evolución del modelo y del enrutamiento; no está resuelto por crear nuevos tenants ni por este diagnóstico. Se mantienen las restricciones existentes hasta diseñar y probar esa evolución. Una SIM nueva no corrige por sí sola estas reglas de identidad y atribución.

## Verificación reproducible
Pruebas del vocabulario cerrado, compatibilidad del error anterior, no reflexión de secretos y handler real con dependencia de Meta controlada. scripts/verify-pilot-import-diagnostics-ui.mjs usa el formulario real con HTTP sintético: rechazo conocido, reenvío bloqueado sin corregir, credencial en campo password, reconfirmación tras editar, limpieza tras éxito y reintento idéntico para fallos inciertos; anchos 320/390/768/1280 px. No sustituye una importación física aprobada por Meta. La suite completa, lint, build y estado de despliegue se registran en el PR.
