# Sprint C-1 ? Convergencia enterprise sin merge bruto

Base: `633e3647131f3b3b1763569686b24cd69882a894` (A34). Rama de integraci?n: `release/enterprise-unified-2026`.

## Decisi?n de integraci?n
`master` y recovery no se fusionan a ciegas. Recovery contiene la autoridad transaccional, permisos, Prisma/PostgreSQL, WhatsApp y pruebas; master conserva superficies visuales hist?ricas. El trabajo se hace m?dulo por m?dulo sobre la rama de integraci?n, manteniendo `codex/saas-recovery-20260917` intacta hasta validar cada corte.

Al auditar `src/app`, veinte rutas existen s?lo en master. C-1 clasifica todas. Cinco tienen un equivalente funcional exacto ya respaldado por dominio real y reciben un alias temporal 307: `/marketplace` ? `/dashboard/purchases`, `/costos` ? `/dashboard/budgets`, `/cronograma` ? `/dashboard?tab=sec-gantt`, `/libro-obra` ? `/dashboard/progress` y `/onboarding` ? `/dashboard/getting-started`.

No se usa redirect permanente porque estas URLs pueden recuperar su UI Dark Obsidian propia en C-2. Los alias preservan enlaces/bookmarks durante la convergencia; la navegaci?n interna sigue apuntando a las rutas enterprise can?nicas.

## Lo que deliberadamente no se mapea
BIM, certificaci?n, compliance, coordinaci?n, documentos, ejecutivo, licitaciones, planos, portal, calendario, QA report y sostenibilidad no se redirigen a m?dulos ?parecidos?. Cada uno necesita un contrato visual/dominio expl?cito. Pricing/poster/api-docs tampoco bloquean la operaci?n y quedan fuera de este corte.

`/presupuesto` e `/inspecciones` ya existen en recovery y por eso no forman parte de las veinte rutas exclusivas. Su equivalencia sem?ntica con las pantallas hist?ricas se revisa en C-2; presencia de URL no implica convergencia funcional.

## Criterio para C-2
Para portar una pantalla desde master: inventariar sus datos mock, identificar modelos/endpoints reales, crear una capa de presentaci?n privada por tenant/obra, conservar permisos y estados vac?os/error/concurrencia, y reci?n entonces portar la composici?n visual. Nunca copiar `INITIAL_*` o cat?logos de demo como verdad operativa.

Marketplace es el primer candidato C-2 porque recovery ya tiene proveedores, PurchaseOrder, GoodsReceipt, SupplierInvoice, inventario, compromisos y recepci?n. La UI hist?rica s?lo se reutilizar? donde pueda leer esos contratos sin inventar precio, GPS, ETA, certificaci?n o recomendaci?n comercial.
