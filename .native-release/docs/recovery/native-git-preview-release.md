# Releases Preview por la integración Git nativa

Base: ab6b69d73536f015917dbac22aa3333b9b59f6ab. Fecha: 21/09/2026.

## Objetivo operativo
La rama de recuperación tenía `git.deploymentEnabled=false`, por lo que su integración Git no podía iniciar nuevos previews. Esta fase permite solicitar una entrega agrupada mediante la integración GitHub–Vercel ya instalada, sin utilizar el token del conector interactivo ni copiar credenciales a GitHub Actions.

No reautoriza una cuenta rechazada ni crea permisos de Vercel. La integración instalada debe conservar acceso al repo/proyecto, aceptar al autor y estar operativa. El estado del proveedor, su facturación y las variables efectivas se verifican por separado. Un push no garantiza un deployment READY.

## Selección explícita y acotada
`vercel.json` habilita la rama `codex/saas-recovery-20260917` y deshabilita las ramas temporales `validation/*` y `operations/*`. El Ignored Build Step exige, para la rama de recuperación:

- entorno Preview, nunca Production;
- proyecto `prj_68NErbCqCFsDVaMak81gcwsGI9pF` y repositorio GitHub `inguillen87/obrasaas` (ID 1282374475);
- metadatos de commit y una única línea exacta en su mensaje:

```
ObraSaaS-Preview-Release: approved
```

Los commits de trabajo sin esa línea se omiten. La línea es una intención de release, **no un certificado criptográfico ni prueba de que el build pasó**. El equipo debe ejecutarlo y revisar el resultado antes de crear el commit, como exige el plan. Los resultados se registran con el SHA exacto. Vercel usa exit 0 para omitir y exit 1 para continuar este paso; esos códigos no son el resultado del compilador.

El script sólo lee metadatos de sistema. No inicia procesos, usa red, carga .env, lee tokens o escribe datos. Si faltan metadatos para verificar el destino de la rama de recuperación, la omite. Los otros branches mantienen el comportamiento anterior, salvo los espacios internos de validación/operación excluidos. Si esta rama fuera configurada accidentalmente como producción, no se publicaría por este circuito.

## Controles conservados
El comando de build sigue siendo `node scripts/inspect-release-configuration.mjs && npm run build:vercel`. No se cambia la identidad de base, autorización de SHA, configuración live, secretos, cron, installCommand, permisos o ramas públicas. El paso de selección no puede autorizar migraciones; las guardas previas se mantienen.

No se hace merge a master ni se altera el dominio público. Mantener la misma rama conserva el alcance de sus variables Preview existentes; no se inventa una rama nueva esperando que herede esas variables. Los demás proyectos que pudieran estar conectados al repo no deben construir esta entrega de recuperación: el selector exige el ID del proyecto SaaS.

## Verificación y límites
Los tests ejecutan la selección con entornos sintéticos y el CLI con los códigos de salida reales, incluyendo rechazo de destino ajeno, Production, marcadores ambiguos y ramas temporales. La suite y build completos se ejecutan antes de integrar.

Después del push, consultar los estados y deployments emitidos por la integración Vercel en GitHub. Correlacionar SHA, entorno y URL; comprobar la aplicación publicada cuando exista un resultado exitoso. Un check pendiente, fallido o ausente no se presenta como publicación. No repetir commits o generar otros previews para ocultar un fallo del proveedor.

Documentación oficial consultada:
- https://vercel.com/docs/project-configuration/git-configuration
- https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
- https://vercel.com/docs/environment-variables/system-environment-variables

Esta entrega no completa por sí sola el pase a Production ni la respuesta física de WhatsApp. No incorpora nuevas dependencias, tablas, planes pagos o automatismos de cobro.
