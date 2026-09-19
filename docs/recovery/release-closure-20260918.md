# Cierre de fase: incorporación y prueba del canal

## Alcance de la candidata
Se consolida la experiencia guiada de conexión de clientes, separada de las herramientas del operador. La empresa conserva su identidad y activo; la administración interna no se usa como empresa cliente. Se agrega una prueba de respuesta exclusivamente en Preview para un piloto permitido, con sesión de superadmin y membresía administrativa comprobada en PostgreSQL y Clerk.

La prueba consulta el último mensaje de la obra elegida y requiere confirmar el envío. No acepta destinatario ni texto arbitrarios. Usa el envío manual auditado de la bandeja y una clave determinista por conexión/mensaje recibido. Repetir el mismo intento no debe originar otra salida. Aceptado, enviado, entregado y leído se presentan como estados distintos. No crea empleados ni habilita automatizaciones laborales, pagos, compras o cambios de avance.

El endpoint no está disponible en Production ni en Development. El panel queda dentro de Administración técnica y no forma parte de la incorporación normal de clientes. Los estados de recepción histórica no se confunden con la autorización actual del participante.

## Ensayo de migración de producción
Antes de modificar el entorno público se inspeccionó la rama principal de Neon: 24 tablas y 22 migraciones aplicadas. Se creó una copia aislada de esa rama y se ejecutó el pipeline existente de migraciones y verificadores PostgreSQL, conservando sus controles de identidad de base.

Resultado del ensayo: 105 migraciones pendientes aplicadas; 127 aplicadas en total, cero fallidas y 150 tablas finales. Los conteos de datos preexistentes se conservaron: 4 organizaciones, 2 obras, 7 trabajadores y 2 mensajes. Los verificadores de permisos, relaciones, diarios, archivos privados, cantidades, conciliaciones y revisiones completaron sus escenarios transaccionales. No constituye una prueba de carga ni reemplaza una validación autenticada del runtime de producción.

La base principal no fue migrada en este ensayo. La copia validada no contiene las altas nuevas del piloto de Preview. Los tenants y mensajes no se trasladan automáticamente entre esos entornos.

## Condiciones de publicación
Antes de promover la candidata deben estar completas las credenciales propias de Production, la identidad aprobada de su base y el SHA exacto autorizado para migraciones. El secreto Meta que opera en Preview no estaba registrado para Production al inspeccionar la configuración. El intento de instalarlo desde la herramienta fue bloqueado y no se aplicó.

No se sustituye la base principal por la de Preview, no se desactivan las guardas, no se cambia el callback del piloto y no se reasigna el dominio público para simular una publicación. Una promoción se realiza con configuración de Production, copia previa recuperable y verificación de login, permisos y rutas antes de atender clientes. Hasta completar ese control, master y el deployment público existente permanecen intactos.

## Evidencia por entorno
La suite, lint, build y el ensayo de navegador de esta entrega se registran con el SHA y su resultado en el PR. El navegador controlado usa el componente real y HTTP sintético: consulta sin envío, consentimiento explícito, respuesta perdida, intento idéntico y estados de entrega separados. Se comprueba adaptación a 320/390/768/1280 píxeles.

La prueba física del mensaje se documenta separadamente con registro entrante, mensaje saliente del backend y estado confirmado por Meta. Un mensaje enviado desde la consola de Meta no cuenta como respuesta de ObraSaaS. No declarar esta fase publicada en producción por un build local o un preview READY.
