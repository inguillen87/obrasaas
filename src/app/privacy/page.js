import LegalPage, { LegalCallout, LegalSection } from '@/app/legal/legal-page';

export const metadata = {
  title: 'Política de privacidad',
  description: 'Cómo ObraSaaS trata y protege datos de cuentas, obras y WhatsApp Business.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Gobierno de datos"
      title="Política de privacidad"
      lead="Esta política explica qué datos trata ObraSaaS, con qué finalidad y qué controles tienen las organizaciones y las personas que usan la plataforma."
    >
      <LegalCallout>
        Contacto de privacidad: <a href="mailto:guillen.marce@gmail.com">guillen.marce@gmail.com</a>.
        No vendemos datos personales ni compartimos credenciales o información entre tenants.
      </LegalCallout>

      <LegalSection title="1. Alcance y roles">
        <p>
          ObraSaaS es una plataforma de gestión de construcción. La organización que contrata el servicio
          controla los datos de sus obras, empleados, contratistas y contactos. ObraSaaS los procesa para
          prestar el servicio, siguiendo las instrucciones de esa organización y la normativa aplicable.
        </p>
      </LegalSection>

      <LegalSection title="2. Datos que podemos tratar">
        <ul>
          <li>Cuenta: nombre, correo verificado, imagen de perfil, organización, rol y registros de acceso.</li>
          <li>Operación de obra: proyectos, tareas, incidencias, costos, documentos, asistencia y auditoría.</li>
          <li>WhatsApp Business: números, WABA, mensajes, estados, formularios Flows y archivos compartidos.</li>
          <li>Campo: ubicación enviada de forma activa, precisión, fecha, hora y resultado de geocerca.</li>
          <li>Técnicos: dirección IP, eventos de seguridad, errores y métricas necesarias para operar el servicio.</li>
          <li>Comerciales: plan, estado de suscripción y referencias de pago; no almacenamos datos completos de tarjetas.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalidades y bases">
        <p>
          Usamos los datos para autenticar usuarios, aislar tenants, ejecutar flujos de obra, recibir y enviar
          comunicaciones autorizadas, producir trazabilidad, prevenir fraude, brindar soporte y cumplir obligaciones.
          El tratamiento se apoya, según el caso, en el contrato, el consentimiento, obligaciones legales y el
          interés legítimo de mantener el servicio seguro.
        </p>
      </LegalSection>

      <LegalSection title="4. WhatsApp y proveedores">
        <p>
          Cada tenant conecta sus propios activos de Meta. ObraSaaS no reutiliza la app, el WABA, el número ni
          los tokens de otra plataforma. Para operar podemos usar proveedores especializados como Meta/WhatsApp,
          Clerk, Vercel, Neon y, cuando la función esté activada, Cloudinary y procesadores de pago. Cada proveedor
          trata datos bajo sus propias condiciones y medidas de seguridad.
        </p>
      </LegalSection>

      <LegalSection title="5. Conservación y eliminación">
        <p>
          Conservamos datos mientras la cuenta esté activa y durante el período necesario para seguridad,
          facturación o cumplimiento. Ante una solicitud verificada de cierre, programamos la eliminación de datos
          operativos dentro de 30 días; las copias de respaldo se purgan en sus ciclos técnicos, normalmente dentro
          de 90 días, salvo obligación legal o controversia pendiente.
        </p>
      </LegalSection>

      <LegalSection title="6. Seguridad y aislamiento">
        <p>
          Aplicamos control de acceso por rol, alcance por organización y proyecto, cifrado de credenciales,
          verificación de firmas de webhook, registros de auditoría y conexiones cifradas. Ningún sistema elimina
          todo riesgo; notificaremos incidentes relevantes conforme la ley aplicable.
        </p>
      </LegalSection>

      <LegalSection title="7. Transferencias internacionales">
        <p>
          Algunos proveedores procesan datos fuera del país de origen. Usamos mecanismos contractuales y medidas
          razonables para proteger esas transferencias conforme la Ley argentina 25.326 y, cuando corresponda, el RGPD.
        </p>
      </LegalSection>

      <LegalSection title="8. Derechos y consultas">
        <p>
          Podés solicitar acceso, corrección, oposición, portabilidad o eliminación. Primero contactá al administrador
          de tu organización; también podés escribir a <a href="mailto:guillen.marce@gmail.com">guillen.marce@gmail.com</a>.
          Podemos pedir información razonable para verificar identidad y autoridad antes de actuar.
        </p>
      </LegalSection>

      <LegalSection title="9. Cambios">
        <p>
          Publicaremos aquí las actualizaciones materiales y modificaremos la fecha de vigencia. Si un cambio afecta
          sustancialmente derechos u obligaciones, lo comunicaremos por medios razonables dentro de la plataforma.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
