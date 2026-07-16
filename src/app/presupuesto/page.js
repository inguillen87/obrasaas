import PresupuestoClient from './presupuesto-client';
import { requireSuperadmin } from '@/lib/access';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Alcance contractual | ObraSaaS',
  robots: { index: false, follow: false },
};

export default async function PresupuestoPage() {
  await requireSuperadmin();
  return <PresupuestoClient />;
}
