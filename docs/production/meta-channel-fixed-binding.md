# Canal Meta fijo para el piloto ObraSaaS

El usuario pidió conservar la app, el número de prueba y la credencial existente. No crear otra app, WABA o número para cada ensayo, no rotar tokens como respuesta al error 131030 y no introducir tokens en código.

Identidad del canal previamente cotejada con Meta:
- App ObraSaaS: `1665088767899217`.
- WABA de prueba: `2046153882937995`.
- Phone Number ID: `1225843560610854`.
- Test Number: `+1 555-153-3706`.

`meta-channel-binding.mjs` fija esos identificadores públicos. El transporte y la validación de ámbito del webhook comparan la configuración Production contra ellos antes de usarla. Una discrepancia o alias contradictorio se rechaza; no se elige un activo alternativo. Los tests/preview con fixtures sintéticos quedan separados.

La referencia a la credencial permanece donde estaba: variables privadas existentes de Vercel. No se alteran nombres, valores ni targets de secretos, ni se agrega una credencial al repositorio. El control no pretende comprobar la vigencia del token: sólo la identidad del canal. Tampoco convierte un token temporal en uno sin vencimiento.

Access token, App Secret y Verify Token cumplen funciones distintas. Conservar el token de envío no reemplaza la firma HMAC para recepción. La última aceptación real informó acceso API válido, pero receptor rechazado con 131030 y firma de recepción no configurada; este guard no declara resueltos esos dos hechos. La hipótesis argentina 549/54 requiere cotejo con el destinatario exacto verificado en Meta, sin cambios masivos ni reintentos automáticos a variantes.

No se alteran roles, KYC, fichajes, Gantt, migraciones o los registros de obra en esta entrega. La entrega no declara completo el MVP ni reemplaza su prueba desde teléfonos reales. Las pruebas nuevas verifican identidad fija, ausencia de rotación, compatibilidad de aliases coincidentes, rechazo de conflictos, y bloqueo antes de llamadas al proveedor o aceptación de eventos fuera de ámbito.

## Destinatario argentino comprobado en el panel
En la sesión autorizada de Meta, el destinatario del titular SÍ aparecía en la lista y estaba seleccionado. El panel mostraba el formato internacional +54-9-... pero el comando generado usaba el formato argentino con prefijo local 15 después del código de área. El token temporal de esa pantalla estaba sin generar; NO se generó otro ni se sustituyó el token residente de Vercel.

Usando exactamente el destinatario generado por el panel y el token existente de Production, el despliegue de ensayo `dpl_9mZoGRrnRvJs42t2LJ2MWiSsMmuH` (5982244) obtuvo HTTP200 y un wamid real para UN hello_world/en_US. La evidencia acredita aceptación por Meta, no entrega física ni recepción de un callback en nuestra aplicación. Esto sustituye la hipótesis anterior de que el titular no estaba añadido: faltaba respetar el identificador de envío de ese destinatario de pruebas.

`META_TEST_RECIPIENT_BINDINGS` contiene la correspondencia explícita waId/apiTo en variables privadas del proyecto, junto con el modo test y la lista de destinatarios autorizados. No se incluyen teléfonos personales ni tokens en el código de la tabla de correspondencias. `meta-test-recipient-binding.mjs` limita cada entrada a la misma numeración argentina, al canal fijado y a configuraciones sin duplicados. No es una regla que quite/agregue dígitos automáticamente a todos los números.

La aplicación conserva el wa_id original para identidad, permisos y recepción. Sólo transforma el destinatario HTTP de una fila revisada. Al aceptar Meta un envío, exige que contacts[0].wa_id confirme esa identidad. Si el mensaje fue aceptado pero esa comprobación falta o difiere, conserva el wamid para investigar, declara éxito falso y resultado de destinatario sin confirmar: no reenvía. La aceptación de Meta se mantiene diferenciada de delivered/read.

El token META_WHATSAPP_ACCESS_TOKEN existente no se rota, no se regenera ni se migra a otro producto. Que un valor se conserve no acredita que su vigencia sea infinita. El mismo principio se aplica a la firma de recepción: reutilizar el App Secret de ObraSaaS no implica que exista ya una prueba física de HMAC y procesamiento de obra.
