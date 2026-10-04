import Link from 'next/link';
import { ObraSaasLogo } from '../brand/brand-logo';
import styles from './manual.module.css';

export const metadata = {
  title: 'Manual de inicio y WhatsApp · ObraSaaS',
  description: 'Cómo abrir tu constructora, preparar la primera obra, incorporar al equipo y comprobar WhatsApp con permisos y revisión humana.',
  alternates: { canonical: '/manual' },
};

const contents = [
  ['empezar', 'Abrir la empresa'], ['equipo', 'Invitar al equipo'], ['trabajo', 'Registrar trabajo'],
  ['clientes', 'Clientes y seguimiento'], ['whatsapp', 'Conectar WhatsApp'], ['menu', 'Usar el menú'],
  ['recuperacion', 'Resolver un resultado pendiente'], ['equipo-tecnico', 'Equipo técnico'],
];
const commands = [
  ['MENU / AYUDA', 'Abrir las opciones disponibles para tu participación.'],
  ['ENTRADA / PAUSA / VOLVER / SALIDA', 'Registrar la jornada y sus pausas, si tenés ese permiso.'],
  ['TAREAS / ESTADO', 'Consultar las tareas y el estado del circuito de la obra.'],
  ['EVIDENCIA', 'Elegir tarea y sector antes de enviar una foto, audio o video privado.'],
  ['INCIDENCIA / MATERIALES', 'Informar un problema o solicitar material para revisión.'],
  ['AVANCE', 'Proponer un avance respaldado por evidencia aprobada de la tarea.'],
  ['CANCELAR', 'Volver al menú; una operación ya guardada conserva su recibo.'],
];

function Step({ number, title, children }) {
  return <article className={styles.step}><span className={styles.number} aria-hidden="true">{number}</span><div><h3>{title}</h3>{children}</div></article>;
}

export default function ManualPage() {
  return <div className={styles.page}>
    <a className={styles.skip} href="#contenido-manual">Ir al contenido del manual</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" aria-label="ObraSaaS, inicio" className={styles.brand}><ObraSaasLogo markSize={32} variant="inverse" /></Link>
      <nav aria-label="Accesos del manual"><Link href="/">Portada</Link><Link href="/cuenta" className={styles.account}>Mi cuenta</Link></nav>
    </div></header>
    <main id="contenido-manual" className={styles.main}>
      <section className={styles.hero} aria-labelledby="manual-title">
        <p className={styles.eyebrow}>MANUAL DE INICIO</p>
        <h1 id="manual-title">Tu primera obra,<br />paso a paso.</h1>
        <p className={styles.lead}>Abrí la empresa, organizá las tareas e incorporá al equipo. Después prepará WhatsApp con las autorizaciones de cada cuenta y de cada número.</p>
        <div className={styles.heroActions}><Link href="/cuenta" className={styles.primary}>Empezar en Mi cuenta</Link><a href="#equipo-tecnico" className={styles.secondary}>Guía para el equipo técnico</a></div>
        <p className={styles.heroNote}>Podés empezar por la web sin conectar WhatsApp. Leer esta guía no crea registros ni envía mensajes.</p>
      </section>
      <div className={styles.layout}>
        <aside className={styles.index}><nav aria-label="Contenido del manual"><h2>En esta guía</h2>{contents.map(([id, title]) => <a key={id} href={`#${id}`}>{title}</a>)}</nav><p>Antes de guardar, comprobá la organización y la obra que están abiertas.</p></aside>
        <div className={styles.sections}>
          <section id="empezar" className={styles.section} aria-labelledby="empezar-title">
            <p className={styles.eyebrow}>01 · EMPRESA Y PRIMERA OBRA</p><h2 id="empezar-title">Abrir tu constructora</h2>
            <Step number="1" title="Ingresá con tu propia cuenta"><p>Entrá a <Link href="/sign-in">Ingresar</Link> o <Link href="/sign-up">Crear cuenta</Link>. Elegí Google o tu correo según las opciones que muestre Clerk. Completá la verificación del correo; no uses la cuenta de otro integrante.</p></Step>
            <Step number="2" title="Creá o seleccioná la organización"><p>En <strong>Mi cuenta → Organización activa</strong>, usá el selector para crear la organización de la constructora. Si ya te invitaron a una empresa, aceptá esa invitación y elegila. Sólo su administrador puede completar el alta inicial.</p></Step>
            <Step number="3" title="Completá «Tu empresa, desde cero»"><p>Cargá el nombre de la empresa y de la primera obra. La dirección es opcional: escribirla no configura el GPS. Podés agregar hasta 25 primeras tareas, con inicio y fin previstos, o dejar el cronograma vacío.</p><p>Revisá la confirmación y elegí <strong>Crear empresa y primera obra</strong>. Cada tarea empieza con avance cero. El nombre de la empresa no acredita una verificación legal.</p></Step>
            <Step number="4" title="Abrí la obra y revisá el cronograma"><p>Tras recibir el comprobante, elegí <strong>Entrar a mi obra</strong>. En Mis obras, abrí la obra y usá Tareas para crear o planificar actividades. Una fecha prevista no registra trabajo ni aprueba avance.</p><p>Usá <strong>Buscar tareas</strong>, los filtros de estado y planificación, o el orden por nombre e inicio previsto. <strong>Limpiar filtros</strong> vuelve a mostrar las tareas cargadas. Un <strong>Resumen parcial</strong> considera sólo esas tareas: usá <strong>Cargar más tareas</strong> para ampliar la consulta. Filtrar conserva la planificación que estés editando.</p></Step>
            <div className={styles.callout}><strong>Si no llega la confirmación</strong><p>Usá <strong>Comprobar creación</strong>. No abras otra organización para repetir el alta. Reenviá el mismo intento sólo cuando la pantalla lo permita tras comprobar su estado.</p></div>
          </section>

          <section id="equipo" className={styles.section} aria-labelledby="equipo-title">
            <p className={styles.eyebrow}>02 · PERSONAS Y ACCESO</p><h2 id="equipo-title">Invitar al equipo y revisar su identidad</h2>
            <ol className={styles.stepsList}>
              <li>El responsable guarda la ficha en <strong>Equipo, incidencias y materiales → Abrir registro → Agregar persona</strong>. Una ficha o un teléfono declarado no crean acceso por sí solos.</li>
              <li>Después, en <strong>Participantes y revisión de identidad</strong>, asigna los permisos de jornada o reportes que correspondan y envía la invitación al correo correcto. Si el envío queda pendiente, consulta su resultado antes de volver a invitar.</li>
              <li>El invitado abre el correo, completa el ingreso oficial y acepta la participación en esa obra. La cuenta y la pertenencia deben coincidir con la invitación. También puede usar un correo secundario verificado de su propia cuenta; no hace falta reemplazar su correo principal. Un correo declarado sin verificar no habilita la invitación.</li>
              <li>Desde su autoservicio, el participante lee el aviso y decide si presenta el frente de su documento y una selfie. Puede tomar o elegir JPEG, PNG o WebP de hasta <strong>20 MiB y 24 megapíxeles</strong>. La preparación se realiza en su dispositivo y conserva el original; la imagen a enviar queda dentro de <strong>1 MiB por imagen</strong>.</li>
              <li>Antes de usar cada imagen, revisa la vista previa, su orientación y la legibilidad del documento o del rostro. Puede girarla o descartarla. HEIC requiere guardar una copia JPEG. Sólo después de revisar ambas imágenes y aceptar el aviso se presenta la solicitud, con almacenamiento privado.</li>
              <li>Otro administrador o director autorizado consulta ambas imágenes y registra una decisión con fundamento. <strong>Pendiente de revisión</strong> no habilita actividad de campo ni equivale a aprobación.</li>
            </ol>
            <div className={styles.callout}><strong>La revisión es humana</strong><p>ObraSaaS no implementa coincidencia facial, prueba de vida ni certificación civil del DNI. Una extracción de texto con IA no reemplaza esas capacidades ni aprueba la identidad automáticamente. No envíes DNI o selfies por el chat de WhatsApp de obra.</p></div>
            <details className={styles.details}><summary>Qué puede hacer cada rol</summary><ul>
              <li><strong>Administrador:</strong> alta, equipo, permisos y gestión comercial de la empresa.</li>
              <li><strong>Director:</strong> gestión de obras y revisiones autorizadas; no obtiene el CRM comercial por ese rol.</li>
              <li><strong>Jefe de obra:</strong> consulta y planificación de las obras asignadas.</li>
              <li><strong>Administración y Auditor:</strong> consulta de las obras asignadas, sin aprobación de compras o avances.</li>
              <li><strong>Participación de campo:</strong> jornada y reportes propios según los permisos de la ficha. No autoriza a administrar personas ni aprobar su propio trabajo.</li>
            </ul></details>
          </section>

          <section id="trabajo" className={styles.section} aria-labelledby="trabajo-title">
            <p className={styles.eyebrow}>03 · TRABAJO EN LA WEB</p><h2 id="trabajo-title">Jornada, evidencia y avance</h2>
            <p>En la obra abierta, entrá a <strong>Jornada y evidencia → Abrir operaciones</strong>. Antes de fichar, un administrador o director debe configurar el sector de la obra y su ubicación.</p>
            <p>En <strong>Sectores y QR</strong>, agregá o editá el sector que corresponde. Revisá su nombre, el centro y el radio; podés obtener una ubicación puntual desde el teléfono o completar las coordenadas. Obtenerla no guarda la configuración ni acredita el perímetro de la obra. Guardar una modificación renueva los QR de todos los sectores: revisá la confirmación y reemplazá los códigos colocados.</p>
            <p>Para volver a imprimir un código, descargá el <strong>QR vigente</strong> del sector. No hace falta guardar otra configuración ni renovar los códigos. La descarga comprueba tus permisos y la versión actual; si la configuración cambió, actualizá el listado antes de imprimir.</p>
            <p>Para leerlo, elegí primero el sector y tocá <strong>Leer QR con cámara</strong>. La lectura se realiza en tu dispositivo; las imágenes de esa cámara no se guardan ni se envían. Podés <strong>Detener lectura QR</strong> incluso mientras esperás el permiso. Si no se lee en 30 segundos, la lectura termina y podés volver a iniciarla. Un código de otra obra o sector se rechaza.</p>
            <p>Si la cámara no está disponible, abrí <strong>Pegar un QR leído con otra aplicación</strong>. Leer o pegar el código no guarda el fichaje: revisá la ubicación y elegí <strong>Guardar con recibo</strong>. Al cambiar de sector, volvé a leer su QR.</p>
            <div className={styles.cardGrid}>
              <article><h3>Jornada</h3><p>Elegí entrada, pausa, regreso o salida. Para entrada y salida, obtené la ubicación puntual desde el teléfono y leé el QR vigente del sector con la cámara, si el navegador lo permite. Una ubicación válida fuera del perímetro o un fichaje sin QR requiere revisión. Si no hay permiso de ubicación, la lectura quedó antigua o la precisión es peor de 100 metros, corregí el error antes de fichar.</p></article>
              <article><h3>Evidencia privada</h3><p>Elegí tarea y sector, capturá o adjuntá el archivo y explicá qué registra. Fotos hasta 2 MiB; audio y video hasta 3 MiB. Un análisis o transcripción de IA es orientativo y conserva la revisión humana. El video se revisa por una persona; no se analiza automáticamente.</p></article>
              <article><h3>Avance</h3><p>Presentá una propuesta con evidencia ya aprobada de esa tarea y un fundamento. El avance del cronograma cambia después de la aprobación del responsable autorizado, nunca por subir un archivo.</p><p>Al decidir, revisá los archivos vinculados que muestra la propuesta. Si un archivo es antiguo y no aparece en el listado, usá <strong>Consultar archivos de esta propuesta</strong>. Abrirlo o descargarlo comprueba nuevamente tu acceso; consultar no aprueba el avance.</p></article>
              <article><h3>Materiales e incidencias</h3><p>Indicá sector, detalle y tarea relacionada cuando corresponda. Pedir material no autoriza una compra. Informar una incidencia deja un registro para seguimiento.</p></article>
            </div>
            <p className={styles.note}>Los permisos de cámara y ubicación se conceden en el navegador. Se guarda una ubicación puntual para el fichaje; no se realiza seguimiento continuo.</p>
          </section>

          <section id="clientes" className={styles.section} aria-labelledby="clientes-title">
            <p className={styles.eyebrow}>04 · SEGUIMIENTO COMERCIAL</p><h2 id="clientes-title">Clientes y oportunidades</h2>
            <p>El <strong>administrador</strong> accede a <strong>Mi cuenta → Abrir obra → Clientes</strong>. Cargá nombre, contacto, correo, teléfono, etapa, actividad, origen, próximo seguimiento y notas. Las fichas pertenecen a toda la empresa; la obra abierta aporta el contexto autorizado.</p>
            <p>La consulta muestra páginas de 20 registros. Usá Buscar clientes para consultar toda tu empresa por nombre, contacto, correo o teléfono; las páginas conservan la búsqueda. No hace falta respetar las mayúsculas, pero sí las tildes del dato guardado. Si una ficha cambió mientras editabas, consultá su versión vigente, compará los datos y revisá el cambio antes de guardar.</p>
            <p className={styles.note}>Guardar un cliente no verifica su número ni autoriza WhatsApp. Este CRM cubre contactos y etapas; no genera cotizaciones, presupuestos formales, licitaciones o automatizaciones comerciales.</p>
          </section>

          <section id="whatsapp" className={styles.section} aria-labelledby="whatsapp-title">
            <p className={styles.eyebrow}>05 · WHATSAPP DE LA EMPRESA</p><h2 id="whatsapp-title">Preparar y autorizar tu número</h2>
            <p>Este recorrido corresponde al número propio de la empresa. Tener la preparación guardada no significa que Meta ya autorizó la conexión.</p>
            <ol className={styles.stepsList}>
              <li>En <strong>Preparar WhatsApp → Tu número. Tu obra.</strong>, elegí nombre del asistente, tipo de número y circuitos. Para el alta autoservicio actual, prepará un <strong>número nuevo dedicado</strong> que puedas verificar por SMS o llamada. Migrar un número existente requiere revisión específica.</li>
              <li>Abrí <strong>Autorizar WhatsApp con Meta → Ver conexión</strong>. Si indica configuración de plataforma pendiente, el equipo técnico debe resolverla; no alcanza con disponer del teléfono.</li>
              <li>Cuando la pantalla lo habilite, elegí <strong>Preparar autorización</strong> y <strong>Autorizar en Meta</strong>. Un responsable con autoridad sobre los activos completa la ventana oficial de Meta. No compartas tokens, claves o contraseñas con otros usuarios.</li>
              <li>Completá en Meta la verificación del teléfono mediante SMS o llamada. Si el panel pide registro, elegí un <strong>PIN de seguridad de seis dígitos</strong> y confirmá <strong>Registrar este número</strong>. Ese PIN no es el código de verificación recibido.</li>
              <li>En <strong>Mensajes operativos de esta empresa</strong>, prepará y revisá las plantillas necesarias antes de solicitar aprobación. <strong>Aprobada por Meta</strong> debe corresponder a esa cuenta, texto e idioma; no autoriza envíos por sí sola.</li>
              <li>El administrador consulta <strong>Operación del canal</strong>, revisa la confirmación y elige <strong>Comprobar y habilitar canal</strong> cuando esté disponible. La recepción firmada y las pruebas reales de entrega se comprueban por separado.</li>
              <li>Cada participante habilitado abre <strong>Mi WhatsApp de obra</strong>, solicita su código y envía el mensaje completo <code>VINCULAR …</code> desde el número exacto de su ficha al canal indicado. El código vence a los cinco minutos, es de un solo uso y no se recupera desde un recibo.</li>
            </ol>
            <div className={styles.callout}><strong>Qué tiene que completar una persona</strong><p>Un responsable con acceso al negocio elige y autoriza sus activos en la ventana oficial de Meta. La persona que tiene el teléfono recibe el SMS o la llamada y completa la verificación allí; no es el PIN de registro. Si Meta pide documentos o decisiones sobre el negocio, su titular debe completar ese paso.</p><p>Para aceptar el piloto, dos personas deben comprobar sus accesos con roles distintos, presentar y revisar la identidad, probar ubicación y QR en la obra y verificar mensajes en sus teléfonos. Las pruebas automáticas con datos de ensayo no reemplazan esa aceptación.</p></div>
            <div className={styles.callout}><strong>Un recordatorio manual, con autorización propia</strong><p>Sólo el <strong>recordatorio de jornada abierta</strong> tiene envío manual adoptado. Requiere una jornada abierta, plantilla vigente aprobada, canal activo, vínculo y KYC vigentes, y consentimiento del trabajador en su propio autoservicio. ADMIN o DIRECTOR revisa y confirma el envío.</p><p>Invitación, pedido de información y aviso de avance pendiente existen como catálogo de preparación/aprobación; sus envíos proactivos todavía no están implementados. No hay envío automático de esos mensajes.</p></div>
            <details className={styles.details}><summary>Piloto con el número demo</summary><p>Si aparece el panel <strong>Piloto con el número demo</strong>, usá <strong>Consultar piloto demo</strong> y revisá las dos confirmaciones antes de <strong>Preparar piloto demo</strong>. Su disponibilidad depende de las comprobaciones que muestre la cuenta.</p><p>El piloto usa una obra vacía dedicada, tu propia ficha autorizada y un número permitido para pruebas. Cuando se habilite, generá el código del piloto y enviá <code>VINCULAR …</code> desde tu número al número de prueba que muestra el panel. Podés revocarlo desde <strong>Revocar piloto demo</strong>.</p><p><strong>DEMO</strong> identifica mensajes y datos de prueba. No conecta el número comercial, no envía plantillas proactivas ni certifica identidad, jornada o avance de una obra real. Una implementación local o un recibo de preparación no acreditan que el piloto esté publicado y operativo.</p></details>
          </section>

          <section id="menu" className={styles.section} aria-labelledby="menu-title">
            <p className={styles.eyebrow}>06 · CONVERSACIÓN DE OBRA</p><h2 id="menu-title">Qué escribir en WhatsApp</h2>
            <p>Después de vincularte a un canal habilitado, escribí <code>MENU</code>. Las opciones dependen de tus permisos actuales. Elegí las opciones del último menú y revisá cada confirmación antes de guardar.</p>
            <p>El menú de jornada ofrece entrada, pausa, reanudación o salida según tu jornada vigente. Si un dato de avance o materiales no es válido, corregilo como indica la respuesta: el borrador sigue pendiente y todavía no se guardó ni se aprobó.</p>
            <dl className={styles.commands}>{commands.map(([command, explanation]) => <div key={command}><dt><code>{command}</code></dt><dd>{explanation}</dd></div>)}</dl>
            <p className={styles.note}>WhatsApp no informa la precisión GPS ni aporta el QR del sector: entrada y salida quedan para revisión humana. No permite aprobar identidades, compras o avances escribiendo un mensaje. Si una opción venció, abrí un menú nuevo.</p>
          </section>

          <section id="recuperacion" className={styles.section} aria-labelledby="recuperacion-title">
            <p className={styles.eyebrow}>07 · COMPROBAR ANTES DE REPETIR</p><h2 id="recuperacion-title">Cuando el resultado queda pendiente</h2>
            <ol className={styles.stepsList}><li>Conservá la empresa y la obra correctas. Usá <strong>Comprobar estado</strong>, <strong>Comprobar creación</strong> o la acción de consultar recibo que ofrezca el panel.</li><li>La consulta comprueba lo registrado y no repite el envío. Una respuesta de aceptación de Meta tampoco demuestra entrega al teléfono: revisá el estado de entrega.</li><li>Si la sesión terminó, volvé a ingresar y seleccioná la misma empresa y obra. Si cambiaron los permisos o la revisión, consultá el estado actual antes de decidir.</li><li>No generes otro intento para eludir un envío incierto. Un registro rechazado definitivamente puede habilitar una nueva confirmación explícita; un resultado desconocido se recupera primero.</li></ol>
            <div className={styles.callout}><strong>Qué conserva el navegador</strong><p>Las referencias pendientes guardan identificadores mínimos en IndexedDB para consultar el recibo, sin textos, imágenes, PIN ni códigos de vinculación. No son una copia de tus borradores ni una cola de archivos sin conexión. Para consultar se necesita conexión y acceso vigente.</p><p>Después de una actualización de la aplicación, recargá las pestañas antiguas antes de continuar. Si el almacenamiento del navegador falla, resolvelo antes de volver a guardar; no eludas la comprobación desde otra pestaña.</p></div>
          </section>

          <section id="equipo-tecnico" className={styles.section} aria-labelledby="tecnico-title">
            <p className={styles.eyebrow}>08 · EQUIPO TÉCNICO</p><h2 id="tecnico-title">Comprobaciones antes de liberar el piloto</h2>
            <p>Esta sección acompaña al equipo que configura y verifica la plataforma. No solicita credenciales en el manual ni ejecuta cambios del proveedor.</p>
            <p className={styles.note}>La dirección <code>/api/webhooks/whatsapp</code> es el receptor técnico de Meta. Abrirla directamente en el navegador no configura WhatsApp y puede mostrar un error de verificación. Para preparar la empresa y consultar su conexión, usá <Link href="/cuenta">Mi cuenta</Link>.</p>
            <details className={styles.details}><summary>Identidad y alta de empresa</summary><ul><li>Comprobar instancia Production de Clerk, claves existentes y dominio autorizado. El ingreso social necesita clientes OAuth propios y retorno exacto; un botón visible no prueba la sesión.</li><li>Verificar correo primario y pertenencia oficial de administrador. El alta valida sesión y prueba de perfil firmadas, y crea empresa, primera obra y recibo en la misma transacción.</li><li>Comprobar invitación recibida y aceptada por la cuenta correcta, pertenencia canónica y obra asignada. No usar un teléfono o correo escrito como autoridad.</li><li>Probar carga y descarga privadas con el titular y otro revisor autorizado. Eliminar de los registros de diagnóstico documentos, selfies y localizadores privados.</li></ul></details>
            <details className={styles.details}><summary>Meta: configuración y recorrido completo</summary><ul><li>Revisar la verificación comercial del negocio y los requisitos de proveedor tecnológico que Meta solicite, publicación de la app, App Review y acceso efectivo a los permisos para Embedded Signup. Comprobar configuración autorizada y dominios. Si esos requisitos siguen pendientes, no liberar el alta por disponer de un número.</li><li>Comprobar propiedad de cuenta WhatsApp y teléfono, token acotado a esos activos, vigencia, registro del número y suscripción del callback dedicado.</li><li>Verificar el callback HTTPS: desafío inicial autorizado y mensajes con firma HMAC válida. Un GET de verificación no acredita un POST firmado. Conservar el evento cifrado y su correlación por empresa, obra y conexión.</li><li>Ejecutar procesador canónico y recuperación protegida, comprobar reserva durable, vínculo actual del trabajador y respuesta del proveedor. El job de recuperación requiere un programador configurado y autenticado; no se presume activo por existir código.</li><li>Comprobar plantillas en la WABA correcta y separar aprobación, aceptación del envío y entrega firmada. La demo y el canal cliente usan ámbitos distintos.</li></ul></details>
            <details className={styles.details}><summary>Diagnóstico y recuperación seguros</summary><ul><li>Registrar entorno, versión publicada, ruta, hora, código de error e identificador del recibo. No incluir JWT, App Secret, tokens Meta, PIN, código VINCULAR ni contenido privado.</li><li>Un callback rechazado informa la etapa, categoría, estado HTTP y si se comprobó la firma. No interpretar un estado 400 por sí solo como firma válida o mensaje procesado.</li><li>Los avisos de recuperación muestran conteos de fallos y respuestas inciertas, separados entre clientes y demo. Un cron con respuesta 200 no demuestra que todos los eventos se procesaron; contrastá esos avisos y los recibos privados autorizados. El control previo de la base también exige las columnas usadas para reservar, terminar y recuperar eventos.</li><li>Consultar el recibo con GET dentro del mismo actor, empresa y obra. Un estado general del evento no atribuye una acción al UUID del usuario.</li><li>Ante un conflicto de revisión, conservar el fundamento, consultar la ficha vigente y solicitar una nueva revisión de la persona que decide. No repetir automáticamente un POST.</li><li>Verificar aislamiento entre empresas y pestañas, revocación de permisos, recuperación tras recarga y ausencia de un segundo envío. Las referencias del navegador no sustituyen la auditoría del servidor.</li></ul></details>
            <details className={styles.details}><summary>Qué evidencia permite dar cada paso por terminado</summary><ul><li><strong>Implementado:</strong> el flujo existe en el código canónico.</li><li><strong>Probado técnicamente:</strong> se ejecutó con controles documentados; material sintético y proveedores controlados se identifican expresamente.</li><li><strong>Publicado:</strong> versión y despliegue coinciden con el dominio servido.</li><li><strong>Aceptado en una prueba real:</strong> actor autorizado, cuenta/número reales y resultado de cada paso quedan comprobados. No se deriva de los tres estados anteriores.</li></ul><p>Presupuestos formales, licitaciones, automatizaciones comerciales, biometría/liveness y borradores o archivos offline no forman parte del recorrido disponible aquí.</p></details>
          </section>
        </div>
      </div>
      <footer className={styles.footer}><p>Guía revisada el 4 de octubre de 2026 · ObraSaaS, un producto desarrollado por Inmovar LATAM.</p><div><Link href="/cuenta">Ir a Mi cuenta</Link><a href="#manual-title">Volver al inicio del manual</a></div></footer>
    </main>
  </div>;
}
