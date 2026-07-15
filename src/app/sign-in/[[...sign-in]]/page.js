import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';

export const metadata = {
  title: 'Ingresar',
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <main style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: '32px 18px', background: 'radial-gradient(circle at 50% 0%, rgba(233,135,69,.16), transparent 34rem), #0b1312' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: '22px' }}>
        <Link href="/" style={{ color: '#f7f5ef', fontWeight: 850, textDecoration: 'none', letterSpacing: '-.03em' }}>ObraSaaS</Link>
        <SignIn />
      </div>
    </main>
  );
}
