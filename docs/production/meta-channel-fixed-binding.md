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
