# Evidencia Preview `edeea82` — PRO-05A.1 y superficies restringidas

**Fecha:** 10 de agosto de 2026

**Rama:** `codex/platform-ux-foundation`

**Commit verificado:** `edeea82a1700918abb4a813dab3fdb93dcfe4eb1`

**Production:** no tocado; conservó el deployment
`dpl_99itiDkAUeizs33vQFWp8B4K95Dd`

## Artefactos inmutables

- CI: [run 31442362487](https://github.com/inguillen87/obrasaas/actions/runs/31442362487), conclusión `success` en sus tres jobs.
- Job PostgreSQL 17: [93629530819](https://github.com/inguillen87/obrasaas/actions/runs/31442362487/job/93629530819).
- Job de pruebas, lint, build y auditoría: [93629530765](https://github.com/inguillen87/obrasaas/actions/runs/31442362487/job/93629530765).
- Job de smokes públicos: [93629530809](https://github.com/inguillen87/obrasaas/actions/runs/31442362487/job/93629530809).
- Vercel deployment: `dpl_CYpTdK5BTUiUtZVEzWZyUuNf5uK2`, estado `Ready`.
- Proyecto Vercel: `obrasaas-saas` (`prj_68NErbCqCFsDVaMak81gcwsGI9pF`).
- URL inmutable: `https://obrasaas-saas-2501avetv-marcelos-projects-c26aa499.vercel.app`.
- Alias Preview verificado: `https://obrasaas-preview.vercel.app`, apuntando al mismo deployment y SHA.

## Gates reproducibles

1. La validación local final pasó `2127/2127` pruebas, lint, Prisma, auditoría de
   dependencias de producción sin vulnerabilidades y build Next.js 16.2.11 con
   88 páginas.
2. CI reconstruyó el historial en PostgreSQL 17, ejecutó el verificador
   conductual PRO-05A, dejó `prisma migrate status` limpio, cerró el gate de
   drift y terminó los tres jobs en `success`.
3. Vercel detectó 119 migraciones sin pendientes, repitió la reconciliación
   estructural y aprobó el verificador PRO-05A contra Neon. Ese verificador se
   ejecutó antes del `prisma generate` gobernado por el release y del build Next
   88/88. `npm postinstall` había ejecutado un generate previo; por eso este
   registro no afirma que PRO-05A precedió a todo generate del proceso.
4. Sobre la URL inmutable, `GET /`, `GET /privacy` y `GET /data-deletion`
   respondieron `200`.
5. Después de cortar el alias Preview al artefacto exacto, un AUDITOR sintético
   del tenant `IANA`, en `Obra Piloto WhatsApp Mendoza`, recorrió las
   superficies privadas:

   | Ruta | Resultado observado |
   | --- | --- |
   | `/dashboard` | permitida; identidad, tenant y obra sintéticos visibles |
   | `/dashboard/inbox` | límite sanitizado, sin contenido privado; HTTP `200` por streaming |
   | `/dashboard/integrations` | límite sanitizado, sin contenido privado; HTTP `200` por streaming |
   | `/dashboard/team` | límite sanitizado, sin contenido privado; HTTP `200` por streaming |
   | `/presupuesto` | límite sanitizado; HTTP `403` |
   | `/superadmin` | límite sanitizado; HTTP `403` |
   | `/api/whatsapp` | JSON sanitizado; HTTP `403` |

6. Los logs del deployment exacto, consultados después del smoke, mostraron
   cero entradas `level:error` y cero respuestas HTTP `5xx`.

## Residual no bloqueante

Vercel advirtió que `outputFileTracingRoot` y `turbopack.root` difieren y usó
`/vercel/path0`. El warning no impidió el build ni el deployment `Ready`, pero
queda como deuda P2 de configuración; este corte no lo presenta como resuelto.

El verificador no persiste fixtures: discovery corre `READ ONLY` y las pruebas
de mutación se revierten. Aun así, ejecutarlo contra la base Preview aprobada
puede tomar locks breves. Queda como deuda P2 separar un gate estructural
live-safe del smoke conductual completo sobre una base descartable.

Las tres rutas restringidas bajo `/dashboard` no se documentan como HTTP `403`:
su `loading.js` inicia streaming antes de que Next resuelva el límite de acceso,
por lo que el usuario recibe la UI sanitizada pero el status ya quedó en `200`.
Es una limitación pendiente de la semántica HTTP, no evidencia de exposición de
datos en este smoke.

## Límite estricto de PRO-05A.1

PRO-05A continúa **discovery-only**. El catálogo v1 sólo puede sellar
`DISCOVERY_BLOCKED`; la atestación de un ADMIN no verifica a la persona titular
ni a su representante. No existe decisión de base legal y ningún endpoint
exporta, corrige, restringe, porta, anonimiza o elimina datos. El verificador
acredita invariantes SQL y comportamiento transaccional controlado; no acredita
un DSAR ejecutable.

## Qué no acredita este corte

- No hubo deploy ni migración en Production.
- No se ejecutó el endpoint PRO-05A con un ADMIN sintético ni una prueba
  cross-tenant; el smoke autenticado cubrió sólo negativas de un AUDITOR.
- No se completó PRO-05B/C/D, entidad legal, matriz de retención/holds, adapters
  por dominio, propagación a proveedores ni backup/restore con tombstones.
- No se conectó Meta WhatsApp real, media de un celular, Flows ni estados de
  entrega.
- No se implementó S12.2C ni se probó una obra o persona trabajadora real.

El resultado es **GO para Preview técnico con datos sintéticos** y **NO-GO para
piloto con personas reales o Production**.
