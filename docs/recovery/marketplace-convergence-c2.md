# Sprint C-2.1 — Marketplace sobre abastecimiento real

Base: Sprint C-1 en `release/enterprise-unified-2026`. La ruta histórica `/marketplace` mantiene un alias temporal a `/dashboard/purchases`; el módulo destino adopta ahora la jerarquía visual de Marketplace sin importar los catálogos mock de master.

## Datos que sí son autoridad
La pantalla utiliza las props ya obtenidas por `dashboard/purchases/page.js`: proveedores activos del tenant, PurchaseOrder de la obra, GoodsReceipt publicados, compromisos de proveedor, líneas presupuestarias y materiales/tareas autorizados. Crear y aprobar órdenes sigue llamando los endpoints existentes y sus controles transaccionales; recepción, compromisos e inventario continúan en sus clientes actuales.

La cabecera y los KPIs calculan únicamente filas cargadas: proveedores activos, órdenes abiertas/aprobadas, recepciones incluidas en la lectura y compromisos. «Recepciones cargadas» no promete un total histórico cuando la consulta está truncada. Los filtros de orden son locales sobre las órdenes autorizadas ya recibidas y no generan consultas nuevas.

## Datos que NO se importan de master
No se portan `INITIAL_PROVIDERS`, ratings, precios de lista, productos, radio de cobertura, política de flete, ETA/GPS, recomendaciones de oferta ni matrices comparativas estáticas. Ninguno de esos valores se presenta como dato real hasta disponer de un contrato persistente y una fuente verificable. Tampoco se habilita eCheq o MercadoPago por mostrar un término de pago existente.

El directorio muestra nombre legal, moneda y condición de pago de proveedores activos; no expone identificadores fiscales en las tarjetas. El verificador incluye un canary fiscal privado y exige que no llegue a la UI.

## UX
Nueva cabecera «Marketplace & compras», navegación rápida, cinco KPIs, directorio de proveedores, búsqueda literal por número/proveedor/material, filtro por estado, estados legibles y formulario de orden colapsable. La navegación del dashboard usa el mismo nombre. En móvil los formularios y filtros pasan a una columna, inputs/selects mantienen 16 px y las tarjetas no generan overflow horizontal.

## Aceptación
Pruebas puras para resumen, filtro y estados, y navegador sobre PurchasesClient real con HTTP controlado. El navegador comprueba búsqueda sin red, privacidad del canary, creación idempotente de un borrador, decisión de aprobación y 320/390/768/1280 px. Los submódulos de recepción, compromisos y materiales se aíslan en ese verificador porque conservan sus propias suites; la suite completa debe seguir en verde.

No es evidencia de proveedores, precios o transacciones comerciales reales del usuario. Sin nuevas migraciones, tablas, endpoints o permisos. La convergencia visual de comparador y cotizaciones queda pendiente de un dominio de ofertas persistente; no se resuelve con datos demo.
