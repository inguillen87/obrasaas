import Link from 'next/link';
import { TaskChooseOrganization } from '@clerk/nextjs';

export const metadata = {
  title: 'Seleccionar organización',
  robots: { index: false, follow: false },
};

export default function ChooseOrganizationTaskPage() {
  return (
    <main style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: '32px 18px', background: 'radial-gradient(circle at 50% 0%, rgba(233,135,69,.16), transparent 34rem), #0b1312' }}>
      <div style={{ width: 'min(100%, 520px)', display: 'grid', justifyItems: 'center', gap: '22px' }}>
        <Link href="/" style={{ color: '#f7f5ef', fontWeight: 850, textDecoration: 'none', letterSpacing: '-.03em' }}>ObraSaaS</Link>
        <TaskChooseOrganization redirectUrlComplete="/dashboard" />
      </div>
    </main>
  );
}
