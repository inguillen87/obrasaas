import Link from 'next/link';
import { publicPageMetadata } from '../public-site-metadata.mjs';
import { LegalEmail, LegalNotice, LegalPage, LegalSection } from '../legal/legal-page';

export const metadata = publicPageMetadata('/privacidad');

const contents = [
  ['responsable', 'Responsable y contacto'],
  ['datos', 'Datos y finalidades'],
  ['permisos', 'Empresa, obra y permisos'],
  ['identidad', 'Documentos y revisión'],
  ['whatsapp', 'WhatsApp y Meta'],
  ['evidencia', 'Fotos, audio y ubicación'],
  ['proveedores', 'Proveedores del servicio'],
  ['conservacion', 'Conservación y protección'],
  ['derechos', 'Tus derechos'],
  ['cambios', 'Actualizaciones'],
];

export default function PrivacyPage() {
  return (
    <LegalPage pathname="/privacidad" title="Política de privacidad" description="Qué datos utiliza ObraSaaS, para qué se necesitan y cómo podés consultar, corregir o solicitar su eliminación." contents={contents}>
      <LegalSection id="responsable" title="1. Responsable del servicio y contacto">
        <p>ObraSaaS es un producto de Inmovar LATAM. Su titular es <strong>GUILLEN ALBA, MARCELO ARIEL</strong>, con nombre registrado en ARCA <strong>GUILLEN MARCELO ARIEL</strong>.</p>
        <p>Para consultas sobre privacidad o solicitudes sobre tus datos, escribí a <LegalEmail subject="ObraSaaS — Consulta de privacidad" />. Este canal también recibe pedidos de acceso, rectificación, actualización y supresión.</p>
        <p>Cada empresa usuaria organiza los registros de sus obras y administra la incorporación y los permisos de su equipo. Si tu consulta alcanza registros administrados por una empresa, coordinaremos con su responsable para verificar el alcance y atenderla sin revelar información de otras personas.</p>
      </LegalSection>
      <LegalSection id="datos" title="2. Qué datos se utilizan y para qué">
        <ul>
          <li><strong>Cuenta e ingreso:</strong> identificador de cuenta, nombre, correo y verificaciones de acceso; pertenencia a organizaciones e invitaciones. El ingreso se gestiona con Clerk, por correo o mediante los proveedores de acceso social que estén configurados y elijas utilizar.</li>
          <li><strong>Empresa y obras:</strong> nombre de la empresa, datos de contacto declarados, obras, tareas, fechas, participantes y permisos. Se utilizan para organizar el trabajo y limitar el acceso al ámbito autorizado.</li>
          <li><strong>Operación:</strong> jornadas, incidencias, propuestas de avance, materiales, compras, entregas, notas y archivos que el equipo registre. Se vinculan a la empresa y obra correspondientes para su consulta y revisión.</li>
          <li><strong>Identidad presentada:</strong> datos del participante y las imágenes del documento y selfie que autorice presentar. Se usan para revisión por responsables habilitados, con las opciones que se explican abajo.</li>
          <li><strong>Funcionamiento técnico:</strong> datos de sesión y autorización, eventos, estados de procesamiento y referencias de recibos necesarios para gestionar el acceso, investigar fallos y recuperar operaciones pendientes.</li>
        </ul>
        <p>Si elegís guardar un identificador bancario, como CBU o CVU, en la ficha privada, se utiliza dentro de ese circuito autorizado. Guardarlo no abre una cuenta financiera ni acredita su titularidad.</p>
        <p>Los datos no se venden ni se utilizan para publicidad. El contenido de una empresa no se presenta como información pública del sitio.</p>
      </LegalSection>
      <LegalSection id="permisos" title="3. Quién puede consultar la información">
        <p>El acceso depende de la cuenta, la pertenencia a la empresa, la obra asignada y los permisos vigentes. Los responsables con funciones de administración o dirección pueden tener un alcance mayor dentro de su empresa; otros roles consultan o actúan sólo en los ámbitos habilitados.</p>
        <p>Tener una ficha de participante, un teléfono declarado o una sesión iniciada no concede por sí solo permiso para operar una obra. La empresa debe revisar las invitaciones y asignaciones. Retirar un permiso limita el acceso futuro, pero no equivale a borrar los registros ya incorporados.</p>
      </LegalSection>
      <LegalSection id="identidad" title="4. Documentos, selfie y análisis opcionales">
        <p>La presentación de identidad utiliza imágenes privadas del frente del documento y una selfie, con autorización para su revisión. Incorporar el dorso requiere una autorización separada cuando el flujo lo ofrece. Los responsables habilitados revisan la presentación.</p>
        <ul>
          <li><strong>Lectura asistida opcional:</strong> si la autorizás y el responsable la ejecuta, se envía únicamente el frente del documento a OpenAI para extraer el texto visible. La selfie no se envía para esa lectura. El resultado permanece privado y requiere revisión humana.</li>
          <li><strong>Comparación facial privada opcional:</strong> con autorización independiente, el frente del documento y la selfie pueden procesarse dentro del servicio privado de ObraSaaS para obtener una señal orientativa de comparación. Este circuito no envía esas imágenes a OpenAI para comparar rostros ni conserva vectores faciales.</li>
        </ul>
        <LegalNotice title="La decisión requiere revisión humana">
          <p>Podés continuar con revisión manual sin autorizar esos análisis. La lectura, la comparación facial y una selfie estática no certifican identidad civil, autenticidad del documento ni prueba de vida. Autorizar un procesamiento no aprueba automáticamente la presentación ni habilita WhatsApp para operar.</p>
        </LegalNotice>
      </LegalSection>
      <LegalSection id="whatsapp" title="5. Conexión con WhatsApp y Meta">
        <p>La empresa debe autorizar su cuenta de WhatsApp Business y el número correspondiente mediante el circuito de Meta. ObraSaaS utiliza los identificadores de esos activos, los permisos y las credenciales de conexión para gestionar el canal de esa empresa.</p>
        <p>Cuando se usa el canal, se procesan el teléfono y vínculo del participante, contenido y archivos enviados, identificadores y fechas de mensajes, estados de envío o entrega y contexto de la conversación. Esto permite relacionar un mensaje con su empresa y obra, revisar la evidencia, responder dentro del alcance permitido y consultar el resultado de la operación.</p>
        <p>Si la modalidad permite importar contactos o historial de WhatsApp Business, la importación requiere la autorización específica que se muestra en ese recorrido. Su disponibilidad y alcance dependen de Meta. Un contacto o mensaje importado no concede permisos ni ejecuta por sí solo una operación de obra.</p>
        <p>La conexión y entrega dependen de los requisitos y estados del proveedor. Desconectar el canal o revocar permisos en Meta limita su uso posterior, pero no elimina automáticamente los registros ya conservados en ObraSaaS, Meta o los dispositivos de los interlocutores.</p>
      </LegalSection>
      <LegalSection id="evidencia" title="6. Fotos, audio, video y ubicación compartida">
        <p>El equipo puede aportar archivos privados y ubicación para respaldar registros de la obra. La ubicación se utiliza cuando la persona decide compartirla o autoriza la captura correspondiente; no se presume autorización para seguimiento continuo.</p>
        <p>El análisis asistido de evidencia es opcional. Cuando lo autorizás, OpenAI recibe una copia de la fotografía o del audio, o los cuadros de video indicados en el aviso del flujo. En el recorrido actual, el análisis de video utiliza cuatro cuadros de un video de hasta 40 segundos; transcribir su primera pista de audio requiere una autorización adicional.</p>
        <p>Los resultados y transcripciones quedan privados y requieren revisión humana. No actualizan por sí solos cantidades, avances, asistencia ni permisos. Podés conservar el archivo para revisión manual sin enviarlo para análisis. Antes de aportar imágenes, voces o ubicación de otras personas, comprobá que puedas compartirlas.</p>
      </LegalSection>
      <LegalSection id="proveedores" title="7. Servicios que intervienen">
        <p>ObraSaaS utiliza servicios externos para funciones concretas: <strong>Vercel</strong> para el alojamiento de la aplicación y Blob para archivos privados; <strong>Neon</strong> para la base de datos; <strong>Clerk</strong> para cuentas, sesiones y organizaciones; <strong>Meta/WhatsApp</strong> para el canal autorizado; y <strong>OpenAI</strong> cuando se habilita y autoriza el análisis correspondiente.</p>
        <p>Cada proveedor recibe la información necesaria para la función que realiza y tiene sus propias condiciones de tratamiento. Los datos pueden alojarse o procesarse fuera de Argentina, según la infraestructura y configuración de esos servicios.</p>
        <p>La integración con <strong>BINDX</strong> no está conectada para una operación financiera real. No se abre una cuenta ni se envían documentos a BINDX por registrar un participante. Cualquier futura conexión que implique ese tratamiento requerirá información previa y una nueva autorización específica.</p>
      </LegalSection>
      <LegalSection id="conservacion" title="8. Conservación y medidas de protección">
        <p>Se aplican controles de sesión, pertenencia y permisos, acceso privado a documentos y archivos, y registros de operaciones para limitar el acceso y permitir su revisión. Ningún servicio puede asegurar ausencia absoluta de incidentes.</p>
        <p>No se ha adoptado un plazo general fijo de conservación. Los datos se conservan mientras sean necesarios para la operación autorizada, obligaciones legales aplicables o recuperación técnica de registros y operaciones. La necesidad de conservar un dato se revisa al atender una solicitud.</p>
        <p>Las solicitudes generales de eliminación se atienden mediante revisión manual; algunas funciones permiten retirar declaraciones propias desde la cuenta. No existe una promesa de borrado automático e inmediato de todos los sistemas o respaldos. Si corresponde mantener parte de la información, te informaremos su categoría, motivo y alcance. Las copias o registros de servicios externos y de otras personas pueden requerir gestiones adicionales.</p>
        <p>El navegador utiliza recursos necesarios para la sesión y referencias de operaciones pendientes. Esas referencias ayudan a consultar recibos; no son una copia completa de tus archivos o borradores.</p>
      </LegalSection>
      <LegalSection id="derechos" title="9. Cómo ejercer tus derechos">
        <p>Podés solicitar acceso a tus datos personales y pedir su rectificación, actualización o supresión cuando corresponda, conforme a la Ley 25.326. También podés consultar el tratamiento realizado y solicitar retirar una autorización opcional para usos futuros.</p>
        <p>Escribí a <LegalEmail subject="ObraSaaS — Solicitud sobre mis datos" /> con un identificador mínimo de tu cuenta y la empresa vinculada, si corresponde. Verificaremos que el pedido provenga de la persona habilitada antes de compartir o modificar datos. No envíes por correo contraseñas, códigos de acceso, documentos completos ni datos de tarjetas.</p>
        <p>El <Link href="/eliminacion-datos">procedimiento de eliminación de datos</Link> explica el alcance, la verificación y el seguimiento de una solicitud.</p>
        <p>Podés consultar <a href="https://www.argentina.gob.ar/aaip/datospersonales/derechos">tus derechos en el sitio oficial de la AAIP</a>. Si te niegan esos derechos o no recibís respuesta dentro de los plazos legales, podés <a href="https://www.argentina.gob.ar/servicio/denunciar-incumplimientos-de-la-ley-de-proteccion-de-datos-personales">presentar una denuncia ante la Agencia de Acceso a la Información Pública</a>.</p>
      </LegalSection>
      <LegalSection id="cambios" title="10. Actualizaciones de esta política">
        <p>Esta página identifica su fecha de actualización. Si se incorpora un tratamiento con una finalidad distinta o una función que necesita autorización específica, se informará en el recorrido correspondiente antes de solicitarla. Publicar una actualización no reemplaza ese consentimiento.</p>
        <p>Para conocer el uso del servicio, consultá los <Link href="/terminos">términos de uso</Link> y el <Link href="/manual">manual de inicio</Link>.</p>
      </LegalSection>
    </LegalPage>
  );
}
