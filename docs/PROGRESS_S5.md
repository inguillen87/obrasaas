# S5 - Bitácora y evidencia de avance

S5 incorpora una fuente relacional para el trabajo diario de obra y la evidencia asociada al avance.

- `DailyLog` registra fecha civil de obra, título, resumen, tarea opcional, autor, estado y revisión CAS.
- `ProgressEvidence` exige una tarea canónica, captura, referencia privada de media, autor opcional, ubicación opcional y revisión humana.
- Ambos recursos quedan confinados por `projectId`, tienen auditoría de alta/revisión y no modifican automáticamente baseline, costos ni certificaciones.
- La evidencia nace `PENDING`; una foto o video nunca certifica avance ni habilita un pago por sí sola.

Endpoints:

- `GET /api/progress`: lista bitácoras y evidencia de la obra activa.
- `POST /api/progress`: crea `DAILY_LOG` o `EVIDENCE` con validación de tarea/autor.
- `PATCH /api/progress/:recordId`: revisa mediante `kind`, `status` y `expectedRevision`.

La UI de carga/revisión y la entrega server-side de media privada ya existen localmente mediante `ProtectedUpload`. Pendientes explícitos: vincular incidentes canónicos al mismo timeline, agregar notificaciones durable/outbox y verificar las migraciones en PostgreSQL Preview antes de producción.
