# Demo guiada pública, separada del piloto real

Ruta exacta `/demo`: recorrido interactivo con tres perspectivas (operario, encargado, director). No son roles de sesión ni permisos sobre empresa/obra. Sólo se permite leer esa ruta; sus rutas anidadas y métodos de escritura siguen privados. El panel histórico y las APIs de negocio no se habilitan.

El usuario puede añadir ejemplos predefinidos de documentación, foto y aviso escrito, verlos en una bandeja y simular una revisión. Los conteos provienen únicamente de esos ejemplos locales. No hay archivos, campos personales, cámara, micrófono, llamadas API, almacenamiento persistente ni ingreso automático. Recargar o reiniciar elimina los ejemplos. Los parámetros de URL no seleccionan empresa, trabajador ni privilegios.

El propósito es dar un destino funcional al botón Demo, que antes redirigía al dashboard restringido. Se conserva el acceso personal separado en `/sign-in`. No se presenta este recorrido como alta de empleados, transcripción en el navegador, revisión de identidad ni prueba del canal WhatsApp.

La portada pasa a indicar preparación del piloto y enlaza a la demo guiada. Se retira el formulario que llamaba al estado privado y mostraba una confirmación de contacto sin verificar la respuesta del servidor. El acceso personal usa las rutas de identidad existentes. También se retiran los contadores operativos fijos y las afirmaciones automáticas de KYC, seguros y firma digital de la cabecera y sección de capacidades/FAQ. No constituye una auditoría de todas las páginas comerciales históricas, especialmente `/pricing`.

La marca v3, favicon, iconos PWA, reglas de caché privada y protección de versiones antiguas no se cambian. El verificador de navegador recorre las tres perspectivas y cuatro anchos, comprueba revisión, duplicados, reinicio, recarga, parámetros ajenos, ausencia de peticiones API/escrituras y permanencia del rechazo de `/api/state`.

Aceptación del piloto: el ingreso Clerk necesita la clave Production correcta; las pertenencias y la captura/revisión canónica de identidad aún deben habilitarse. Un número de WhatsApp propio requiere además configuración del canal y pruebas de envío/recepción. Esta demo es deliberadamente ilustrativa, no un reemplazo para esos cierres.
