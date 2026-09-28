# Sprint C-2.5 — Cronograma & dependencias sobre tareas canónicas

Base: Inspecciones C-2.4 en `release/enterprise-unified-2026`. La ruta histórica `/cronograma` mantiene un alias temporal a `/dashboard?tab=sec-gantt`; el Gantt real ya opera sobre tareas canónicas, dependencias tipadas y alcance de obra.

## Autoridad de datos
El planner conserva `canonicalTasksToGanttCatalog`, `buildGanttModel`, las APIs de tareas canónicas y los permisos existentes. C-2.5 no importa `initialTasks`, responsables ficticios, API v1, CSV de ejemplo, horas extra, SSE demo ni fechas rígidas del frontend histórico.

La búsqueda nueva es puramente visual: evalúa nombre, responsable, estado y nombres de predecesoras sobre el modelo ya autorizado. No elimina tareas del grafo ni recalcula dependencias. Las coincidencias se resaltan y el resto se atenúa, manteniendo visible el contexto de secuencia.

## KPIs
- Avance promedio: promedio simple de los porcentajes cargados, explícitamente descrito como tal.
- Tareas abiertas: tareas del modelo menos las finalizadas.
- Dependencias reales: relaciones configuradas en el grafo.
- Riesgos de secuencia: tareas demoradas/conflictivas; el subtítulo distingue conflictos de predecesoras.

Los KPIs describen el catálogo cargado. No se presentan como curva S, valor ganado ni avance contractual ponderado por costo.

## UX
La cabecera pasa a «Cronograma & dependencias» y en modo canónico identifica «PLAN MAESTRO · TAREAS CANÓNICAS». El buscador convive con la escala temporal y no genera peticiones de red.

En móvil, KPIs pasan a tarjetas compactas, buscador y escalas se apilan y el Gantt conserva el scroll horizontal dentro de su propio panel. La página completa no adquiere overflow horizontal.

## Lo que NO se importa de master
No se copian tareas mock, `localStorage` con API key, importación CSV de muestra, aprobaciones de horas extra, nombres de operarios inventados ni acciones sobre `/api/v1/tasks` o `/api/v1/overtime`.

Tampoco se infiere avance real desde el porcentaje manual. La capa de campo/mediciones existente continúa separada y se muestra como evidencia complementaria cuando el usuario tiene permiso.

## Aceptación
Pruebas puras cubren avance promedio, resumen del workspace, búsqueda con acentos, búsqueda por predecesora y tratamiento literal de regex/markup. El navegador monta `GanttPlanner` real en modo canónico y lectura, verifica KPIs, conflicto de secuencia, búsqueda sin red, cambio de escala y 320/390/768/1280 px.

Las suites existentes de `gantt.test.js`, field-status y snapshots siguen siendo autoridad del motor y sus integraciones. Suite completa, lint y build deben pasar antes del commit.
