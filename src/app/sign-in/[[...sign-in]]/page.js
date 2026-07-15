import { SignIn } from '@clerk/nextjs';
import AuthShell from '@/app/auth-shell';

export const metadata = {
  title: 'Ingresar',
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="Centro operativo"
      title="Volvé a decidir con evidencia."
      description="Ingresá al espacio de tu organización para seguir avances, cuadrillas, suministros, reportes e integraciones desde un único lugar."
      points={[
        { title: 'Acceso seguro', detail: 'Sesiones y organizaciones administradas con Clerk.' },
        { title: 'Roles reales', detail: 'Cada persona ve y modifica sólo lo que corresponde.' },
        { title: 'Continuidad operativa', detail: 'Campo, oficina y dirección sobre la misma trazabilidad.' },
      ]}
    >
      <SignIn
        fallbackRedirectUrl="/dashboard"
        signUpUrl="/sign-up"
      />
    </AuthShell>
  );
}
