import Link from 'next/link';
import { publicPageMetadata } from '../public-site-metadata.mjs';
import { LegalEmail, LegalNotice, LegalPage, LegalSection } from '../legal/legal-page';

export const metadata = publicPageMetadata('/terminos');

const contents = [
  ['servicio', 'Titular y alcance'],
  ['cuentas', 'Cuentas y permisos'],
  ['registros', 'Registros y decisiones'],
  ['asistencia', 'Asistencia y revisión'],
  ['whatsapp', 'Servicios externos'],
  ['condiciones', 'Prueba y condiciones'],
  ['uso', 'Uso responsable'],
  ['contacto', 'Consultas y cambios'],
];

export default function TermsPage() {
  return (
    <LegalPage pathname="/terminos" title="Términos de uso" description="Las condiciones para utilizar ObraSaaS con tu empresa y tu equipo, y el alcance de los registros, revisiones y servicios externos." contents={contents}>
      <LegalSection id="servicio" title="1. Titular y alcance del servicio">
        <p>ObraSaaS es un producto de Inmovar LATAM cuyo titular es <strong>GUILLEN ALBA, MARCELO ARIEL</strong>, con nombre registrado en ARCA <strong>GUILLEN MARCELO ARIEL</strong>. El contacto del servicio es <LegalEmail subject="ObraSaaS — Consulta sobre el servicio" />.</p>
        <p>La plataforma permite organizar empresas, obras, tareas y participantes, y registrar jornadas, incidencias, evidencia, propuestas de avance y circuitos de materiales, compras y entregas. Las funciones disponibles dependen de los permisos, el estado de la empresa y las conexiones habilitadas.</p>
        <p>Estas condiciones describen el uso disponible. Las condiciones comerciales que se acuerden expresamente con una empresa se informan por separado. La demo presenta datos ilustrativos y no constituye una operación real de tu empresa.</p>
      </LegalSection>
      <LegalSection id="cuentas" title="2. Cuenta personal y permisos de la empresa">
        <p>Usá tu propia cuenta y completá las verificaciones que indique el acceso. Conservá tus credenciales y códigos de ingreso de forma privada. Si sospechás un acceso indebido, informalo al contacto del servicio y al responsable de tu empresa.</p>
        <p>La empresa debe incorporar a las personas autorizadas y revisar sus roles y obras asignadas. Una sesión iniciada, un teléfono escrito o una ficha de participante no otorgan por sí solos autorización para registrar actividad o decidir sobre una obra.</p>
        <p>Antes de guardar, comprobá qué empresa y obra están abiertas. Los permisos de administración, dirección, consulta y operación de campo tienen alcances distintos.</p>
      </LegalSection>
      <LegalSection id="registros" title="3. Registros, propuestas y decisiones">
        <p>Registrá información que puedas aportar y revisar. Las propuestas de avance, consumo o compra siguen su circuito de autorización; presentar una propuesta no implica aprobarla. La persona habilitada debe comprobar su fundamento, cantidades, unidades y evidencia antes de decidir.</p>
        <p>Consultar un archivo, un mensaje o un recibo no prueba por sí solo que un trabajo se realizó, que una compra se pagó o que una entrega se recibió. Los registros deben interpretarse junto con la evidencia y las decisiones correspondientes.</p>
        <LegalNotice title="Cuando un resultado queda pendiente">
          <p>Si un envío o guardado tiene un resultado incierto, consultá su recibo antes de repetirlo. El <Link href="/manual#recuperacion">manual de recuperación</Link> explica cómo revisar el estado. La consulta requiere conexión y permisos vigentes.</p>
        </LegalNotice>
      </LegalSection>
      <LegalSection id="asistencia" title="4. Análisis asistido y revisión humana">
        <p>Las extracciones de texto, transcripciones, interpretaciones, comparaciones o previsiones asistidas pueden contener errores. Revisá los resultados contra su fuente antes de utilizarlos para planificar o tomar una decisión.</p>
        <p>Los análisis opcionales de documentos y evidencia requieren las autorizaciones específicas del recorrido. Podés continuar con revisión manual cuando ese flujo la ofrece. La lectura o comparación de imágenes no certifica identidad civil, autenticidad del documento ni prueba de vida.</p>
        <p>Una previsión, un borrador o una extracción no sustituyen las decisiones del responsable de la obra ni una revisión profesional requerida para un documento técnico, legal o económico. ObraSaaS no garantiza un resultado de obra o una aprobación externa a partir de esos contenidos.</p>
      </LegalSection>
      <LegalSection id="whatsapp" title="5. WhatsApp y otros servicios externos">
        <p>La conexión de WhatsApp requiere la autorización de la empresa sobre sus activos y completar los requisitos que Meta solicite. La publicación de una página o la disponibilidad de un botón no acreditan aprobación de Meta, conexión de un número ni entrega de mensajes.</p>
        <p>Las invitaciones, verificaciones de acceso, permisos, plantillas y estados de envío dependen también de sus proveedores. ObraSaaS informa el estado disponible; no garantiza sus aprobaciones, disponibilidad o tiempos de respuesta.</p>
        <p>La conexión con BINDX para una operación financiera real no está habilitada. Registrar un identificador bancario privado o presentar identidad no abre una cuenta financiera, ejecuta pagos ni sustituye una autorización futura.</p>
      </LegalSection>
      <LegalSection id="condiciones" title="6. Período de prueba y condiciones comerciales">
        <p>Cuando una empresa dispone de un período de prueba, su vigencia y vencimiento son los registrados para esa empresa. Consultá el estado informado en tu cuenta; no se presume una prórroga o una suscripción activa por seguir teniendo una cuenta personal.</p>
        <p>El acceso a operaciones puede depender de ese estado. Si el período terminó o el estado no puede confirmarse, consultá al responsable o escribí al contacto del servicio para conocer las condiciones disponibles.</p>
        <p>Una pantalla de la demo, un mensaje de contacto o una solicitud de información no constituye un cobro ni la contratación de un plan pago. Precio, alcance y forma de pago deben informarse y acordarse expresamente antes de contratar.</p>
      </LegalSection>
      <LegalSection id="uso" title="7. Uso responsable y datos personales">
        <p>Utilizá la plataforma dentro de tus permisos. No intentes acceder a otra empresa, eludir revisiones, suplantar personas ni incorporar contenido ilícito. Compartí documentos, imágenes, voces o ubicación de otras personas sólo cuando puedas hacerlo para la finalidad indicada.</p>
        <p>Los responsables deben revisar los permisos del equipo y atender las consultas sobre registros de su empresa. ObraSaaS debe atender los pedidos sobre el tratamiento que realiza y verificar la persona y el alcance antes de compartir, corregir o eliminar información.</p>
        <p>La <Link href="/privacidad">política de privacidad</Link> describe los datos, finalidades, proveedores y autorizaciones. El <Link href="/eliminacion-datos">procedimiento de eliminación</Link> explica cómo presentar una solicitud. Desconectar un canal o retirar un permiso no borra automáticamente todos los registros previos.</p>
      </LegalSection>
      <LegalSection id="contacto" title="8. Consultas y actualizaciones">
        <p>Para dudas sobre estas condiciones, incidencias o una solicitud vinculada al servicio, escribí a <LegalEmail subject="ObraSaaS — Consulta sobre términos de uso" />. Incluí la empresa y una descripción breve; no envíes contraseñas, códigos de acceso ni documentos privados por correo.</p>
        <p>Esta página indica su fecha de actualización. Un cambio que requiera una nueva autorización o un acuerdo comercial específico se informará en el recorrido correspondiente. Estos términos no limitan los derechos que reconoce la normativa aplicable.</p>
      </LegalSection>
    </LegalPage>
  );
}
