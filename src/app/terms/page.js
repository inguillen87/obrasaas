import LegalPage, { LegalCallout, LegalSection } from '@/app/legal/legal-page';

export const metadata = {
  title: 'Términos del servicio',
  description: 'Condiciones aplicables al uso de la plataforma ObraSaaS.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Términos del servicio | ObraSaaS',
    description: 'Condiciones aplicables al uso de la plataforma ObraSaaS.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'ObraSaaS',
    url: '/terms',
  },
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Acuerdo de servicio"
      title="Términos de uso"
      lead="Estas condiciones regulan el acceso y uso de ObraSaaS por empresas, profesionales, equipos de obra y organismos habilitados."
    >
      <LegalCallout>
        Al crear una cuenta o usar la plataforma, la organización confirma que su representante tiene autoridad
        suficiente y que usará WhatsApp y los datos de personas conforme la ley y las políticas de Meta.
      </LegalCallout>

      <LegalSection title="1. Servicio y cuenta">
        <p>
          ObraSaaS ofrece herramientas de operación, comunicación, evidencia, control y análisis de obras. Cada
          organización es responsable por sus usuarios, roles, credenciales, proyectos y la exactitud de la información cargada.
        </p>
      </LegalSection>

      <LegalSection title="2. Prueba y planes">
        <p>
          La prueba inicial dura 14 días, salvo oferta distinta. Luego, el servicio puede continuar bajo un plan Pro
          o Enterprise acordado. Los medios de cobro pueden incluir transferencia, Mercado Pago o Stripe. La
          automatización de mensualidades puede habilitarse más adelante y se informará antes de cualquier débito.
        </p>
      </LegalSection>

      <LegalSection title="3. Uso permitido">
        <ul>
          <li>Usar la plataforma solo para actividades legítimas y autorizadas de la organización.</li>
          <li>No enviar spam, suplantar identidades, vulnerar sistemas ni intentar acceder a otro tenant.</li>
          <li>Obtener permisos laborales y de privacidad para ubicación, asistencia, mensajes y documentación.</li>
          <li>Cumplir las políticas de WhatsApp Business, incluidas plantillas, consentimiento y ventanas de conversación.</li>
          <li>No usar el servicio para campañas políticas ni usos gubernamentales restringidos por Meta.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Datos y activos del cliente">
        <p>
          La organización conserva la titularidad sobre sus datos, WABA, números, documentos y contenido. Otorga a
          ObraSaaS una autorización limitada para procesarlos y prestar el servicio. Las credenciales se aíslan por tenant
          y se eliminan de ObraSaaS cuando la conexión se desactiva.
        </p>
      </LegalSection>

      <LegalSection title="5. Decisiones profesionales">
        <p>
          La plataforma ayuda a registrar y organizar información, pero no reemplaza el criterio de arquitectos,
          ingenieros, responsables de higiene y seguridad, contadores, asesores legales o autoridades. Las aprobaciones
          de compras, certificaciones y decisiones críticas requieren revisión humana autorizada.
        </p>
      </LegalSection>

      <LegalSection title="6. Disponibilidad y cambios">
        <p>
          Trabajamos para mantener un servicio confiable, pero pueden existir mantenimientos, fallas de terceros o
          cambios regulatorios. Podemos mejorar, reemplazar o retirar funciones con aviso razonable cuando afecten de
          forma material el uso contratado.
        </p>
      </LegalSection>

      <LegalSection title="7. Suspensión y terminación">
        <p>
          Podemos limitar escritura por falta de pago, suspender acceso ante riesgo de seguridad o incumplimiento y
          terminar cuentas usadas de forma ilícita. La organización puede solicitar el cierre y exportación razonable
          de sus datos antes de la eliminación, sujeto a obligaciones legales.
        </p>
      </LegalSection>

      <LegalSection title="8. Responsabilidad">
        <p>
          En la máxima medida permitida por ley, ObraSaaS no responde por decisiones basadas en datos incorrectos,
          acciones de usuarios, interrupciones de terceros ni daños indirectos. Nada limita derechos inderogables del consumidor
          ni responsabilidad que legalmente no pueda excluirse.
        </p>
      </LegalSection>

      <LegalSection title="9. Contacto y ley aplicable">
        <p>
          Consultas: <a href="mailto:guillen.marce@gmail.com">guillen.marce@gmail.com</a>. Salvo norma imperativa distinta,
          estas condiciones se interpretan bajo las leyes de la República Argentina.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
