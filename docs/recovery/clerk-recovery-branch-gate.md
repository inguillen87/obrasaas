# Clerk E2E — Rama de recuperación autorizada

Base de esta continuación: `ebfd1c0996437a3f1de9d4f49542ea090032382d`.
Fecha: 23/09/2026. Alcance autorizado: habilitar únicamente la rama de recuperación en CI y en el entorno de pruebas, manteniendo revisión humana y Production intacta.

## Cambio mínimo y verificable

El job `authenticated-s92-e2e` de `.github/workflows/ci.yml` conserva su condición de evento: sólo `push` o `workflow_dispatch`. Añade la referencia exacta `refs/heads/codex/saas-recovery-20260917` junto a `master` y `codex/platform-ux-foundation`. No admite patrones, tags, pull requests, `pull_request_target` ni ramas con nombres parecidos.

El entorno GitHub existente `clerk-development-e2e` recibió exclusivamente una política de tipo `branch` con nombre `codex/saas-recovery-20260917`, ID `60764728`. Las dos políticas anteriores se conservaron con sus mismos IDs. Se verificaron antes/después la identidad del entorno, las reglas de revisión y la configuración de bypass, sin cambios. El revisor requerido sigue siendo `inguillen87`.

No se modificaron secretos, valores de credenciales, permisos del token de CI, revisores, variables de Vercel o políticas de Production. No se aprobó ninguna ejecución en nombre del revisor ni se utilizó el bypass administrativo.

## Qué ejecuta el job después de la revisión

Se conserva PostgreSQL 17 de servicio, efímero, en loopback y base `obrasaas_e2e`. Las tres variables de conexión de la aplicación apuntan a esa base. Los flags desechables S9.2/S9.3/S10 y el origen `http://localhost:3100` no cambian.

El job exige prefijos de credenciales Development, verifica actores deterministas ya existentes con `--verify`, siembra únicamente la base de ensayo y ejecuta secuencialmente los journeys S9.2, S9.3 y S10-CERT. No provisiona automáticamente nuevos usuarios Clerk. Se mantienen las restricciones sobre publicación de artefactos autenticados y el alcance de credenciales por paso.

Que existan secretos no demuestra que sigan siendo válidos. Habilitar una rama tampoco prueba un inicio de sesión. Un job `waiting` no equivale a `success`; los resultados reales deben registrarse con el SHA, run ID y pasos que terminaron.

## Validación de la condición

El test `Clerk gate admits only authorized branch refs on push or explicit dispatch` exige la expresión exacta, incluida su agrupación. Comprueba 72 combinaciones de evento/ref: las tres ramas autorizadas frente a tags, refs de PR, ramas distintas y nombres con sufijos. Son seis eventos por doce referencias.

La prueba se ejecutó primero con el workflow anterior y falló por la exclusión de la rama de recuperación. Con la única referencia añadida pasan los contratos de los tres journeys. Los recuentos completos y los checks remotos se registran en el PR después de ejecutarlos.

## Revisión y continuación

La integración se realiza en la rama de recuperación, sin merge a la rama base o `master`. El push debe abrir la solicitud de revisión de `clerk-development-e2e`. El revisor puede entrar al run exacto, usar `Review deployments`, seleccionar ese entorno y aprobar sus pruebas. Ese botón no promueve el sitio en Vercel ni modifica Production: sólo libera este job de ensayo.

Antes de afirmar que el circuito autenticado está cerrado, comprobar que el run pertenece al SHA actual y que los tres journeys terminaron correctamente. Si hay un fallo, conservar el log, diagnosticarlo y no habilitar mocks de autenticación, datos productivos o reintentos que oculten el resultado.

Esta autorización de pruebas es independiente del pase productivo. La validación del Preview con sesión real, configuración efectiva, respaldo e identidad de base y WhatsApp físico siguen siendo controles separados.

## Registro de la intervención anterior — publicación bloqueada

La política de entorno 60764728 está creada y verificada. La suite local terminó con 3.863 pruebas aprobadas, cero fallos/omisiones, lint y build aprobados. La llamada de commit/push fue bloqueada por el control de seguridad de la herramienta antes de ejecutarse. Se confirmó mediante lectura posterior que HEAD local y remoto siguen en `ebfd1c0996437a3f1de9d4f49542ea090032382d`, sin cambios staged y con estos cuatro archivos locales pendientes. No se lanzó una nueva ejecución de Clerk ni se presentó una aprobación. No considerar habilitada la condición remota del workflow hasta publicar los cambios y comprobar el run correspondiente.

## Continuación de publicación solicitada

El usuario volvió a solicitar explícitamente aplicar los cambios en GitHub y Vercel. Esta continuación publica los cuatro archivos preparados mediante el flujo normal de la rama de recuperación y solicita un Preview agrupado del mismo commit, manteniendo intactas las protecciones de Production y la aprobación humana del entorno Clerk. Los resultados efectivos (commit, deployment y ejecución pendiente/aprobada) deben consultarse en la auditoría más reciente del PR #1; este párrafo no acredita por sí mismo que una publicación haya terminado.
