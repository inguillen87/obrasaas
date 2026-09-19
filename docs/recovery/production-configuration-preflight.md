# Preflight de configuración antes de migrar

## Alcance cerrado por este cambio
El build configurado en vercel.json ya ejecuta `node scripts/inspect-release-configuration.mjs && npm run build:vercel`. La primera comprobación ahora incluye prerrequisitos estructurales del lanzamiento: identidad Clerk de Production, origen HTTPS y authorized parties, configuración del webhook de identidad, Meta, cifrado de conexiones, firma de webviews, recuperación por cron y almacenamiento privado.

Los faltantes se informan juntos mediante claves y códigos, sin valores, URLs de base, contraseñas, huellas de secretos ni payloads de proveedores. Un error devuelve exit code 1: el operador `&&` no continúa al comando de migración. No se cambiaron `evaluateMigrationGate`, el cotejo de identidad de base ni la autorización por SHA. La inspección no crea ni migra tablas.

## Qué significa el resultado
`productionPrerequisites.status=CONFIGURATION_CHECKED` significa solamente que los campos necesarios están presentes y tienen el formato local esperado. No valida credenciales contra Meta o Clerk, entrega de WhatsApp, membresías, permisos privados del almacén o funcionamiento de cientos de tenants. Estos resultados siguen en `providerVerified=false`, `runtimeVerified=false` y `migrationAuthorizedByThisCheck=false`.

Un token de mensajería vencido no puede detectarse desde esta inspección de variables: está cifrado por conexión en la base. Debe renovarse y probarse por el circuito autenticado. No se imprime, copia, rota ni sustituye ninguna credencial en este cambio.

Local y Preview conservan sus comprobaciones anteriores. Una contradicción entre `VERCEL_ENV` y `VERCEL_TARGET_ENV`, un entorno desconocido o el importador de pilotos habilitado en Production se rechazan. Los tests utilizan valores sintéticos y no acceden a bases ni proveedores.

## Operación
Ejecutar `node scripts/inspect-release-configuration.mjs` dentro del entorno autorizado. `--local` carga únicamente `.env.local` sin sobrescribir variables ya definidas. No exportar el archivo con secretos al repositorio o al chat.

Para el pase real siguen siendo necesarios: credenciales propias y verificadas de Production, resguardo vigente y plan de recuperación, identidad de la base aprobada, autorización del SHA exacto, migración validada, build con configuración Production y prueba autenticada antes del cambio de tráfico. Este preflight no rellena aprobaciones ni permite usar la base de Preview como reemplazo silencioso.

## Evidencia de validación
La rama temporal de validación aplica estos archivos sobre una copia limpia del SHA base. Sólo después de aprobar pruebas, lint y build crea el commit de aplicación. No necesita ni consume secretos Meta, Clerk o Vercel y no despliega la rama temporal. La salida del job identifica SHA y logs. El estado de publicación se verifica por separado: un job de build aprobado no equivale a Production desplegada.
