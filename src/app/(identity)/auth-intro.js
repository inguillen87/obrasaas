import Link from 'next/link';
import { ObraSaasLogo } from '@/app/brand/brand-logo';
import styles from './identity.module.css';

export function AuthIntro({ registering = false }) {
  return <aside className={styles.authIntro} aria-label="Tu espacio en ObraSaaS">
    <Link href="/" className={styles.brand}><ObraSaasLogo markSize={38} variant="inverse" /></Link>
    <div className={styles.authStory}>
      <p className={styles.authKicker}>TU CUENTA PERSONAL</p>
      <h2>{registering ? <>Tu cuenta personal.<br/>Empresa o invitación.</> : <>Tu cuenta personal.<br/>Acceso según tus permisos.</>}</h2>
      <p>Creá una empresa o aceptá una invitación. Jornadas, avances y materiales se registran y revisan dentro de cada obra.</p>
      <ol className={styles.authSteps}>
        <li><span aria-hidden="true">01</span><div><strong>Empresa o invitación</strong><p>Creá una empresa o ingresá a la que te invite.</p></div></li>
        <li><span aria-hidden="true">02</span><div><strong>Equipo y permisos</strong><p>Cada persona accede a lo que le corresponde.</p></div></li>
        <li><span aria-hidden="true">03</span><div><strong>WhatsApp de la empresa</strong><p>Su administrador prepara el número y continúa con la autorización oficial de Meta.</p></div></li>
      </ol>
    </div>
    <div className={styles.authHelp}><p>¿Es tu primera vez?</p><Link href="/manual">Conocé el recorrido de inicio <span aria-hidden="true">↗</span></Link><small>Un producto de Inmovar LATAM</small></div>
  </aside>;
}
