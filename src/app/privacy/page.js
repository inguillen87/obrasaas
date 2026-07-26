import LegalPage, { LegalCallout, LegalSection } from '@/app/legal/legal-page';

export const metadata = {
  title: 'Política de privacidad',
  description: 'Cómo ObraSaaS trata y protege datos de cuentas, obras, WhatsApp Business e inteligencia artificial.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Política de privacidad | ObraSaaS',
    description: 'Cómo ObraSaaS trata y protege datos de cuentas, obras, WhatsApp Business e inteligencia artificial.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'ObraSaaS',
    url: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Gobierno de datos"
      title="Política de privacidad"
      lead="Esta política explica qué datos trata ObraSaaS, con qué finalidad y qué controles tienen las organizaciones y las personas que usan la plataforma."
      updatedAt="26 de julio de 2026"
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
          <li>IA opcional: consultas al Supervisor, contexto operativo acotado, audios habilitados para transcripción, copias de imágenes sin metadatos embebidos y resultados generados.</li>
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
          trata datos bajo sus propias condiciones y medidas de seguridad. Los proveedores de IA actúan como
          subencargados adicionales solo para las finalidades que un administrador del tenant active expresamente.
        </p>
      </LegalSection>

      <LegalSection id="openai-processing" title="5. Inteligencia artificial y proveedores">
        <p>
          Las funciones con IA están desactivadas por defecto y se controlan por separado. El Supervisor IA
          envía la pregunta, hasta ocho mensajes del historial de esa consulta y un contexto compacto de la obra activa:
          identificación y estado del proyecto, métricas, tareas, asistencia, materiales, incidentes y texto operativo
          reciente. La transcripción envía el archivo de audio compatible recibido por WhatsApp, el idioma y una breve
          indicación de contexto constructivo. Desactivarlas impide nuevas solicitudes a OpenAI; los audios pueden seguir
          almacenándose como evidencia privada sin ser transcritos. La lectura visual envía una copia validada de la
          imagen sin metadatos embebidos, junto con el título y estado acotado de la tarea vinculada. Devuelve hechos
          visibles, limitaciones y, cuando existe contexto suficiente, un rango de avance propuesto. No certifica obra,
          no habilita pagos, no determina asistencia y no modifica el cronograma. ObraSaaS registra en su auditoría el proveedor, el
          modelo, el resultado técnico, la longitud de la consulta y el actor que la inició, pero no copia el texto de la
          pregunta dentro del registro de auditoría.
        </p>
        <p>
          Cuando el proveedor configurado es OpenAI, el Supervisor y la lectura visual usan la API Responses con
          <code>store: false</code> y un identificador de seguridad seudónimo. Según la documentación vigente de OpenAI,
          los datos enviados por API no se usan para entrenar modelos por defecto salvo adhesión voluntaria. Esto no
          significa retención cero: por defecto, Responses puede generar registros de control de abuso conservados hasta
          30 días, salvo configuración contractual distinta o exigencia legal. La tabla vigente de OpenAI informa que
          <code>/v1/audio/transcriptions</code> no conserva estado de aplicación ni registros de abuso. Los proveedores
          alternativos de evaluación, incluidos endpoints privados de Hugging Face o Z.ai, permanecen desactivados
          hasta que exista una configuración contractual y técnica específica para el tenant. Consultá los
          detalles y excepciones en los <a href="https://developers.openai.com/api/docs/guides/your-data">controles de datos de OpenAI</a>.
        </p>
        <p>
          ObraSaaS conserva las respuestas y transcripciones que pasan a integrar la operación o evidencia conforme la
          sección siguiente. La organización debe informar a trabajadores, contratistas y demás personas involucradas y
          determinar la base legal o autorización aplicable antes de activar cada finalidad. La declaración del administrador
          registra esa decisión organizacional, pero no sustituye el consentimiento individual cuando la ley lo exige.
          Los resultados de IA pueden contener errores y requieren revisión humana antes de cualquier decisión profesional.
        </p>
      </LegalSection>

      <LegalSection title="6. Conservación y eliminación">
        <p>
          Conservamos datos mientras la cuenta esté activa y durante el período necesario para seguridad,
          facturación o cumplimiento. Ante una solicitud verificada de cierre, programamos la eliminación de datos
          operativos dentro de 30 días; las copias de respaldo se purgan en sus ciclos técnicos, normalmente dentro
          de 90 días, salvo obligación legal o controversia pendiente.
        </p>
      </LegalSection>

      <LegalSection title="7. Seguridad y aislamiento">
        <p>
          Aplicamos control de acceso por rol, alcance por organización y proyecto, cifrado de credenciales,
          verificación de firmas de webhook, registros de auditoría y conexiones cifradas. Ningún sistema elimina
          todo riesgo; notificaremos incidentes relevantes conforme la ley aplicable.
        </p>
      </LegalSection>

      <LegalSection title="8. Transferencias internacionales">
        <p>
          Algunos proveedores procesan datos fuera del país de origen. Usamos mecanismos contractuales y medidas
          razonables para proteger esas transferencias conforme la Ley argentina 25.326 y, cuando corresponda, el RGPD.
        </p>
      </LegalSection>

      <LegalSection title="9. Derechos y consultas">
        <p>
          Podés solicitar acceso, corrección, oposición, portabilidad o eliminación. Primero contactá al administrador
          de tu organización; también podés escribir a <a href="mailto:guillen.marce@gmail.com">guillen.marce@gmail.com</a>.
          Podemos pedir información razonable para verificar identidad y autoridad antes de actuar.
        </p>
      </LegalSection>

      <LegalSection title="10. Cambios">
        <p>
          Publicaremos aquí las actualizaciones materiales y modificaremos la fecha de vigencia. Si un cambio afecta
          sustancialmente derechos u obligaciones, lo comunicaremos por medios razonables dentro de la plataforma.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
