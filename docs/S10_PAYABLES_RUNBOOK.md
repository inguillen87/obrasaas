# S10 — Cuentas por pagar y three-way match

## Objetivo

Registrar facturas de proveedores con evidencia privada, vincularlas a órdenes de compra y evitar aprobar o pagar importes superiores al valor efectivamente recibido.

## Flujo operativo

1. Crear proveedor activo dentro de la organización.
2. Crear y aprobar la orden de compra con líneas vinculadas a presupuesto.
3. Registrar una o más recepciones parciales; solo las recepciones `POSTED` computan.
4. Registrar factura, opcionalmente adjuntando comprobante privado.
5. Revisar el resumen de recepción: recibido, comprometido y disponible.
6. Aprobar y luego marcar pagada. El servidor repite el control dentro de la transacción.

## Controles invariantes

- Todas las consultas están limitadas por `organizationId` y `projectId`.
- Las mutaciones adquieren bloqueo advisory por obra y usan `ReadCommitted`.
- Las decisiones de factura usan `revision` como CAS y son idempotentes donde corresponde.
- Una factura vinculada a orden no puede superar el valor recibido menos facturas aprobadas/pagadas.
- Los comprobantes se almacenan privados, con SHA-256 y URL firmada de 60 segundos.
- Las exportaciones CSV no exponen datos de otras obras y validan el filtro de estado.

## Verificación antes de desplegar

```text
npm test
npm run lint
npm run build
```

Las migraciones deben ejecutarse con `prisma migrate deploy` en un entorno con PostgreSQL disponible. El build local no demuestra que una migración haya sido aplicada; verificarla con `scripts/verify-s9-migrations.mjs` y el verificador de S10 cuando exista una base de staging.

## Criterios de aceptación

- Una recepción parcial permite facturar solo hasta su valor recibido.
- Dos aprobaciones concurrentes no consumen dos veces el mismo saldo.
- Una factura sin evidencia puede registrarse solo si la política comercial lo permite; la evidencia, cuando existe, nunca es pública.
- Un usuario fuera de la obra no puede leer, exportar, aprobar ni descargar evidencia.
