# S8 · Operaciones financieras

## Flujo operativo

1. Crear el fondo desde `/dashboard/cash` con moneda ISO-4217 y custodio miembro activo de la obra.
2. Registrar el movimiento desde la misma pantalla. El comprobante se carga primero en Cloudinary como recurso privado y se asocia mediante `sha256`.
3. El movimiento queda `PENDING_APPROVAL`. Una clave de idempotencia evita reintentos duplicados y una huella semántica bloquea duplicados con otra clave.
4. Los movimientos de `100000` o más pasan a `PARTIALLY_APPROVED` después de la primera aprobación y requieren un segundo usuario distinto.
5. La descarga del comprobante se autoriza por obra y permiso, y entrega una URL firmada con vigencia de 60 segundos.

## Despliegue

- Aplicar migraciones Prisma en orden, incluyendo `20260724230000_cash_movement_fingerprints` y `20260724240000_cash_dual_approval`.
- Ejecutar `node scripts/verify-s7-s8-migrations.mjs` contra la base de datos de destino.
- Confirmar configuración de Cloudinary protegido (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`). Sin ella, las cargas deben fallar de forma explícita; no usar URLs públicas como alternativa.
- Verificar `npm run lint` y `npm run build` antes de promover.

## Incidentes y conciliación

- Un reintento con la misma `idempotencyKey` debe devolver el movimiento original con `replayed: true`.
- Un duplicado semántico devuelve `CASH_MOVEMENT_DUPLICATE` y debe revisarse antes de crear un ajuste.
- Nunca borrar un movimiento aprobado para corregirlo: registrar un ajuste con comprobante y dejar la auditoría intacta.
- Si una aprobación falla por concurrencia, recargar el movimiento y usar su `revision` actual; no repetir a ciegas.
