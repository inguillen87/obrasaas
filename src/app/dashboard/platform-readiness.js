import Link from 'next/link';
import styles from './platform-readiness.module.css';

const SYNC_LABELS = {
  live: 'Sincronizado',
  syncing: 'Actualizando',
  error: 'Conexión interrumpida',
};

export default function PlatformReadiness({ platformAccess, setup, syncState, lastSyncedAt }) {
  const teamReady = setup.membershipCount > 1;
  const whatsappChannel = setup.whatsappChannel || {
    connected: false,
    label: 'WhatsApp por verificar',
    requiresAttention: false,
  };
  const whatsappClass = whatsappChannel.connected
    ? styles.ready
    : whatsappChannel.requiresAttention ? styles.attention : styles.action;
  const whatsappIcon = whatsappChannel.connected
    ? 'fa-solid fa-check'
    : whatsappChannel.requiresAttention ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-arrow-right';
  const trialEndLabel = platformAccess.organization.trialEndsAt
    ? new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(platformAccess.organization.trialEndsAt))
    : null;
  const planLabel = platformAccess.organization.plan === 'TRIAL'
    ? `Prueba${trialEndLabel ? ` · hasta ${trialEndLabel}` : ''}`
    : platformAccess.organization.plan;

  return (
    <section className={styles.shell} aria-label="Estado de configuración de ObraSaaS">
      <div className={styles.summary}>
        <div>
          <p className={styles.eyebrow}>Centro operativo</p>
          <strong>{platformAccess.organization.name}</strong>
          <span>{planLabel} · {platformAccess.tenantRole === 'SUPERADMIN' ? 'Superadmin' : platformAccess.tenantRole}</span>
        </div>
        <div className={`${styles.sync} ${styles[syncState]}`}>
          <i aria-hidden="true" />
          <span>{SYNC_LABELS[syncState] || SYNC_LABELS.live}</span>
          <time dateTime={lastSyncedAt}>
            {new Intl.DateTimeFormat('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Argentina/Buenos_Aires',
            }).format(new Date(lastSyncedAt))}
          </time>
        </div>
      </div>

      <div className={styles.steps}>
        <article className={styles.ready}>
          <span>01</span>
          <div><strong>Empresa activa</strong><small>Tenant aislado y autenticado</small></div>
          <i className="fa-solid fa-check" aria-hidden="true" />
        </article>
        {setup.canViewTeam ? (
          <Link href="/dashboard/team" className={teamReady ? styles.ready : styles.recommended}>
            <span>02</span>
            <div><strong>Equipo</strong><small>{setup.membershipCount} miembro{setup.membershipCount === 1 ? '' : 's'} activo{setup.membershipCount === 1 ? '' : 's'}</small></div>
            <i className={teamReady ? 'fa-solid fa-check' : 'fa-solid fa-arrow-right'} aria-hidden="true" />
          </Link>
        ) : (
          <article className={teamReady ? styles.ready : styles.recommended}>
            <span>02</span>
            <div><strong>Equipo</strong><small>Gestionado por un responsable</small></div>
            <i className={teamReady ? 'fa-solid fa-check' : 'fa-solid fa-lock'} aria-hidden="true" />
          </article>
        )}
        {setup.canManageIntegrations ? (
          <Link href="/dashboard/integrations" className={whatsappClass}>
            <span>03</span>
            <div><strong>WhatsApp</strong><small>{whatsappChannel.label}</small></div>
            <i className={whatsappIcon} aria-hidden="true" />
          </Link>
        ) : (
          <article className={whatsappChannel.connected ? styles.ready : whatsappChannel.requiresAttention ? styles.attention : styles.recommended}>
            <span>03</span>
            <div><strong>WhatsApp</strong><small>{whatsappChannel.requiresAttention ? whatsappChannel.label : whatsappChannel.connected ? whatsappChannel.label : 'Pendiente del administrador'}</small></div>
            <i className={whatsappChannel.connected ? 'fa-solid fa-check' : whatsappChannel.requiresAttention ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-lock'} aria-hidden="true" />
          </article>
        )}
        <article className={setup.isEmptyState ? styles.recommended : styles.ready}>
          <span>04</span>
          <div><strong>Datos de obra</strong><small>{setup.isEmptyState ? 'Sin actividad registrada' : 'Operación persistida'}</small></div>
          <i className={setup.isEmptyState ? 'fa-solid fa-inbox' : 'fa-solid fa-check'} aria-hidden="true" />
        </article>
      </div>

      <div className={styles.guide}>
        <div>
          <i className="fa-solid fa-route" aria-hidden="true" />
          <p>
            <strong>{setup.isEmptyState ? 'Empezá por una señal verificable' : 'Revisá la puesta en marcha'}</strong>
            <span>
              {setup.isEmptyState
                ? 'Configurá la obra, agregá una persona y creá la primera tarea antes de emitir el reporte.'
                : 'La guía distingue datos reales, pruebas locales y conexiones externas confirmadas.'}
            </span>
          </p>
        </div>
        <Link href="/dashboard/getting-started">
          Abrir guía de primer valor <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
