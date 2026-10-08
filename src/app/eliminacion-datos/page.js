import Link from 'next/link';
import { publicPageMetadata } from '../public-site-metadata.mjs';
import { LegalEmail, LegalNotice, LegalPage, LegalSection } from '../legal/legal-page';

export const metadata = publicPageMetadata('/eliminacion-datos');

const contents = [
  ['solicitud', 'Enviar una solicitud'],
  ['verificacion', 'Verificación y seguimiento'],
  ['alcance', 'Qué datos abarca'],
  ['whatsapp', 'Revocar WhatsApp'],
  ['seguimiento', 'Contacto y derechos'],
];

export default function DataDeletionPage() {
  return (
    <LegalPage pathname="/eliminacion-datos" title="Eliminación de datos" description="Podés solicitar la eliminación de tus datos en ObraSaaS por correo. El pedido se verifica y se revisa de forma manual, con información sobre su alcance y resultado." contents={contents}>
      <LegalSection id="solicitud" title="1. Enviá tu solicitud">
        <p>Escribí a <LegalEmail subject="ObraSaaS — Solicitud de eliminación de datos" /> con el asunto <strong>ObraSaaS — Solicitud de eliminación de datos</strong>. Si tenés acceso al correo asociado a tu cuenta, utilizalo para facilitar la verificación.</p>
        <p>En el primer mensaje, incluí únicamente:</p>
        <ul>
          <li>Un identificador mínimo para ubicar tu cuenta o participación: el correo o teléfono que utilizaste en ObraSaaS.</li>
          <li>El nombre de la empresa vinculada, si corresponde. No hace falta enviar una nómina de participantes.</li>
          <li>El alcance que solicitás: cuenta, vínculo de WhatsApp, documentos de identidad, archivos aportados u otros datos concretos.</li>
        </ul>
        <LegalNotice title="Enviá sólo lo necesario">
          <p>No adjuntes DNI, selfie, contraseñas, códigos de acceso, tokens, números completos de tarjeta ni información de otras personas. Si necesitamos verificar algo más, acordaremos un medio adecuado antes de solicitarlo.</p>
        </LegalNotice>
        <p><LegalEmail subject="ObraSaaS — Solicitud de eliminación de datos">Abrir un correo para solicitar la eliminación</LegalEmail>. Este enlace abre tu aplicación de correo; el pedido se envía cuando confirmás el mensaje allí.</p>
      </LegalSection>
      <LegalSection id="verificacion" title="2. Cómo se tramita el pedido">
        <ol>
          <li><strong>Recepción:</strong> el contacto del servicio revisa el correo y responde manualmente con un acuse y una referencia para seguir la solicitud. No se genera un recibo automático desde esta página.</li>
          <li><strong>Verificación:</strong> se comprueba que la solicitud proviene de la persona titular o de alguien autorizado. Antes de esa comprobación no se revelan ni eliminan datos de una cuenta.</li>
          <li><strong>Revisión del alcance:</strong> se identifican los datos y, si están vinculados a registros de una empresa, se coordina con su responsable. Puede ser necesario aclarar qué parte del registro corresponde a tu solicitud.</li>
          <li><strong>Respuesta:</strong> se informa el resultado, los datos eliminados o desvinculados y cualquier categoría que deba conservarse, con su motivo. Si una gestión adicional corresponde a un proveedor, también se informa.</li>
        </ol>
        <p>La atención debe respetar los plazos legales aplicables. Esta página no promete una eliminación instantánea ni la supresión automática de todos los sistemas al enviar el correo.</p>
      </LegalSection>
      <LegalSection id="alcance" title="3. Alcance y conservación necesaria">
        <p>Podés pedir la eliminación de datos de tu cuenta, participación, documentos privados, identificadores bancarios o evidencia que hayas aportado, indicando el alcance. También podés solicitar acceso, rectificación o actualización cuando sea lo que necesitás.</p>
        <p>Algunas funciones permiten retirar declaraciones propias desde la cuenta. Para una solicitud general de eliminación o para revisar otras copias o registros, utilizá el procedimiento por correo indicado en esta página.</p>
        <p>Una cuenta personal, su acceso a una empresa y los registros operativos de una obra son elementos distintos. Eliminar o desvincular tu cuenta no implica eliminar toda la obra, los datos de otros participantes o un registro que deba conservarse por una obligación aplicable.</p>
        <p>No se ha adoptado un plazo general fijo de conservación. Si corresponde mantener datos por una obligación legal, por la operación autorizada o para recuperación técnica, la respuesta indicará la categoría, el motivo y el alcance de esa conservación.</p>
        <p>Las copias en Meta/WhatsApp, Clerk u otros proveedores, respaldos sujetos a su ciclo de conservación y mensajes o archivos en dispositivos de otras personas pueden tener un tratamiento independiente. Se informará qué gestión puede realizar ObraSaaS y qué pasos adicionales se necesitan, sin afirmar que una acción borra todas esas copias.</p>
      </LegalSection>
      <LegalSection id="whatsapp" title="4. Revocar o desconectar WhatsApp">
        <p>La empresa puede revisar y revocar los permisos de la conexión mediante las opciones disponibles de Meta/WhatsApp Business. Una persona también puede solicitar que se revise o retire su vínculo de WhatsApp con una obra.</p>
        <p>Revocar permisos o desconectar el canal limita su utilización posterior. No equivale a eliminar los mensajes y registros ya recibidos en ObraSaaS, Meta o los teléfonos de los interlocutores. Para pedir esa revisión, enviá la solicitud por correo e indicá que se refiere a WhatsApp.</p>
      </LegalSection>
      <LegalSection id="seguimiento" title="5. Seguimiento y otros derechos">
        <p>Para consultar un pedido, respondé al mismo correo con su referencia. Si no recibiste el acuse, contactá a <LegalEmail subject="ObraSaaS — Seguimiento de solicitud de datos" /> indicando la fecha del mensaje inicial. No repitas adjuntos privados.</p>
        <p>Consultá la <Link href="/privacidad">política de privacidad</Link> para conocer las finalidades y proveedores. La AAIP explica <a href="https://www.argentina.gob.ar/aaip/datospersonales/derechos">tus derechos sobre los datos personales</a> y cómo <a href="https://www.argentina.gob.ar/servicio/denunciar-incumplimientos-de-la-ley-de-proteccion-de-datos-personales">presentar una denuncia si no se atienden conforme a la ley</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
