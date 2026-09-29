# Verificación real de servicios, no sólo configuración

Base de este cierre: f83ee4a6edad90a6e8be58d1b02e22303674203f. El dominio propio `obrasaas.com` y la instancia Clerk Production ya existen; no volver a pedir otro dominio ni presentar su DNS como un login terminado.

## Imágenes privadas
`release:verify-private-storage` se ejecuta sin peticiones por defecto. Sólo se activa con `OBRASAAS_RUN_STORAGE_CHECK=verify-private-storage-v1`, dentro de un build Production del proyecto ObraSaaS, con origen y proveedor esperados. Las credenciales permanecen en el entorno del despliegue; no se extraen ni copian al chat.

La prueba genera un identificador aleatorio y utiliza dos imágenes PNG válidas de un píxel. Usa el uploader real de la aplicación, sus rutas deterministas y lectura privada byte por byte. Antes de escribir comprueba que las dos rutas no existen. Repite la solicitud y exige que sólo haya dos subidas. Prueba ambas URLs sin credenciales y exige 401/403/404. El resultado sólo se aprueba si se confirma la eliminación y ausencia posterior de las dos rutas generadas. No lista, migra ni borra archivos históricos. No utiliza DNI, selfies de personas, ni modifica registros de obra.

Todo fallo intenta limpiar únicamente las rutas de esta invocación. Una eliminación o lectura posterior no confirmada es un error explícito, no un éxito. El reporte sólo contiene estados, conteos, códigos HTTP y el ID sintético de la ejecución: no URL de objetos, bytes de imágenes o tokens. El ID permite reconstruir sólo las rutas sintéticas en caso de una limpieza pendiente. La prueba es opt-in por despliegue; no agrega escrituras a cada build ordinario.

`prebuild` ejecuta el verificador pasivo; el build estándar y las migraciones mantienen su separación. Las pruebas automatizadas cubren contexto incorrecto, objetos preexistentes, fallo parcial, confirmación perdida, lectura corrupta, acceso anónimo inesperado, limpieza y ausencia de secretos en informes. Los fixtures no equivalen a la aceptación contra Vercel Blob real: ésta se registra con el ID del despliegue y su resultado efectivo al cerrar.

## Identidad
El mismo chequeo operativo informa por separado la configuración de Clerk. Si falta el secreto live o hay una incoherencia local, no realiza peticiones y muestra los códigos pendientes. Con configuración completa consulta sólo el endpoint oficial `/v1/instance` desde servidor, sin seguir redirecciones ni imprimir el secreto. Exige el ID de instancia de ObraSaaS. Rechazo de credenciales, error del proveedor y coincidencia de instancia son resultados distintos.

`INSTANCE_VERIFIED` no significa alta por email, sesión de usuario ni pertenencia empresarial probadas. Esos controles siguen siendo necesarios y el panel histórico no se reabre por aprobar el almacenamiento. Los secrets se configuran por un canal autorizado del proveedor y Vercel; un bloqueo de transferencia no se sortea copiando credenciales a código, parámetros visibles o enlaces de bypass.

Fuentes consultadas: documentación oficial del CLI y Backend API de Clerk; Vercel Blob private storage y CLI. El almacén revisado es `obrasaas-private-evidence`, private, gru1, conectado únicamente al proyecto ObraSaaS para Production y Development. La aceptación de objetos debe provenir de la prueba real, no de ese nombre.

## Auditoría de dependencias
El CI de este cierre detectó avisos de fast-uri 3.1.6 y undici 6.28.0. Se fijan las revisiones corregidas 3.1.7 y 6.28.1 dentro de sus mismas versiones mayores y se elevan los pisos de regresión. No se desactiva ni se reduce la severidad de npm audit. Referencias primarias: fastify/fast-uri GHSA-qw65-cvwx-89v3 y GHSA-58mr-gqgx-xq4g; nodejs/undici GHSA-3wwx-pv8p-q78v.
