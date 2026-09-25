# Sprint C-1 — Convergencia enterprise sin merge bruto

Base: `633e3647131f3b3b1763569686b24cd69882a894` (A34). Rama de integración: `release/enterprise-unified-2026`.

## Decisión de integración
`master` y recovery no se fusionan a ciegas. Recovery contiene la autoridad transaccional, permisos, Prisma/PostgreSQL, WhatsApp y pruebas; master conserva superficies visuales históricas. El trabajo se hace módulo por módulo sobre la rama de integración, manteniendo `codex/saas-recovery-20260917` intacta hasta validar cada corte.

Al auditar `src/app`, veinte rutas existen sólo en master. C-1 clasifica todas. Cinco tienen un equivalente funcional exacto ya respaldado por dominio real y reciben un alias temporal 307: `/marketplace` → `/dashboard/purchases`, `/costos` → `/dashboard/budgets`, `/cronograma` → `/dashboard?tab=sec-gantt`, `/libro-obra` → `/dashboard/progress` y `/onboarding` → `/dashboard/getting-started`.

No se usa redirect permanente porque estas URLs pueden recuperar su UI Dark Obsidian propia en C-2. Los alias preservan enlaces y bookmarks durante la convergencia; la navegación interna sigue apuntando a las rutas enterprise canónicas.

## Lo que deliberadamente no se mapea
BIM, certificación, compliance, coordinación, documentos, ejecutivo, licitaciones, planos, portal, calendario, QA report y sostenibilidad no se redirigen a módulos «parecidos». Cada uno necesita un contrato visual y de dominio explícito. Pricing, poster y api-docs tampoco bloquean la operación y quedan fuera de este corte.

`/presupuesto` e `/inspecciones` ya existen en recovery y por eso no forman parte de las veinte rutas exclusivas. Su equivalencia semántica con las pantallas históricas se revisa en C-2; presencia de URL no implica convergencia funcional.

## Criterio para C-2
Para portar una pantalla desde master: inventariar sus datos mock, identificar modelos y endpoints reales, crear una capa de presentación privada por tenant/obra, conservar permisos y estados vacíos/error/concurrencia, y recién entonces portar la composición visual. Nunca copiar `INITIAL_*` o catálogos de demo como verdad operativa.

Marketplace es el primer candidato C-2 porque recovery ya tiene proveedores, PurchaseOrder, GoodsReceipt, SupplierInvoice, inventario, compromisos y recepción. La UI histórica sólo se reutiliza donde pueda leer esos contratos sin inventar precio, GPS, ETA, certificación o recomendación comercial.
