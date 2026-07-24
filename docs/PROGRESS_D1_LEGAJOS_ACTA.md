# D1 — Legajos y acta de inicio: avance verificable

Fecha: 2026-07-24  
Alcance: fundación técnica de S14, sin acceso ni cambios sobre bases externas.

## Entregado

- Modelo Prisma y migración versionada para `WorkerDocument`, `ProjectStartAct` y participantes.
- Estados explícitos para revisión documental, acta y firmas; las transiciones terminales no se pueden reabrir.
- Validadores compartidos para fechas, tipos, estados, participantes únicos y consistencia de proyecto/obra.
- Lecturas GET tenant-scoped para documentos y actas, con permisos `org:execution:read`.
- Respuestas mínimas: no exponen claves de almacenamiento, hashes, documentos ni payloads de firma.
- Verificador de migración D1 (`npm run verify:d1-migrations`) que debe ejecutarse contra una base autorizada antes del rollout.
- Tests unitarios de normalización y lifecycle; lint y build pasan localmente.

## Deliberadamente pendiente

Esto no se considera S14 comercialmente terminado todavía:

1. Aplicar la migración en Neon y ejecutar el verificador con una URL autorizada.
2. Elegir/configurar almacenamiento privado con URLs firmadas, antivirus y política de retención.
3. Implementar comandos de escritura idempotentes para alta, revisión, rechazo, archivo y versionado.
4. Integrar un proveedor de firma electrónica aprobado; la aplicación no debe simular firmas.
5. Añadir outbox para vencimientos, solicitudes de revisión y recordatorios.
6. Completar pruebas de autorización negativa, límites de tamaño/tipo y recuperación ante fallos.
7. Cerrar criterios legales de DNI, ART, obra social, biometría, retención y jurisdicción.

## Gate de salida

S14 sólo puede marcarse como listo cuando exista evidencia de migración aplicada, almacenamiento privado probado, firma verificable, auditoría completa y pruebas de fuga cross-tenant en CI. Hasta entonces, las rutas nuevas son únicamente de lectura y no habilitan carga de legajos ni firma.

