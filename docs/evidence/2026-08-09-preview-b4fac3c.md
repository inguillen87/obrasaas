# Evidencia Preview `b4fac3c` — reconciliación Prisma/PostgreSQL

**Fecha:** 9 de agosto de 2026

**Rama:** `codex/platform-ux-foundation`

**Commit verificado:** `b4fac3c3094d408de3269a7cd136ee6ab9274614`

**Production:** no tocado

## Artefactos inmutables

- CI: [run 31307949012](https://github.com/inguillen87/obrasaas/actions/runs/31307949012), conclusión `success` en los tres jobs.
- Vercel deployment: `dpl_FTSBwsT9txwad9irPR7KHM4HiZSJ`, estado `Ready`.
- URL inmutable: `https://obrasaas-saas-2orbeccv4-marcelos-projects-c26aa499.vercel.app`.
- Alias de rama: `https://obrasaas-saas-git-codex-platf-eb1140-marcelos-projects-c26aa499.vercel.app`.

## Qué quedó probado

1. La suite local final pasó `2046/2046`, lint, auditoría de dependencias de
   producción sin vulnerabilidades y build Next.js 16.2.11 con 88 páginas.
2. PGlite descartable aplicó 119/119 migraciones desde cero; el verificador de
   catálogo/cascada pasó y `prisma migrate diff --exit-code` no detectó drift.
3. CI reconstruyó el historial representativo en PostgreSQL 17, ejecutó todos
   los verificadores, dejó `prisma migrate status` limpio y cerró el gate de
   drift con código 0. Los otros jobs de calidad y Playwright público también
   finalizaron `success`.
4. El Preview anterior del mismo corte (`14982a6`, deployment
   `dpl_B6EsojRPMWK3g8pS5AsqCNgTwSRb`) aplicó las migraciones 118 y 119. El
   deployment final `b4fac3c` detectó 119 migraciones sin pendientes; no se
   afirma que las haya vuelto a aplicar.
5. El build final repitió en Neon el verificador de proyecto: índice scoped
   unique válido/listo, FK validada con `ON DELETE/UPDATE CASCADE`, columnas y
   tabla objetivo exactas, más borrado transaccional del fixture proyecto →
   tarea/equipo/asignación. Resultado:
   `{"ok":true,"tables":4,"constraints":15,"enums":5,"structuralReconciliation":true}`.
6. La conexión del verificador ignora URLs genéricas, exige esquema explícito y
   fija `sslmode=verify-full` para Neon.
7. Smokes sobre la URL inmutable final:
   - `GET /privacy` → `200`;
   - `GET /sign-in` → `200`;
   - `GET /dashboard/purchases` sin sesión → `404` fail-closed;
   - challenge WhatsApp con token inválido → `403`;
   - webhook WhatsApp `POST` sin firma → `401`.

## Qué no acredita este corte

- No hubo deploy ni migración en Production.
- No se recorrió todavía el dashboard con sesión y matriz completa de roles ni
  un usuario cross-tenant.
- No se conectó mensajería bidireccional Meta real, Flows publicados, media de
  un celular ni estados de entrega.
- No implementa S12.2C reservas/liberaciones ni convierte promesas de proveedor
  en stock disponible.
- No completa privacidad/retención/DSAR/restore/WAF para trabajadores reales.

Por lo tanto, el resultado es **GO para Preview técnico con datos sintéticos** y
**NO-GO todavía para obra real o Production**.
