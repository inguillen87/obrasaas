import LegalPage, { LegalCallout, LegalSection } from '@/app/legal/legal-page';

export const metadata = {
  title: 'Eliminación de datos',
  description: 'Instrucciones para solicitar la eliminación de datos personales y de WhatsApp en ObraSaaS.',
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="Control del usuario"
      title="Solicitar eliminación de datos"
      lead="Podés pedir la eliminación de tu cuenta personal o de los datos de una organización. Verificamos identidad y autoridad para evitar borrados fraudulentos."
    >
      <LegalCallout>
        Enviá la solicitud a <a href="mailto:guillen.marce@gmail.com?subject=Solicitud%20de%20eliminación%20de%20datos%20-%20ObraSaaS">guillen.marce@gmail.com</a> con
        el asunto “Solicitud de eliminación de datos - ObraSaaS”.
      </LegalCallout>

      <LegalSection title="Qué incluir">
        <ol>
          <li>Correo usado para iniciar sesión en ObraSaaS.</li>
          <li>Nombre de la organización y, si corresponde, de la obra.</li>
          <li>Si pedís eliminar tu cuenta personal o todos los datos del tenant.</li>
          <li>Un medio de contacto para completar la verificación.</li>
        </ol>
      </LegalSection>

      <LegalSection title="Cómo procesamos la solicitud">
        <ol>
          <li>Confirmamos recepción y verificamos identidad y permisos.</li>
          <li>Si sos miembro de un tenant, avisamos al administrador cuando sea necesario.</li>
          <li>Desactivamos accesos y credenciales vinculadas.</li>
          <li>Programamos el borrado de datos operativos dentro de 30 días.</li>
          <li>Las copias de respaldo se purgan en sus ciclos técnicos, normalmente dentro de 90 días.</li>
        </ol>
      </LegalSection>

      <LegalSection title="Qué puede conservarse">
        <p>
          Podemos retener registros mínimos cuando una ley, obligación fiscal, investigación de seguridad o conflicto
          vigente lo exija. Esos datos quedan restringidos y no se usan para otros fines.
        </p>
      </LegalSection>

      <LegalSection title="Facebook y WhatsApp">
        <p>
          Desactivar una conexión en ObraSaaS elimina las credenciales almacenadas localmente, pero no borra el WABA
          ni el número propiedad del cliente. Para borrar activos de Meta también debés administrarlos desde Meta
          Business Manager o solicitarlo directamente a Meta.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
