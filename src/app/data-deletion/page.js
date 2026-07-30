import LegalPage, { LegalCallout, LegalSection } from '@/app/legal/legal-page';

export const metadata = {
  title: 'Eliminación de datos',
  description: 'Instrucciones para ejercer derechos sobre datos personales y de WhatsApp en ObraSaaS.',
  alternates: { canonical: '/data-deletion' },
  openGraph: {
    title: 'Eliminación de datos | ObraSaaS',
    description: 'Instrucciones para ejercer derechos sobre datos personales y de WhatsApp en ObraSaaS.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'ObraSaaS',
    url: '/data-deletion',
  },
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="Control de tus datos"
      title="Solicitudes de privacidad y eliminación"
      lead="Podés pedir acceso, corrección, restricción o, cuando corresponda, eliminación de tus datos. Verificamos identidad, autoridad y alcance para protegerte de solicitudes fraudulentas o dirigidas al tenant equivocado."
      updatedAt="29 de julio de 2026"
    >
      <LegalCallout>
        Enviá la solicitud a <a href="mailto:guillen.marce@gmail.com?subject=Solicitud%20de%20privacidad%20-%20ObraSaaS">guillen.marce@gmail.com</a> con
        el asunto “Solicitud de privacidad - ObraSaaS”. Si tu cuenta sigue activa, usá el mismo correo con el que ingresás.
      </LegalCallout>

      <LegalSection title="Qué incluir">
        <ol>
          <li>El derecho que querés ejercer: acceso, corrección, restricción, oposición, portabilidad o eliminación.</li>
          <li>Correo usado para iniciar sesión o número de WhatsApp vinculado, sin enviar contraseñas, códigos ni datos bancarios.</li>
          <li>Nombre de la organización y, si corresponde, de la obra.</li>
          <li>Un medio de contacto para completar una verificación proporcional.</li>
        </ol>
      </LegalSection>

      <LegalSection title="Cómo procesamos la solicitud">
        <ol>
          <li>Registramos la recepción y verificamos identidad, autoridad y organización.</li>
          <li>Identificamos las categorías y sistemas alcanzados, incluidos proveedores cuando corresponda.</li>
          <li>Evaluamos por categoría si corresponde acceder, corregir, restringir, eliminar, anonimizar o conservar un registro mínimo con una base aplicable.</li>
          <li>Informamos la decisión y cualquier paso pendiente o excepción fundada dentro del plazo legal aplicable.</li>
          <li>No declaramos la solicitud completada mientras exista un sistema, proveedor o copia alcanzada sin resultado verificable.</li>
        </ol>
      </LegalSection>

      <LegalSection title="Qué puede conservarse">
        <p>
          La eliminación no siempre implica borrar todo registro. Podemos restringir y conservar evidencia mínima cuando
          una obligación laboral, fiscal, contable o de seguridad, los derechos de terceros o una controversia vigente
          lo requieran. La decisión debe tener una base concreta y el alcance mínimo necesario.
        </p>
      </LegalSection>

      <LegalSection title="Copias de respaldo y proveedores">
        <p>
          Cuando corresponda eliminar, primero actuamos sobre los sistemas activos. Las copias de respaldo y los
          servicios de terceros deben evaluarse según sus ciclos técnicos, contratos y alcance real. Una restauración
          debe volver a aplicar las solicitudes vigentes antes de habilitar el uso ordinario de los datos. Mientras ese
          circuito no esté verificado, informaremos los pasos pendientes en lugar de presentar la eliminación de la base
          principal como un borrado global.
        </p>
      </LegalSection>

      <LegalSection title="Facebook y WhatsApp">
        <p>
          Desactivar una conexión en ObraSaaS no borra automáticamente la cuenta de WhatsApp Business, el WABA ni el
          número propiedad del cliente. Evaluamos los datos tratados por ObraSaaS y, cuando corresponda, propagamos o
          indicamos la acción que debe completarse en Meta Business Manager o directamente ante Meta.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
