# Webhook recovery Worker

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

Después de desplegar, los logs del deployment de producción en Vercel deben mostrar un `GET /api/cron/webhooks` por minuto con estado `200` y dominio `obrasaas.vercel.app`.
