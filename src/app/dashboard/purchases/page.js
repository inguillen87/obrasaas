import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { listPurchaseOrders } from '@/lib/purchase-orders';
import styles from '../extra-work/extra-work.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Compras', description: 'Órdenes y recepción de materiales.' };

export default async function PurchasesPage() { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); const data = await listPurchaseOrders(getPrisma(), { organizationId: access.organization.id, projectId: access.project.id }); return <main className={styles.shell}><header><span>S9 · abastecimiento</span><h1>Compras y recepción</h1><p>{access.project.name} · órdenes vinculadas a proveedores y presupuesto.</p></header><section className={styles.panel}><h2>Órdenes de compra</h2>{data.purchaseOrders.length === 0 ? <p>No hay órdenes registradas.</p> : <ul>{data.purchaseOrders.map((order) => <li key={order.id}><div><strong>{order.number} · {order.supplier?.legalName || 'Proveedor'}</strong><span>{order.status} · {order.currency} {order.total} · revisión {order.revision}</span><p>{order.lines?.length || 0} líneas · compromiso presupuestario al aprobar</p></div></li>)}</ul>}</section></main>; }
