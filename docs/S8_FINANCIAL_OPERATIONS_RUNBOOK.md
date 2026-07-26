# S8 · Operaciones financieras

## Flujo operativo

1. Crear el fondo desde `/dashboard/cash` con moneda ISO-4217 y custodio miembro activo de la obra.
2. Registrar el movimiento desde la misma pantalla. El comprobante ingresa mediante una reserva `ProtectedUpload`, se valida por bytes y SHA-256 y queda privado en Vercel Blob o Cloudinary autenticado.
3. El movimiento queda `PENDING_APPROVAL`. La clave de idempotencia es la defensa primaria; una huella de contenido, descripción y comprobante bloquea duplicados equivalentes durante una ventana de cinco minutos sin impedir gastos legítimos posteriores.
4. Los movimientos de `100000` o más pasan a `PARTIALLY_APPROVED` después de la primera aprobación y requieren un segundo usuario distinto. El saldo sólo cambia al llegar a `APPROVED`.
5. La descarga del comprobante se autoriza por tenant, obra y permiso y se transmite mediante un endpoint server-side; el navegador no recibe una URL del proveedor.

## Despliegue

- Aplicar migraciones Prisma en orden, incluyendo `20260724230000_cash_movement_fingerprints` y `20260724240000_cash_dual_approval`.
- Ejecutar `node scripts/verify-s7-s8-migrations.mjs` contra la base de datos de destino.
- Configurar al menos un backend privado admitido: Vercel Blob o Cloudinary autenticado. Si ninguno está disponible, la carga falla explícitamente; nunca se usa una URL pública como alternativa.
- Verificar `npm run lint` y `npm run build` antes de promover.

## Incidentes y conciliación

- Un reintento con la misma `idempotencyKey` debe devolver el movimiento original con `replayed: true`.
- Un duplicado semántico devuelve `CASH_MOVEMENT_DUPLICATE` y debe revisarse antes de crear un ajuste.
- Nunca borrar un movimiento aprobado para corregirlo: registrar un ajuste con comprobante y dejar la auditoría intacta.
- Si una aprobación falla por concurrencia, recargar el movimiento y usar su `revision` actual; no repetir a ciegas.
