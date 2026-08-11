# Evidencia Preview `fc71fbe` — reserva exacta de materiales S12.2C

**Fecha:** 11 de agosto de 2026

**Rama:** `codex/platform-ux-foundation`

**Commit verificado:** `fc71fbe6724d2215363e57b942869537208c0df8`

**Alcance:** CI, PostgreSQL 17 descartable, Vercel/Neon Preview, smoke público y
smoke autenticado sintético por rol.
No se promovió ni verificó Production.

## Artefactos inmutables

- CI: [run 31452913235](https://github.com/inguillen87/obrasaas/actions/runs/31452913235), conclusión `success` en sus tres jobs.
- PostgreSQL 17: [job 93660681055](https://github.com/inguillen87/obrasaas/actions/runs/31452913235/job/93660681055).
- Pruebas, lint, build y auditoría: [job 93660681033](https://github.com/inguillen87/obrasaas/actions/runs/31452913235/job/93660681033).
- Smokes públicos: [job 93660681061](https://github.com/inguillen87/obrasaas/actions/runs/31452913235/job/93660681061).
- Vercel deployment Preview: `dpl_GZq8qzmLtfqx8rEGdX8XE8Z6FAVB`, estado `Ready`.
- [Inspector del deployment](https://vercel.com/marcelos-projects-c26aa499/obrasaas-saas/GZq8qzmLtfqx8rEGdX8XE8Z6FAVB).
- URL inmutable: `https://obrasaas-saas-qja6ear2h-marcelos-projects-c26aa499.vercel.app`.

No se cambió ni se certifica en este registro ningún alias estable.

## CI exacto del commit

Los tres jobs terminaron en `success` para el SHA completo indicado arriba:

1. El job PostgreSQL 17 reconstruyó el historial, encontró **120 migraciones**,
   informó `Database schema is up to date!` y cerró el drift con
   `No difference detected.`
2. El verificador S12.2C usó
   `TASK_MATERIAL_RESERVATIONS_DISPOSABLE_CONCURRENCY=1` exclusivamente contra
   la base local descartable `obrasaas_ci`, schema `public`. Aprobó el
   comportamiento rollback-only y cuatro carreras con dos conexiones:
   `reserve6/overbooking`, `reserve/reversal`, `close/reserve structural FK` y
   `release/reversal`, además de cleanup exacto.
3. El verificador PRO-05A volvió a aprobar discovery read-only, scope tenant,
   sello hash UTC, cobertura fail-closed, consistencia terminal y evidencia
   append-only.
4. El job general aprobó lint, `2172/2172` pruebas unitarias/contractuales,
   auditoría de dependencias de producción con cero vulnerabilidades y build
   Next.js 16.2.11 con 88/88 páginas.
5. Playwright público aprobó `2/2` casos y publicó el artefacto de diagnóstico
   `playwright-public-31452913235`.

Las carreras disposable sí hacen commits controlados para enfrentar dos
conexiones reales, pero sólo en esa base local autorizada. El verificador elimina
exactamente sus fixtures al terminar; esto no convierte CI en evidencia de datos
reales ni de Neon mutado por carreras.

## Vercel/Neon Preview

El deployment exacto llegó a `Ready` para el mismo SHA:

- detectó 120 migraciones y ninguna pendiente;
- ejecutó el verificador S12.2C con el flag disposable forzado a `0`, en modo
  rollback-only/live-safe;
- volvió a ejecutar el gate PRO-05A;
- completó Prisma, TypeScript y el build Next 88/88;
- `GET /` sobre la URL inmutable respondió HTTP `200`;
- la consulta de runtime posterior mostró cero eventos `error`/`fatal` y cero
  respuestas `5xx` en las dos horas observadas, incluida la ventana del smoke
  autenticado.

El gate Preview acredita migraciones, invariantes rollback-only y build. Las
carreras mutantes están acreditadas por el job PostgreSQL 17 descartable, no por
Neon.

## Smoke autenticado sintético por rol

Sobre la URL inmutable de `fc71fbe`, un administrador no-superadmin del tenant
externo IANA reutilizó una única identidad sintética en la secuencia
`AUDITOR → DIRECTOR → SITE_MANAGER → AUDITOR`. Al cierre quedaron restaurados
el rol `AUDITOR` y su grant de proyecto, y la sesión fue cerrada.

- Como `DIRECTOR`, `/api/whatsapp` respondió `200`. Las rutas de Inbox, Equipo e
  Integraciones respondieron HTTP `200`, pero ese status aislado no se presenta
  como prueba de contenido autorizado debido al streaming de Next.js;
  `/superadmin` respondió `403`.
- Como `SITE_MANAGER`, `/api/whatsapp` respondió `200`, se observó un único
  proyecto activo asignado e Inbox quedó permitida. Integraciones y Equipo
  mostraron el boundary genérico restringido; su HTTP `200` corresponde al
  streaming de Next.js y no acredita autorización. `/superadmin` respondió `403`.
- En ambos roles, un `POST` deliberadamente inválido con `{}` al endpoint de
  reservas de materiales respondió `400 TASK_MATERIAL_RESERVATION_KIND_INVALID`
  antes de la transacción de dominio y no produjo una reserva ni otra mutación
  de negocio.
- Restaurado `AUDITOR`, `/api/projects` respondió `200` con un único proyecto
  activo y `/api/whatsapp` respondió `403`.
- En la ventana de dos horas consultada, los logs del deployment exacto mostraron
  cero eventos `error`/`fatal` y cero respuestas `5xx`; los `200`, `400` y `403`
  observados fueron los esperados para este recorrido.

Este smoke acredita únicamente boundaries sintéticos de `AUDITOR`, `DIRECTOR` y
`SITE_MANAGER` en el deployment exacto. No acredita una matriz completa de
roles, negativos cross-tenant, una reserva/liberación exitosa, integración Meta
real, media, Flows, trabajadores reales, Production ni ausencia global de
errores fuera de la ventana observada.

## Residual no bloqueante

El build conservó el warning preexistente porque `outputFileTracingRoot` y
`turbopack.root` difieren. No impidió compilar ni llegar a `Ready`; continúa como
deuda de configuración y no se presenta como resuelto.

El modo rollback-only de Preview no deja fixtures persistidos, pero puede tomar
locks transaccionales breves. Por eso no sustituye una base descartable para las
carreras mutantes ni se presenta como ausencia absoluta de impacto operacional.

## Límite estricto de S12.2C

`AVAILABLE` acredita únicamente que **todas las líneas de la BOM vigente tienen
una reserva exacta activa sobre stock on-hand coherente**. No acredita que la
tarea pueda ejecutarse, ni valida Gantt, cuadrilla, equipos, permisos, seguridad,
clima o documentación. No mide avance, certifica, aprueba costos ni habilita
pagos.

S12.2C no implementa consumo, devolución, transferencia, ajuste, merma,
sustitución, reserva parcial ni FIFO. La liberación siempre espeja el bundle
activo completo; no es consumo.

## Qué no acredita este corte

- No hubo matriz completa de roles, negativos cross-tenant ni una
  reserva/liberación exitosa con BOM y stock sintéticos. Los `POST` inválidos
  acreditan autorización y rechazo seguro, no el journey funcional completo.
- No se conectó Meta WhatsApp real, media de un teléfono, Flows ni estados de
  entrega.
- No se habilitaron trabajadores reales: PRO-05B/C/D, entidad legal, retención,
  restore, revisión laboral y gates del piloto siguen abiertos.
- No hubo deploy, migración, smoke ni certificación de Production.

El resultado es **GO técnico para Preview con datos sintéticos** y **NO-GO para
trabajadores reales, piloto de obra real o Production**.
