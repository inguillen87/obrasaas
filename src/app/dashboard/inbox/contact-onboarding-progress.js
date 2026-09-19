'use client';
import Link from 'next/link';
import { tokens } from '@/lib/design-system';
import { onboardingClaimHref, participantProgressCopy } from '@/lib/whatsapp/participant-onboarding-progress';
import { requestWorkspaceNavigation } from '@/lib/workspace-leave-policy';
import styles from './contact-onboarding-progress.module.css';
const roleLabel = { WORKER:'Operario', FOREMAN:'Capataz', SITE_MANAGER:'Jefatura de obra', SAFETY:'Seguridad e higiene' };
const stages = ['Invitación', 'Datos del trabajador', 'Revisión', 'Acceso vigente'];
export default function ContactOnboardingProgress({ onboarding, projectName, canManageIntegrations = false, online = true, onRefresh }) {
  const copy = participantProgressCopy(onboarding);
  const theme = { '--onboarding-bg':tokens.colors.bg.secondary, '--onboarding-border':tokens.colors.border.default, '--onboarding-text':tokens.colors.text.primary, '--onboarding-muted':tokens.colors.text.secondary, '--onboarding-accent':tokens.colors.accent.primary };
  function navigate(event) { if (!requestWorkspaceNavigation('route')) event.preventDefault(); }
  return <section style={theme} className={styles.panel} data-tone={copy.tone} aria-label="Seguimiento del alta de este contacto">
    <header><span>INCORPORACIÓN A LA OBRA</span><strong>{copy.title}</strong>{projectName && <small>{projectName}</small>}</header>
    <ol aria-label="Etapas del alta">{stages.map((label,index) => <li key={label} aria-current={copy.step === index + 1 ? 'step' : undefined}><span>{index+1}</span>{label}</li>)}</ol>
    <p>{copy.detail}</p>
    {onboarding.currentAccess && <p className={styles.access}>Rol actual: <strong>{roleLabel[onboarding.currentAccess.role]}</strong>. No otorga acceso a otras empresas u obras.</p>}
    {onboarding.reason && onboarding.state === 'closed' && <p className={styles.reason}>{onboarding.reason}</p>}
    <footer>
      {onboarding.claimId && <Link href={onboardingClaimHref(onboarding.claimId)} prefetch={false} onNavigate={navigate}>{onboarding.claimStatus === 'SUBMITTED' ? 'Revisar esta alta' : 'Abrir el alta vinculada'} <span aria-hidden="true">→</span></Link>}
      {onboarding.needsIntegration && canManageIntegrations && <Link href="/dashboard/integrations" prefetch={false} onNavigate={navigate}>Revisar canal en Integraciones</Link>}
      {(onboarding.state === 'conflict' || onboarding.state === 'authorized') && <Link href={onboarding.currentAccess ? '/dashboard/team#field-worker-' + encodeURIComponent(onboarding.currentAccess.workerId) : '/dashboard/team#worker-onboarding'} prefetch={false} onNavigate={navigate}>Consultar acceso en Equipo</Link>}
      {onboarding.state !== 'eligible' && <button type="button" disabled={!online} onClick={() => void onRefresh?.()}>Actualizar seguimiento</button>}
    </footer>
    <small className={styles.note}>La invitación, la aprobación y la autorización vigente son pasos distintos. Actualizar no envía mensajes ni reactiva accesos.</small>
  </section>;
}
