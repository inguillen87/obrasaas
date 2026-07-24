# Roadmap de profesionalización — S11 a S14

## S11 — Integridad operativa en staging

**Objetivo:** probar el dominio financiero con PostgreSQL real.

- Aplicar migraciones S9/S10 en staging.
- Ejecutar verificadores de migración.
- Pruebas concurrentes de recepciones, aprobaciones y pagos.
- Métricas de latencia y errores por endpoint.

**Salida:** no hay carreras de estado, aislamiento entre obras ni migraciones ambiguas.

### Correlación de requests

El proxy genera o valida `x-request-id` para las rutas financieras. Actualmente se devuelve al cliente, pero todavía no se persiste de forma uniforme en cada `auditLog` ni se propaga a todos los webhooks. La integración completa es un criterio de salida de S11; no debe considerarse cumplida solo porque el header exista.

## S12 — Contabilidad e impuestos por país

**Objetivo:** preparar exportaciones contables sin inventar reglas fiscales.

- Definir país, régimen fiscal y documentos válidos por organización.
- Normalizar CUIT/RUT/NIT y tipos de comprobante.
- Agregar numeración, punto de venta y fecha de emisión donde corresponda.
- Diseñar adaptadores separados para Argentina, Uruguay, Chile y México.

**Salida:** cada país tiene reglas explícitas, versionadas y testeadas; no se mezclan criterios fiscales.

## S13 — Observabilidad y operación enterprise

**Objetivo:** detectar incidentes antes que el cliente.

- Correlation ID en API, auditoría y webhooks.
- Métricas de éxito/fallo para compras, recepción y pagos.
- Alertas de migración pendiente, outbox trabado y evidencia inaccesible.
- Retención y acceso a logs con política de privacidad.

**Salida:** un incidente puede rastrearse desde la UI hasta la mutación y su auditoría.

## S14 — Experiencia móvil de obra

**Objetivo:** optimizar el uso en campo con conectividad imperfecta.

- Bandeja offline para recepciones y evidencias.
- Reintentos idempotentes visibles.
- Compresión y cola de archivos.
- Permisos de cámara, ubicación y almacenamiento explicados al usuario.

**Salida:** un capataz puede registrar una recepción en baja conectividad sin duplicarla ni perder evidencia.

## Reglas de priorización

1. Seguridad, aislamiento y consistencia antes que nuevas pantallas.
2. No afirmar una integración fiscal sin documentación oficial y ambiente de prueba.
3. Cada sprint debe incluir pruebas, migración/verificador cuando corresponda y runbook.
4. Las decisiones sensibles permanecen auditables y reversibles solo mediante flujos explícitos.
