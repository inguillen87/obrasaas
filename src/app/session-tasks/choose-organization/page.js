import { TaskChooseOrganization } from '@clerk/nextjs';
import AuthShell from '@/app/auth-shell';

export const metadata = {
  title: 'Seleccionar organización',
  robots: { index: false, follow: false },
};

export default function ChooseOrganizationTaskPage() {
  return (
    <AuthShell
      eyebrow="Contexto de trabajo"
      title="Elegí dónde vas a operar."
      description="La organización activa define el perímetro de datos, proyectos, miembros e integraciones disponible durante esta sesión."
      points={[
        { title: 'Sin cruces de datos', detail: 'Cada organización mantiene su propio perímetro operativo.' },
        { title: 'Cambio controlado', detail: 'El contexto activo acompaña cada consulta y mutación.' },
        { title: 'Auditoría consistente', detail: 'Las acciones quedan vinculadas al tenant correcto.' },
      ]}
    >
      <TaskChooseOrganization redirectUrlComplete="/dashboard" />
    </AuthShell>
  );
}
