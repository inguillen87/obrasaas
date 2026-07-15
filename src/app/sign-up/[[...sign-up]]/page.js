import { SignUp } from '@clerk/nextjs';
import AuthShell from '@/app/auth-shell';

export const metadata = {
  title: 'Crear organización',
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="14 días para operar"
      title="Tu obra, ordenada desde el primer día."
      description="Creá la cuenta de tu organización. ObraSaaS prepara un workspace aislado y una obra inicial para que el equipo pueda empezar sin configurar infraestructura."
      points={[
        { title: 'Sin tarjeta', detail: 'Probá el flujo completo durante 14 días.' },
        { title: 'Tenant aislado', detail: 'Personas, evidencias y proyectos separados desde el alta.' },
        { title: 'Listo para equipo', detail: 'Administración, dirección, jefatura y auditoría con permisos claros.' },
      ]}
    >
      <SignUp
        fallbackRedirectUrl="/dashboard"
        signInUrl="/sign-in"
      />
    </AuthShell>
  );
}
