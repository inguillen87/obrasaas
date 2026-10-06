import Link from 'next/link';
import { ObraSaasLogo } from '@/app/brand/brand-logo';
import styles from './identity.module.css';

export function AuthIntro({ registering = false }) {
  return <aside className={styles.authIntro} aria-label="Tu espacio en ObraSaaS">
    <Link href="/" className={styles.brand}><ObraSaasLogo markSize={38} variant="inverse" /></Link>
    <div className={styles.authStory}>
      <p className={styles.authKicker}>DEL EQUIPO A LA OBRA</p>
      <h2>{registering ? <>Primero tu cuenta.<br/>Después, tu constructora.</> : <>Tu equipo. Tu obra.<br/>Todo conectado.</>}</h2>
      <p>Planificá, recibí novedades del campo y decidí con la evidencia a mano.</p>
      <ol className={styles.authSteps}>
        <li><span aria-hidden="true">01</span><div><strong>Empresa y obras</strong><p>Un espacio propio para organizar cada proyecto.</p></div></li>
        <li><span aria-hidden="true">02</span><div><strong>Equipo y permisos</strong><p>Cada persona accede a lo que le corresponde.</p></div></li>
        <li><span aria-hidden="true">03</span><div><strong>WhatsApp de la empresa</strong><p>Prepará tu número y continuá con la autorización oficial de Meta.</p></div></li>
      </ol>
    </div>
    <div className={styles.authHelp}><p>¿Es tu primera vez?</p><Link href="/manual">Conocé el recorrido de inicio <span aria-hidden="true">↗</span></Link><small>Un producto de Inmovar LATAM</small></div>
  </aside>;
}
