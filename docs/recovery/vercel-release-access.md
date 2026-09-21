# Acceso operativo a Vercel sin depender del escritorio

## Alcance
`scripts/vercel-release-access.mjs` comprueba una vía de acceso autorizada y separada del conector interactivo: `VERCEL_TOKEN` disponible en GitHub Actions o en el entorno del operador. No intenta reutilizar la sesión rechazada del conector, extraer tokens de Chrome, descifrar variables, ampliar permisos o regenerar credenciales. No carga archivos .env ni enumera secretos de GitHub.

El destino está fijado a ObraSaaS: equipo team_BV1xuY6BnEzGanfok8GAyjZv, proyecto prj_68NErbCqCFsDVaMak81gcwsGI9pF, repositorio 1282374475. Se verifica esa relación antes de consultar nombres de variables. No acepta un destino arbitrario suministrado desde una URL, issue o comentario.

## Ejecución

```sh
node scripts/vercel-release-access.mjs
```

Usa únicamente GET sobre api.vercel.com, con dos consultas como máximo y 12 segundos de timeout por consulta, sin seguir redirecciones. El endpoint de variables se consulta con `decrypt=false`. El programa nunca escribe la respuesta completa: publica únicamente los nombres fijos de requisitos, su presencia y códigos de resultado en `evidence/vercel-release-access.json`. El archivo no contiene valores de credenciales, URLs de bases o nombres adicionales devueltos por el proveedor.

La variable `VERCEL_TOKEN` debe ser una credencial válida del equipo correcto, instalada en el almacén de secretos autorizado. No es la clave de la app Meta, el token de mensajería, la contraseña de Facebook ni GITHUB_TOKEN. El workflow la expone únicamente al paso de consulta, no a npm install, los tests o el build. No utiliza permisos de escritura de GitHub.

## Interpretación
- `CI_TOKEN_NOT_AVAILABLE`: la variable no estuvo disponible en esa ejecución. No acredita ausencia en todos los ambientes o bóvedas del usuario.
- `VERCEL_SCOPE_NOT_AUTHORIZED`: esa credencial no permitió la consulta; no se reintenta con otro scope.
- `PROJECT_BINDING_MISMATCH`: el proyecto, equipo o repo devuelto no corresponde al destino aprobado.
- `PRODUCTION_NAMES_NOT_RETURNED`: la consulta no devolvió todos los nombres requeridos para Production. Revisar la configuración efectiva, incluyendo variables compartidas.
- `ACCESS_AND_NAMES_CHECKED`: únicamente acceso de lectura al destino y presencia de nombres comprobados. No significa que los secretos sean válidos, exista permiso de despliegue, que la base corresponda, las migraciones estén autorizadas o que WhatsApp entregue respuestas.

Un estado bloqueado produce exit code 1. Las guardas existentes de configuración, identidad de base y SHA permanecen intactas. Este programa no modifica variables, crea deployments, cambia dominios, migra PostgreSQL ni envía mensajes.

## Cierre productivo
El paso posterior al acceso es validar la configuración real de Production, el respaldo y las migraciones con su identidad/SHA, construir con ese entorno y probar la identidad y el canal. Un despliegue Production sin asignar dominios permite separar build de cambio de tráfico; no debe usarse para evitar las verificaciones de la base.

La reautorización OAuth del conector corresponde al titular en el proveedor. Instalar otros plugins o permitir más acciones en ChatGPT no aumenta el alcance de una credencial rechazada. Este verificador conserva una segunda ruta legítima, pero no crea esa autorización.

Referencias oficiales:
- https://vercel.com/docs/rest-api/projects/retrieve-the-environment-variables-of-a-project-by-id-or-name
- https://vercel.com/docs/agent-resources/vercel-mcp
- https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel
- https://vercel.com/docs/cli/deploy
