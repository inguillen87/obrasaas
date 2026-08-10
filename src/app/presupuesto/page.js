import PresupuestoClient from './presupuesto-client';
import { requireSuperadmin } from '@/lib/access';
import { resolvePageAccess } from '@/lib/page-access';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Alcance contractual',
  robots: { index: false, follow: false },
};

export default async function PresupuestoPage() {
  await resolvePageAccess(() => requireSuperadmin());
  return <PresupuestoClient />;
}
