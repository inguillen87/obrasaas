# S14 — Sprint de storage privado y carga idempotente

Este documento define el siguiente incremento de ObraSaaS. No habilita producción ni aplica migraciones externas por sí mismo.

## Objetivo

Permitir que un operador autorizado cargue un documento laboral privado, con identidad idempotente, antivirus, hash verificable, URL firmada de corta duración y auditoría completa.

## Contrato del adaptador

El dominio debe depender de una interfaz, no del SDK del proveedor:

```text
createUploadIntent(scope, metadata) -> { uploadId, objectKey, expiresAt, uploadUrl }
completeUpload(scope, uploadId, observed) -> { objectKey, sha256, sizeBytes, contentType }
deleteObject(scope, objectKey) -> void
createDownloadUrl(scope, objectKey, ttlSeconds) -> { url, expiresAt }
```

Reglas obligatorias:

- `scope` incluye `organizationId`, `projectId` y `workerId`; el adaptador debe rechazar cualquier clave fuera de ese prefijo.
- El cliente nunca elige `objectKey`, proveedor, visibilidad ni una URL de descarga.
- El objeto nace privado, con expiración del intento de carga y tamaño/MIME limitados en el proveedor y en la API.
- `completeUpload` vuelve a obtener metadatos del objeto y calcula/verifica SHA-256; no confía en un hash enviado por el navegador.
- El estado de malware debe ser `PENDING_SCAN` hasta un resultado durable `CLEAN`; cualquier otro resultado bloquea lectura y activa revisión.

## Estado y transacción

1. Crear intento idempotente con `Idempotency-Key` y fingerprint del payload.
2. Generar clave de objeto server-owned y URL de carga temporal.
3. Completar sólo si el intento pertenece al mismo tenant/obra/trabajador y no expiró.
4. Verificar metadatos, escanear, persistir `WorkerDocument` y auditoría en una transacción.
5. Si falla persistencia, eliminar el objeto o dejarlo en una cola de compensación; nunca devolverlo como documento válido.

## Gates antes de producción

- Proveedor elegido y contrato DPA/retención aprobado.
- Credenciales configuradas sólo en Vercel/secret manager; nunca en el repositorio.
- Pruebas reales de URL expirada, objeto ausente, MIME falsificado, exceso de tamaño, malware, retry y race concurrente.
- Verificación de migración D1 contra Neon autorizada.
- Prueba negativa cross-tenant en CI y auditoría de creación, revisión, rechazo, archivo y descarga.
- Política legal para DNI, ART, obra social, retención y eliminación.

## Criterio de salida

El sprint no está terminado hasta que un documento `CLEAN` pueda descargarse sólo mediante URL efímera y una cuenta sin permiso, otra obra o un objeto `PENDING_SCAN` reciban respuesta no autorizada/indisponible sin filtrar existencia ni metadatos privados.

