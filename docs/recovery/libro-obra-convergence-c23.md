# Sprint C-2.3 — Libro de Obra sobre DailyLog y evidencia reales

Base: Presupuesto C-2.2 en `release/enterprise-unified-2026`. La ruta histórica `/libro-obra` mantiene un alias temporal a `/dashboard/progress`; el destino adopta una jerarquía de Libro de Obra sin copiar los folios demo de master.

## Autoridad de datos
La pantalla conserva `listProgressJournal`, `DailyLog`, evidencia, revisiones, correcciones y relación con tareas como únicas fuentes operativas. No se importan `DEMO_ENTRIES`, clima, temperatura, cantidad de trabajadores, materiales, director de obra o hashes estáticos del frontend histórico.

Los cuatro KPIs describen sólo la lectura cargada: asientos, borradores, registros en revisión y evidencia disponible. No se presentan como totales históricos cuando la consulta está paginada.

## UX
La cabecera pasa a «Libro de Obra & evidencia» y explicita que los asientos están ligados a la obra y, cuando corresponde, a una tarea canónica. Se añade búsqueda local literal por título, resumen, fecha o ID y filtro por estado. Ambas operaciones trabajan sobre los registros autorizados ya cargados y no ejecutan peticiones adicionales.

En móvil la cabecera, KPIs y filtros pasan a una disposición de una columna o dos columnas compactas, con inputs/selects de al menos 16 px. Las decisiones de enviar, aprobar, rechazar, corregir o vincular tarea siguen usando los diálogos y contratos existentes.

## Lo que NO se importa de master
No se reconstruye un folio legal, firma pericial, clima UOCRA, materiales recibidos o hash documental desde datos que no existan en el dominio actual. Un `DailyLog` aprobado es un registro revisado del sistema; no se eleva automáticamente a instrumento legal firmado.

Tampoco se agrega SSE/realtime nuevo, porque el módulo actual ya tiene contratos de consulta y actualización propios. Cualquier firma, folio inmutable o normativa específica se implementará con su modelo y evidencia verificable.

## Aceptación
Pruebas puras cubren resumen, búsqueda con acentos, filtros, registros sin tarea y ausencia de mutaciones. El navegador monta `ProgressClient` real en modo lectura con registros sintéticos y comprueba KPIs, búsqueda/filtro sin red y 320/390/768/1280 px.

Las suites existentes de revisión, corrección, vínculo de tarea, evidencia y contexto siguen siendo la autoridad para mutaciones. La suite completa, lint y build deben permanecer en verde antes del commit.
