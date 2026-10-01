# Operación integral de una obra: corte del 1 de octubre de 2026

Base: master `2e6edee85726231b25cb845b7884bd100741ef5f`. Este corte usa las tablas productivas existentes de ObraSaaS. No modifica MuniControl, el número demo, la app/WABA actuales ni sus tokens. No sustituye el esquema vivo por el esquema enterprise.

## Recorrido integrado

1. El administrador crea empresa, obra y tareas desde su cuenta. Registra el equipo, invita una cuenta nueva con correo verificado o asigna explícitamente una cuenta vigente a otra obra. Gestiona roles de dirección, encargado, finanzas y auditoría con revisión de identidad y recibo. No puede modificar su propio rol ni el del administrador. La ficha por teléfono no concede acceso; revocar el acceso de campo no elimina permisos independientes de oficina.
2. La persona acepta la invitación mediante Clerk y la aplicación comprueba el correo, la invitación exacta y la pertenencia vigente. Puede presentar documento y fotografía privados con consentimiento. Otro administrador/director revisa ambas imágenes y decide. Revocaciones y nuevas presentaciones invalidan las decisiones anteriores.
3. El responsable configura perímetro, precisión y sectores. El participante activo y aprobado registra entrada, pausa, regreso y salida. Coordenadas inciertas necesitan revisión; el QR identifica sector/configuración, sin certificar presencia física por sí solo.
4. La persona adjunta foto, audio o video privado. El procesamiento conserva archivo y estado durable ante fallos. Foto y audio usan los adaptadores existentes; video requiere revisión humana, sin análisis automático inventado.
5. El avance se propone contra una tarea y su revisión actual. Las cantidades usan las reglas enterprise de decimales exactos. Otra persona autorizada revisa evidencia y decide; sólo esa transacción actualiza la tarea y el Gantt. Fechas y bloqueos independientes se conservan. Recuperar un recibo vuelve a comprobar permisos y devuelve la tarea vigente. Las propuestas vencidas se muestran como tales y se cierran con auditoría al presentar otra válida, sin modificar la tarea.
6. Los pedidos de materiales existentes alimentan una compra básica: proveedor, cantidad, precio exacto, moneda, cotización, decisión y remitos parciales/completos. Se rechaza exceso, remito repetido, recepción sin aprobación y cierre genérico que eluda una compra activa. Cancelar conserva lo recibido. No se registran pagos ni un libro de existencias inexistente.
7. Pendientes y actividad muestra accesos canónicos vigentes, identidad, fichajes, evidencia, propuestas, compras e incidencias pendientes y los últimos recibos, siempre dentro de empresa/obra. No expone credenciales ni imágenes privadas.

La cuenta conserva el intento en curso y bloquea el cambio de obra mientras debe comprobarse su recibo. Las APIs exigen la sesión firmada y vuelven a autorizar cada operación. Las respuestas privadas no se almacenan en caché.

## WhatsApp de cada cliente

La preparación de la constructora sigue siendo independiente del teléfono. Embedded Signup registra cada transición y aísla autorización, WABA y número por cliente. El token se cifra con AAD de empresa/obra/recurso; no hay fallback a la demo. Un código OAuth consumido no se intercambia de nuevo a ciegas. Se recupera la credencial guardada o se exige una autorización nueva explícita.

El callback específico comprueba la firma del cuerpo original y persiste el inbox cifrado antes del ACK. Los duplicados toleran distinto orden de claves JSON y rechazan contenido conflictivo. El administrador/director puede revisar el inbox privado mediante una reserva durable, recibo y recuperación ante respuesta perdida. La clasificación reutiliza contratos enterprise; la coincidencia de teléfono es una observación y no una identidad de canal verificada. Mientras falte esa vinculación, el texto recibido no crea fichajes, avances ni decisiones automáticas. La solicitud de plantillas reutiliza la política enterprise: textos deterministas revisados, reserva durable y consulta tras respuesta incierta, sin segunda creación automática ni aprobación inferida.

La habilitación depende de configuración efectiva y permisos del proveedor, secreto de la app, verificación dedicada del callback y gate de lanzamiento. El nuevo número, OTP, registro, entrega/recepción y aprobación de plantillas de su WABA requieren pruebas reales. Exportar `[SENSITIVE]` desde Vercel no permite inspeccionar el valor real ni justifica rotarlo.

## Verificación y límites

Las pruebas ejecutables cubren contratos HTTP/políticas, PostgreSQL real desechable, concurrencia, aislamiento de dos empresas, permisos/revocación, rollback de auditoría, pérdida de respuesta después del commit, idempotencia y recuperación. Los componentes reales se ensayan con APIs controladas a 320, 390, 768 y 1280 px, incluyendo errores y conservación de datos. Se revisan capturas, desbordamiento y errores del navegador. Los workflows `Production access boundary` y `Authorized workspace acceptance` ejecutan las comprobaciones antes de integrar.

Pruebas locales controladas no acreditan correo entregado, identidad civil, ubicación física, cámara QR en teléfono, análisis de una grabación real ni conexión Meta de una empresa externa. El PR documenta runs y deployment/SHA. La aceptación humana permanece sin verificar hasta ejecutar el circuito con participantes autorizados y guardar sus resultados.

Detalles: [participantes/KYC](participant-access-and-private-kyc.md), [jornada/evidencia/avance](field-operations.md), [Embedded Signup](../meta-customer-onboarding.md).
