# Sprint C-2.4 — Inspecciones QA/QC sobre workflow real

Base: Libro de Obra C-2.3 en `release/enterprise-unified-2026`. La ruta histórica `/inspecciones` ya redirigía a `/dashboard/inspections`; este corte converge la experiencia visual del workspace real sin importar los fallback de `master`.

## Autoridad de datos
La pantalla usa exclusivamente `INSPECTION_TEMPLATES`, `InspectionRecord`, sus revisiones y el workflow existente del core enterprise. Los estados válidos son DRAFT, SUBMITTED, APPROVED, OBSERVED y REJECTED. La creación, guardado, envío y dictamen mantienen los endpoints, permisos y control de versión ya existentes.

El listado es paginado por servidor en bloques de hasta 50. Los KPIs describen únicamente la página cargada: registros, borradores, enviados a revisión y registros que requieren atención (OBSERVED/REJECTED). No se presentan como estadísticas globales del proyecto.

## UX
La cabecera pasa a «Inspecciones QA/QC» con alto contraste y contexto de obra. El listado incorpora búsqueda literal por título, ubicación, plantilla o identificador, filtro por estado y filtro por plantilla.

La búsqueda y los filtros son locales sobre la página ya autorizada: no generan lecturas extra ni escrituras. En 320/390/768/1280 px el workspace conserva una sola columna cuando corresponde y inputs/selects mantienen tamaño táctil legible.

## Lo que NO se importa de master
No se copian los fallback de inspecciones, puntajes estáticos, inspectores ficticios, hashes precargados ni los checklists regulatorios escritos directamente en la UI histórica. Tampoco se usa `localStorage` como API key ni SSE de `/api/realtime`.

Los templates actuales son genéricos y deliberadamente exigen que el usuario documente criterio de aceptación, referencia técnica y observación. La plataforma no afirma automáticamente cumplimiento SRT, CIRSOC, AEA u otra norma por seleccionar una plantilla.

## Workflow preservado
- DRAFT editable.
- SUBMITTED bloqueado para edición y pendiente de Dirección.
- APPROVED sólo si no hay controles FAIL y existe dictamen.
- OBSERVED permite reapertura explícita.
- REJECTED queda cerrado.
- SHA-256 se describe como huella de integridad, no firma digital certificada.

## Aceptación
Pruebas puras cubren KPIs de página, búsqueda con acentos, filtros por estado/plantilla y ausencia de mutación del arreglo fuente. El navegador monta `InspectionWorkspace` real con HTTP controlado, confirma una única lectura inicial, filtros sin nuevas consultas, cero escrituras y responsive 320/390/768/1280.

Las pruebas existentes de `site-inspections` e `inspection-workflow-view` siguen siendo la autoridad del workflow. La suite completa, lint y build deben pasar antes del commit.
