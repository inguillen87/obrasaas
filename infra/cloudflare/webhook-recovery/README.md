# Webhook recovery Worker

`vercel.json` agenda el mismo endpoint cada minuto en Production sobre Vercel Pro. Este Worker queda como recuperador externo opcional: no debe mantenerse como segundo scheduler primario salvo durante un failover controlado. La ruta conserva leases e idempotencia porque tanto Vercel como un scheduler externo pueden repetir una ejecución.

Este Worker ejecuta cada minuto la recuperación acotada de webhooks y el GC de solicitudes de WhatsApp Flows. El destino autorizado es exclusivamente:

```text
https://obrasaas.vercel.app/api/cron/webhooks
```

El alias estable de producción evita que una versión Preview antigua procese la base operativa con código atrasado. `src/index.js` valida origen, ruta, ausencia de query/fragmento y HTTPS antes de enviar la solicitud. No se admiten URLs de deployments ni el alias histórico `obrasaas-preview.vercel.app`.

La variable secreta `CRON_SECRET` debe existir tanto en Cloudflare como en Vercel Production y contener el mismo valor. Nunca se guarda en `wrangler.jsonc` ni en el repositorio.

## Verificación

```powershell
node --test tests/cloudflare-webhook-recovery.test.js
npx wrangler deployments status --config infra/cloudflare/webhook-recovery/wrangler.jsonc
npx wrangler versions view <VERSION_ID> --config infra/cloudflare/webhook-recovery/wrangler.jsonc
```

Después de desplegar, los logs del deployment de producción en Vercel deben mostrar un `GET /api/cron/webhooks` por minuto con estado `200`, dominio `obrasaas.vercel.app` y `workHealthy=true` en el cuerpo. El HTTP `200` confirma que la corrida fue aceptada; `workHealthy=false` identifica expiración de asistencia fallida/con backlog, eventos fallidos, proyectos bloqueados o fallas del GC y hace fallar la ejecución programada del Worker sin reintento inmediato. La siguiente corrida natural ocurre al minuto.

`GET /health` sólo confirma liveness del Worker; no representa el resultado de la última recuperación. Hasta persistir ese estado en un backend de observabilidad, la salud de trabajo se verifica mediante la respuesta estructurada y los logs del Cron.
