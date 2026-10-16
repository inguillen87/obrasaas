import Link from 'next/link';
import {LegalEmail,LegalNotice,LegalSection} from '../../legal/legal-page';
import {ObraSaasLogo} from '../../brand/brand-logo';
import styles from '../../legal/legal.module.css';
import {PARTICIPANT_IDENTITY_NOTICES_PATH,PARTICIPANT_IDENTITY_NOTICE_VERSIONS,participantIdentityNotice,participantIdentityNoticeSelection,participantIdentityNoticeUrl} from '../../../lib/participant-kyc-notice-links.mjs';

const canonical='https://obrasaas.com/privacidad/identidad';
export const metadata={
 title:'Avisos de identidad | ObraSaaS',
 description:'Consultá el aviso completo de cada análisis opcional de identidad antes de elegir tu autorización.',
 alternates:{canonical},
 robots:{index:false,follow:true,noarchive:true},
 openGraph:{title:'Avisos de identidad | ObraSaaS',description:'Información sobre los análisis opcionales de identidad y sus límites.',url:canonical,type:'website'},
};

export default async function IdentityNoticesPage({searchParams}){
 const selection=participantIdentityNoticeSelection(await searchParams),notice=selection.notice;
 return (
  <div className={styles.page} data-public-legal-page={PARTICIPANT_IDENTITY_NOTICES_PATH}>
   <a className={styles.skip} href="#contenido-legal">Ir al contenido</a>
   <header className={styles.header}>
    <div className={styles.headerInner}>
     <Link href="/" aria-label="ObraSaaS, inicio" className={styles.brand}><ObraSaasLogo markSize={32} variant="inverse" /></Link>
     <nav aria-label="Accesos del sitio"><Link href="/privacidad">Privacidad</Link><Link href="/manual">Manual de inicio</Link></nav>
    </div>
   </header>
   <main id="contenido-legal" className={styles.main}>
    <section className={styles.hero} aria-labelledby="legal-title">
     <p className={styles.eyebrow}>TU INFORMACIÓN Y TUS OPCIONES</p>
     <h1 id="legal-title">Avisos de identidad</h1>
     <p className={styles.lead}>Leé el aviso completo antes de elegir en el chat. Cada análisis es opcional y tiene una autorización independiente.</p>
     <nav className={styles.documents} aria-label="Información legal"><Link href="/privacidad">Política de privacidad</Link><Link href="/terminos">Términos de uso</Link><Link href="/eliminacion-datos">Eliminación de datos</Link></nav>
    </section>
    <div className={styles.sections} style={{marginTop:32}}>
     {notice?(
      <LegalSection id="aviso-completo" title={notice.title}>
       <p className={styles.updated}>Versión del aviso: <strong>{notice.version}</strong></p>
       <p data-identity-notice-text={notice.version}>{notice.text}</p>
       <LegalNotice title="Tu elección se realiza en el chat"><p>Consultar esta página no autoriza ningún análisis ni cambia una autorización anterior. Volvé al chat para elegir. Podés continuar con revisión manual sin autorizar este análisis.</p></LegalNotice>
      </LegalSection>
     ):(
      <LegalSection id="elegir-aviso" title="Elegí el aviso que querés consultar">
       {selection.status==='INVALID'&&<p role="status">No pudimos identificar un aviso válido en ese enlace. Podés consultar las opciones de esta página.</p>}
       <p>Estos avisos explican qué datos se utilizan, cómo comienza cada análisis y cuáles son sus límites.</p>
       <ul>{PARTICIPANT_IDENTITY_NOTICE_VERSIONS.map(version=><li key={version}><Link href={participantIdentityNoticeUrl(version)}>{participantIdentityNotice(version).title}</Link></li>)}</ul>
      </LegalSection>
     )}
     <LegalSection id="consulta" title="Consultas y derechos sobre tus datos">
      <p>La <Link href="/privacidad">política de privacidad</Link> detalla los servicios que intervienen, las transferencias, la conservación y tus derechos. El ingreso a tu cuenta y la revisión de permisos son circuitos separados.</p>
      <p>Para consultas o solicitudes sobre tus datos, escribí a <LegalEmail subject="ObraSaaS — Consulta de privacidad de identidad" />. No envíes documentos completos ni códigos de acceso por correo.</p>
      <p>La presentación y sus análisis no certifican identidad civil, autenticidad del documento ni prueba de vida. Tampoco habilitan acceso a una obra o permisos operativos.</p>
     </LegalSection>
    </div>
    <footer className={styles.footer}>
     <div><p><strong>ObraSaaS, un producto de Inmovar LATAM.</strong></p><p>Titular del servicio: <strong>GUILLEN ALBA, MARCELO ARIEL</strong>.</p><p>Contacto: <LegalEmail /></p></div>
     <nav aria-label="Enlaces de información legal"><Link href={PARTICIPANT_IDENTITY_NOTICES_PATH}>Todos los avisos de identidad</Link><Link href="/privacidad">Privacidad</Link><Link href="/terminos">Términos de uso</Link><a href="#legal-title">Volver al inicio</a></nav>
    </footer>
   </main>
  </div>
 );
}
